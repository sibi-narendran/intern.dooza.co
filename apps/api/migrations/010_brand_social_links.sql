-- ============================================================================
-- Dooza AI: Add Social Links to Brand Settings
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
--
-- Adds social_links JSONB column to brand_settings table for storing
-- extracted social media profile URLs.
-- ============================================================================

-- Add social_links column to brand_settings
ALTER TABLE brand_settings
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN brand_settings.social_links IS 'Social media profile URLs: {"twitter": "...", "linkedin": "...", "instagram": "...", "facebook": "...", "youtube": "...", "tiktok": "..."}';

-- ============================================================================
-- Done!
-- ============================================================================
-- The social_links column stores a JSON object with social media URLs.
-- Example: {"twitter": "https://twitter.com/company", "linkedin": "https://linkedin.com/company/company"}
-- ============================================================================
