-- Migration: Add columns required by Step 3 of the implementation plan
-- Adds cover photo and like count to itineraries, notification check time to profiles,
-- and dismissal flag to trip requests.

-- Add cover_photo_url (nullable text) to itineraries
ALTER TABLE "itineraries" ADD COLUMN "cover_photo_url" text;

-- Add like_count (integer, not null, default 0) to itineraries
ALTER TABLE "itineraries" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;


-- Add is_dismissed (boolean, not null, default false) to trip_requests
-- This column was also added in migration 0009, ensure it exists and has the correct default.
-- Using ALTER COLUMN to add default if it wasn't added before or ensure it's correct.
-- If the column *might* not exist (e.g., if 0009 wasn't run), a conditional add is safer,
-- but based on the plan, 0009 should have run. Let's ensure the default constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trip_requests' AND column_name = 'is_dismissed'
    ) THEN
        ALTER TABLE "trip_requests" ADD COLUMN "is_dismissed" boolean DEFAULT false NOT NULL;
    ELSE
        -- Ensure the default is set correctly even if the column exists
        ALTER TABLE "trip_requests" ALTER COLUMN "is_dismissed" SET DEFAULT false;
        -- Ensure NOT NULL constraint is applied
        ALTER TABLE "trip_requests" ALTER COLUMN "is_dismissed" SET NOT NULL;
    END IF;
END $$;

-- Optional: Add index for the new is_dismissed column if not added by 0009
-- CREATE INDEX IF NOT EXISTS "trip_requests_user_dismissed_idx" ON "trip_requests" ("user_id", "is_dismissed");

-- Add a final newline for good measure