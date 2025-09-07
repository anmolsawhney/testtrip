/**
 * @description
 * Server actions for managing user wishlists (or "Bucket Lists") in the TripRizz application.
 * Provides functionality to add/remove itineraries from a user's private wishlist,
 * check wishlist status, and retrieve the full wishlist content.
 * UPDATED: `getWishlistAction` now filters out trips from soft-deleted users.
 *
 * Key features:
 * - Toggle Wishlist Item: Adds or removes an itinerary from the user's wishlist.
 * - Check Wishlist Status: Determines if a user has a specific itinerary in their wishlist.
 * - Get Wishlist: Retrieves all itineraries currently in the user's wishlist, excluding those from deleted creators.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (wishlistItemsTable, itinerariesTable, profilesTable).
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations (eq, and, desc, etc.).
 *
 * @notes
 * - All actions are server-side only (`"use server"`).
 * - Uses `ActionState` for consistent return structure.
 * - Wishlists are private to each user.
 * - Authorization checks ensure users are logged in before performing actions.
 */
"use server";

import { db } from "@/db/db";
import {
  wishlistItemsTable,
  itinerariesTable,
  SelectItinerary, // Needed for getWishlistAction
  profilesTable, // Implicitly used via relations if needed later
  
} from "@/db/schema";
import { ActionState } from "@/types";
import { auth } from "@clerk/nextjs/server";
import { and, not, like, eq, desc, inArray } from "drizzle-orm";

/**
 * Toggles an itinerary in the current user's wishlist.
 * If the item isn't in the wishlist, adds it.
 * If the item is already in the wishlist, removes it.
 *
 * @param itineraryId - The UUID of the itinerary to add/remove from the wishlist.
 * @returns Promise resolving to ActionState containing the new wishlist status ({ wishlisted: boolean }).
 */
export async function toggleWishlistAction(
  itineraryId: string
): Promise<ActionState<{ wishlisted: boolean }>> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." };
  }

  if (!itineraryId) {
    return { isSuccess: false, message: "Itinerary ID is required." };
  }

  try {
    // Check if the item already exists in the wishlist
    const existingItem = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItemsTable.userId, userId),
        eq(wishlistItemsTable.itineraryId, itineraryId)
      ),
      columns: { userId: true }, // Only need existence check
    });

    let wishlisted: boolean;

    if (existingItem) {
      // Item exists, so remove it
      console.log(
        `[Action toggleWishlist] User ${userId} removing itinerary ${itineraryId} from wishlist.`
      );
      await db
        .delete(wishlistItemsTable)
        .where(
          and(
            eq(wishlistItemsTable.userId, userId),
            eq(wishlistItemsTable.itineraryId, itineraryId)
          )
        );
      wishlisted = false;
    } else {
      // Item doesn't exist, so add it
      console.log(
        `[Action toggleWishlist] User ${userId} adding itinerary ${itineraryId} to wishlist.`
      );
      await db.insert(wishlistItemsTable).values({
        userId: userId,
        itineraryId: itineraryId,
      });
      wishlisted = true;
    }

    return {
      isSuccess: true,
      message: wishlisted
        ? "Itinerary added to wishlist."
        : "Itinerary removed from wishlist.",
      data: { wishlisted },
    };
  } catch (error) {
    console.error("[Action toggleWishlist] Error:", error);
    // Check for specific errors like foreign key violation if the itinerary doesn't exist
    if (error instanceof Error && error.message.includes("violates foreign key constraint")) {
         return { isSuccess: false, message: "Cannot add non-existent itinerary to wishlist." };
    }
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update wishlist.",
    };
  }
}

/**
 * Checks if the current user has a specific itinerary in their wishlist.
 *
 * @param itineraryId - The UUID of the itinerary to check.
 * @returns Promise resolving to ActionState containing boolean `true` if wishlisted, `false` otherwise.
 */
export async function isItineraryWishlistedAction(
  itineraryId: string
): Promise<ActionState<boolean>> {
  const { userId } = await auth();
  if (!userId) {
    // Consider logged-out users as not having anything wishlisted
    return { isSuccess: true, message: "User not logged in.", data: false };
  }

  if (!itineraryId) {
    return { isSuccess: false, message: "Itinerary ID is required." };
  }

  try {
    const existingItem = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItemsTable.userId, userId),
        eq(wishlistItemsTable.itineraryId, itineraryId)
      ),
      columns: { userId: true }, // Only need existence check
    });

    return {
      isSuccess: true,
      message: "Wishlist status checked successfully.",
      data: !!existingItem, // Convert result to boolean
    };
  } catch (error) {
    console.error("[Action isItineraryWishlisted] Error:", error);
    return {
      isSuccess: false,
      message: "Failed to check wishlist status.",
    };
  }
}

/**
 * Retrieves all itineraries present in the current user's wishlist.
 * Filters out trips created by soft-deleted users.
 *
 * @returns Promise resolving to ActionState containing an array of `SelectItinerary`.
 */
export async function getWishlistAction(): Promise<
  ActionState<SelectItinerary[]>
> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." };
  }

  try {
    // 1. Get the IDs of itineraries in the user's wishlist
    const wishlistedItineraryIds = await db
      .select({ itineraryId: wishlistItemsTable.itineraryId })
      .from(wishlistItemsTable)
      .where(eq(wishlistItemsTable.userId, userId));

    if (wishlistedItineraryIds.length === 0) {
      return {
        isSuccess: true,
        message: "Wishlist is empty.",
        data: [],
      };
    }

    const ids = wishlistedItineraryIds.map((item) => item.itineraryId);

    // 2. Fetch the full itinerary details, filtering out those from deleted users
    const wishlistTrips = await db
      .select()
      .from(itinerariesTable)
      .innerJoin(profilesTable, and(
        eq(itinerariesTable.creatorId, profilesTable.userId),
        not(like(profilesTable.username, "deleted_%"))
      ))
      .where(inArray(itinerariesTable.id, ids))
      .orderBy(desc(itinerariesTable.createdAt));

    return {
      isSuccess: true,
      message: "Wishlist retrieved successfully.",
      data: wishlistTrips.map(i => i.itineraries),
    };
  } catch (error) {
    console.error("[Action getWishlist] Error:", error);
    return {
      isSuccess: false,
      message: "Failed to retrieve wishlist.",
    };
  }
}