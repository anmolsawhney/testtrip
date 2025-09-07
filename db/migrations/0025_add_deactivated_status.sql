-- Migration: Add 'deactivated' value to the trip_status enum

-- This allows trips to be "soft-deleted" by the creator or an admin
-- without permanently removing the data from the database.
ALTER TYPE "public"."trip_status" ADD VALUE IF NOT EXISTS 'deactivated';