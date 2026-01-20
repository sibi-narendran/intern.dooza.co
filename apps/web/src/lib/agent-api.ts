/**
 * Agent Gallery API
 * 
 * Functions for interacting with the agent gallery and hiring system.
 */

import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============================================================================
// Types
// ============================================================================

export interface GalleryAgent {
  id: string
  slug: string
  name: string
  role: string
  description: string
  avatar_url: string | null
  gradient: string | null
  capabilities: string[]
  integrations: string[]
  tags: string[]
  is_featured: boolean
  install_count: number
  rating_avg: number
  rating_count: number
  tier: 'free' | 'pro' | 'enterprise'
  created_by: string | null
  /** Whether this agent supports chat (has tools/supervisor) */
  chat_enabled: boolean
}

export interface HiredAgent {
  id: string
  agent_id: string
  slug: string
  name: string
  role: string
  description: string
  avatar_url: string | null
  gradient: string | null
  capabilities: string[]
  integrations: string[]
  is_active: boolean
  hired_at: string
  last_used_at: string | null
  /** Whether this agent supports chat (has tools/supervisor) */
  chat_enabled: boolean
}

export interface HireResponse {
  success: boolean
  hired_agent_id: string
  message: string
}

// ============================================================================
// Auth Helper
// ============================================================================

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
// Gallery API
// ============================================================================

/**
 * Fetch all published agents from the gallery
 */
export async function getGalleryAgents(options?: {
  tag?: string
  featuredOnly?: boolean
  search?: string
}): Promise<GalleryAgent[]> {
  try {
    const headers = await getAuthHeaders()
    const params = new URLSearchParams()
    
    if (options?.tag) params.set('tag', options.tag)
    if (options?.featuredOnly) params.set('featured_only', 'true')
    if (options?.search) params.set('search', options.search)
    
    const url = `${API_BASE}/v1/gallery/agents${params.toString() ? '?' + params : ''}`
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch gallery agents: ${response.statusText}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('Failed to fetch gallery agents:', error)
    return []
  }
}

/**
 * Get detailed information about a specific agent
 */
export async function getAgentDetails(agentIdOrSlug: string): Promise<GalleryAgent | null> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_BASE}/v1/gallery/agents/${agentIdOrSlug}`,
      { headers }
    )
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch agent: ${response.statusText}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('Failed to fetch agent details:', error)
    return null
  }
}

// ============================================================================
// Hiring API
// ============================================================================

/**
 * Hire (install) an agent to the user's team
 */
export async function hireAgent(agentId: string): Promise<HireResponse> {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}/v1/agents/hire`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agent_id: agentId })
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'Failed to hire agent')
  }
  
  return response.json()
}

/**
 * Release (uninstall) an agent from the user's team
 */
export async function releaseAgent(agentId: string): Promise<void> {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${API_BASE}/v1/agents/${agentId}/release`, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'Failed to release agent')
  }
}

/**
 * Get the current user's hired agents (their team)
 */
export async function getMyTeam(): Promise<HiredAgent[]> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/v1/agents/team`, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch team: ${response.statusText}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('Failed to fetch team:', error)
    return []
  }
}

/**
 * Check if the current user has hired a specific agent
 */
export async function checkIfHired(agentId: string): Promise<{
  is_hired: boolean
  hired_at?: string
}> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_BASE}/v1/agents/${agentId}/check-hired`,
      { headers }
    )
    
    if (!response.ok) {
      return { is_hired: false }
    }
    
    return response.json()
  } catch {
    return { is_hired: false }
  }
}

/**
 * Get all agent IDs that the current user has hired (batch endpoint)
 * 
 * More efficient than calling checkIfHired for each agent
 */
export async function getHiredAgentIds(): Promise<string[]> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_BASE}/v1/agents/hired-ids`,
      { headers }
    )
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return data.agent_ids || []
  } catch {
    return []
  }
}

// ============================================================================
// Batch Helpers
// ============================================================================

/**
 * Get gallery agents with hired status in one call
 * Useful for displaying hire buttons correctly
 */
export async function getGalleryAgentsWithHiredStatus(): Promise<
  (GalleryAgent & { is_hired: boolean })[]
> {
  const [galleryAgents, hiredIds] = await Promise.all([
    getGalleryAgents(),
    getHiredAgentIds()
  ])
  
  const hiredSet = new Set(hiredIds)
  
  return galleryAgents.map(agent => ({
    ...agent,
    is_hired: hiredSet.has(agent.id)
  }))
}
