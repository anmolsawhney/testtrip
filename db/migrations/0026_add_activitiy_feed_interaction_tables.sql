-- Migration: Create tables for activity feed likes and comments
-- UPDATED: Adds support for threaded comments and likes on comments.
-- FIXED v2: Made the script idempotent by adding `ADD COLUMN IF NOT EXISTS` for the new columns before adding constraints.

-- Create the activity_feed_likes table for LIKES ON POSTS
CREATE TABLE IF NOT EXISTS "activity_feed_likes" (
    "user_id" text NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    "event_id" uuid NOT NULL REFERENCES "activity_feed_events"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "activity_feed_likes_pkey" PRIMARY KEY("user_id", "event_id")
);

-- Create the base activity_feed_comments table if it doesn't exist.
-- New columns are added idempotently below to handle partial migrations.
CREATE TABLE IF NOT EXISTS "activity_feed_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "event_id" uuid NOT NULL REFERENCES "activity_feed_events"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    "content" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Idempotently add the new columns to the comments table to ensure they exist.
ALTER TABLE "activity_feed_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid;
ALTER TABLE "activity_feed_comments" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "activity_feed_comments" ADD COLUMN IF NOT EXISTS "reply_count" integer DEFAULT 0 NOT NULL;

-- Add the self-referencing foreign key constraint AFTER the table and column are guaranteed to exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activity_feed_comments_parent_comment_id_fk' AND conrelid = 'activity_feed_comments'::regclass
    ) THEN
        ALTER TABLE "activity_feed_comments"
        ADD CONSTRAINT "activity_feed_comments_parent_comment_id_fk"
        FOREIGN KEY ("parent_comment_id")
        REFERENCES "activity_feed_comments"("id")
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create the activity_feed_comment_likes table for LIKES ON COMMENTS
CREATE TABLE IF NOT EXISTS "activity_feed_comment_likes" (
    "user_id" text NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    "comment_id" uuid NOT NULL REFERENCES "activity_feed_comments"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "activity_feed_comment_likes_pkey" PRIMARY KEY("user_id", "comment_id")
);


-- Ensure the standard updated_at trigger function exists (it should, but this is safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
       NEW.updated_at = now();
       RETURN NEW;
    END;
    $func$ language 'plpgsql';
  END IF;
END $$;

-- Apply the updated_at trigger to the comments table
DROP TRIGGER IF EXISTS update_activity_feed_comments_updated_at ON "activity_feed_comments";
CREATE TRIGGER update_activity_feed_comments_updated_at
BEFORE UPDATE ON "activity_feed_comments"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "activity_likes_event_idx" ON "activity_feed_likes" ("event_id");
CREATE INDEX IF NOT EXISTS "activity_comments_event_idx" ON "activity_feed_comments" ("event_id");
CREATE INDEX IF NOT EXISTS "activity_comments_parent_idx" ON "activity_feed_comments" ("parent_comment_id"); -- Index for fetching replies
CREATE INDEX IF NOT EXISTS "activity_comment_likes_comment_idx" ON "activity_feed_comment_likes" ("comment_id"); -- Index for fetching likes on a comment

-- Add a final newline for good measure