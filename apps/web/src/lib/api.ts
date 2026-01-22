import { supabase } from './supabase'

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  intended_product: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string | null
  owner_id: string
  created_at: string
  updated_at: string
  role?: string
  products?: { product: string; role: string }[]
}

export interface ProductAccess {
  hasAccess: boolean
  role: string | null
  orgId: string | null
}

export interface Integration {
  id: string
  name: string
  provider: string
  config: Record<string, unknown>
  is_active: boolean
  org_id: string | null
  user_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// Composio Integration Types
export interface ComposioApp {
  key: string
  name: string
  description: string
  logo?: string
  categories: string[]
}

export interface ComposioConnection {
  id: string
  app_key: string
  app_name: string
  status: string
  created_at: string
  account_display?: string
}

export interface ConnectResponse {
  redirect_url: string
  connection_id: string
}

export type ConnectionScope = 'organization' | 'personal'

export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  type: 'general' | 'docs' | 'wiki' | 'faq' | 'custom'
  config: Record<string, unknown>
  is_active: boolean
  org_id: string | null
  user_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseDocument {
  id: string
  kb_id: string
  title: string
  content: string | null
  source_url: string | null
  source_type: string
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

interface ApiResponse<T> {
  data: T | null
  error: Error | null
}

/**
 * Fetch user profile from public.users table
 */
export async function getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

/**
 * Fetch user's organizations with their role
 */
export async function getUserOrganizations(userId: string): Promise<ApiResponse<Organization[]>> {
  const { data, error } = await supabase
    .rpc('get_user_organizations', { user_uuid: userId })

  if (error) {
    return { data: null, error }
  }

  const orgs: Organization[] = (data || []).map((org: {
    id: string
    name: string
    slug: string | null
    owner_id: string
    created_at: string
    updated_at: string
    role: string
  }) => ({
    ...org,
    products: []
  }))
  
  return { data: orgs, error: null }
}

/**
 * Check if user has access to a specific product
 */
export async function checkProductAccess(
  userId: string, 
  product: string = 'workforce'
): Promise<ProductAccess & { error: Error | null }> {
  const { data, error } = await supabase
    .from('product_access')
    .select('*')
    .eq('user_id', userId)
    .eq('product', product)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { hasAccess: false, role: null, orgId: null, error }
  }

  return {
    hasAccess: !!data,
    role: data?.role || null,
    orgId: data?.org_id || null,
    error: null
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string, 
  updates: Partial<UserProfile>
): Promise<ApiResponse<UserProfile>> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}

// ============================================================================
// Organization API
// ============================================================================

/**
 * Update organization details
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Pick<Organization, 'name' | 'slug'>>
): Promise<ApiResponse<Organization>> {
  const { data, error } = await supabase
    .from('organizations')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', orgId)
    .select()
    .single()

  return { data, error }
}

// ============================================================================
// Integrations API
// ============================================================================

/**
 * Get organization integrations
 */
export async function getOrgIntegrations(orgId: string): Promise<ApiResponse<Integration[]>> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Get user's personal integrations
 */
export async function getUserIntegrations(userId: string): Promise<ApiResponse<Integration[]>> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Create a new integration
 */
export async function createIntegration(
  integration: Pick<Integration, 'name' | 'provider' | 'config'> & {
    org_id?: string
    user_id?: string
  },
  createdBy: string
): Promise<ApiResponse<Integration>> {
  const { data, error } = await supabase
    .from('integrations')
    .insert({
      ...integration,
      created_by: createdBy
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update an integration
 */
export async function updateIntegration(
  integrationId: string,
  updates: Partial<Pick<Integration, 'name' | 'config' | 'is_active'>>
): Promise<ApiResponse<Integration>> {
  const { data, error } = await supabase
    .from('integrations')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete an integration
 */
export async function deleteIntegration(integrationId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', integrationId)

  return { data: null, error }
}

// ============================================================================
// Composio Integrations API (via FastAPI backend)
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
}

// ============================================================================
// Generic API Client (for components that need direct HTTP access)
// ============================================================================

/**
 * Simple API client with axios-like interface for components
 * that need to make direct API calls to the FastAPI backend.
 */
export const api = {
  async get<T = any>(path: string): Promise<{ data: T }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1${path}`, { headers })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw { response: { data: error } }
    }
    
    const data = await response.json()
    return { data }
  },
  
  async post<T = any>(path: string, body?: any): Promise<{ data: T }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw { response: { data: error } }
    }
    
    const data = await response.json()
    return { data }
  },
  
  async delete<T = any>(path: string): Promise<{ data: T }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1${path}`, {
      method: 'DELETE',
      headers,
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw { response: { data: error } }
    }
    
    const data = await response.json()
    return { data }
  },
}

// Cache config
const APPS_CACHE_KEY = 'dooza_integrations_apps'
const APPS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CachedData<T> {
  data: T
  timestamp: number
}

function getCachedApps(): ComposioApp[] | null {
  try {
    const cached = localStorage.getItem(APPS_CACHE_KEY)
    if (!cached) return null
    
    const { data, timestamp }: CachedData<ComposioApp[]> = JSON.parse(cached)
    if (Date.now() - timestamp > APPS_CACHE_TTL) {
      localStorage.removeItem(APPS_CACHE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCachedApps(apps: ComposioApp[]): void {
  try {
    const cached: CachedData<ComposioApp[]> = { data: apps, timestamp: Date.now() }
    localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(cached))
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Get list of available integration apps from Composio
 * Uses localStorage cache (24h TTL) for fast loading
 */
export async function getAvailableApps(): Promise<ComposioApp[]> {
  // Return cached data immediately if available
  const cached = getCachedApps()
  if (cached && cached.length > 0) {
    // Refresh cache in background (stale-while-revalidate pattern)
    refreshAppsCache()
    return cached
  }
  
  // No cache, fetch fresh
  return fetchAndCacheApps()
}

async function fetchAndCacheApps(): Promise<ComposioApp[]> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1/integrations/apps`, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch apps: ${response.statusText}`)
    }
    
    const apps = await response.json()
    setCachedApps(apps)
    return apps
  } catch (error) {
    console.error('Failed to fetch available apps:', error)
    // Return cached even if expired, as fallback
    const cached = getCachedApps()
    return cached || []
  }
}

// Background refresh without blocking UI
function refreshAppsCache(): void {
  fetchAndCacheApps().catch(() => {})
}

/**
 * Get user's or org's connected accounts
 */
export async function getConnections(
  scope: ConnectionScope,
  orgId?: string
): Promise<ComposioConnection[]> {
  try {
    const headers = await getAuthHeaders()
    const params = new URLSearchParams({ scope })
    if (orgId) params.set('org_id', orgId)
    
    const response = await fetch(
      `${API_BASE}/v1/integrations/connections?${params}`,
      { headers }
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.statusText}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('Failed to fetch connections:', error)
    return []
  }
}

/**
 * Initiate OAuth connection flow for an app
 * Returns URL to redirect user to for OAuth consent
 */
export async function initiateConnection(
  appKey: string,
  scope: ConnectionScope,
  orgId?: string,
  redirectUrl?: string
): Promise<ConnectResponse> {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}/v1/integrations/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      app_key: appKey,
      scope,
      org_id: orgId,
      redirect_url: redirectUrl || window.location.href
    })
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'Failed to initiate connection')
  }
  
  return response.json()
}

