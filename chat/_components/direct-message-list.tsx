/**
 * @description
 * Client-side component that renders the list of conversations, separating them
 * into Direct Messages ("Personal Chats"), "Group Chats", and pending "Requests".
 * Allows users to accept message requests and displays verification badges.
 * Includes clickable profile links for DMs.
 * UPDATED: Replaced all instances of `displayName` with `username`.
 *
 * Key features:
 * - Tabbed interface for Personal Chats, Group Chats, and Requests.
 * - Renders conversation previews (avatar, username, snippet, time, unread badge, verification badge).
 * - Entire DM card is clickable to navigate to the conversation via onClick.
 * - Avatar and name links navigate to user profiles, stopping card navigation.
 * - Handles accepting message requests via a server action.
 * - Displays loading states for accept action and empty states for lists.
 *
 * @dependencies
 * - react, next/link, next/navigation, date-fns, lucide-react
 * - @/components/ui/*: Shadcn UI components (Tabs, Avatar, Badge, Button, Card, Tooltip).
 * - @/lib/utils, @/types, @/actions/db/direct-message-actions, @/lib/hooks/use-toast
 */

"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import {
  MessageSquare,
  MailWarning,
  Loader2,
  Check,
  Users,
  ShieldCheck
} from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ConversationPreview, GroupConversationPreview } from "@/types"
import { acceptMessageRequestAction } from "@/actions/db/direct-message-actions"
import { useToast } from "@/lib/hooks/use-toast"

interface DirectMessageListProps {
  initialChats: ConversationPreview[]
  initialRequests: ConversationPreview[]
  initialGroupChats: GroupConversationPreview[]
  currentUserId: string
}

const formatTimeAgo = (date: Date | undefined | null): string => {
  if (!date) return ""
  try {
    return formatDistanceToNowStrict(date, { addSuffix: false })
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" months", "mo")
      .replace(" month", "mo")
      .replace(" years", "y")
      .replace(" year", "y")
      .replace(" seconds", "s")
      .replace(" second", "s")
  } catch (e) {
    console.error("Error formatting date:", e)
    return ""
  }
}

