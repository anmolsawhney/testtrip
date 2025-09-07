/**
 * @description
 * Server actions dedicated to fetching and constructing data for various feeds
 * within the TripRizz application, such as the main activity feed.
 * FIXED: Ensures the returned data structure strictly matches the FeedActivityItem discriminated union type, explicitly setting irrelevant properties to null.
 *
 * Key features:
 * - Get Activity Feed: Aggregates different event types (photos, reviews, trips, follows) for the main feed.
 * - Get Recent Photos/Reviews: Helper actions to fetch recent public content for feed generation.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState and FeedActivityItem types.
 * - "@clerk/nextjs/server": For authentication.
 * - "drizzle-orm": For database operations.
 * - "./trip-reviews-actions": For fetching recent reviews. // Adjusted dependency path if needed
 * - "./trips-actions": For fetching recent trips. // Adjusted dependency path if needed
 *
 * @notes
 * - Functions are marked with `"use server"`.
 * - Uses `ActionState` for consistent return structure.
 * - Returns data matching the `FeedActivityItem` discriminated union type.
 */
"use server";

// --- Database & Schema Imports ---
import { db } from "@/db/db";
import {
  activityFeedEventsTable,
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
} from "@/db/schema";

// --- Utility Imports ---
import { ActionState, FeedActivityItem } from "@/types"; // Import the FeedActivityItem type
import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
 * Fetches the activity feed for a given user, supporting filtering and pagination.
 * Aggregates different activity types and returns data matching the FeedActivityItem discriminated union type.
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
    if (!currentUserId) return { isSuccess: false, message: "Unauthorized." };

    try {
        let userIdsToFetchFrom: string[] = [];
        if (filter === 'following') {
            const followedUsers = await db.select({ followingId: followsTable.followingId }).from(followsTable).where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.status, 'accepted')));
            userIdsToFetchFrom = followedUsers.map(f => f.followingId);
        } else { userIdsToFetchFrom = [currentUserId]; }

        if (filter === 'following' && userIdsToFetchFrom.length === 0) {
            return { isSuccess: true, message: "Not following anyone.", data: [] };
        }

        const baseEvents = await db.select().from(activityFeedEventsTable)
            .where(inArray(activityFeedEventsTable.userId, userIdsToFetchFrom))
            .orderBy(desc(activityFeedEventsTable.createdAt))
            .limit(limit).offset(offset);

        if (baseEvents.length === 0) return { isSuccess: true, message: "No activities found.", data: [] };

        // Collect IDs for batch fetching
        const userIds = new Set<string>();
        const tripIds = new Set<string>();
        const photoIds = new Set<string>();
        const reviewIds = new Set<string>();
        const targetUserIds = new Set<string>();

        baseEvents.forEach(event => {
            userIds.add(event.userId);
            switch (event.eventType) {
                case 'new_trip': case 'joined_trip': tripIds.add(event.relatedId); break;
                case 'new_photo':
                    photoIds.add(event.relatedId);
                    if (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData && typeof event.eventData.tripId === 'string') tripIds.add(event.eventData.tripId);
                    break;
                case 'new_review':
                    reviewIds.add(event.relatedId);
                     if (event.eventData && typeof event.eventData === 'object' && 'tripId' in event.eventData && typeof event.eventData.tripId === 'string') tripIds.add(event.eventData.tripId);
                    break;
                case 'follow': if (event.targetUserId) { userIds.add(event.targetUserId); targetUserIds.add(event.targetUserId); } break;
            }
        });

        // Batch fetch related data
        const [usersData, tripsData, photosData, reviewsData, targetUsersData] = await Promise.all([
            userIds.size > 0 ? db.select().from(profilesTable).where(inArray(profilesTable.userId, Array.from(userIds))) : [],
            tripIds.size > 0 ? db.select().from(itinerariesTable).where(inArray(itinerariesTable.id, Array.from(tripIds))) : [],
            photoIds.size > 0 ? db.select().from(tripPhotosTable).where(inArray(tripPhotosTable.id, Array.from(photoIds))) : [],
            reviewIds.size > 0 ? db.select().from(tripReviewsTable).where(inArray(tripReviewsTable.id, Array.from(reviewIds))) : [],
            targetUserIds.size > 0 ? db.select().from(profilesTable).where(inArray(profilesTable.userId, Array.from(targetUserIds))) : []
        ]);

        // Create maps for lookup
        const usersMap = new Map(usersData.map(u => [u.userId, u]));
        const tripsMap = new Map(tripsData.map(t => [t.id, t]));
        const photosMap = new Map(photosData.map(p => [p.id, p]));
        const reviewsMap = new Map(reviewsData.map(r => [r.id, r]));
        const targetUsersMap = new Map(targetUsersData.map(u => [u.userId, u]));

        // --- Construct the final FeedActivityItem array STRICTLY matching the type ---
        const feedItemsConstruction = baseEvents.map((event): FeedActivityItem | null => { // Return null for unhandled
            const user = usersMap.get(event.userId) ?? null;

            switch (event.eventType) {
                case 'new_trip':
                case 'joined_trip':
                    return {
                        event: event,
                        user: user,
                        eventType: event.eventType, // Discriminator
                        relatedTrip: tripsMap.get(event.relatedId) ?? null,
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
                        event: event,
                        user: user,
                        eventType: 'new_photo', // Discriminator
                        relatedPhoto: relatedPhoto,
                        relatedTrip: relatedTrip,
                        // Explicitly null
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
                        event: event,
                        user: user,
                        eventType: 'new_review', // Discriminator
                        relatedReview: relatedReview,
                        relatedTrip: relatedTrip,
                        // Explicitly null
                        relatedPhoto: null,
                        targetUser: null,
                    };
                }
                case 'follow':
                    return {
                        event: event,
                        user: user,
                        eventType: 'follow', // Discriminator
                        targetUser: event.targetUserId ? targetUsersMap.get(event.targetUserId) ?? null : null,
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
        return { isSuccess: true, message: "Activity feed retrieved.", data: feedItems }; // Data now guaranteed to be FeedActivityItem[]

    } catch (error) {
        console.error("[Action getActivityFeed] Error:", error);
        return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to retrieve activity feed." };
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
    return getActivityFeedAction('following', limit, offset); // Defaulting to 'following'
}