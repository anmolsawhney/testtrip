/**
 * @description
 * Defines the database schema for the 'likes' table in TripRizz.
 * This table tracks which users have liked which trip itineraries.
 *
 * Key features:
 * - Establishes a many-to-many relationship between users and itineraries for likes.
 * - Composite primary key on (user_id, itinerary_id) to prevent duplicate likes.
 * - Foreign key constraints linking to profiles and itineraries tables.
 * - Timestamp for when the like was created.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing profilesTable.
 * - "./itineraries-schema": For referencing itinerariesTable.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, text, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { itinerariesTable } from "./itineraries-schema"

export const likesTable = pgTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itinerariesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.userId, table.itineraryId] })
    }
  }
)

export type InsertLike = typeof likesTable.$inferInsert
export type SelectLike = typeof likesTable.$inferSelect
