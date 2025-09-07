/**
 * @description
 * Server actions for managing group chat functionality in TripRizz.
 * Provides functionality for creating, retrieving, and managing chat messages
 * for trip group chats.
 * UPDATED: Added actions to get unread message counts and mark chats as read,
 * leveraging the new `last_read_at` timestamp in the `trip_members` table.
 *
 * Key features:
 * - Create new chat messages with sender verification
 * - Retrieve messages for a specific trip with pagination
 * - Delete messages (admin/moderation function)
 * - Access control checks for chat participation
 * - Get unread message count for a specific user and trip. // NEW
 * - Mark a group chat as read for a specific user. // NEW
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema": Schema definitions for chat messages and trip members
 * - "@/types": ActionState type
 * - "drizzle-orm": Query builder
 * - "@clerk/nextjs/server": For user authentication.
 *
 * @notes
 * - Validates that sender is a trip member before allowing messages
 * - Orders messages chronologically for proper display
 * - Supports pagination for efficient loading
 * - Allows deletion only by message sender or trip owner
 */

"use server"

import { db } from "@/db/db"
import { ActionState } from "@/types"
import { eq, and, desc, asc, ne, gt, sql } from "drizzle-orm"
import { count as drizzleCount } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import {
  InsertChatMessage,
  SelectChatMessage,
  chatMessagesTable,
  tripMembersTable,
  itinerariesTable
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

    // Create the message
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
 * Gets chat messages for a trip with pagination support
 * @param tripId The ID of the trip
 * @param limit Maximum number of messages to retrieve (default 50)
 * @param offset Pagination offset (default 0)
 * @returns ActionState with array of chat messages or error
 */
export async function getChatMessagesAction(
  tripId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectChatMessage[]>> {
  try {
    if (!tripId) {
      return {
        isSuccess: false,
        message: "Trip ID is required"
      }
    }

    // Retrieve messages with pagination and chronological ordering
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
    return { isSuccess: false, message: "Failed to get chat messages" }
  }
}

/**
 * Gets the number of unread messages for a user in a specific trip chat.
 * @param tripId The ID of the trip
 * @returns ActionState with the count of unread messages
 */
export async function getUnreadGroupMessageCountAction(
  tripId: string
): Promise<ActionState<number>> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: true, message: "User not logged in.", data: 0 };
  }

  try {
    const memberRecord = await db.query.tripMembers.findFirst({
      where: and(
        eq(tripMembersTable.tripId, tripId),
        eq(tripMembersTable.userId, userId)
      ),
      columns: { lastReadAt: true }
    });

    // If not a member, they have no unread messages for this trip
    if (!memberRecord) {
      return { isSuccess: true, message: "User is not a member.", data: 0 };
    }

    const lastReadTimestamp = memberRecord.lastReadAt;

    // If lastReadAt is null, all messages from others are unread.
    // If it has a value, count messages created after that time by other users.
    const queryResult = await db
      .select({ messageCount: drizzleCount() })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.tripId, tripId),
          ne(chatMessagesTable.senderId, userId),
          // If lastReadTimestamp is null, this condition will be effectively ignored by some DBs
          // or needs to be handled. Here we add a check: if it's null, we don't filter by date.
          lastReadTimestamp ? gt(chatMessagesTable.createdAt, lastReadTimestamp) : undefined
        )
      );

    const messageCount = Number(queryResult[0]?.messageCount || 0);

    return {
      isSuccess: true,
      message: "Unread message count retrieved successfully",
      data: messageCount
    };
  } catch (error) {
    console.error("Error getting unread message count:", error);
    return { isSuccess: false, message: "Failed to get unread count" };
  }
}

/**
 * Marks a trip's group chat as read for the current user by updating their `lastReadAt` timestamp.
 * @param tripId The ID of the trip chat to mark as read.
 * @returns ActionState indicating success or failure.
 */
export async function markGroupChatAsReadAction(tripId: string): Promise<ActionState<void>> {
  const { userId } = await auth();
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    console.log(`[Action markGroupChatAsRead] Marking chat for trip ${tripId} as read by user ${userId}.`);
    const now = new Date();
    await db.update(tripMembersTable)
      .set({ lastReadAt: now })
      .where(and(
        eq(tripMembersTable.tripId, tripId),
        eq(tripMembersTable.userId, userId)
      ));

    return { isSuccess: true, message: "Chat marked as read.", data: undefined };
  } catch (error) {
    console.error(`Error marking group chat as read for trip ${tripId}:`, error);
    return { isSuccess: false, message: "Failed to mark chat as read." };
  }
}


/**
 * Deletes a chat message (only by sender or trip owner)
 * @param messageId The ID of the message to delete
 * @param requestorId ID of the user requesting deletion (for permission check)
 * @returns ActionState indicating success or failure
 */
export async function deleteChatMessageAction(
  messageId: string,
  requestorId: string
): Promise<ActionState<void>> {
  try {
    if (!messageId || !requestorId) {
      return {
        isSuccess: false,
        message: "Message ID and requestor ID are required"
      }
    }

    const message = await db.query.chatMessages.findFirst({
      where: eq(chatMessagesTable.id, messageId)
    })

    if (!message) {
      return {
        isSuccess: false,
        message: "Message not found"
      }
    }

    const isMessageSender = message.senderId === requestorId

    const isTripOwner = await db.query.tripMembers.findFirst({
      where: and(
        eq(tripMembersTable.tripId, message.tripId),
        eq(tripMembersTable.userId, requestorId),
        eq(tripMembersTable.role, "owner")
      )
    })

    if (!isMessageSender && !isTripOwner) {
      return {
        isSuccess: false,
        message: "You don't have permission to delete this message"
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
    if (!tripId || !userId) {
      return {
        isSuccess: false,
        message: "Trip ID and User ID are required"
      }
    }

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