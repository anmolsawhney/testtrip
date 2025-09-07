"use server"

/**
 * @description
 * Utility functions for interacting with Supabase Storage in TripRizz.
 * Provides secure access to stored files via signed URLs.
 *
 * Key features:
 * - Generates short-lived signed URLs for private file access
 * - Supports both profile photos and verification documents
 *
 * @dependencies
 * - "@supabase/supabase-js": For Supabase client creation and storage operations
 *
 * @notes
 * - Signed URLs expire after 1 hour for security
 * - Functions are server-side to prevent client exposure of credentials
 * - Assumes buckets are private with RLS policies applied
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js"

// Bucket names (must match actions/storage/upload-actions.ts)
const PROFILE_PHOTOS_BUCKET = "profile-photos"
const VERIFICATION_DOCS_BUCKET = "verification-docs"

// URL expiration time (1 hour)
const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour in seconds

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
 * Generates a signed URL for accessing a profile photo.
 * @param path - The file path in the bucket
 * @returns Signed URL string or throws error
 */
export async function getProfilePhotoUrl(path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY)

    if (error || !data?.signedUrl) {
      throw error || new Error("No signed URL returned")
    }

    return data.signedUrl
  } catch (error) {
    console.error("Error generating signed URL for profile photo:", error)
    throw new Error("Failed to generate profile photo URL")
  }
}

/**
 * Generates a signed URL for accessing a verification document.
 * @param path - The file path in the bucket
 * @returns Signed URL string or throws error
 */
export async function getVerificationDocUrl(path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(VERIFICATION_DOCS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY)

    if (error || !data?.signedUrl) {
      throw error || new Error("No signed URL returned")
    }

    return data.signedUrl
  } catch (error) {
    console.error(
      "Error generating signed URL for verification document:",
      error
    )
    throw new Error("Failed to generate verification document URL")
  }
}
