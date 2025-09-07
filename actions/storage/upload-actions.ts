/**
 * @description
 * Contains server actions for managing file uploads to Supabase Storage in TripRizz.
 * Handles verification document and selfie photo uploads with validation and security.
 * Profile photo upload is now handled by a dedicated API route.
 * Trip photo uploads have been moved to dedicated trip-photos-storage-actions.ts.
 * REMOVED: uploadProfilePhotoStorage server action.
 *
 * Key features:
 * - Uploads files to specific buckets with user-specific paths using FormData.
 * - Validates file size and type before upload.
 * - Generates unique file names to prevent collisions.
 * - Deletes files from storage when no longer needed.
 * - Returns public URL for selfies.
 *
 * @dependencies
 * - "@supabase/supabase-js": For Supabase client creation and storage operations
 * - "@clerk/nextjs/server": For retrieving user authentication details
 * - "@/types": For ActionState type
 *
 * @notes
 * - Files are stored in private buckets with RLS policies applied
 * - Max file size is 5MB; allowed types are images for photos/selfies, images/PDFs for docs
 * - Paths follow the structure: {bucket}/{userId}/{purpose}/{timestamp}-{filename}
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

"use server"

import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { ActionState } from "@/types"

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] // Used for profile & selfie
const ALLOWED_DOC_TYPES = [
  ...ALLOWED_PHOTO_TYPES,
  "application/pdf",
]

// Buckets (should match Supabase setup and .env)
const PROFILE_PHOTOS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET || "profile-photos";
const VERIFICATION_DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VERIFICATION_DOCS_BUCKET || "verification-docs";
const SELFIE_PHOTOS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_SELFIE_PHOTOS_BUCKET || PROFILE_PHOTOS_BUCKET;

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function validateFile(file: File, allowedTypes: string[]): boolean {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Allowed types: " + allowedTypes.join(", "))
  }
  return true
}

function generateFilePath(userId: string, purpose: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "")
  let safeFileName = fileName
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "");
  if (!safeFileName || safeFileName === '.') {
      safeFileName = 'file';
  }
  const safePurpose = purpose.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${userId}/${safePurpose}/${timestamp}-${safeFileName}`
}

// --- uploadProfilePhotoStorage Server Action REMOVED ---
// The API route /api/upload/profile-photo now handles this.

/**
 * Uploads a selfie photo to Supabase Storage using FormData.
 * @param formData - The FormData object containing the file under the key 'selfiePhoto'.
 * @returns ActionState with uploaded file path and public URL or error
 */
export async function uploadSelfiePhotoStorage(
  formData: FormData
): Promise<ActionState<{ path: string; publicUrl: string }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: No user ID found" }
    }

    const file = formData.get("selfiePhoto") as File | null;
    if (!file || !(file instanceof File)) {
        return { isSuccess: false, message: "Selfie photo file not found in form data." };
    }
    console.log(`[uploadSelfiePhotoStorage] Received file: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    validateFile(file, ALLOWED_PHOTO_TYPES);
    const path = generateFilePath(userId, "selfie", file.name);
    console.log(`[uploadSelfiePhotoStorage] Generated path: ${path}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SELFIE_PHOTOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;
    if (!uploadData?.path) throw new Error("Selfie photo upload succeeded but path was not returned.");
    console.log(`[uploadSelfiePhotoStorage] Successfully uploaded to path: ${uploadData.path}`);

    const { data: urlData } = supabase.storage.from(SELFIE_PHOTOS_BUCKET).getPublicUrl(uploadData.path);
    if (!urlData?.publicUrl) throw new Error("Selfie uploaded but failed to retrieve public URL.");
    console.log(`[uploadSelfiePhotoStorage] Retrieved public URL: ${urlData.publicUrl}`);

    return { isSuccess: true, message: "Selfie photo uploaded successfully", data: { path: uploadData.path, publicUrl: urlData.publicUrl }};
  } catch (error) {
    console.error("[uploadSelfiePhotoStorage] Overall error:", error);
    let message = "Failed to upload selfie photo";
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'object' && error !== null && 'message' in error) message = String(error.message);
    return { isSuccess: false, message: message };
  }
}


