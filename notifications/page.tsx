/**
 * @description
 * Server component page for displaying all user notifications.
 * Fetches and aggregates various notification types (trip requests, follow requests, likes, comments, matches, verification outcomes)
 * and passes them to a client component for rendering. It is now aligned with the counter logic.
 * UPDATED: The `AcceptedMatchNotification` type now includes `username`, `firstName`, and `lastName` to provide correct user details to the notification list.
 * UPDATED: Now filters out notifications from soft-deleted users by checking profile fetch results.
 * FIXED: Refactored the new matches processing loop and database query to avoid a TypeScript `never` type inference error.
 * UPDATED: Added top padding `pt-24` to ensure content appears below the fixed top navigation bar.
 * UPDATED: Now fetches and displays verification outcome notifications.
 *
 * @dependencies
 * - @clerk/nextjs/server: For authentication.
 * - next/navigation: For redirection.
 * - react: For Suspense.
 * - @/actions/db/*: Server actions for fetching notification-related data.
 * - ./_components/notification-loader: Client component to render the notification list and mark as read.
 * - @/db/schema": For all necessary database type definitions.
 *
 * @notes
 * - This component is responsible for fetching ALL data required by the notification list.
 * - It defines the various `NotificationItem` types that the client component will render.
 * - All data fetching is done concurrently using `Promise.allSettled` for efficiency.
 */
"use server"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getTripRequestsAction } from "@/actions/db/trip-requests-actions"
import {
  getUserTripsAction,
  getTripByIdAction
} from "@/actions/db/trips-actions"
import { getProfileByUserIdAction } from "@/actions/db/profiles-actions"
import { getFollowRequestsAction } from "@/actions/db/follow-actions"
import { NotificationLoader } from "./_components/notification-loader"
import {
  SelectItinerary,
  SelectTripRequest,
  SelectProfile,
  SelectFollow,
  SelectLike,
  SelectMatch,
  followsTable,
  profilesTable,
  itinerariesTable,
  likesTable,
  matchesTable,
  activityFeedLikesTable,
  activityFeedCommentsTable,
  activityFeedEventsTable
} from "@/db/schema"
import { FollowRequest } from "@/types"
import { db } from "@/db/db"
import {
  eq,
  like,
  and,
  or,
  gt,
  desc,
  ne,
  inArray,
  not,
  isNotNull
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

// --- Define Notification Data Types ---
export interface IncomingRequestNotification {
  type: "incoming_trip_request"
  timestamp: Date
  request: SelectTripRequest
  requesterProfile: SelectProfile | null
  trip: SelectItinerary | null
}
export interface OutgoingRequestStatusNotification {
  type: "outgoing_request_status"
  timestamp: Date
  request: SelectTripRequest
  trip: SelectItinerary | null
}
export interface IncomingFollowRequestNotification {
  type: "incoming_follow_request"
  timestamp: Date
  request: FollowRequest
}
export interface AcceptedFollowNotification {
  type: "accepted_follow"
  timestamp: Date
  follow: SelectFollow
  followingProfile: SelectProfile | null
}
export interface LikeNotification {
  type: "like"
  timestamp: Date
  like: SelectLike
  likerProfile: SelectProfile | null
  trip: { id: string; title: string } | null
}
export interface LikeOnPostNotification {
  type: "like_on_post"
  timestamp: Date
  like: { eventId: string; userId: string }
  likerProfile: SelectProfile | null
  postEvent: { id: string; eventType: string; eventData: any } | null
}
export interface CommentOnPostNotification {
  type: "comment_on_post"
  timestamp: Date
  comment: { id: string; eventId: string; userId: string; content: string }
  commenterProfile: SelectProfile | null
  postEvent: { id: string; eventType: string; eventData: any } | null
}

export interface AcceptedMatchNotification {
  type: "accepted_match"
  timestamp: Date
  match: SelectMatch
  otherUserProfile: {
    userId: string
    username: string | null
    firstName: string | null
    lastName: string | null
    profilePhoto: string | null
  } | null
}

// NEW Notification Type for Verification Outcomes
export interface VerificationOutcomeNotification {
  type: "verification_outcome"
  timestamp: Date
  status: "verified" | "rejected"
}

export type NotificationItem =
  | IncomingRequestNotification
  | OutgoingRequestStatusNotification
  | IncomingFollowRequestNotification
  | AcceptedFollowNotification
  | LikeNotification
  | LikeOnPostNotification
  | CommentOnPostNotification
  | AcceptedMatchNotification
  | VerificationOutcomeNotification // Add new type to the union

function NotificationsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}

