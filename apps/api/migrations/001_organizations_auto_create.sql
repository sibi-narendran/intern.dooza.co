-- ============================================================================
-- Dooza Workforce: Organizations & Auto-Creation on Signup
-- ============================================================================
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
--
-- This creates:
-- 1. Organizations table (if not exists)
-- 2. User-level and Org-level integrations table
-- 3. User-level and Org-level knowledge bases table
-- 4. Auto-create organization trigger on user signup
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view orgs they own" ON organizations;
CREATE POLICY "Users can view orgs they own" ON organizations
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update orgs they own" ON organizations;
CREATE POLICY "Users can update orgs they own" ON organizations
    FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create orgs" ON organizations;
CREATE POLICY "Users can create orgs" ON organizations
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org memberships" ON organization_members;
CREATE POLICY "Users can view their org memberships" ON organization_members
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Org owners can manage members" ON organization_members;
CREATE POLICY "Org owners can manage members" ON organization_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organizations 
            WHERE id = organization_members.org_id 
            AND owner_id = auth.uid()
        )
    );

-- ============================================================================
-- INTEGRATIONS TABLE (Organization + User level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'slack', 'google', 'notion', 'github', etc.
    config JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}', -- Encrypted in practice
    is_active BOOLEAN DEFAULT true,
    -- Scope: either org-level or user-level
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Must have either org_id OR user_id, not both, not neither
    CONSTRAINT integration_scope CHECK (
        (org_id IS NOT NULL AND user_id IS NULL) OR 
        (org_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- User can view their own integrations
DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
CREATE POLICY "Users can view own integrations" ON integrations
    FOR SELECT USING (auth.uid() = user_id);

-- User can view org integrations if they're a member
DROP POLICY IF EXISTS "Members can view org integrations" ON integrations;
CREATE POLICY "Members can view org integrations" ON integrations
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- User can manage their own integrations
DROP POLICY IF EXISTS "Users can manage own integrations" ON integrations;
CREATE POLICY "Users can manage own integrations" ON integrations
    FOR ALL USING (auth.uid() = user_id OR auth.uid() = created_by);

-- Org admins can manage org integrations
DROP POLICY IF EXISTS "Admins can manage org integrations" ON integrations;
CREATE POLICY "Admins can manage org integrations" ON integrations
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- ============================================================================
-- KNOWLEDGE BASES TABLE (Organization + User level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'docs', 'wiki', 'faq', 'custom')),
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    -- Scope: either org-level or user-level
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Must have either org_id OR user_id
    CONSTRAINT kb_scope CHECK (
        (org_id IS NOT NULL AND user_id IS NULL) OR 
        (org_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_org_id ON knowledge_bases(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- Similar policies as integrations
DROP POLICY IF EXISTS "Users can view own knowledge bases" ON knowledge_bases;
CREATE POLICY "Users can view own knowledge bases" ON knowledge_bases
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can view org knowledge bases" ON knowledge_bases;
CREATE POLICY "Members can view org knowledge bases" ON knowledge_bases
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage own knowledge bases" ON knowledge_bases;
CREATE POLICY "Users can manage own knowledge bases" ON knowledge_bases
    FOR ALL USING (auth.uid() = user_id OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can manage org knowledge bases" ON knowledge_bases;
CREATE POLICY "Admins can manage org knowledge bases" ON knowledge_bases
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        org_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- ============================================================================
-- KNOWLEDGE BASE DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    source_url TEXT,
    source_type TEXT DEFAULT 'manual', -- 'manual', 'url', 'file', 'integration'
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- For RAG (requires pgvector extension)
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_kb_id ON knowledge_base_documents(kb_id);

ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "KB docs inherit KB permissions" ON knowledge_base_documents;
CREATE POLICY "KB docs inherit KB permissions" ON knowledge_base_documents
    FOR ALL USING (
        kb_id IN (
            SELECT id FROM knowledge_bases 
            WHERE user_id = auth.uid() 
            OR org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
            OR org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
        )
    );

-- ============================================================================
-- AUTO-CREATE ORGANIZATION ON USER SIGNUP
-- ============================================================================

-- Function to create organization when user signs up
CREATE OR REPLACE FUNCTION create_default_organization()
RETURNS TRIGGER AS $$
DECLARE
    org_name TEXT;
    org_slug TEXT;
    new_org_id UUID;
BEGIN
    -- Generate org name from user's email or metadata
    org_name := COALESCE(
        NEW.raw_user_meta_data->>'first_name',
        split_part(NEW.email, '@', 1)
    ) || '''s Organization';
    
    -- Generate slug from email
    org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    
    -- Ensure slug is unique by appending random suffix if needed
    IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
        org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    
    -- Create the organization
    INSERT INTO organizations (name, slug, owner_id)
    VALUES (org_name, org_slug, NEW.id)
    RETURNING id INTO new_org_id;
    
    -- Add user as owner member
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_create_org ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created_create_org
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_organization();

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

-- Reuse existing function or create if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_members_updated_at ON organization_members;
CREATE TRIGGER update_org_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kb_docs_updated_at ON knowledge_base_documents;
CREATE TRIGGER update_kb_docs_updated_at
    BEFORE UPDATE ON knowledge_base_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Enable realtime for these tables (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE organizations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE integrations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_bases;
