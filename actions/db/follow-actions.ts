/**
 * @description
 * Server actions for managing the follow system in TripRizz.
 * Includes actions for creating, accepting, rejecting, and managing follow relationships.
 * CORRECTED: The `getFollowersAction` and `getFollowingAction` now correctly sort by `username`.
 * UPDATED: All actions that fetch profile data now filter out soft-deleted users (username like 'deleted_%').
 *
 * Key features:
 * - Follow/Unfollow: Allows users to manage who they follow.
 * - Request Management: Handles sending, accepting, rejecting, and canceling follow requests.
 * - Status Checks: Provides actions to get the follow status between users and fetch follower/following lists.
 * - Get Mutuals: Fetches a list of mutual followers for sharing features.
 * - Dismissal: Allows users to dismiss 'accepted' follow notifications.
 * - Authorization: Ensures users are authenticated and perform actions within permissions.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (followsTable, profilesTable, directMessageConversationsTable).
 * - "@/types": ActionState, FollowRequest, FollowStatus, SelectProfile types.
 * - "@clerk/nextjs/server": For user authentication (`auth`).
 * - "drizzle-orm": For query building functions (eq, and, or, desc, not, like).
 * - "drizzle-orm/pg-core": For aliasing tables.
 * - "./activity-feed-actions": For creating activity feed events.
 */
"use server";

import { db } from "@/db/db";
import {
  followsTable,
  profilesTable,
  InsertFollow,
  SelectFollow,
  SelectProfile as DbSelectProfile,
  followStatusEnum,
  directMessageConversationsTable,
} from "@/db/schema";
import { ActionState, FollowRequest, FollowStatus, SelectProfile } from "@/types";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, not, or, like } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createActivityEventAction } from "./activity-feed-actions";

export async function sendFollowRequestAction(
  followerId: string,
  followingId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== followerId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  if (followerId === followingId) {
    return { isSuccess: false, message: "You cannot follow yourself." };
  }

  try {
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId)
      ),
    });

    if (existingFollow) {
      if (existingFollow.status === "pending") {
        return { isSuccess: false, message: "Follow request already sent." };
      } else {
        return { isSuccess: false, message: "You are already following this user." };
      }
    }

     const incomingRequest = await db.query.follows.findFirst({
         where: and(
             eq(followsTable.followerId, followingId),
             eq(followsTable.followingId, followerId),
             eq(followsTable.status, "pending")
         ),
         columns: { followerId: true }
     });

     if (incomingRequest) {
         console.log(`[Action sendFollowRequest] Found incoming request from ${followingId}. Accepting automatically.`);
         const acceptResult = await acceptFollowRequestAction(followingId, followerId);
         if (acceptResult.isSuccess) {
            return { isSuccess: true, message: "Follow request accepted automatically.", data: undefined };
         } else {
            return { isSuccess: false, message: acceptResult.message };
         }
     }

    await db.insert(followsTable).values({
      followerId: followerId,
      followingId: followingId,
      status: "pending",
    });

    return { isSuccess: true, message: "Follow request sent successfully.", data: undefined };
  } catch (error) {
    console.error("Error sending follow request:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to send follow request.",
    };
  }
}

export async function acceptFollowRequestAction(
  followerId: string,
  followingId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== followingId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    const request = await db.query.follows.findFirst({
      where: and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId),
        eq(followsTable.status, "pending")
      ),
       columns: { followerId: true, followingId: true }
    });

    if (!request) {
      return { isSuccess: false, message: "Follow request not found or already actioned." };
    }

    await db
      .update(followsTable)
      .set({
        status: "accepted",
        updatedAt: new Date(),
        isDismissedByFollower: false,
      })
      .where(and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId)
      ));
      
    const [id1, id2] = [followerId, followingId].sort();
    await db
      .update(directMessageConversationsTable)
      .set({ status: 'active', updatedAt: new Date() })
      .where(
        and(
          eq(directMessageConversationsTable.user1Id, id1),
          eq(directMessageConversationsTable.user2Id, id2),
          eq(directMessageConversationsTable.status, 'request')
        )
      );
    console.log(`[Action acceptFollowRequest] Checked and upgraded DM conversation status between ${followerId} and ${followingId} to active if it existed.`);


    await createActivityEventAction({
        userId: request.followerId,
        eventType: 'follow',
        relatedId: request.followingId,
        targetUserId: request.followingId
    });
    console.log(`[Action acceptFollowRequest] Created 'follow' activity event for ${request.followerId} following ${request.followingId}`);


    return { isSuccess: true, message: "Follow request accepted.", data: undefined };
  } catch (error) {
    console.error("Error accepting follow request:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to accept follow request.",
    };
  }
}