async function fetchNotificationsData(
  userId: string
): Promise<NotificationItem[]> {
  const allNotifications: NotificationItem[] = []
  const profile = await db.query.profiles.findFirst({
    where: eq(profilesTable.userId, userId),
    columns: {
      lastCheckedNotificationsAt: true,
      verificationStatus: true,
      verificationOutcomeNotifiedAt: true,
      verificationOutcomeDismissed: true
    }
  })
  const lastChecked = profile?.lastCheckedNotificationsAt ?? new Date(0)

  // --- NEW: Check for Verification Outcome Notification ---
  if (
    profile?.verificationOutcomeNotifiedAt &&
    !profile.verificationOutcomeDismissed
  ) {
    allNotifications.push({
      type: "verification_outcome",
      timestamp: profile.verificationOutcomeNotifiedAt,
      status: profile.verificationStatus as "verified" | "rejected" // Assuming status is set
    })
  }
  // --- END NEW ---

  const user1 = alias(profilesTable, "user1")
  const user2 = alias(profilesTable, "user2")

  const [
    ownerTripsResult,
    outgoingRequestsResult,
    incomingFollowRequestsResult,
    acceptedFollowsRawResult,
    newLikesResult,
    newPostLikesResult,
    newPostCommentsResult,
    newMatchesResult
  ] = await Promise.allSettled([
    getUserTripsAction(userId),
    getTripRequestsAction({
      userId: userId,
      status: ["accepted", "rejected"],
      isDismissed: false
    }),
    getFollowRequestsAction(userId, "incoming"),
    db
      .select({
        follow: followsTable,
        followingProfile: profilesTable
      })
      .from(followsTable)
      .innerJoin(
        profilesTable,
        and(
          eq(followsTable.followingId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        )
      )
      .where(
        and(
          eq(followsTable.followerId, userId),
          eq(followsTable.status, "accepted"),
          eq(followsTable.isDismissedByFollower, false)
        )
      )
      .orderBy(desc(followsTable.updatedAt)),
    db
      .select({
        like: likesTable,
        liker: profilesTable,
        trip: {
          id: itinerariesTable.id,
          title: itinerariesTable.title
        }
      })
      .from(likesTable)
      .innerJoin(
        itinerariesTable,
        eq(likesTable.itineraryId, itinerariesTable.id)
      )
      .innerJoin(
        profilesTable,
        and(
          eq(likesTable.userId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        )
      )
      .where(
        and(
          eq(itinerariesTable.creatorId, userId),
          ne(likesTable.userId, userId)
        )
      )
      .orderBy(desc(likesTable.createdAt)),
    db
      .select({
        like: activityFeedLikesTable,
        liker: profilesTable,
        event: activityFeedEventsTable
      })
      .from(activityFeedLikesTable)
      .innerJoin(
        activityFeedEventsTable,
        eq(activityFeedLikesTable.eventId, activityFeedEventsTable.id)
      )
      .innerJoin(
        profilesTable,
        and(
          eq(activityFeedLikesTable.userId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        )
      )
      .where(
        and(
          eq(activityFeedEventsTable.userId, userId),
          ne(activityFeedLikesTable.userId, userId)
        )
      )
      .orderBy(desc(activityFeedLikesTable.createdAt)),
    db
      .select({
        comment: activityFeedCommentsTable,
        commenter: profilesTable,
        event: activityFeedEventsTable
      })
      .from(activityFeedCommentsTable)
      .innerJoin(
        activityFeedEventsTable,
        eq(activityFeedCommentsTable.eventId, activityFeedEventsTable.id)
      )
      .innerJoin(
        profilesTable,
        and(
          eq(activityFeedCommentsTable.userId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        )
      )
      .where(
        and(
          eq(activityFeedEventsTable.userId, userId),
          ne(activityFeedCommentsTable.userId, userId)
        )
      )
      .orderBy(desc(activityFeedCommentsTable.createdAt)),
    db
      .select({
        match: matchesTable,
        user1: {
          userId: user1.userId,
          username: user1.username,
          firstName: user1.firstName,
          lastName: user1.lastName,
          profilePhoto: user1.profilePhoto
        },
        user2: {
          userId: user2.userId,
          username: user2.username,
          firstName: user2.firstName,
          lastName: user2.lastName,
          profilePhoto: user2.profilePhoto
        }
      })
      .from(matchesTable)
      .innerJoin(user1, eq(matchesTable.userId1, user1.userId))
      .innerJoin(user2, eq(matchesTable.userId2, user2.userId))
      .where(
        and(
          eq(matchesTable.status, "accepted"),
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
      .orderBy(desc(matchesTable.updatedAt))
  ])

  if (
    ownerTripsResult.status === "fulfilled" &&
    ownerTripsResult.value.isSuccess &&
    ownerTripsResult.value.data
  ) {
    const ownerTripIds = ownerTripsResult.value.data.map(trip => trip.id)
    if (ownerTripIds.length > 0) {
      const incomingTripRequestsResult = await getTripRequestsAction({
        status: "pending"
      })
      if (
        incomingTripRequestsResult.isSuccess &&
        incomingTripRequestsResult.data
      ) {
        const relevantIncomingTripRequests =
          incomingTripRequestsResult.data.filter(req =>
            ownerTripIds.includes(req.tripId)
          )
        await Promise.all(
          relevantIncomingTripRequests.map(async request => {
            try {
              const [profileResult, tripResult] = await Promise.all([
                getProfileByUserIdAction(request.userId, userId),
                getTripByIdAction(request.tripId)
              ])
              if (profileResult.isSuccess && profileResult.data) {
                allNotifications.push({
                  type: "incoming_trip_request",
                  timestamp: request.createdAt,
                  request: request,
                  requesterProfile: profileResult.data,
                  trip: tripResult.isSuccess ? tripResult.data : null
                })
              }
            } catch (fetchDetailError) {}
          })
        )
      }
    }
  }

  if (
    outgoingRequestsResult.status === "fulfilled" &&
    outgoingRequestsResult.value.isSuccess &&
    outgoingRequestsResult.value.data
  ) {
    await Promise.all(
      outgoingRequestsResult.value.data.map(async request => {
        if (request.updatedAt > lastChecked) {
          try {
            const tripResult = await getTripByIdAction(request.tripId)
            allNotifications.push({
              type: "outgoing_request_status",
              timestamp: request.updatedAt,
              request: request,
              trip: tripResult.isSuccess ? tripResult.data : null
            })
          } catch (fetchDetailError) {}
        }
      })
    )
  }

  if (
    incomingFollowRequestsResult.status === "fulfilled" &&
    incomingFollowRequestsResult.value.isSuccess &&
    incomingFollowRequestsResult.value.data
  ) {
    incomingFollowRequestsResult.value.data.forEach(followRequest => {
      if (followRequest.createdAt > lastChecked) {
        allNotifications.push({
          type: "incoming_follow_request",
          timestamp: followRequest.createdAt,
          request: followRequest
        })
      }
    })
  }

  if (acceptedFollowsRawResult.status === "fulfilled") {
    acceptedFollowsRawResult.value.forEach(result => {
      if (result.follow.updatedAt > lastChecked) {
        allNotifications.push({
          type: "accepted_follow",
          timestamp: result.follow.updatedAt,
          follow: result.follow,
          followingProfile: result.followingProfile
        })
      }
    })
  }

  if (newLikesResult.status === "fulfilled") {
    newLikesResult.value.forEach(result => {
      if (result.like.createdAt > lastChecked) {
        allNotifications.push({
          type: "like",
          timestamp: result.like.createdAt,
          like: result.like,
          likerProfile: result.liker,
          trip: result.trip
        })
      }
    })
  }

  if (newPostLikesResult.status === "fulfilled") {
    newPostLikesResult.value.forEach(result => {
      if (result.like.createdAt > lastChecked) {
        allNotifications.push({
          type: "like_on_post",
          timestamp: result.like.createdAt,
          like: { eventId: result.like.eventId, userId: result.like.userId },
          likerProfile: result.liker,
          postEvent: result.event
            ? {
                id: result.event.id,
                eventType: result.event.eventType,
                eventData: result.event.eventData
              }
            : null
        })
      }
    })
  }

  if (newPostCommentsResult.status === "fulfilled") {
    newPostCommentsResult.value.forEach(result => {
      if (result.comment.createdAt > lastChecked) {
        allNotifications.push({
          type: "comment_on_post",
          timestamp: result.comment.createdAt,
          comment: result.comment,
          commenterProfile: result.commenter,
          postEvent: result.event
            ? {
                id: result.event.id,
                eventType: result.event.eventType,
                eventData: result.event.eventData
              }
            : null
        })
      }
    })
  }

  if (newMatchesResult.status === "fulfilled" && newMatchesResult.value) {
    for (const result of newMatchesResult.value) {
      const match = result.match
      let otherUser: typeof result.user1 | null = null

      if (match.userId1 === userId) {
        otherUser = result.user2
      } else if (match.userId2 === userId) {
        otherUser = result.user1
      }
      if (otherUser && match.updatedAt > lastChecked) {
        allNotifications.push({
          type: "accepted_match",
          timestamp: match.updatedAt,
          match: match,
          otherUserProfile: otherUser
        })
      }
    }
  }

  allNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return allNotifications
}

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) {
    const params = new URLSearchParams({ redirect_url: "/notifications" })
    redirect(`/login?${params.toString()}`)
  }

  const initialNotifications = await fetchNotificationsData(userId)

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-8 pt-24">
      <h1 className="mb-6 text-3xl font-bold">Notifications</h1>
      <Suspense fallback={<NotificationsPageSkeleton />}>
        <NotificationLoader
          userId={userId}
          initialNotifications={initialNotifications}
        />
      </Suspense>
    </div>
  )
}
