/**
 * @description
 * Client-side component that renders the interactive Direct Message (DM) chat interface.
 * Displays messages, handles message input/sending, shows participant info,
 * follow status, a verification badge, a block button, and manages message loading/pagination.
 * UPDATED: Now uses a simple markdown parser to render clickable hyperlinks in messages.
 *
 * Key features:
 * - Displays messages with user info and renders clickable links.
 * - Handles message input/sending and pagination.
 * - Shows participant info, follow status, verification badge, and block button.
 * - Includes clickable profile links in the header and for message avatars.
 * - Fully responsive layout using a flexible height (`h-full`).
 *
 * @dependencies
 * - react, next/link, next/navigation, date-fns, lucide-react
 * - @/components/ui/*: Shadcn UI components.
 * - @/lib/utils, @/types, @/db/schema, @/actions/db/direct-message-actions, @/lib/hooks/use-toast
 * - "@/lib/markdown-utils": For rendering links in messages.
 */
"use client"

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import {
  Send,
  Loader2,
  UserX,
  ArrowLeft,
  MoreVertical,
  ShieldAlert,
  ShieldCheck
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SelectProfile, FollowStatus } from "@/types"
import { SelectDirectMessage } from "@/db/schema"
import {
  sendMessageAction,
  blockUserAction,
  getMessagesAction
} from "@/actions/db/direct-message-actions"
import { useToast } from "@/lib/hooks/use-toast"
import { renderSimpleMarkdown } from "@/lib/markdown-utils"

const MESSAGES_PAGE_LIMIT = 50

interface DirectMessageInterfaceProps {
  conversationId: string
  initialMessages: SelectDirectMessage[]
  currentUser: SelectProfile
  otherUser: SelectProfile
  initialBlockStatus: boolean
  initialFollowStatus: FollowStatus
  initialHasMoreMessages: boolean
}

