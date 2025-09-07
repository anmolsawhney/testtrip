/**
 * @description
 * Server actions for managing trip members in the TripRizz application.
 * Provides functionality for adding, removing, and querying trip members.
 * Handles updating the trip's `currentGroupSize`.
 * UPDATED: Added `leaveTripAction` for users to leave a trip they are a member of,
 * which includes permission checks and creation of a 'left_trip' activity feed event.
 * UPDATED: `getUserMemberTripsAction` now filters out trips whose creators have been soft-deleted.
 *
 * Key features:
 * - Add members to trips with role assignment, updating group size.
 * - Remove members from trips with proper verification, updating group size.
 * - Leave Trip: A new user-facing action to leave a group, preventing owners from leaving.
 * - Retrieve members of a trip with filtering options.
 * - Check if a user is a member of a specific trip.
 * - Retrieve all trips a user is a member of, excluding those from deleted creators.
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema": Schema definitions for trip members and itineraries.
 * - "@/types": ActionState type
 * - "drizzle-orm": Query builder functions (eq, and, or, not, sql, inArray, desc, count).
 * - "@clerk/nextjs/server": For authentication checks.
 *
 * @notes
 * - Ensures proper error handling and validation.
 * - Updates trip's currentGroupSize when adding/removing members.
 * - Respects role-based permissions (owner vs member).
 * - All operations require proper trip and user IDs.
 */
"use server";

import { db } from "@/db/db";
import {
  itinerariesTable,
  tripMembersTable,
  InsertTripMember,
  SelectTripMember,
  SelectItinerary,
  profilesTable
} from "@/db/schema";
import { ActionState } from "@/types";
import { eq, like, not, and, or, sql, inArray, desc, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { createActivityEventAction } from "./activity-feed-actions";

/**
 * Adds a user as a member to a trip with the specified role.
 * Increments the trip's currentGroupSize. Handles potential conflicts.
 * @param data The member data to insert
 * @returns ActionState with the created member or error
 */
export async function addTripMemberAction(
  data: InsertTripMember
): Promise<ActionState<SelectTripMember>> { // Return type is ActionState<SelectTripMember>
  try {
    if (!data.tripId || !data.userId) {
      return { isSuccess: false, message: "Missing required fields: tripId or userId" };
    }

    // Perform operations in a transaction
    const result = await db.transaction(async (tx) => {
        // Check if user is already a member
        const existingMember = await tx.query.tripMembers.findFirst({
            where: and(
                eq(tripMembersTable.tripId, data.tripId),
                eq(tripMembersTable.userId, data.userId)
            ),
            columns: { id: true } // Check existence
        });

        if (existingMember) {
            console.warn(`[Action addTripMember TX] User ${data.userId} already member of trip ${data.tripId}`);
            // Fetch the existing member record to return it
            const member = await tx.query.tripMembers.findFirst({
                where: and(eq(tripMembersTable.tripId, data.tripId), eq(tripMembersTable.userId, data.userId))
            });
            // If somehow fetch fails here, return failure from transaction
            if (!member) {
                 console.error(`[Action addTripMember TX] Failed to fetch existing member ${data.userId} for trip ${data.tripId}.`);
                 tx.rollback();
                 return { success: false, message: "Failed to retrieve existing member data." };
            }
            return { success: true, alreadyExisted: true, memberRecord: member };
        }

        // Get the trip to check if it exists and for capacity
        const trip = await tx.query.itineraries.findFirst({
            where: eq(itinerariesTable.id, data.tripId),
            columns: { id: true, currentGroupSize: true }
        });

        if (!trip) {
            console.error(`[Action addTripMember TX] Trip ${data.tripId} not found.`);
            tx.rollback();
            return { success: false, message: "Trip not found" };
        }

        // Increment trip's currentGroupSize atomically
        const updateSizeResult = await tx
            .update(itinerariesTable)
            .set({ currentGroupSize: sql`COALESCE(${itinerariesTable.currentGroupSize}, 0) + 1`, updatedAt: new Date() })
            .where(eq(itinerariesTable.id, data.tripId))
            .returning({ id: itinerariesTable.id });

         if (updateSizeResult.length === 0) {
              console.error(`[Action addTripMember TX] Failed to increment group size for trip ${data.tripId}.`);
             tx.rollback();
             return { success: false, message: "Failed to update trip size" };
         }
        console.log(`[Action addTripMember TX] Incremented group size for trip ${data.tripId}.`);

        // Add the member record
        const [newMember] = await tx
            .insert(tripMembersTable)
            .values({ ...data, role: data.role || 'member' })
            .returning();

         if (!newMember) {
              console.error(`[Action addTripMember TX] Failed to insert member record for user ${data.userId}, trip ${data.tripId}.`);
              tx.rollback();
              return { success: false, message: "Failed to insert member record" };
         }
         console.log(`[Action addTripMember TX] Inserted new member record ${newMember.id}.`);

        return { success: true, alreadyExisted: false, memberRecord: newMember };
    }); // End transaction

    if (!result.success) {
        // Transaction failed or was rolled back, return failure ActionState
        return { isSuccess: false, message: result.message || "Failed to add member." };
    }

    // If transaction succeeded, memberRecord MUST exist. If not, it's an internal error.
    if (!result.memberRecord) {
        console.error("[Action addTripMember] Internal error: Transaction succeeded but member record is missing.");
        return { isSuccess: false, message: "Internal error processing member addition." };
    }

    return {
      isSuccess: true,
      message: result.alreadyExisted ? "User is already a member." : "Member added to trip successfully",
      data: result.memberRecord,
    };
  } catch (error) {
    console.error("Error adding trip member:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to add member to trip" };
  }
}


/**
 * Removes a member from a trip. Prevents removing the last owner. Decrements trip's group size.
 * Requires the user performing the removal to be the trip owner OR the member themselves.
 * This is an internal-facing function; `leaveTripAction` is the user-facing version for leaving.
 *
 * @param tripId The ID of the trip
 * @param userId The ID of the user to remove
 * @param performingUserId The ID of the user initiating the action.
 * @returns ActionState indicating success or failure
 */
export async function removeTripMemberAction(
  tripId: string,
  userId: string, // User being removed
  performingUserId: string // User performing the removal
): Promise<ActionState<void>> {
  try {
    if (!tripId || !userId || !performingUserId) return { isSuccess: false, message: "Missing required parameters" };

    const result = await db.transaction(async (tx) => {
        const memberToRemove = await tx.query.tripMembers.findFirst({ where: and(eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId)) });
        if (!memberToRemove) return { success: false, message: "User is not a member." };

        const trip = await tx.query.itineraries.findFirst({ where: eq(itinerariesTable.id, tripId), columns: { creatorId: true } });
        const isTripOwner = !!(trip && trip.creatorId === performingUserId);
        const canRemove = (performingUserId === userId) || isTripOwner; // Self-removal or owner removal
        if (!canRemove) return { success: false, message: "Permission denied." };

        if (memberToRemove.role === "owner") {
            const ownersCountResult = await tx.select({ count: count() }).from(tripMembersTable).where(and(eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.role, "owner")));
            if ((ownersCountResult[0]?.count ?? 0) <= 1) return { success: false, message: "Cannot remove the last owner of the trip." };
        }

        const deleteResult = await tx.delete(tripMembersTable).where(and(eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId))).returning({ id: tripMembersTable.id });
        if (deleteResult.length === 0) return { success: false, message: "Failed to remove member." };

        const updateSizeResult = await tx.update(itinerariesTable).set({ currentGroupSize: sql`GREATEST(0, COALESCE(${itinerariesTable.currentGroupSize}, 0) - 1)`, updatedAt: new Date() }).where(eq(itinerariesTable.id, tripId)).returning({ id: itinerariesTable.id });
        if (updateSizeResult.length === 0) return { success: false, message: "Failed to update trip size." };

        return { success: true, message: "Member removed successfully." };
    });

    if (!result.success) {
        return { isSuccess: false, message: result.message };
    }

    console.log(`[Action removeTripMember] Removed member ${userId} from trip ${tripId}.`);
    return { isSuccess: true, message: "Member removed successfully.", data: undefined };
  } catch (error) {
    console.error("Error removing trip member:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to remove trip member" };
  }
}

