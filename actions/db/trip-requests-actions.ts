/**
 * @description
 * Server actions for managing trip join requests in the TripRizz application.
 * Handles creating, updating, retrieving, and dismissing trip join requests.
 * CORRECTED: Refactored updateTripRequestAction to fetch request and trip details separately, avoiding the 'with' clause that caused the 'referencedTable' error.
 *
 * Key features:
 * - Create Trip Request: Allows users to request joining a trip, checking capacity and existing requests.
 * - Update Trip Request: Allows trip owners to accept/reject requests, updating member status and group size.
 * - Get Trip Requests: Fetches requests based on various filters (trip, user, status, dismissed).
 * - Dismiss Notification: Allows users to mark their request notifications as seen.
 * - Activity Feed Integration: Logs 'joined_trip' event upon acceptance.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations.
 * - "./activity-feed-actions": For creating activity feed events.
 * - "./trip-members-action": For adding members upon request acceptance.
 *
 * @notes
 * - Functions are marked with `"use server"`.
 * - Uses `ActionState` for consistent return structure.
 * - Includes validation and authorization checks.
 */
"use server";

// --- Database & Schema Imports ---
import { db } from "@/db/db";
import {
  itinerariesTable,
  tripMembersTable, // Keep if used in helpers
  InsertTripMember,
  SelectItinerary,
  followsTable, // Keep if needed for future enhancements, though not directly used here
} from "@/db/schema";
import {
  tripRequestsTable,
  InsertTripRequest,
  SelectTripRequest,
  TripRequestParams,
} from "@/db/schema/matches-schema";

// --- Utility Imports ---
import { ActionState } from "@/types";
import {
  and,
  desc,
  eq,
  inArray,
  sql,
  SQLWrapper,
  count,
} from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// --- Other Action Imports ---
import { createActivityEventAction } from "./activity-feed-actions";
import { addTripMemberAction } from "./trip-members-action";

// --- createTripRequestAction (no changes needed) ---
export async function createTripRequestAction(
  data: InsertTripRequest
): Promise<ActionState<SelectTripRequest>> {
    const { userId: currentUserId } = await auth();
    if (!currentUserId || currentUserId !== data.userId) {
        return { isSuccess: false, message: "Unauthorized." };
    }

  try {
    if (!data.tripId || !data.userId) {
      return { isSuccess: false, message: "Missing required fields: tripId or userId" };
    }

    const existingRequest = await db.query.tripRequests.findFirst({
      where: and( eq(tripRequestsTable.tripId, data.tripId), eq(tripRequestsTable.userId, data.userId) ),
      columns: { id: true, status: true }
    });

    if (existingRequest) {
        if (existingRequest.status === 'pending') return { isSuccess: false, message: "You already have a pending request." };
        else if (existingRequest.status === 'accepted') return { isSuccess: false, message: "You are already a member." };
        else return { isSuccess: false, message: `A previous request exists: ${existingRequest.status}.` };
    }

    const isMember = await db.query.tripMembers.findFirst({
      where: and( eq(tripMembersTable.tripId, data.tripId), eq(tripMembersTable.userId, data.userId) ),
      columns: { id: true }
    });
    if (isMember) return { isSuccess: false, message: "You are already a member." };

    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, data.tripId),
      columns: { maxGroupSize: true, currentGroupSize: true },
    });

    if (!trip) return { isSuccess: false, message: "Trip not found." };
    if ( trip.maxGroupSize !== null && (trip.currentGroupSize ?? 0) >= trip.maxGroupSize ) {
      return { isSuccess: false, message: "This trip is already full." };
    }

    const [newRequest] = await db
      .insert(tripRequestsTable)
      .values({ ...data, status: 'pending', message: data.message?.trim() || null })
      .returning();

    if (!newRequest) throw new Error("Request creation failed.");

     console.log(`[Action createTripRequest] User ${data.userId} requested to join trip ${data.tripId}`);
    return { isSuccess: true, message: "Trip join request created successfully", data: newRequest };
  } catch (error) {
    console.error("Error creating trip request:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to create trip request" };
  }
}


/**
 * Updates the status of a trip join request (e.g., accept, reject).
 * If accepting, it adds the user to `tripMembersTable` via `addTripMemberAction`.
 * Requires the user performing the update to be the trip owner.
 *
 * @param requestId - The ID of the request to update.
 * @param data - An object containing the new `status` and optionally an updated `message`.
 * @returns Promise resolving to `ActionState` with the updated `SelectTripRequest` or an error.
 */
