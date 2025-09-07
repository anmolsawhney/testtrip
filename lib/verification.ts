"use server"

/**
 * @description
 * Utility functions for verification-related operations in TripRizz.
 * Provides secure access to verification documents stored in Supabase Storage.
 *
 * Key features:
 * - Generates signed URLs for verification documents
 * - Ensures server-side security for private file access
 *
 * @dependencies
 * - "@supabase/supabase-js": For Supabase client and storage operations
 *
 * @notes
 * - Signed URLs expire after 1 hour for security
 * - Uses service role key for server-side operations
 * - Assumes VERIFICATION_DOCS_BUCKET matches storage setup
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js"

// Bucket name (must match actions/storage/upload-actions.ts)
const VERIFICATION_DOCS_BUCKET = "verification-docs"

// URL expiration time (1 hour)
const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour in seconds

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  )
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * Generates a signed URL for accessing a verification document.
 * @param path - The file path in the verification-docs bucket
 * @returns Signed URL string
 * @throws Error if URL generation fails
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