export async function rejectFollowRequestAction(
  followerId: string,
  followingId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== followingId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    const result = await db
      .delete(followsTable)
      .where(and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId),
        eq(followsTable.status, "pending")
      ))
      .returning({ id: followsTable.followerId });

    if (result.length === 0) {
        return { isSuccess: false, message: "Follow request not found or already actioned." };
    }

    return { isSuccess: true, message: "Follow request rejected.", data: undefined };
  } catch (error) {
    console.error("Error rejecting follow request:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to reject follow request.",
    };
  }
}

export async function unfollowUserAction(
  followerId: string,
  followingId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== followerId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    const result = await db
      .delete(followsTable)
      .where(and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId),
        eq(followsTable.status, "accepted")
      ))
      .returning({ id: followsTable.followerId });

    if (result.length === 0) {
        return { isSuccess: false, message: "You are not following this user." };
    }

    return { isSuccess: true, message: "User unfollowed successfully.", data: undefined };
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to unfollow user.",
    };
  }
}

export async function cancelFollowRequestAction(
  followerId: string,
  followingId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== followerId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    const result = await db
      .delete(followsTable)
      .where(and(
        eq(followsTable.followerId, followerId),
        eq(followsTable.followingId, followingId),
        eq(followsTable.status, "pending")
      ))
      .returning({ id: followsTable.followerId });

     if (result.length === 0) {
         return { isSuccess: false, message: "No pending follow request found to cancel." };
     }

    return { isSuccess: true, message: "Follow request cancelled.", data: undefined };
  } catch (error) {
    console.error("Error cancelling follow request:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to cancel follow request.",
    };
  }
}

