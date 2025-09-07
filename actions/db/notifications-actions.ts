/**
 * @description
 * Server actions related to user notifications in the TripRizz application.
 * Provides functionality to get the count of unread notifications and mark them as read.
 * Unread count considers pending incoming trip requests, non-dismissed outgoing trip request
 * status updates, pending incoming follow requests, non-dismissed accepted follow notifications,
 * new likes on the user's trips, new accepted matches, and verification outcomes.
 * UPDATED: Added logic to count un-dismissed verification outcome notifications.
 * UPDATED: Added `dismissVerificationOutcomeNotificationAction` to allow users to dismiss these notifications.
 *
 * Key features:
 * - Get Unread Count: Accurately calculates the number of notifications newer than the user's last check time.
 * - Mark as Read: Updates the user's profile to set the last checked time to now.
 * - Dismiss Verification Notification: Allows a specific notification type to be dismissed.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": Definition for the `ActionState` return type.
 * - "drizzle-orm": Core Drizzle ORM functions for query building.
 *
 * @notes
 * - Uses `lastCheckedNotificationsAt` timestamp on the profile to determine new notifications.
 * - Counts various request, follow, like, match, and system events.
 */
"use server"

import { db } from "@/db/db"
import { ActionState } from "@/types"
import {
  and,
  eq,
  gt,
  ne,
  inArray,
  or,
  isNotNull,
  sql,
  count
} from "drizzle-orm"
import {
  profilesTable,
  tripRequestsTable,
  itinerariesTable,
  followsTable,
  likesTable,
  matchesTable,
  activityFeedLikesTable,
  activityFeedCommentsTable,
  activityFeedEventsTable
} from "@/db/schema"
import { auth } from "@clerk/nextjs/server"

