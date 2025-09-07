/**
 * @description
 * Defines the database schema for the 'activity_feed_comments' table.
 * This table stores comments made by users on specific activity feed events (posts).
 * It supports threaded replies by having a self-referencing 'parentCommentId' and
 * includes counts for likes and replies to facilitate engagement features.
 * UPDATED: Added indexes on `userId`, `eventId`, and `parentCommentId` to improve query performance.
 *
 * Key features:
 * - Links comments to a specific feed event (`eventId`) and a user (`userId`).
 * - Supports threaded replies via a nullable `parentCommentId`.
 * - `likeCount` and `replyCount` for tracking engagement on each comment.
 * - Foreign keys with cascade deletion to maintain data integrity.
 * - Standard audit timestamps (`createdAt`, `updatedAt`).
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives and `index`.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./activity-feed-events-schema": For referencing the activity feed events table.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index
} from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { activityFeedEventsTable } from "./activity-feed-events-schema"

export const activityFeedCommentsTable = pgTable(
  "activity_feed_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => activityFeedEventsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    // Self-referencing key for threaded comments/replies
    parentCommentId: uuid("parent_comment_id").references(
      (): any => activityFeedCommentsTable.id, // Drizzle requires 'any' for self-reference
      { onDelete: "cascade" }
    ),
    content: text("content").notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    replyCount: integer("reply_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      userIdx: index("activity_comments_user_idx").on(table.userId),
      eventIdIdx: index("activity_comments_event_idx").on(table.eventId),
      parentCommentIdIdx: index("activity_comments_parent_idx").on(
        table.parentCommentId
      )
    }
  }
)

export type InsertActivityFeedComment =
  typeof activityFeedCommentsTable.$inferInsert
export type SelectActivityFeedComment =
  typeof activityFeedCommentsTable.$inferSelect
