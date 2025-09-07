/**
 * @description
 * Defines the database schema for the 'follows' table in TripRizz.
 * This table stores follower/following relationships between users,
 * including the status of the follow request.
 *
 * Key features:
 * - Composite primary key on (follower_id, following_id).
 * - Foreign key constraints linking to the profiles table.
 * - Enum for follow status ('pending', 'accepted').
 * - `is_dismissed_by_follower` flag for notification management.
 * - Standard audit timestamps (createdAt, updatedAt).
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing profilesTable.
 * - "./enums": For followStatusEnum.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey
} from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { followStatusEnum } from "./enums"

export const followsTable = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    status: followStatusEnum("status").notNull(),
    isDismissedByFollower: boolean("is_dismissed_by_follower")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.followerId, table.followingId] })
    }
  }
)

export type InsertFollow = typeof followsTable.$inferInsert
export type SelectFollow = typeof followsTable.$inferSelect
