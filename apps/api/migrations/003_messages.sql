-- ============================================================================
-- Dooza AI: Messages Table Migration
-- ============================================================================
-- Run this in Supabase SQL Editor
-- This stores actual chat messages for display in the UI
-- ============================================================================

-- Messages table to store chat history
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Conversation tracking
    thread_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_slug TEXT NOT NULL,
    
    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
    content TEXT NOT NULL,
    
    -- Tool information (for assistant messages with tool calls)
    tool_calls JSONB,      -- [{name: 'seo_analyze_url', args: {...}, summary: {...}}]
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_agent ON messages(user_id, agent_slug);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Composite index for loading conversation history
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can create own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON messages;

-- Policy: Users can only see their own messages
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own messages
CREATE POLICY "Users can create own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Service role has full access (for backend API)
CREATE POLICY "Service role full access" ON messages
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Grant service role access (for backend API)
-- ============================================================================
GRANT ALL ON messages TO service_role;
GRANT ALL ON messages TO authenticated;