/**
 * Allows a logged-in user to leave a trip they are a member of.
 * This action ensures a user cannot leave if they are the owner.
 *
 * @param tripId The ID of the trip to leave.
 * @returns ActionState indicating success or failure.
 */
export async function leaveTripAction(tripId: string): Promise<ActionState<void>> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized." };
  }

  try {
    const member = await db.query.tripMembers.findFirst({
        where: and(
            eq(tripMembersTable.tripId, tripId),
            eq(tripMembersTable.userId, userId)
        )
    });

    if (!member) {
        return { isSuccess: false, message: "You are not a member of this trip." };
    }

    if (member.role === 'owner') {
        return { isSuccess: false, message: "Trip owners cannot leave the trip. You can delete or transfer ownership instead." };
    }

    // Call the internal removal action
    const removalResult = await removeTripMemberAction(tripId, userId, userId);

    if (!removalResult.isSuccess) {
        // Propagate the error message from the internal action
        return { isSuccess: false, message: removalResult.message };
    }

    // Create activity feed event upon successful removal
    await createActivityEventAction({
        userId: userId, // The user who left
        eventType: 'left_trip',
        relatedId: tripId, // The trip they left
    });

    return { isSuccess: true, message: "You have successfully left the trip.", data: undefined };

  } catch (error) {
      console.error(`[Action leaveTripAction] Error for user ${userId} leaving trip ${tripId}:`, error);
      return { isSuccess: false, message: "An unexpected error occurred while trying to leave the trip." };
  }
}

/**
 * Gets all members of a trip
 * @param tripId The ID of the trip
 * @param role Optional role to filter by (owner or member)
 * @returns ActionState with the list of members or error
 */
