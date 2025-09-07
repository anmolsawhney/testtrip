/**
 * @description
 * Client-side component that renders a list of various notification types.
 * It handles the display logic for each type, such as trip requests, follow requests,
 * and status updates, providing relevant actions like accept, reject, or dismiss.
 * It now renders "accepted match" and "verification outcome" notifications and handles their dismissal.
 * UPDATED: The accepted match notification now displays the user's first name if available, falling back to the username.
 * UPDATED: Now renders verification outcome notifications with appropriate icons and text.
 * FIXED: Corrected a JSX compilation error by renaming a component variable from `verificationIcon` to `VerificationIcon` (PascalCase).
 *
 * @dependencies
 * - react: For state management and component rendering.
 * - next/link: For client-side navigation.
 * - @/components/ui/*: Shadcn UI components (Card, Button, Avatar, etc.).
 * - lucide-react: For icons.
 * - @/actions/db/*: Server actions for follow, trip, and match requests, and verification outcome dismissal.
 * - @/lib/hooks/use-toast: For displaying feedback.
 * - next/navigation: For router refresh.
 * - @/types: For ActionState type.
 * - ../page: For NotificationItem and related types.
 *
 * @notes
 * - Handles dismissal of notifications optimistically for a responsive UI.
 * - Calls `onNotificationDismissed` prop to signal a change in the unread count.
 */
"use client"

import React, { useState } from "react"
import {
  NotificationItem,
  AcceptedFollowNotification,
  LikeNotification,
  LikeOnPostNotification,
  CommentOnPostNotification,
  AcceptedMatchNotification,
  VerificationOutcomeNotification
} from "../page"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  BellRing,
  CheckCircle2,
  Clock,
  Info,
  MailQuestion,
  UserPlus,
  Check,
  Loader2,
  UserCheck,
  Heart,
  MessageSquare,
  ShieldCheck as ShieldCheckIcon,
  XCircle,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import TripRequestNotification from "@/components/groups/trip-request-notification"
import {
  acceptFollowRequestAction,
  rejectFollowRequestAction,
  dismissFollowNotificationAction
} from "@/actions/db/follow-actions"
import { dismissTripRequestNotificationAction } from "@/actions/db/trip-requests-actions"
import { dismissMatchNotificationAction } from "@/actions/db/matches-actions"
import { dismissVerificationOutcomeNotificationAction } from "@/actions/db/notifications-actions"
import { useToast } from "@/lib/hooks/use-toast"
import { useRouter } from "next/navigation"
import { ActionState } from "@/types"

interface NotificationsListProps {
  notifications: NotificationItem[]
  currentUserId: string
  onNotificationDismissed: () => void
}

