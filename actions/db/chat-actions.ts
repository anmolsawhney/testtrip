"use server"

/**
 * @description
 * Enhanced server actions for managing group chat messages in the TripRizz application.
 * Provides comprehensive functionality for trip group chats.
 *
 * Key features:
 * - Create: Add new chat messages with membership validation
 * - Read: Retrieve messages for a specific trip with pagination
 * - Delete: Remove messages (admin/moderation function)
 * - Membership: Check if user can access chat
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema": Schema definitions (chatMessagesTable, tripMembersTable)
 * - "@/types": ActionState type
 * - "drizzle-orm": Query builder
 *
 * @notes
 * - Validates that sender is a trip member before allowing messages
 * - Orders messages chronologically for proper display
 * - Supports pagination for efficient loading
 * - Allows deletion only by message sender (or future: trip owner)
 * - Integrated with trip member status to enforce access control
 */

import { db } from "@/db/db"
import { ActionState } from "@/types"
import { eq, and, desc, asc, ne, gt, sql } from "drizzle-orm"
import { count as drizzleCount } from "drizzle-orm"
import {
  InsertChatMessage,
  SelectChatMessage,
  chatMessagesTable,
  tripMembersTable
} from "@/db/schema"

/**
 * Creates a new chat message after validating membership
 * @param tripId The ID of the trip
 * @param senderId The ID of the message sender
 * @param content The message content
 * @returns ActionState with the created message or error
 */
export async function createChatMessageAction(
  tripId: string,
  senderId: string,
  content: string
): Promise<ActionState<SelectChatMessage>> {
  try {
    if (!tripId || !senderId || !content.trim()) {
      return {
        isSuccess: false,
        message: "Missing required fields: tripId, senderId, or content"
      }
    }

    // Check if user is a member of the trip
    const isMember = await db.query.tripMembers.findFirst({
      where: and(
        eq(tripMembersTable.tripId, tripId),
        eq(tripMembersTable.userId, senderId)
      )
    })

    if (!isMember) {
      return {
        isSuccess: false,
        message: "You must be a member of this trip to send messages"
      }
    }

    const [newMessage] = await db
      .insert(chatMessagesTable)
      .values({
        tripId,
        senderId,
        content: content.trim()
      })
      .returning()

    return {
      isSuccess: true,
      message: "Message sent successfully",
      data: newMessage
    }
  } catch (error) {
    console.error("Error creating chat message:", error)
    return { isSuccess: false, message: "Failed to send message" }
  }
}

/**
 * Retrieves chat messages for a specific trip in chronological order
 * @param tripId The ID of the trip
 * @param limit Optional limit for number of messages (default: 50)
 * @param offset Optional offset for pagination (default: 0)
 * @returns ActionState with the list of messages or error
 */
export async function getChatMessagesAction(
  tripId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectChatMessage[]>> {
  try {
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.tripId, tripId))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(limit)
      .offset(offset)

    return {
      isSuccess: true,
      message: "Chat messages retrieved successfully",
      data: messages
    }
  } catch (error) {
    console.error("Error getting chat messages:", error)
    return { isSuccess: false, message: "Failed to get messages" }
  }
}

/**
 * Deletes a chat message (for moderation purposes)
 * @param messageId The ID of the message to delete
 * @param userId The ID of the user attempting to delete the message
 * @returns ActionState indicating success or failure
 */
export async function deleteChatMessageAction(
  messageId: string,
  userId: string
): Promise<ActionState<void>> {
  try {
    // First check if the user is the sender of the message
    const message = await db.query.chatMessages.findFirst({
      where: eq(chatMessagesTable.id, messageId)
    })

    if (!message) {
      return { isSuccess: false, message: "Message not found" }
    }

    // Only allow deletion if user is the sender
    if (message.senderId !== userId) {
      return {
        isSuccess: false,
        message: "Not authorized to delete this message"
      }
    }

    await db
      .delete(chatMessagesTable)
      .where(eq(chatMessagesTable.id, messageId))

    return {
      isSuccess: true,
      message: "Message deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting chat message:", error)
    return { isSuccess: false, message: "Failed to delete message" }
  }
}

/**
 * Checks if a user can access a trip's chat
 * @param tripId The ID of the trip
 * @param userId The ID of the user
 * @returns ActionState with boolean result or error
 */
export async function canAccessTripChatAction(
  tripId: string,
  userId: string
): Promise<ActionState<boolean>> {
  try {
    // Check if user is a member of the trip
    const isMember = await db.query.tripMembers.findFirst({
      where: and(
        eq(tripMembersTable.tripId, tripId),
        eq(tripMembersTable.userId, userId)
      )
    })

    return {
      isSuccess: true,
      message: "Chat access checked successfully",
      data: !!isMember
    }
  } catch (error) {
    console.error("Error checking chat access:", error)
    return { isSuccess: false, message: "Failed to check chat access" }
  }
}

/**
 * Gets the latest chat messages for multiple trips
 * Useful for showing previews in a list of chats
 * @param tripIds Array of trip IDs to get the latest message for
 * @returns ActionState with a map of tripId to latest message
 */
export async function getLatestChatMessagesAction(
  tripIds: string[]
): Promise<ActionState<Record<string, SelectChatMessage>>> {
  try {
    if (!tripIds.length) {
      return {
        isSuccess: true,
        message: "No trip IDs provided",
        data: {}
      }
    }

    // For each trip, get the most recent message
    const result: Record<string, SelectChatMessage> = {}
    
    for (const tripId of tripIds) {
      const messages = await db
        .select()
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.tripId, tripId))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(1)
      
      if (messages.length > 0) {
        result[tripId] = messages[0]
      }
    }

    return {
      isSuccess: true,
      message: "Latest messages retrieved successfully",
      data: result
    }
  } catch (error) {
    console.error("Error getting latest chat messages:", error)
    return { isSuccess: false, message: "Failed to get latest messages" }
  }
}

/**
 * Gets the number of unread messages for a user in a specific trip chat
 * @param tripId The ID of the trip
 * @param userId The ID of the user
 * @param lastReadTimestamp The timestamp when the user last read the chat
 * @returns ActionState with the count of unread messages
 */
export async function getUnreadMessageCountAction(
  tripId: string,
  userId: string,
  lastReadTimestamp: Date
): Promise<ActionState<number>> {
  try {
    // Count messages that were created after the lastReadTimestamp and not by the current user
    const queryResult = await db
      .select({ messageCount: drizzleCount() })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.tripId, tripId),
          gt(chatMessagesTable.createdAt, lastReadTimestamp),
          ne(chatMessagesTable.senderId, userId)
        )
      )

    const messageCount = Number(queryResult[0]?.messageCount || 0)

    return {
      isSuccess: true,
      message: "Unread message count retrieved successfully",
      data: messageCount
    }
  } catch (error) {
    console.error("Error getting unread message count:", error)
    return { isSuccess: false, message: "Failed to get unread count" }
  }
}