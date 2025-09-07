/**
 * @description
 * Server component page for displaying and managing follow requests.
 * Fetches both incoming and outgoing pending follow requests for the current user.
 * Uses Suspense to show a loading state while fetching data.
 * Delegates rendering of request lists to client components.
 * UPDATED: Added top padding `pt-24` to ensure content appears below the fixed top navigation bar.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication (auth).
 * - next/navigation: For redirection (redirect).
 * - @/actions/db/follow-actions: Server action to fetch follow requests.
 * - ./_components/incoming-requests: Client component for incoming requests.
 * - ./_components/outgoing-requests: Client component for outgoing requests.
 * - ./_components/follow-request-skeleton: Skeleton loading component.
 * - @/types: For FollowRequest type definition.
 */
"use server"

import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { getFollowRequestsAction } from "@/actions/db/follow-actions"
import IncomingRequests from "./_components/incoming-requests"
import OutgoingRequests from "./_components/outgoing-requests"
import FollowRequestSkeleton from "./_components/follow-request-skeleton"
import { FollowRequest } from "@/types" // Assuming FollowRequest type is correctly defined

/**
 * Fetches both incoming and outgoing follow requests concurrently.
 * @param userId - The ID of the current user.
 * @returns An object containing arrays of incoming and outgoing requests.
 */
async function fetchAllRequests(userId: string): Promise<{
  incoming: FollowRequest[]
  outgoing: FollowRequest[]
}> {
  console.log(`[FollowRequestsPage] Fetching requests for userId: ${userId}`)
  const [incomingResult, outgoingResult] = await Promise.all([
    getFollowRequestsAction(userId, "incoming"),
    getFollowRequestsAction(userId, "outgoing")
  ])

  const incoming = incomingResult.isSuccess ? incomingResult.data : []
  const outgoing = outgoingResult.isSuccess ? outgoingResult.data : []

  console.log(
    `[FollowRequestsPage] Fetched ${incoming.length} incoming, ${outgoing.length} outgoing requests.`
  )

  if (!incomingResult.isSuccess) {
    console.error("Failed to fetch incoming requests:", incomingResult.message)
    // Optionally handle error display, for now just return empty
  }
  if (!outgoingResult.isSuccess) {
    console.error("Failed to fetch outgoing requests:", outgoingResult.message)
    // Optionally handle error display, for now just return empty
  }

  return { incoming, outgoing }
}

/**
 * The main server component for the /follow-requests page.
 * Fetches data and renders the UI structure, delegating list rendering to client components.
 */
export default async function FollowRequestsPage() {
  const { userId } = await auth()

  // Redirect if user is not logged in
  if (!userId) {
    const params = new URLSearchParams({ redirect_url: "/follow-requests" })
    redirect(`/login?${params.toString()}`)
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 pb-8 pt-24">
      <h1 className="mb-8 text-3xl font-bold">Follow Requests</h1>
      <Suspense fallback={<FollowRequestSkeleton />}>
        <RequestsFetcher userId={userId} />
      </Suspense>
    </div>
  )
}

/**
 * Async component specifically for fetching and rendering the request lists.
 * This pattern allows the main page component to render instantly while data fetching occurs within Suspense.
 */
async function RequestsFetcher({ userId }: { userId: string }) {
  const { incoming, outgoing } = await fetchAllRequests(userId)

  return (
    <div className="space-y-8">
      {/* Incoming Requests Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Incoming Requests</h2>
        <IncomingRequests requests={incoming} currentUserId={userId} />
      </div>

      {/* Outgoing Requests Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Sent Requests</h2>
        <OutgoingRequests requests={outgoing} currentUserId={userId} />
      </div>
    </div>
  )
}
