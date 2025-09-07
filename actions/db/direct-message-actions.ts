/**
 * @description
 * Server actions for managing Direct Messages (DMs) and listing conversations (including Group Chats) in TripRizz.
 * Handles creating/finding conversations, sending messages, listing conversations,
 * fetching messages, managing user blocks, handling message requests, and marking messages as read.
 * UPDATED: The `shareTripViaDmAction` now formats the shared trip as a clickable markdown link.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState, ConversationPreview, GroupConversationPreview types.
 * - "@clerk/nextjs/server": For user authentication.
 * - "drizzle-orm": For database operations.
 * - "./follow-actions": For getFollowStatusAction to check relationship for message requests.
 * - "./profiles-actions": For fetching profile data.
 */
"use server"

import { db } from "@/db/db"
import {
  directMessageConversationsTable,
  directMessagesTable,
  SelectDirectMessageConversation,
  InsertDirectMessageConversation,
  SelectDirectMessage,
  InsertDirectMessage,
  profilesTable,
  SelectProfile,
  blocksTable,
  InsertBlock,
  itinerariesTable,
  tripMembersTable,
  chatMessagesTable,
  SelectChatMessage,
  SelectItinerary
} from "@/db/schema"
import {
  ActionState,
  ConversationPreview,
  GroupConversationPreview
} from "@/types"
import { auth } from "@clerk/nextjs/server"
import {
  and,
  like,
  asc,
  desc,
  eq,
  gt,
  isNull,
  or,
  sql,
  count,
  inArray,
  not
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { getFollowStatusAction } from "./follow-actions"
import { getProfileByUserIdAction } from "./profiles-actions"

export async function checkBlockStatusAction(
  userId1: string,
  userId2: string,
  type: "dm" | "profile"
): Promise<ActionState<boolean>> {
  if (!userId1 || !userId2) {
    return { isSuccess: false, message: "Both user IDs are required." }
  }
  if (userId1 === userId2) {
    return { isSuccess: true, message: "Cannot block self.", data: false }
  }

  try {
    const blockExists = await db.query.blocks.findFirst({
      where: and(
        eq(blocksTable.type, type),
        or(
          and(
            eq(blocksTable.blockerId, userId1),
            eq(blocksTable.blockedId, userId2)
          ),
          and(
            eq(blocksTable.blockerId, userId2),
            eq(blocksTable.blockedId, userId1)
          )
        )
      ),
      columns: { blockerId: true }
    })

    return {
      isSuccess: true,
      message: "Block status checked.",
      data: !!blockExists
    }
  } catch (error) {
    console.error("[Action checkBlockStatus] Error:", error)
    return { isSuccess: false, message: "Failed to check block status." }
  }
}

export async function getOrCreateConversationAction(
  user1Id: string,
  user2Id: string,
  checkFollowStatus: boolean = false
): Promise<ActionState<SelectDirectMessageConversation>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || (currentUserId !== user1Id && currentUserId !== user2Id)) {
    return {
      isSuccess: false,
      message: "Unauthorized: User must be part of the conversation."
    }
  }

  if (user1Id === user2Id) {
    return {
      isSuccess: false,
      message: "Cannot create a conversation with yourself."
    }
  }
  const [id1, id2] = [user1Id, user2Id].sort()

  try {
    let conversation = await db.query.directMessageConversations.findFirst({
      where: and(
        eq(directMessageConversationsTable.user1Id, id1),
        eq(directMessageConversationsTable.user2Id, id2)
      )
    })

    if (conversation) {
      console.log(
        `[Action getOrCreateConversation] Found existing conversation ${conversation.id} between ${id1} and ${id2}.`
      )
      return {
        isSuccess: true,
        message: "Conversation retrieved successfully.",
        data: conversation
      }
    }

    let initialStatus: "active" | "request" = "request"
    if (checkFollowStatus) {
      const followStatusResult = await getFollowStatusAction(user1Id, user2Id)
      if (followStatusResult.isSuccess && followStatusResult.data === "following") {
        initialStatus = "active"
        console.log(
          `[Action getOrCreateConversation] Users ${user1Id} and ${user2Id} mutually follow. Setting initial status to 'active'.`
        )
      } else {
        console.log(
          `[Action getOrCreateConversation] Users ${user1Id} and ${user2Id} do not mutually follow. Setting initial status to 'request'.`
        )
      }
    }

    console.log(
      `[Action getOrCreateConversation] Creating new conversation between ${id1} and ${id2} with status '${initialStatus}'.`
    )
    const conversationData: InsertDirectMessageConversation = {
      user1Id: id1,
      user2Id: id2,
      status: initialStatus
    }

    const [newConversation] = await db
      .insert(directMessageConversationsTable)
      .values(conversationData)
      .returning()

    if (!newConversation)
      throw new Error("Conversation creation failed to return data.")

    console.log(
      `[Action getOrCreateConversation] Created new conversation ${newConversation.id}.`
    )
    return {
      isSuccess: true,
      message: "Conversation created successfully.",
      data: newConversation
    }
  } catch (error) {
    console.error("[Action getOrCreateConversation] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get or create conversation."
    }
  }
}

