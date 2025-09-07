-- Migration: Add tables for social interaction features (Follows, Likes, Wishlist, Reports, Activity Feed, DMs, Blocks)

-- Create Enums first as tables depend on them
DO $$ BEGIN
    CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."report_reason" AS ENUM('Spam', 'Inappropriate Content', 'Impersonation', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed_warned', 'reviewed_suspended', 'reviewed_banned', 'resolved_no_action');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."activity_event_type" AS ENUM('new_photo', 'new_trip', 'joined_trip', 'new_review', 'follow');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."conversation_status" AS ENUM('active', 'request');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."block_type" AS ENUM('dm', 'profile');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Create follows table
CREATE TABLE IF NOT EXISTS "follows" (
    "follower_id" text NOT NULL,
    "following_id" text NOT NULL,
    "status" follow_status NOT NULL,
    "is_dismissed_by_follower" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "follows_pkey" PRIMARY KEY("follower_id","following_id")
);

-- Add foreign key constraints for follows table
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_profiles_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_profiles_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for follows table
CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "follows_following_idx" ON "follows" ("following_id");
CREATE INDEX IF NOT EXISTS "follows_following_status_idx" ON "follows" ("following_id","status");


-- Create likes table
CREATE TABLE IF NOT EXISTS "likes" (
    "user_id" text NOT NULL,
    "itinerary_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "likes_pkey" PRIMARY KEY("user_id","itinerary_id")
);

-- Add foreign key constraints for likes table
DO $$ BEGIN
 ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "likes" ADD CONSTRAINT "likes_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for likes table
CREATE INDEX IF NOT EXISTS "likes_itinerary_idx" ON "likes" ("itinerary_id");


-- Create wishlist_items table
CREATE TABLE IF NOT EXISTS "wishlist_items" (
    "user_id" text NOT NULL,
    "itinerary_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY("user_id","itinerary_id")
);

-- Add foreign key constraints for wishlist_items table
DO $$ BEGIN
 ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for wishlist_items table
CREATE INDEX IF NOT EXISTS "wishlist_user_idx" ON "wishlist_items" ("user_id");


-- Create reports table
CREATE TABLE IF NOT EXISTS "reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reporter_id" text NOT NULL,
    "reported_id" text NOT NULL,
    "reason" report_reason NOT NULL,
    "description" text,
    "status" report_status DEFAULT 'pending' NOT NULL,
    "admin_notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for reports table
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_id_profiles_user_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for reports table
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" ("status");
CREATE INDEX IF NOT EXISTS "reports_reported_idx" ON "reports" ("reported_id");


-- Create activity_feed_events table
CREATE TABLE IF NOT EXISTS "activity_feed_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "event_type" activity_event_type NOT NULL,
    "related_id" uuid NOT NULL,
    "target_user_id" text,
    "event_data" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for activity_feed_events table
DO $$ BEGIN
 ALTER TABLE "activity_feed_events" ADD CONSTRAINT "activity_feed_events_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "activity_feed_events" ADD CONSTRAINT "activity_feed_events_target_user_id_profiles_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for activity_feed_events table
CREATE INDEX IF NOT EXISTS "activity_user_time_idx" ON "activity_feed_events" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_time_idx" ON "activity_feed_events" ("created_at" DESC);


-- Create direct_message_conversations table
CREATE TABLE IF NOT EXISTS "direct_message_conversations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user1_id" text NOT NULL,
    "user2_id" text NOT NULL,
    "status" conversation_status DEFAULT 'request' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "last_message_id" uuid,
    "user1_last_read_at" timestamp,
    "user2_last_read_at" timestamp,
    CONSTRAINT "dm_conversations_user_pair_check" CHECK (user1_id < user2_id) -- Enforce user order
);

-- Add unique index for user pairs
CREATE UNIQUE INDEX IF NOT EXISTS "dm_conversations_user_pair_unique_idx" ON "direct_message_conversations" ("user1_id","user2_id");

-- Add foreign key constraints for direct_message_conversations table
DO $$ BEGIN
 ALTER TABLE "direct_message_conversations" ADD CONSTRAINT "dm_conversations_user1_id_profiles_user_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_message_conversations" ADD CONSTRAINT "dm_conversations_user2_id_profiles_user_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- FK for last_message_id needs to reference direct_messages, added after that table is created


-- Create direct_messages table
CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "conversation_id" uuid NOT NULL,
    "sender_id" text NOT NULL,
    "content" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for direct_messages table
DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_dm_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."direct_message_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_profiles_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add index for fetching messages in a conversation efficiently
CREATE INDEX IF NOT EXISTS "dm_convo_time_idx" ON "direct_messages" ("conversation_id","created_at" ASC);


-- Add FK constraint for last_message_id in direct_message_conversations now that direct_messages exists
DO $$ BEGIN
 ALTER TABLE "direct_message_conversations" ADD CONSTRAINT "dm_conversations_last_message_id_direct_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."direct_messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for direct_message_conversations table (if not automatically created by UNIQUE constraint)
CREATE INDEX IF NOT EXISTS "dm_conversations_user1_idx" ON "direct_message_conversations" ("user1_id");
CREATE INDEX IF NOT EXISTS "dm_conversations_user2_idx" ON "direct_message_conversations" ("user2_id");
CREATE INDEX IF NOT EXISTS "dm_conversations_status1_idx" ON "direct_message_conversations" ("user1_id", "status");
CREATE INDEX IF NOT EXISTS "dm_conversations_status2_idx" ON "direct_message_conversations" ("user2_id", "status");
CREATE INDEX IF NOT EXISTS "dm_conversations_updated_idx" ON "direct_message_conversations" ("updated_at" DESC);


-- Create blocks table
CREATE TABLE IF NOT EXISTS "blocks" (
    "blocker_id" text NOT NULL,
    "blocked_id" text NOT NULL,
    "type" block_type NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "blocks_pkey" PRIMARY KEY("blocker_id","blocked_id","type")
);

-- Add foreign key constraints for blocks table
DO $$ BEGIN
 ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_profiles_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_profiles_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for blocks table
CREATE INDEX IF NOT EXISTS "blocks_blocker_idx" ON "blocks" ("blocker_id", "type");
CREATE INDEX IF NOT EXISTS "blocks_blocked_idx" ON "blocks" ("blocked_id", "type");


-- Ensure the standard updated_at trigger function exists (might be redundant if run before)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Use named dollar quotes for the function body
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
       NEW.updated_at = now();
       RETURN NEW;
    END;
    $func$ language 'plpgsql';
  END IF;
END $$;

-- Apply the updated_at trigger to relevant tables (if not already handled by Drizzle's $onUpdate)
-- Note: Drizzle's $onUpdate handles this at the ORM level, but applying DB triggers ensures consistency
-- Trigger for follows
DROP TRIGGER IF EXISTS update_follows_updated_at ON follows;
CREATE TRIGGER update_follows_updated_at BEFORE UPDATE ON follows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for reports
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for direct_message_conversations
DROP TRIGGER IF EXISTS update_dm_conversations_updated_at ON direct_message_conversations;
CREATE TRIGGER update_dm_conversations_updated_at BEFORE UPDATE ON direct_message_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add a final newline for good measure