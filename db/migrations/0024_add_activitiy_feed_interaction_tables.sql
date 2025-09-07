-- Migration: Create tables for activity feed likes and comments

-- Create the activity_feed_likes table
CREATE TABLE IF NOT EXISTS "activity_feed_likes" (
    "user_id" text NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    "event_id" uuid NOT NULL REFERENCES "activity_feed_events"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "activity_feed_likes_pkey" PRIMARY KEY("user_id", "event_id")
);

-- Create the activity_feed_comments table
CREATE TABLE IF NOT EXISTS "activity_feed_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "event_id" uuid NOT NULL REFERENCES "activity_feed_events"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    "content" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
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

-- Apply the updated_at trigger to the new comments table
DROP TRIGGER IF EXISTS update_activity_feed_comments_updated_at ON "activity_feed_comments";
CREATE TRIGGER update_activity_feed_comments_updated_at
BEFORE UPDATE ON "activity_feed_comments"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "activity_likes_event_idx" ON "activity_feed_likes" ("event_id");
CREATE INDEX IF NOT EXISTS "activity_comments_event_idx" ON "activity_feed_comments" ("event_id");

-- Add a final newline for good measure