export async function sendMessageAction(
  conversationId: string | null | undefined,
  senderId: string,
  recipientId: string,
  content: string
): Promise<ActionState<SelectDirectMessage>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== senderId) {
    return {
      isSuccess: false,
      message: "Unauthorized: Sender ID does not match authenticated user."
    }
  }
  if (!recipientId || !content.trim()) {
    return {
      isSuccess: false,
      message: "Recipient ID and message content are required."
    }
  }
  if (senderId === recipientId) {
    return { isSuccess: false, message: "Cannot send a message to yourself." }
  }

  try {
    const blockCheck = await checkBlockStatusAction(senderId, recipientId, "dm")
    if (blockCheck.isSuccess && blockCheck.data === true) {
      console.log(
        `[Action sendMessage] Message blocked between ${senderId} and ${recipientId}.`
      )
      return {
        isSuccess: false,
        message: "Cannot send message: This user is blocked or has blocked you."
      }
    } else if (!blockCheck.isSuccess) {
      return {
        isSuccess: false,
        message: blockCheck.message || "Failed to check block status."
      }
    }

    let finalConversationId = conversationId
    let conversation: SelectDirectMessageConversation | undefined = undefined
    let requiresStatusUpdate = false

    if (!finalConversationId) {
      console.log(
        "[Action sendMessage] No conversationId provided, attempting to find/create..."
      )
      const convoResult = await getOrCreateConversationAction(
        senderId,
        recipientId,
        true
      )
      if (!convoResult.isSuccess || !convoResult.data) {
        return {
          isSuccess: false,
          message: convoResult.message || "Failed to find or create conversation."
        }
      }
      conversation = convoResult.data
      finalConversationId = conversation.id
      console.log(
        `[Action sendMessage] Found/created conversation ${finalConversationId} with status ${conversation.status}.`
      )
    } else {
      conversation = await db.query.directMessageConversations.findFirst({
        where: eq(directMessageConversationsTable.id, finalConversationId)
      })
      if (!conversation)
        return { isSuccess: false, message: "Conversation not found." }
      if (
        conversation.user1Id !== senderId &&
        conversation.user2Id !== senderId
      ) {
        return {
          isSuccess: false,
          message: "Unauthorized: Sender is not part of this conversation."
        }
      }
    }

    if (conversation && conversation.status === "request") {
      console.log(
        `[Action sendMessage] Conversation ${finalConversationId} is in 'request' status. Checking follow status...`
      )
      const followStatusResult = await getFollowStatusAction(
        senderId,
        recipientId
      )
      if (
        followStatusResult.isSuccess &&
        followStatusResult.data === "following"
      ) {
        console.log(
          `[Action sendMessage] Mutual follow detected for request conversation ${finalConversationId}. Will upgrade status.`
        )
        requiresStatusUpdate = true
      } else {
        console.log(
          `[Action sendMessage] No mutual follow for request conversation ${finalConversationId}. Status remains 'request'.`
        )
      }
    }

    const result = await db.transaction(async tx => {
      const messageData: InsertDirectMessage = {
        conversationId: finalConversationId!,
        senderId,
        content: content.trim()
      }
      const [newMessage] = await tx
        .insert(directMessagesTable)
        .values(messageData)
        .returning()
      if (!newMessage) throw new Error("Message insertion failed to return data.")

      const conversationUpdateData: Partial<InsertDirectMessageConversation> =
        {
          lastMessageId: newMessage.id,
          updatedAt: new Date()
        }
      if (requiresStatusUpdate) conversationUpdateData.status = "active"

      if (conversation!.user1Id === recipientId) {
        console.log(
          `[Action sendMessage] Resetting user1LastReadAt for recipient ${recipientId}`
        )
        conversationUpdateData.user1LastReadAt = null
      } else {
        console.log(
          `[Action sendMessage] Resetting user2LastReadAt for recipient ${recipientId}`
        )
        conversationUpdateData.user2LastReadAt = null
      }

      await tx
        .update(directMessageConversationsTable)
        .set(conversationUpdateData)
        .where(eq(directMessageConversationsTable.id, finalConversationId!))
      return newMessage
    })

    return { isSuccess: true, message: "Message sent successfully.", data: result }
  } catch (error) {
    console.error("[Action sendMessage] Error:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to send message."
    }
  }
}

