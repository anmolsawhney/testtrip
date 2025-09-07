/**
 * @description
 * Defines the database schema for the 'activity_feed_events' table in TripRizz.
 * This table logs various user actions to populate the activity feed.
 * UPDATED: Added `like_count` and `comment_count` to support post interactions.
 * FIXED: Changed `relatedId` from `uuid` to `text` to correctly store user IDs for 'follow' events, resolving a server crash.
 *
 * Key features:
 * - Tracks the user performing the action (`user_id`).
 * - Uses an enum (`event_type`) to categorize activities (new_photo, new_trip, etc.).
 * - Links to the relevant entity (photo, trip, review, user) via `related_id`.
 * - Optionally stores the target user for actions like 'follow'.
 * - Includes `event_data` (JSONB) for storing extra context specific to the event type.
 * - `like_count` and `comment_count` for tracking engagement.
 * - Standard audit timestamp (`created_at`).
 * - Indexes for efficient feed generation (querying by user and timestamp).
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./enums": For shared enum definitions.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { activityEventTypeEnum } from "./enums"

export const activityFeedEventsTable = pgTable("activity_feed_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  eventType: activityEventTypeEnum("event_type").notNull(),
  relatedId: text("related_id").notNull(),
  targetUserId: text("target_user_id").references(() => profilesTable.userId, {
    onDelete: "cascade"
  }),
  eventData: jsonb("event_data"),
  like_count: integer("like_count").default(0).notNull(),
  comment_count: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type InsertActivityFeedEvent =
  typeof activityFeedEventsTable.$inferInsert
export type SelectActivityFeedEvent =
  typeof activityFeedEventsTable.$inferSelect