export function NotificationsList({
  notifications,
  currentUserId,
  onNotificationDismissed
}: NotificationsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [processingFollowRequestId, setProcessingFollowRequestId] = useState<
    string | null
  >(null)
  const [processingDismissalId, setProcessingDismissalId] = useState<
    string | null
  >(null)
  const [dismissedNotificationKeys, setDismissedNotificationKeys] =
    React.useState<Set<string>>(new Set())

  const getNotificationKey = (item: NotificationItem): string => {
    switch (item.type) {
      case "incoming_trip_request":
      case "outgoing_request_status":
        return `tripReq-${item.request.id}`
      case "incoming_follow_request":
        return `followReq-${item.request.followerId}-${item.request.followingId}`
      case "accepted_follow":
        return `followAcc-${item.follow.followerId}-${item.follow.followingId}`
      case "like":
        return `like-${item.like.userId}-${item.like.itineraryId}`
      case "like_on_post":
        return `like-post-${item.like.userId}-${item.like.eventId}`
      case "comment_on_post":
        return `comment-post-${item.comment.id}`
      case "accepted_match":
        return `match-${item.match.id}`
      case "verification_outcome":
        return `verification-${item.timestamp.toISOString()}`
      default:
        const genericTimestamp = (item as any).timestamp
        return `unknown-${genericTimestamp instanceof Date ? genericTimestamp.toISOString() : Math.random()}`
    }
  }

  const activeNotifications = notifications.filter(item => {
    const notificationKey = getNotificationKey(item)
    return !dismissedNotificationKeys.has(notificationKey)
  })

  const formatTimestamp = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "Invalid Date"
    }
    const now = new Date()
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000)
    const diffMinutes = Math.round(diffSeconds / 60)
    const diffHours = Math.round(diffMinutes / 60)
    const diffDays = Math.round(diffHours / 24)

    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const handleFollowRequestAction = async (
    actionType: "accept" | "reject",
    followerId: string
  ) => {
    const requestId = `followReq-${followerId}-${currentUserId}`
    if (
      processingFollowRequestId === requestId ||
      processingDismissalId === requestId
    )
      return

    setProcessingFollowRequestId(requestId)
    const action =
      actionType === "accept"
        ? acceptFollowRequestAction
        : rejectFollowRequestAction

    try {
      const result = await action(followerId, currentUserId)
      if (result.isSuccess) {
        toast({
          title: `Follow Request ${actionType === "accept" ? "Accepted" : "Rejected"}`,
          description: result.message
        })
        setDismissedNotificationKeys(prev => new Set(prev).add(requestId))
        onNotificationDismissed()
        router.refresh()
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : `Failed to ${actionType} follow request.`,
        variant: "destructive"
      })
    } finally {
      setProcessingFollowRequestId(null)
    }
  }

  const handleDismissNotification = async (item: NotificationItem) => {
    const notificationKey = getNotificationKey(item)
    if (
      processingDismissalId === notificationKey ||
      processingFollowRequestId === notificationKey
    )
      return

    setProcessingDismissalId(notificationKey)

    let actionPromise: Promise<ActionState<void>> | null = null

    switch (item.type) {
      case "outgoing_request_status":
        actionPromise = dismissTripRequestNotificationAction(
          item.request.id,
          currentUserId
        )
        break
      case "accepted_follow":
        actionPromise = dismissFollowNotificationAction(
          currentUserId,
          item.follow.followingId
        )
        break
      case "accepted_match":
        actionPromise = dismissMatchNotificationAction(
          item.match.id,
          currentUserId
        )
        break
      case "verification_outcome":
        actionPromise =
          dismissVerificationOutcomeNotificationAction(currentUserId)
        break
      default:
        setProcessingDismissalId(null)
        return
    }

    try {
      if (actionPromise) {
        const result = await actionPromise
        if (result.isSuccess) {
          setDismissedNotificationKeys(prev =>
            new Set(prev).add(notificationKey)
          )
          onNotificationDismissed()
          toast({ title: "Notification Dismissed", duration: 2000 })
        } else {
          throw new Error(result.message || "Failed to dismiss notification.")
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Could not dismiss notification.",
        variant: "destructive"
      })
    } finally {
      setProcessingDismissalId(null)
    }
  }

  const renderNotification = (item: NotificationItem) => {
    const itemKey = getNotificationKey(item)
    const isDismissing = processingDismissalId === itemKey

    switch (item.type) {
      case "incoming_trip_request":
        return (
          <TripRequestNotification
            key={itemKey}
            request={item.request}
            profile={item.requesterProfile}
            tripCurrentSize={item.trip?.currentGroupSize ?? 1}
            tripMaxSize={item.trip?.maxGroupSize ?? null}
            trip={item.trip}
            onRequestProcessed={() => {
              setDismissedNotificationKeys(prev => new Set(prev).add(itemKey))
              onNotificationDismissed()
            }}
          />
        )
      case "outgoing_request_status":
        const { request, trip } = item
        const isAccepted = request.status === "accepted"
        const Icon = isAccepted ? CheckCircle2 : XCircle
        const iconColor = isAccepted ? "text-green-500" : "text-red-500"
        const bgColor = isAccepted ? "bg-green-50" : "bg-red-50"
        const borderColor = isAccepted ? "border-green-200" : "border-red-200"
        const textColor = isAccepted ? "text-green-800" : "text-red-800"

        return (
          <Card
            key={itemKey}
            className={`border ${borderColor} ${bgColor} ${textColor} shadow-sm`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className={`mt-1 size-5 shrink-0 ${iconColor}`} />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">
                      Request {isAccepted ? "Accepted" : "Rejected"}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  {trip ? (
                    <p className="text-sm">
                      Your request to join <strong>{trip.title}</strong> was{" "}
                      {isAccepted ? "accepted!" : "not approved."}
                    </p>
                  ) : (
                    <p className="text-sm">
                      Status update for your join request. Trip details are
                      unavailable.
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`ml-auto size-6 shrink-0 ${iconColor} hover:bg-black/10`}
                  onClick={() => handleDismissNotification(item)}
                  aria-label="Dismiss notification"
                  disabled={isDismissing}
                >
                  {isDismissing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
            {trip && (
              <CardFooter className="flex justify-end bg-white/50 px-4 py-2">
                <Link href={`/trips/${trip.id}`}>
                  <Button variant="ghost" size="sm">
                    View Trip
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      case "incoming_follow_request":
        const followReq = item.request
        const followerProfile = followReq.profile
        const isLoadingFollowAction =
          processingFollowRequestId ===
          `followReq-${followReq.followerId}-${currentUserId}`

        return (
          <Card key={itemKey} className="border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <UserPlus className="mt-1 size-5 shrink-0 text-blue-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">New Follow Request</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={followerProfile?.profilePhoto ?? undefined}
                        alt={followerProfile?.username ?? "User"}
                      />
                      <AvatarFallback>
                        {followerProfile?.username?.charAt(0)?.toUpperCase() ??
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-blue-800">
                      <Link
                        href={`/profile/${followReq.followerId}`}
                        className="font-semibold hover:underline"
                      >
                        {followerProfile?.username ?? "Someone"}
                      </Link>{" "}
                      wants to follow you.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 bg-white/50 px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleFollowRequestAction("reject", followReq.followerId)
                }
                disabled={isLoadingFollowAction}
              >
                {isLoadingFollowAction ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="mr-1 size-4" />
                )}
                Reject
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-1 text-white"
                onClick={() =>
                  handleFollowRequestAction("accept", followReq.followerId)
                }
                disabled={isLoadingFollowAction}
              >
                {isLoadingFollowAction ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="mr-1 size-4" />
                )}
                Accept
              </Button>
            </CardFooter>
          </Card>
        )
      case "accepted_follow":
        const followingProfile = item.followingProfile
        return (
          <Card
            key={itemKey}
            className="border-purple-200 bg-purple-50 shadow-sm"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <UserCheck className="mt-1 size-5 shrink-0 text-purple-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">Follow Request Accepted</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={followingProfile?.profilePhoto ?? undefined}
                        alt={followingProfile?.username ?? "User"}
                      />
                      <AvatarFallback>
                        {followingProfile?.username?.charAt(0)?.toUpperCase() ??
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-purple-800">
                      <Link
                        href={`/profile/${item.follow.followingId}`}
                        className="font-semibold hover:underline"
                      >
                        {followingProfile?.username ?? "User"}
                      </Link>{" "}
                      accepted your follow request.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`ml-auto size-6 shrink-0 text-purple-600 hover:bg-purple-100`}
                  onClick={() => handleDismissNotification(item)}
                  aria-label="Dismiss notification"
                  disabled={isDismissing}
                >
                  {isDismissing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      case "accepted_match":
        const { match, otherUserProfile } = item
        const isMatchDismissing = processingDismissalId === `match-${match.id}`
        const displayName =
          otherUserProfile?.firstName || otherUserProfile?.username

        return (
          <Card
            key={`match-${match.id}`}
            className="border-pink-200 bg-pink-50 shadow-sm"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Heart className="mt-1 size-5 shrink-0 fill-pink-500 text-pink-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">It's a Match!</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={otherUserProfile?.profilePhoto ?? undefined}
                        alt={displayName ?? "User"}
                      />
                      <AvatarFallback>
                        {displayName?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-pink-800">
                      You and{" "}
                      <Link
                        href={`/profile/${otherUserProfile?.userId ?? "#"}`}
                        className="font-semibold hover:underline"
                      >
                        {displayName ?? "another user"}
                      </Link>{" "}
                      are now a match!
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-6 shrink-0 text-pink-600 hover:bg-pink-100"
                  onClick={() => handleDismissNotification(item)}
                  aria-label="Dismiss notification"
                  disabled={isMatchDismissing}
                >
                  {isMatchDismissing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
            {otherUserProfile && (
              <CardFooter className="flex justify-end gap-2 bg-white/50 px-4 py-2">
                <Link href={`/profile/${otherUserProfile.userId}`}>
                  <Button variant="ghost" size="sm">
                    View Profile
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      case "verification_outcome":
        const isApproved = item.status === "verified"
        const VerificationIcon = isApproved ? ShieldCheckIcon : XCircle
        const verificationIconColor = isApproved
          ? "text-green-500"
          : "text-red-500"
        const verificationBgColor = isApproved ? "bg-green-50" : "bg-red-50"
        const verificationBorderColor = isApproved
          ? "border-green-200"
          : "border-red-200"
        const verificationTextColor = isApproved
          ? "text-green-800"
          : "text-red-800"
        return (
          <Card
            key={itemKey}
            className={`border ${verificationBorderColor} ${verificationBgColor} ${verificationTextColor} shadow-sm`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <VerificationIcon
                  className={`mt-1 size-5 shrink-0 ${verificationIconColor}`}
                />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">
                      Identity Verification {isApproved ? "Approved" : "Update"}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm">
                    {isApproved
                      ? "Your identity has been successfully verified! You can now access all features."
                      : "Your identity verification was not approved. Please check the verification page for details and to re-submit."}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`ml-auto size-6 shrink-0 ${verificationIconColor} hover:bg-black/10`}
                  onClick={() => handleDismissNotification(item)}
                  aria-label="Dismiss notification"
                  disabled={isDismissing}
                >
                  {isDismissing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end bg-white/50 px-4 py-2">
              <Link href="/verify-identity">
                <Button variant="ghost" size="sm">
                  {isApproved ? "View Status" : "Go to Verification"}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )
      case "like":
        const likerProfile = item.likerProfile
        const likedTrip = item.trip
        return (
          <Card key={itemKey} className="border-pink-200 bg-pink-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Heart className="mt-1 size-5 shrink-0 fill-pink-500 text-pink-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">New Like</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={likerProfile?.profilePhoto ?? undefined}
                        alt={likerProfile?.username ?? "User"}
                      />
                      <AvatarFallback>
                        {likerProfile?.username?.charAt(0)?.toUpperCase() ??
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-pink-800">
                      <Link
                        href={`/profile/${item.like.userId}`}
                        className="font-semibold hover:underline"
                      >
                        {likerProfile?.username ?? "Someone"}
                      </Link>{" "}
                      liked your trip:{" "}
                      {likedTrip ? (
                        <Link
                          href={`/trips/${likedTrip.id}`}
                          className="font-medium hover:underline"
                        >
                          {likedTrip.title}
                        </Link>
                      ) : (
                        <span className="italic">a trip</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      case "like_on_post": {
        const { likerProfile: postLiker, postEvent } = item
        return (
          <Card key={itemKey} className="border-pink-200 bg-pink-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Heart className="mt-1 size-5 shrink-0 fill-pink-500 text-pink-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">New Like on your post</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={postLiker?.profilePhoto ?? undefined}
                        alt={postLiker?.username ?? "User"}
                      />
                      <AvatarFallback>
                        {postLiker?.username?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-pink-800">
                      <Link
                        href={`/profile/${item.like.userId}`}
                        className="font-semibold hover:underline"
                      >
                        {postLiker?.username ?? "Someone"}
                      </Link>{" "}
                      liked your post.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            {postEvent && (
              <CardFooter className="flex justify-end bg-white/50 px-4 py-2">
                <Link href={`/feed#event-${postEvent.id}`}>
                  <Button variant="ghost" size="sm">
                    View Post
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      }
      case "comment_on_post": {
        const { commenterProfile, comment } = item
        const postEventComment = item.postEvent
        return (
          <Card key={itemKey} className="border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-1 size-5 shrink-0 text-blue-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">New Comment on your post</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={commenterProfile?.profilePhoto ?? undefined}
                        alt={commenterProfile?.username ?? "User"}
                      />
                      <AvatarFallback>
                        {commenterProfile?.username?.charAt(0)?.toUpperCase() ??
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm text-blue-800">
                      <p>
                        <Link
                          href={`/profile/${comment.userId}`}
                          className="font-semibold hover:underline"
                        >
                          {commenterProfile?.username ?? "Someone"}
                        </Link>{" "}
                        commented:
                      </p>
                      <p className="mt-1 italic">"{comment.content}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            {postEventComment && (
              <CardFooter className="flex justify-end bg-white/50 px-4 py-2">
                <Link href={`/feed#event-${postEventComment.id}`}>
                  <Button variant="ghost" size="sm">
                    View Post
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      }
      default:
        const genericTimestamp = (item as any).timestamp
        const formattedTime =
          genericTimestamp instanceof Date
            ? formatTimestamp(genericTimestamp)
            : "Unknown time"
        const defaultKey = `unknown-${Math.random()}`

        return (
          <Card key={defaultKey} className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-1 size-5 shrink-0 text-gray-500" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">Notification</h4>
                    <span className="text-xs text-gray-500">
                      {formattedTime}
                    </span>
                  </div>
                  <p className="text-sm">
                    Received an unknown notification type.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
    }
  }

  if (activeNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <BellRing className="mb-4 size-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">All Caught Up!</h2>
        <p className="mt-2 text-gray-500">You have no new notifications.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeNotifications.map(renderNotification)}
    </div>
  )
}