export default function DirectMessageList({
  initialChats,
  initialRequests,
  initialGroupChats,
  currentUserId
}: DirectMessageListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  )

  const [chats, setChats] = useState(initialChats)
  const [requests, setRequests] = useState(initialRequests)
  const [groupChats, setGroupChats] = useState(initialGroupChats)

  const handleAcceptRequest = async (conversationId: string) => {
    if (processingRequestId) return

    setProcessingRequestId(conversationId)
    try {
      const result = await acceptMessageRequestAction(
        conversationId,
        currentUserId
      )
      if (result.isSuccess) {
        toast({
          title: "Request Accepted",
          description: "This chat has been moved to your main chat list."
        })
        startTransition(() => {
          const acceptedRequestIndex = requests.findIndex(
            req => req.id === conversationId
          )
          if (acceptedRequestIndex > -1) {
            const acceptedRequest = requests[acceptedRequestIndex]
            setRequests(prev => prev.filter(req => req.id !== conversationId))
            setChats(prev =>
              [{ ...acceptedRequest, status: "active" as const }, ...prev].sort(
                (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
              )
            )
          }
          router.refresh()
        })
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to accept request.",
        variant: "destructive"
      })
    } finally {
      setProcessingRequestId(null)
    }
  }

  const renderDmConversationList = (
    list: ConversationPreview[],
    isRequestList: boolean = false
  ) => {
    if (list.length === 0) {
      return (
        <div className="flex h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/50 p-6 text-center">
          {isRequestList ? (
            <MailWarning className="mb-4 size-12 text-gray-300" />
          ) : (
            <MessageSquare className="mb-4 size-12 text-gray-300" />
          )}
          <h2 className="text-xl font-semibold text-gray-700">
            {isRequestList ? "No Message Requests" : "No Personal Chats Yet"}
          </h2>
          <p className="mt-2 max-w-md text-gray-500">
            {isRequestList
              ? "Messages from people you don't follow mutually will appear here."
              : "Personal chats with other users will appear here."}
          </p>
          {!isRequestList && (
            <Link href="/matches" className="mt-4">
              <Button variant="outline">Find Matches</Button>
            </Link>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {list.map(convo => {
          const chatLinkHref = `/chat/${convo.id}`
          const profileLinkHref = convo.otherParticipant
            ? `/profile/${convo.otherParticipant.userId}`
            : "#"
          const isLoading = processingRequestId === convo.id
          const isIdVerified =
            convo.otherParticipant?.verificationStatus === "verified"

          return (
            <Card
              key={convo.id}
              onClick={() => router.push(chatLinkHref)}
              className="cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center p-4">
                <Link
                  href={profileLinkHref}
                  onClick={e => e.stopPropagation()}
                  aria-label={`View profile of ${convo.otherParticipant?.username ?? "User"}`}
                  className="shrink-0"
                >
                  <Avatar className="size-12 hover:opacity-80">
                    <AvatarImage
                      src={convo.otherParticipant?.profilePhoto ?? undefined}
                      alt={convo.otherParticipant?.username ?? "User"}
                    />
                    <AvatarFallback className="bg-gray-200 text-gray-500">
                      {convo.otherParticipant?.username
                        ?.charAt(0)
                        ?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex flex-1 items-center justify-between overflow-hidden pl-4">
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={profileLinkHref}
                        onClick={e => e.stopPropagation()}
                        className="block w-fit"
                      >
                        <h3 className="truncate font-semibold hover:underline">
                          {convo.otherParticipant?.username ?? "Unknown User"}
                        </h3>
                      </Link>
                      {isIdVerified && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className="border-blue-300 bg-blue-100 p-1 text-blue-800">
                                <ShieldCheck className="size-3.5" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Identity Verified</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {convo.latestMessage ? (
                      <p className="truncate text-sm text-gray-500">
                        {convo.latestMessage.senderId === currentUserId
                          ? "You: "
                          : ""}
                        {convo.latestMessage.content}
                      </p>
                    ) : (
                      <p className="truncate text-sm italic text-gray-400">
                        No messages yet
                      </p>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 flex-col items-end text-right">
                    {convo.latestMessage && (
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(convo.latestMessage.timestamp)}
                      </span>
                    )}
                    {convo.unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="mt-1 px-1.5 py-0.5 leading-none"
                      >
                        {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {isRequestList && (
                <div className="border-t px-4 py-2 text-right">
                  <Button
                    size="sm"
                    onClick={e => {
                      e.stopPropagation()
                      handleAcceptRequest(convo.id)
                    }}
                    disabled={isLoading || isPending}
                    className="bg-gradient-1 text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Accept
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  const renderGroupConversationList = (list: GroupConversationPreview[]) => {
    if (list.length === 0) {
      return (
        <div className="flex h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/50 p-6 text-center">
          <Users className="mb-4 size-12 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">
            No Group Chats Yet
          </h2>
          <p className="mt-2 max-w-md text-gray-500">
            Join or create trips to start chatting with your group members.
          </p>
          <Link href="/trips" className="mt-4">
            <Button variant="outline">Explore Trips</Button>
          </Link>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {list.map(convo => {
          const linkHref = `/trips/${convo.tripId}/chat`
          const latestMsg = convo.latestMessage

          return (
            <Link key={convo.tripId} href={linkHref} className="block">
              <Card className="transition-all hover:shadow-md active:scale-[0.99]">
                <div className="block p-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="size-12">
                      <AvatarImage
                        src={convo.tripPhotoUrl ?? undefined}
                        alt={convo.tripTitle}
                      />
                      <AvatarFallback className="bg-purple-100 text-purple-600">
                        <Users className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="truncate font-semibold">
                        {convo.tripTitle}
                      </h3>
                      {latestMsg ? (
                        <p className="truncate text-sm text-gray-500">
                          {latestMsg.senderId === currentUserId
                            ? "You: "
                            : `${latestMsg.senderName}: `}
                          {latestMsg.content}
                        </p>
                      ) : (
                        <p className="truncate text-sm italic text-gray-400">
                          No messages yet
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {convo.memberCount}{" "}
                        {convo.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-col items-end text-right">
                      {latestMsg && (
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(latestMsg.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <Tabs defaultValue="chats" className="w-full">
      <TabsList className="glass mx-auto mb-6 grid w-full max-w-lg grid-cols-3 rounded-full p-1">
        <TabsTrigger value="chats" disabled={isPending}>
          Personal Chat
        </TabsTrigger>
        <TabsTrigger value="groups" disabled={isPending}>
          Group Chat
        </TabsTrigger>
        <TabsTrigger value="requests" disabled={isPending}>
          Request
          {requests.length > 0 && (
            <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
              {requests.length > 9 ? "9+" : requests.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chats">{renderDmConversationList(chats)}</TabsContent>
      <TabsContent value="groups">
        {renderGroupConversationList(groupChats)}
      </TabsContent>
      <TabsContent value="requests">
        {renderDmConversationList(requests, true)}
      </TabsContent>
    </Tabs>
  )
}
