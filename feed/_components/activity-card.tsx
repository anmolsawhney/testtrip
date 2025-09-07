/**
 * @description
 * Client component that renders a single activity item within the Activity Feed
 * in a style resembling a social media post (e.g., Facebook, Instagram feed item).
 * Displays different content and layouts based on the type of activity.
 * The Like and Comment actions are only displayed on the 'following' feed.
 * UPDATED: Replaced all instances of `displayName` with `username`.
 *
 * Key features:
 * - Post-like structure using Card components.
 * - Standard header with avatar, username, timestamp, and verification badge.
 * - Content area dynamically renders based on activity type.
 * - Conditional Like and Comment buttons with counts, visible only on the 'following' feed.
 * - Clickable links to user profiles and related trips/reviews.
 *
 * @dependencies
 * - react, next/link, date-fns, lucide-react, @/lib/utils, @/lib/hooks/use-toast
 * - @/types: For the `FeedActivityItem` type definition.
 * - @/components/ui/*: Shadcn UI components (Card, Button, Avatar, Badge, Tooltip).
 * - @/actions/db/activity-feed-likes-actions: For liking/unliking posts.
 * - ./comment-section: Component to display and add comments.
 */
"use client"

import React, { useState } from "react"
import Link from "next/link"
import { formatDistanceToNowStrict, format } from "date-fns"
import { FeedActivityItem } from "@/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  CalendarDays,
  Star,
  MessageSquare,
  Heart,
  Loader2,
  ShieldCheck
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toggleLikeOnActivityEventAction } from "@/actions/db/activity-feed-likes-actions"
import { useToast } from "@/lib/hooks/use-toast"
import CommentSection from "./comments-section"

const formatTimeAgo = (date: Date | string | null | undefined): string => {
  if (!date) return ""
  try {
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return ""
    return formatDistanceToNowStrict(dateObj, { addSuffix: true })
  } catch (e) {
    console.error("Error formatting date:", e)
    return ""
  }
}

const formatDateRange = (
  start?: Date | string | null,
  end?: Date | string | null
): string => {
  try {
    const startDate = start ? new Date(start) : null
    const endDate = end ? new Date(end) : null
    const isStartDateValid = startDate && !isNaN(startDate.getTime())
    const isEndDateValid = endDate && !isNaN(endDate.getTime())

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric"
    }

    if (isStartDateValid && isEndDateValid) {
      const startStr = startDate.toLocaleDateString("en-US", formatOptions)
      if (startDate.toDateString() === endDate.toDateString()) return startStr
      const endStr = endDate.toLocaleDateString("en-US", formatOptions)
      return `${startStr} - ${endStr}`
    } else if (isStartDateValid)
      return startDate.toLocaleDateString("en-US", formatOptions)
    else if (isEndDateValid)
      return `Until ${endDate.toLocaleDateString("en-US", formatOptions)}`
    return ""
  } catch (e) {
    console.error("Error formatting date range:", start, end, e)
    return ""
  }
}

const getUserInitials = (name?: string | null): string => {
  return name ? name.charAt(0).toUpperCase() : "?"
}

interface ActivityCardProps {
  activity: FeedActivityItem
  filter: "following" | "my_activity"
}