export async function updateTripRequestAction(
  requestId: string,
  data: {
    status: "pending" | "accepted" | "rejected" | "expired";
    message?: string;
  }
): Promise<ActionState<SelectTripRequest>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return { isSuccess: false, message: "Unauthorized." };

  console.log(`[Action updateTripRequest] User ${currentUserId} updating request ${requestId} to status: ${data.status}`);
  try {
    if (!requestId) return { isSuccess: false, message: "Missing request ID" };

    // --- REFACTORED DATA FETCHING ---
    // 1. Fetch the request itself
    const request = await db.query.tripRequests.findFirst({
        where: eq(tripRequestsTable.id, requestId),
    });
    if (!request) return { isSuccess: false, message: "Trip request not found" };

    // 2. Fetch the associated trip details needed for checks
    const tripDetails = await db.query.itineraries.findFirst({
        where: eq(itinerariesTable.id, request.tripId),
        columns: { creatorId: true, maxGroupSize: true, currentGroupSize: true } // Fetch only needed columns
    });
    if (!tripDetails) return { isSuccess: false, message: "Associated trip not found" };
    // --- END REFACTORED DATA FETCHING ---

    // Permission Check: Only the trip owner can update the request status
    if (tripDetails.creatorId !== currentUserId) {
         console.warn(`[Action updateTripRequest] Unauthorized attempt by ${currentUserId} to update request ${requestId}`);
         return { isSuccess: false, message: "Only the trip owner can manage join requests." };
    }

    // Status Check: Prevent updating already actioned requests (unless setting to expired)
    if (request.status !== 'pending' && data.status !== 'expired') {
         console.log(`[Action updateTripRequest] Request ${requestId} already processed (status: ${request.status}). Cannot set to ${data.status}.`);
         return { isSuccess: false, message: `Request is already ${request.status}.` };
    }

    // Logic for Accepting the Request
    if (data.status === "accepted") {
        console.log(`[Action updateTripRequest] Processing 'accepted' status for trip ${request.tripId}`);
        // Capacity Check
        if ( tripDetails.maxGroupSize !== null && (tripDetails.currentGroupSize ?? 0) >= tripDetails.maxGroupSize ) {
            console.warn(`[Action updateTripRequest] Trip ${request.tripId} is full.`);
            return { isSuccess: false, message: "Trip is full, cannot accept." };
        }

        // Use transaction for accepting
        const transactionResult = await db.transaction(async (tx) => {
            console.log(`[Action updateTripRequest TX] Starting transaction for accepting request ${requestId}.`);
            // 1. Add user to trip members table
            const addMemberResult = await addTripMemberAction({
                tripId: request.tripId,
                userId: request.userId,
                role: "member",
            });

            // Allow "already member" as success for this step
            if (!addMemberResult.isSuccess && addMemberResult.message !== "User is already a member.") {
                console.error(`[Action updateTripRequest TX] Failed to add member ${request.userId}: ${addMemberResult.message}`);
                tx.rollback();
                return { success: false, message: `Failed to add user to trip: ${addMemberResult.message}` };
            }
             console.log(`[Action updateTripRequest TX] Added/Confirmed member ${request.userId} for trip ${request.tripId}.`);

            // 2. Update the request status
            const updateRequestResult = await tx
                .update(tripRequestsTable)
                .set({ status: "accepted", message: data.message, updatedAt: new Date() })
                .where(eq(tripRequestsTable.id, requestId))
                .returning();

             if (updateRequestResult.length === 0) {
                 console.error(`[Action updateTripRequest TX] Failed to update request status ${requestId} to accepted.`);
                 tx.rollback();
                 return { success: false, message: "Failed to update request status." };
             }
             const updatedRequest = updateRequestResult[0];
             console.log(`[Action updateTripRequest TX] Updated request ${requestId} status to accepted.`);

             // 3. Create Activity Feed Event (no need for tx rollback if this fails, it's secondary)
              await createActivityEventAction({
                  userId: request.userId, // The user who joined
                  eventType: 'joined_trip',
                  relatedId: request.tripId, // Link to the trip
              });
              console.log(`[Action updateTripRequest] Created 'joined_trip' activity event for user ${request.userId} joining trip ${request.tripId}.`);

              return { success: true, updatedRequest: updatedRequest }; // Return the updated request data
        }); // End transaction

        if (!transactionResult.success) {
            return { isSuccess: false, message: transactionResult.message || "Failed to accept request." };
        }

        if (!transactionResult.updatedRequest) {
             console.error("[Action updateTripRequest] Transaction succeeded but updatedRequest data is missing.");
            return { isSuccess: false, message: "Failed to retrieve updated request data after acceptance." };
        }

        return {
            isSuccess: true,
            message: "Trip request accepted successfully",
            data: transactionResult.updatedRequest
        };

    } else {
        // Handle 'rejected' or 'expired' directly
        console.log(`[Action updateTripRequest] Updating request ${requestId} status directly to ${data.status}.`);
        const [updatedRequest] = await db
            .update(tripRequestsTable)
            .set({
                status: data.status,
                message: data.message,
                updatedAt: new Date(),
                isDismissed: data.status === 'rejected' ? false : request.isDismissed // Reset dismissal on reject if needed, or keep current state otherwise
            })
            .where(eq(tripRequestsTable.id, requestId))
            .returning();

        if (!updatedRequest) throw new Error("Failed to retrieve updated request after operation.");

        return { isSuccess: true, message: "Trip request updated successfully", data: updatedRequest };
    }
  } catch (error) {
    console.error(`Error updating trip request (${requestId}):`, error);
    // Check if the error is the specific TypeError we were seeing
    if (error instanceof TypeError && error.message.includes("referencedTable")) {
        console.error(">>> CAUGHT THE REFERENCEDTABLE ERROR AGAIN! <<<");
        return { isSuccess: false, message: "Internal error processing request update (relation issue)." };
    }
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to update trip request" };
  }
}

