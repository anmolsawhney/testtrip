"use server"

/**
 * @description
 * Server-side component that fetches and provides initial data for the TripRizz discovery feed.
 * Fetches potential matches including their compatibility scores.
 * FIXED: Updated the component to use the correct `ProfileWithTripsAndMatchScore` type to resolve the TypeScript error.
 *
 * Key features:
 * - Fetches potential matches (profiles) with match scores.
 * - Passes initial data to the client-side DiscoveryFeed component.
 * - Handles authentication and error states.
 * - Uses Suspense-ready async data fetching.
 *
 * @dependencies
 * - "@/actions/db/matches-actions": For fetching potential matches and for the `ProfileWithTripsAndMatchScore` type.
 * - "@/components/discovery/discovery-feed": Client-side feed component.
 * - "react": For server components and rendering.
 *
 * @notes
 * - Requires user authentication via Clerk.
 * - Returns null or empty data if fetch fails.
 * - Fetches profile data including match percentage to match the component's expectations.
 */

import { DiscoveryFeed } from "@/components/discovery/discovery-feed"
import {
  getPotentialMatchesAction,
  ProfileWithTripsAndMatchScore
} from "@/actions/db/matches-actions"

interface DiscoveryFeedFetcherProps {
  userId: string
}

export default async function DiscoveryFeedFetcher({
  userId
}: DiscoveryFeedFetcherProps) {
  console.log("DiscoveryFeedFetcher loaded successfully") // Debugging log
  let initialData: ProfileWithTripsAndMatchScore[] = [] // Use the correct, richer type

  try {
    // Fetch potential matches (profiles)
    const matchesResult = await getPotentialMatchesAction(userId)
    if (matchesResult.isSuccess && matchesResult.data) {
      initialData = matchesResult.data // Assign the data directly, no need for casting
    }
  } catch (error) {
    console.error(`Error fetching profiles for user ${userId}:`, error)
  }

  return <DiscoveryFeed initialData={initialData} userId={userId} />
}
