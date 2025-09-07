"use server"

/**
 * @description
 * Server actions for handling trip photo uploads to Supabase Storage.
 * Provides functionality for securely uploading, retrieving, and managing trip photos.
 * The `uploadTripBannerStorage` action has been removed and is now handled by a dedicated API route.
 *
 * Key features:
 * - Validates file size and type before upload
 * - Creates secure, user and trip-specific storage paths
 * - Handles the complete upload process with robust error handling
 * - Generates and returns public URLs for stored photos
 *
 * @dependencies
 * - "@supabase/supabase-js": For Supabase Storage operations
 * - "@clerk/nextjs/server": For user authentication
 * - "@/types": For ActionState type definition
 *
 * @notes
 * - Maximum file size is 5MB
 * - Only accepts image files (JPEG, PNG, WebP)
 * - Trip photo paths follow pattern: `trip-photos/{userId}/{tripId}/{timestamp}-{filename}`
 * - Files are made publicly accessible for easy display in the app
 */

import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { ActionState } from "@/types"

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]
const TRIP_PHOTOS_BUCKET = "trip-photos" // Bucket for regular trip photos AND banners

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  )
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * Validates file based on size and type constraints.
 * @param file - The file to validate
 * @returns True if valid, throws error if invalid
 */
function validateFile(file: File): boolean {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
    )
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${ALLOWED_PHOTO_TYPES.join(", ")}`
    )
  }
  return true
}

/**
 * Generates a unique file path for storage for REGULAR trip photos.
 * @param userId - The user's ID
 * @param tripId - The trip's ID
 * @param fileName - Original file name
 * @returns Unique path string: `trip-photos/{userId}/{tripId}/{timestamp}-{filename}`
 */
function generateTripPhotoFilePath(
  userId: string,
  tripId: string,
  fileName: string
): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "")
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
  // Path specific to regular trip photos
  return `trip-photos/${userId}/${tripId}/${timestamp}-${safeFileName}`
}

/**
 * Uploads a SINGLE trip photo to Supabase Storage.
 * Typically used by the batch upload action.
 * @param tripId - The ID of the trip
 * @param userId - The ID of the user
 * @param file - The file to upload
 * @returns ActionState with upload path and public URL or error
 */
export async function uploadPhotoAction(
  tripId: string,
  userId: string,
  file: File
): Promise<ActionState<{ path: string; publicUrl: string }>> {
  try {
    // Validate authentication if not provided (though usually it should be)
    if (!userId) {
      const authResult = await auth()
      userId = authResult.userId as string

      if (!userId) {
        return { isSuccess: false, message: "Unauthorized: No user ID found" }
      }
    }

    // Validate required parameters
    if (!tripId) {
      return { isSuccess: false, message: "Missing required parameter: tripId" }
    }

    // Validate file
    try {
      validateFile(file)
    } catch (error) {
      return {
        isSuccess: false,
        message: error instanceof Error ? error.message : "Invalid file"
      }
    }

    // Generate unique path using the correct function for regular photos
    const path = generateTripPhotoFilePath(userId, tripId, file.name)

    console.log(`[uploadPhotoAction] Generated storage path: ${path}`) // LOG PATH

    // Upload file
    const { data, error } = await supabase.storage
      .from(TRIP_PHOTOS_BUCKET) // Use the main bucket
      .upload(path, file, {
        upsert: true, // Replace existing file if any (might want false for photos?)
        contentType: file.type
      })

    if (error) throw error

    // Get the public URL for the uploaded photo
    const { data: urlData } = supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .getPublicUrl(data.path)

    if (!urlData?.publicUrl) {
      console.error(
        `[uploadPhotoAction] Failed to get public URL for path: ${data.path}`
      ) // LOG URL ERROR
      throw new Error("Failed to get public URL after upload.")
    }
    console.log(`[uploadPhotoAction] Got public URL: ${urlData.publicUrl}`) // LOG PUBLIC URL
    return {
      isSuccess: true,
      message: "Trip photo uploaded successfully",
      data: {
        path: data.path,
        publicUrl: urlData.publicUrl
      }
    }
  } catch (error) {
    console.error("Error uploading trip photo:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to upload trip photo"
    }
  }
}

/**
 * Gets a public URL for a photo path.
 * @param path - The path of the photo in storage
 * @returns ActionState with public URL or error
 */
export async function getPhotoUrlAction(
  path: string
): Promise<ActionState<string>> {
  try {
    if (!path) {
      return { isSuccess: false, message: "Missing required parameter: path" }
    }

    const { data } = await supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .getPublicUrl(path)

    return {
      isSuccess: true,
      message: "Photo URL retrieved successfully",
      data: data.publicUrl
    }
  } catch (error) {
    console.error("Error getting photo URL:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to get photo URL"
    }
  }
}

/**
 * Deletes a trip photo from storage.
 * @param path - The path of the file to delete
 * @returns ActionState with success or error message
 */
export async function deletePhotoAction(
  path: string
): Promise<ActionState<void>> {
  try {
    if (!path) {
      return { isSuccess: false, message: "Missing required parameter: path" }
    }

    const { error } = await supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .remove([path])

    if (error) throw error

    return {
      isSuccess: true,
      message: "Trip photo deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting trip photo:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to delete trip photo"
    }
  }
}