/**
 * @description
 * Displays individual trip cards in the TripRizz feed/grid.
 * Provides a rich visual presentation of trip details with interactive elements
 * for viewing details, joining trips, liking, wishlisting, messaging the creator, and sharing.
 * Displays the trip creator's name and links to their profile.
 * Uses Flaticon icons for general info and Lucide icons for actions.
 * CORRECTED: Restructured "View Details" button to avoid `asChild` error.
 * UPDATED: Dynamically calculates and displays trip status (Upcoming, Ongoing, Completed, Cancelled) based on dates.
 * FIXED: Re-added missing JoinButtonStateType definition.
 * UPDATED: Added a "Share" button that opens a modal to share the trip with mutual followers.
 * UPDATED: Added loading spinners to the Like, Wishlist, and Message buttons to indicate progress during API calls.
 * UPDATED: Explicitly hides the "Join Trip" button for trips with `tripType` of 'solo'.
 * OPTIMIZED: Removed internal `useEffect` for fetching like/wishlist status. It now receives this data as props (`isLiked`, `isWishlisted`) to prevent N+1 API calls.
 *
 * Key features:
 * - Visual presentation with trip image, title, and key details.
 * - Displays trip creator's username with link.
 * - Interactive buttons for viewing, joining, liking, wishlisting, DMing, and sharing trips.
 * - Join button is hidden for solo trips.
 * - Join button state handling (pending requests, membership, full, owner, etc.).
 * - Like/Wishlist button state handling with optimistic updates and loading spinners.
 * - Direct Message button to initiate chat with the creator.
 * - Share button to open a share modal.
 * - Displays like count.
 * - Displays dynamic trip status badge.
 *
 * @dependencies
 * - react, next/navigation, @clerk/nextjs, lucide-react, @/actions/db/*, @/lib/utils, @/lib/hooks/use-toast, @/types, ./share-modal, next/link, date-fns
 */
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Heart,
  Bookmark,
  Crown,
  Check,
  MessageSquare,
  Loader2,
  Clock,
  XCircle,
  UserPlus,
  User,
  Send
} from "lucide-react"
import { SelectFilteredItinerary } from "@/actions/db/trips-actions"
import {
  toggleLikeAction,
  isItineraryLikedAction
} from "@/actions/db/like-actions"
import {
  toggleWishlistAction,
  isItineraryWishlistedAction
} from "@/actions/db/wishlist-actions"
import { getOrCreateConversationAction } from "@/actions/db/direct-message-actions"
import { useToast } from "@/lib/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO, isValid, isFuture, isPast, isToday } from "date-fns"
import { ShareModal } from "@/components/trips/share-modal"

type JoinButtonStateType =
  | "JOIN"
  | "REQUEST_SENT"
  | "JOINED"
  | "FULL"
  | "OWNER"
  | "LOGIN_REQUIRED"
  | "NONE"

interface TripCardProps {
  trip: SelectFilteredItinerary
  userId: string | null | undefined
  onView: (tripId: string) => void
  onJoin?: (tripId: string) => void
  isMember?: boolean
  isRequestPending?: boolean
  isLiked?: boolean
  isWishlisted?: boolean
}

