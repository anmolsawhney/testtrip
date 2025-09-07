-- Migration: Add indexes for performance optimization

-- This migration adds several indexes to key tables to improve the performance
-- of common filtering and sorting operations, especially for the main trip feeds.

-- Enable the pg_trgm extension if it doesn't exist. This is required for
-- efficient text searching using GIN/GIST indexes (for location search).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Create a composite index on the itineraries table.
-- This helps queries that filter by visibility, trip_type, and status,
-- which are very common in getFilteredTripsAction.
CREATE INDEX IF NOT EXISTS "itineraries_composite_filter_idx" ON "public"."itineraries" ("visibility", "trip_type", "status");

-- 2. Create a GIN index on the trip_preferences array column.
-- Standard B-tree indexes are not effective for array containment queries (@>).
-- A GIN index is highly efficient for this type of search.
CREATE INDEX IF NOT EXISTS "itineraries_trip_preferences_gin_idx" ON "public"."itineraries" USING gin ("trip_preferences");

-- 3. Create a GIN index on the location column using the pg_trgm extension.
-- This dramatically speeds up `ilike` queries with leading wildcards (e.g., '%bali%').
-- The index is created on the lowercased version of the text for case-insensitive searching.
CREATE INDEX IF NOT EXISTS "itineraries_location_trgm_gin_idx" ON "public"."itineraries" USING gin (lower(location) gin_trgm_ops);


-- 4. Re-add indexes from migration 0030 for completeness, just in case.
-- These are idempotent and will not cause errors if they already exist.
CREATE INDEX IF NOT EXISTS "itineraries_creator_id_idx" ON "public"."itineraries" ("creator_id");
CREATE INDEX IF NOT EXISTS "itineraries_like_count_idx" ON "public"."itineraries" ("like_count" DESC);
CREATE INDEX IF NOT EXISTS "trip_members_trip_id_idx" ON "public"."trip_members" ("trip_id");
CREATE INDEX IF NOT EXISTS "trip_members_user_id_idx" ON "public"."trip_members" ("user_id");

-- Confirmation message
SELECT 'All performance indexes have been successfully created or already existed.' as "Status";