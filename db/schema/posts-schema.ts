/**
 * @description
 * Defines the database schema for posts in the Riffle forum application.
 * This table stores all user-submitted posts, including their content, score, and author.
 *
 * Key features:
 * - `id`: A unique identifier for each post.
 * - `userId`: A foreign key linking the post to the author in the `profilesTable`.
 * - `title`, `content`: The main text content of the post.
 * - `score`: A calculated integer representing the net votes (upvotes - downvotes) for efficient sorting.
 * - `createdAt`, `updatedAt`: Standard audit timestamps.
 *
 * @dependencies
 * - drizzle-orm: For schema definition utilities.
 * - ./profiles-schema: For the `profilesTable` relationship.
 *
 * @notes
 * - The `userId` foreign key is set to cascade on delete, so all posts by a deleted user will also be deleted.
 * - Relations for this table are defined in `db/schema/relations.ts`.
 */

import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"

export const postsTable = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertPost = typeof postsTable.$inferInsert
export type SelectPost = typeof postsTable.$inferSelect
