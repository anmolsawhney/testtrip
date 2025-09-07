/**
 * @description
 * Defines the database schema for trip itineraries.
 * Used for storing trip information, visibility settings, and status.
 * Includes fields for preferences, budget, cover photo, and like count.
 * UPDATED: Added an index definition block to manage table indexes directly within the schema.
 * The unused 'itineraries_visibility_idx' has been removed as a performance optimization.
 *
 * Key features:
 * - Trip details (title, description, location, dates, group size).
 * - Trip metadata (type, visibility, status, creator, timestamps).
 * - Support for photos, itinerary details (JSONB), up/downvotes, archiving.
 * - `cover_photo_url` for selecting a specific cover image.
 * - `like_count` for tracking itinerary likes.
 * - `trip_preferences` (text array) for categorizing trip styles.
 * - `budget` (integer) for storing a specific trip budget in rupees.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives and `index`.
 * - "drizzle-orm": For `sql` utility.
 * - "./enums": For shared enum definitions.
 * - "./profiles-schema": For referencing profilesTable.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  index
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { tripTypeEnum, tripVisibilityEnum, tripStatusEnum } from "./enums"
import { profilesTable } from "./profiles-schema"

export const itinerariesTable = pgTable(
  "itineraries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => profilesTable.userId),
    title: text("title").notNull(),
    description: text("description"),
    tripType: tripTypeEnum("trip_type").notNull(),
    visibility: tripVisibilityEnum("trip_visibility")
      .default("private")
      .notNull(),
    status: tripStatusEnum("trip_status").default("draft").notNull(),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    location: text("location").notNull(),
    maxGroupSize: integer("max_group_size"),
    currentGroupSize: integer("current_group_size").default(1),
    itineraryDetails: jsonb("itinerary_details"),
    photos: text("photos").array(),
    upvotes: integer("upvotes").default(0),
    downvotes: integer("downvotes").default(0),
    isArchived: boolean("is_archived").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    cover_photo_url: text("cover_photo_url"),
    like_count: integer("like_count").default(0).notNull(),
    tripPreferences: text("trip_preferences")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    budget: integer("budget") // Use integer for specific amount
  },
  table => {
    return {
      creatorIdIdx: index("itineraries_creator_id_idx").on(table.creatorId),
      statusIdx: index("itineraries_status_idx").on(table.status),
      likeCountIdx: index("itineraries_like_count_idx").on(table.like_count)
    }
  }
)

export type InsertItinerary = typeof itinerariesTable.$inferInsert
export type SelectItinerary = typeof itinerariesTable.$inferSelect
