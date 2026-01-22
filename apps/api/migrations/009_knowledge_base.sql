-- ============================================================================
-- Dooza AI: Knowledge Base & Brand Assets Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This creates:
-- - brand_settings: Organization brand identity (colors, voice, fonts, etc.)
-- - brand_assets: Media library (logos, images, videos stored in Supabase Storage)
--
-- Note: knowledge_bases and knowledge_base_documents already exist from migration 001
-- ============================================================================


-- ============================================================================
-- 1. Brand Settings Table (One per Organization)
-- ============================================================================
-- Stores brand identity: colors, voice, fonts, and company information
-- Used by agents to maintain brand consistency in content creation

CREATE TABLE IF NOT EXISTS brand_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Organization ownership (one brand_settings per org)
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT unique_org_brand_settings UNIQUE (org_id),
    
    -- Business Identity
    business_name TEXT,
    website TEXT,
    tagline TEXT,
    
    -- Brand Voice (used by content agents)
    brand_voice TEXT,  -- Long-form description of tone and style
    
    -- Visual Identity
    colors JSONB DEFAULT '{}'::jsonb,  -- { "primary": "#...", "secondary": "#...", "tertiary": "#..." }
    fonts JSONB DEFAULT '{}'::jsonb,   -- { "heading": "...", "body": "..." }
    
    -- Company Information
    description TEXT,         -- What the business does
    value_proposition TEXT,   -- What makes it unique
    
    -- Additional metadata
    industry TEXT,
    target_audience TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_settings_org ON brand_settings(org_id);

-- RLS
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's brand settings
DROP POLICY IF EXISTS "Org members can view brand settings" ON brand_settings;
CREATE POLICY "Org members can view brand settings" ON brand_settings
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Org admins and owners can manage brand settings
DROP POLICY IF EXISTS "Org admins can manage brand settings" ON brand_settings;
CREATE POLICY "Org admins can manage brand settings" ON brand_settings
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on brand_settings" ON brand_settings;
CREATE POLICY "Service role full access on brand_settings" ON brand_settings
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 2. Brand Assets Table (Media Library)
-- ============================================================================
-- Stores references to files in Supabase Storage
-- Used for logos, images, videos, and documents

CREATE TABLE IF NOT EXISTS brand_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Organization ownership
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Asset Classification
    asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'image', 'video', 'document', 'font')),
    
    -- Asset Identity
    name TEXT NOT NULL,           -- Display name
    description TEXT,             -- Optional description/alt text
    
    -- Storage (Supabase Storage)
    storage_bucket TEXT NOT NULL DEFAULT 'brand-assets',
    file_path TEXT NOT NULL,      -- Path within bucket: {org_id}/{asset_type}/{filename}
    public_url TEXT,              -- Public URL if bucket is public
    
    -- File Metadata
    file_size INTEGER,            -- Size in bytes
    mime_type TEXT,               -- e.g., 'image/png', 'video/mp4'
    
    -- Extended Metadata (dimensions, duration, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,  -- { "width": 1200, "height": 630, "duration": 30 }
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_assets_org ON brand_assets(org_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON brand_assets(org_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_brand_assets_active ON brand_assets(org_id, is_deleted) WHERE is_deleted = false;

-- RLS
ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's assets
DROP POLICY IF EXISTS "Org members can view brand assets" ON brand_assets;
CREATE POLICY "Org members can view brand assets" ON brand_assets
    FOR SELECT USING (
        is_deleted = false AND (
            org_id IN (
                SELECT org_id FROM organization_members WHERE user_id = auth.uid()
            ) OR
            org_id IN (
                SELECT id FROM organizations WHERE owner_id = auth.uid()
            )
        )
    );

-- Org admins and owners can manage assets
DROP POLICY IF EXISTS "Org admins can manage brand assets" ON brand_assets;
CREATE POLICY "Org admins can manage brand assets" ON brand_assets
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on brand_assets" ON brand_assets;
CREATE POLICY "Service role full access on brand_assets" ON brand_assets
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 3. Update Triggers
-- ============================================================================

-- Auto-update updated_at for brand_settings
DROP TRIGGER IF EXISTS update_brand_settings_updated_at ON brand_settings;
CREATE TRIGGER update_brand_settings_updated_at
    BEFORE UPDATE ON brand_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for brand_assets
DROP TRIGGER IF EXISTS update_brand_assets_updated_at ON brand_assets;
CREATE TRIGGER update_brand_assets_updated_at
    BEFORE UPDATE ON brand_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 4. Helper Function: Get or Create Brand Settings
-- ============================================================================
-- Ensures every org has brand_settings (creates default if missing)

CREATE OR REPLACE FUNCTION get_or_create_brand_settings(target_org_id UUID)
RETURNS UUID AS $$
DECLARE
    settings_id UUID;
BEGIN
    -- Try to get existing
    SELECT id INTO settings_id
    FROM brand_settings
    WHERE org_id = target_org_id;
    
    -- Create if not exists
    IF settings_id IS NULL THEN
        INSERT INTO brand_settings (org_id)
        VALUES (target_org_id)
        RETURNING id INTO settings_id;
    END IF;
    
    RETURN settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 5. Create Supabase Storage Bucket for Brand Assets
-- ============================================================================
-- Note: This needs to be run separately in Supabase Dashboard > Storage
-- or via the Supabase JS client. The SQL below is for documentation.

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'brand-assets',
--     'brand-assets',
--     false,  -- Private bucket (use signed URLs)
--     52428800,  -- 50MB limit
--     ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
--           'video/mp4', 'video/webm', 'video/quicktime',
--           'application/pdf', 'application/msword',
--           'font/ttf', 'font/otf', 'font/woff', 'font/woff2']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies would be:
-- - org members can read their org's files
-- - org admins can upload/delete


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this migration:
-- 1. brand_settings table for organization brand identity
-- 2. brand_assets table for media library references
-- 3. RLS policies ensuring org-level access control
-- 4. Helper function for get-or-create pattern
--
-- Next steps:
-- 1. Create 'brand-assets' bucket in Supabase Storage
-- 2. Set up storage policies for the bucket
-- ============================================================================
