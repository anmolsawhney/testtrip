/**
 * @description
 * Server actions for managing "likes" on activity feed events (posts).
 * Provides functionality to add/remove likes and atomically update the event's like count.
 *
 * Key features:
 * - Toggle Like: Adds or removes a like for a user on a feed event, atomically updating the event's like count.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (activityFeedLikesTable, activityFeedEventsTable).
 * - "@/types": ActionState type definition.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations (eq, and, sql).
 *
 * @notes
 * - All actions are server-side only (`"use server"`).
 * - Uses `ActionState` for consistent return structure.
 * - `toggleLikeOnActivityEventAction` uses a database transaction for atomicity.
 * - Authorization checks ensure users are logged in.
 */
"use server"

import { db } from "@/db/db"
import {
  activityFeedLikesTable,
  activityFeedEventsTable
} from "@/db/schema"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, eq, sql } from "drizzle-orm"
// import { createNotificationAction } from "./notifications-actions"; // Will be used for notifications

export async function toggleLikeOnActivityEventAction(
  eventId: string
): Promise<ActionState<{ liked: boolean; newCount: number }>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." }
  }
  if (!eventId) {
    return { isSuccess: false, message: "Event ID is required." }
  }

  try {
    const result = await db.transaction(async tx => {
      const existingLike = await tx.query.activityFeedLikes.findFirst({
        where: and(
          eq(activityFeedLikesTable.userId, userId),
          eq(activityFeedLikesTable.eventId, eventId)
        )
      })

      let liked: boolean
      let updatedCountResult: { like_count: number }[]

      if (existingLike) {
        // Unlike
        await tx
          .delete(activityFeedLikesTable)
          .where(
            and(
              eq(activityFeedLikesTable.userId, userId),
              eq(activityFeedLikesTable.eventId, eventId)
            )
          )
        updatedCountResult = await tx
          .update(activityFeedEventsTable)
          .set({
            like_count: sql`GREATEST(0, ${activityFeedEventsTable.like_count} - 1)`
          })
          .where(eq(activityFeedEventsTable.id, eventId))
          .returning({ like_count: activityFeedEventsTable.like_count })
        liked = false
      } else {
        // Like
        await tx.insert(activityFeedLikesTable).values({ userId, eventId })
        updatedCountResult = await tx
          .update(activityFeedEventsTable)
          .set({
            like_count: sql`${activityFeedEventsTable.like_count} + 1`
          })
          .where(eq(activityFeedEventsTable.id, eventId))
          .returning({ like_count: activityFeedEventsTable.like_count })
        liked = true

        // TODO: Create notification for the post owner
        // const event = await tx.query.activityFeedEvents.findFirst({
        //     where: eq(activityFeedEventsTable.id, eventId),
        //     columns: { userId: true }
        // });
        // if (event && event.userId !== userId) {
        //     await createNotificationAction({
        //         userId: event.userId, // The user who owns the post
        //         type: 'like_on_post',
        //         relatedId: eventId,
        //         actorId: userId // The user who liked the post
        //     });
        // }
      }

      if (updatedCountResult.length === 0) {
        throw new Error("Failed to update event like count.")
      }
      return { liked, newCount: updatedCountResult[0].like_count }
    })

    return {
      isSuccess: true,
      message: result.liked ? "Post liked." : "Like removed.",
      data: result
    }
  } catch (error) {
    console.error("[Action toggleLikeOnActivityEvent] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to toggle like on post."
    }
  }
}