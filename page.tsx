/**
 * @description
 * The root page component for the TripRizz application.
 * It renders the redesigned landing page for unauthenticated users and the main
 * application feed for authenticated, onboarded users.
 * UPDATED: Added top padding (`pt-24`) to the authenticated user's view to account
 * for the removal of global padding from the main layout.
 * UPDATED: Now checks for `hasCompletedGuidedTour` flag and conditionally renders the
 * one-time guided tour for new users.
 * UPDATED: Improved the fallback logic for generating a username during initial profile creation. It now uses the user's email handle as a more sensible default if a username is not provided by the auth provider, preventing generic names like `user_...`.
 *
 * Key features:
 * - Onboarding Check: For any logged-in user, it checks if their profile is complete in the DB.
 * - Guided Tour Check: Renders the <GuidedTour /> component for users who haven't completed it.
 * - Conditional Rendering:
 *   - Renders the `LandingPage` for unauthenticated visitors.
 *   - Renders the main application feed for fully onboarded users.
 *
 * @dependencies
 * - "@clerk/nextjs/server": For checking authentication and getting user data.
 * - "next/navigation": For programmatic redirects.
 * - "@/actions/db/profiles-actions": For fetching and creating profile data.
 * - "@/lib/auth-utils": For checking admin status.
 * - ./_components/client-home-feed: The main feed for authenticated users.
 * - ./_components/landing/landing-page: The new, redesigned landing page.
 * - ./_components/guided-tour: The new guided tour modal.
 */
"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"

import { getOrCreateProfileAction } from "@/actions/db/profiles-actions"
import { HomeFeed } from "./_components/home-feed"
import { SearchFilters } from "./matches/_components/search-filters"
import { Skeleton } from "@/components/ui/skeleton"
import { TripTypeFilter } from "./_components/trip-type-filter"
import { ClientHomeFeed } from "./_components/client-home-feed"
import { FilterButton } from "./_components/filter-button"
import { Button } from "@/components/ui/button"
import { SelectProfile } from "@/types"
import { cn } from "@/lib/utils"
import LandingPage from "./_components/landing/landing-page"
import { isAdminUser } from "@/lib/auth-utils"
import { GuidedTour } from "./_components/guided-tour"

function HomeFeedSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default async function HomePage() {
  const { userId } = await auth()

  // --- UNATHENTICATED USER: Show new landing page ---
  if (!userId) {
    return <LandingPage />
  }

  // --- AUTHENTICATED USER: Onboarding check and app feed ---
  const user = await currentUser()
  if (!user) {
    redirect("/login")
  }

  // Improved username fallback logic.
  // Uses the email handle if a username is not provided by the auth provider.
  const initialUsername =
    user.username ||
    user.primaryEmailAddress?.emailAddress
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_.]/g, "") ||
    `user_${userId.slice(-8)}`

  const profileResult = await getOrCreateProfileAction(
    userId,
    user.firstName || "New",
    user.lastName || "User",
    initialUsername // Use the improved fallback username
  )

  if (!profileResult.isSuccess || !profileResult.data) {
    console.error(
      `[HomePage] Critical Error: getOrCreateProfileAction failed for user ${userId}: ${profileResult.message}`
    )
    redirect("/onboarding")
  }

  const dbProfile = profileResult.data

  if (dbProfile.profileQuestionsCompleted !== true) {
    console.log(
      `[HomePage] User ${userId} has not completed onboarding. Redirecting to /onboarding...`
    )
    redirect("/onboarding")
  }

  // Check if the user needs to see the guided tour.
  const showGuidedTour = dbProfile.hasCompletedGuidedTour === false

  const userProfile: SelectProfile = {
    ...dbProfile,
    isAdmin: isAdminUser(userId)
  }

  return (
    <>
      {showGuidedTour && <GuidedTour />}
      <div className="container mx-auto space-y-6 px-4 pb-6 pt-24">
        <div className="mb-8 text-center">
          <h1 className="mb-4 bg-clip-text text-4xl font-bold">
            Discover Your Next Adventure
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl">
            Discover amazing trips, connect with fellow travellers, and plan
            your perfect journey
          </p>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchFilters />
          </div>
          <FilterButton className="w-full sm:w-auto" />
        </div>

        <div className="my-6">
          <TripTypeFilter profile={userProfile} />
        </div>

        <Suspense fallback={<HomeFeedSkeleton />}>
          <ClientHomeFeed profile={userProfile} />
        </Suspense>

        <div className="fixed bottom-20 right-6 z-10 md:bottom-8 md:right-8">
          <Link href="/trips/new">
            <Button
              className={cn(
                "bg-gradient-1 size-20 rounded-full text-white shadow-lg hover:shadow-xl",
                "flex items-center justify-center"
              )}
              aria-label="Create new trip"
            >
              <i
                className="fi fi-rr-map-marker-plus"
                style={{ fontSize: "1.75rem" }}
              ></i>
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
