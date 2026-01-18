-- ============================================================================
-- Dooza AI: Database Migration for Supabase
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This creates the threads table for tracking conversations.
-- LangGraph's checkpointer will create its own tables automatically.
-- ============================================================================

-- Threads table to track user conversations
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);

-- Index for filtering by agent
CREATE INDEX IF NOT EXISTS idx_threads_agent_id ON threads(agent_id);

-- Composite index for user + agent queries
CREATE INDEX IF NOT EXISTS idx_threads_user_agent ON threads(user_id, agent_id);

-- Enable Row Level Security
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own threads
CREATE POLICY "Users can view own threads" ON threads
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own threads
CREATE POLICY "Users can create own threads" ON threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own threads
CREATE POLICY "Users can update own threads" ON threads
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own threads
CREATE POLICY "Users can delete own threads" ON threads
    FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on threads
DROP TRIGGER IF EXISTS update_threads_updated_at ON threads;
CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
