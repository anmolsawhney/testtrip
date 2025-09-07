/**
 * @description
 * Enhanced client-side component that renders a swipeable matches feed of user profiles for TripRizz.
 * Displays profiles and manages the stack of potential matches.
 * UPDATED: Implements a 30-minute cooldown period after a user has exhausted all available profiles.
 * The cooldown state is persisted in localStorage to survive page reloads.
 *
 * Key features:
 * - Fetches potential matches on mount and on manual refresh.
 * - Renders the `SwipeCard` component for the top profile in the stack.
 * - Handles the logic for swiping left (rejecting) and right (matching).
 * - Creates a DM conversation and displays an animated match notification modal upon a successful match.
 * - Manages loading, error, empty, and cooldown states gracefully.
 * - Displays a countdown timer during the cooldown period.
 *
 * @dependencies
 * - react: For state, context, and hooks
 * - framer-motion: For animations
 * - "@/components/discovery/swipe-card": Individual swipeable cards
 * - "@/components/discovery/animated-match-modal": The new animated match modal.
 * - "@/actions/db/matches-actions": For fetching potential matches, creating/rejecting matches.
 * - "@/actions/db/direct-message-actions": For creating DM conversations on match.
 * - lucide-react: For icons.
 */
"use client"

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AnimatedMatchModal } from "@/components/discovery/animated-match-modal"
import { SwipeCard } from "@/components/discovery/swipe-card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  getPotentialMatchesAction,
  createMatchAction,
  rejectMatchAction,
  ProfileWithTripsAndMatchScore
} from "@/actions/db/matches-actions"
import { getOrCreateConversationAction } from "@/actions/db/direct-message-actions"
import { useToast } from "@/lib/hooks/use-toast"
import { Clock, RotateCw, Users, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { SelectProfile as DbSelectProfile } from "@/db/schema"

interface MatchesFeedProps {
  userId: string
  viewerProfile: DbSelectProfile | null
}

export function MatchesFeed({ userId, viewerProfile }: MatchesFeedProps) {
  const [profiles, setProfiles] = useState<ProfileWithTripsAndMatchScore[]>([])
  const [currentMatch, setCurrentMatch] =
    useState<ProfileWithTripsAndMatchScore | null>(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  const COOLDOWN_STORAGE_KEY = `triptrizz_matches_cooldown_${userId}`
  const COOLDOWN_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

  const fetchMatches = useCallback(async () => {
    const storedCooldownEnd = localStorage.getItem(COOLDOWN_STORAGE_KEY)
    if (storedCooldownEnd) {
      const endTime = parseInt(storedCooldownEnd, 10)
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime)
        setLoading(false)
        setProfiles([])
        return
      } else {
        localStorage.removeItem(COOLDOWN_STORAGE_KEY)
      }
    }
    setCooldownEndTime(null)

    try {
      setLoading(true)
      setError(null)
      const result = await getPotentialMatchesAction(userId)
      if (result.isSuccess) {
        const data = result.data || []
        setProfiles(data)
        if (data.length === 0) {
          const newCooldownEnd = Date.now() + COOLDOWN_DURATION
          localStorage.setItem(COOLDOWN_STORAGE_KEY, newCooldownEnd.toString())
          setCooldownEndTime(newCooldownEnd)
        }
      } else {
        setError(result.message || "Could not load profiles.")
      }
    } catch (error) {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }, [userId, COOLDOWN_STORAGE_KEY, COOLDOWN_DURATION])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  useEffect(() => {
    if (!cooldownEndTime) {
      setTimeLeft("")
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = cooldownEndTime - now

      if (remaining <= 0) {
        setTimeLeft("")
        setCooldownEndTime(null)
        localStorage.removeItem(COOLDOWN_STORAGE_KEY)
        clearInterval(interval)
      } else {
        const minutes = Math.floor(remaining / 1000 / 60)
        const seconds = Math.floor((remaining / 1000) % 60)
        setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, "0")}s`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [cooldownEndTime, COOLDOWN_STORAGE_KEY])

  const handleSwipe = useCallback(
    async (direction: "left" | "right", swipedUserId: string) => {
      const swipedProfile = profiles.find(p => p.userId === swipedUserId)
      setProfiles(prev => prev.filter(p => p.userId !== swipedUserId))
      if (!swipedProfile) return

      if (direction === "right") {
        try {
          const matchResult = await createMatchAction({
            userId1: userId,
            userId2: swipedUserId,
            initiatedBy: userId,
            status: "pending"
          })
          if (
            matchResult.isSuccess &&
            matchResult.message === "Match accepted"
          ) {
            const convoResult = await getOrCreateConversationAction(
              userId,
              swipedUserId,
              true
            )
            if (convoResult.isSuccess && convoResult.data) {
              setConversationId(convoResult.data.id)
              setCurrentMatch(swipedProfile)
              setShowMatchModal(true)
            } else {
              toast({
                title: "Chat Error",
                description:
                  convoResult.message || "Could not create chat room.",
                variant: "destructive"
              })
            }
          } else if (!matchResult.isSuccess) {
            toast({
              title: "Match Error",
              description: matchResult.message,
              variant: "destructive"
            })
          }
        } catch (error) {
          toast({
            title: "Match Error",
            description: "An unexpected error occurred.",
            variant: "destructive"
          })
        }
      } else {
        await rejectMatchAction(userId, swipedUserId)
      }

      if (profiles.length - 1 === 0) {
        const newCooldownEnd = Date.now() + COOLDOWN_DURATION
        localStorage.setItem(COOLDOWN_STORAGE_KEY, newCooldownEnd.toString())
        setCooldownEndTime(newCooldownEnd)
      }
    },
    [profiles, userId, toast, COOLDOWN_DURATION, COOLDOWN_STORAGE_KEY]
  )

  const currentProfile = profiles.length > 0 ? profiles[0] : null

  return (
    <div className="relative flex h-full flex-col items-center">
      <AnimatedMatchModal
        isOpen={showMatchModal}
        onClose={() => {
          setShowMatchModal(false)
          setCurrentMatch(null)
          setConversationId(null)
        }}
        viewerProfile={viewerProfile}
        matchedProfile={currentMatch}
        conversationId={conversationId}
      />

      <div className="relative mb-6 h-[75vh] w-full max-w-md md:max-w-3xl">
        {loading ? (
          <Skeleton className="absolute inset-0 size-full rounded-xl" />
        ) : error ? (
          <Card className="absolute inset-0 flex size-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-lg">
            <XCircle className="mb-4 size-12 text-red-400" />
            <h3 className="mb-2 text-lg font-semibold text-red-700">
              Loading Failed
            </h3>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <Button onClick={fetchMatches} variant="destructive" size="sm">
              <RotateCw className="mr-2 size-4" /> Try Again
            </Button>
          </Card>
        ) : profiles.length > 0 ? (
          <AnimatePresence>
            {profiles.map((profile, index) =>
              index === 0 ? (
                <SwipeCard
                  key={profile.userId}
                  data={profile}
                  currentUserId={userId}
                  onSwipe={handleSwipe}
                />
              ) : null
            )}
          </AnimatePresence>
        ) : (
          <Card className="absolute inset-0 flex size-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center shadow-sm">
            {cooldownEndTime && timeLeft ? (
              <>
                <Clock className="mb-4 size-12 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-600">
                  All Caught Up!
                </h3>
                <p className="mb-4 max-w-xs text-sm text-gray-500">
                  You've seen everyone for now. New people are joining all the
                  time!
                </p>
                <div className="text-muted-foreground text-sm">
                  Next refresh available in:{" "}
                  <span className="font-semibold text-purple-600">
                    {timeLeft}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Users className="mb-4 size-12 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-600">
                  No More Profiles
                </h3>
                <p className="mb-4 text-sm text-gray-500">
                  Check back later for new potential matches!
                </p>
                <Button
                  onClick={fetchMatches}
                  variant="outline"
                  size="sm"
                  disabled={!!cooldownEndTime}
                >
                  <RotateCw className="mr-2 size-4" /> Refresh
                </Button>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
