"use server"

/**
 * @description
 * Server-side page component for the main Chat view (/chat).
 * Handles user authentication and sets up the data fetching structure
 * for displaying active DMs, message requests, and Group Chats.
 * UPDATED: Renamed page title to "Chats" to reflect that it's a hub for both personal and group chats.
 * UPDATED: Added top padding `pt-24` to ensure content appears below the fixed top navigation bar.
 *
 * Key features:
 * - Authentication check using Clerk.
 * - Uses Suspense for asynchronous data loading.
 * - Delegates data fetching and rendering to the `ChatListFetcher` component.
 * - Provides a fallback skeleton UI during loading.
 *
 * @dependencies
 * - "@clerk/nextjs/server": For authentication (`auth`).
 * - "next/navigation": For redirects (`redirect`).
 * - "react": For Suspense.
 * - "@/actions/db/direct-message-actions": Server action to fetch conversations (`listConversationsAction`).
 * - "@/components/ui/skeleton": For loading state (`ChatPageSkeleton`).
 * - "@/types": For `ConversationPreview`, `GroupConversationPreview` types.
 * - "./_components/direct-message-list": Client component to render the list.
 * - "./_components/chat-page-skeleton": Skeleton loading component.
 */

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { listConversationsAction } from "@/actions/db/direct-message-actions"
import DirectMessageList from "./_components/direct-message-list"
import ChatPageSkeleton from "./_components/chat-page-skeleton"
import { ConversationPreview, GroupConversationPreview } from "@/types" // Import the correct types

/**
 * Async component specifically for fetching chat list data (DMs, Requests, Groups).
 * This component runs within the Suspense boundary on the server.
 * @param userId - The ID of the current user.
 */
async function ChatListFetcher({ userId }: { userId: string }) {
  console.log(`[ChatListFetcher] Fetching conversations for user: ${userId}`)
  const result = await listConversationsAction() // Fetches all types now

  const chats: ConversationPreview[] = []
  const requests: ConversationPreview[] = []
  const groupChats: GroupConversationPreview[] = [] // Added group chats array
  let errorMessage: string | null = null

  if (result.isSuccess && result.data) {
    chats.push(...result.data.chats)
    requests.push(...result.data.requests)
    groupChats.push(...result.data.groupChats) // Destructure group chats
    console.log(
      `[ChatListFetcher] Fetched ${chats.length} DMs, ${requests.length} requests, ${groupChats.length} group chats.`
    )
  } else {
    errorMessage = result.message || "Failed to load conversations."
    console.error(`[ChatListFetcher] Error: ${errorMessage}`)
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-red-300 bg-red-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-red-700">
          Error Loading Chats
        </h2>
        <p className="mt-2 text-red-600">{errorMessage}</p>
      </div>
    )
  }

  return (
    <DirectMessageList
      initialChats={chats}
      initialRequests={requests}
      initialGroupChats={groupChats} // Pass group chats down
      currentUserId={userId}
    />
  )
}

/**
 * The main server component for the /chat page.
 */
export default async function ChatPage() {
  const { userId } = await auth()

  // Redirect if user is not logged in
  if (!userId) {
    const params = new URLSearchParams({ redirect_url: "/chat" })
    redirect(`/login?${params.toString()}`)
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-8 pt-24">
      <h1 className="mb-6 flex items-center text-3xl font-bold">
        <i className="fi fi-rr-comment-alt mr-3 text-3xl"></i>{" "}
        {/* Using Flaticon */}
        Chats
      </h1>

      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatListFetcher userId={userId} />
      </Suspense>
    </div>
  )
}
