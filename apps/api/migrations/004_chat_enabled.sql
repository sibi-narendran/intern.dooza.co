-- ============================================================================
-- Dooza AI: Chat Enabled Column Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This adds the chat_enabled column to gallery_agents to indicate which
-- agents support chat functionality (have tools/supervisor).
-- 
-- This enables frontend to dynamically show/hide chat buttons without
-- hardcoded agent lists.
-- ============================================================================

-- Add chat_enabled column to gallery_agents
ALTER TABLE gallery_agents 
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN gallery_agents.chat_enabled IS 
    'Whether this agent supports chat (has tools/supervisor). Used by frontend to show chat button.';

-- Enable chat for SEOmi (our first supervisor agent)
UPDATE gallery_agents 
SET chat_enabled = true 
WHERE slug = 'seomi';

-- Verify the update
SELECT slug, name, chat_enabled 
FROM gallery_agents 
ORDER BY chat_enabled DESC, name;

-- ============================================================================
-- Done!
-- ============================================================================
-- After running this migration:
-- 1. gallery_agents has a chat_enabled column
-- 2. SEOmi is marked as chat_enabled = true
-- 3. Frontend can read this from API instead of hardcoding agent lists
-- ============================================================================
