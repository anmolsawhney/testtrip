-- Migration: Update budget_preference enum values

-- Step 1: Temporarily rename the existing enum to avoid conflicts.
-- This is a safe way to handle enum alterations in PostgreSQL.
ALTER TYPE "public"."budget_preference" RENAME TO "budget_preference_old";

-- Step 2: Create the new enum with the desired 'low-range', 'mid-range', 'luxury' values.
CREATE TYPE "public"."budget_preference" AS ENUM('low-range', 'mid-range', 'luxury');

-- Step 3: Update the profiles table.
-- This alters the column to use the new enum type.
-- The USING clause provides a mapping from the old values to the new ones,
-- ensuring existing data is correctly migrated.
ALTER TABLE "profiles"
  ALTER COLUMN "budget_preference" TYPE "public"."budget_preference"
  USING CASE "budget_preference"::text
    WHEN 'budget' THEN 'low-range'::"public"."budget_preference"
    WHEN 'moderate' THEN 'mid-range'::"public"."budget_preference"
    WHEN 'luxury' THEN 'luxury'::"public"."budget_preference"
    ELSE NULL -- Handles any other potential values, though they shouldn't exist.
  END;

-- Step 4: Drop the old, temporary enum type as it's no longer needed.
DROP TYPE "public"."budget_preference_old";

-- Add a final newline for good measure.