const parseSafeDate = (
  dateInput: string | Date | null | undefined
): Date | null => {
  if (!dateInput) return null
  if (dateInput instanceof Date) {
    return isValid(dateInput) ? dateInput : null
  }
  try {
    const parsed = parseISO(String(dateInput))
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

const getDisplayStatus = (
  tripStatus: string,
  startDateInput?: Date | string | null,
  endDateInput?: Date | string | null
): {
  text: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className: string
} => {
  const startDate = parseSafeDate(startDateInput)
  const endDate = parseSafeDate(endDateInput)

  if (tripStatus === "cancelled") {
    return {
      text: "Cancelled",
      variant: "destructive",
      className: "border-red-200 bg-red-100 text-red-800"
    }
  }
  if (tripStatus === "completed") {
    return {
      text: "Completed",
      variant: "default",
      className: "border-blue-200 bg-blue-100 text-blue-800"
    }
  }

  if (startDate && isFuture(startDate)) {
    return {
      text: "Upcoming",
      variant: "outline",
      className: "border-yellow-300 bg-yellow-100 text-yellow-800"
    }
  }
  if (startDate && (isPast(startDate) || isToday(startDate))) {
    if (!endDate || isFuture(endDate) || isToday(endDate)) {
      return {
        text: "Ongoing",
        variant: "secondary",
        className: "border-green-200 bg-green-100 text-green-800"
      }
    }
  }
  if (endDate && isPast(endDate)) {
    return {
      text: "Completed",
      variant: "default",
      className: "border-blue-200 bg-blue-100 text-blue-800"
    }
  }

  const defaultText = tripStatus.charAt(0).toUpperCase() + tripStatus.slice(1)
  return {
    text: defaultText,
    variant: "outline",
    className: "border-gray-300 bg-gray-100 text-gray-800"
  }
}

export function TripCard({
  trip,
  userId,
  onView,
  onJoin,
  isMember,
  isRequestPending,
  isLiked: initialIsLiked,
  isWishlisted: initialIsWishlisted
}: TripCardProps) {
  const { toast } = useToast()
  const router = useRouter()
  // Initialize state from props
  const [isLiked, setIsLiked] = useState(initialIsLiked ?? false)
  const [likeCount, setLikeCount] = useState(trip.like_count ?? 0)
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted ?? false)
  // Loading states for individual actions
  const [loadingLike, setLoadingLike] = useState(false)
  const [loadingWishlist, setLoadingWishlist] = useState(false)
  const [loadingDM, setLoadingDM] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const isOwner = !!userId && userId === trip.creatorId
  const creatorProfile = trip.creatorProfile

  // OPTIMIZATION: Removed useEffect for fetching like/wishlist status.
  // The state is now initialized directly from props.
  // This effect ensures the state updates if the props change (e.g., due to a filter change).
  useEffect(() => {
    setIsLiked(initialIsLiked ?? false)
    setIsWishlisted(initialIsWishlisted ?? false)
    setLikeCount(trip.like_count ?? 0)
  }, [initialIsLiked, initialIsWishlisted, trip.like_count])

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId || loadingLike || isOwner) return
    setLoadingLike(true)
    const originalLikedState = isLiked
    const originalLikeCount = likeCount
    setIsLiked(!originalLikedState)
    setLikeCount(prev => (originalLikedState ? prev - 1 : prev + 1))
    try {
      const result = await toggleLikeAction(trip.id)
      if (result.isSuccess) {
        setIsLiked(result.data.liked)
        setLikeCount(result.data.newCount)
      } else {
        setIsLiked(originalLikedState)
        setLikeCount(originalLikeCount)
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      setIsLiked(originalLikedState)
      setLikeCount(originalLikeCount)
      toast({
        title: "Error",
        description: "Could not update like status.",
        variant: "destructive"
      })
    } finally {
      setLoadingLike(false)
    }
  }

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId || loadingWishlist || isOwner) return
    setLoadingWishlist(true)
    const originalWishlistedState = isWishlisted
    setIsWishlisted(!originalWishlistedState)
    try {
      const result = await toggleWishlistAction(trip.id)
      if (!result.isSuccess) {
        setIsWishlisted(originalWishlistedState)
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      } else {
        setIsWishlisted(result.data.wishlisted)
      }
    } catch (error) {
      setIsWishlisted(originalWishlistedState)
      toast({
        title: "Error",
        description: "Could not update wishlist.",
        variant: "destructive"
      })
    } finally {
      setLoadingWishlist(false)
    }
  }

  const handleDirectMessage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId || loadingDM || isOwner) return
    setLoadingDM(true)
    try {
      const result = await getOrCreateConversationAction(
        userId,
        trip.creatorId,
        true
      )
      if (result.isSuccess && result.data?.id) {
        router.push(`/chat/${result.data.id}`)
      } else {
        toast({
          title: "Error",
          description: result.message || "Could not start conversation.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while starting the chat.",
        variant: "destructive"
      })
    } finally {
      setLoadingDM(false)
    }
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) return
    setIsShareModalOpen(true)
  }

  const displayStatus = getDisplayStatus(
    trip.status,
    trip.startDate,
    trip.endDate
  )
  const isEffectivelyCompleted =
    displayStatus.text === "Completed" || displayStatus.text === "Cancelled"

  const isGroupTrip =
    trip.tripType === "group" || trip.tripType === "women_only"
  const canAccommodate =
    !trip.maxGroupSize || (trip.currentGroupSize ?? 0) < trip.maxGroupSize
  const currentIsMember = isMember ?? false
  const currentIsRequestPending = isRequestPending ?? false

  let joinButtonStateLocal: JoinButtonStateType = "NONE"
  let joinButtonDisabled = true

  if (isGroupTrip && !isEffectivelyCompleted) {
    if (!userId) {
      joinButtonStateLocal = "LOGIN_REQUIRED"
    } else if (isOwner) {
      joinButtonStateLocal = "OWNER"
    } else if (currentIsMember) {
      joinButtonStateLocal = "JOINED"
    } else if (currentIsRequestPending) {
      joinButtonStateLocal = "REQUEST_SENT"
    } else if (!canAccommodate) {
      joinButtonStateLocal = "FULL"
    } else {
      joinButtonStateLocal = "JOIN"
      joinButtonDisabled = false
    }
  } else if (!isGroupTrip) {
    joinButtonStateLocal = "NONE"
  } else {
    joinButtonStateLocal = "NONE"
  }

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (joinButtonDisabled && joinButtonStateLocal !== "LOGIN_REQUIRED") return
    if (joinButtonStateLocal === "LOGIN_REQUIRED") {
      router.push(`/login?redirect_url=/trips/${trip.id}`)
    } else if (joinButtonStateLocal === "JOIN" && onJoin) {
      onJoin(trip.id)
    }
  }

  const formatDateRangeDisplay = (
    start?: Date | string | null,
    end?: Date | string | null
  ): string => {
    const startDate = parseSafeDate(start)
    const endDate = parseSafeDate(end)
    const formatOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric"
    }

    if (startDate && endDate) {
      const startStr = format(startDate, "MMM d")
      if (startDate.toDateString() === endDate.toDateString()) return startStr
      const endStr = format(endDate, "MMM d")
      return `${startStr} - ${endStr}`
    } else if (startDate) return format(startDate, "MMM d")
    else if (endDate) return `Until ${format(endDate, "MMM d")}`
    return "Dates flexible"
  }

  const coverPhoto = trip.cover_photo_url || trip.photos?.[0] || null

  return (
    <>
      <Card
        className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
        onClick={() => onView(trip.id)}
      >
        <div className="relative h-48 shrink-0">
          {isOwner && (
            <Badge
              variant="secondary"
              className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
            >
              <Crown className="mr-1 size-3 fill-yellow-400 text-yellow-400" />
              Your Trip
            </Badge>
          )}
          <Badge
            variant={displayStatus.variant}
            className={cn(
              "absolute right-2 top-2 z-10 rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm",
              displayStatus.className
            )}
          >
            {displayStatus.text}
          </Badge>

          {userId && !isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-10 z-10 size-8 rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
              onClick={handleToggleWishlist}
              disabled={loadingWishlist}
              aria-label={
                isWishlisted ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              {loadingWishlist ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bookmark
                  className={cn(
                    "size-4 transition-all",
                    isWishlisted ? "fill-white" : "fill-transparent"
                  )}
                />
              )}
            </Button>
          )}
          {!imageError && coverPhoto ? (
            <img
              src={coverPhoto}
              alt={trip.title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
              <span className="text-sm font-medium text-gray-500">
                No image
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="pointer-events-none absolute inset-x-3 bottom-2">
            <h3 className="truncate text-lg font-semibold text-white [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]">
              {trip.title}
            </h3>
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col justify-between p-4">
          <div className="mb-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-700">
                <i className="fi fi-rr-land-layer-location text-muted-foreground mr-2 shrink-0 text-base"></i>
                <span className="truncate">
                  {trip.location || "Location TBD"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1 px-1 py-0 text-gray-600 hover:bg-transparent hover:text-red-500 disabled:opacity-50"
                  onClick={handleToggleLike}
                  disabled={!userId || loadingLike || isOwner}
                  aria-label={isLiked ? "Unlike trip" : "Like trip"}
                >
                  {loadingLike ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Heart
                      className={cn(
                        "size-4 transition-all",
                        isLiked ? "fill-red-500 text-red-500" : "text-gray-500"
                      )}
                    />
                  )}
                </Button>
                <span className="text-xs font-medium">{likeCount}</span>
              </div>
            </div>
            <div className="flex items-center text-gray-700">
              <i className="fi fi-rr-calendar text-muted-foreground mr-2 shrink-0 text-base"></i>
              <span>
                {formatDateRangeDisplay(trip.startDate, trip.endDate)}
              </span>
            </div>
            {creatorProfile && (
              <div className="flex items-center text-gray-700">
                <User className="mr-2 size-4 shrink-0 text-purple-500" />
                <span className="text-xs">By:</span>
                <Link
                  href={`/profile/${creatorProfile.userId}`}
                  onClick={e => e.stopPropagation()}
                  className="ml-1 truncate text-xs font-medium text-purple-700 hover:underline"
                >
                  {creatorProfile.username || "User"}
                </Link>
              </div>
            )}
            {isGroupTrip && (
              <div className="flex items-center text-gray-700">
                <i className="fi fi-rr-users text-muted-foreground mr-2 shrink-0 text-base"></i>
                <span>
                  {trip.currentGroupSize ?? 0} / {trip.maxGroupSize || "Any"}
                  travellers
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto flex gap-2 border-t border-gray-100 pt-3">
            {userId && !isOwner && creatorProfile && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-none border-gray-300 px-2.5 text-gray-600"
                onClick={handleDirectMessage}
                disabled={loadingDM}
                aria-label="Message trip creator"
              >
                {loadingDM ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
              </Button>
            )}

            {userId && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-none border-gray-300 px-2.5 text-gray-600"
                onClick={handleShareClick}
                aria-label="Share trip"
              >
                <Send className="size-4" />
              </Button>
            )}

            <Link
              href={`/trips/${trip.id}`}
              onClick={e => e.stopPropagation()}
              className="flex-1"
            >
              <Button
                className="w-full border-gray-300 text-gray-800 hover:bg-gray-50"
                variant="outline"
                size="sm"
              >
                View Details
              </Button>
            </Link>

            {trip.tripType !== "solo" && joinButtonStateLocal !== "NONE" && (
              <Button
                onClick={handleJoinClick}
                className={`flex-1 ${joinButtonStateLocal === "JOIN" ? "bg-gradient-1 text-white hover:opacity-90" : ""}`}
                variant={
                  joinButtonStateLocal === "JOIN" ? "default" : "outline"
                }
                size="sm"
                disabled={joinButtonDisabled}
              >
                {joinButtonStateLocal === "JOINED" && (
                  <Check className="mr-1 size-4" />
                )}
                {joinButtonStateLocal === "REQUEST_SENT" && (
                  <Clock className="mr-1 size-4" />
                )}
                {joinButtonStateLocal === "FULL" && (
                  <XCircle className="mr-1 size-4" />
                )}
                {joinButtonStateLocal === "OWNER" && (
                  <Crown className="mr-1 size-4" />
                )}
                {joinButtonStateLocal === "JOIN" && (
                  <UserPlus className="mr-1 size-4" />
                )}
                {joinButtonStateLocal === "JOIN"
                  ? "Join Trip"
                  : joinButtonStateLocal === "REQUEST_SENT"
                    ? "Request Sent"
                    : joinButtonStateLocal === "JOINED"
                      ? "Joined"
                      : joinButtonStateLocal === "FULL"
                        ? "Trip Full"
                        : joinButtonStateLocal === "OWNER"
                          ? "Your Trip"
                          : "Login to Join"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {userId && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          trip={trip}
        />
      )}
    </>
  )
}
