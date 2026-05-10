
-- Create public storage bucket for landing page assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-page-assets', 'landing-page-assets', true);

-- Allow public read access
CREATE POLICY "Anyone can view landing page assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-page-assets');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload landing page assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landing-page-assets');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own landing page assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'landing-page-assets');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own landing page assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'landing-page-assets');
