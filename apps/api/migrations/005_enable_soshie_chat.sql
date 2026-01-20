-- Migration: Enable chat for Soshie
-- 
-- Soshie (Social Media Lead) now has a working supervisor implementation.
-- This enables the chat interface for Soshie users.

-- Enable chat for soshie
UPDATE gallery_agents 
SET chat_enabled = true 
WHERE slug = 'soshie';

-- Verify the update
SELECT slug, name, chat_enabled 
FROM gallery_agents 
WHERE slug IN ('seomi', 'soshie')
ORDER BY name;
