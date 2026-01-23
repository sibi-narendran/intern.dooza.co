-- ============================================================================
-- Dooza AI: Storage Buckets Setup
-- ============================================================================
-- This creates the Supabase Storage bucket for brand assets (logos, images, etc.)
-- 
-- IMPORTANT: Run this in Supabase SQL Editor (Database > SQL Editor)
-- This uses Supabase's storage schema directly.
-- ============================================================================


-- ============================================================================
-- 1. Create the brand-assets bucket
-- ============================================================================
-- Public bucket so getPublicUrl() works without signed URLs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'brand-assets',
    'brand-assets',
    true,  -- Public bucket for easy access
    52428800,  -- 50MB limit per file
    ARRAY[
        'image/png', 
        'image/jpeg', 
        'image/jpg',
        'image/gif', 
        'image/webp', 
        'image/svg+xml',
        'video/mp4', 
        'video/webm', 
        'video/quicktime',
        'application/pdf', 
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'font/ttf', 
        'font/otf', 
        'font/woff', 
        'font/woff2'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 2. Storage RLS Policies
-- ============================================================================
-- Allow authenticated users to manage their own files
-- Files are stored in paths like: {user_id}/{asset_type}/{filename}

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for brand-assets" ON storage.objects;

-- Policy: Public can read files from brand-assets bucket (since bucket is public)
CREATE POLICY "Public read access for brand-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');

-- Policy: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'brand-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'brand-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'brand-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this migration:
-- 1. 'brand-assets' bucket is created with public read access
-- 2. Authenticated users can upload/update/delete their own files
-- 3. File path format: {user_id}/{asset_type}/{filename}
--
-- The frontend uses paths like: `${user.id}/logo/logo-123456.png`
-- which matches the RLS policies above.
-- ============================================================================
