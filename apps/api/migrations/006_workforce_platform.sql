-- ============================================================================
-- Dooza AI: Workforce Platform Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This creates the workforce platform foundation:
-- - routines: Scheduled/manual workflows per agent
-- - routine_runs: Execution history
-- - thread_context: Shared context for inter-agent communication
-- - agent_handoffs: Log of agent transfers/delegations
-- - domain_ui_components: UI configuration per domain/tool
-- - user_integrations: Extended integration management
-- ============================================================================


-- ============================================================================
-- 1. Routines Table
-- ============================================================================
-- Scheduled or manual workflows that an agent executes

CREATE TABLE IF NOT EXISTS routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Which agent runs this routine
    agent_slug TEXT NOT NULL,  -- References gallery_agents.slug
    
    -- Routine definition
    name TEXT NOT NULL,
    description TEXT,
    task_prompt TEXT NOT NULL,  -- What to tell the agent to do
    
    -- Context variables to inject into the prompt
    -- e.g., { "niche": "AI tools", "tone": "professional", "site_url": "example.com" }
    context_data JSONB DEFAULT '{}',
    
    -- Schedule (NULL = manual only)
    schedule TEXT,  -- Cron expression (e.g., "0 9 * * *" for daily at 9 AM)
    timezone TEXT DEFAULT 'UTC',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_paused BOOLEAN DEFAULT false,
    
    -- Run tracking
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_org ON routines(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routines_agent ON routines(agent_slug);
CREATE INDEX IF NOT EXISTS idx_routines_next_run ON routines(next_run_at) WHERE is_active = true AND is_paused = false;
CREATE INDEX IF NOT EXISTS idx_routines_active ON routines(is_active, is_paused) WHERE is_active = true;

-- RLS
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their routines" ON routines
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create routines" ON routines
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their routines" ON routines
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their routines" ON routines
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on routines" ON routines
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 2. Routine Runs Table
-- ============================================================================
-- Execution history for routines

CREATE TABLE IF NOT EXISTS routine_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Which routine
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    
    -- Execution info
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Status: running, success, failed, cancelled
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
    
    -- How it was triggered
    triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('schedule', 'manual', 'api', 'webhook')),
    
    -- Output and errors
    output JSONB,  -- Full output from the agent
    output_summary TEXT,  -- Human-readable summary
    error_message TEXT,
    
    -- Thread ID if this run created a conversation
    thread_id TEXT,
    
    -- Duration tracking
    duration_ms INTEGER,  -- Calculated on completion
    
    -- Token/cost tracking
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_cents INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_routine_runs_routine ON routine_runs(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_runs_status ON routine_runs(status);
CREATE INDEX IF NOT EXISTS idx_routine_runs_started ON routine_runs(started_at DESC);

-- RLS (inherits access from routines)
ALTER TABLE routine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their routine runs" ON routine_runs
    FOR SELECT USING (
        routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role full access on routine_runs" ON routine_runs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 3. Thread Context Table (Inter-Agent Communication)
-- ============================================================================
-- Shared context store that all agents in a conversation can read/write

CREATE TABLE IF NOT EXISTS thread_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Which thread this context belongs to
    thread_id TEXT NOT NULL,
    
    -- Key-value storage
    -- e.g., "seo_audit_result", "keyword_research", "content_brief"
    context_key TEXT NOT NULL,
    context_value JSONB NOT NULL,
    
    -- Who wrote this context
    set_by_agent TEXT NOT NULL,  -- Agent slug that wrote this
    
    -- Versioning for concurrent access
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one key per thread
    CONSTRAINT unique_thread_context_key UNIQUE (thread_id, context_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thread_context_thread ON thread_context(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_context_key ON thread_context(context_key);
CREATE INDEX IF NOT EXISTS idx_thread_context_agent ON thread_context(set_by_agent);

-- Note: thread_context doesn't need user RLS since thread IDs are opaque
-- and access is controlled by having the thread ID
ALTER TABLE thread_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on thread_context" ON thread_context
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 4. Agent Handoffs Table
-- ============================================================================
-- Log of agent transfers/delegations for debugging and analytics

CREATE TABLE IF NOT EXISTS agent_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Thread where handoff occurred
    thread_id TEXT NOT NULL,
    
    -- Handoff details
    from_agent TEXT NOT NULL,  -- Who handed off
    to_agent TEXT NOT NULL,    -- Who received
    handoff_type TEXT NOT NULL CHECK (handoff_type IN ('delegation', 'handoff', 'error_recovery')),
    
    -- Why the handoff happened
    reason TEXT,
    task_summary TEXT,  -- Brief description of the delegated task
    
    -- State at time of handoff
    context_snapshot JSONB,  -- Relevant context at handoff time
    
    -- Completion info
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'failed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    result_summary TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER  -- Calculated on completion
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_handoffs_thread ON agent_handoffs(thread_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_from ON agent_handoffs(from_agent);
CREATE INDEX IF NOT EXISTS idx_handoffs_to ON agent_handoffs(to_agent);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON agent_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_handoffs_started ON agent_handoffs(started_at DESC);

-- RLS
ALTER TABLE agent_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_handoffs" ON agent_handoffs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 5. Domain UI Components Table
-- ============================================================================
-- Registry of UI components for each domain/tool combination
-- This enables the "Server-Driven UI" pattern where backend tells frontend how to render

CREATE TABLE IF NOT EXISTS domain_ui_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Which domain this component belongs to
    domain TEXT NOT NULL,  -- e.g., 'seo', 'social', 'video', 'data'
    
    -- What triggers this component
    tool_name TEXT NOT NULL,  -- e.g., 'seo_analyze_url', 'social_create_post'
    
    -- Component type
    component_type TEXT NOT NULL CHECK (component_type IN ('visualizer', 'editor', 'action')),
    
    -- UI Schema that the frontend uses to render
    -- This is the Server-Driven UI schema
    ui_schema JSONB NOT NULL,
    
    -- Component configuration
    display_name TEXT NOT NULL,  -- Human-friendly name
    description TEXT,
    icon TEXT,  -- Icon identifier for frontend
    
    -- Feature flags
    is_editable BOOLEAN DEFAULT false,  -- Does this support editing?
    requires_integration TEXT[],  -- Integrations required to use
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique per domain/tool/type combination
    CONSTRAINT unique_domain_ui_component UNIQUE (domain, tool_name, component_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ui_components_domain ON domain_ui_components(domain);
CREATE INDEX IF NOT EXISTS idx_ui_components_tool ON domain_ui_components(tool_name);
CREATE INDEX IF NOT EXISTS idx_ui_components_active ON domain_ui_components(is_active) WHERE is_active = true;

-- RLS (public read, service role write)
ALTER TABLE domain_ui_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active UI components" ON domain_ui_components
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role full access on domain_ui_components" ON domain_ui_components
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 6. User Integrations Table (Extended)
-- ============================================================================
-- Stores connected external services per user/org

CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who owns this integration
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Integration identity
    integration_slug TEXT NOT NULL,  -- e.g., 'google_search_console', 'twitter'
    provider TEXT NOT NULL,  -- e.g., 'google', 'twitter', 'ahrefs'
    
    -- Prevent duplicate integrations per user
    CONSTRAINT unique_user_integration UNIQUE (user_id, integration_slug),
    
    -- Credentials (encrypted in production)
    credentials JSONB NOT NULL DEFAULT '{}',  -- OAuth tokens, API keys, etc.
    
    -- Connection details
    account_name TEXT,  -- Display name of connected account
    account_id TEXT,    -- External account ID
    scopes TEXT[],      -- Granted permissions
    
    -- Access control
    -- Which agents can use this integration (NULL = all)
    allowed_agents TEXT[],
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
    last_error TEXT,
    
    -- Token refresh tracking
    expires_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ,
    refresh_failures INTEGER DEFAULT 0,
    
    -- Timestamps
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_org ON user_integrations(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_integrations_slug ON user_integrations(integration_slug);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);
CREATE INDEX IF NOT EXISTS idx_user_integrations_expiry ON user_integrations(expires_at) WHERE status = 'active';

-- RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their integrations" ON user_integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create integrations" ON user_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their integrations" ON user_integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their integrations" ON user_integrations
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_integrations" ON user_integrations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 7. Add columns to gallery_agents for workforce features
-- ============================================================================

-- Add specialist tracking to gallery_agents
ALTER TABLE gallery_agents 
ADD COLUMN IF NOT EXISTS domain TEXT,
ADD COLUMN IF NOT EXISTS is_specialist BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_agent TEXT,  -- For specialists: which orchestrator owns them
ADD COLUMN IF NOT EXISTS specialist_agents TEXT[],  -- For orchestrators: list of specialist slugs
ADD COLUMN IF NOT EXISTS can_delegate_to TEXT[],  -- Delegation permissions
ADD COLUMN IF NOT EXISTS required_integrations TEXT[],
ADD COLUMN IF NOT EXISTS optional_integrations TEXT[],
ADD COLUMN IF NOT EXISTS tool_categories TEXT[],
ADD COLUMN IF NOT EXISTS uses_tools BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true;

-- Index for domain queries
CREATE INDEX IF NOT EXISTS idx_gallery_agents_domain ON gallery_agents(domain);
CREATE INDEX IF NOT EXISTS idx_gallery_agents_specialist ON gallery_agents(is_specialist);


-- ============================================================================
-- 8. Shared Data Store Table
-- ============================================================================
-- Generic data store for agent outputs that users can view and edit
-- This is the "shared between user and AI" data layer

CREATE TABLE IF NOT EXISTS agent_data_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- What created this data
    agent_slug TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    thread_id TEXT,  -- NULL if not from a conversation
    
    -- Data identity
    data_type TEXT NOT NULL,  -- e.g., 'seo_audit', 'content_brief', 'social_post'
    title TEXT NOT NULL,
    description TEXT,
    
    -- The actual data
    data JSONB NOT NULL,
    
    -- UI rendering hints
    ui_schema JSONB,  -- How to display this data
    
    -- Editing state
    is_editable BOOLEAN DEFAULT true,
    edited_by_user BOOLEAN DEFAULT false,  -- True if user modified
    edit_history JSONB DEFAULT '[]',  -- Track changes
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- External references
    external_id TEXT,  -- If published/synced to external system
    external_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_store_user ON agent_data_store(user_id);
CREATE INDEX IF NOT EXISTS idx_data_store_org ON agent_data_store(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_store_agent ON agent_data_store(agent_slug);
CREATE INDEX IF NOT EXISTS idx_data_store_type ON agent_data_store(data_type);
CREATE INDEX IF NOT EXISTS idx_data_store_thread ON agent_data_store(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_store_status ON agent_data_store(status);
CREATE INDEX IF NOT EXISTS idx_data_store_created ON agent_data_store(created_at DESC);

-- Full-text search on title and description
CREATE INDEX IF NOT EXISTS idx_data_store_search ON agent_data_store 
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- RLS
ALTER TABLE agent_data_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their data" ON agent_data_store
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create data" ON agent_data_store
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their data" ON agent_data_store
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their data" ON agent_data_store
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on agent_data_store" ON agent_data_store
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 9. Helper Functions
-- ============================================================================

-- Function to update routine next_run_at after a run
CREATE OR REPLACE FUNCTION calculate_next_run(cron_schedule TEXT, tz TEXT DEFAULT 'UTC')
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- This is a placeholder - in production, use pg_cron or calculate in application
    -- For now, return NULL to indicate manual calculation needed
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update routine stats after a run
CREATE OR REPLACE FUNCTION update_routine_after_run()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('success', 'failed', 'cancelled') AND OLD.status = 'running' THEN
        -- Update the routine
        UPDATE routines SET
            last_run_at = NEW.completed_at,
            run_count = run_count + 1,
            updated_at = NOW()
        WHERE id = NEW.routine_id;
        
        -- Calculate duration
        NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_routine_run_complete ON routine_runs;
CREATE TRIGGER on_routine_run_complete
    BEFORE UPDATE ON routine_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_routine_after_run();

-- Auto-update updated_at timestamps
DROP TRIGGER IF EXISTS update_routines_updated_at ON routines;
CREATE TRIGGER update_routines_updated_at
    BEFORE UPDATE ON routines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_thread_context_updated_at ON thread_context;
CREATE TRIGGER update_thread_context_updated_at
    BEFORE UPDATE ON thread_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER update_user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_domain_ui_components_updated_at ON domain_ui_components;
CREATE TRIGGER update_domain_ui_components_updated_at
    BEFORE UPDATE ON domain_ui_components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_data_store_updated_at ON agent_data_store;
CREATE TRIGGER update_agent_data_store_updated_at
    BEFORE UPDATE ON agent_data_store
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 10. Update existing gallery_agents with domain info
-- ============================================================================

UPDATE gallery_agents SET
    domain = 'seo',
    uses_tools = true,
    specialist_agents = ARRAY['seo-tech', 'seo-content', 'seo-analytics'],
    can_delegate_to = ARRAY['seo-tech', 'seo-content', 'seo-analytics', 'penn'],
    optional_integrations = ARRAY['google_search_console', 'google_analytics', 'ahrefs'],
    tool_categories = ARRAY['seo']
WHERE slug = 'seomi';

UPDATE gallery_agents SET
    domain = 'social',
    uses_tools = true,
    specialist_agents = ARRAY['social-twitter', 'social-insta', 'social-linkedin'],
    can_delegate_to = ARRAY['social-twitter', 'social-insta', 'social-linkedin', 'imagi'],
    optional_integrations = ARRAY['twitter', 'instagram', 'linkedin', 'facebook', 'buffer'],
    tool_categories = ARRAY['social']
WHERE slug = 'soshie';

UPDATE gallery_agents SET
    domain = 'support',
    uses_tools = false
WHERE slug = 'cassie';

UPDATE gallery_agents SET
    domain = 'data',
    uses_tools = true,
    specialist_agents = ARRAY['data-report', 'data-visual'],
    can_delegate_to = ARRAY['data-report', 'data-visual'],
    optional_integrations = ARRAY['google_sheets', 'google_analytics', 'stripe'],
    tool_categories = ARRAY['data']
WHERE slug = 'dexter';

UPDATE gallery_agents SET
    domain = 'content',
    uses_tools = true,
    can_delegate_to = ARRAY[],  -- Penn doesn't delegate
    tool_categories = ARRAY['content']
WHERE slug = 'penn';

UPDATE gallery_agents SET
    domain = 'reception',
    uses_tools = false
WHERE slug = 'pam';


-- ============================================================================
-- 11. Seed Domain UI Components
-- ============================================================================

INSERT INTO domain_ui_components (domain, tool_name, component_type, display_name, description, ui_schema, is_editable)
VALUES 
    -- SEO Domain
    (
        'seo',
        'seo_analyze_url',
        'visualizer',
        'SEO Audit Results',
        'Comprehensive SEO analysis with score gauges and issue lists',
        '{
            "display": "score_card",
            "title": "SEO Analysis",
            "summary_template": "Score: {overall_score}/100 • {issues_count} issues found",
            "sections": [
                {
                    "id": "overview",
                    "title": "Overview",
                    "display": "score_card",
                    "fields": [
                        {"key": "overall_score", "label": "Overall Score", "type": "score"},
                        {"key": "issues_count", "label": "Issues Found", "type": "count"}
                    ]
                },
                {
                    "id": "meta",
                    "title": "Meta Tags",
                    "display": "key_value",
                    "fields": [
                        {"key": "meta_analysis.title.content", "label": "Title"},
                        {"key": "meta_analysis.description.content", "label": "Description"}
                    ]
                },
                {
                    "id": "issues",
                    "title": "Issues",
                    "display": "issues_list",
                    "fields": [
                        {"key": "issues", "type": "issues_array"}
                    ]
                }
            ]
        }'::jsonb,
        true
    ),
    (
        'seo',
        'seo_analyze_url',
        'editor',
        'SEO Meta Editor',
        'Edit meta tags and other SEO elements',
        '{
            "display": "form",
            "title": "Edit SEO",
            "sections": [
                {
                    "id": "meta",
                    "title": "Meta Tags",
                    "fields": [
                        {"key": "title", "label": "Page Title", "type": "text", "maxLength": 60},
                        {"key": "description", "label": "Meta Description", "type": "textarea", "maxLength": 160},
                        {"key": "canonical", "label": "Canonical URL", "type": "url"}
                    ]
                }
            ],
            "actions": [
                {"id": "save", "label": "Save Changes", "type": "primary"},
                {"id": "preview", "label": "Preview SERP", "type": "secondary"}
            ]
        }'::jsonb,
        true
    ),
    -- Social Domain
    (
        'social',
        'social_create_post',
        'visualizer',
        'Post Preview',
        'Preview social media posts with platform-specific styling',
        '{
            "display": "card",
            "title": "Social Post",
            "sections": [
                {
                    "id": "content",
                    "title": "Post Content",
                    "display": "key_value",
                    "fields": [
                        {"key": "platform", "label": "Platform", "type": "badge"},
                        {"key": "content", "label": "Content", "type": "text"},
                        {"key": "hashtags", "label": "Hashtags", "type": "tags"}
                    ]
                }
            ]
        }'::jsonb,
        true
    ),
    (
        'social',
        'social_create_post',
        'editor',
        'Post Editor',
        'Edit social media post content',
        '{
            "display": "form",
            "title": "Edit Post",
            "sections": [
                {
                    "id": "content",
                    "title": "Content",
                    "fields": [
                        {"key": "content", "label": "Post Text", "type": "textarea", "maxLength": 280},
                        {"key": "hashtags", "label": "Hashtags", "type": "tags"},
                        {"key": "media_url", "label": "Image URL", "type": "url"}
                    ]
                }
            ],
            "actions": [
                {"id": "save", "label": "Save Draft", "type": "secondary"},
                {"id": "publish", "label": "Publish Now", "type": "primary", "requires_integration": true}
            ]
        }'::jsonb,
        true
    )
ON CONFLICT (domain, tool_name, component_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ui_schema = EXCLUDED.ui_schema,
    is_editable = EXCLUDED.is_editable,
    updated_at = NOW();


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this migration:
-- 1. routines table for scheduled workflows
-- 2. routine_runs for execution tracking
-- 3. thread_context for inter-agent shared state
-- 4. agent_handoffs for debugging/analytics
-- 5. domain_ui_components for Server-Driven UI
-- 6. user_integrations for connected services
-- 7. agent_data_store for shared user/AI data
-- 8. gallery_agents extended with domain/specialist info
-- ============================================================================
