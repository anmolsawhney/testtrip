/**
 * @description
 * Server-side page component for the TripRizz discover route (/discover).
 * This page now contains the one-time profile creation logic to ensure
 * a profile exists for every new user after they are redirected from onboarding.
 * FIXED: Replaced `createProfileAction` with the robust `getOrCreateProfileAction`.
 * UPDATED: Improved the fallback logic for generating a username during initial profile creation. It now uses the user's email handle as a more sensible default if a username is not provided by the auth provider, preventing generic names like `user_...`.
 *
 * Key features:
 * - Profile Creation: Safely creates a user profile record on their first visit after signup.
 * - Airbnb-inspired design with minimal text, vibrant visuals, and glassmorphism
 * - Toggle between profiles and trips discovery modes
 * - Swipe-based navigation for discovering both profiles and trips
 * - Efficient whitespace usage for a clean, modern look
 *
 * @dependencies
 * - "@clerk/nextjs/server": For authentication via Clerk
 * - "@/actions/db/profiles-actions": For profile creation and retrieval.
 * - All other existing dependencies for this page.
 */
"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { DiscoveryErrorBoundary } from "@/components/discovery/error-boundary"
import { DiscoveryToggle } from "./_components/discovery-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getOrCreateProfileAction,
  getProfileByUserIdAction
} from "@/actions/db/profiles-actions"

function DiscoverSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-12 w-full" />
      <div className="mx-auto h-[600px] w-full max-w-md rounded-lg bg-gray-200"></div>
    </div>
  )
}

export default async function DiscoverPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/login")
  }

  // --- ONE-TIME PROFILE CREATION LOGIC ---
  try {
    const profileRes = await getProfileByUserIdAction(userId)
    if (!profileRes.isSuccess && profileRes.message === "Profile not found") {
      console.log(
        `[DiscoverPage] Profile not found for ${userId}. Creating profile...`
      )
      const user = await currentUser()
      if (!user) {
        // This is a failsafe in case the user session is somehow invalid.
        throw new Error("Could not retrieve user data to create profile.")
      }

      // Improved username fallback logic.
      const initialUsername =
        user.username ||
        user.primaryEmailAddress?.emailAddress
          .split("@")[0]
          .replace(/[^a-zA-Z0-9_.]/g, "") ||
        `user_${userId.slice(-8)}`

      await getOrCreateProfileAction(
        userId,
        user.firstName || "New",
        user.lastName || "User",
        initialUsername
      )
    }
  } catch (error) {
    console.error(
      `[DiscoverPage] Error during profile check/creation for ${userId}:`,
      error
    )
  }
  // --- END ---

  return (
    <div className="container mx-auto p-4">
      <h1 className="bg-gradient-1 mb-6 bg-clip-text text-center text-3xl font-bold text-transparent">
        Discover
      </h1>

      <Suspense fallback={<DiscoverSkeleton />}>
        <DiscoveryErrorBoundary>
          <DiscoveryToggle userId={userId} />
        </DiscoveryErrorBoundary>
      </Suspense>
    </div>
  )
}
