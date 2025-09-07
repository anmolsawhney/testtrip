/**
 * @description
 * Migration script to add chat_messages table for trip group chats in TripRizz.
 * 
 * Key changes:
 * - Creates chat_messages table with proper references to itineraries
 * - Sets up automatic updated_at timestamp handling
 * 
 * @dependencies
 * - 0003_violet_star_brand.sql: Previous migration that refined profiles table
 * - itineraries table must exist with proper id field
 * 
 * @notes
 * - trip_id is a foreign key referencing itineraries.id with cascade deletion
 * - sender_id is not a formal foreign key but refers to Clerk user IDs
 * - updated_at is managed by trigger for automated timestamp updates
 */

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "itineraries"("id") ON DELETE CASCADE,
  "sender_id" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Ensure updated_at trigger procedure exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  END IF;
END $$;

-- Create trigger for chat_messages
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON chat_messages
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();