/**
 * Uploads a verification document to Supabase Storage.
 * Accepts a File object directly (assuming called server-side or with small files if from client).
 * @param file - The file to upload
 * @returns ActionState with uploaded file path or error
 */
export async function uploadVerificationDocStorage(
  file: File // Changed back to accept File directly as it might be called from server actions elsewhere
): Promise<ActionState<{ path: string }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: No user ID found" }
    }
     console.log(`[uploadVerificationDocStorage] Received file: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    validateFile(file, ALLOWED_DOC_TYPES);
    const path = generateFilePath(userId, "verification", file.name);
    console.log(`[uploadVerificationDocStorage] Generated path: ${path}`);

    const { data, error } = await supabase.storage
      .from(VERIFICATION_DOCS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw error;
     if (!data?.path) throw new Error("Verification document upload succeeded but path is missing.");
    console.log(`[uploadVerificationDocStorage] Successfully uploaded to path: ${data.path}`);

    return { isSuccess: true, message: "Verification document uploaded successfully", data: { path: data.path } };
  } catch (error) {
    console.error("Error uploading verification document:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to upload verification document" };
  }
}


export async function extractPathFromPublicUrl(publicUrl: string): Promise<string | null> {
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split('/');
    const publicIndex = pathParts.findIndex(part => part === 'public');
    const bucketIndex = publicIndex + 1;

    if (publicIndex >= 0 && bucketIndex < pathParts.length) {
        const bucketName = pathParts[bucketIndex];
        if (bucketName === PROFILE_PHOTOS_BUCKET ||
          bucketName === VERIFICATION_DOCS_BUCKET ||
          bucketName === SELFIE_PHOTOS_BUCKET ||
          bucketName === (process.env.NEXT_PUBLIC_SUPABASE_TRIP_PHOTOS_BUCKET || 'trip-photos')
         ) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
    }
    console.warn(`[extractPathFromPublicUrl] Could not extract path for known bucket from URL: ${publicUrl}`);
    return null;
  } catch (error) {
    console.error(`[extractPathFromPublicUrl] Error parsing URL "${publicUrl}":`, error);
    return null;
  }
}


export async function deleteFileFromBucket(bucketName: string, path: string): Promise<ActionState<void>> {
  try {
      const { userId } = await auth();
      if (!userId) {
          return { isSuccess: false, message: "Unauthorized: No user ID found" };
      }

      if (!path.startsWith(`${userId}/`)) {
          console.warn(`[deleteFileFromBucket] Unauthorized attempt by user ${userId} to delete path ${path} in bucket ${bucketName}`);
          return { isSuccess: false, message: "Unauthorized: Cannot delete this file." };
      }

      console.log(`[deleteFileFromBucket] User ${userId} deleting file from bucket ${bucketName}, path: ${path}`);
      const { error } = await supabase.storage
          .from(bucketName)
          .remove([path]); // Pass path as an array

      if (error) {
          console.error(`[deleteFileFromBucket] Supabase delete error for path ${path} in bucket ${bucketName}:`, error);
          throw error;
      }

      console.log(`[deleteFileFromBucket] File deleted successfully: ${path} from ${bucketName}`);
      return {
          isSuccess: true,
          message: "File deleted successfully",
          data: undefined,
      };
  } catch (error) {
      console.error(`[deleteFileFromBucket] Overall error deleting file from ${bucketName}:`, error);
      let message = "Failed to delete file";
      if (error instanceof Error) {
          if (error.message.includes("Object not found")) {
              message = "File not found in storage.";
          } else {
              message = error.message;
          }
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
          message = String(error.message);
      }
      return {
          isSuccess: false,
          message: message,
      };
  }
}