/**
 * Disconnect (revoke) an integration.
 * Pass platform to also update local database status.
 */
export async function disconnectIntegration(
  connectionId: string, 
  platform?: string
): Promise<void> {
  const headers = await getAuthHeaders()
  
  // Include platform as query param so backend can update local DB
  const url = platform 
    ? `${API_BASE}/v1/integrations/connections/${connectionId}?platform=${platform}`
    : `${API_BASE}/v1/integrations/connections/${connectionId}`
  
  const response = await fetch(url, { method: 'DELETE', headers })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'Failed to disconnect')
  }
}

/**
 * Check integration service status
 */
export async function getIntegrationStatus(): Promise<{
  enabled: boolean
  configured: boolean
  message: string
}> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1/integrations/status`, { headers })
    
    if (!response.ok) {
      return { enabled: false, configured: false, message: 'Service unavailable' }
    }
    
    return response.json()
  } catch {
    return { enabled: false, configured: false, message: 'Failed to connect to API' }
  }
}

// ============================================================================
// Social Platform Connections
// ============================================================================

/**
 * Social connection status for a platform.
 * Used by IntegrationsPanel and publish workflows.
 */
export interface SocialConnection {
  platform: string
  connection_id: string
  connected: boolean
  account_name: string | null
}

/**
 * Get social platform connections for the current user.
 * Returns connection status for all 5 supported platforms:
 * Instagram, Facebook, LinkedIn, TikTok, YouTube
 */
export async function getSocialConnections(): Promise<SocialConnection[]> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1/integrations/social`, { headers })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch connections' }))
      throw new Error(error.detail || 'Failed to fetch social connections')
    }
    
    return response.json()
  } catch (error) {
    console.error('Failed to fetch social connections:', error)
    return []
  }
}

