/**
 * @description
 * Type definitions related to user reports.
 * UPDATED: Replaced `displayName` with `username` to match schema changes.
 */

import type { SelectReport, SelectProfile } from "@/db/schema"

/**
 * Represents a report object enriched with details about the
 * reporter and the reported user.
 */
export type ReportWithDetails = SelectReport & {
  reporter: Pick<SelectProfile, "userId" | "username" | "profilePhoto"> | null // Reporter's profile details (can be null if reporter deleted account)
  reported: Pick<SelectProfile, "userId" | "username" | "profilePhoto"> | null // Reported user's profile details (can be null if somehow deleted mid-process)
}

// Add other report-related types here if needed in the future
