-- Migration: Change the data type of `related_id` in `activity_feed_events` table
-- This migration corrects a schema flaw where `related_id` was a UUID but needed
-- to store text-based user IDs for 'follow' events. Changing it to `text`
-- resolves the `invalid input syntax for type uuid` error.

ALTER TABLE "public"."activity_feed_events" ALTER COLUMN "related_id" TYPE text;