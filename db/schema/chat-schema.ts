/**
 * @description
 * Defines the database schema for chat messages in trip group chats.
 * Stores messages between trip members with proper associations.
 * Includes an index for performance.
 * UPDATED: Added an index on the `tripId` column to improve query performance as recommended by Supabase.
 *
 * Key features:
 * - Links messages to specific trips with tripId
 * - Stores sender details, content, and timestamp
 * - Includes standard audit fields (createdAt, updatedAt)
 * - Indexed `tripId` for faster lookups.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition and `index`.
 * - "./itineraries-schema": For referencing itinerariesTable
 * - "./profiles-schema": For referencing profilesTable
 *
 * @notes
 * - tripId is a foreign key with cascade deletion to maintain data integrity
 * - senderId references Clerk userId (FK added for relation definition)
 * - Relations are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { itinerariesTable } from "./itineraries-schema"
import { profilesTable } from "./profiles-schema"

// Define the chat messages schema
export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => itinerariesTable.id, { onDelete: "cascade" })
      .notNull(),
    senderId: text("sender_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }), // Added FK for relation
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      // Add an index on the tripId column for faster queries
      tripIdIdx: index("chat_messages_trip_id_idx").on(table.tripId)
    }
  }
)

export type InsertChatMessage = typeof chatMessagesTable.$inferInsert
export type SelectChatMessage = typeof chatMessagesTable.$inferSelect
