/**
 * @description
 * Authentication related utility functions.
 */

/**
 * Checks if a given userId has admin privileges based on the ADMIN_USER_IDS environment variable.
 * Reads the comma-separated list from the environment variable.
 *
 * @param userId The Clerk User ID to check. Can be null or undefined.
 * @returns boolean True if the user ID is found in the admin list, false otherwise.
 */
export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) {
    // console.log("[isAdminUser] Check failed: No userId provided.");
    return false
  }
  const adminIdsEnv = process.env.ADMIN_USER_IDS || ""
  const adminIds = adminIdsEnv
    .split(",")
    .map(id => id.trim()) // Remove leading/trailing whitespace
    .filter(id => id) // Remove empty strings resulting from trailing commas etc.

  if (adminIds.length === 0) {
    console.warn(
      "[isAdminUser] ADMIN_USER_IDS environment variable is not set or is empty."
    )
    return false
  }

  const isAdmin = adminIds.includes(userId)
  // console.log(`[isAdminUser] Checking user ${userId}. Admin IDs: [${adminIds.join(', ')}]. Result: ${isAdmin}`);
  return isAdmin
}

// Add other auth-related utility functions here if needed in the future.
