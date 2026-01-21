-- ============================================================================
-- Dooza AI: Workspace Tasks Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This creates the workspace tasks system for the Agentic Workspace:
-- - workspace_tasks: Task lifecycle with state machine
-- - Performance indexes for calendar and dashboard queries
-- - Row Level Security policies
-- - Extension to domain_ui_components for workspace views
-- ============================================================================


-- ============================================================================
-- 1. Workspace Tasks Table
-- ============================================================================
-- Stores actionable work items created by agents for user review.
-- Separate from agent_data_store (Memory) - this is Work (Future/Action).

CREATE TABLE IF NOT EXISTS workspace_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership (security boundary)
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Task identity
    agent_slug TEXT NOT NULL,
    task_type TEXT NOT NULL,
    title TEXT NOT NULL,
    
    -- Lifecycle state machine
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'pending_approval', 
            'approved', 
            'scheduled', 
            'published', 
            'rejected', 
            'cancelled'
        )),
    
    -- Content (validated by Pydantic before insert)
    content_payload JSONB NOT NULL,
    
    -- Scheduling
    due_date TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    -- Feedback loop for rejections
    feedback_history JSONB DEFAULT '[]',
    
    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Revision tracking (for rejected -> revised flow)
    parent_task_id UUID REFERENCES workspace_tasks(id),
    
    -- Source context (which chat thread created this)
    thread_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE workspace_tasks IS 'Actionable work items created by agents for user review and approval. Separate from agent_data_store (Memory) to optimize for different query patterns.';
COMMENT ON COLUMN workspace_tasks.status IS 'Lifecycle: draft -> pending_approval -> approved -> scheduled -> published. Can be rejected (returns to draft) or cancelled.';
COMMENT ON COLUMN workspace_tasks.version IS 'Optimistic locking version. Increment on each update to prevent concurrent edit conflicts.';
COMMENT ON COLUMN workspace_tasks.feedback_history IS 'Array of {feedback, rejected_at, rejected_by} for tracking revision requests.';


-- ============================================================================
-- 2. Performance Indexes
-- ============================================================================
-- Partial indexes for common query patterns to keep dashboard fast.

-- Primary calendar query: tasks in date range by status
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_calendar 
    ON workspace_tasks(due_date, status) 
    WHERE due_date IS NOT NULL;

