-- Migration: Add trip preferences and change budget to an integer field

-- Add the trip_preferences column (text array, default empty) if it doesn't exist
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "trip_preferences" text[] DEFAULT '{}'::text[] NOT NULL;

-- Drop the old budget_range column if it exists
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "budget_range";

-- Drop the budget_range enum if it exists
DROP TYPE IF EXISTS "public"."budget_range";

-- Add the new integer budget column (if it doesn't exist already as integer)
-- To be safe, let's drop the old one and add it again.
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "budget";
ALTER TABLE "itineraries" ADD COLUMN "budget" integer;

-- Add final newline