export async function getFollowRequestsAction(
  userId: string,
  type: "incoming" | "outgoing"
): Promise<ActionState<FollowRequest[]>> {
  const { userId: currentUserId } = await auth();
  if (!currentUserId || currentUserId !== userId) {
    return { isSuccess: false, message: "Unauthorized" };
  }

  try {
    let requestsQuery;
    if (type === "incoming") {
      requestsQuery = db
        .select({
          follow: followsTable,
          profile: profilesTable,
        })
        .from(followsTable)
        .innerJoin(profilesTable, and(
          eq(followsTable.followerId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        ))
        .where(and(
          eq(followsTable.followingId, userId),
          eq(followsTable.status, "pending")
        ))
        .orderBy(desc(followsTable.createdAt));
    } else {
      requestsQuery = db
        .select({
          follow: followsTable,
          profile: profilesTable,
        })
        .from(followsTable)
        .innerJoin(profilesTable, and(
          eq(followsTable.followingId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        ))
        .where(and(
          eq(followsTable.followerId, userId),
          eq(followsTable.status, "pending")
        ))
        .orderBy(desc(followsTable.createdAt));
    }

    const results = await requestsQuery;

    const followRequests: FollowRequest[] = results.map(r => ({
      followerId: r.follow.followerId,
      followingId: r.follow.followingId,
      status: 'pending',
      createdAt: r.follow.createdAt,
      updatedAt: r.follow.updatedAt,
      profile: r.profile
    }));

    return {
      isSuccess: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} follow requests retrieved.`,
      data: followRequests,
    };
  } catch (error) {
    console.error(`Error getting ${type} follow requests:`, error);
    return {
      isSuccess: false,
      message: `Failed to get ${type} follow requests.`,
    };
  }
}

export async function getFollowStatusAction(
  viewerId: string,
  profileId: string
): Promise<ActionState<FollowStatus>> {
  if (!viewerId) {
      return { isSuccess: true, message: "Viewer not logged in.", data: "not_following" };
  }

  if (viewerId === profileId) {
    return { isSuccess: true, message: "Viewing own profile.", data: "self" };
  }

  try {
    const viewerFollowsProfile = await db.query.follows.findFirst({
      where: and(
        eq(followsTable.followerId, viewerId),
        eq(followsTable.followingId, profileId)
      ),
       columns: { status: true }
    });

    if (viewerFollowsProfile) {
      return {
        isSuccess: true,
        message: "Follow status retrieved.",
        data: viewerFollowsProfile.status === "accepted" ? "following" : "pending_outgoing",
      };
    }

    const profileFollowsViewer = await db.query.follows.findFirst({
      where: and(
        eq(followsTable.followerId, profileId),
        eq(followsTable.followingId, viewerId),
        eq(followsTable.status, "pending")
      ),
       columns: { status: true }
    });

    if (profileFollowsViewer) {
      return {
        isSuccess: true,
        message: "Follow status retrieved.",
        data: "pending_incoming",
      };
    }

    return {
      isSuccess: true,
      message: "Follow status retrieved.",
      data: "not_following",
    };
  } catch (error) {
    console.error("Error getting follow status:", error);
    return {
      isSuccess: false,
      message: "Failed to get follow status.",
    };
  }
}

export async function getFollowersAction(
  userId: string
): Promise<ActionState<SelectProfile[]>> {
  try {
    const results = await db
      .select({ profile: profilesTable })
      .from(followsTable)
      .innerJoin(profilesTable, eq(followsTable.followerId, profilesTable.userId))
      .where(and(
        eq(followsTable.followingId, userId),
        eq(followsTable.status, "accepted"),
        not(like(profilesTable.username, "deleted_%"))
      ))
      .orderBy(desc(profilesTable.username));

    const followers: SelectProfile[] = results.map(r => ({
      ...r.profile,
      isAdmin: false
    }));

    return {
      isSuccess: true,
      message: "Followers retrieved successfully.",
      data: followers,
    };
  } catch (error) {
    console.error("Error getting followers:", error);
    return {
      isSuccess: false,
      message: "Failed to get followers.",
    };
  }
}

export async function getFollowingAction(
  userId: string
): Promise<ActionState<SelectProfile[]>> {
  try {
    const results = await db
      .select({ profile: profilesTable })
      .from(followsTable)
      .innerJoin(profilesTable, eq(followsTable.followingId, profilesTable.userId))
      .where(and(
        eq(followsTable.followerId, userId),
        eq(followsTable.status, "accepted"),
        not(like(profilesTable.username, "deleted_%"))
      ))
      .orderBy(desc(profilesTable.username));

    const following: SelectProfile[] = results.map(r => ({
        ...r.profile,
        isAdmin: false
    }));

    return {
      isSuccess: true,
      message: "Following list retrieved successfully.",
      data: following,
    };
  } catch (error) {
    console.error("Error getting following list:", error);
    return {
      isSuccess: false,
      message: "Failed to get following list.",
    };
  }
}

export async function dismissFollowNotificationAction(
    followerId: string,
    followingId: string
): Promise<ActionState<void>> {
    const { userId: currentUserId } = await auth();
    if (!currentUserId || currentUserId !== followerId) {
        return { isSuccess: false, message: "Unauthorized: Can only dismiss own notifications." };
    }

    try {
        const result = await db
            .update(followsTable)
            .set({ isDismissedByFollower: true, updatedAt: new Date() })
            .where(and(
                eq(followsTable.followerId, followerId),
                eq(followsTable.followingId, followingId),
                eq(followsTable.status, 'accepted')
            ))
            .returning({ id: followsTable.followerId });

        if (result.length === 0) {
            console.warn(`[Action dismissFollowNotification] No accepted follow record found for follower ${followerId} -> following ${followingId} to dismiss.`);
            return { isSuccess: true, message: "Notification already dismissed or not found.", data: undefined };
        }

        console.log(`[Action dismissFollowNotification] Marked follow notification as dismissed for follower ${followerId} regarding user ${followingId}.`);
        return { isSuccess: true, message: "Follow notification dismissed.", data: undefined };
    } catch (error) {
        console.error("Error dismissing follow notification:", error);
        return {
            isSuccess: false,
            message: error instanceof Error ? error.message : "Failed to dismiss follow notification.",
        };
    }
}

export async function getMutualFollowersAction(): Promise<ActionState<SelectProfile[]>> {
    const { userId } = await auth();
    if (!userId) {
        return { isSuccess: false, message: "Unauthorized: User not logged in." };
    }

    try {
        console.log(`[Action getMutualFollowers] Fetching mutuals for user ${userId}.`);
        const f1 = alias(followsTable, 'f1');
        const f2 = alias(followsTable, 'f2');

        const mutualFollows = await db
            .select({
                profile: profilesTable
            })
            .from(f1)
            .innerJoin(f2, and(
                eq(f1.followingId, f2.followerId),
                eq(f1.followerId, f2.followingId)
            ))
            .innerJoin(profilesTable, eq(profilesTable.userId, f1.followingId))
            .where(and(
                eq(f1.followerId, userId),
                eq(f1.status, 'accepted'),
                eq(f2.status, 'accepted'),
                not(like(profilesTable.username, "deleted_%"))
            ))
            .orderBy(desc(profilesTable.username));

        const mutualProfiles: SelectProfile[] = mutualFollows.map(r => ({
            ...r.profile,
            isAdmin: false
        }));
        
        console.log(`[Action getMutualFollowers] Found ${mutualProfiles.length} mutual followers for user ${userId}.`);

        return {
            isSuccess: true,
            message: "Mutual followers retrieved successfully.",
            data: mutualProfiles,
        };

    } catch (error) {
        console.error("Error getting mutual followers:", error);
        return {
            isSuccess: false,
            message: "Failed to get mutual followers.",
        };
    }
}