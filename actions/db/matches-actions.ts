/**
 * @description
 * Enhanced server actions for managing user matches in the TripRizz database.
 * Handles creation of matches, retrieval of potential matches, and retrieval of accepted matches.
 * UPDATED: The `getPotentialMatchesAction` now filters out users who have not completed the onboarding process,
 * ensuring only complete profiles are shown in the swipe feed.
 *
 * Key features:
 * - Create: Initiates or updates matches based on swipe actions. Creates mutual follows on acceptance.
 * - Reject: Creates a 'rejected' record to hide a profile for a configurable number of days.
 * - Read: Fetches potential matches excluding self, soft-deleted users, existing matches, followed users, and incomplete profiles.
 * - Read: Fetches accepted/established matches for a user, excluding soft-deleted users.
 * - Dismiss Notification: Allows users to hide an "accepted match" notification from their list.
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema/*": All relevant schema definitions.
 * - "@/types": ActionState and other type definitions.
 * - "drizzle-orm": Query builder functions.
 * - "@clerk/nextjs/server": For user authentication.
 * - "./activity-feed-actions": For creating activity events on follow.
 */

"use server"

import { db } from "@/db/db"
import {
  InsertMatch,
  matchesTable,
  SelectMatch
} from "@/db/schema/matches-schema"
import {
  profilesTable,
  SelectProfile as DbSelectProfile,
  followsTable
} from "@/db/schema"
import {
  itinerariesTable,
  SelectItinerary
} from "@/db/schema/itineraries-schema"
import { ActionState, ProfileWithTrips } from "@/types"
import { eq, not, and, inArray, or, sql, desc, gt, like } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import { createActivityEventAction } from "./activity-feed-actions"

// Type including match percentage
export type ProfileWithTripsAndMatchScore = ProfileWithTrips & {
  matchPercentage: number
}

/**
 * Calculates a simple match percentage based on shared preferences.
 * If the potential match's profile has travel preferences or answered questions,
 * the score is floored at a minimum of 40%. Otherwise, the raw score is returned.
 * @param profile1 The profile of the first user (viewer).
 * @param profile2 The profile of the second user (potential match).
 * @returns A number between 0 and 100.
 */
function calculateMatchPercentage(
  profile1: DbSelectProfile,
  profile2: DbSelectProfile
): number {
  let score = 0
  const maxScore = 100
  const minScore = 40 // The floor for non-empty profiles

  const weights = {
    travelPreferences: 70,
    budgetPreference: 30
  }

  // Check if profile2 has provided meaningful information for matching
  const hasTravelPrefs = (profile2.travelPreferences?.length ?? 0) > 0
  const hasQuestionAnswers = !!(
    profile2.qTravelMood ||
    profile2.qNightOwl ||
    profile2.qTravelPlaylist ||
    profile2.qMustPack ||
    profile2.qBucketListGoal ||
    profile2.qNextDestination
  )
  const isProfilePopulated = hasTravelPrefs || hasQuestionAnswers

  const prefs1 = new Set(profile1.travelPreferences ?? [])
  const prefs2 = new Set(profile2.travelPreferences ?? [])
  if (prefs1.size > 0 || prefs2.size > 0) {
    const intersection = new Set([...prefs1].filter(p => prefs2.has(p)))
    const union = new Set([...prefs1, ...prefs2])
    const preferenceScore =
      union.size > 0
        ? (intersection.size / union.size) * weights.travelPreferences
        : 0
    score += preferenceScore
  }

  if (
    profile1.budgetPreference &&
    profile2.budgetPreference &&
    profile1.budgetPreference === profile2.budgetPreference
  ) {
    score += weights.budgetPreference
  }

  const finalScore = Math.round(Math.min(score, maxScore))

  if (isProfilePopulated) {
    return finalScore < minScore ? minScore : finalScore
  }

  return finalScore
}

