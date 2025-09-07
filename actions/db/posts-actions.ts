/**
 * @description
 * Server actions for handling all CRUD (Create, Read, Update, Delete) operations
 * for posts in the Riffle forum application. These actions are designed to be
 * called from server components and client components to interact with the database.
 * UPDATED: The `getPostsAction` now efficiently fetches the comment count for each post using a subquery.
 * FIXED: Refactored `getPostsAction` and `getPostByIdAction` to use a more robust scalar subquery
 * for fetching comment counts, which resolves the "alias not declared" runtime error and improves performance.
 *
 * Key features:
 * - Creation of new posts with an automatic initial upvote for the author.
 * - Retrieval of single or multiple posts, enriched with author, user vote, and comment count information.
 * - Secure updating and deletion of posts, restricted to the original author.
 *
 * @dependencies
 * - "@/db/db": The Drizzle ORM database instance.
 * - "@/db/schema": Schemas for posts, votes, and their types.
 * - "@/types": The standardized `ActionState` and forum-specific types.
 * - "@clerk/nextjs/server": For handling user authentication.
 * - "drizzle-orm": For database query functions and operators.
 *
 * @notes
 * - The `createPostAction` uses a transaction to ensure creating a post and the author's initial upvote are an atomic operation.
 */
"use server"

import { db } from "@/db/db"
import {
  postsTable,
  votesTable,
  commentsTable,
  profilesTable,
  InsertPost,
  SelectPost
} from "@/db/schema"
import { ActionState, PostWithAuthorAndVote } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, sql } from "drizzle-orm"

/**
 * Creates a new post, automatically giving it an initial upvote from the author.
 * This operation is transactional.
 * @param data - The data for the new post, including title and content.
 * @returns {Promise<ActionState<SelectPost>>} The state of the action with the newly created post.
 */
export async function createPostAction(
  data: Omit<InsertPost, "userId" | "score">
): Promise<ActionState<SelectPost>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in to post." }
  }

  try {
    const newPost = await db.transaction(async tx => {
      const [post] = await tx
        .insert(postsTable)
        .values({ ...data, userId, score: 1 })
        .returning()

      if (!post) {
        tx.rollback()
        return null
      }

      await tx.insert(votesTable).values({ userId, postId: post.id, value: 1 })
      return post
    })

    if (!newPost) {
      return { isSuccess: false, message: "Failed to create post." }
    }

    return {
      isSuccess: true,
      message: "Post created successfully.",
      data: newPost
    }
  } catch (error) {
    console.error("Error creating post:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Retrieves a single post by its ID, enriched with author and current user's vote information.
 * @param postId - The ID of the post to retrieve.
 * @returns {Promise<ActionState<PostWithAuthorAndVote>>} The state of the action with the enriched post data.
 */
export async function getPostByIdAction(
  postId: string
): Promise<ActionState<PostWithAuthorAndVote>> {
  const { userId } = await auth()

  try {
    const results = await db
      .select({
        post: postsTable,
        author: profilesTable,
        userVote: votesTable,
        commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE ${commentsTable.postId} = ${postsTable.id})`.as(
          "comment_count"
        )
      })
      .from(postsTable)
      .innerJoin(profilesTable, eq(postsTable.userId, profilesTable.userId))
      .leftJoin(
        votesTable,
        and(
          eq(votesTable.postId, postsTable.id),
          userId ? eq(votesTable.userId, userId) : sql`false`
        )
      )
      .where(eq(postsTable.id, postId))

    if (results.length === 0) {
      return { isSuccess: false, message: "Post not found." }
    }

    const { post, author, userVote, commentCount } = results[0]

    const postWithVote: PostWithAuthorAndVote = {
      ...post,
      author,
      userVote: userVote || null,
      commentCount: Number(commentCount) || 0
    }

    return {
      isSuccess: true,
      message: "Post retrieved successfully.",
      data: postWithVote
    }
  } catch (error) {
    console.error("Error retrieving post:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Retrieves a list of posts for the main feed, with sorting and pagination.
 * Includes author info, the current user's vote, and the total comment count for each post.
 * @param params - Parameters for sorting and pagination.
 * @returns {Promise<ActionState<PostWithAuthorAndVote[]>>} The state of the action with the list of enriched posts.
 */
export async function getPostsAction(params: {
  sortBy: "score" | "createdAt"
  limit: number
  offset: number
}): Promise<ActionState<PostWithAuthorAndVote[]>> {
  const { userId } = await auth()
  const { sortBy, limit, offset } = params

  try {
    const results = await db
      .select({
        post: postsTable,
        author: profilesTable,
        userVote: votesTable,
        // Use a scalar subquery to get the comment count for each post.
        commentCount: sql<number>`(SELECT COUNT(*) FROM ${commentsTable} WHERE ${commentsTable.postId} = ${postsTable.id})`.as(
          "comment_count"
        )
      })
      .from(postsTable)
      .innerJoin(profilesTable, eq(postsTable.userId, profilesTable.userId))
      .leftJoin(
        votesTable,
        and(
          eq(votesTable.postId, postsTable.id),
          // Only join votes for the current user if they are logged in.
          userId ? eq(votesTable.userId, userId) : sql`false`
        )
      )
      .orderBy(
        sortBy === "score"
          ? desc(postsTable.score)
          : desc(postsTable.createdAt)
      )
      .limit(limit)
      .offset(offset)

    const postsWithVotes: PostWithAuthorAndVote[] = results.map(row => ({
      ...row.post,
      author: row.author,
      userVote: row.userVote || null,
      commentCount: Number(row.commentCount) || 0
    }))

    return {
      isSuccess: true,
      message: "Posts retrieved successfully.",
      data: postsWithVotes
    }
  } catch (error) {
    console.error("Error retrieving posts:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Updates an existing post. Only the original author can perform this action.
 * @param postId - The ID of the post to update.
 * @param data - The partial data (title, content) to update.
 * @returns {Promise<ActionState<SelectPost>>} The state of the action with the updated post data.
 */
export async function updatePostAction(
  postId: string,
  data: Partial<Omit<InsertPost, "id" | "userId" | "score" | "createdAt">>
): Promise<ActionState<SelectPost>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in." }
  }

  try {
    const post = await db.query.posts.findFirst({
      where: eq(postsTable.id, postId),
      columns: { userId: true }
    })

    if (!post) {
      return { isSuccess: false, message: "Post not found." }
    }

    if (post.userId !== userId) {
      return {
        isSuccess: false,
        message: "You are not authorized to edit this post."
      }
    }

    const [updatedPost] = await db
      .update(postsTable)
      .set(data)
      .where(eq(postsTable.id, postId))
      .returning()

    return {
      isSuccess: true,
      message: "Post updated successfully.",
      data: updatedPost
    }
  } catch (error) {
    console.error("Error updating post:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}

/**
 * Deletes a post. Only the original author can perform this action.
 * @param postId - The ID of the post to delete.
 * @returns {Promise<ActionState<void>>} The state of the action.
 */
export async function deletePostAction(
  postId: string
): Promise<ActionState<void>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in." }
  }

  try {
    const post = await db.query.posts.findFirst({
      where: eq(postsTable.id, postId),
      columns: { userId: true }
    })

    if (!post) {
      return { isSuccess: false, message: "Post not found." }
    }

    if (post.userId !== userId) {
      return {
        isSuccess: false,
        message: "You are not authorized to delete this post."
      }
    }

    await db.delete(postsTable).where(eq(postsTable.id, postId))

    return {
      isSuccess: true,
      message: "Post deleted successfully.",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting post:", error)
    return { isSuccess: false, message: "An unexpected error occurred." }
  }
}