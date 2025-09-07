/**
 * @description
 * Defines the database schema for comments in the Riffle forum application.
 * This table stores user-submitted comments on posts and supports nested, threaded replies.
 *
 * Key features:
 * - `id`: A unique identifier for each comment.
 * - `userId`: A foreign key linking the comment to its author in the `profilesTable`.
 * - `postId`: A foreign key linking the comment to the `postsTable`.
 * - `parentId`: A self-referencing foreign key to `commentsTable.id`, enabling threaded replies.
 * - `content`: The text content of the comment.
 * - `score`: A calculated integer for comment voting.
 * - `createdAt`, `updatedAt`: Standard audit timestamps.
 *
 * @dependencies
 * - drizzle-orm: For schema definition utilities.
 * - ./profiles-schema: For the `profilesTable` relationship.
 * - ./posts-schema: For the `postsTable` relationship.
 *
 * @notes
 * - Foreign keys are set to cascade on delete to maintain data integrity.
 * - Relations for this table are defined in `db/schema/relations.ts`.
 */

import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { postsTable } from "./posts-schema"

export const commentsTable = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  postId: uuid("post_id")
    .notNull()
    .references(() => postsTable.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): any => commentsTable.id, {
    onDelete: "cascade"
  }),
  content: text("content").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertComment = typeof commentsTable.$inferInsert
export type SelectComment = typeof commentsTable.$inferSelect
