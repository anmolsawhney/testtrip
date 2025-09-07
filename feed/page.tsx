/**
 * @description
 * Server component page for the user's Activity Feed.
 * Handles authentication and fetches initial feed data using a nested async component (`FeedFetcher`)
 * within a Suspense boundary. Displays the main feed interface rendered by the client component.
 * UPDATED: Added top padding `pt-24` to ensure content appears below the fixed top navigation bar.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication (`auth`).
 * - next/navigation: For redirection (`redirect`).
 * - @/actions/db/activity-feed-actions: Server action to fetch feed data (`getActivityFeedAction`).
 * - @/types: For `FeedActivityItem` type definition.
 * - ./_components/activity-feed: Client component to render the interactive feed.
 * - ./_components/feed-skeleton: Skeleton component for loading state.
 */
"use server"

import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { getActivityFeedAction } from "@/actions/db/activity-feed-actions"
import ActivityFeed from "./_components/activity-feed"
import FeedSkeleton from "./_components/feed-skeleton"
import { FeedActivityItem } from "@/types"

const INITIAL_FEED_LIMIT = 15 // Number of items to fetch initially

/**
 * Async component specifically for fetching initial feed data.
 * This allows the main page component to render instantly while data fetching occurs within Suspense.
 * @param userId - The ID of the current user.
 */
async function FeedFetcher({ userId }: { userId: string }) {
  // Fetch initial activities (defaulting to 'following')
  const initialActivityResult = await getActivityFeedAction(
    "following", // Default filter
    INITIAL_FEED_LIMIT,
    0 // Initial offset
  )

  const initialActivities: FeedActivityItem[] =
    initialActivityResult.isSuccess && initialActivityResult.data
      ? initialActivityResult.data
      : []

  if (!initialActivityResult.isSuccess) {
    console.error(
      "[FeedPage Fetcher] Failed to load initial activities:",
      initialActivityResult.message
    )
    // Optionally render an error message, or let ActivityFeed handle empty state
  }

  return (
    <ActivityFeed
      initialActivities={initialActivities}
      userId={userId}
      initialHasMore={initialActivities.length === INITIAL_FEED_LIMIT} // Check if there might be more
    />
  )
}

/**
 * The main server component for the /feed page.
 */
export default async function ActivityFeedPage() {
  const { userId } = await auth()

  // Redirect if user is not logged in
  if (!userId) {
    const params = new URLSearchParams({ redirect_url: "/feed" })
    redirect(`/login?${params.toString()}`)
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 pb-8 pt-24">
      <h1 className="mb-6 text-center text-3xl font-bold">Activity Feed</h1>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedFetcher userId={userId} />
      </Suspense>
    </div>
  )
}
