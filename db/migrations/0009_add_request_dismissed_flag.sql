-- Migration to add a dismissal flag to trip requests

-- Add the is_dismissed column to the trip_requests table
-- This flag indicates if the requesting user has acknowledged/dismissed
-- the notification related to the request's final status (accepted/rejected).
ALTER TABLE "trip_requests" ADD COLUMN "is_dismissed" boolean DEFAULT false NOT NULL;

-- Optional: Add an index to potentially improve query performance when filtering
-- by user ID and dismissal status, which will be common for fetching active notifications.
CREATE INDEX IF NOT EXISTS "trip_requests_user_dismissed_idx" ON "trip_requests" ("user_id", "is_dismissed");