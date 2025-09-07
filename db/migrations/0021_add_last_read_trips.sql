-- Migration to add last_read_at timestamp to trip_members table
ALTER TABLE "trip_members" ADD COLUMN "last_read_at" timestamp;