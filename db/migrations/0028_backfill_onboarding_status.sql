-- This query updates all profiles where the 'profile_questions_completed' flag
-- is not already true. This is useful for backfilling data for existing users
-- after introducing the new onboarding flow.
UPDATE "public"."profiles"
SET "profile_questions_completed" = true
WHERE "profile_questions_completed" IS NOT TRUE;