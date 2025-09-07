/**
 * @description
 * Defines the database schema for trip reviews in TripRizz.
 * Stores reviews submitted by trip members for completed trips.
 *
 * Key features:
 * - Links reviews to specific trips with tripId
 * - Tracks the user who submitted each review
 * - Stores rating, content, and timestamps
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

import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core"
import { itinerariesTable } from "./itineraries-schema"
import { profilesTable } from "./profiles-schema"

// Define the trip reviews schema
export const tripReviewsTable = pgTable("trip_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => itinerariesTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }), // Added FK
  rating: integer("rating").notNull(), // Rating from 1-5
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertTripReview = typeof tripReviewsTable.$inferInsert
export type SelectTripReview = typeof tripReviewsTable.$inferSelect
