// File: app/chat/_components/chat-list.tsx
"use client"

/**
 * @description
 * Client-side component that renders a list of chat conversation previews.
 * Displays trip title, latest message snippet, timestamp, and unread count (placeholder).
 * Uses Flaticon icons.
 *
 * Key features:
 * - Renders a list of ConversationPreview objects
 * - Shows trip photo or default group icon
 * - Displays latest message content and sender
 * - Formats timestamps relatively (e.g., "5m", "1h")
 * - Handles empty state gracefully
 * - Links each preview to the corresponding trip chat page
 *
 * @dependencies
 * - "next/link": For navigation
 * - "@/components/ui/avatar": For displaying user/group images
 * - "@/components/ui/card": For list item structure
 * - "date-fns": For timestamp formatting (formatDistanceToNowStrict)
 * - Flaticon CSS: For icons (fi-rr-users, fi-rr-comment-alt)
 *
 * @notes
 * - Assumes `ConversationPreview` data is passed from the server component (`app/chat/page.tsx`)
 * - Unread count logic is currently a placeholder.
 * - Uses a fallback group icon when no image URL is available.
 */

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { formatDistanceToNowStrict } from "date-fns"
// Removed Users, MessageSquare imports from lucide-react

// Define the structure for a conversation preview
export interface ConversationPreview {
  id: string // For group chat, this is tripId
  type: "group" // | "direct"; // Type distinction for future DM support
  name: string // Trip title or other user's name
  imageUrl?: string | null // Trip photo or user profile photo
  latestMessage: {
    content: string
    timestamp: Date
    senderName: string
    senderId: string // ID of the user who sent the last message
  } | null
  unreadCount: number // Placeholder for unread messages
}

interface ChatListProps {
  conversations: ConversationPreview[]
  currentUserId: string
}

// Helper function to format time ago
const formatTimeAgo = (date: Date | undefined): string => {
  if (!date) return ""
  try {
    return (
      formatDistanceToNowStrict(date, { addSuffix: false })
        // Make it shorter e.g., 5m, 1h, 2d
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
    )
  } catch (e) {
    console.error("Error formatting date:", e)
    return "" // Return empty string on error
  }
}

export default function ChatList({
  conversations,
  currentUserId
}: ChatListProps) {
  if (conversations.length === 0) {
    // This case should ideally be handled by the server component,
    // but added here as a fallback.
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50">
        {/* Replaced MessageSquare icon */}
        <i className="fi fi-rr-comment-alt mb-4 text-6xl text-gray-300"></i>
        <h2 className="text-xl font-semibold text-gray-700">No Chats Yet</h2>
        <p className="mt-2 max-w-md text-center text-gray-500">
          Your conversations will appear here once you join or create trips.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {conversations.map(convo => {
        const linkHref = `/trips/${convo.id}/chat` // Link to trip chat page

        return (
          <Link href={linkHref} key={convo.id} legacyBehavior>
            <a className="block transition-all hover:bg-gray-50 active:scale-[0.98]">
              <Card className="flex items-center space-x-4 p-4 shadow-sm hover:shadow-md">
                <Avatar className="size-12">
                  <AvatarImage
                    src={convo.imageUrl ?? undefined}
                    alt={convo.name}
                  />
                  <AvatarFallback className="bg-gray-200">
                    {/* Replaced Users icon */}
                    <i className="fi fi-rr-users text-xl text-gray-500"></i>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <h3 className="truncate font-semibold">{convo.name}</h3>
                  {convo.latestMessage ? (
                    <p className="truncate text-sm text-gray-500">
                      {/* Show "You:" if the current user sent the last message */}
                      {convo.latestMessage.senderId === currentUserId
                        ? "You: "
                        : `${convo.latestMessage.senderName}: `}
                      {convo.latestMessage.content}
                    </p>
                  ) : (
                    <p className="truncate text-sm italic text-gray-400">
                      No messages yet
                    </p>
                  )}
                </div>
                {convo.latestMessage && (
                  <div className="ml-auto flex flex-col items-end text-xs text-gray-400">
                    <span>{formatTimeAgo(convo.latestMessage.timestamp)}</span>
                    {/* Placeholder for unread count badge */}
                    {/* {convo.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-1 px-1.5 py-0.5">
                        {convo.unreadCount}
                      </Badge>
                    )} */}
                  </div>
                )}
              </Card>
            </a>
          </Link>
        )
      })}
    </div>
  )
}
