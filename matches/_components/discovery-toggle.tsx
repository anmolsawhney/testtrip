"use client"

/**
 * @description
 * Client component for showing profile discovery in TripRizz.
 * Simplified to only show profiles (no toggle between profiles and trips).
 * **DEPRECATED**: Use `matches-feed.tsx` instead.
 * FIXED: Updated state to use `ProfileWithTripsAndMatchScore` type.
 *
 * Key features:
 * - Loads profile data for the discovery feed
 * - Displays profiles in a swipeable interface
 * - Handles loading and error states
 *
 * @dependencies
 * - "react": For component state and effects
 * - "@/components/discovery/discovery-feed": For rendering the swiping cards
 * - "@/actions/db/matches-actions": For fetching profile matches and `ProfileWithTripsAndMatchScore` type.
 * - "@/components/ui/card": For layout
 * - "@/components/ui/button": For UI elements
 * - "next/navigation": For router
 *
 * @notes
 * - This component is deprecated. Use `matches-feed.tsx`.
 * - Fetches data on component mount
 * - Provides loading states while data is being fetched
 * - Error handling for failed data fetching
 */

import { useState, useEffect } from "react"
import { DiscoveryFeed } from "@/components/discovery/discovery-feed"
import {
  getPotentialMatchesAction,
  ProfileWithTripsAndMatchScore
} from "@/actions/db/matches-actions"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface DiscoveryToggleProps {
  userId: string
}

export function DiscoveryToggle({ userId }: DiscoveryToggleProps) {
  const [profiles, setProfiles] = useState<ProfileWithTripsAndMatchScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  console.warn(
    "DiscoveryToggle component in /matches is deprecated. Use MatchesFeed."
  ) // Added warning

  // Fetch profile data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await getPotentialMatchesAction(userId)
        if (result.isSuccess) {
          setProfiles(result.data || [])
        } else {
          setError(result.message || "Failed to load profiles")
        }
      } catch (err) {
        console.error("Error fetching discovery data:", err)
        setError("Something went wrong. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId])

  // Handle error state
  if (error) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-red-500">{error}</p>
        <Button onClick={() => router.refresh()}>Try Again</Button>
      </Card>
    )
  }

  // Handle loading state
  if (loading) {
    return (
      <div className="mx-auto flex h-[600px] w-full max-w-md items-center justify-center rounded-lg bg-gray-200">
        <p>Loading profiles...</p>
      </div>
    )
  }

  // Handle empty state
  if (profiles.length === 0) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="text-muted-foreground mb-4">
          No profiles to discover. Check back later!
        </p>
      </Card>
    )
  }

  return <DiscoveryFeed initialData={profiles} userId={userId} />
}
