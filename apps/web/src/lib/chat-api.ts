/**
 * Chat API Client
 * 
 * Handles streaming chat communication with agents via SSE.
 * 
 * Production-ready with:
 * - Type-safe event handling
 * - Proper error recovery
 * - Connection cleanup
 * - Request timeouts
 */

import { supabase } from './supabase'

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_MESSAGE_LENGTH = 32000
const REQUEST_TIMEOUT_MS = 120000 // 2 minutes for long-running SEO analysis

// ============================================================================
// Types
// ============================================================================

export type ChatEventType = 
  | 'token'
  | 'tool_start'
  | 'tool_end'
  | 'delegate'
  | 'agent_switch'
  | 'thinking'
  | 'status'
  | 'end'
  | 'error'
  | 'thread_id'
  | 'metadata'

export interface ChatEvent {
  type: ChatEventType
  content?: string
  tool?: string
  args?: Record<string, unknown>
  result?: unknown
  to_agent?: string
  from_agent?: string
  task?: string
  status?: string
  thread_id?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}

export interface ToolCall {
  name: string
  args?: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'running' | 'complete' | 'error'
}

export interface ChatCallbacks {
  onToken?: (content: string) => void
  onToolStart?: (toolName: string, args?: Record<string, unknown>) => void
  onToolEnd?: (toolName: string, result?: unknown) => void
  onDelegate?: (toAgent: string, task: string) => void
  onStatus?: (status: string) => void
  onThreadId?: (threadId: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

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
// SSE Streaming Chat
// ============================================================================

/**
 * Validate message before sending.
 * 
 * @param message - The message to validate
 * @throws Error if message is invalid
 */
function validateMessage(message: string): void {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required')
  }
  
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error('Message cannot be empty')
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`)
  }
}

/**
 * Stream a chat message to an agent.
 * 
 * Uses Server-Sent Events to receive streaming responses.
 * 
 * @param agentSlug - The agent to chat with (e.g., 'seomi')
 * @param message - The user's message
 * @param callbacks - Callback functions for different event types
 * @param threadId - Optional thread ID for conversation continuity
 * @returns Promise that resolves when stream completes
 * @throws Error if authentication fails or request fails
 */
export async function streamChat(
  agentSlug: string,
  message: string,
  callbacks: ChatCallbacks,
  threadId?: string
): Promise<{ threadId: string }> {
  // Validate inputs
  if (!agentSlug || typeof agentSlug !== 'string') {
    throw new Error('Agent slug is required')
  }
  validateMessage(message)
  
  const token = await getAuthToken()
  
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  
  let response: Response
  try {
    response = await fetch(`${API_BASE}/v1/chat/${agentSlug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message: message.trim(),
        thread_id: threadId || null,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw fetchError
  }
  
  clearTimeout(timeoutId)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'Chat request failed')
  }
  
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }
  
  const decoder = new TextDecoder()
  let buffer = ''
  let resultThreadId = threadId || ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        break
      }
      
      buffer += decoder.decode(value, { stream: true })
      
      // Process complete events from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue
        }
        
        const data = line.slice(6) // Remove 'data: ' prefix
        
        if (data === '[DONE]') {
          callbacks.onEnd?.()
          continue
        }
        
        try {
          const event: ChatEvent = JSON.parse(data)
          
          switch (event.type) {
            case 'token':
              if (event.content) {
                callbacks.onToken?.(event.content)
              }
              break
              
            case 'tool_start':
              if (event.tool) {
                callbacks.onToolStart?.(event.tool, event.args)
              }
              break
              
            case 'tool_end':
              if (event.tool) {
                callbacks.onToolEnd?.(event.tool, event.result)
              }
              break
              
            case 'delegate':
              if (event.to_agent && event.task) {
                callbacks.onDelegate?.(event.to_agent, event.task)
              }
              break
              
            case 'thinking':
            case 'status':
              if (event.status) {
                callbacks.onStatus?.(event.status)
              }
              break
              
            case 'thread_id':
              if (event.thread_id) {
                resultThreadId = event.thread_id
                callbacks.onThreadId?.(event.thread_id)
              }
              break
              
            case 'error':
              if (event.error) {
                callbacks.onError?.(event.error)
              }
              break
              
            case 'end':
              callbacks.onEnd?.()
              break
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', data, parseError)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  return { threadId: resultThreadId }
}

// ============================================================================
// Thread History
// ============================================================================

/**
 * Get conversation history for a thread.
 * 
 * @param threadId - The thread ID
 * @returns Array of messages
 */
export async function getThreadHistory(threadId: string): Promise<Message[]> {
  const token = await getAuthToken()
  
  const response = await fetch(
    `${API_BASE}/v1/threads/${threadId}/messages`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  if (!response.ok) {
    console.error('Failed to fetch thread history')
    return []
  }
  
  const data = await response.json()
  return data.messages || []
}

/**
 * List all threads for the current user.
 * 
 * @param agentSlug - Optional filter by agent
 * @returns Array of thread summaries
 */
export async function listThreads(agentSlug?: string): Promise<Array<{
  thread_id: string
  agent_id: string
  updated_at: string
}>> {
  const token = await getAuthToken()
  
  const params = new URLSearchParams()
  if (agentSlug) {
    params.set('agent_id', agentSlug)
  }
  
  const response = await fetch(
    `${API_BASE}/v1/threads?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  
  if (!response.ok) {
    return []
  }
  
  const data = await response.json()
  return data.threads || []
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
  // 'seo.analyze_url' -> 'Analyze URL'
  const parts = toolName.split('.')
  const name = parts[parts.length - 1]
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
