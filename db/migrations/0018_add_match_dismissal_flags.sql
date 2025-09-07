-- Migration: Add dismissal flags for match notifications to the matches table

ALTER TABLE "matches"
ADD COLUMN "is_dismissed_by_user1" boolean DEFAULT false NOT NULL,
ADD COLUMN "is_dismissed_by_user2" boolean DEFAULT false NOT NULL;

-- Add final newline for good measure