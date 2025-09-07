"use server";

/**
 * @description
 * Server actions specifically for handling verification document storage operations
 * in Supabase Storage, focusing on secure access for admins.
 *
 * Key features:
 * - Generates temporary signed URLs for admins to view private verification documents.
 *
 * @dependencies
 * - "@supabase/supabase-js": For Supabase client creation and storage operations.
 * - "@clerk/nextjs/server": For retrieving user authentication details.
 * - "@/types": For ActionState type.
 * - "@/lib/auth-utils": For isAdminUser helper function. // Updated Dependency
 *
 * @notes
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 * - Assumes verification documents are stored in a private bucket defined by env vars.
 * - Signed URLs have a limited expiration time for security.
 */

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { ActionState } from "@/types";
import { isAdminUser } from "@/lib/auth-utils"; // <-- Use shared helper

// Buckets (should match Supabase setup and .env)
const VERIFICATION_DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VERIFICATION_DOCS_BUCKET || "verification-docs";

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes in seconds

/**
 * Generates a temporary signed URL for viewing a verification document.
 * Requires admin privileges.
 *
 * @param storagePath - The path to the document within the verification bucket (e.g., "user_id/verification/timestamp-filename.pdf").
 * @returns ActionState containing the signed URL string or an error message.
 */
export async function getVerificationDocumentUrlAction(
  storagePath: string | null | undefined
): Promise<ActionState<string>> {
  // --- Admin Authorization Check ---
  const { userId: adminUserId } = await auth();
  if (!isAdminUser(adminUserId)) { // Use shared helper
    console.warn(`[Action getVerificationDocumentUrl] Unauthorized attempt by user ${adminUserId}.`);
    return { isSuccess: false, message: "Unauthorized: Admin access required." };
  }
  // --- End Admin Authorization Check ---

  if (!storagePath) {
    return { isSuccess: false, message: "Document path is missing." };
  }

  console.log(`[Action getVerificationDocumentUrl] Admin ${adminUserId} requesting signed URL for path: ${storagePath}`);

  try {
    const { data, error } = await supabase.storage
      .from(VERIFICATION_DOCS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN); // Expires in 5 minutes

    if (error) {
        console.error(`[Action getVerificationDocumentUrl] Supabase signed URL error for path ${storagePath}:`, error);
      throw error; // Re-throw Supabase specific error
    }

    if (!data?.signedUrl) {
         console.error(`[Action getVerificationDocumentUrl] Signed URL generation succeeded but URL is missing for path: ${storagePath}`);
        throw new Error("Failed to generate signed URL.");
    }

    console.log(`[Action getVerificationDocumentUrl] Generated signed URL successfully for path: ${storagePath}`);
    return {
      isSuccess: true,
      message: "Signed URL generated successfully.",
      data: data.signedUrl,
    };
  } catch (error) {
    console.error(`[Action getVerificationDocumentUrl] Error generating signed URL for path ${storagePath}:`, error);
    let message = "Failed to get document URL.";
    if (error instanceof Error) {
        if (error.message.includes("Object not found")) {
            message = "Document not found in storage.";
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