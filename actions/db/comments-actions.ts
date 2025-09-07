/**
 * @description
 * Server actions for handling all CRUD (Create, Read, Update, Delete) operations
 * for comments in the Riffle forum application. These actions manage comments on posts
 * as well as threaded replies to other comments.
 *
 * Key features:
 * - Creation of new comments with an automatic initial upvote from the author.
 * - Retrieval of all comments for a post, enriched with author and user vote information.
 * - Secure updating and deletion of comments, restricted to the original author.
 *
 * @dependencies
 * - "@/db/db": The Drizzle ORM database instance.
 * - "@/db/schema": Schemas for comments, votes, and their types.
 * - "@/types": The standardized `ActionState` and forum-specific types.
 * - "@clerk/nextjs/server": For handling user authentication.
 * - "drizzle-orm": For database query functions and operators.
 *
 * @notes
 * - All actions perform authorization checks to ensure users operate within their permissions.
 * - Actions return a standardized `ActionState` object for consistent error and success handling.
 * - The `createCommentAction` uses a transaction to ensure creating a comment and the author's initial upvote are an atomic operation.
 */
"use server"

import { db } from "@/db/db"
import {
  commentsTable,
  votesTable,
  InsertComment,
  SelectComment,
  SelectProfile,
  SelectVote
} from "@/db/schema"
import { ActionState, CommentWithAuthorAndVote } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

/**
 * Creates a new comment on a post or as a reply to another comment.
 * Automatically gives the new comment an initial upvote from the author.
 * This operation is transactional.
 * @param data - The comment data, including postId, content, and optional parentId.
 * @returns {Promise<ActionState<SelectComment>>} The state of the action with the newly created comment.
 */
export async function createCommentAction(
  data: Omit<InsertComment, "userId" | "score">
): Promise<ActionState<SelectComment>> {
  const { userId } = await auth()
  if (!userId) {
    return {
      isSuccess: false,
      message: "You must be logged in to comment."
    }
  }

  if (!data.postId || !data.content?.trim()) {
    return {
      isSuccess: false,
      message: "Post ID and content are required to create a comment."
    }
  }

  try {
    const newComment = await db.transaction(async tx => {
      // 1. Create the comment with an initial score of 1.
      const [comment] = await tx
        .insert(commentsTable)
        .values({
          ...data,
          userId,
          score: 1 // Start with score of 1 for the author's upvote
        })
        .returning()

      if (!comment) {
        tx.rollback()
        return null
      }

      // 2. Create the author's initial upvote record in the votes table.
      await tx.insert(votesTable).values({
        userId,
        commentId: comment.id,
        value: 1
      })

      return comment
    })

    if (!newComment) {
      return { isSuccess: false, message: "Failed to create comment." }
    }

    return {
      isSuccess: true,
      message: "Comment created successfully.",
      data: newComment
    }
  } catch (error) {
    console.error("Error creating comment:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Retrieves all comments for a given post, enriched with author and user vote info.
 * The comments are returned in chronological order to allow the client to build a threaded view.
 * @param postId - The ID of the post to fetch comments for.
 * @returns {Promise<ActionState<CommentWithAuthorAndVote[]>>} The state of the action with the list of enriched comments.
 */
export async function getCommentsByPostIdAction(
  postId: string
): Promise<ActionState<CommentWithAuthorAndVote[]>> {
  const { userId } = await auth()

  try {
    let commentsQuery
    if (userId) {
      // Query for logged-in user, including their vote on each comment
      commentsQuery = db.query.comments.findMany({
        where: eq(commentsTable.postId, postId),
        with: {
          author: true,
          votes: {
            where: eq(votesTable.userId, userId)
          }
        },
        orderBy: [asc(commentsTable.createdAt)]
      })
    } else {
      // Query for logged-out user, without vote information
      commentsQuery = db.query.comments.findMany({
        where: eq(commentsTable.postId, postId),
        with: {
          author: true
        },
        orderBy: [asc(commentsTable.createdAt)]
      })
    }

    const comments = await commentsQuery

    // Map the results to the enriched type, handling the optional 'votes' property
    const commentsWithVotes: CommentWithAuthorAndVote[] = comments.map(
      comment => {
        // FIX: The type assertion now correctly includes the 'author' property.
        const c = comment as SelectComment & {
          author: SelectProfile
          votes?: SelectVote[]
        }
        return {
          ...c,
          userVote: c.votes?.[0] || null
        }
      }
    )

    return {
      isSuccess: true,
      message: "Comments retrieved successfully.",
      data: commentsWithVotes
    }
  } catch (error) {
    console.error("Error retrieving comments:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Updates an existing comment. Only the original author can perform this action.
 * @param commentId - The ID of the comment to update.
 * @param content - The new content for the comment.
 * @returns {Promise<ActionState<SelectComment>>} The state of the action with the updated comment data.
 */
export async function updateCommentAction(
  commentId: string,
  content: string
): Promise<ActionState<SelectComment>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in." }
  }

  if (!content.trim()) {
    return { isSuccess: false, message: "Comment content cannot be empty." }
  }

  try {
    const comment = await db.query.comments.findFirst({
      where: eq(commentsTable.id, commentId),
      columns: { userId: true }
    })

    if (!comment) {
      return { isSuccess: false, message: "Comment not found." }
    }

    if (comment.userId !== userId) {
      return {
        isSuccess: false,
        message: "You are not authorized to edit this comment."
      }
    }

    const [updatedComment] = await db
      .update(commentsTable)
      .set({ content })
      .where(eq(commentsTable.id, commentId))
      .returning()

    return {
      isSuccess: true,
      message: "Comment updated successfully.",
      data: updatedComment
    }
  } catch (error) {
    console.error("Error updating comment:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Deletes a comment. Only the original author can perform this action.
 * Deleting a comment will also cascade and delete all its replies and associated votes.
 * @param commentId - The ID of the comment to delete.
 * @returns {Promise<ActionState<void>>} The state of the action.
 */
export async function deleteCommentAction(
  commentId: string
): Promise<ActionState<void>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in." }
  }

  try {
    const comment = await db.query.comments.findFirst({
      where: eq(commentsTable.id, commentId),
      columns: { userId: true }
    })

    if (!comment) {
      return { isSuccess: false, message: "Comment not found." }
    }

    if (comment.userId !== userId) {
      return {
        isSuccess: false,
        message: "You are not authorized to delete this comment."
      }
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, commentId))

    return {
      isSuccess: true,
      message: "Comment deleted successfully.",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting comment:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}