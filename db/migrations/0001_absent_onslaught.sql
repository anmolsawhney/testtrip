/**
 * @description
 * Migration script to update the database schema for TripRizz.
 * Adds new tables (itineraries, matches, trip_requests) and updates the profiles table.
 * 
 * Key changes:
 * - Creates enums for trip and match properties
 * - Adds itineraries table for trip management
 * - Adds matches and trip_requests tables for social features
 * - Updates profiles table with additional fields
 * 
 * @dependencies
 * - 0000_nostalgic_mauler.sql: Initial schema with profiles and todos tables
 * 
 * @notes
 * - Drops the todos table as it’s no longer needed per the technical specification
 * - Removed redundant UNIQUE constraint on profiles.user_id to avoid primary key conflict
 * - Assumes prior schema has profiles.user_id as PRIMARY KEY
 */

DO $$ BEGIN
 CREATE TYPE "public"."budget_preference" AS ENUM('budget', 'moderate', 'luxury');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."travel_style" AS ENUM('adventure', 'culture', 'relaxation', 'food', 'photography', 'nature');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."verification_status" AS ENUM('none', 'pending', 'verified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trip_status" AS ENUM('draft', 'active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trip_type" AS ENUM('solo', 'group', 'women_only');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trip_visibility" AS ENUM('public', 'private', 'followers_only');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_status" AS ENUM('pending', 'accepted', 'rejected', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "itineraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"trip_type" "trip_type" NOT NULL,
	"trip_visibility" "trip_visibility" DEFAULT 'private' NOT NULL,
	"trip_status" "trip_status" DEFAULT 'draft' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"location" text NOT NULL,
	"budget" integer,
	"max_group_size" integer,
	"current_group_size" integer DEFAULT 1,
	"itinerary_details" jsonb,
	"photos" text[],
	"upvotes" integer DEFAULT 0,
	"downvotes" integer DEFAULT 0,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id_1" text NOT NULL,
	"user_id_2" text NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"initiated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "todos";
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "display_name" varchar(50) NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "bio" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "verification_status" "verification_status" DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "verification_document" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "profile_photo" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "languages_spoken" text[];
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "budget_preference" "budget_preference";
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "travel_style" "travel_style"[];
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "instagram_handle" varchar(30);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "snapchat_handle" varchar(30);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "membership";
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "stripe_customer_id";
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "stripe_subscription_id";