export async function markConversationAsReadAction(
  conversationId: string,
  userId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== userId)
    return { isSuccess: false, message: "Unauthorized." }
  if (!conversationId)
    return { isSuccess: false, message: "Conversation ID is required." }

  try {
    const conversation = await db.query.directMessageConversations.findFirst({
      where: eq(directMessageConversationsTable.id, conversationId),
      columns: { user1Id: true, user2Id: true }
    })
    if (!conversation)
      return { isSuccess: false, message: "Conversation not found." }
    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      return {
        isSuccess: false,
        message: "User is not part of this conversation."
      }
    }

    const updateField =
      conversation.user1Id === userId ? "user1LastReadAt" : "user2LastReadAt"
    const now = new Date()
    console.log(
      `[Action markConversationAsRead] Updating ${updateField} for conversation ${conversationId}, user ${userId} to ${now.toISOString()}.`
    )
    await db
      .update(directMessageConversationsTable)
      .set({ [updateField]: now })
      .where(eq(directMessageConversationsTable.id, conversationId))
    return {
      isSuccess: true,
      message: "Conversation marked as read.",
      data: undefined
    }
  } catch (error) {
    console.error("[Action markConversationAsRead] Error:", error)
    return { isSuccess: false, message: "Failed to mark conversation as read." }
  }
}

export async function acceptMessageRequestAction(
  conversationId: string,
  userId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== userId)
    return { isSuccess: false, message: "Unauthorized." }
  if (!conversationId)
    return { isSuccess: false, message: "Conversation ID is required." }

  try {
    const conversation = await db.query.directMessageConversations.findFirst({
      where: and(
        eq(directMessageConversationsTable.id, conversationId),
        or(
          eq(directMessageConversationsTable.user1Id, userId),
          eq(directMessageConversationsTable.user2Id, userId)
        )
      ),
      columns: { id: true, status: true }
    })
    if (!conversation)
      return {
        isSuccess: false,
        message: "Conversation not found or user not a participant."
      }
    if (conversation.status !== "request")
      return {
        isSuccess: true,
        message: "Conversation is already active.",
        data: undefined
      }

    console.log(
      `[Action acceptMessageRequest] User ${userId} accepting request for conversation ${conversationId}.`
    )
    await db
      .update(directMessageConversationsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(directMessageConversationsTable.id, conversationId))
    return {
      isSuccess: true,
      message: "Message request accepted.",
      data: undefined
    }
  } catch (error) {
    console.error("[Action acceptMessageRequest] Error:", error)
    return { isSuccess: false, message: "Failed to accept message request." }
  }
}

export async function blockUserAction(
  blockerId: string,
  blockedId: string,
  type: "dm"
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== blockerId)
    return { isSuccess: false, message: "Unauthorized" }
  if (blockerId === blockedId)
    return { isSuccess: false, message: "Cannot block yourself." }
  if (type !== "dm")
    return { isSuccess: false, message: "Invalid block type specified." }

  try {
    const blockData: InsertBlock = { blockerId, blockedId, type }
    await db.insert(blocksTable).values(blockData).onConflictDoNothing()
    console.log(
      `[Action blockUser] User ${blockerId} blocked user ${blockedId} for type ${type}.`
    )
    return {
      isSuccess: true,
      message: "User blocked successfully.",
      data: undefined
    }
  } catch (error) {
    console.error("[Action blockUser] Error:", error)
    return { isSuccess: false, message: "Failed to block user." }
  }
}

export async function unblockUserAction(
  blockerId: string,
  blockedId: string,
  type: "dm"
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== blockerId)
    return { isSuccess: false, message: "Unauthorized" }
  if (type !== "dm")
    return { isSuccess: false, message: "Invalid block type specified." }

  try {
    await db
      .delete(blocksTable)
      .where(
        and(
          eq(blocksTable.blockerId, blockerId),
          eq(blocksTable.blockedId, blockedId),
          eq(blocksTable.type, type)
        )
      )
    console.log(
      `[Action unblockUser] User ${blockerId} unblocked user ${blockedId} for type ${type}.`
    )
    return {
      isSuccess: true,
      message: "User unblocked successfully.",
      data: undefined
    }
  } catch (error) {
    console.error("[Action unblockUser] Error:", error)
    return { isSuccess: false, message: "Failed to unblock user." }
  }
}

