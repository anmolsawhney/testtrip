/**
 * @description
 * Server actions for managing activity feed events in the TripRizz database.
 * Provides functionality for creating and retrieving activity events.
 * Includes the implementation of `getActivityFeedAction` from Step 12.
 * Updated to select trip photos/cover for feed display and to include the current user's like status on each post.
 * UPDATED: Handles the new 'left_trip' event type.
 * UPDATED: Filters out content from soft-deleted users in `getActivityFeedAction`.
 *
 * Key features:
 * - Create Activity Event: Inserts a new event record into the database.
 * - Get Activity Feed: Fetches and formats activities for display in the user's feed,
 *   handling 'following' and 'my_activity' filters, pagination, joining related data, and including like status.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState type definition and FeedActivityItem type.
 * - "@clerk/nextjs/server": For authentication.
 * - "drizzle-orm": For database operations and query building.
 *
 * @notes
 * - Actions are server-side only.
 * - Uses ActionState for consistent return values.
 * - `createActivityEventAction` includes basic validation for required fields.
 * - `getActivityFeedAction` fetches related data via separate lookups after fetching base events for better performance than complex joins on the main query.
 */
"use server";

import { db } from "@/db/db";
import {
  activityFeedEventsTable,
  InsertActivityFeedEvent,
  SelectActivityFeedEvent,
  followsTable,
  profilesTable,
  itinerariesTable,
  tripPhotosTable,
  tripReviewsTable,
  SelectProfile,
  SelectItinerary,
  SelectTripPhoto,
  SelectTripReview,
  activityFeedLikesTable, // Import likes table
} from "@/db/schema";
import { ActionState, FeedActivityItem } from "@/types"; // Import the FeedActivityItem type
import { like, and, desc, eq, inArray, sql, not } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// --- Other Action Imports (Placeholders - Replace with actual imports) ---
async function getRecentPublicReviewsAction(limit: number = 20, offset: number = 0): Promise<ActionState<(SelectTripReview & { reviewer?: SelectProfile | null, trip?: { id: string, title: string } | null })[]>> {
    console.warn("getRecentPublicReviewsAction needs actual implementation or import.");
    return { isSuccess: true, message: "Placeholder success", data: [] };
}
async function getPublicTripsAction(limit: number = 20, offset: number = 0): Promise<ActionState<SelectItinerary[]>> {
     console.warn("getPublicTripsAction needs actual implementation or import.");
    return { isSuccess: true, message: "Placeholder success", data: [] };
}
export async function getRecentTripPhotosAction(limit: number = 20, offset: number = 0): Promise<ActionState<(SelectTripPhoto & { uploader?: { displayName: string, profilePhoto?: string | null }, trip?: { id: string, title: string } })[]>> {
    // Actual implementation from previous step...
    try { /* ... */ return { isSuccess: true, message: "Recent trip photos retrieved.", data: [] }; } // Simplified for brevity
    catch (error) { /* ... */ return { isSuccess: false, message: "Failed to get recent trip photos" }; }
}
// --- End Placeholders ---


/**
 * Creates a new activity feed event record.
 * This action is typically called by other server actions when a relevant event occurs (e.g., trip creation, photo upload, follow).
 *
 * @param data - The data for the new activity event, conforming to `InsertActivityFeedEvent`.
 * @returns Promise resolving to `ActionState` containing the created `SelectActivityFeedEvent` or an error message.
 */
export async function createActivityEventAction(
  data: InsertActivityFeedEvent
): Promise<ActionState<SelectActivityFeedEvent>> {
  try {
    if (!data.userId || !data.eventType || !data.relatedId) {
      console.warn("[Action createActivityEvent] Missing required fields:", data);
      return {
        isSuccess: false,
        message: "Missing required fields: userId, eventType, or relatedId.",
      };
    }

    if (data.eventType === 'follow' && !data.targetUserId) {
       console.warn("[Action createActivityEvent] Missing targetUserId for follow event:", data);
      return { isSuccess: false, message: "Target user ID is required for follow events." };
    }

    console.log("[Action createActivityEvent] Inserting event:", data);
    const [newEvent] = await db
      .insert(activityFeedEventsTable)
      .values(data)
      .returning();

    if (!newEvent) {
      console.error("[Action createActivityEvent] Database insertion failed to return the new event.");
      throw new Error("Failed to create activity event in database.");
    }

    console.log("[Action createActivityEvent] Event created successfully:", newEvent.id);
    return {
      isSuccess: true,
      message: "Activity event created successfully.",
      data: newEvent,
    };
  } catch (error) {
    console.error("[Action createActivityEvent] Error:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the activity event.",
    };
  }
}


