/**
 * @description
 * Defines types related to chat conversations for both Personal Chats and Group Chats.
 * UPDATED: Renamed `senderName` to `senderUsername` to match schema refactor.
 */

import {
  SelectProfile,
  SelectDirectMessage,
  SelectDirectMessageConversation
} from "@/db/schema"

// Preview for a personal chat conversation in the chat list.
export interface ConversationPreview extends SelectDirectMessageConversation {
  otherParticipant: SelectProfile | null
  latestMessage: {
    content: string
    timestamp: Date
    senderId: string
    senderName: string // This will be the username now
  } | null
  unreadCount: number
}

// Preview for a group chat conversation in the chat list.
export interface GroupConversationPreview {
  tripId: string
  tripTitle: string
  tripPhotoUrl: string | null
  latestMessage: {
    content: string
    timestamp: Date
    senderId: string
    senderName: string // Changed from senderName
  } | null
  memberCount: number
  updatedAt: Date
}