/**
 * Creates or accepts a match between two users. This action is now idempotent and respects
 * the `userId1 < userId2` database constraint. If a match is accepted, it also creates
 * a mutual follow relationship.
 * @param data The match data to insert, containing the two user IDs and the initiator.
 * @returns ActionState with the created/updated match or an error.
 */
export async function createMatchAction(
  data: InsertMatch
): Promise<ActionState<SelectMatch>> {
  try {
    if (!data.userId1 || !data.userId2 || !data.initiatedBy) {
      return { isSuccess: false, message: "Missing required fields" }
    }

    if (data.userId1 === data.userId2) {
      return { isSuccess: false, message: "Cannot match with yourself" }
    }

    const [sortedId1, sortedId2] = [data.userId1, data.userId2].sort()

    const existingMatch = await db.query.matches.findFirst({
      where: and(
        eq(matchesTable.userId1, sortedId1),
        eq(matchesTable.userId2, sortedId2)
      )
    })

    if (existingMatch) {
      if (
        existingMatch.status === "pending" &&
        existingMatch.initiatedBy !== data.initiatedBy
      ) {
        // --- MATCH ACCEPTED ---
        const updatedMatch = await db.transaction(async tx => {
          // Update match status
          const [match] = await tx
            .update(matchesTable)
            .set({
              status: "accepted",
              updatedAt: new Date(),
              isDismissedByUser1: false,
              isDismissedByUser2: false
            })
            .where(eq(matchesTable.id, existingMatch.id))
            .returning()

          // Create mutual follow records
          await tx
            .insert(followsTable)
            .values([
              {
                followerId: sortedId1,
                followingId: sortedId2,
                status: "accepted"
              },
              {
                followerId: sortedId2,
                followingId: sortedId1,
                status: "accepted"
              }
            ])
            .onConflictDoNothing() // Safely handle if a follow already exists

          return match
        })

        // Create activity feed events outside the transaction
        await createActivityEventAction({
          userId: sortedId1,
          eventType: "follow",
          relatedId: sortedId2,
          targetUserId: sortedId2
        })
        await createActivityEventAction({
          userId: sortedId2,
          eventType: "follow",
          relatedId: sortedId1,
          targetUserId: sortedId1
        })

        return {
          isSuccess: true,
          message: "Match accepted",
          data: updatedMatch
        }
      }
      return {
        isSuccess: true,
        message: `Match already exists with status: ${existingMatch.status}`,
        data: existingMatch
      }
    }

    // --- NEW PENDING MATCH ---
    const [newMatch] = await db
      .insert(matchesTable)
      .values({
        userId1: sortedId1,
        userId2: sortedId2,
        initiatedBy: data.initiatedBy,
        status: "pending"
      })
      .returning()

    if (!newMatch) {
      throw new Error("Match creation failed to return data.")
    }

    return {
      isSuccess: true,
      message: "Match request created",
      data: newMatch
    }
  } catch (error) {
    console.error("[Action createMatch] Error creating match:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to create match"
    }
  }
}

/**
 * Rejects a potential match, hiding the profile for a configurable number of days.
 * This creates a 'rejected' record.
 * @param dismisserId - The user performing the rejection (swiping left).
 * @param dismissedId - The user being rejected.
 * @returns ActionState indicating success or failure.
 */
export async function rejectMatchAction(
  dismisserId: string,
  dismissedId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== dismisserId) {
    return { isSuccess: false, message: "Unauthorized." }
  }

  try {
    const [userId1, userId2] = [dismisserId, dismissedId].sort()

    const existingRecord = await db.query.matches.findFirst({
      where: and(
        eq(matchesTable.userId1, userId1),
        eq(matchesTable.userId2, userId2)
      )
    })

    if (existingRecord) {
      if (existingRecord.status === "accepted") {
        return {
          isSuccess: true,
          message: "Cannot reject an existing match.",
          data: undefined
        }
      }
      // Update existing record to rejected
      await db
        .update(matchesTable)
        .set({
          status: "rejected",
          initiatedBy: dismisserId,
          updatedAt: new Date()
        })
        .where(eq(matchesTable.id, existingRecord.id))
    } else {
      // Insert new rejected record
      await db.insert(matchesTable).values({
        userId1,
        userId2,
        status: "rejected",
        initiatedBy: dismisserId
      })
    }

    return { isSuccess: true, message: "Profile rejected.", data: undefined }
  } catch (error) {
    console.error("Error rejecting match:", error)
    return { isSuccess: false, message: "Failed to reject profile." }
  }
}

