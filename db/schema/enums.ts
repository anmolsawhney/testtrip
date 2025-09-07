/**
 * @description
 * Defines shared PostgreSQL enums used across various schemas in the TripRizz application.
 * Centralizing enums improves maintainability and consistency.
 * UPDATED: Added 'deactivated' to the `tripStatusEnum` to support soft-deleting trips.
 *
 * Enums defined:
 * - follow_status: Status of a follow relationship.
 * - report_reason: Predefined reasons for reporting a user.
 * - report_status: Workflow status for submitted user reports.
 * - activity_event_type: Types of activities in the activity feed.
 * - conversation_status: Status of a direct message conversation.
 * - block_type: Type of block applied by a user.
 * - gender: User's self-declared or verified gender.
 * - verification_status: Status of identity document verification.
 * - budget_preference: User's travel budget preference.
 * - trip_type: Type of trip (solo, group, women_only).
 * - trip_visibility: Visibility setting for trips.
 * - trip_status: Status of a trip (draft, active, completed, cancelled, deactivated). // UPDATED
 * - trip_member_role: Role of a user within a trip (owner, member).
 * - match_status: Status for matches and trip requests.
 */

import { pgEnum } from "drizzle-orm/pg-core"

// --- Social & Interaction Enums ---
export const followStatusEnum = pgEnum("follow_status", ["pending", "accepted"])

export const reportReasonEnum = pgEnum("report_reason", [
  "Spam",
  "Inappropriate Content",
  "Impersonation",
  "Other"
])

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed_warned",
  "reviewed_suspended",
  "reviewed_banned",
  "resolved_no_action"
])

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "new_photo",
  "new_trip",
  "joined_trip",
  "left_trip",
  "new_review",
  "follow",
  "like_on_post",
  "comment_on_post"
])

export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "request"
])

export const blockTypeEnum = pgEnum("block_type", ["dm", "profile"])

// --- Profile & Verification Enums ---
export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "other",
  "prefer_not_to_say"
])

export const verificationStatusEnum = pgEnum("verification_status", [
  "none",
  "pending",
  "verified",
  "rejected"
])

export const budgetPreferenceEnum = pgEnum("budget_preference", [
  "low-range",
  "mid-range",
  "luxury"
])

// --- Trip Enums ---
export const tripTypeEnum = pgEnum("trip_type", ["solo", "group", "women_only"])

export const tripVisibilityEnum = pgEnum("trip_visibility", [
  "public",
  "private",
  "followers_only"
])

export const tripStatusEnum = pgEnum("trip_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
  "deactivated" // Added new status
])

export const tripMemberRoleEnum = pgEnum("trip_member_role", [
  "owner",
  "member"
])

export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "accepted",
  "rejected",
  "expired"
])
