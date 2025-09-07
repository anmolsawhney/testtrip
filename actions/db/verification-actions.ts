/**
 * @description
 * Server actions for managing user verification in the TripRizz database.
 * Handles updates to profile verification status and document/selfie storage paths.
 * Added actions for admins to fetch pending verifications and update status.
 * Corrected fetch query in getPendingVerificationsAction to return full profile.
 * UPDATED: `updateProfileWithVerificationAction` now accepts selfiePhotoPath.
 * UPDATED: `updateVerificationStatusAction` now sets notification fields to generate a notification for the user.
 *
 * Key features:
 * - Updates profile with verification document, selfie photo, and status (user-facing).
 * - Fetches pending verification requests (admin-facing).
 * - Updates verification status and verified gender (admin-facing).
 * - Triggers a notification for the user upon status update.
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema": Profile schema and types, Enums.
 * - "@/types": ActionState type.
 * - "drizzle-orm": Query builder for database operations.
 * - "@clerk/nextjs/server": For authentication.
 * - "@/lib/auth-utils": For isAdminUser helper function.
 */
"use server"

import { db } from "@/db/db"
import {
  profilesTable,
  SelectProfile,
  InsertProfile,
  genderEnum,
  verificationStatusEnum
} from "@/db/schema"
import { ActionState } from "@/types"
import { eq, and, desc } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import { isAdminUser } from "@/lib/auth-utils"

// --- User-Facing Action ---
interface VerificationData {
  verificationDocument: string // Path to the ID document
  selfiePhotoPath: string // Path/URL to the selfie photo
  verificationStatus: "pending"
}

/**
 * Updates a user's profile with verification document path, selfie photo path/URL,
 * and sets status to 'pending'. Called by the user when they submit their document and selfie.
 * @param userId - The ID of the user to update
 * @param data - Verification data including document path, selfie photo path/URL, and status ('pending').
 * @returns ActionState with updated profile or error
 */
export async function updateProfileWithVerificationAction(
  userId: string,
  data: VerificationData
): Promise<ActionState<SelectProfile>> {
  try {
    if (!userId) {
      return { isSuccess: false, message: "User ID is required" }
    }
    // Validate required data
    if (
      !data.verificationDocument ||
      !data.selfiePhotoPath ||
      data.verificationStatus !== "pending"
    ) {
      return {
        isSuccess: false,
        message:
          "Invalid verification submission data: Document path, selfie path, and 'pending' status are required."
      }
    }

    console.log(
      `[Action updateProfileWithVerification] User ${userId} submitting document: ${data.verificationDocument} and selfie: ${data.selfiePhotoPath}`
    )

    const [updatedProfile] = await db
      .update(profilesTable)
      .set({
        verificationDocument: data.verificationDocument,
        selfiePhoto: data.selfiePhotoPath, // Save selfie photo path/URL
        verificationStatus: data.verificationStatus,
        updatedAt: new Date()
      })
      .where(eq(profilesTable.userId, userId))
      .returning()

    if (!updatedProfile) {
      console.warn(
        `[Action updateProfileWithVerification] Profile not found for user ${userId}`
      )
      return { isSuccess: false, message: "Profile not found to update" }
    }

    console.log(
      `[Action updateProfileWithVerification] Profile ${userId} status set to pending, doc and selfie path saved.`
    )
    return {
      isSuccess: true,
      message: "Profile updated with verification details, status pending.",
      data: updatedProfile
    }
  } catch (error) {
    console.error("[Action updateProfileWithVerification] Error:", error)
    return {
      isSuccess: false,
      message: "Failed to update profile with verification"
    }
  }
}

// --- Admin Actions ---

/**
 * Retrieves profiles with pending verification status. Requires admin privileges.
 * @returns ActionState containing an array of full profiles pending verification or an error message.
 */
export async function getPendingVerificationsAction(): Promise<
  ActionState<SelectProfile[]>
