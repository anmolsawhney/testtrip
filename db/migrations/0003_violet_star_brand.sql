/**
 * @description
 * Migration script to refine the profiles table for TripRizz.
 * 
 * Key changes:
 * - Sets default empty arrays for languages_spoken and travel_style
 * 
 * @dependencies
 * - 0002_dear_mojo.sql: Updated profiles and added activities
 * 
 * @notes
 * - Removed DROP CONSTRAINT "profiles_user_id_unique" as it doesn’t exist in prior migrations
 * - Ensures array columns have consistent defaults per profiles-schema.ts
 */

ALTER TABLE "profiles" ALTER COLUMN "languages_spoken" SET DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "travel_style" SET DEFAULT '{}';