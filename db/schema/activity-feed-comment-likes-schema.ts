/**
 * @description
 * Defines the database schema for the 'activity_feed_comment_likes' table.
 * This table tracks which users have liked specific comments on activity feed events.
 *
 * Key features:
 * - Establishes a many-to-many relationship between users and comments for likes.
 * - Composite primary key on (user_id, comment_id) prevents duplicate likes.
 * - Foreign keys link to `profiles` and `activity_feed_comments` with cascade deletion.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./activity-feed-comments-schema": For referencing the comments table.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */
import { pgTable, text, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { activityFeedCommentsTable } from "./activity-feed-comments-schema"

export const activityFeedCommentLikesTable = pgTable(
  "activity_feed_comment_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => activityFeedCommentsTable.id, {
        onDelete: "cascade"
      }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.userId, table.commentId] })
    }
  }
)

export type InsertActivityFeedCommentLike =
  typeof activityFeedCommentLikesTable.$inferInsert
export type SelectActivityFeedCommentLike =
  typeof activityFeedCommentLikesTable.$inferSelect
