/**
 * @description
 * Migration script to add the activities table and update profiles for TripRizz.
 * 
 * Key changes:
 * - Creates activities table for itinerary details
 * - Sets default for profiles.display_name
 * - Links activities.trip_id to itineraries.id with cascade deletion
 * 
 * @dependencies
 * - 0001_absent_onslaught.sql: Updated profiles and added itineraries
 * 
 * @notes
 * - Removed redundant ADD PRIMARY KEY on profiles.user_id to avoid conflict with 0000
 * - Drops profiles.id if it exists (from early schema iterations)
 */

CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "display_name" SET DEFAULT 'Anonymous';
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_trip_id_itineraries_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "id";