export default function ActivityCard({ activity, filter }: ActivityCardProps) {
  const { event, user } = activity
  const { toast } = useToast()

  const [isLiked, setIsLiked] = useState(event.isLikedByCurrentUser ?? false)
  const [likeCount, setLikeCount] = useState(event.like_count ?? 0)
  const [isLiking, setIsLiking] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(event.comment_count ?? 0)

  const timestamp = event.createdAt
  const userName = user?.username ?? "User"
  const userProfileLink = `/profile/${user?.userId ?? ""}`
  const userAvatarUrl = user?.profilePhoto ?? undefined
  const isIdVerified = user?.verificationStatus === "verified"

  const handleToggleLike = async () => {
    if (isLiking) return
    setIsLiking(true)

    const originalLikedState = isLiked
    const originalLikeCount = likeCount

    setIsLiked(!isLiked)
    setLikeCount(prev => (isLiked ? prev - 1 : prev + 1))

    try {
      const result = await toggleLikeOnActivityEventAction(event.id)
      if (!result.isSuccess) {
        setIsLiked(originalLikedState)
        setLikeCount(originalLikeCount)
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      } else {
        setIsLiked(result.data.liked)
        setLikeCount(result.data.newCount)
      }
    } catch (error) {
      setIsLiked(originalLikedState)
      setLikeCount(originalLikeCount)
      toast({
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive"
      })
    } finally {
      setIsLiking(false)
    }
  }

  const handleCommentAdded = () => {
    setCommentCount(prev => prev + 1)
  }

  const handleCommentDeleted = () => {
    setCommentCount(prev => (prev > 0 ? prev - 1 : 0))
  }

  const renderContent = () => {
    switch (activity.eventType) {
      case "new_trip":
      case "joined_trip":
      case "left_trip": {
        const trip = activity.relatedTrip
        let actionText = "created a new trip"
        if (activity.eventType === "joined_trip") actionText = "joined the trip"
        if (activity.eventType === "left_trip") actionText = "left the trip"

        const formattedDates = formatDateRange(trip?.startDate, trip?.endDate)
        const bannerImageUrl =
          trip?.cover_photo_url || trip?.photos?.[0] || null

        return (
          <div className="space-y-2">
            <p>
              <Link
                href={userProfileLink}
                className="font-semibold hover:underline"
              >
                {userName}
              </Link>{" "}
              {actionText}:{" "}
              {trip ? (
                <Link
                  href={`/trips/${trip.id}`}
                  className="font-medium text-purple-600 hover:underline"
                >
                  {trip.title}
                </Link>
              ) : (
                <span className="italic text-gray-500">[Trip Deleted]</span>
              )}
            </p>
            {trip && (
              <div className="text-muted-foreground space-y-1 text-sm">
                {trip.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    <span>{trip.location}</span>
                  </div>
                )}
                {formattedDates && (
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    <span>{formattedDates}</span>
                  </div>
                )}
              </div>
            )}
            {bannerImageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border">
                <Link href={`/trips/${trip?.id ?? "#"}`}>
                  <img
                    src={bannerImageUrl}
                    alt={`Banner for ${trip?.title ?? "trip"}`}
                    className="aspect-video w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                    loading="lazy"
                  />
                </Link>
              </div>
            )}
          </div>
        )
      }
      case "new_photo": {
        const photo = activity.relatedPhoto
        const trip = activity.relatedTrip
        const tripLink = trip ? `/trips/${trip.id}/photos` : "#"
        const photoAlt =
          photo?.caption ||
          (trip ? `Photo from ${trip.title}` : `Photo by ${userName}`)

        return (
          <div className="space-y-2">
            <p>
              <Link
                href={userProfileLink}
                className="font-semibold hover:underline"
              >
                {userName}
              </Link>{" "}
              added a new photo {trip ? "to " : ""}
              {trip && (
                <Link
                  href={`/trips/${trip.id}`}
                  className="font-medium text-purple-600 hover:underline"
                >
                  {trip.title}
                </Link>
              )}
            </p>
            {photo?.photoUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border">
                <Link href={tripLink}>
                  <img
                    src={photo.photoUrl}
                    alt={photoAlt}
                    className="aspect-video w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                    loading="lazy"
                  />
                </Link>
              </div>
            )}
            {photo?.caption && (
              <p className="text-muted-foreground pt-1 text-sm italic">
                "{photo.caption}"
              </p>
            )}
          </div>
        )
      }
      case "new_review": {
        const review = activity.relatedReview
        const trip = activity.relatedTrip
        return (
          <div className="space-y-2">
            <p>
              <Link
                href={userProfileLink}
                className="font-semibold hover:underline"
              >
                {userName}
              </Link>{" "}
              reviewed the trip:{" "}
              {trip ? (
                <Link
                  href={`/trips/${trip.id}/reviews`}
                  className="font-medium text-purple-600 hover:underline"
                >
                  {trip.title}
                </Link>
              ) : (
                <span className="italic text-gray-500">[Trip Deleted]</span>
              )}
            </p>
            {review && (
              <div className="mt-2 rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
                <div className="mb-1 flex items-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={cn(
                        "size-4",
                        review.rating >= star
                          ? "fill-yellow-400 text-yellow-500"
                          : "fill-gray-300 text-gray-300"
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs font-semibold">
                    ({review.rating})
                  </span>
                </div>
                <p className="line-clamp-3 italic">"{review.content}"</p>
              </div>
            )}
          </div>
        )
      }
      case "follow": {
        const followedUser = activity.targetUser
        return (
          <p>
            <Link
              href={userProfileLink}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {" started following "}
            {followedUser ? (
              <Link
                href={`/profile/${followedUser.userId}`}
                className="font-semibold hover:underline"
              >
                {followedUser.username ?? "another user"}
              </Link>
            ) : (
              <span className="italic text-gray-500">[User Deleted]</span>
            )}
            .
          </p>
        )
      }
      default:
        console.warn(
          "Rendering unknown activity type:",
          (activity as any)?.eventType
        )
        return (
          <p>
            <Link
              href={userProfileLink}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>{" "}
            performed an action.
          </p>
        )
    }
  }

  return (
    <Card className="w-full overflow-hidden shadow-sm" id={`event-${event.id}`}>
      <CardHeader className="flex flex-row items-center space-x-3 p-3">
        <Link href={userProfileLink}>
          <Avatar className="size-10 border">
            <AvatarImage src={userAvatarUrl} alt={userName} />
            <AvatarFallback>{getUserInitials(userName)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <Link
              href={userProfileLink}
              className="text-sm font-semibold hover:underline"
            >
              {userName}
            </Link>
            {isIdVerified && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className="border-blue-300 bg-blue-100 p-1 text-blue-800">
                      <ShieldCheck className="size-3.5" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Identity Verified</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {formatTimeAgo(timestamp)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 text-sm">{renderContent()}</CardContent>

      {filter === "following" && (
        <>
          <CardFooter className="flex items-center justify-between border-t px-3 py-2">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground flex items-center gap-1.5"
                onClick={handleToggleLike}
                disabled={isLiking}
              >
                {isLiking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Heart
                    className={cn(
                      "size-4",
                      isLiked && "fill-red-500 text-red-500"
                    )}
                  />
                )}
                <span>{likeCount}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground flex items-center gap-1.5"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="size-4" />
                <span>{commentCount}</span>
              </Button>
            </div>
          </CardFooter>
          {showComments && (
            <CommentSection
              eventId={event.id}
              onCommentAdded={handleCommentAdded}
              onCommentDeleted={handleCommentDeleted}
            />
          )}
        </>
      )}
    </Card>
  )
}
