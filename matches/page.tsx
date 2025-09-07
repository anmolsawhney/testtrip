/**
 * @description
 * Server-side page component for the TripRizz matches route (/matches).
 * This page is now titled "Find your trizzer" with an eye-catching font
 * and shows a swipe-based layout for profile discovery.
 * Access is gated based on profile question completion.
 * UPDATED: Fetches the current user's profile and passes it down to the `MatchesFeed` to support the animated match modal.
 * UPDATED: Added top padding `pt-24` to ensure content is not obscured by the fixed top navigation bar.
 *
 * Key features:
 * - Updated "Find your trizzer" title with custom font and gradient.
 * - Swipe card UI with heart/cross buttons for matching.
 * - Checks if user has completed profile questions before showing matches.
 * - Fetches viewer's profile to be used in the match animation.
 *
 * @dependencies
 * - "@clerk/nextjs/server": For authentication via Clerk
 * - "@/components/discovery/error-boundary": For client-side error boundary handling
 * - "react": For Suspense and loading states
 * - "./_components/matches-feed": For displaying profile cards
 * - "@/actions/db/profiles-actions": For fetching user profile data.
 * - "@/components/ui/*": For UI components (Skeleton, Button, Card).
 * - "next/link": For linking to profile edit.
 *
 * @notes
 * - Requires user authentication; redirects unauthenticated users via middleware
 * - Uses Suspense for async data fetching with a fallback loading state
 * - Shows only profiles for matching.
 * - Prompts user to complete profile if questions are unanswered.
 */

"use server"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { getProfileByUserIdAction } from "@/actions/db/profiles-actions" // Import profile action
import { DiscoveryErrorBoundary } from "@/components/discovery/error-boundary"
import { MatchesFeed } from "./_components/matches-feed"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // Import Card components
import { Button } from "@/components/ui/button"
import { Edit3 } from "lucide-react" // Import icon for prompt

// Skeleton component for loading state (remains the same)
function MatchesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-12 w-full" />
      <div className="mx-auto h-[600px] w-full max-w-md rounded-lg bg-gray-200"></div>
    </div>
  )
}

/**
 * Async component to fetch user profile and conditionally render matches or prompt.
 */
async function MatchesPageContentFetcher({ userId }: { userId: string }) {
  const profileResult = await getProfileByUserIdAction(userId)

  if (!profileResult.isSuccess || !profileResult.data) {
    // Handle case where profile fetch fails, maybe allow access? Or show error?
    // For now, let's allow access but log an error. Ideally, profile should exist.
    console.error(
      `[MatchesPage] Failed to fetch profile for user ${userId}: ${profileResult.message}. Allowing access to matches.`
    )
  } else {
    // Profile fetched successfully, check the completion flag
    const profile = profileResult.data
    if (!profile.profileQuestionsCompleted) {
      // User hasn't completed the questions, show prompt
      return (
        <Card className="mx-auto max-w-md p-6 text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">
              Complete Your Profile!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Answer a few fun questions about your travel style to unlock your
              potential matches and connect with like-minded travellers.
            </p>
            <Button asChild className="bg-gradient-1 text-white">
              <Link href="/profile/edit">
                <Edit3 className="mr-2 size-4" /> Complete Profile Now
              </Link>
            </Button>
          </CardContent>
        </Card>
      )
    }
    // If profile questions are completed, proceed to show the matches feed
  }

  // Render the matches feed, passing the fetched viewer profile
  return (
    <DiscoveryErrorBoundary>
      <MatchesFeed userId={userId} viewerProfile={profileResult.data ?? null} />
    </DiscoveryErrorBoundary>
  )
}

export default async function MatchesPage() {
  const { userId } = await auth()

  // Redirect if not authenticated (middleware should also handle this)
  if (!userId) {
    redirect("/login?redirect_url=/matches") // Redirect to login, preserving destination
  }

  return (
    <div className="container mx-auto p-4 pt-24">
      <h1 className="font-poppins mb-6 text-center text-4xl font-extrabold tracking-tight lg:text-3xl">
        Find your Trizzer
      </h1>

      <Suspense fallback={<MatchesSkeleton />}>
        <MatchesPageContentFetcher userId={userId} />
      </Suspense>
    </div>
  )
}
