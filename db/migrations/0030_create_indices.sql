-- This script adds a comprehensive set of indexes to the database to improve query performance.
-- It is idempotent, meaning it can be run multiple times without causing errors.

-- === Social Features (Follows & Profile) ===
CREATE INDEX IF NOT EXISTS "follows_follower_id_idx" ON "public"."follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "follows_following_id_idx" ON "public"."follows" ("following_id");
CREATE INDEX IF NOT EXISTS "follows_status_for_user_idx" ON "public"."follows" ("following_id", "status");
-- The UNIQUE constraint on profiles.username already creates an index, but we ensure it exists.
-- The migration script should have already created this. This is a safeguard.
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");


-- === Direct Messaging ===
CREATE INDEX IF NOT EXISTS "dm_conversations_user1_idx" ON "public"."direct_message_conversations" ("user1_id");
CREATE INDEX IF NOT EXISTS "dm_conversations_user2_idx" ON "public"."direct_message_conversations" ("user2_id");
CREATE INDEX IF NOT EXISTS "dm_conversations_updated_at_idx" ON "public"."direct_message_conversations" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "dm_messages_conversation_id_created_at_idx" ON "public"."direct_messages" ("conversation_id", "created_at" ASC);


-- === Activity Feed ===
CREATE INDEX IF NOT EXISTS "activity_feed_user_id_created_at_idx" ON "public"."activity_feed_events" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_comments_event_id_idx" ON "public"."activity_feed_comments" ("event_id");
CREATE INDEX IF NOT EXISTS "activity_comments_parent_id_idx" ON "public"."activity_feed_comments" ("parent_comment_id");
CREATE INDEX IF NOT EXISTS "activity_likes_event_id_idx" ON "public"."activity_feed_likes" ("event_id");


-- === Trips, Likes, and Wishlists ===
CREATE INDEX IF NOT EXISTS "itineraries_creator_id_idx" ON "public"."itineraries" ("creator_id");
CREATE INDEX IF NOT EXISTS "itineraries_status_idx" ON "public"."itineraries" ("status");
CREATE INDEX IF NOT EXISTS "itineraries_visibility_idx" ON "public"."itineraries" ("visibility");
CREATE INDEX IF NOT EXISTS "itineraries_like_count_idx" ON "public"."itineraries" ("like_count" DESC);
CREATE INDEX IF NOT EXISTS "likes_itinerary_id_idx" ON "public"."likes" ("itinerary_id");
CREATE INDEX IF NOT EXISTS "wishlist_items_user_id_idx" ON "public"."wishlist_items" ("user_id");
CREATE INDEX IF NOT EXISTS "trip_reviews_trip_id_idx" ON "public"."trip_reviews" ("trip_id");


-- === Other General Indexes ===
CREATE INDEX IF NOT EXISTS "trip_members_user_id_idx" ON "public"."trip_members" ("user_id");
CREATE INDEX IF NOT EXISTS "trip_members_trip_id_idx" ON "public"."trip_members" ("trip_id");


-- Confirmation message
SELECT 'All recommended indexes have been successfully created or already existed.' as "Status";