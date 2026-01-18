-- ============================================================================
-- Dooza AI: Agent Gallery Migration
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- 
-- This creates the agent gallery system:
-- - gallery_agents: Published agents catalog
-- - hired_agents: User/org installed agents
-- - agent_usage_log: Per-message usage tracking for billing
-- ============================================================================

-- ============================================================================
-- 1. Gallery Agents Table
-- ============================================================================
-- Stores all published agents (created by Dooza or users in the future)

CREATE TABLE IF NOT EXISTS gallery_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Agent identity
    slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier (e.g., 'pam', 'seomi')
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Agent configuration
    system_prompt TEXT NOT NULL,
    avatar_url TEXT,
    gradient TEXT,  -- CSS gradient for UI
    
    -- Capabilities and metadata
    capabilities TEXT[] DEFAULT '{}',
    integrations TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Creator info (NULL = Dooza-created, UUID = user-created)
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Publishing status
    is_published BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Stats (denormalized for performance)
    install_count INTEGER DEFAULT 0,
    rating_avg NUMERIC(2,1) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    
    -- Pricing tier for future billing
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gallery_agents_slug ON gallery_agents(slug);
CREATE INDEX IF NOT EXISTS idx_gallery_agents_published ON gallery_agents(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_gallery_agents_featured ON gallery_agents(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_gallery_agents_tags ON gallery_agents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_gallery_agents_created_by ON gallery_agents(created_by);

-- RLS: Anyone can read published agents, only creators can modify their own
ALTER TABLE gallery_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published agents" ON gallery_agents
    FOR SELECT USING (is_published = true);

CREATE POLICY "Creators can view their own unpublished agents" ON gallery_agents
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Creators can update their own agents" ON gallery_agents
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their own agents" ON gallery_agents
    FOR DELETE USING (auth.uid() = created_by);

-- Service role can do everything (for Dooza-managed agents)
CREATE POLICY "Service role full access" ON gallery_agents
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- 2. Hired Agents Table
-- ============================================================================
-- Tracks which agents users/orgs have installed

CREATE TABLE IF NOT EXISTS hired_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The agent being hired
    agent_id UUID NOT NULL REFERENCES gallery_agents(id) ON DELETE CASCADE,
    
    -- Who hired it (user or org, not both)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Ensure either user_id or org_id is set, not both
    CONSTRAINT hired_by_user_or_org CHECK (
        (user_id IS NOT NULL AND org_id IS NULL) OR
        (user_id IS NULL AND org_id IS NOT NULL)
    ),
    
    -- Prevent duplicate hires
    CONSTRAINT unique_user_agent UNIQUE (user_id, agent_id),
    CONSTRAINT unique_org_agent UNIQUE (org_id, agent_id),
    
    -- Custom configuration (overrides, nicknames, etc.)
    custom_config JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    hired_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hired_agents_user ON hired_agents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hired_agents_org ON hired_agents(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hired_agents_agent ON hired_agents(agent_id);

-- RLS: Users can only see/manage their own hired agents
ALTER TABLE hired_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their hired agents" ON hired_agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can hire agents" ON hired_agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their hired agents" ON hired_agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can release their hired agents" ON hired_agents
    FOR DELETE USING (auth.uid() = user_id);

-- Org members can see org's hired agents (requires org_members table)
-- CREATE POLICY "Org members can view org hired agents" ON hired_agents
--     FOR SELECT USING (
--         org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
--     );


-- ============================================================================
-- 3. Agent Usage Log Table
-- ============================================================================
-- Tracks every interaction for billing and analytics

CREATE TABLE IF NOT EXISTS agent_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who used it
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Which agent
    agent_id UUID NOT NULL REFERENCES gallery_agents(id) ON DELETE CASCADE,
    
    -- Usage details
    thread_id TEXT,
    message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
    
    -- Token counts for billing
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Cost tracking (in cents, calculated later based on model)
    estimated_cost_cents INTEGER DEFAULT 0,
    
    -- Metadata
    model_used TEXT,
    latency_ms INTEGER,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for billing queries
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON agent_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_org_date ON agent_usage_log(org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_agent ON agent_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON agent_usage_log(created_at DESC);

-- Partition hint: For production, consider partitioning by month
-- This table will grow fast with heavy usage

-- RLS: Users can only see their own usage
ALTER TABLE agent_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON agent_usage_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage" ON agent_usage_log
    FOR INSERT WITH CHECK (true);  -- Backend inserts via service role


-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to increment install count when agent is hired
CREATE OR REPLACE FUNCTION increment_agent_install_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE gallery_agents 
    SET install_count = install_count + 1,
        updated_at = NOW()
    WHERE id = NEW.agent_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement install count when agent is released
CREATE OR REPLACE FUNCTION decrement_agent_install_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE gallery_agents 
    SET install_count = GREATEST(0, install_count - 1),
        updated_at = NOW()
    WHERE id = OLD.agent_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS on_agent_hired ON hired_agents;
CREATE TRIGGER on_agent_hired
    AFTER INSERT ON hired_agents
    FOR EACH ROW
    EXECUTE FUNCTION increment_agent_install_count();

DROP TRIGGER IF EXISTS on_agent_released ON hired_agents;
CREATE TRIGGER on_agent_released
    AFTER DELETE ON hired_agents
    FOR EACH ROW
    EXECUTE FUNCTION decrement_agent_install_count();

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_gallery_agents_updated_at ON gallery_agents;
CREATE TRIGGER update_gallery_agents_updated_at
    BEFORE UPDATE ON gallery_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 5. Seed Data - Dooza's Default Agents
-- ============================================================================

INSERT INTO gallery_agents (slug, name, role, description, system_prompt, avatar_url, gradient, capabilities, integrations, tags, is_featured)
VALUES 
    (
        'pam',
        'Pam',
        'Receptionist',
        'Welcomes visitors, schedules appointments, and routes calls effectively.',
        'You are Pam, a friendly and professional AI receptionist for Dooza. You help users schedule appointments, answer questions, and route inquiries to the right team members. Be warm, helpful, and efficient. Keep responses concise but friendly.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=Jessica&backgroundColor=b6e3f4',
        'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
        ARRAY['Connect to your Google Calendar to auto-schedule meetings with leads', 'Answer calls via Twilio and route to the right team member', 'Send automated follow-up emails through your Gmail account', 'Post welcome messages and updates to your Slack channels', 'Qualify leads with custom questions before booking appointments'],
        ARRAY['Google Calendar', 'Gmail', 'Slack', 'Twilio'],
        ARRAY['receptionist', 'scheduling', 'customer-service'],
        true
    ),
    (
        'penn',
        'Penn',
        'Copywriter',
        'Writes high-converting copy for ads, emails, and landing pages.',
        'You are Penn, a skilled AI copywriter for Dooza. You help create compelling copy for ads, emails, landing pages, and marketing materials. Be creative, persuasive, and adapt your tone to the target audience.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=Robert&backgroundColor=ffdfbf',
        'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
        ARRAY['Create and publish ad copy directly to Google Ads & Meta Ads', 'Draft and schedule email campaigns in Mailchimp automatically', 'Generate landing page content and push to your CMS', 'Store all copy versions in Notion for team review', 'A/B test variations and auto-optimize based on performance data'],
        ARRAY['Google Ads', 'Meta Ads', 'Mailchimp', 'Notion'],
        ARRAY['copywriting', 'marketing', 'content'],
        true
    ),
    (
        'seomi',
        'Seomi',
        'SEO Expert',
        'Analyzes keywords and optimizes content for search rankings.',
        'You are Seomi, an SEO expert AI for Dooza. You help optimize content for search engines, analyze keywords, and improve website rankings. Be analytical, precise, and explain SEO concepts clearly.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=Sarah&backgroundColor=c0aede',
        'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
        ARRAY['Pull real-time data from Google Search Console & Analytics', 'Auto-update meta titles, descriptions, and tags on WordPress', 'Monitor keyword rankings and alert you on position changes', 'Identify and fix technical SEO issues automatically', 'Generate and submit XML sitemaps to search engines'],
        ARRAY['Google Search Console', 'Google Analytics', 'Ahrefs', 'WordPress'],
        ARRAY['seo', 'analytics', 'marketing'],
        true
    ),
    (
        'cassie',
        'Cassie',
        'Support Agent',
        'Handles customer inquiries and support tickets 24/7.',
        'You are Cassie, a patient and helpful AI customer support agent for Dooza. You help resolve customer issues, answer questions, and ensure customer satisfaction. Be empathetic, solution-oriented, and thorough.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=Emily&backgroundColor=ffdfbf',
        'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
        ARRAY['Respond to tickets in Zendesk and Intercom automatically', 'Send personalized email responses via your Gmail account', 'Escalate complex issues to your team on Slack in real-time', 'Update CRM records with conversation summaries', 'Generate knowledge base articles from resolved tickets'],
        ARRAY['Zendesk', 'Intercom', 'Gmail', 'Slack'],
        ARRAY['support', 'customer-service', 'helpdesk'],
        true
    ),
    (
        'dexter',
        'Dexter',
        'Data Analyst',
        'Visualizes data and uncovers hidden business insights.',
        'You are Dexter, a data analyst AI for Dooza. You help analyze data, create visualizations, and uncover business insights. Be precise, analytical, and explain findings in accessible terms.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=David&backgroundColor=d1d4f9',
        'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
        ARRAY['Pull live data from Google Analytics, Stripe, and your databases', 'Auto-generate weekly/monthly reports in Google Sheets', 'Send performance alerts and summaries to Slack', 'Create interactive dashboards with real-time metrics', 'Forecast revenue and identify trends automatically'],
        ARRAY['Google Sheets', 'Google Analytics', 'Stripe', 'Slack'],
        ARRAY['analytics', 'data', 'reporting'],
        true
    ),
    (
        'soshie',
        'Soshie',
        'Social Manager',
        'Plans and creates engaging content for social media.',
        'You are Soshie, a social media manager AI for Dooza. You help plan content, write engaging posts, and manage social media presence. Be trendy, engaging, and understand platform-specific best practices.',
        'https://api.dicebear.com/7.x/lorelei/svg?seed=Jennifer&backgroundColor=d1d4f9',
        'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        ARRAY['Auto-post content to Instagram, Facebook, LinkedIn & X', 'Schedule posts across all platforms via Buffer integration', 'Monitor brand mentions and reply to comments automatically', 'Generate content calendars based on trending topics', 'Analyze engagement and auto-optimize posting times'],
        ARRAY['Instagram', 'Facebook', 'LinkedIn', 'X (Twitter)', 'Buffer'],
        ARRAY['social-media', 'content', 'marketing'],
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    description = EXCLUDED.description,
    system_prompt = EXCLUDED.system_prompt,
    avatar_url = EXCLUDED.avatar_url,
    gradient = EXCLUDED.gradient,
    capabilities = EXCLUDED.capabilities,
    integrations = EXCLUDED.integrations,
    tags = EXCLUDED.tags,
    is_featured = EXCLUDED.is_featured,
    updated_at = NOW();


-- ============================================================================
-- Done! 
-- ============================================================================
-- After running this migration:
-- 1. Your 6 default agents are seeded in gallery_agents
-- 2. Users can hire agents (hired_agents table)
-- 3. Usage is tracked (agent_usage_log table)
-- 4. Install counts auto-update via triggers
-- ============================================================================