> {
  const { userId: adminUserId } = await auth()
  if (!isAdminUser(adminUserId)) {
    console.warn(
      `[Action getPendingVerifications] Unauthorized attempt by user ${adminUserId}.`
    )
    return { isSuccess: false, message: "Unauthorized: Admin access required." }
  }
  console.log(
    `[Action getPendingVerifications] Admin ${adminUserId} fetching pending verifications.`
  )

  try {
    const pendingProfiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.verificationStatus, "pending"))
      .orderBy(desc(profilesTable.updatedAt))

    console.log(
      `[Action getPendingVerifications] Found ${pendingProfiles.length} pending verifications.`
    )
    return {
      isSuccess: true,
      message: "Pending verifications retrieved successfully.",
      data: pendingProfiles
    }
  } catch (error) {
    console.error("[Action getPendingVerifications] Error:", error)
    return {
      isSuccess: false,
      message: "Failed to retrieve pending verifications."
    }
  }
}

/**
 * Updates a user's verification status and potentially their verified gender.
 * Requires admin privileges.
 *
 * @param targetUserId - The ID of the user whose verification status to update.
 * @param newStatus - The new status ('verified' or 'rejected').
 * @param verifiedGender - The gender confirmed by the admin (required if status is 'verified').
 * @returns ActionState containing the updated profile or an error message.
 */
export async function updateVerificationStatusAction(
  targetUserId: string,
  newStatus: "verified" | "rejected",
  verifiedGender?: (typeof genderEnum.enumValues)[number]
): Promise<ActionState<SelectProfile>> {
  const { userId: adminUserId } = await auth()
  if (!isAdminUser(adminUserId)) {
    console.warn(
      `[Action updateVerificationStatus] Unauthorized attempt by user ${adminUserId} to update verification for ${targetUserId}.`
    )
    return { isSuccess: false, message: "Unauthorized: Admin access required." }
  }
  console.log(
    `[Action updateVerificationStatus] Admin ${adminUserId} updating verification for ${targetUserId} to status ${newStatus}. Verified Gender: ${verifiedGender ?? "N/A"}`
  )

  try {
    if (!targetUserId) {
      return { isSuccess: false, message: "Target User ID is required." }
    }
    if (newStatus !== "verified" && newStatus !== "rejected") {
      return { isSuccess: false, message: "Invalid new status provided." }
    }
    if (newStatus === "verified") {
      if (!verifiedGender || !genderEnum.enumValues.includes(verifiedGender)) {
        return {
          isSuccess: false,
          message:
            "A valid verified gender is required when setting status to 'verified'."
        }
      }
    }

    const updateData: Partial<InsertProfile> = {
      verificationStatus: newStatus,
      updatedAt: new Date(),
      verificationOutcomeNotifiedAt: new Date(),
      verificationOutcomeDismissed: false
    }

    if (newStatus === "verified" && verifiedGender) {
      updateData.verifiedGender = verifiedGender
    } else if (newStatus === "rejected") {
      updateData.verifiedGender = null
      console.log(
        `[Action updateVerificationStatus] Setting verifiedGender to null for rejected user ${targetUserId}.`
      )
    }

    const [updatedProfile] = await db
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.userId, targetUserId))
      .returning()

    if (!updatedProfile) {
      console.warn(
        `[Action updateVerificationStatus] Profile not found for target user ${targetUserId} during update.`
      )
      return {
        isSuccess: false,
        message: "Target user profile not found to update."
      }
    }

    console.log(
      `[Action updateVerificationStatus] Verification status updated successfully for user ${targetUserId}.`
    )

    return {
      isSuccess: true,
      message: `Verification status updated to ${newStatus}.`,
      data: updatedProfile
    }
  } catch (error) {
    console.error("[Action updateVerificationStatus] Error:", error)
    return {
      isSuccess: false,
      message: "Failed to update verification status."
    }
  }
}