/**
 * @description
 * Defines the database schemas for Direct Messaging (DM) functionality in TripRizz.
 * Includes tables for tracking conversations between users and storing individual messages.
 * UPDATED: Added an index on the `senderId` column of the `direct_messages` table to improve query performance.
 *
 * Key features:
 * - `directMessageConversationsTable`: Tracks 1-on-1 conversations, status (active/request),
 *   participants, and timestamps for last activity and read status.
 * - `directMessagesTable`: Stores individual messages with content, sender, and timestamp,
 *   linked to a specific conversation.
 * - Unique constraint on conversations to prevent duplicate pairs.
 * - Foreign keys linking conversations/messages to users and conversations.
 * - Indexes for efficient querying of conversations and messages.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives and `index`.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./enums": For shared enum definitions.
 *
 * @notes
 * - Relations for these tables are defined centrally in `db/schema/relations.ts`.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { conversationStatusEnum } from "./enums"

export const directMessageConversationsTable = pgTable(
  "direct_message_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user1Id: text("user1_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    user2Id: text("user2_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    status: conversationStatusEnum("status").default("request").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastMessageId: uuid("last_message_id"),
    user1LastReadAt: timestamp("user1_last_read_at"),
    user2LastReadAt: timestamp("user2_last_read_at")
  },
  table => {
    return {
      unique_user_pair: uniqueIndex("dm_conversations_user_pair_unique_idx").on(
        table.user1Id,
        table.user2Id
      ),
      lastMessageIdx: index("dm_conversations_last_message_idx").on(
        table.lastMessageId
      ),
      user1Idx: index("dm_conversations_user1_idx").on(table.user1Id),
      user2Idx: index("dm_conversations_user2_idx").on(table.user2Id),
      updatedAtIdx: index("dm_conversations_updated_idx").on(table.updatedAt)
    }
  }
)

export const directMessagesTable = pgTable(
  "direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => directMessageConversationsTable.id, {
        onDelete: "cascade"
      }),
    senderId: text("sender_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => {
    return {
      convoTimeIdx: index("dm_convo_time_idx").on(
        table.conversationId,
        table.createdAt
      ),
      senderIdx: index("direct_messages_sender_id_idx").on(table.senderId)
    }
  }
)

export type InsertDirectMessageConversation =
  typeof directMessageConversationsTable.$inferInsert
export type SelectDirectMessageConversation =
  typeof directMessageConversationsTable.$inferSelect
export type InsertDirectMessage = typeof directMessagesTable.$inferInsert
export type SelectDirectMessage = typeof directMessagesTable.$inferSelect
