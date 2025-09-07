-- Create the trip_photos table
CREATE TABLE IF NOT EXISTS trip_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_trip_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trip_photos_updated_at_trigger
BEFORE UPDATE ON trip_photos
FOR EACH ROW
EXECUTE FUNCTION update_trip_photos_updated_at();


-- Allow authenticated users to upload photos to trips they are members of
CREATE POLICY "Users can upload photos to trips they are members of" ON storage.objects FOR INSERT TO authenticated USING (
  bucket_id = 'trip-photos' AND
  EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = (storage.foldername(name))[1]
    AND trip_members.user_id = auth.uid()
  )
);

-- Allow all authenticated users to view trip photos
CREATE POLICY "Anyone can view trip photos" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'trip-photos'
);

-- Allow users to delete only their own photos
CREATE POLICY "Users can delete their own photos" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'trip-photos' AND
  (storage.foldername(name))[2] = auth.uid()
);