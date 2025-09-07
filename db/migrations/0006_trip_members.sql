-- First check if enum type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_member_role') THEN
        CREATE TYPE trip_member_role AS ENUM ('owner', 'member');
    END IF;
END $$;

-- Create the trip_members table
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role trip_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add existing trip creators as trip members with owner role
INSERT INTO trip_members (trip_id, user_id, role)
SELECT id, creator_id, 'owner'::trip_member_role 
FROM itineraries
WHERE NOT EXISTS (
  SELECT 1 FROM trip_members 
  WHERE trip_members.trip_id = itineraries.id 
  AND trip_members.user_id = itineraries.creator_id
);