/**
 * Get list of connected social platform names.
 * Useful for quick checks in the UI.
 */
export async function getConnectedSocialPlatforms(): Promise<{ platforms: string[], count: number }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1/integrations/social/connected`, { headers })
    
    if (!response.ok) {
      return { platforms: [], count: 0 }
    }
    
    return response.json()
  } catch {
    return { platforms: [], count: 0 }
  }
}

/**
 * Save OAuth connection to local database via callback endpoint.
 * Called after OAuth popup completes to sync connection to local DB.
 */
async function saveOAuthCallback(
  platform: string, 
  connectionId: string
): Promise<void> {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}/v1/integrations/callback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform,
      connection_id: connectionId,
    })
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to save connection' }))
    throw new Error(error.detail || 'Failed to save connection')
  }
}

/**
 * Open OAuth connection in a popup window for a social platform.
 * 
 * Flow:
 * 1. Initiate connection with Composio (get redirect URL + connection_id)
 * 2. Open OAuth popup for user consent
 * 3. After popup closes, save connection to local database
 * 4. Call onSuccess/onError callbacks
 */
export function openOAuthPopup(
  platform: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
): void {
  const popupName = `dooza-connect-${platform}-${Date.now()}`
  
  // Start the connection flow
  initiateConnection(platform, 'personal')
    .then(({ redirect_url, connection_id }) => {
      const popup = window.open(
        redirect_url,
        popupName,
        'width=600,height=700,scrollbars=yes,resizable=yes'
      )
      
      if (!popup) {
        onError?.('Popup was blocked. Please allow popups for this site.')
        return
      }
      
      // Poll for popup close
      const pollTimer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollTimer)
          
          // Save connection to local database after OAuth completes
          try {
            await saveOAuthCallback(platform, connection_id)
            onSuccess?.()
          } catch (error) {
            // Connection might still work even if DB save fails
            console.error('Failed to save connection to local DB:', error)
            onSuccess?.() // Still call success since OAuth completed
          }
        }
      }, 500)
      
      // Listen for postMessage from callback page
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return
        
        if (event.data?.type === 'oauth-callback') {
          clearInterval(pollTimer)
          window.removeEventListener('message', messageHandler)
          
          if (event.data.success) {
            // Save connection to local database
            try {
              await saveOAuthCallback(platform, connection_id)
            } catch (error) {
              console.error('Failed to save connection to local DB:', error)
            }
            onSuccess?.()
          } else {
            onError?.(event.data.error || 'Connection failed')
          }
          
          popup.close()
        }
      }
      
      window.addEventListener('message', messageHandler)
      
      // Cleanup after 5 minutes (timeout)
      setTimeout(() => {
        clearInterval(pollTimer)
        window.removeEventListener('message', messageHandler)
      }, 5 * 60 * 1000)
    })
    .catch((error) => {
      onError?.(error.message || 'Failed to initiate connection')
    })
}

// ============================================================================
// Knowledge Base API
// ============================================================================

/**
 * Get organization knowledge bases
 */
export async function getOrgKnowledgeBases(orgId: string): Promise<ApiResponse<KnowledgeBase[]>> {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Get user's personal knowledge bases
 */
export async function getUserKnowledgeBases(userId: string): Promise<ApiResponse<KnowledgeBase[]>> {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Create a new knowledge base
 */
export async function createKnowledgeBase(
  kb: Pick<KnowledgeBase, 'name' | 'description' | 'type' | 'config'> & {
    org_id?: string
    user_id?: string
  },
  createdBy: string
): Promise<ApiResponse<KnowledgeBase>> {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .insert({
      ...kb,
      created_by: createdBy
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update a knowledge base
 */
export async function updateKnowledgeBase(
  kbId: string,
  updates: Partial<Pick<KnowledgeBase, 'name' | 'description' | 'config' | 'is_active'>>
): Promise<ApiResponse<KnowledgeBase>> {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', kbId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a knowledge base
 */
export async function deleteKnowledgeBase(kbId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('knowledge_bases')
    .delete()
    .eq('id', kbId)

  return { data: null, error }
}

/**
 * Get documents in a knowledge base
 */
export async function getKnowledgeBaseDocuments(kbId: string): Promise<ApiResponse<KnowledgeBaseDocument[]>> {
  const { data, error } = await supabase
    .from('knowledge_base_documents')
    .select('*')
    .eq('kb_id', kbId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Add a document to a knowledge base
 */
export async function addKnowledgeBaseDocument(
  doc: Pick<KnowledgeBaseDocument, 'kb_id' | 'title' | 'content' | 'source_url' | 'source_type' | 'metadata'>,
  createdBy: string
): Promise<ApiResponse<KnowledgeBaseDocument>> {
  const { data, error } = await supabase
    .from('knowledge_base_documents')
    .insert({
      ...doc,
      created_by: createdBy
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a document from a knowledge base
 */
export async function deleteKnowledgeBaseDocument(docId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('knowledge_base_documents')
    .delete()
    .eq('id', docId)

  return { data: null, error }
}

// ============================================================================
// Brand Settings & Assets API (via FastAPI backend)
// ============================================================================

/**
 * Brand settings for an organization.
 * Controls brand voice, colors, and company information used by AI agents.
 */
export interface BrandSettings {
  id: string
  org_id: string
  business_name: string | null
  website: string | null
  tagline: string | null
  brand_voice: string | null
  colors: { primary?: string; secondary?: string; tertiary?: string }
  fonts: { heading?: string; body?: string }
  description: string | null
  value_proposition: string | null
  industry: string | null
  target_audience: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Brand asset (logo, image, video, document).
 * Stored in Supabase Storage, referenced by file_path.
 */
export interface BrandAsset {
  id: string
  org_id: string
  asset_type: 'logo' | 'image' | 'video' | 'document' | 'font'
  name: string
  description: string | null
  file_path: string
  public_url: string | null
  file_size: number | null
  mime_type: string | null
  metadata: Record<string, unknown>
  usage_count: number
  created_at: string | null
}

/**
 * Get brand settings for the current user's organization.
 */
export async function getBrandSettings(): Promise<BrandSettings> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/v1/knowledge/brand`, { headers })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch brand settings' }))
    throw new Error(error.detail || 'Failed to fetch brand settings')
  }
  
  return response.json()
}

