/**
 * @description
 * Defines the database schema for activities within trip itineraries in TripRizz.
 * Stores detailed activity information linked to specific trips.
 * Includes an index on the tripId for performance.
 * UPDATED: Added an index on the `tripId` column to improve query performance as recommended by Supabase.
 *
 * Key features:
 * - Links activities to trips via tripId
 * - Stores timing, location, and description
 * - Includes standard audit fields (createdAt, updatedAt)
 * - Indexed `tripId` for faster lookups.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition and `index`.
 * - "./itineraries-schema": For referencing itinerariesTable
 *
 * @notes
 * - tripId is a foreign key with cascade deletion to maintain data integrity
 * - description is nullable to allow optional details
 * - Timestamps are stored as Date objects; Drizzle converts to PostgreSQL timestamps
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { itinerariesTable } from "./itineraries-schema"

// Define the activities schema
export const activitiesTable = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => itinerariesTable.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    location: text("location").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      // Add an index on the tripId column for faster queries
      tripIdIdx: index("activities_trip_id_idx").on(table.tripId)
    }
  }
)

export type InsertActivity = typeof activitiesTable.$inferInsert
export type SelectActivity = typeof activitiesTable.$inferSelect