/**
 * Fetches potential matches for a user, excluding self, existing interactions, and followed users.
 * Also fetches the completed trips for each potential match and calculates a match percentage.
 * Only includes users who have completed the onboarding process.
 *
 * @param userId The user ID for whom to fetch matches.
 * @param offset The pagination offset.
 * @param limit The maximum number of profiles to return.
 * @returns ActionState with an array of profiles including their completed trips and match score.
 */
export async function getPotentialMatchesAction(
  userId: string,
  offset: number = 0,
  limit: number = 10
): Promise<ActionState<ProfileWithTripsAndMatchScore[]>> {
  console.log(
    `[Action getPotentialMatches] Fetching potential matches for user: ${userId} (Offset: ${offset}, Limit: ${limit})`
  )
  try {
    const viewerProfile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })

    if (!viewerProfile) {
      return {
        isSuccess: false,
        message: "Could not find your profile to calculate matches."
      }
    }

    const cooldownDays = parseInt(
      process.env.MATCH_REJECTION_COOLDOWN_DAYS || "3",
      10
    )
    const cooldownDate = new Date(
      Date.now() - cooldownDays * 24 * 60 * 60 * 1000
    )

    // Get IDs of users the viewer is already following
    const followingRelations = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(
        and(
          eq(followsTable.followerId, userId),
          eq(followsTable.status, "accepted")
        )
      )

    // Initialize the set of users to exclude with self and followed users
    const excludedUserIds = new Set<string>([
      userId,
      ...followingRelations.map(f => f.followingId)
    ])

    // Get existing match interactions (pending, accepted, recent rejections)
    const existingInteractions = await db
      .select()
      .from(matchesTable)
      .where(
        or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId))
      )

    // Add users from match interactions to the exclusion set
    existingInteractions.forEach(match => {
      const otherUserId =
        match.userId1 === userId ? match.userId2 : match.userId1

      // Exclude accepted matches, pending outgoing requests, and recent rejections
      if (match.status === "accepted") {
        excludedUserIds.add(otherUserId)
      } else if (
        match.status === "rejected" &&
        match.initiatedBy === userId &&
        match.updatedAt > cooldownDate
      ) {
        excludedUserIds.add(otherUserId)
      } else if (match.status === "pending" && match.initiatedBy === userId) {
        excludedUserIds.add(otherUserId)
      }
    })

    const potentialMatches: DbSelectProfile[] =
      await db.query.profiles.findMany({
        where: and(
          // Ensure we don't fetch users we've already interacted with.
          excludedUserIds.size > 0
            ? not(inArray(profilesTable.userId, Array.from(excludedUserIds)))
            : not(eq(profilesTable.userId, userId)),
          // Explicitly exclude users that have been "soft-deleted".
          not(like(profilesTable.username, "deleted_%")),
          // Ensure that only profiles with completed onboarding are shown in matches.
          eq(profilesTable.profileQuestionsCompleted, true)
        ),
        limit: limit,
        offset: offset,
        orderBy: [sql`RANDOM()`]
      })

    if (potentialMatches.length === 0) {
      return {
        isSuccess: true,
        message: "No potential matches found.",
        data: []
      }
    }

    const potentialUserIds = potentialMatches.map(p => p.userId)

    const completedTrips: SelectItinerary[] =
      await db.query.itineraries.findMany({
        where: and(
          inArray(itinerariesTable.creatorId, potentialUserIds),
          eq(itinerariesTable.status, "completed"),
          eq(itinerariesTable.isArchived, false)
        ),
        orderBy: [desc(itinerariesTable.createdAt)]
      })

    const tripsByCreatorMap = new Map<string, SelectItinerary[]>()
    completedTrips.forEach(trip => {
      const userTrips = tripsByCreatorMap.get(trip.creatorId) ?? []
      userTrips.push(trip)
      tripsByCreatorMap.set(trip.creatorId, userTrips)
    })

    const profilesWithData: ProfileWithTripsAndMatchScore[] =
      potentialMatches.map(profile => ({
        ...profile,
        isAdmin: false,
        completedTrips: tripsByCreatorMap.get(profile.userId) ?? [],
        matchPercentage: calculateMatchPercentage(viewerProfile, profile)
      }))

    return {
      isSuccess: true,
      message: "Potential matches retrieved successfully",
      data: profilesWithData
    }
  } catch (error) {
    console.error("[Action getPotentialMatches] Overall error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve potential matches"
    }
  }
}

