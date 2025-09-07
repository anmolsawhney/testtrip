/**
 * @description
 * Defines the database schema for the 'wishlist_items' table in TripRizz.
 * This table stores itineraries that users have saved to their private wishlist or bucket list.
 *
 * Key features:
 * - Establishes a many-to-many relationship between users and itineraries for wishlisting.
 * - Composite primary key on (user_id, itinerary_id) to prevent duplicate wishlist entries.
 * - Foreign key constraints linking to profiles and itineraries tables.
 * - Timestamp for when the item was added to the wishlist.
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

export const wishlistItemsTable = pgTable(
  "wishlist_items",
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

export type InsertWishlistItem = typeof wishlistItemsTable.$inferInsert
export type SelectWishlistItem = typeof wishlistItemsTable.$inferSelect
