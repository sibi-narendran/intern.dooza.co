-- Migration: 011_user_threads
-- Purpose: Lightweight thread tracking for LangGraph conversations
-- 
-- This table maps users to their conversation threads.
-- LangGraph checkpointer handles actual message persistence.
-- This table only tracks thread ownership and metadata.

-- Create user_threads table
CREATE TABLE IF NOT EXISTS user_threads (
    thread_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_slug TEXT NOT NULL,
    title TEXT DEFAULT 'New conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_threads_user_id ON user_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_threads_agent_slug ON user_threads(agent_slug);
CREATE INDEX IF NOT EXISTS idx_user_threads_user_agent ON user_threads(user_id, agent_slug);
CREATE INDEX IF NOT EXISTS idx_user_threads_updated ON user_threads(updated_at DESC);

-- Enable RLS
ALTER TABLE user_threads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own threads" ON user_threads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads" ON user_threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads" ON user_threads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads" ON user_threads
    FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role full access" ON user_threads
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_threads_updated_at ON user_threads;
CREATE TRIGGER trigger_user_threads_updated_at
    BEFORE UPDATE ON user_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_user_threads_updated_at();

-- Note: The old 'messages' table can be dropped if no longer needed
-- DROP TABLE IF EXISTS messages;
-- For safety, we'll leave it and let it be manually dropped later