export async function getAcceptedMatchesAction(
  userId: string
): Promise<ActionState<DbSelectProfile[]>> {
  try {
    const acceptedMatches = await db
      .select()
      .from(matchesTable)
      .where(
        and(
          or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)),
          eq(matchesTable.status, "accepted")
        )
      )

    if (acceptedMatches.length === 0) {
      return {
        isSuccess: true,
        message: "No accepted matches found",
        data: []
      }
    }

    const matchedUserIds = Array.from(
      new Set(acceptedMatches.flatMap(match => [match.userId1, match.userId2]))
    ).filter(id => id !== userId)

    if (matchedUserIds.length === 0) {
      return {
        isSuccess: true,
        message: "No other users found in accepted matches",
        data: []
      }
    }

    const matchedProfiles = await db
      .select()
      .from(profilesTable)
      .where(
        and(
          inArray(profilesTable.userId, matchedUserIds),
          not(like(profilesTable.username, "deleted_%"))
        )
      )

    return {
      isSuccess: true,
      message: "Accepted matches retrieved successfully",
      data: matchedProfiles
    }
  } catch (error) {
    console.error("[Action getAcceptedMatches] Error:", error)
    return {
      isSuccess: false,
      message: "Failed to retrieve accepted matches"
    }
  }
}

/**
 * Marks an accepted match notification as dismissed for a specific user.
 * @param matchId - The ID of the match to dismiss.
 * @param userId - The ID of the user dismissing the notification.
 * @returns ActionState indicating success or failure.
 */
export async function dismissMatchNotificationAction(
  matchId: string,
  userId: string
): Promise<ActionState<void>> {
  const { userId: currentUserId } = await auth()
  if (!currentUserId || currentUserId !== userId) {
    return { isSuccess: false, message: "Unauthorized." }
  }

  try {
    const match = await db.query.matches.findFirst({
      where: eq(matchesTable.id, matchId),
      columns: { userId1: true, userId2: true }
    })

    if (!match) {
      return { isSuccess: false, message: "Match not found." }
    }

    let updatePayload:
      | { isDismissedByUser1: boolean }
      | { isDismissedByUser2: boolean }

    if (match.userId1 === userId) {
      updatePayload = { isDismissedByUser1: true }
    } else if (match.userId2 === userId) {
      updatePayload = { isDismissedByUser2: true }
    } else {
      return { isSuccess: false, message: "You are not part of this match." }
    }

    await db
      .update(matchesTable)
      .set(updatePayload)
      .where(eq(matchesTable.id, matchId))

    console.log(
      `[Action dismissMatchNotification] User ${userId} dismissed notification for match ${matchId}.`
    )
    return {
      isSuccess: true,
      message: "Match notification dismissed.",
      data: undefined
    }
  } catch (error) {
    console.error("Error dismissing match notification:", error)
    return {
      isSuccess: false,
      message: "Failed to dismiss match notification."
    }
  }
}