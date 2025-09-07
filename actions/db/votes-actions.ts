/**
 * @description
 * Server action for handling all voting logic in the Riffle forum application.
 * This file contains a single, robust, and transactional action to manage upvotes
 * and downvotes for both posts and comments.
 *
 * Key features:
 * - A single `voteAction` handles creating, updating, and deleting votes.
 * - All database operations are wrapped in a transaction to ensure atomicity and data consistency.
 * - Atomically updates the `score` on the corresponding post or comment.
 * - Handles all voting scenarios: new vote, changing a vote, and removing a vote.
 *
 * @dependencies
 * - "@/db/db": The Drizzle ORM database instance.
 * - "@/db/schema": Schemas for posts, comments, votes, and their types.
 * - "@/types": The standardized `ActionState` type.
 * - "@clerk/nextjs/server": For handling user authentication.
 * - "drizzle-orm": For database query functions, operators, and the `sql` helper.
 *
 * @notes
 * - This action is designed to be the single source of truth for all voting interactions.
 * - It returns the new score of the voted item, which can be used for optimistic UI updates on the client.
 */
"use server"

import { db } from "@/db/db"
import { commentsTable, postsTable, votesTable } from "@/db/schema"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, eq, sql } from "drizzle-orm"

interface VoteActionParams {
  votableId: string
  votableType: "post" | "comment"
  value: 1 | -1
}

/**
 * Handles casting a vote on a post or a comment. This action is transactional.
 * It finds any existing vote by the user on the item and calculates the score change.
 * It then inserts, updates, or deletes the vote record and atomically updates the score
 * on the corresponding post or comment.
 * @param params - The parameters for the vote action, including the item ID, type, and vote value.
 * @returns {Promise<ActionState<{ newScore: number }>>} The state of the action, containing the new score of the item.
 */
export async function voteAction(
  params: VoteActionParams
): Promise<ActionState<{ newScore: number }>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "You must be logged in to vote." }
  }

  const { votableId, votableType, value } = params

  try {
    const { newScore } = await db.transaction(async tx => {
      const targetTable = votableType === "post" ? postsTable : commentsTable
      const foreignKeyColumn =
        votableType === "post" ? votesTable.postId : votesTable.commentId

      // FIX: Use an if/else block to call the specific query builder, resolving TypeScript ambiguity.
      let item
      if (votableType === "post") {
        item = await tx.query.posts.findFirst({
          where: eq(targetTable.id, votableId),
          columns: { score: true }
        })
      } else {
        item = await tx.query.comments.findFirst({
          where: eq(targetTable.id, votableId),
          columns: { score: true }
        })
      }

      if (!item) {
        throw new Error(
          `${votableType.charAt(0).toUpperCase() + votableType.slice(1)} not found.`
        )
      }

      const existingVote = await tx.query.votes.findFirst({
        where: and(
          eq(votesTable.userId, userId),
          eq(foreignKeyColumn, votableId)
        )
      })

      let scoreChange = 0

      if (!existingVote) {
        scoreChange = value
        await tx.insert(votesTable).values({
          userId,
          [votableType === "post" ? "postId" : "commentId"]: votableId,
          value
        })
      } else if (existingVote.value === value) {
        scoreChange = -value
        await tx.delete(votesTable).where(eq(votesTable.id, existingVote.id))
      } else {
        scoreChange = 2 * value
        await tx
          .update(votesTable)
          .set({ value })
          .where(eq(votesTable.id, existingVote.id))
      }

      const [updatedItem] = await tx
        .update(targetTable)
        .set({
          score: sql`${targetTable.score} + ${scoreChange}`
        })
        .where(eq(targetTable.id, votableId))
        .returning({ newScore: targetTable.score })

      if (!updatedItem) {
        throw new Error(`Failed to update ${votableType} score.`)
      }

      return { newScore: updatedItem.newScore }
    })

    return {
      isSuccess: true,
      message: "Vote cast successfully.",
      data: { newScore }
    }
  } catch (error) {
    console.error("Error casting vote:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while casting your vote."
    }
  }
}