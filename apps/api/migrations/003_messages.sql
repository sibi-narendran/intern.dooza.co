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
    tool_calls JSONB,      -- [{name: 'seo_analyze_url', args: {...}}]
    tool_results JSONB,    -- [{name: 'seo_analyze_url', result: {...}}]
    
    -- Metadata
    tokens_used INTEGER DEFAULT 0,
    model_used TEXT,
    
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

-- Policy: Users can only see their own messages
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own messages
CREATE POLICY "Users can create own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Update threads table to include last message preview
-- ============================================================================
ALTER TABLE threads ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Function to update thread on new message
CREATE OR REPLACE FUNCTION update_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or create thread
    INSERT INTO threads (id, user_id, agent_id, title, last_message_preview, message_count)
    VALUES (
        NEW.thread_id,
        NEW.user_id,
        NEW.agent_slug,
        CASE WHEN NEW.role = 'user' THEN LEFT(NEW.content, 100) ELSE NULL END,
        LEFT(NEW.content, 200),
        1
    )
    ON CONFLICT (id) DO UPDATE SET
        last_message_preview = LEFT(NEW.content, 200),
        message_count = threads.message_count + 1,
        updated_at = NOW(),
        -- Set title from first user message if not set
        title = COALESCE(threads.title, 
            CASE WHEN NEW.role = 'user' THEN LEFT(NEW.content, 100) ELSE threads.title END
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update thread when message is inserted
DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON messages;
CREATE TRIGGER trigger_update_thread_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_on_message();

-- ============================================================================
-- Grant service role access (for backend API)
-- ============================================================================
-- Note: Service role bypasses RLS, so these are just explicit grants
GRANT ALL ON messages TO service_role;
GRANT ALL ON threads TO service_role;
