/**
 * @description
 * Server component page for displaying a specific Direct Message conversation.
 * Fetches initial messages, participant details, block status, and follow status.
 * Renders the `DirectMessageInterface` client component to handle the interactive chat UI.
 * CORRECTED: The import paths for database schema types (`SelectDirectMessage`, `SelectDirectMessageConversation`)
 * have been fixed to point to `@/db/schema` instead of `@/types`, resolving the module export error.
 * UPDATED: Now checks if the other user in the conversation is soft-deleted and denies access if they are.
 * UPDATED: The page now uses a full-height, responsive container to make the chat interface mobile-friendly.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication (`auth`).
 * - next/navigation: For redirection (`redirect`).
 * - @/actions/db/direct-message-actions: For fetching messages, conversation details, block status.
 * - @/actions/db/profiles-actions: For fetching participant profiles.
 * - @/actions/db/follow-actions: For fetching follow status between participants.
 * - ./_components/direct-message-interface: Client component for the chat UI.
 * - ./_components/chat-interface-skeleton: Skeleton loading component.
 * - @/types: For application-level types (SelectProfile, FollowStatus).
 * - @/db/schema: For database-level types (SelectDirectMessage, SelectDirectMessageConversation).
 * - @/components/ui/card: For error message display.
 * - @/components/ui/button: For error message display.
 * - next/link: For error message display.
 */
"use server"

import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { and, eq, or } from "drizzle-orm"

import {
  getMessagesAction,
  checkBlockStatusAction,
  getOrCreateConversationAction
} from "@/actions/db/direct-message-actions"
import { getProfileByUserIdAction } from "@/actions/db/profiles-actions"
import { getFollowStatusAction } from "@/actions/db/follow-actions"
import DirectMessageInterface from "../_components/direct-message-interface"
import ChatInterfaceSkeleton from "../_components/chat-interface-skeleton"
import {
  SelectDirectMessage,
  SelectDirectMessageConversation,
  directMessageConversationsTable
} from "@/db/schema"
import { SelectProfile, FollowStatus } from "@/types"
import { db } from "@/db/db"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const MESSAGES_PAGE_LIMIT = 50

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>
}

async function ChatInterfaceFetcher({
  conversationId,
  currentUserId
}: {
  conversationId: string
  currentUserId: string
}) {
  const conversationResult =
    await db.query.directMessageConversations.findFirst({
      where: and(
        eq(directMessageConversationsTable.id, conversationId),
        or(
          eq(directMessageConversationsTable.user1Id, currentUserId),
          eq(directMessageConversationsTable.user2Id, currentUserId)
        )
      )
    })

  if (!conversationResult) {
    return (
      <Card className="border-destructive bg-destructive/10 text-destructive-foreground p-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">Conversation Not Found</h2>
        <p>
          This conversation may not exist or you do not have permission to view
          it.
        </p>
        <Button variant="destructive" className="mt-4" asChild>
          <Link href="/chat">Back to Chat</Link>
        </Button>
      </Card>
    )
  }

  const conversation: SelectDirectMessageConversation = conversationResult
  const otherUserId =
    conversation.user1Id === currentUserId
      ? conversation.user2Id
      : conversation.user1Id

  const [
    messagesResult,
    currentUserProfileResult,
    otherUserProfileResult,
    blockStatusResult,
    followStatusResult
  ] = await Promise.all([
    getMessagesAction(conversationId, currentUserId, MESSAGES_PAGE_LIMIT, 0),
    getProfileByUserIdAction(currentUserId, currentUserId),
    getProfileByUserIdAction(otherUserId, currentUserId),
    checkBlockStatusAction(currentUserId, otherUserId, "dm"),
    getFollowStatusAction(currentUserId, otherUserId)
  ])

  let isBlocked: boolean = false
  let followStatus: FollowStatus = "not_following"

  if (!blockStatusResult.isSuccess) {
    console.error(
      `[ChatInterfaceFetcher] Failed to fetch block status between ${currentUserId} and ${otherUserId}: ${blockStatusResult.message}`
    )
  } else {
    isBlocked = blockStatusResult.data
  }

  if (!followStatusResult.isSuccess) {
    console.error(
      `[ChatInterfaceFetcher] Failed to fetch follow status between ${currentUserId} and ${otherUserId}: ${followStatusResult.message}`
    )
  } else {
    followStatus = followStatusResult.data
  }

  if (!messagesResult.isSuccess) {
    console.error(
      `[ChatInterfaceFetcher] Failed to fetch messages for convo ${conversationId}:`,
      messagesResult.message
    )
  }
  if (!currentUserProfileResult.isSuccess || !currentUserProfileResult.data) {
    return <p>Error loading your profile.</p>
  }
  if (!otherUserProfileResult.isSuccess || !otherUserProfileResult.data) {
    console.error(
      `[ChatInterfaceFetcher] Failed to fetch profile for other user ${otherUserId} or user is deleted.`
    )
    return <p>Error loading other user's profile.</p>
  }

  const initialMessages: SelectDirectMessage[] = messagesResult.data || []
  const currentUserProfile: SelectProfile = currentUserProfileResult.data
  const otherUserProfile: SelectProfile = otherUserProfileResult.data

  return (
    <DirectMessageInterface
      conversationId={conversationId}
      initialMessages={initialMessages}
      currentUser={currentUserProfile}
      otherUser={otherUserProfile}
      initialBlockStatus={isBlocked}
      initialFollowStatus={followStatus}
      initialHasMoreMessages={initialMessages.length === MESSAGES_PAGE_LIMIT}
    />
  )
}

export default async function ConversationPage({
  params
}: ConversationPageProps) {
  const { userId } = await auth()
  const resolvedParams = await params

  const conversationId = resolvedParams.conversationId

  if (!userId) {
    const loginParams = new URLSearchParams({
      redirect_url: `/chat/${conversationId}`
    })
    redirect(`/login?${loginParams.toString()}`)
  }

  if (
    !conversationId ||
    typeof conversationId !== "string" ||
    conversationId.length < 10
  ) {
    redirect("/chat?error=invalid_conversation")
  }

  return (
    <div className="h-full pb-14 pt-16 md:pb-4 md:pt-24">
      <div className="container mx-auto h-full max-w-3xl px-0 md:px-4">
        <Suspense fallback={<ChatInterfaceSkeleton />}>
          <ChatInterfaceFetcher
            conversationId={conversationId}
            currentUserId={userId}
          />
        </Suspense>
      </div>
    </div>
  )
}
