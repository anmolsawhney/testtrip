-- Migration: Add profile_questions_completed flag to profiles table

ALTER TABLE "profiles" ADD COLUMN "profile_questions_completed" boolean DEFAULT false NOT NULL;

-- Optional: You might want to backfill this based on whether any q_ columns are non-null for existing users.
-- UPDATE "profiles" SET "profile_questions_completed" = true WHERE q_travel_mood IS NOT NULL OR q_night_owl IS NOT NULL OR ... (add other q_ fields);

-- Add final newline