export default function DirectMessageInterface({
  conversationId,
  initialMessages,
  currentUser,
  otherUser,
  initialBlockStatus,
  initialFollowStatus,
  initialHasMoreMessages
}: DirectMessageInterfaceProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [messages, setMessages] =
    useState<SelectDirectMessage[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(initialBlockStatus)
  const [followStatus, setFollowStatus] =
    useState<FollowStatus>(initialFollowStatus)
  const [isBlocking, setIsBlocking] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(initialHasMoreMessages)
  const [isPending, startTransition] = useTransition()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const isIdVerified = otherUser.verificationStatus === "verified"

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const formatMessageTimestamp = (date: Date): string => {
    try {
      if (isToday(date)) {
        return format(date, "p")
      }
      if (isYesterday(date)) {
        return `Yesterday ${format(date, "p")}`
      }
      return format(date, "MMM d, p")
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Invalid Date"
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || isBlocked) return

    setIsSending(true)
    const optimisticMessage: SelectDirectMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: currentUser.userId,
      content: newMessage.trim(),
      createdAt: new Date()
    }

    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage("")

    try {
      const result = await sendMessageAction(
        conversationId,
        currentUser.userId,
        otherUser.userId,
        newMessage.trim()
      )

      if (!result.isSuccess || !result.data) {
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        setNewMessage(optimisticMessage.content)
        toast({
          title: "Error Sending Message",
          description: result.message || "Could not send message.",
          variant: "destructive"
        })
      } else {
        console.log("Message sent successfully:", result.data)
        startTransition(() => {
          router.refresh()
        })
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      setNewMessage(optimisticMessage.content)
      toast({
        title: "Error",
        description: "An unexpected error occurred while sending the message.",
        variant: "destructive"
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleBlockUser = async () => {
    if (isBlocking) return
    setIsBlocking(true)

    try {
      const result = await blockUserAction(
        currentUser.userId,
        otherUser.userId,
        "dm"
      )
      if (result.isSuccess) {
        setIsBlocked(true)
        toast({
          title: "User Blocked",
          description: `You have blocked ${otherUser.username}. You can no longer send or receive messages.`
        })
      } else {
        toast({
          title: "Error Blocking User",
          description: result.message || "Could not block user.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while blocking the user.",
        variant: "destructive"
      })
    } finally {
      setIsBlocking(false)
    }
  }

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return

    console.log("Loading more messages...")
    setIsLoadingMore(true)

    try {
      const currentOffset = messages.length
      const result = await getMessagesAction(
        conversationId,
        currentUser.userId,
        MESSAGES_PAGE_LIMIT,
        currentOffset
      )

      if (result.isSuccess && result.data) {
        setMessages(prev => [...result.data!, ...prev])
        setHasMoreMessages(result.data!.length === MESSAGES_PAGE_LIMIT)
        console.log(
          `Loaded ${result.data!.length} more messages. HasMore: ${result.data!.length === MESSAGES_PAGE_LIMIT}`
        )
      } else {
        console.error("Failed to load older messages:", result.message)
        setHasMoreMessages(false)
      }
    } catch (error) {
      console.error("Error loading more messages:", error)
      setHasMoreMessages(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    conversationId,
    currentUser.userId,
    messages.length,
    hasMoreMessages,
    isLoadingMore
  ])

  const renderFollowStatus = () => {
    if (followStatus === "following" || followStatus === "self") return null

    let message = "You don't follow each other."
    if (followStatus === "pending_outgoing") message = "Follow request sent."
    if (followStatus === "pending_incoming")
      message = `${otherUser.username} wants to follow you.`

    return (
      <Badge
        variant="outline"
        className="ml-2 border-yellow-400 bg-yellow-50 text-xs text-yellow-700"
      >
        {message}
      </Badge>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-gray-50 shadow-sm">
      <Card className="shrink-0 rounded-b-none border-x-0 border-t-0">
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 md:hidden"
              asChild
            >
              <Link href="/chat">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <Link
              href={`/profile/${otherUser.userId}`}
              onClick={e => e.stopPropagation()}
              aria-label={`View profile of ${otherUser.username ?? "User"}`}
            >
              <Avatar className="size-10 hover:opacity-80">
                <AvatarImage
                  src={otherUser.profilePhoto ?? undefined}
                  alt={otherUser.username ?? "User"}
                />
                <AvatarFallback>
                  {otherUser.username?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${otherUser.userId}`}
                  onClick={e => e.stopPropagation()}
                  className="w-fit hover:underline"
                >
                  <span className="font-semibold">
                    {otherUser.username ?? "Unknown User"}
                  </span>
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
              {renderFollowStatus()}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                disabled={isBlocking}
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={handleBlockUser}
                disabled={isBlocked || isBlocking}
              >
                <UserX className="mr-2 size-4" />
                {isBlocked
                  ? "User Blocked"
                  : isBlocking
                    ? "Blocking..."
                    : "Block User"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <div
        ref={chatContainerRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
      >
        {hasMoreMessages && !isLoadingMore && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={loadMoreMessages}>
              Load Older Messages
            </Button>
          </div>
        )}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-5 animate-spin text-gray-400" />
          </div>
        )}
        {messages.map(msg => {
          const isCurrentUser = msg.senderId === currentUser.userId
          const profile = isCurrentUser ? currentUser : otherUser
          const profileLinkHref = `/profile/${profile.userId}`

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isCurrentUser ? "justify-end" : "justify-start"}`}
            >
              {!isCurrentUser && (
                <Link
                  href={profileLinkHref}
                  aria-label={`View profile of ${profile.username ?? "User"}`}
                >
                  <Avatar className="size-8 shrink-0 hover:opacity-80">
                    <AvatarImage
                      src={profile?.profilePhoto ?? undefined}
                      alt={profile?.username ?? "User"}
                    />
                    <AvatarFallback>
                      {profile?.username?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[60%]",
                  isCurrentUser
                    ? "bg-gradient-1 text-white"
                    : "border bg-white text-gray-800"
                )}
              >
                <p className="whitespace-pre-wrap break-words text-sm">
                  {renderSimpleMarkdown(msg.content)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    isCurrentUser
                      ? "text-right text-purple-100/80"
                      : "text-left text-gray-400"
                  )}
                >
                  {formatMessageTimestamp(msg.createdAt)}
                </p>
              </div>
              {isCurrentUser && (
                <Link
                  href={profileLinkHref}
                  aria-label={`View profile of ${profile.username ?? "User"}`}
                >
                  <Avatar className="size-8 shrink-0 hover:opacity-80">
                    <AvatarImage
                      src={profile?.profilePhoto ?? undefined}
                      alt={profile?.username ?? "User"}
                    />
                    <AvatarFallback>
                      {profile?.username?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {isBlocked && (
        <div className="border-t bg-red-50 p-3 text-center text-sm text-red-700">
          <ShieldAlert className="mr-1 inline-block size-4 align-text-bottom" />
          You have blocked this user. You cannot send or receive messages.
        </div>
      )}

      {!isBlocked && (
        <div className="flex items-center gap-2 border-t bg-white p-3">
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 resize-none rounded-full border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-purple-500"
            rows={1}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={isSending || isBlocked}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending || isBlocked}
            size="icon"
            className="bg-gradient-1 rounded-full text-white hover:opacity-90"
          >
            {isSending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
