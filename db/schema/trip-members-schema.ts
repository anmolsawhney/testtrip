/**
 * @description
 * Defines the database schema for the 'trip_members' table in TripRizz.
 * This table manages the participants of a trip and their roles (owner, member).
 * UPDATED: Added a `last_read_at` timestamp to track when a user last viewed the group chat for a trip,
 * enabling unread message notifications.
 *
 * Key features:
 * - Links members to specific trips (`tripId`) and users (`userId`).
 * - Defines member roles using an enum ('owner', 'member').
 * - Includes timestamps for when a member joined and when the record was created/updated.
 * - `last_read_at` field for tracking unread group chat messages. // NEW
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives (pgTable, uuid, text, timestamp).
 * - "./enums": For `tripMemberRoleEnum`.
 * - "./itineraries-schema": For referencing `itinerariesTable`.
 * - "./profiles-schema": For referencing `profilesTable`.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { tripMemberRoleEnum } from "./enums"
import { itinerariesTable } from "./itineraries-schema"
import { profilesTable } from "./profiles-schema"

export const tripMembersTable = pgTable("trip_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => itinerariesTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  role: tripMemberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  // New column to track when the user last read the chat for this trip
  lastReadAt: timestamp("last_read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertTripMember = typeof tripMembersTable.$inferInsert
export type SelectTripMember = typeof tripMembersTable.$inferSelect