export async function getUnreadNotificationCountAction(
  userId: string
): Promise<ActionState<number>> {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId),
      columns: {
        lastCheckedNotificationsAt: true,
        verificationOutcomeNotifiedAt: true,
        verificationOutcomeDismissed: true
      }
    })
    const lastChecked = profile?.lastCheckedNotificationsAt ?? new Date(0)
    console.log(
      `[getUnreadCount] User ${userId}, lastChecked: ${lastChecked.toISOString()}`
    )

    const ownedTrips = await db
      .select({ id: itinerariesTable.id })
      .from(itinerariesTable)
      .where(eq(itinerariesTable.creatorId, userId))
    const ownedTripIds = ownedTrips.map(t => t.id)

    const promises = []

    // --- Verification Outcome ---
    if (
      profile?.verificationOutcomeNotifiedAt &&
      profile.verificationOutcomeNotifiedAt > lastChecked &&
      !profile.verificationOutcomeDismissed
    ) {
      promises.push(Promise.resolve([{ value: 1 }]))
    } else {
      promises.push(Promise.resolve([{ value: 0 }]))
    }

    if (ownedTripIds.length > 0) {
      promises.push(
        db
          .select({ value: count() })
          .from(tripRequestsTable)
          .where(
            and(
              inArray(tripRequestsTable.tripId, ownedTripIds),
              eq(tripRequestsTable.status, "pending"),
              gt(tripRequestsTable.createdAt, lastChecked)
            )
          )
      )
    } else {
      promises.push(Promise.resolve([{ value: 0 }]))
    }

    promises.push(
      db
        .select({ value: count() })
        .from(tripRequestsTable)
        .where(
          and(
            eq(tripRequestsTable.userId, userId),
            or(
              eq(tripRequestsTable.status, "accepted"),
              eq(tripRequestsTable.status, "rejected")
            ),
            gt(tripRequestsTable.updatedAt, lastChecked),
            eq(tripRequestsTable.isDismissed, false)
          )
        )
    )

    promises.push(
      db
        .select({ value: count() })
        .from(followsTable)
        .where(
          and(
            eq(followsTable.followingId, userId),
            eq(followsTable.status, "pending"),
            gt(followsTable.createdAt, lastChecked)
          )
        )
    )

    promises.push(
      db
        .select({ value: count() })
        .from(followsTable)
        .where(
          and(
            eq(followsTable.followerId, userId),
            eq(followsTable.status, "accepted"),
            eq(followsTable.isDismissedByFollower, false),
            gt(followsTable.updatedAt, lastChecked)
          )
        )
    )

    if (ownedTripIds.length > 0) {
      promises.push(
        db
          .select({ value: count() })
          .from(likesTable)
          .where(
            and(
              inArray(likesTable.itineraryId, ownedTripIds),
              ne(likesTable.userId, userId),
              gt(likesTable.createdAt, lastChecked)
            )
          )
      )
    } else {
      promises.push(Promise.resolve([{ value: 0 }]))
    }

    promises.push(
      db
        .select({ value: count() })
        .from(matchesTable)
        .where(
          and(
            eq(matchesTable.status, "accepted"),
            gt(matchesTable.updatedAt, lastChecked),
            or(
              and(
                eq(matchesTable.userId1, userId),
                eq(matchesTable.isDismissedByUser1, false)
              ),
              and(
                eq(matchesTable.userId2, userId),
                eq(matchesTable.isDismissedByUser2, false)
              )
            )
          )
        )
    )

    const ownedEvents = await db
      .select({ id: activityFeedEventsTable.id })
      .from(activityFeedEventsTable)
      .where(eq(activityFeedEventsTable.userId, userId))
    const ownedEventIds = ownedEvents.map(e => e.id)
    if (ownedEventIds.length > 0) {
      promises.push(
        db
          .select({ value: count() })
          .from(activityFeedLikesTable)
          .where(
            and(
              inArray(activityFeedLikesTable.eventId, ownedEventIds),
              ne(activityFeedLikesTable.userId, userId),
              gt(activityFeedLikesTable.createdAt, lastChecked)
            )
          )
      )
      promises.push(
        db
          .select({ value: count() })
          .from(activityFeedCommentsTable)
          .where(
            and(
              inArray(activityFeedCommentsTable.eventId, ownedEventIds),
              ne(activityFeedCommentsTable.userId, userId),
              gt(activityFeedCommentsTable.createdAt, lastChecked)
            )
          )
      )
    } else {
      promises.push(Promise.resolve([{ value: 0 }]))
      promises.push(Promise.resolve([{ value: 0 }]))
    }

    const results = await Promise.all(promises)
    const totalUnread = results.reduce(
      (sum, result) => sum + (result[0]?.value ?? 0),
      0
    )

    console.log(
      `[getUnreadCount] Total unread for user ${userId}: ${totalUnread}`
    )

    return {
      isSuccess: true,
      message: "Unread count fetched.",
      data: totalUnread
    }
  } catch (error) {
    console.error("Error getting unread notification count:", error)
    return {
      isSuccess: false,
      message: "Failed to get unread notification count."
    }
  }
}

export async function markNotificationsAsReadAction(
  userId: string
): Promise<ActionState<void>> {
  try {
    const now = new Date()
    console.log(
      `[markNotificationsAsRead] Updating lastChecked for user ${userId} to ${now.toISOString()}`
    )
    const result = await db
      .update(profilesTable)
      .set({ lastCheckedNotificationsAt: now })
      .where(eq(profilesTable.userId, userId))
      .returning({ id: profilesTable.userId })

    if (result.length === 0) {
      console.warn(
        `[markNotificationsAsRead] Profile not found for user ${userId}. Could not mark as read.`
      )
    }

    return {
      isSuccess: true,
      message: "Notifications marked as read.",
      data: undefined
    }
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    return {
      isSuccess: false,
      message: "Failed to mark notifications as read."
    }
  }
}

/**
 * Marks a user's verification outcome notification as dismissed.
 * @param userId The ID of the user dismissing the notification.
 * @returns ActionState indicating success or failure.
 */
export async function dismissVerificationOutcomeNotificationAction(
  userId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== userId) {
    return { isSuccess: false, message: "Unauthorized." }
  }
  try {
    await db
      .update(profilesTable)
      .set({ verificationOutcomeDismissed: true })
      .where(eq(profilesTable.userId, userId))

    return {
      isSuccess: true,
      message: "Verification notification dismissed.",
      data: undefined
    }
  } catch (error) {
    console.error("Error dismissing verification notification:", error)
    return {
      isSuccess: false,
      message: "Failed to dismiss verification notification."
    }
  }
}