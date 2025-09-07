/**
 * @description
 * Server actions for managing comments on activity feed events (posts).
 * Provides functionality for creating, retrieving, updating, and deleting comments,
 * and atomically updating the event's comment count. Supports threaded replies and likes on comments.
 * UPDATED: The get comments/replies actions now use an `innerJoin` to filter out content from soft-deleted users.
 *
 * Key features:
 * - Create Comment: Adds a new comment (or reply) and increments the relevant count in a transaction.
 * - Get Comments: Retrieves top-level comments for a specific event, including the commenter's profile and like status, filtering out comments from deleted users.
 * - Get Replies: Retrieves replies for a specific parent comment, filtering out replies from deleted users.
 * - Update Comment: Allows a user to edit their own comments.
 * - Delete Comment: Allows a user to delete their own comments and decrements relevant counts.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations (eq, and, sql, desc, isNull, leftJoin).
 *
 * @notes
 * - All actions are server-side only (`"use server"`).
 * - Uses `ActionState` for consistent return structure.
 * - Authorization checks ensure users are logged in and can only modify their own comments.
 */
"use server"

import { db } from "@/db/db"
import {
  activityFeedCommentsTable,
  activityFeedEventsTable,
  SelectActivityFeedComment,
  profilesTable,
  SelectProfile,
  activityFeedCommentLikesTable
} from "@/db/schema"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, like, desc, asc,  eq, sql, isNull, not } from "drizzle-orm"
// import { createNotificationAction } from "./notifications-actions"; // Will be used for notifications

export type CommentWithUser = SelectActivityFeedComment & {
  user: SelectProfile | null
  isLikedByCurrentUser: boolean
}

export async function createCommentOnActivityEventAction(
  eventId: string,
  content: string,
  parentCommentId?: string | null // Added optional parentCommentId for replies
): Promise<ActionState<CommentWithUser>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." }
  }
  if (!eventId || !content.trim()) {
    return { isSuccess: false, message: "Event ID and content are required." }
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Insert comment/reply
      const [newComment] = await tx
        .insert(activityFeedCommentsTable)
        .values({
          userId,
          eventId,
          content: content.trim(),
          parentCommentId: parentCommentId
        })
        .returning()

      if (!newComment) {
        throw new Error("Failed to create comment.")
      }

      // If it's a reply, increment reply_count on the parent comment.
      // Otherwise, increment comment_count on the main event.
      if (parentCommentId) {
        await tx
          .update(activityFeedCommentsTable)
          .set({
            replyCount: sql`${activityFeedCommentsTable.replyCount} + 1`
          })
          .where(eq(activityFeedCommentsTable.id, parentCommentId))
      } else {
        await tx
          .update(activityFeedEventsTable)
          .set({
            comment_count: sql`${activityFeedEventsTable.comment_count} + 1`
          })
          .where(eq(activityFeedEventsTable.id, eventId))
      }

      // Fetch the user profile to return with the new comment
      const userProfile = await tx.query.profiles.findFirst({
        where: eq(profilesTable.userId, userId)
      })

      // TODO: Create notification for the post owner / parent comment owner

      // The new comment has not been liked by the current user yet.
      return { ...newComment, user: userProfile ?? null, isLikedByCurrentUser: false }
    })

    return {
      isSuccess: true,
      message: parentCommentId ? "Reply posted." : "Comment posted.",
      data: result
    }
  } catch (error) {
    console.error("[Action createCommentOnActivityEvent] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to post comment."
    }
  }
}

export async function getCommentsForActivityEventAction(
  eventId: string
): Promise<ActionState<CommentWithUser[]>> {
  const { userId } = await auth()

  if (!eventId) {
    return { isSuccess: false, message: "Event ID is required." }
  }
  try {
    // Fetch top-level comments only (where parentCommentId is null)
    const commentsWithUsers = await db
      .select({
        comment: activityFeedCommentsTable,
        user: profilesTable,
        // Check if a like exists from the current user
        isLiked: sql<boolean>`EXISTS(SELECT 1 FROM ${activityFeedCommentLikesTable} WHERE ${activityFeedCommentLikesTable.commentId} = ${activityFeedCommentsTable.id} AND ${activityFeedCommentLikesTable.userId} = ${userId})`.as('is_liked')
      })
      .from(activityFeedCommentsTable)
      .innerJoin(
        profilesTable,
        eq(activityFeedCommentsTable.userId, profilesTable.userId)
      )
      .where(
        and(
          eq(activityFeedCommentsTable.eventId, eventId),
          isNull(activityFeedCommentsTable.parentCommentId), // Only fetch top-level comments
          not(like(profilesTable.username, "deleted_%"))
        )
      )
      .orderBy(desc(activityFeedCommentsTable.createdAt))

    const data: CommentWithUser[] = commentsWithUsers.map(c => ({
      ...c.comment,
      user: c.user ?? null,
      isLikedByCurrentUser: c.isLiked
    }))

    return {
      isSuccess: true,
      message: "Comments retrieved.",
      data: data
    }
  } catch (error) {
    console.error("[Action getCommentsForActivityEvent] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve comments."
    }
  }
}

