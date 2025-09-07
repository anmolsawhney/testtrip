-- Migration: Rename travel_style to travel_preferences, change type, update NULLs, set default/not null, and add personalized question answers

-- Rename the existing travel_style column to travel_preferences
ALTER TABLE "profiles" RENAME COLUMN "travel_style" TO "travel_preferences";

-- Explicitly change the data type of the renamed column to text[]
-- The USING clause casts the existing enum array values to text array values
ALTER TABLE "profiles" ALTER COLUMN "travel_preferences" TYPE text[] USING "travel_preferences"::text[];

-- *** FIX: Update existing NULL values to empty array before setting NOT NULL ***
UPDATE "profiles" SET "travel_preferences" = '{}'::text[] WHERE "travel_preferences" IS NULL;

-- Set the default value for the column (now of type text[])
ALTER TABLE "profiles" ALTER COLUMN "travel_preferences" SET DEFAULT '{}'::text[];

-- Now, apply the NOT NULL constraint (should succeed as NULLs are updated)
ALTER TABLE "profiles" ALTER COLUMN "travel_preferences" SET NOT NULL;

-- Drop the old travel_style enum as it's no longer needed
DROP TYPE IF EXISTS "public"."travel_style";

-- Add columns for personalized question answers (all nullable text)
ALTER TABLE "profiles" ADD COLUMN "q_travel_mood" text;
ALTER TABLE "profiles" ADD COLUMN "q_night_owl" text;
ALTER TABLE "profiles" ADD COLUMN "q_travel_anthem" text;
ALTER TABLE "profiles" ADD COLUMN "q_must_pack" text;
ALTER TABLE "profiles" ADD COLUMN "q_buddy_vibe" text;
ALTER TABLE "profiles" ADD COLUMN "q_pet_peeve" text;
ALTER TABLE "profiles" ADD COLUMN "q_group_role" text;
ALTER TABLE "profiles" ADD COLUMN "q_group_activities" text;
ALTER TABLE "profiles" ADD COLUMN "q_unwind_method" text;
ALTER TABLE "profiles" ADD COLUMN "q_food_adventure" text;
ALTER TABLE "profiles" ADD COLUMN "q_travel_ick" text;
ALTER TABLE "profiles" ADD COLUMN "q_bucket_list_goal" text;

-- Add a final newline for good measure