-- Migration: Add like_count and comment_count to activity_feed_events

-- Add the like_count column to track likes on a feed event
ALTER TABLE "activity_feed_events" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;

-- Add the comment_count column to track comments on a feed event
ALTER TABLE "activity_feed_events" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;

-- Add a final newline for good measure