/**
 * @description
 * API Route handler for uploading trip banner photos to Supabase Storage.
 * This dedicated route handles multipart/form-data requests to bypass the
 * Next.js Server Action body size limit, which is the correct pattern for file uploads.
 *
 * Key features:
 * - Handles authentication to ensure only logged-in users can upload.
 * - Accepts a 'tripBanner' file in a FormData request.
 * - Validates the file for size (max 5MB) and type (JPEG, PNG, WEBP).
 * - Uploads the file to a designated 'trip-banners' path in Supabase Storage.
 * - Returns the public URL of the uploaded image upon success.
 *
 * @dependencies
 * - next/server: For NextRequest and NextResponse.
 * - @clerk/nextjs/server: For authentication (auth).
 * - @supabase/supabase-js: For Supabase client and storage operations.
 */
"use server"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

// --- Configuration ---
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]
const TRIP_PHOTOS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_TRIP_PHOTOS_BUCKET || "trip-photos"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: ReturnType<typeof createClient> | null = null
if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
} else {
  console.error(
    "API Route Critical Error: Missing Supabase environment variables for trip banner upload."
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
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error for file uploads." },
      { status: 500 }
    )
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const fileEntry = formData.get("tripBanner") // Expecting 'tripBanner' key

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Trip banner file not found in request." },
        { status: 400 }
      )
    }
    const file: File = fileEntry

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 413 }
      )
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_PHOTO_TYPES.join(", ")}`
        },
        { status: 415 }
      )
    }

    const path = generateFilePath(userId, "trip-banner", file.name)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      throw uploadError
    }
    if (!uploadData?.path) {
      throw new Error("Storage upload succeeded but path was not returned.")
    }

    const { data: urlData } = supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .getPublicUrl(uploadData.path)

    if (!urlData?.publicUrl) {
      throw new Error("File uploaded but failed to retrieve public URL.")
    }

    return NextResponse.json({
      message: "Trip banner uploaded successfully",
      publicUrl: urlData.publicUrl
    })
  } catch (error) {
    let message = "Internal server error during file upload."
    if (error instanceof Error) message = error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
