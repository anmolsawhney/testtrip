-- Migration: Add gender-related fields to profiles and update enums

-- Create the gender enum if it doesn't already exist
DO $$ BEGIN
    CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION
    WHEN duplicate_object THEN null; -- Ignore error if type already exists
END $$;

-- Add 'rejected' value to verification_status enum if it doesn't exist
-- Note: Adding values to enums needs careful handling in transactions depending on Postgres version.
-- This syntax is generally safe. Check PostgreSQL docs for specifics if issues arise.
DO $$ BEGIN
    ALTER TYPE "public"."verification_status" ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION
    WHEN invalid_text_representation THEN null; -- Handle cases where it might already exist in a different way
    WHEN duplicate_object THEN null; -- Handle if already exists
END $$;


-- Add the 'gender' column (nullable) to the profiles table
ALTER TABLE "profiles" ADD COLUMN "gender" gender;

-- Add the 'verified_gender' column (nullable) to the profiles table
ALTER TABLE "profiles" ADD COLUMN "verified_gender" gender;

-- Add a final newline for good measure