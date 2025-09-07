/**
 * @description
 * Server actions for managing "likes" on trip itineraries within the TripRizz application.
 * Provides functionality to add/remove likes, check like status, and retrieve liked trips.
 * Ensures atomicity when updating like counts.
 * UPDATED: `getLikedTripsAction` now filters out trips from soft-deleted users.
 *
 * Key features:
 * - Toggle Like: Adds or removes a like for a user on an itinerary, atomically updating the itinerary's like count.
 * - Check Liked Status: Determines if a user has liked a specific itinerary.
 * - Get Liked Trips: Retrieves all itineraries liked by a specific user, excluding those from deleted creators.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (likesTable, itinerariesTable, profilesTable).
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations (eq, and, sql, desc, etc.).
 *
 * @notes
 * - All actions are server-side only (`"use server"`).
 * - Uses `ActionState` for consistent return structure.
 * - `toggleLikeAction` uses a database transaction to ensure atomicity between the likes table and the itineraries like_count.
 * - Authorization checks ensure users are logged in before performing actions.
 */
"use server";

import { db } from "@/db/db";
import {
  likesTable,
  itinerariesTable,
  SelectItinerary, // Needed for getLikedTripsAction
  profilesTable, // Implicitly used via relations if needed later, but not directly here yet
} from "@/db/schema";
import { ActionState } from "@/types";
import { auth } from "@clerk/nextjs/server";
import { not, like, and, eq, sql, desc, inArray } from "drizzle-orm";

/**
 * Toggles a like on an itinerary for the current user.
 * If the user hasn't liked it, adds a like and increments the count.
 * If the user has liked it, removes the like and decrements the count.
 * Uses a transaction to ensure atomicity.
 *
 * @param itineraryId - The UUID of the itinerary to like/unlike.
 * @returns Promise resolving to ActionState containing the new like status ({ liked: boolean }) and the updated like count ({ newCount: number }).
 */
export async function toggleLikeAction(
  itineraryId: string
): Promise<ActionState<{ liked: boolean; newCount: number }>> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." };
  }

  if (!itineraryId) {
    return { isSuccess: false, message: "Itinerary ID is required." };
  }

  try {
    // Use a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Check if the like already exists
      const existingLike = await tx.query.likes.findFirst({
        where: and(
          eq(likesTable.userId, userId),
          eq(likesTable.itineraryId, itineraryId)
        ),
        columns: { userId: true }, // Only need existence check
      });

      let liked: boolean;
      let updatedCountResult: { like_count: number }[];

      if (existingLike) {
        // Like exists, so remove it and decrement count
        console.log(
          `[Action toggleLike] User ${userId} unliking itinerary ${itineraryId}.`
        );
        await tx
          .delete(likesTable)
          .where(
            and(
              eq(likesTable.userId, userId),
              eq(likesTable.itineraryId, itineraryId)
            )
          );

        // Decrement like_count, ensuring it doesn't go below 0
        updatedCountResult = await tx
          .update(itinerariesTable)
          .set({
            like_count: sql`GREATEST(0, ${itinerariesTable.like_count} - 1)`, // Use GREATEST to prevent negative counts
            updatedAt: new Date(),
          })
          .where(eq(itinerariesTable.id, itineraryId))
          .returning({ like_count: itinerariesTable.like_count });

        liked = false;
        console.log(
          `[Action toggleLike] Decremented like count for itinerary ${itineraryId}.`
        );
      } else {
        // Like doesn't exist, so add it and increment count
        console.log(
          `[Action toggleLike] User ${userId} liking itinerary ${itineraryId}.`
        );
        await tx.insert(likesTable).values({
          userId: userId,
          itineraryId: itineraryId,
        });

        // Increment like_count
        updatedCountResult = await tx
          .update(itinerariesTable)
          .set({
            like_count: sql`${itinerariesTable.like_count} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(itinerariesTable.id, itineraryId))
          .returning({ like_count: itinerariesTable.like_count });

        liked = true;
        console.log(
          `[Action toggleLike] Incremented like count for itinerary ${itineraryId}.`
        );
      }

      if (updatedCountResult.length === 0) {
        // This means the itinerary might not exist or the update failed
        console.error(
          `[Action toggleLike] Failed to update like count for itinerary ${itineraryId}. It might not exist.`
        );
        // Rollback transaction by throwing an error
        throw new Error("Failed to update itinerary like count.");
      }

      const newCount = updatedCountResult[0].like_count;

      return { liked, newCount };
    });

    return {
      isSuccess: true,
      message: result.liked ? "Itinerary liked." : "Itinerary unliked.",
      data: result,
    };
  } catch (error) {
    console.error("[Action toggleLike] Error:", error);
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to toggle like.",
    };
  }
}

/**
 * Checks if the current user has liked a specific itinerary.
 *
 * @param itineraryId - The UUID of the itinerary to check.
 * @returns Promise resolving to ActionState containing boolean `true` if liked, `false` otherwise.
 */
export async function isItineraryLikedAction(
  itineraryId: string
): Promise<ActionState<boolean>> {
  const { userId } = await auth();
  if (!userId) {
    // Consider logged-out users as not having liked anything
    return { isSuccess: true, message: "User not logged in.", data: false };
  }

  if (!itineraryId) {
    return { isSuccess: false, message: "Itinerary ID is required." };
  }

  try {
    const existingLike = await db.query.likes.findFirst({
      where: and(
        eq(likesTable.userId, userId),
        eq(likesTable.itineraryId, itineraryId)
      ),
      columns: { userId: true }, // Only need existence check
    });

    return {
      isSuccess: true,
      message: "Like status checked successfully.",
      data: !!existingLike, // Convert result to boolean
    };
  } catch (error) {
    console.error("[Action isItineraryLiked] Error:", error);
    return {
      isSuccess: false,
      message: "Failed to check like status.",
    };
  }
}

/**
 * Retrieves all itineraries liked by the current user.
 * Filters out trips created by soft-deleted users.
 *
 * @returns Promise resolving to ActionState containing an array of `SelectItinerary`.
 */
export async function getLikedTripsAction(): Promise<
  ActionState<SelectItinerary[]>
> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." };
  }

  try {
    // 1. Get the IDs of itineraries liked by the user
    const likedItineraryIds = await db
      .select({ itineraryId: likesTable.itineraryId })
      .from(likesTable)
      .where(eq(likesTable.userId, userId));

    if (likedItineraryIds.length === 0) {
      return {
        isSuccess: true,
        message: "No liked itineraries found.",
        data: [],
      };
    }

    const ids = likedItineraryIds.map((item) => item.itineraryId);

    // 2. Fetch the full itinerary details for those IDs, joining with profiles to filter out deleted users
    const likedTrips = await db
      .select()
      .from(itinerariesTable)
      .innerJoin(profilesTable, and(
        eq(itinerariesTable.creatorId, profilesTable.userId),
        not(like(profilesTable.username, "deleted_%"))
      ))
      .where(inArray(itinerariesTable.id, ids))
      .orderBy(desc(itinerariesTable.createdAt)); // Optional: order by creation date or like date

    return {
      isSuccess: true,
      message: "Liked itineraries retrieved successfully.",
      data: likedTrips.map(i => i.itineraries),
    };
  } catch (error) {
    console.error("[Action getLikedTrips] Error:", error);
    return {
      isSuccess: false,
      message: "Failed to retrieve liked itineraries.",
    };
  }
}