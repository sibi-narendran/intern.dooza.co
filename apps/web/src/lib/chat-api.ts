/**
 * Chat API Client - Thread Management
 *
 * Provides thread management utilities for the chat interface.
 *
 * Architecture:
 * - Chat streaming: useAgentChat hook uses Vercel AI SDK → /api/agents/{slug}/chat
 * - Thread history: This module uses LangGraph API → /langserve/{slug}/history
 * - Thread listing: This module uses LangGraph API → /langserve/{slug}/threads
 *
 * The backend handles thread registration automatically during chat streaming,
 * so no explicit registration is needed from the frontend.
 */

import { supabase } from './supabase'

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============================================================================
// Types
// ============================================================================

/**
 * Message format returned from history endpoint.
 * Now in Vercel AI SDK UIMessage format (converted by backend).
 */
export interface HistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolInvocations?: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: 'result'
    result: unknown
  }>
}

/**
 * @deprecated Use HistoryMessage instead. Kept for backwards compatibility.
 */
export interface LangGraphMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string | Record<string, unknown>
  type?: 'human' | 'ai' | 'tool'
  tool_calls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>
  tool_call_id?: string
  name?: string
  toolInvocations?: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: 'result'
    result: unknown
  }>
}

/**
 * Thread summary for listing conversations.
 */
export interface ThreadSummary {
  thread_id: string
  agent_slug: string
  title: string
  created_at: string
  updated_at: string
}

// Re-export types that might be used elsewhere
export type { ToolCall, UIAction, StructuredResponse } from './chat-types'

// ============================================================================
// Auth Helper
// ============================================================================

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return session.access_token
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique message ID.
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Format tool name for display.
 */
export function formatToolName(toolName: string): string {
  const parts = toolName.split('.')
  const name = parts[parts.length - 1]
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format agent name for display.
 */
export function formatAgentName(agentName: string): string {
  if (agentName === 'agent') {
    return 'Agent'
  }
  return agentName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================================================
// Thread Management API
// ============================================================================

/**
 * Load conversation history from LangGraph checkpointer.
 * Returns messages in Vercel AI SDK UIMessage format, ready for setMessages().
 *
 * @param agentSlug - Agent identifier (e.g., 'soshie')
 * @param threadId - Thread ID to load
 * @returns Array of messages in AI SDK format with toolInvocations
 */
export async function loadThreadMessages(
  agentSlug: string,
  threadId: string
): Promise<HistoryMessage[]> {
  try {
    const token = await getAuthToken()

    const response = await fetch(
      `${API_BASE}/langserve/${agentSlug}/history?thread_id=${encodeURIComponent(threadId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return []
      }
      throw new Error(`Failed to load messages: ${response.statusText}`)
    }

    const data = await response.json()
    return data.messages || []

  } catch (error) {
    console.error('Failed to load thread messages:', error)
    return []
  }
}

/**
 * List user's conversation threads for an agent.
 *
 * @param agentSlug - Agent identifier (e.g., 'soshie')
 * @param limit - Max threads to return (default 20)
 * @param offset - Pagination offset
 * @returns Thread list with pagination info
 */
export async function listThreads(
  agentSlug: string,
  limit = 20,
  offset = 0
): Promise<{ threads: ThreadSummary[]; total: number; hasMore: boolean }> {
  try {
    const token = await getAuthToken()

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    const response = await fetch(
      `${API_BASE}/langserve/${agentSlug}/threads?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to list threads: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      threads: data.threads || [],
      total: data.total || 0,
      hasMore: data.has_more || false,
    }

  } catch (error) {
    console.error('Failed to list threads:', error)
    return { threads: [], total: 0, hasMore: false }
  }
}

/**
 * Delete a conversation thread.
 *
 * @param agentSlug - Agent identifier
 * @param threadId - Thread ID to delete
 * @returns true if deletion succeeded
 */
export async function deleteThread(agentSlug: string, threadId: string): Promise<boolean> {
  try {
    const token = await getAuthToken()

    const response = await fetch(
      `${API_BASE}/langserve/${agentSlug}/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    return response.ok

  } catch (error) {
    console.error('Failed to delete thread:', error)
    return false
  }
}

/**
 * Update thread title.
 *
 * @param agentSlug - Agent identifier
 * @param threadId - Thread ID to update
 * @param title - New title
 */
export async function updateThreadTitle(
  agentSlug: string,
  threadId: string,
  title: string
): Promise<boolean> {
  try {
    const token = await getAuthToken()

    const response = await fetch(
      `${API_BASE}/langserve/${agentSlug}/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    )

    return response.ok
  } catch (error) {
    console.warn('Failed to update thread title:', error)
    return false
  }
}
