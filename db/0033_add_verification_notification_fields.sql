-- Migration: Add fields to profiles table for verification outcome notifications

-- This timestamp will be set when an admin approves or rejects a verification.
-- It will be used to determine if the notification is "new" for the user.
ALTER TABLE "profiles" ADD COLUMN "verification_outcome_notified_at" timestamp;

-- This flag allows a user to dismiss the verification outcome notification from their feed.
ALTER TABLE "profiles" ADD COLUMN "verification_outcome_dismissed" boolean DEFAULT false NOT NULL;

-- Add an index to efficiently query for users with undismissed notifications.
CREATE INDEX IF NOT EXISTS "profiles_verification_notification_idx" ON "profiles" ("user_id", "verification_outcome_dismissed");