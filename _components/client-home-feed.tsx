/**
 * @description
 * Client-side component for the TripRizz home feed that integrates with the new filtering system.
 * It extracts filter parameters from the URL and either displays the main trip feed or, for
 * women-only trips, a verification prompt for non-verified female users.
 * FIXED: Replaced boolean variable check with an inline conditional to fix a TypeScript type-narrowing error.
 *
 * Key features:
 * - Reads all filter parameters from URL (including maxBudget, preference, sortBy).
 * - Passes filter values to HomeFeed component.
 * - Conditionally renders a verification prompt for women-only trips if the user is female but not yet verified.
 * - Handles filter parameter changes dynamically.
 *
 * @dependencies
 * - "next/navigation": For accessing URL parameters
 * - "react": For hooks and state
 * - @/app/_components/home-feed: Server component for trip data
 * - @clerk/nextjs: For user authentication
 * - @/types: For SelectProfile type.
 * - ./women-only-verification-prompt: New component for showing verification prompt.
 *
 * @notes
 * - Marked as "use client" to access browser APIs (searchParams).
 * - Acts as a bridge between URL parameters and server-side data fetching or conditional UI.
 */
"use client"

import { useSearchParams } from "next/navigation"
import { HomeFeed } from "@/app/_components/home-feed"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { SelectProfile } from "@/types"
import { WomenOnlyVerificationPrompt } from "./women-only-verification-prompt"

interface TripFilters {
  tripType: string | null
  maxBudget: number | null
  minGroupSize: number | null
  maxGroupSize: number | null
  startDate: string | null
  endDate: string | null
  location: string | null
  tripPreferences: string[]
  status: "upcoming" | "ongoing" | "completed" | null
  visibility: string | null
  sortBy?: "createdAt" | "likes" | "startDate"
}

interface ClientHomeFeedProps {
  profile: SelectProfile | null
}

export function ClientHomeFeed({ profile }: ClientHomeFeedProps) {
  const searchParams = useSearchParams()
  const { userId } = useAuth()
  const [filters, setFilters] = useState<TripFilters>({
    tripType: null,
    maxBudget: null,
    minGroupSize: null,
    maxGroupSize: null,
    startDate: null,
    endDate: null,
    location: null,
    tripPreferences: [],
    status: null,
    visibility: null,
    sortBy: undefined
  })

  useEffect(() => {
    const parseIntOrNull = (value: string | null): number | null => {
      if (value === null) return null
      const parsed = parseInt(value, 10)
      return isNaN(parsed) ? null : parsed
    }

    const parseStatus = (value: string | null): TripFilters["status"] => {
      if (
        value === "upcoming" ||
        value === "ongoing" ||
        value === "completed"
      ) {
        return value
      }
      return null
    }

    const parseSortBy = (value: string | null): TripFilters["sortBy"] => {
      if (value === "createdAt" || value === "likes" || value === "startDate") {
        return value
      }
      return undefined
    }

    setFilters({
      tripType: searchParams.get("tripType"),
      maxBudget: parseIntOrNull(searchParams.get("maxBudget")),
      minGroupSize: parseIntOrNull(searchParams.get("minGroupSize")),
      maxGroupSize: parseIntOrNull(searchParams.get("maxGroupSize")),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      location: searchParams.get("location"),
      tripPreferences: searchParams.getAll("preference") || [],
      status: parseStatus(searchParams.get("status")),
      visibility: searchParams.get("visibility"),
      sortBy: parseSortBy(searchParams.get("sortBy"))
    })
  }, [searchParams])

  const tripType = searchParams.get("tripType")

  // --- NEW LOGIC FOR WOMEN-ONLY TRIPS (with inline check for type narrowing) ---
  if (
    profile &&
    tripType === "women_only" &&
    profile.gender === "female" &&
    profile.verificationStatus !== "verified"
  ) {
    return <WomenOnlyVerificationPrompt status={profile.verificationStatus} />
  }
  // --- END NEW LOGIC ---

  return <HomeFeed filters={filters} userId={userId} />
}
