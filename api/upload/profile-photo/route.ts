/**
 * @description
 * API Route handler for uploading user profile photos to Supabase Storage.
 * Accepts multipart/form-data requests containing the photo file.
 * Handles authentication, validation, storage upload, and returns the public URL.
 * This route bypasses the Next.js Server Action body size limit for file uploads.
 * Includes more robust error handling and detailed logging.
 *
 * @dependencies
 * - next/server: For NextRequest, NextResponse.
 * - @clerk/nextjs/server: For authentication (auth).
 * - @supabase/supabase-js: For Supabase client and storage operations.
 *
 * @notes
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * - Assumes PROFILE_PHOTOS_BUCKET env var is set or defaults correctly.
 * - Uses Supabase service role for server-side uploads.
 * - Performs validation matching the previous action logic.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

// --- Configuration ---
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]
const PROFILE_PHOTOS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET || "profile-photos"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: ReturnType<typeof createClient> | null = null
if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
} else {
  console.error(
    "API Route Critical Error: Missing Supabase environment variables. Uploads will fail."
  )
}

function generateFilePath(
  userId: string,
  purpose: string,
  fileName: string
): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "")
  let safeFileName = fileName
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
  if (!safeFileName || safeFileName === ".") {
    safeFileName = "file"
  }
  const safePurpose = purpose.replace(/[^a-zA-Z0-9-_]/g, "_")
  return `${userId}/${safePurpose}/${timestamp}-${safeFileName}`
}

// --- POST Handler ---
export async function POST(request: NextRequest) {
  // Ensure Supabase client is initialized
  if (!supabase) {
    console.error(
      "[API Upload] Supabase client not initialized due to missing env vars."
    )
    return NextResponse.json(
      { error: "Server configuration error for file uploads." },
      { status: 500 }
    )
  }

  try {
    // 1. Authentication
    const { userId } = await auth()
    if (!userId) {
      console.log("[API Upload] Unauthorized: No userId found.")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log(`[API Upload] Authenticated user: ${userId}`)

    // 2. Parse FormData
    const formData = await request.formData()
    const fileEntry = formData.get("profilePhoto")

    if (!(fileEntry instanceof File)) {
      console.log(
        "[API Upload] Error: profilePhoto not found or not a File in FormData."
      )
      return NextResponse.json(
        { error: "Profile photo file not found in request." },
        { status: 400 }
      )
    }
    const file: File = fileEntry
    console.log(
      `[API Upload] Received file: ${file.name}, Size: ${file.size}, Type: ${file.type}`
    )

    // 3. Validation
    if (file.size > MAX_FILE_SIZE) {
      console.log(
        `[API Upload] Validation failed: File size (${file.size}) exceeds limit.`
      )
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 413 }
      )
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      console.log(
        `[API Upload] Validation failed: Invalid file type (${file.type}).`
      )
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_PHOTO_TYPES.join(", ")}`
        },
        { status: 415 }
      )
    }
    console.log("[API Upload] File validation passed.")

    // 4. Upload to Supabase
    const path = generateFilePath(userId, "avatar", file.name)
    console.log(`[API Upload] Generated storage path: ${path}`)
    console.log(`[API Upload] Uploading to bucket: ${PROFILE_PHOTOS_BUCKET}`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error("[API Upload] Supabase upload error:", uploadError)
      throw uploadError
    }
    if (!uploadData?.path) {
      console.error("[API Upload] Supabase upload succeeded but path missing.")
      throw new Error("Storage upload succeeded but path was not returned.")
    }
    console.log(
      `[API Upload] Successfully uploaded to path: ${uploadData.path}`
    )

    // 5. Get Public URL
    console.log(`[API Upload] Getting public URL for path: ${uploadData.path}`)
    const { data: urlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(uploadData.path)

    if (!urlData?.publicUrl) {
      console.error("[API Upload] Failed to retrieve public URL after upload.")
      throw new Error("File uploaded but failed to retrieve public URL.")
    }
    console.log(`[API Upload] Retrieved public URL: ${urlData.publicUrl}`)

    // 6. Return Success Response
    return NextResponse.json({
      message: "Profile photo uploaded successfully",
      path: uploadData.path,
      publicUrl: urlData.publicUrl
    })
  } catch (error) {
    console.error("[API Upload] Unexpected error in POST handler:", error)
    let message = "Internal server error during file upload."
    if (error instanceof Error) message = error.message
    else if (typeof error === "object" && error !== null && "message" in error)
      message = String(error.message)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
