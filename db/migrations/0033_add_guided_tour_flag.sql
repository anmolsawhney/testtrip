
-- Migration: Add has_completed_guided_tour flag to profiles table

-- This column will track whether a user has seen the one-time onboarding tutorial.
-- It defaults to FALSE for all existing and new users, ensuring they will see the tour once.
ALTER TABLE "profiles" ADD COLUMN "has_completed_guided_tour" boolean DEFAULT false NOT NULL;

-- Add an index for potentially querying users who haven't completed the tour.
CREATE INDEX IF NOT EXISTS "profiles_guided_tour_idx" ON "profiles" ("has_completed_guided_tour");