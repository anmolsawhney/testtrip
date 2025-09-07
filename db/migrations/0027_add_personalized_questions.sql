-- Add new columns for the updated personalized questions
ALTER TABLE "profiles" ADD COLUMN "q_travel_playlist" text;
ALTER TABLE "profiles" ADD COLUMN "q_next_destination" text;