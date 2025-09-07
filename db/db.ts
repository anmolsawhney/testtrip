/**
 * @description
 * Initializes the Drizzle ORM client with the Supabase PostgreSQL connection.
 * Exports the database client instance (`db`) configured with all application schemas
 * AND *all* their defined relations for complete ORM context.
 * UPDATED: Now imports all schemas and relations directly from their source files to avoid
 * circular dependencies and module resolution errors caused by barrel file exports.
 *
 * Key features:
 * - Configures Drizzle with the database URL from environment variables.
 * - Collects all table schemas AND ALL defined relations into a single `schema` object.
 * - Provides a typed database client for querying.
 *
 * @dependencies
 * - "drizzle-orm/postgres-js": Drizzle adapter for `postgres-js`.
 * - "postgres": PostgreSQL client library.
 * - All individual schema and relation files within `@/db/schema`.
 *
 * @notes
 * - This explicit import structure is critical for preventing build and runtime errors.
 */

// Import all table schemas directly from their source files
import { profilesTable } from "@/db/schema/profiles-schema"
import { itinerariesTable } from "@/db/schema/itineraries-schema"
import { matchesTable, tripRequestsTable } from "@/db/schema/matches-schema"
import { activitiesTable } from "@/db/schema/activities-schema"
import { chatMessagesTable } from "@/db/schema/chat-schema"
import { tripMembersTable } from "@/db/schema/trip-members-schema"
import { tripPhotosTable } from "@/db/schema/trip-photos-schema"
import { tripReviewsTable } from "@/db/schema/trip-reviews-schema"
import { followsTable } from "@/db/schema/follows-schema"
import { likesTable } from "@/db/schema/likes-schema"
import { wishlistItemsTable } from "@/db/schema/wishlist-items-schema"
import { activityFeedEventsTable } from "@/db/schema/activity-feed-events-schema"
import {
  directMessageConversationsTable,
  directMessagesTable
} from "@/db/schema/direct-messages-schema"
import { blocksTable } from "@/db/schema/blocks-schema"
import { reportsTable } from "@/db/schema/reports-schema"
import { activityFeedLikesTable } from "@/db/schema/activity-feed-likes-schema"
import { activityFeedCommentsTable } from "@/db/schema/activity-feed-comments-schema"
import { activityFeedCommentLikesTable } from "@/db/schema/activity-feed-comment-likes-schema"
import { postsTable } from "@/db/schema/posts-schema"
import { commentsTable } from "@/db/schema/comments-schema"
import { votesTable } from "@/db/schema/votes-schema"

// Import all relation definitions directly from the relations file
import * as relations from "@/db/schema/relations"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Combine all schemas AND ALL RELATIONS into one object for Drizzle
const schema = {
  // Tables
  profiles: profilesTable,
  itineraries: itinerariesTable,
  matches: matchesTable,
  tripRequests: tripRequestsTable,
  activities: activitiesTable,
  chatMessages: chatMessagesTable,
  tripMembers: tripMembersTable,
  tripPhotos: tripPhotosTable,
  tripReviews: tripReviewsTable,
  follows: followsTable,
  likes: likesTable,
  wishlistItems: wishlistItemsTable,
  activityFeedEvents: activityFeedEventsTable,
  directMessageConversations: directMessageConversationsTable,
  directMessages: directMessagesTable,
  blocks: blocksTable,
  reports: reportsTable,
  activityFeedLikes: activityFeedLikesTable,
  activityFeedComments: activityFeedCommentsTable,
  activityFeedCommentLikes: activityFeedCommentLikesTable,
  posts: postsTable,
  comments: commentsTable,
  votes: votesTable,

  // Relations (Spread ALL defined relations into the schema object)
  ...relations
}

// Ensure DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set.")
}

// Create the PostgreSQL client connection
const client = postgres(process.env.DATABASE_URL)

// Initialize Drizzle ORM with the client and combined schema
export const db = drizzle(client, { schema })