export async function getMessagesAction(
  conversationId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectDirectMessage[]>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== userId)
    return { isSuccess: false, message: "Unauthorized." }
  if (!conversationId)
    return { isSuccess: false, message: "Conversation ID is required." }

  try {
    const conversation = await db.query.directMessageConversations.findFirst({
      where: and(
        eq(directMessageConversationsTable.id, conversationId),
        or(
          eq(directMessageConversationsTable.user1Id, userId),
          eq(directMessageConversationsTable.user2Id, userId)
        )
      ),
      columns: { id: true }
    })
    if (!conversation)
      return {
        isSuccess: false,
        message: "Unauthorized: Conversation not found or user not a participant."
      }

    const messages = await db
      .select()
      .from(directMessagesTable)
      .where(eq(directMessagesTable.conversationId, conversationId))
      .orderBy(asc(directMessagesTable.createdAt))
      .limit(limit)
      .offset(offset)
    await markConversationAsReadAction(conversationId, userId)
    return {
      isSuccess: true,
      message: "Messages retrieved successfully.",
      data: messages
    }
  } catch (error) {
    console.error("[Action getMessages] Error:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to get messages."
    }
  }
}

export async function listConversationsAction(): Promise<
  ActionState<{
    chats: ConversationPreview[]
    requests: ConversationPreview[]
    groupChats: GroupConversationPreview[]
  }>
> {
  const { userId } = await auth()
  if (!userId) return { isSuccess: false, message: "Unauthorized: User not logged in." }

  const p1 = alias(profilesTable, "p1")
  const p2 = alias(profilesTable, "p2")

  try {
    const dmConversationsData = await db
      .select({
        conversation: directMessageConversationsTable,
        lastMessage: directMessagesTable,
        user1Profile: p1,
        user2Profile: p2
      })
      .from(directMessageConversationsTable)
      .leftJoin(
        directMessagesTable,
        eq(directMessageConversationsTable.lastMessageId, directMessagesTable.id)
      )
      .leftJoin(p1, eq(directMessageConversationsTable.user1Id, p1.userId))
      .leftJoin(p2, eq(directMessageConversationsTable.user2Id, p2.userId))
      .where(
        or(
          eq(directMessageConversationsTable.user1Id, userId),
          eq(directMessageConversationsTable.user2Id, userId)
        )
      )
      .orderBy(desc(directMessageConversationsTable.updatedAt))

    const chats: ConversationPreview[] = []
    const requests: ConversationPreview[] = []
    dmConversationsData.forEach(
      ({ conversation, lastMessage, user1Profile, user2Profile }) => {
        const otherParticipantProfile: SelectProfile | null =
          conversation.user1Id === userId ? user2Profile : user1Profile

        // Skip if other participant doesn't exist or is soft-deleted
        if (
          !otherParticipantProfile ||
          otherParticipantProfile.username?.startsWith("deleted_")
        ) {
          return
        }

        let isUnread = false
        if (lastMessage && lastMessage.senderId !== userId) {
          const userLastReadAt =
            conversation.user1Id === userId
              ? conversation.user1LastReadAt
              : conversation.user2LastReadAt
          if (!userLastReadAt || lastMessage.createdAt > userLastReadAt)
            isUnread = true
        }
        const preview: ConversationPreview = {
          id: conversation.id,
          createdAt: conversation.createdAt,
          user1Id: conversation.user1Id,
          user2Id: conversation.user2Id,
          lastMessageId: conversation.lastMessageId,
          user1LastReadAt: conversation.user1LastReadAt,
          user2LastReadAt: conversation.user2LastReadAt,
          otherParticipant: otherParticipantProfile,
          latestMessage: lastMessage
            ? {
                content: lastMessage.content,
                timestamp: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                senderName:
                  lastMessage.senderId === userId
                    ? "You"
                    : otherParticipantProfile?.username ?? "User"
              }
            : null,
          unreadCount: isUnread ? 1 : 0,
          updatedAt: conversation.updatedAt,
          status: conversation.status
        }
        if (conversation.status === "active") chats.push(preview)
        else if (
          conversation.status === "request" &&
          lastMessage &&
          lastMessage.senderId !== userId
        )
          requests.push(preview)
      }
    )

    const groupChats: GroupConversationPreview[] = []
    const memberTrips = await db
      .select({ tripId: tripMembersTable.tripId, itinerary: itinerariesTable })
      .from(tripMembersTable)
      .innerJoin(
        itinerariesTable,
        eq(tripMembersTable.tripId, itinerariesTable.id)
      )
      .where(eq(tripMembersTable.userId, userId))

    const tripIds = memberTrips.map(mt => mt.tripId)

    if (tripIds.length > 0) {
      const allTripMessages = await db
        .select()
        .from(chatMessagesTable)
        .where(inArray(chatMessagesTable.tripId, tripIds))
        .orderBy(desc(chatMessagesTable.createdAt))

      const messagesByTrip = new Map<string, SelectChatMessage[]>()
      allTripMessages.forEach(msg => {
        const existing = messagesByTrip.get(msg.tripId) || []
        existing.push(msg)
        messagesByTrip.set(msg.tripId, existing)
      })

      const latestMessagesMap = new Map<string, SelectChatMessage>()
      messagesByTrip.forEach((msgs, tripId) => {
        if (msgs.length > 0) latestMessagesMap.set(tripId, msgs[0])
      })

      const allSenderIds = new Set<string>(
        Array.from(latestMessagesMap.values()).map(m => m.senderId)
      )
      let senderProfilesMap = new Map<string, SelectProfile>()
      if (allSenderIds.size > 0) {
        const senderProfiles = await db
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.userId, Array.from(allSenderIds)))
        senderProfilesMap = new Map(senderProfiles.map(p => [p.userId, p]))
      }

      for (const { tripId, itinerary } of memberTrips) {
        const latestMessage = latestMessagesMap.get(tripId)
        const senderProfile = latestMessage
          ? senderProfilesMap.get(latestMessage.senderId)
          : null
        const tripPhotoUrl =
          itinerary.cover_photo_url ?? itinerary.photos?.[0] ?? null

        groupChats.push({
          tripId: tripId,
          tripTitle: itinerary.title,
          tripPhotoUrl: tripPhotoUrl,
          latestMessage: latestMessage
            ? {
                content: latestMessage.content,
                timestamp: latestMessage.createdAt,
                senderId: latestMessage.senderId,
                senderName: senderProfile?.username ?? "User"
              }
            : null,
          memberCount: itinerary.currentGroupSize ?? 1,
          updatedAt: latestMessage?.createdAt ?? itinerary.updatedAt
        })
      }
      groupChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    }

    return {
      isSuccess: true,
      message: "Conversations listed successfully.",
      data: { chats, requests, groupChats }
    }
  } catch (error) {
    console.error("[Action listConversations] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to list conversations."
    }
  }
}

