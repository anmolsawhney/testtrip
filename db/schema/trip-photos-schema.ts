/**
 * @description
 * Defines the database schema for trip photos in TripRizz.
 * Stores photos uploaded by trip members for completed trips.
 *
 * Key features:
 * - Links photos to specific trips with tripId
 * - Tracks the user who uploaded each photo
 * - Stores photo URL, optional caption, and timestamps
 * - Maintains proper relationships with cascade deletion
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition
 * - "./itineraries-schema": For referencing itinerariesTable
 * - "./profiles-schema": For referencing profilesTable
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { itinerariesTable } from "./itineraries-schema"
import { profilesTable } from "./profiles-schema"

// Define the trip photos schema
export const tripPhotosTable = pgTable("trip_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => itinerariesTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }), // Added FK
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertTripPhoto = typeof tripPhotosTable.$inferInsert
export type SelectTripPhoto = typeof tripPhotosTable.$inferSelect