/**
 * Fetches the activity feed for a given user, supporting filtering and pagination.
 * Aggregates different activity types (trips, photos, reviews, follows) and joins relevant data.
 * Also includes whether the current user has liked each event.
 *
 * @param filter - Determines whose activities to fetch: 'following' or 'my_activity'.
 * @param limit - Maximum number of feed items to return.
 * @param offset - Number of items to skip for pagination.
 * @returns Promise resolving to ActionState containing an array of `FeedActivityItem` or an error message.
 */
export async function getActivityFeedAction(
    filter: 'following' | 'my_activity',
    limit: number,
    offset: number
): Promise<ActionState<FeedActivityItem[]>> {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
        return { isSuccess: false, message: "Unauthorized: User not logged in." };
    }

    try {
        let userIdsToFetchFrom: string[] = [];

        if (filter === 'following') {
            const followedUsers = await db
                .select({ followingId: followsTable.followingId })
                .from(followsTable)
                .where(and(
                    eq(followsTable.followerId, currentUserId),
                    eq(followsTable.status, 'accepted')
                ));
            userIdsToFetchFrom = followedUsers.map(f => f.followingId);
            console.log(`[Action getActivityFeed] User ${currentUserId} follows ${userIdsToFetchFrom.length} users.`);
        } else {
            userIdsToFetchFrom = [currentUserId];
            console.log(`[Action getActivityFeed] Fetching own activity for user ${currentUserId}.`);
        }

        if (filter === 'following' && userIdsToFetchFrom.length === 0) {
             console.log(`[Action getActivityFeed] User ${currentUserId} follows no one. Returning empty feed.`);
            return { isSuccess: true, message: "Activity feed retrieved successfully.", data: [] };
        }

        const baseEvents = await db
            .select()
            .from(activityFeedEventsTable)
            .where(inArray(activityFeedEventsTable.userId, userIdsToFetchFrom))
            .orderBy(desc(activityFeedEventsTable.createdAt))
            .limit(limit)
            .offset(offset);

         console.log(`[Action getActivityFeed] Fetched ${baseEvents.length} base events (limit: ${limit}, offset: ${offset}).`);

        if (baseEvents.length === 0) {
            return { isSuccess: true, message: "No more activities found.", data: [] };
        }

        // --- NEW: Fetch likes by the current user for the fetched events ---
        const eventIds = baseEvents.map(event => event.id);
        const userLikes = await db
            .select({ eventId: activityFeedLikesTable.eventId })
            .from(activityFeedLikesTable)
            .where(and(
                eq(activityFeedLikesTable.userId, currentUserId),
                inArray(activityFeedLikesTable.eventId, eventIds)
            ));
        const likedEventIds = new Set(userLikes.map(like => like.eventId));
        // --- END NEW ---

        const userIds = new Set<string>();
        const tripIds = new Set<string>();
        const photoIds = new Set<string>();
        const reviewIds = new Set<string>();
        const targetUserIds = new Set<string>();

        baseEvents.forEach(event => {
            userIds.add(event.userId);
            switch (event.eventType) {
                case 'new_trip':
                case 'joined_trip':
                case 'left_trip':
                    tripIds.add(event.relatedId);
                    break;
                case 'new_photo':
                    photoIds.add(event.relatedId);
                    if (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData && typeof event.eventData.tripId === 'string') {
                        tripIds.add(event.eventData.tripId);
                    }
                    break;
                case 'new_review':
                    reviewIds.add(event.relatedId);
                     if (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData && typeof event.eventData.tripId === 'string') {
                         tripIds.add(event.eventData.tripId);
                    }
                    break;
                case 'follow':
                    if (event.targetUserId) {
                        userIds.add(event.targetUserId);
                        targetUserIds.add(event.targetUserId);
                    }
                    break;
            }
        });

        const [
            usersData,
            tripsData,
            photosData,
            reviewsData,
            targetUsersData
        ] = await Promise.all([
            userIds.size > 0 ? db.select().from(profilesTable).where(and(inArray(profilesTable.userId, Array.from(userIds)), not(like(profilesTable.username, "deleted_%")))) : Promise.resolve([]),
            tripIds.size > 0 ? db.select().from(itinerariesTable).where(inArray(itinerariesTable.id, Array.from(tripIds))) : Promise.resolve([]),
            photoIds.size > 0 ? db.select().from(tripPhotosTable).where(inArray(tripPhotosTable.id, Array.from(photoIds))) : Promise.resolve([]),
            reviewIds.size > 0 ? db.select().from(tripReviewsTable).where(inArray(tripReviewsTable.id, Array.from(reviewIds))) : Promise.resolve([]),
            targetUserIds.size > 0 ? db.select().from(profilesTable).where(and(inArray(profilesTable.userId, Array.from(targetUserIds)), not(like(profilesTable.username, "deleted_%")))) : Promise.resolve([])
        ]);

        const usersMap = new Map(usersData.map(u => [u.userId, u]));
        const tripsMap = new Map(tripsData.map(t => [t.id, t]));
        const photosMap = new Map(photosData.map(p => [p.id, p]));
        const reviewsMap = new Map(reviewsData.map(r => [r.id, r]));
        const targetUsersMap = new Map(targetUsersData.map(u => [u.userId, u]));

        const feedItemsConstruction = baseEvents.map((event): FeedActivityItem | null => {
            const user = usersMap.get(event.userId) ?? null;
            if (!user) return null; // If the user who created the event is deleted, skip the event
            
            // NEW: Add isLikedByCurrentUser to the event object
            const enrichedEvent: SelectActivityFeedEvent & { isLikedByCurrentUser?: boolean } = {
                ...event,
                isLikedByCurrentUser: likedEventIds.has(event.id)
            };
            const baseItem = { event: enrichedEvent, user };

            switch (event.eventType) {
                case 'new_trip':
                case 'joined_trip':
                case 'left_trip':
                    const relatedTripData = tripsMap.get(event.relatedId) ?? null;
                    return {
                        ...baseItem,
                        eventType: event.eventType, // Discriminator
                        relatedTrip: relatedTripData,
                        // Explicitly null for other properties
                        relatedPhoto: null,
                        relatedReview: null,
                        targetUser: null,
                    };
                case 'new_photo': {
                    const relatedPhoto = photosMap.get(event.relatedId) ?? null;
                    const tripId = relatedPhoto?.tripId ?? (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData ? String(event.eventData.tripId) : undefined);
                    const relatedTripRaw = tripId ? tripsMap.get(tripId) : null;
                    const relatedTrip = relatedTripRaw ? { id: relatedTripRaw.id, title: relatedTripRaw.title } : null;
                    return {
                        ...baseItem,
                        eventType: 'new_photo',
                        relatedPhoto: relatedPhoto,
                        relatedTrip: relatedTrip,
                        relatedReview: null,
                        targetUser: null,
                    };
                }
                case 'new_review': {
                     const relatedReview = reviewsMap.get(event.relatedId) ?? null;
                     const tripId = relatedReview?.tripId ?? (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData ? String(event.eventData.tripId) : undefined);
                     const relatedTripRaw = tripId ? tripsMap.get(tripId) : null;
                     const relatedTrip = relatedTripRaw ? { id: relatedTripRaw.id, title: relatedTripRaw.title } : null;
                    return {
                        ...baseItem,
                        eventType: 'new_review',
                        relatedReview: relatedReview,
                        relatedTrip: relatedTrip,
                        relatedPhoto: null,
                        targetUser: null,
                    };
                }
                case 'follow':
                    const targetUser = event.targetUserId ? targetUsersMap.get(event.targetUserId) ?? null : null
                    if (!targetUser) return null; // If the followed user is deleted, skip the event
                    return {
                        ...baseItem,
                        eventType: 'follow',
                        targetUser: targetUser,
                        // Explicitly null
                        relatedTrip: null,
                        relatedPhoto: null,
                        relatedReview: null,
                    };
                default:
                     console.warn(`[Action getActivityFeed] Skipping unknown event type: ${event.eventType}`);
                     return null; // Return null for unknown types
            }
        });

        // Filter out null entries (from default case) and assert the type
        const feedItems: FeedActivityItem[] = feedItemsConstruction.filter((item): item is FeedActivityItem => item !== null);
        // --- End Construction ---

        console.log(`[Action getActivityFeed] Constructed ${feedItems.length} final feed items.`);
        return { isSuccess: true, message: "Activity feed retrieved.", data: feedItems };

    } catch (error) {
        console.error("[Action getActivityFeed] Error:", error);
        return {
            isSuccess: false,
            message: error instanceof Error ? error.message : "Failed to retrieve activity feed.",
        };
    }
}


/**
 * @deprecated Prefer getActivityFeedAction for a combined feed.
 */
export async function getFeedActivitiesAction(
    limit: number = 30,
    offset: number = 0
): Promise<ActionState<FeedActivityItem[]>> {
    console.warn("DEPRECATED: getFeedActivitiesAction is deprecated. Use getActivityFeedAction.");
    return getActivityFeedAction('following', limit, offset);
}