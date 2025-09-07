-- Migration: Add trip preferences and budget range to itineraries

-- Create the budget_range enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."budget_range" AS ENUM('Budget', 'Mid-Range', 'Luxury');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the trip_preferences column (text array, default empty)
ALTER TABLE "itineraries" ADD COLUMN "trip_preferences" text[] DEFAULT '{}'::text[] NOT NULL;

-- Add the budget_range column (nullable enum)
ALTER TABLE "itineraries" ADD COLUMN "budget_range" budget_range;

-- Drop the old budget column
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "budget";

-- Add final newline