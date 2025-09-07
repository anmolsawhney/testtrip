/**
 * @description
 * Matches schema for managing user connections and trip participation requests.
 * Used for tracking user interactions and trip join requests within the TripRizz app.
 * Includes fields for status tracking and user dismissal of notifications.
 * Adds dismissal flags for match notifications.
 * UPDATED: Added a table-level `check` constraint to enforce `userId1` < `userId2`, ensuring canonical user pairs.
 *
 * Key features:
 * - User-to-user matches (defined in `matchesTable`).
 * - `userId1` and `userId2` are now sorted and enforced by a CHECK constraint.
 * - Trip join requests (`tripRequestsTable`) with status tracking (pending, accepted, etc.).
 * - `is_dismissed` flag on trip requests to track user notification interaction.
 * - Dismissal flags (`is_dismissed_by_user1`, `is_dismissed_by_user2`) on matches.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives (pgTable, text, etc.).
 * - "drizzle-orm": For the `sql` functions.
 * - "./enums": For shared enum definitions.
 * - "./itineraries-schema": For referencing itinerariesTable in relation.
 * - "./profiles-schema": For referencing profilesTable in relation.
 *
 * @notes
 * - Relations for these tables are defined centrally in `db/schema/relations.ts`.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  check,
  uniqueIndex
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { matchStatusEnum } from "./enums"
import { itinerariesTable } from "./itineraries-schema"
import { profilesTable } from "./profiles-schema"

export const matchesTable = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId1: text("user_id_1")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    userId2: text("user_id_2")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    status: matchStatusEnum("status").default("pending").notNull(),
    initiatedBy: text("initiated_by")
      .notNull()
      .references(() => profilesTable.userId),
    isDismissedByUser1: boolean("is_dismissed_by_user1")
      .default(false)
      .notNull(),
    isDismissedByUser2: boolean("is_dismissed_by_user2")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      // Enforce that user IDs are always stored in a canonical, sorted order.
      userOrderCheck: check(
        "matches_user_order_check",
        sql`${table.userId1} < ${table.userId2}`
      ),
      // Ensure that each pair of users can only have one match record.
      uniqueUserPair: uniqueIndex("matches_user_pair_unique").on(
        table.userId1,
        table.userId2
      )
    }
  }
)

export const tripRequestsTable = pgTable("trip_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => itinerariesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  status: matchStatusEnum("status").default("pending").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  isDismissed: boolean("is_dismissed").default(false).notNull()
})

export type InsertMatch = typeof matchesTable.$inferInsert
export type SelectMatch = typeof matchesTable.$inferSelect
export type InsertTripRequest = typeof tripRequestsTable.$inferInsert
export type SelectTripRequest = typeof tripRequestsTable.$inferSelect

export interface TripRequestParams {
  tripId?: string
  userId?: string
  status?:
    | (typeof matchStatusEnum.enumValues)[number]
    | (typeof matchStatusEnum.enumValues)[number][]
  isDismissed?: boolean
}
