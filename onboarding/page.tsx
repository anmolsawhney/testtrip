/**
 * @description
 * Server component for the user onboarding page. It uses the robust `getOrCreateProfileAction`
 * to ensure a user profile exists and then renders the unified `ProfileForm` component
 * in "onboarding" mode.
 * FIXED: Now exclusively uses the race-condition-safe `getOrCreateProfileAction`.
 * UPDATED: Changed heading from "TripRizz" to "TripTrizz".
 * UPDATED: Changed padding to `py-16` to better suit the layout.
 *
 * Key features:
 * - Safely gets or creates a user profile using a single atomic action.
 * - Reuses the `ProfileForm` component for a consistent UX with profile editing.
 * - Handles authentication and redirects unauthenticated users.
 * - Uses Suspense to provide a loading state while fetching initial data.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication and user data.
 * - next/navigation: For redirects.
 * - @/actions/db/profiles-actions: To get or create a user profile via `getOrCreateProfileAction`.
 * - @/app/profile/_components/profile-form: The unified form component.
 * - @/components/ui/skeleton: For the loading state.
 */
"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getOrCreateProfileAction } from "@/actions/db/profiles-actions"
import ProfileForm from "@/app/profile/_components/profile-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { SelectProfile as DbSelectProfile } from "@/db/schema"

function OnboardingSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Skeleton className="size-32 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

async function OnboardingFetcher({ userId }: { userId: string }) {
  const user = await currentUser()
  if (!user) {
    return (
      <div className="text-destructive text-center">
        Could not load your user session. Please try signing out and in again.
      </div>
    )
  }

  // Use the single, robust action to get or create the profile
  const profileResult = await getOrCreateProfileAction(
    userId,
    user.firstName || "New",
    user.lastName || "User",
    user.username || `user_${userId.slice(-8)}`
  )

  if (!profileResult.isSuccess || !profileResult.data) {
    return (
      <div className="text-destructive text-center">
        Error initializing your profile: {profileResult.message}. Please try
        again.
      </div>
    )
  }

  const profile = profileResult.data

  // If user lands here but is somehow already fully onboarded, send them home.
  if (profile.profileQuestionsCompleted) {
    redirect("/")
  }

  return <ProfileForm initialProfile={profile} isOnboarding={true} />
}

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) {
    return redirect("/login")
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome to TripTrizz!
        </h1>
        <p className="text-muted-foreground">
          Let's set up your profile to get you started on your next adventure.
        </p>
      </div>
      <Suspense fallback={<OnboardingSkeleton />}>
        <OnboardingFetcher userId={userId} />
      </Suspense>
    </div>
  )
}