-- Dashboard: pending approvals for user (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_pending 
    ON workspace_tasks(user_id, status) 
    WHERE status = 'pending_approval';

-- Agent's tasks (for agent context and history)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_agent 
    ON workspace_tasks(agent_slug, created_at DESC);

-- Org-level queries (for team dashboards)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_org 
    ON workspace_tasks(org_id, status)
    WHERE org_id IS NOT NULL;

-- User's tasks by status (for filtering)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_user_status
    ON workspace_tasks(user_id, status, created_at DESC);

-- Thread lookup (find tasks from a conversation)
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_thread
    ON workspace_tasks(thread_id)
    WHERE thread_id IS NOT NULL;


-- ============================================================================
-- 3. Row Level Security
-- ============================================================================

ALTER TABLE workspace_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view their own tasks
CREATE POLICY "Users can view their tasks" ON workspace_tasks
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create tasks (agents create on behalf of users)
CREATE POLICY "Users can create tasks" ON workspace_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks
CREATE POLICY "Users can update their tasks" ON workspace_tasks
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own tasks
CREATE POLICY "Users can delete their tasks" ON workspace_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access on workspace_tasks" ON workspace_tasks
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 4. Auto-update Trigger
-- ============================================================================
-- Reuse existing update_updated_at_column function from previous migrations

DROP TRIGGER IF EXISTS update_workspace_tasks_updated_at ON workspace_tasks;
CREATE TRIGGER update_workspace_tasks_updated_at
    BEFORE UPDATE ON workspace_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 5. Extend domain_ui_components for Workspace Views
-- ============================================================================
-- Add columns to support task-type based UI lookup and calendar colors.

ALTER TABLE domain_ui_components
ADD COLUMN IF NOT EXISTS task_type TEXT,
ADD COLUMN IF NOT EXISTS calendar_color TEXT DEFAULT '#6b7280',
ADD COLUMN IF NOT EXISTS render_context TEXT DEFAULT 'chat';

-- Add check constraint for render_context (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'domain_ui_components_render_context_check'
    ) THEN
        ALTER TABLE domain_ui_components
        ADD CONSTRAINT domain_ui_components_render_context_check
        CHECK (render_context IN ('chat', 'workspace', 'both'));
    END IF;
END $$;

-- Index for task_type lookups
CREATE INDEX IF NOT EXISTS idx_ui_components_task_type 
    ON domain_ui_components(task_type) 
    WHERE task_type IS NOT NULL;


-- ============================================================================
-- 6. Seed Workspace UI Components
-- ============================================================================
-- Pre-populate UI configurations for initial task types.

INSERT INTO domain_ui_components (
    domain, tool_name, task_type, component_type, display_name, 
    description, ui_schema, is_editable, calendar_color, render_context
)
VALUES 
    -- SEO Domain: Blog Post
    (
        'seo',
        'create_task',
        'blog_post',
        'visualizer',
        'Blog Post',
        'SEO-optimized blog post with title, body, and keywords',
        '{
            "display": "card",
            "title": "Blog Post",
            "sections": [
                {
                    "id": "content",
                    "title": "Content",
                    "display": "key_value",
                    "fields": [
                        {"key": "title", "label": "Title", "type": "text"},
                        {"key": "meta_description", "label": "Meta Description", "type": "text"},
                        {"key": "keywords", "label": "Keywords", "type": "tags"}
                    ]
                },
                {
                    "id": "body",
                    "title": "Body",
                    "display": "raw",
                    "fields": [
                        {"key": "body", "label": "Content", "type": "markdown"}
                    ]
                }
            ]
        }'::jsonb,
        true,
        '#10b981',
        'both'
    ),
    -- Social Domain: Tweet
    (
        'social',
        'create_task',
        'tweet',
        'visualizer',
        'Tweet',
        'Twitter/X post with text and hashtags',
        '{
            "display": "card",
            "title": "Tweet",
            "sections": [
                {
                    "id": "content",
                    "title": "Content",
                    "display": "key_value",
                    "fields": [
                        {"key": "text", "label": "Text", "type": "text"},
                        {"key": "hashtags", "label": "Hashtags", "type": "tags"},
                        {"key": "media_url", "label": "Media", "type": "url"}
                    ]
                }
            ]
        }'::jsonb,
        true,
        '#8b5cf6',
        'both'
    ),
    -- Video Domain: Video Script
    (
        'video',
        'create_task',
        'video_script',
        'visualizer',
        'Video Script',
        'Video script with hook, scenes, and CTA',
        '{
            "display": "card",
            "title": "Video Script",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "display": "key_value",
                    "fields": [
                        {"key": "title", "label": "Title", "type": "text"},
                        {"key": "hook", "label": "Hook", "type": "text"},
                        {"key": "duration_seconds", "label": "Duration", "type": "number"},
                        {"key": "cta", "label": "Call to Action", "type": "text"}
                    ]
                },
                {
                    "id": "scenes",
                    "title": "Scenes",
                    "display": "data_table",
                    "fields": [
                        {"key": "scenes", "label": "Scenes", "type": "array"}
                    ]
                }
            ]
        }'::jsonb,
        true,
        '#f59e0b',
        'both'
    )
ON CONFLICT (domain, tool_name, component_type) DO UPDATE SET
    task_type = EXCLUDED.task_type,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ui_schema = EXCLUDED.ui_schema,
    is_editable = EXCLUDED.is_editable,
    calendar_color = EXCLUDED.calendar_color,
    render_context = EXCLUDED.render_context,
    updated_at = NOW();


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this migration:
-- 1. workspace_tasks table for agentic work items
-- 2. Performance indexes for calendar and dashboard queries
-- 3. RLS policies for user data isolation
-- 4. domain_ui_components extended with task_type and calendar_color
-- 5. Seed data for blog_post, tweet, video_script UI configs
-- ============================================================================
