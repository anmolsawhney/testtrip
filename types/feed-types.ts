/**
 * @description
 * Defines the discriminated union type for items appearing in the activity feed.
 * This ensures that each activity type has a specific shape and can be handled
 * with type safety in components and actions.
 * UPDATED: Added 'left_trip' to the trip-related event types to fix a TypeScript error.
 * UPDATED: Added `isLikedByCurrentUser` to the base event object to track like status.
 */

import {
  SelectActivityFeedEvent,
  SelectItinerary,
  SelectProfile,
  SelectTripPhoto,
  SelectTripReview
} from "@/db/schema"

// Add isLikedByCurrentUser to the event object
type EnrichedActivityFeedEvent = SelectActivityFeedEvent & {
  isLikedByCurrentUser?: boolean
}

// A discriminated union for different types of feed activities.
// Each member has a unique `eventType` and corresponding related data.
export type FeedActivityItem =
  | {
      eventType: "new_trip" | "joined_trip" | "left_trip"
      event: EnrichedActivityFeedEvent
      user: SelectProfile | null
      relatedTrip: SelectItinerary | null
      relatedPhoto: null
      relatedReview: null
      targetUser: null
    }
  | {
      eventType: "new_photo"
      event: EnrichedActivityFeedEvent
      user: SelectProfile | null
      relatedPhoto: SelectTripPhoto | null
      relatedTrip: { id: string; title: string } | null // Simplified trip info
      relatedReview: null
      targetUser: null
    }
  | {
      eventType: "new_review"
      event: EnrichedActivityFeedEvent
      user: SelectProfile | null
      relatedReview: SelectTripReview | null
      relatedTrip: { id: string; title: string } | null // Simplified trip info
      relatedPhoto: null
      targetUser: null
    }
  | {
      eventType: "follow"
      event: EnrichedActivityFeedEvent
      user: SelectProfile | null
      targetUser: SelectProfile | null
      relatedTrip: null
      relatedPhoto: null
      relatedReview: null
    }
