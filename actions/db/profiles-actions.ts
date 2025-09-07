/**
 * @description
 * Server actions for creating and managing user profiles.
 * Features a robust "get or create" action to prevent race conditions during initial profile creation.
 * UPDATED: `getProfileByUserIdAction` now checks for soft-deleted users (username starting with "deleted_")
 * and denies access to non-admins, treating them as not found.
 *
 * Key features:
 * - `getOrCreateProfileAction`: Atomically fetches or creates a user profile, safely handling race conditions using an "INSERT ... ON CONFLICT DO NOTHING" pattern.
 * - `createProfileAction`: An internal helper to insert a new profile record.
 * - `updateProfileAction`: Updates an existing profile, checking for username uniqueness.
 * - `getProfileByUserIdAction`: Fetches a profile, including admin status, and hides soft-deleted users from non-admins.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema/profiles-schema": Profile schema definition and types.
 * - "@/types": ActionState type definition.
 * - "drizzle-orm": For database operations.
 * - "@/lib/auth-utils": For isAdminUser helper.
 */
"use server"

import { db } from "@/db/db"
import {
  InsertProfile,
  profilesTable,
  SelectProfile as DbSelectProfile
} from "@/db/schema/profiles-schema"
import { ActionState, SelectProfile } from "@/types"
import { eq, not, and } from "drizzle-orm"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * An internal helper action to create a new user profile.
 * This is not race-condition-safe on its own and should be called from `getOrCreateProfileAction`.
 * @param data The data for the new profile, including userId, firstName, lastName, and username.
 * @returns ActionState with the created profile or an error.
 */
async function createProfileAction(
  data: InsertProfile
): Promise<ActionState<DbSelectProfile>> {
  try {
    if (!data.userId || !data.firstName || !data.lastName || !data.username) {
      return {
        isSuccess: false,
        message:
          "Missing required fields: userId, firstName, lastName, or username."
      }
    }

    const profileData: InsertProfile = {
      ...data,
      languagesSpoken: data.languagesSpoken ?? [],
      travelPreferences: data.travelPreferences ?? []
    }

    const [newProfile] = await db
      .insert(profilesTable)
      .values(profileData)
      .returning()

    return {
      isSuccess: true,
      message: "Profile created successfully",
      data: newProfile
    }
  } catch (error: any) {
    console.error("[Action createProfile] Error creating profile:", error)
    if (error?.code === "23505") {
      if (error?.constraint === "profiles_pkey") {
        return {
          isSuccess: false,
          message:
            'duplicate key value violates unique constraint "profiles_pkey"'
        }
      }
      if (error?.constraint === "profiles_username_key") {
        return {
          isSuccess: false,
          message: "Username is already taken. Please choose another."
        }
      }
    }
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create profile due to a database error."
    }
  }
}

/**
 * Safely gets a user profile, creating one if it doesn't exist.
 * This function is designed to be idempotent and prevent race conditions.
 *
 * @param userId The ID of the user.
 * @param firstName The user's first name.
 * @param lastName The user's last name.
 * @param username The user's desired username.
 * @returns ActionState with the user's profile.
 */
export async function getOrCreateProfileAction(
  userId: string,
  firstName: string,
  lastName: string,
  username: string
): Promise<ActionState<DbSelectProfile>> {
  try {
    // 1. First, try to get the profile
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })

    if (existingProfile) {
      return {
        isSuccess: true,
        message: "Profile retrieved successfully.",
        data: existingProfile
      }
    }

    // 2. If it doesn't exist, try to insert it, but do nothing if a concurrent request just inserted it.
    await db
      .insert(profilesTable)
      .values({ userId, firstName, lastName, username })
      .onConflictDoNothing()

    // 3. Now, the profile is GUARANTEED to exist. Fetch it and return it.
    const finalProfile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })

    if (finalProfile) {
      return {
        isSuccess: true,
        message: "Profile created and retrieved successfully.",
        data: finalProfile
      }
    }

    // 4. If it's STILL not found after all that, there is a serious, unexpected issue.
    throw new Error(
      "Failed to create or retrieve profile after multiple attempts."
    )
  } catch (error) {
    console.error("[getOrCreateProfileAction] Unhandled error:", error)
    return {
      isSuccess: false,
      message:
        "An unexpected error occurred while getting or creating the profile."
    }
  }
}

export async function getProfileByUserIdAction(
  userId: string,
  viewerId?: string | null // Add viewerId to check for admin
): Promise<ActionState<SelectProfile>> {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })

    if (!profile) {
      console.log(`[Action getProfile] Profile not found for userId: ${userId}`)
      return { isSuccess: false, message: "Profile not found" }
    }

    // Check if user is soft-deleted
    const isSoftDeleted = profile.username?.startsWith("deleted_")
    const isViewerAdmin = isAdminUser(viewerId)

    if (isSoftDeleted && !isViewerAdmin) {
      console.log(
        `[Action getProfile] Access denied to soft-deleted profile ${userId} for non-admin viewer ${viewerId}.`
      )
      return { isSuccess: false, message: "Profile not found" } // Treat as not found for non-admins
    }

    const isAdmin = isAdminUser(userId) // This checks if the *target* user is an admin
    const profileWithAdminStatus: SelectProfile = {
      ...profile,
      isAdmin: isAdmin
    }

    return {
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: profileWithAdminStatus
    }
  } catch (error) {
    console.error(
      "[Action getProfile] Error getting profile by user id:",
      error
    )
    return {
      isSuccess: false,
      message: "Failed to get profile due to a database error."
    }
  }
}

export async function updateProfileAction(
  userId: string,
  data: Partial<InsertProfile>
): Promise<ActionState<DbSelectProfile>> {
  try {
    if (data.username) {
      const existingUser = await db.query.profiles.findFirst({
        where: and(
          eq(profilesTable.username, data.username),
          not(eq(profilesTable.userId, userId))
        )
      })
      if (existingUser) {
        return {
          isSuccess: false,
          message: "Username is already taken. Please choose another."
        }
      }
    }

    const updatePayload = {
      ...data,
      updatedAt: new Date()
    }

    if ("createdAt" in updatePayload) {
      delete (updatePayload as any).createdAt
    }
    if ("userId" in updatePayload) {
      delete (updatePayload as any).userId
    }

    const [updatedProfile] = await db
      .update(profilesTable)
      .set(updatePayload)
      .where(eq(profilesTable.userId, userId))
      .returning()

    if (!updatedProfile) {
      return { isSuccess: false, message: "Profile not found to update" }
    }

    return {
      isSuccess: true,
      message: "Profile updated successfully",
      data: updatedProfile
    }
  } catch (error) {
    console.error("Error in updateProfileAction:", error)
    return { isSuccess: false, message: "Failed to update profile." }
  }
}

export async function deleteProfileAction(
  userId: string
): Promise<ActionState<void>> {
  try {
    await db.delete(profilesTable).where(eq(profilesTable.userId, userId))
    return {
      isSuccess: true,
      message: "Profile deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting profile:", error)
    return { isSuccess: false, message: "Failed to delete profile" }
  }
}