/**
 * Retrieves replies for a specific parent comment.
 * @param parentCommentId - The UUID of the parent comment.
 * @returns ActionState with an array of replies.
 */
export async function getCommentRepliesAction(
  parentCommentId: string
): Promise<ActionState<CommentWithUser[]>> {
    const { userId } = await auth()
    if (!parentCommentId) {
        return { isSuccess: false, message: "Parent Comment ID is required." }
    }
    try {
        const repliesWithUsers = await db
            .select({
                comment: activityFeedCommentsTable,
                user: profilesTable,
                isLiked: sql<boolean>`EXISTS(SELECT 1 FROM ${activityFeedCommentLikesTable} WHERE ${activityFeedCommentLikesTable.commentId} = ${activityFeedCommentsTable.id} AND ${activityFeedCommentLikesTable.userId} = ${userId})`.as('is_liked')
            })
            .from(activityFeedCommentsTable)
            .innerJoin(profilesTable, eq(activityFeedCommentsTable.userId, profilesTable.userId))
            .where(
              and(
                eq(activityFeedCommentsTable.parentCommentId, parentCommentId),
                not(like(profilesTable.username, "deleted_%"))
              )
            )
            .orderBy(asc(activityFeedCommentsTable.createdAt)) // Show replies in chronological order

        const data: CommentWithUser[] = repliesWithUsers.map(c => ({
            ...c.comment,
            user: c.user ?? null,
            isLikedByCurrentUser: c.isLiked
        }))

        return {
            isSuccess: true,
            message: "Replies retrieved.",
            data: data
        }
    } catch (error) {
        console.error("[Action getCommentRepliesAction] Error:", error)
        return { isSuccess: false, message: "Failed to retrieve replies." }
    }
}


export async function updateCommentAction(
  commentId: string,
  newContent: string
): Promise<ActionState<SelectActivityFeedComment>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized." }
  }
  if (!commentId || !newContent.trim()) {
    return { isSuccess: false, message: "Comment ID and new content are required." }
  }

  try {
    const comment = await db.query.activityFeedComments.findFirst({
      where: eq(activityFeedCommentsTable.id, commentId)
    })
    if (!comment) {
      return { isSuccess: false, message: "Comment not found." }
    }
    if (comment.userId !== userId) {
      return { isSuccess: false, message: "You can only edit your own comments." }
    }

    const [updatedComment] = await db
      .update(activityFeedCommentsTable)
      .set({ content: newContent.trim(), updatedAt: new Date() })
      .where(eq(activityFeedCommentsTable.id, commentId))
      .returning()

    if (!updatedComment) {
      throw new Error("Failed to update comment in database.")
    }

    return {
      isSuccess: true,
      message: "Comment updated.",
      data: updatedComment
    }
  } catch (error) {
    console.error("[Action updateCommentAction] Error:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to update comment."
    }
  }
}

export async function deleteCommentAction(
  commentId: string
): Promise<ActionState<void>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized." }
  }
  if (!commentId) {
    return { isSuccess: false, message: "Comment ID is required." }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const comment = await tx.query.activityFeedComments.findFirst({
        where: eq(activityFeedCommentsTable.id, commentId),
        columns: { userId: true, eventId: true, parentCommentId: true }
      })
      if (!comment) {
        return { success: false, message: "Comment not found." }
      }
      if (comment.userId !== userId) {
        return { success: false, message: "You can only delete your own comments." }
      }

      // Delete the comment
      await tx.delete(activityFeedCommentsTable).where(eq(activityFeedCommentsTable.id, commentId))

      // Decrement the appropriate counter
      if (comment.parentCommentId) {
        // It's a reply, decrement parent's reply_count
        await tx
          .update(activityFeedCommentsTable)
          .set({
            replyCount: sql`GREATEST(0, ${activityFeedCommentsTable.replyCount} - 1)`
          })
          .where(eq(activityFeedCommentsTable.id, comment.parentCommentId))
      } else {
        // It's a top-level comment, decrement event's comment_count
        await tx
          .update(activityFeedEventsTable)
          .set({
            comment_count: sql`GREATEST(0, ${activityFeedEventsTable.comment_count} - 1)`
          })
          .where(eq(activityFeedEventsTable.id, comment.eventId))
      }
      
      return { success: true, message: "Comment deleted." }
    });

    if (!result.success) {
      return { isSuccess: false, message: result.message };
    }

    return { isSuccess: true, message: "Comment deleted.", data: undefined }
  } catch (error) {
    console.error("[Action deleteCommentAction] Error:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to delete comment."
    }
  }
}