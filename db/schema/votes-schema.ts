/**
 * @description
 * Defines the database schema for votes in the Riffle forum application.
 * This table stores all user votes for both posts and comments.
 *
 * Key features:
 * - `id`: A unique identifier for each vote record.
 * - `userId`: A foreign key to the user who cast the vote.
 * - `postId`: A nullable foreign key to the post being voted on.
 * - `commentId`: A nullable foreign key to the comment being voted on.
 * - `value`: An integer representing the vote direction (1 for upvote, -1 for downvote).
 * - A `CHECK` constraint ensures that each vote is associated with either a post or a comment, but not both.
 *
 * @dependencies
 * - drizzle-orm: For schema definition utilities and the `sql` helper.
 * - ./profiles-schema: For the `profilesTable` relationship.
 * - ./posts-schema: For the `postsTable` relationship.
 * - ./comments-schema: For the `commentsTable` relationship.
 *
 * @notes
 * - Relations for this table are defined in `db/schema/relations.ts`.
 */

import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  check
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profilesTable } from "./profiles-schema"
import { postsTable } from "./posts-schema"
import { commentsTable } from "./comments-schema"

export const votesTable = pgTable(
  "votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => postsTable.id, {
      onDelete: "cascade"
    }),
    commentId: uuid("comment_id").references(() => commentsTable.id, {
      onDelete: "cascade"
    }),
    value: integer("value").notNull(), // 1 for upvote, -1 for downvote
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      // Ensures that a vote is for either a post or a comment, but not both.
      postOrCommentCheck: check(
        "post_or_comment_check",
        sql`("post_id" IS NOT NULL AND "comment_id" IS NULL) OR ("post_id" IS NULL AND "comment_id" IS NOT NULL)`
      )
    }
  }
)

export type InsertVote = typeof votesTable.$inferInsert
export type SelectVote = typeof votesTable.$inferSelect