/**
 * Update brand settings for the current user's organization.
 * Only provided fields are updated.
 */
export async function updateBrandSettings(
  settings: Partial<Omit<BrandSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'>>
): Promise<BrandSettings> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/v1/knowledge/brand`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to update brand settings' }))
    throw new Error(error.detail || 'Failed to update brand settings')
  }
  
  return response.json()
}

/**
 * Get brand assets for the current user's organization.
 * Optional filter by asset_type.
 */
export async function getBrandAssets(assetType?: string): Promise<BrandAsset[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (assetType) params.set('asset_type', assetType)
  
  const url = `${API_BASE}/v1/knowledge/assets${params.toString() ? '?' + params : ''}`
  const response = await fetch(url, { headers })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch brand assets' }))
    throw new Error(error.detail || 'Failed to fetch brand assets')
  }
  
  return response.json()
}

/**
 * Create a new brand asset record.
 * Note: File should be uploaded to Supabase Storage first.
 */
export async function createBrandAsset(asset: {
  asset_type: 'logo' | 'image' | 'video' | 'document' | 'font'
  name: string
  file_path: string
  description?: string
  public_url?: string
  file_size?: number
  mime_type?: string
  metadata?: Record<string, unknown>
}): Promise<BrandAsset> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/v1/knowledge/assets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(asset)
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create brand asset' }))
    throw new Error(error.detail || 'Failed to create brand asset')
  }
  
  return response.json()
}

/**
 * Delete a brand asset (soft delete).
 */
export async function deleteBrandAsset(assetId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/v1/knowledge/assets/${assetId}`, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete brand asset' }))
    throw new Error(error.detail || 'Failed to delete brand asset')
  }
}

/**
 * Get complete brand context for content creation.
 * Used by agents and for preview purposes.
 */
export async function getBrandContext(): Promise<{
  settings: BrandSettings | null
  logo_url: string | null
  recent_images: BrandAsset[]
  prompt_context: string
}> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/v1/knowledge/context`, { headers })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch brand context' }))
    throw new Error(error.detail || 'Failed to fetch brand context')
  }
  
  return response.json()
}