export async function shareTripViaDmAction(
  trip: SelectItinerary,
  recipientIds: string[]
): Promise<ActionState<void>> {
  const { userId: senderId } = await auth()
  if (!senderId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." }
  }
  if (!trip || !recipientIds || recipientIds.length === 0) {
    return {
      isSuccess: false,
      message: "Trip and at least one recipient are required."
    }
  }

  try {
    const senderProfileResult = await getProfileByUserIdAction(senderId)
    if (!senderProfileResult.isSuccess || !senderProfileResult.data) {
      return { isSuccess: false, message: "Could not retrieve sender profile." }
    }
    const senderName = senderProfileResult.data.username || "A user"
    const tripUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/trips/${trip.id}`
    const messageContent = `${senderName} shared a trip with you: [${trip.title}](${tripUrl})`

    console.log(
      `[Action shareTripViaDm] User ${senderId} sharing trip ${trip.id} with ${recipientIds.length} users.`
    )

    for (const recipientId of recipientIds) {
      if (senderId === recipientId) continue

      try {
        const convoResult = await getOrCreateConversationAction(
          senderId,
          recipientId,
          true
        )
        if (convoResult.isSuccess && convoResult.data) {
          await sendMessageAction(
            convoResult.data.id,
            senderId,
            recipientId,
            messageContent
          )
          console.log(
            `[Action shareTripViaDm] Successfully sent share message to ${recipientId}.`
          )
        } else {
          console.warn(
            `[Action shareTripViaDm] Could not get/create conversation for recipient ${recipientId}. Skipping. Error: ${convoResult.message}`
          )
        }
      } catch (innerError) {
        console.error(
          `[Action shareTripViaDm] Failed to send message to recipient ${recipientId}:`,
          innerError
        )
      }
    }

    return {
      isSuccess: true,
      message: "Trip shared successfully.",
      data: undefined
    }
  } catch (error) {
    console.error("[Action shareTripViaDm] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to share trip."
    }
  }
}