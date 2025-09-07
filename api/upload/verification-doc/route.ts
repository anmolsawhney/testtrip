/**
 * @description
 * API Route handler for uploading user verification documents to Supabase Storage.
 * This is part of the identity verification flow. It accepts multipart/form-data
 * requests, validates the file (including PDFs), and stores it in a private bucket.
 *
 * @dependencies
 * - next/server: For NextRequest, NextResponse.
 * - @clerk/nextjs/server: For authentication (auth).
 * - @supabase/supabase-js: For Supabase client and storage operations.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

// --- Configuration ---
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]
const VERIFICATION_DOCS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_VERIFICATION_DOCS_BUCKET ||
  "verification-docs"

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
    const fileEntry = formData.get("verificationDoc")

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Verification document file not found in request." },
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
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_DOC_TYPES.join(", ")}`
        },
        { status: 415 }
      )
    }

    const path = generateFilePath(userId, "verification", file.name)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(VERIFICATION_DOCS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      throw uploadError
    }
    if (!uploadData?.path) {
      throw new Error("Storage upload succeeded but path was not returned.")
    }

    // For private buckets, we only return the path. A separate action will generate a signed URL for viewing.
    return NextResponse.json({
      message: "Document uploaded successfully",
      path: uploadData.path
    })
  } catch (error) {
    let message = "Internal server error during file upload."
    if (error instanceof Error) message = error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
