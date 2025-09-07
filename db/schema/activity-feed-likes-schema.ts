/**
 * @description
 * Defines the database schema for the 'activity_feed_likes' table.
 * This table tracks which users have liked specific activity feed events (posts).
 *
 * Key features:
 * - Establishes a many-to-many relationship between users and feed events.
 * - Composite primary key on (user_id, event_id) prevents duplicate likes.
 * - Foreign keys link to `profiles` and `activity_feed_events` tables with cascade deletion.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./activity-feed-events-schema": For referencing the activity feed events table.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, text, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { activityFeedEventsTable } from "./activity-feed-events-schema"

export const activityFeedLikesTable = pgTable(
  "activity_feed_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => activityFeedEventsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.userId, table.eventId] })
    }
  }
)

export type InsertActivityFeedLike = typeof activityFeedLikesTable.$inferInsert
export type SelectActivityFeedLike = typeof activityFeedLikesTable.$inferSelect