export async function getTripMembersAction(
    tripId: string,
    role?: "owner" | "member"
  ): Promise<ActionState<SelectTripMember[]>> {
    try {
      if (!tripId) return { isSuccess: false, message: "Trip ID is required" };
      const conditions = [eq(tripMembersTable.tripId, tripId)];
      if (role) conditions.push(eq(tripMembersTable.role, role));

      const members = await db.select().from(tripMembersTable).where(and(...conditions));
      return { isSuccess: true, message: "Trip members retrieved.", data: members };
    } catch (error) {
      console.error("Error getting trip members:", error);
      return { isSuccess: false, message: "Failed to get trip members" };
    }
  }

/**
 * Checks if a user is a member of a trip with an optional role check
 * @param tripId The ID of the trip
 * @param userId The ID of the user
 * @param role Optional role to check (owner or member)
 * @returns ActionState with boolean result or error
 */
export async function isUserTripMemberAction(
  tripId: string,
  userId: string,
  role?: "owner" | "member"
): Promise<ActionState<boolean>> {
  try {
    if (!tripId || !userId) return { isSuccess: false, message: "Trip ID and User ID required" };
    const conditions = [eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId)];
    if (role) conditions.push(eq(tripMembersTable.role, role));

    const member = await db.query.tripMembers.findFirst({ where: and(...conditions), columns: { id: true } });
    return { isSuccess: true, message: "Membership checked.", data: !!member };
  } catch (error) {
    console.error("Error checking trip membership:", error);
    return { isSuccess: false, message: "Failed to check membership" };
  }
}

/**
 * Updates the role of an existing trip member. Requires the trip to have at least one owner remaining.
 * Requires the user performing the update to be the trip owner.
 *
 * @param tripId - The ID of the trip.
 * @param userId - The ID of the member whose role to update.
 * @param role - The new role ('owner' or 'member').
 * @returns Promise resolving to `ActionState` with the updated `SelectTripMember` or an error.
 */
export async function updateTripMemberRoleAction(
  tripId: string,
  userId: string,
  role: "owner" | "member"
): Promise<ActionState<SelectTripMember>> {
   try {
     const { userId: currentUserId } = await auth();
     if (!currentUserId) return { isSuccess: false, message: "Unauthorized." };

     const trip = await db.query.itineraries.findFirst({ where: eq(itinerariesTable.id, tripId), columns: { creatorId: true } });
     if (!trip) return { isSuccess: false, message: "Trip not found." };
     if (trip.creatorId !== currentUserId) return { isSuccess: false, message: "Unauthorized: Only owner can change roles." };

    const existingMember = await db.query.tripMembers.findFirst({ where: and( eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId) ) });
    if (!existingMember) return { isSuccess: false, message: "User is not a member." };

    if (existingMember.role === "owner" && role === "member") {
      const ownersCountResult = await db.select({ count: count() }).from(tripMembersTable).where(and( eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.role, "owner") ));
      if ((ownersCountResult[0]?.count ?? 0) <= 1) return { isSuccess: false, message: "Cannot remove last owner." };
    }

    const [updatedMember] = await db.update(tripMembersTable).set({ role, updatedAt: new Date() }).where(and( eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId) )).returning();
    if (!updatedMember) throw new Error("Failed to update member role.");

    console.log(`[Action updateTripMemberRole] Updated role for user ${userId} in trip ${tripId} to ${role}`);
    return { isSuccess: true, message: "Member role updated successfully", data: updatedMember };
  } catch (error) {
    console.error("Error updating trip member role:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to update trip member role" };
  }
}

/**
 * Retrieves trips where a specific user is listed as a member (including owner).
 * Filters out trips where the creator has been soft-deleted.
 *
 * @param userId - The ID of the user whose member trips to fetch.
 * @returns Promise resolving to `ActionState` with an array of `SelectItinerary` or an error.
 */
export async function getUserMemberTripsAction(
  userId: string
): Promise<ActionState<SelectItinerary[]>> {
  try {
    const memberTripRelations = await db
      .select({ trip: itinerariesTable })
      .from(tripMembersTable)
      .innerJoin(itinerariesTable, eq(tripMembersTable.tripId, itinerariesTable.id))
      .innerJoin(profilesTable, and(
        eq(itinerariesTable.creatorId, profilesTable.userId),
        not(like(profilesTable.username, "deleted_%"))
      ))
      .where(eq(tripMembersTable.userId, userId))
      .orderBy(desc(itinerariesTable.createdAt));

    if (memberTripRelations.length === 0) {
      return { isSuccess: true, message: "User is not a member of any active trips.", data: [] };
    }

    const trips = memberTripRelations.map(relation => relation.trip);

    return { isSuccess: true, message: "User member trips retrieved successfully", data: trips };
  } catch (error) {
    console.error(`Error getting member trips for user (${userId}):`, error);
    return { isSuccess: false, message: "Failed to get user member trips" };
  }
}