// --- getTripRequestsAction (no changes needed) ---
export async function getTripRequestsAction(
  params: TripRequestParams
): Promise<ActionState<SelectTripRequest[]>> {
  try {
    const conditions: (SQLWrapper | undefined)[] = [];
    if (params.tripId) conditions.push(eq(tripRequestsTable.tripId, params.tripId));
    if (params.userId) conditions.push(eq(tripRequestsTable.userId, params.userId));
    if (params.status) {
      if (Array.isArray(params.status)) {
        if (params.status.length > 0) conditions.push(inArray(tripRequestsTable.status, params.status));
      } else {
        conditions.push(eq(tripRequestsTable.status, params.status));
      }
    }
    if (params.isDismissed !== undefined) {
      conditions.push(eq(tripRequestsTable.isDismissed, params.isDismissed));
    }

    const requests = await db
      .select().from(tripRequestsTable)
      .where(and(...conditions.filter(c => c !== undefined)))
      .orderBy(desc(tripRequestsTable.createdAt));

    return { isSuccess: true, message: "Trip requests retrieved successfully", data: requests };
  } catch (error) {
    console.error("Error getting trip requests:", error);
    return { isSuccess: false, message: "Failed to get trip requests" };
  }
}

// --- dismissTripRequestNotificationAction (no changes needed) ---
export async function dismissTripRequestNotificationAction(
  requestId: string,
  userId: string
): Promise<ActionState<void>> {
    const { userId: currentUserId } = await auth();
    if (!currentUserId || currentUserId !== userId) return { isSuccess: false, message: "Unauthorized." };

  try {
    if (!requestId) return { isSuccess: false, message: "Request ID is required." };

    const result = await db
      .update(tripRequestsTable)
      .set({ isDismissed: true, updatedAt: new Date() })
      .where(and(eq(tripRequestsTable.id, requestId), eq(tripRequestsTable.userId, userId)))
      .returning({ id: tripRequestsTable.id });

    if (result.length === 0) {
      const requestExists = await db.query.tripRequests.findFirst({ where: eq(tripRequestsTable.id, requestId), columns: { id: true } });
      if (!requestExists) return { isSuccess: false, message: "Trip request not found." };
      else return { isSuccess: false, message: "You cannot dismiss this notification." };
    }

    console.log(`[Action dismissTripRequestNotification] Marked request ${requestId} as dismissed by user ${userId}.`);
    return { isSuccess: true, message: "Notification dismissed successfully.", data: undefined };
  } catch (error) {
    console.error("Error dismissing trip request notification:", error);
    return { isSuccess: false, message: "Failed to dismiss notification." };
  }
}