/**
 * @description
 * Server actions for managing "likes" on activity feed comments.
 * Provides functionality to add/remove likes and atomically update the comment's like count.
 *
 * Key features:
 * - Toggle Like: Adds or removes a like for a user on a comment, atomically updating the comment's like count.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations.
 *
 * @notes
 * - All actions are server-side only (`"use server"`).
 * - Uses `ActionState` for consistent return structure.
 * - `toggleLikeOnCommentAction` uses a database transaction for atomicity.
 * - Authorization checks ensure users are logged in.
 */
"use server"

import { db } from "@/db/db"
import {
  activityFeedCommentLikesTable,
  activityFeedCommentsTable
} from "@/db/schema"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, eq, sql } from "drizzle-orm"

/**
 * Toggles a like on a specific comment for the current user.
 * This action is transactional to ensure data consistency.
 *
 * @param commentId - The UUID of the comment to like/unlike.
 * @returns ActionState containing the new like status and the updated like count.
 */
export async function toggleLikeOnCommentAction(
  commentId: string
): Promise<ActionState<{ liked: boolean; newCount: number }>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." }
  }
  if (!commentId) {
    return { isSuccess: false, message: "Comment ID is required." }
  }

  try {
    const result = await db.transaction(async tx => {
      // Check if a like by this user for this comment already exists
      const existingLike = await tx.query.activityFeedCommentLikes.findFirst({
        where: and(
          eq(activityFeedCommentLikesTable.userId, userId),
          eq(activityFeedCommentLikesTable.commentId, commentId)
        )
      })

      let liked: boolean
      let updatedCountResult: { likeCount: number }[]

      if (existingLike) {
        // --- Unlike ---
        // 1. Delete the like record
        await tx
          .delete(activityFeedCommentLikesTable)
          .where(
            and(
              eq(activityFeedCommentLikesTable.userId, userId),
              eq(activityFeedCommentLikesTable.commentId, commentId)
            )
          )
        // 2. Decrement the like_count on the comment table
        updatedCountResult = await tx
          .update(activityFeedCommentsTable)
          .set({
            likeCount: sql`GREATEST(0, ${activityFeedCommentsTable.likeCount} - 1)`
          })
          .where(eq(activityFeedCommentsTable.id, commentId))
          .returning({ likeCount: activityFeedCommentsTable.likeCount })
        liked = false
      } else {
        // --- Like ---
        // 1. Insert the new like record
        await tx
          .insert(activityFeedCommentLikesTable)
          .values({ userId, commentId })
        // 2. Increment the like_count on the comment table
        updatedCountResult = await tx
          .update(activityFeedCommentsTable)
          .set({
            likeCount: sql`${activityFeedCommentsTable.likeCount} + 1`
          })
          .where(eq(activityFeedCommentsTable.id, commentId))
          .returning({ likeCount: activityFeedCommentsTable.likeCount })
        liked = true

        // TODO: Create a notification for the comment author
      }

      if (updatedCountResult.length === 0) {
        throw new Error("Failed to update comment like count. The comment may have been deleted.")
      }
      return { liked, newCount: updatedCountResult[0].likeCount }
    })

    return {
      isSuccess: true,
      message: result.liked ? "Comment liked." : "Like removed.",
      data: result
    }
  } catch (error) {
    console.error("[Action toggleLikeOnCommentAction] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to toggle like on comment."
    }
  }
}