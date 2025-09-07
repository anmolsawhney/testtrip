/**
 * @description
 * Defines types related to user profiles and followers.
 * The ReportWithDetails type has been moved to `reports-types.ts` to avoid export conflicts.
 */

import { SelectProfile as DbSelectProfile } from "@/db/schema"

// Type for a user's follow relationship status relative to the viewer.
export type FollowStatus =
  | "not_following"
  | "pending_outgoing"
  | "pending_incoming"
  | "following"
  | "self"

// Type for a follow request, including the profile of the follower.
export interface FollowRequest {
  followerId: string
  followingId: string
  status: "pending"
  createdAt: Date
  updatedAt: Date | null
  profile: DbSelectProfile | null
}

// Enriched profile type that includes admin status.
export type SelectProfile = DbSelectProfile & {
  isAdmin: boolean
}

// Represents a user profile with their completed trips attached.
export type ProfileWithTrips = SelectProfile & {
  completedTrips?: import("@/db/schema").SelectItinerary[]
}
