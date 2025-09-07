/**
 * @description
 * Server actions specifically for the onboarding process.
 * Handles the final step of marking onboarding as complete in the application's
 * database by calling the main profile update action with the correct flag.
 * Also includes an action to mark the guided tour as completed.
 *
 * Key features:
 * - Orchestrates the completion of the onboarding flow.
 * - Sets the `profileQuestionsCompleted` flag to true in the database via `updateProfileAction`.
 * - Sets the `hasCompletedGuidedTour` flag to true.
 * - No longer interacts with Clerk metadata, centralizing state in the local DB.
 *
 * @dependencies
 * - "@/types": ActionState type definition.
 * - "@/db/schema": For InsertProfile and SelectProfile types.
 * - ./profiles-actions: For updating the local profile.
 * - "@clerk/nextjs/server": For authentication.
 * - "drizzle-orm": For database operations.
 */
"use server"

import type { ActionState } from "@/types"
import type { InsertProfile, SelectProfile } from "@/db/schema"
import { updateProfileAction } from "./profiles-actions"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema"
import { eq } from "drizzle-orm"

/**
 * Completes the onboarding process for a user.
 * 1. Updates the user's profile data in the local database.
 * 2. Sets the `profileQuestionsCompleted` flag to true in the database.
 *
 * @param userId The ID of the user completing onboarding.
 * @param data The profile data from the onboarding form.
 * @returns ActionState indicating success or failure.
 */
export async function completeOnboardingAction(
  userId: string,
  data: Partial<InsertProfile>
): Promise<ActionState<SelectProfile>> {
  try {
    // Add the onboarding completion flag to the data payload.
    // This ensures the profile is marked as complete in our database.
    const finalData = {
      ...data,
      profileQuestionsCompleted: true
    }

    // Step 1: Update the local database profile with the form data and completion flag.
    // This now implicitly handles all validation and uniqueness checks from updateProfileAction.
    const profileUpdateResult = await updateProfileAction(userId, finalData)

    if (!profileUpdateResult.isSuccess) {
      // If DB update fails, return the error.
      return profileUpdateResult
    }

    console.log(
      `[Action completeOnboarding] Successfully completed onboarding for user ${userId} in local DB.`
    )

    return {
      isSuccess: true,
      message: "Onboarding completed successfully.",
      data: profileUpdateResult.data
    }
  } catch (error) {
    console.error("Error completing onboarding action:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to complete onboarding."
    }
  }
}

/**
 * Marks the guided tour as completed for the currently authenticated user.
 *
 * @returns ActionState indicating success or failure.
 */
export async function markGuidedTourAsCompletedAction(): Promise<ActionState<void>> {
  const { userId } = await auth()
  if (!userId) {
    return { isSuccess: false, message: "Unauthorized: User not logged in." }
  }

  try {
    const result = await db
      .update(profilesTable)
      .set({ hasCompletedGuidedTour: true, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning({ id: profilesTable.userId })

    if (result.length === 0) {
      console.warn(
        `[Action markGuidedTourAsCompleted] Profile not found for user ${userId}.`
      )
      return { isSuccess: false, message: "Profile not found." }
    }

    console.log(
      `[Action markGuidedTourAsCompleted] Marked guided tour as completed for user ${userId}.`
    )

    return {
      isSuccess: true,
      message: "Guided tour status updated.",
      data: undefined
    }
  } catch (error) {
    console.error("Error marking guided tour as completed:", error)
    return {
      isSuccess: false,
      message: "Failed to update guided tour status."
    }
  }
}