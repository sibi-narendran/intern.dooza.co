/**
 * Chat API Client
 * 
 * Uses standard LangGraph streaming via /stream_events endpoint.
 * Parses native LangGraph events for full visibility into:
 * - Token streaming from all agents (supervisor + specialists)
 * - Tool execution (including SEO analysis tools)
 * - Delegation events (transfer_to_* tools)
 * 
 * Production-ready with:
 * - Type-safe event handling
 * - Full visibility into agent activity
 * - Proper error recovery
 * - Connection cleanup
 * - Request timeouts
 * - Message persistence with retry queue
 */

import { supabase } from './supabase'
import {
  compressToolCalls,
  queueMessageForRetry,
  removeFromRetryQueue,
  getMessagesToRetry,
  markMessagesRetried,
  clearRetryQueueForThread,
  type ToolCallSummary,
} from './persistence'

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
  | 'tool_data'  // Full structured tool results for UI rendering
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
  /** For token events */
  content?: string
  /** For tool events - tool name */
  tool?: string
  name?: string  // LangGraph native field
  /** For tool_start - input arguments */
  args?: Record<string, unknown>
  input?: Record<string, unknown>  // LangGraph native field
  /** For tool_end - output result */
  result?: unknown
  output?: unknown  // LangGraph native field
  /** Server-Driven UI schema for tool rendering */
  ui_schema?: Record<string, unknown>
  /** For delegation events */
  to_agent?: string
  from_agent?: string
  task?: string
  status?: string
  thread_id?: string
  error?: string
  metadata?: {
    category?: string
    langgraph_node?: string
    langgraph_step?: number
    [key: string]: unknown
  }
}

/**
 * Structured tool data for UI rendering
 */
export interface ToolData {
  tool: string
  data: Record<string, unknown>
  category: string
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
  /** Server-Driven UI schema from backend */
  ui_schema?: Record<string, unknown>
}

export interface ChatCallbacks {
  onToken?: (content: string, agent?: string) => void
  onToolStart?: (toolName: string, args?: Record<string, unknown>) => void
  /** Called when tool completes. ui_schema is the Server-Driven UI schema for rendering. */
  onToolEnd?: (toolName: string, result?: unknown, uiSchema?: Record<string, unknown>) => void
  onToolData?: (toolData: ToolData) => void  // Full structured data for UI rendering
  onDelegate?: (toAgent: string) => void
  onAgentSwitch?: (agent: string) => void
  /** Called when a workflow node starts - shows progress through workflow steps */
  onNodeStart?: (nodeName: string, metadata?: { step?: number }) => void
  /** Called when a workflow node completes */
  onNodeEnd?: (nodeName: string) => void
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
// LangGraph Streaming Chat
// ============================================================================

/**
 * Validate message before sending.
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
 * Stream a chat message using LangGraph's /stream_events endpoint.
 * 
 * Uses standard LangGraph astream_events() for full visibility into:
 * - All agent tokens (supervisor + specialists)
 * - Tool execution (SEO tools)
 * - Delegation (transfer_to_* tools)
 * 
 * @param agentSlug - The agent to chat with (e.g., 'seomi')
 * @param message - The user's message
 * @param callbacks - Callback functions for different event types
 * @param threadId - Optional thread ID for conversation continuity
 * @returns Promise that resolves when stream completes
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
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  
  const generatedThreadId = threadId || `thread_${Date.now()}`
  
  const payload = {
    input: {
      messages: [
        { type: 'human', content: message.trim() }
      ]
    },
    config: {
      configurable: {
        thread_id: generatedThreadId
      }
    }
  }
  
  let response: Response
  try {
    // Use /stream_events for full visibility (native LangGraph events)
    response = await fetch(`${API_BASE}/langserve/${agentSlug}/stream_events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
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
  let currentAgent = 'agent' // Track which agent is currently active
  let activeSpecialist = '' // Track which specialist was delegated to
  
  try {
    callbacks.onThreadId?.(generatedThreadId)
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        callbacks.onEnd?.()
        break
      }
      
      buffer += decoder.decode(value, { stream: true })
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue
        }
        
        const data = line.slice(6).trim()
        
        if (!data || data === '[DONE]') {
          callbacks.onEnd?.()
          continue
        }
        
        try {
          const event = JSON.parse(data)
          const eventType = event.event
          const metadata = event.metadata || {}
          const langgraphNode = metadata.langgraph_node || ''
          
          // Map "model" to the actual specialist name
          const effectiveAgent = langgraphNode === 'model' && activeSpecialist 
            ? activeSpecialist 
            : langgraphNode || 'agent'
          
          // Track agent switches
          if (effectiveAgent && effectiveAgent !== currentAgent) {
            currentAgent = effectiveAgent
            callbacks.onAgentSwitch?.(effectiveAgent)
          }
          
          // Handle node/chain start events - shows workflow progress
          // These fire when entering a new node in a StateGraph workflow
          if (eventType === 'on_chain_start' && langgraphNode) {
            // Skip internal nodes like 'model' or 'agent' - only show workflow steps
            const internalNodes = ['model', 'agent', '__start__', '__end__', 'LangGraph']
            if (!internalNodes.includes(langgraphNode) && !event.name?.startsWith('RunnableSequence')) {
              callbacks.onNodeStart?.(langgraphNode, { step: metadata.langgraph_step })
            }
          }
          
          // Handle node/chain end events
          // NOTE: LangGraph root completion (event.name === 'LangGraph') must be checked
          // first because langgraphNode is also 'LangGraph' (truthy) in that case
          else if (eventType === 'on_chain_end') {
            if (event.name === 'LangGraph') {
              // LangGraph root completion - reset specialist tracking for conversation end
              activeSpecialist = ''
              // onEnd is called when stream closes, not here (prevents duplicate)
            } else if (langgraphNode) {
              // Reset specialist when returning to supervisor (agent node)
              if (langgraphNode === 'agent' && activeSpecialist) {
                activeSpecialist = ''
              }
              // Workflow node completion - fire callback for non-internal nodes
              const internalNodes = ['model', 'agent', '__start__', '__end__', 'LangGraph']
              if (!internalNodes.includes(langgraphNode)) {
                callbacks.onNodeEnd?.(langgraphNode)
              }
            }
          }
          
          // Handle chat content events
          // - on_chat_model_stream: Incremental tokens (streaming providers)
          // - on_chat_model_end: Complete response (non-streaming providers)
          else if (eventType === 'on_chat_model_stream' || eventType === 'on_chat_model_end') {
            const content = event.content || ''
            if (content) {
              callbacks.onToken?.(content, effectiveAgent)
            }
          }
          
          // Handle tool start events
          else if (eventType === 'on_tool_start') {
            const toolName = event.name || ''
            const toolInput = event.input || {}
            
            // Check for delegation (transfer_to_* tools)
            if (toolName.startsWith('transfer_to_')) {
              const targetAgent = toolName.replace('transfer_to_', '')
              activeSpecialist = targetAgent
              callbacks.onDelegate?.(targetAgent)
            } else {
              callbacks.onToolStart?.(toolName, toolInput)
            }
          }
          
          // Handle tool end events
          else if (eventType === 'on_tool_end') {
            const toolName = event.name || ''
            const toolOutput = event.output
            const uiSchema = event.ui_schema  // Server-Driven UI schema
            
            // Skip delegation tool outputs (internal)
            if (toolName.startsWith('transfer_to_')) {
              continue
            }
            
            callbacks.onToolEnd?.(toolName, toolOutput, uiSchema)
          }
          
          // Handle errors
          else if (eventType === 'error') {
            callbacks.onError?.(event.data?.message || 'Unknown error')
          }
          
        } catch (parseError) {
          // Log but don't fail on parse errors
          console.warn('Failed to parse stream event:', data)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  return { threadId: generatedThreadId }
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
  // 'seo_analyze_url' -> 'Seo Analyze Url'
  // 'transfer_to_seo_tech' -> 'Transfer To Seo Tech'
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
  // 'seo_tech' -> 'SEO Tech'
  // 'agent' -> 'SEOmi' (supervisor)
  if (agentName === 'agent') {
    return 'SEOmi'
  }
  return agentName
    .split('_')
    .map(word => word.toUpperCase() === 'SEO' ? 'SEO' : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}


// ============================================================================
// Message Persistence API
// ============================================================================

/**
 * Response types from the messages API.
 */
export interface SavedMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls_summary?: ToolCallSummary[]
  created_at: string
}

export interface ThreadSummary {
  thread_id: string
  agent_slug: string
  title: string
  last_message_preview: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface SaveMessageRequest {
  threadId: string
  agentSlug: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

/**
 * Save a message to the backend.
 * On failure, queues the message for retry.
 * 
 * @param message - The message to save
 * @returns The saved message, or null if queued for retry
 */
export async function saveMessage(message: SaveMessageRequest): Promise<SavedMessage | null> {
  const messageId = generateMessageId()
  
  try {
    const token = await getAuthToken()
    
    // Compress tool calls if present
    const toolCallsSummary = message.toolCalls 
      ? compressToolCalls(message.toolCalls)
      : undefined
    
    const response = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        thread_id: message.threadId,
        agent_slug: message.agentSlug,
        role: message.role,
        content: message.content,
        tool_calls_summary: toolCallsSummary,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.statusText}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.warn('Failed to save message, queuing for retry:', error)
    
    // Queue for retry
    queueMessageForRetry({
      id: messageId,
      threadId: message.threadId,
      agentSlug: message.agentSlug,
      role: message.role,
      content: message.content,
      toolCallsSummary: message.toolCalls 
        ? compressToolCalls(message.toolCalls)
        : undefined,
    })
    
    return null
  }
}

/**
 * Save a message without retry (fire and forget).
 * Used for user messages where we don't want to block UI.
 */
export async function saveMessageAsync(message: SaveMessageRequest): Promise<void> {
  saveMessage(message).catch(err => {
    console.warn('Async message save failed:', err)
  })
}

/**
 * Load messages for a thread.
 * Clears local retry queue for this thread after successful load.
 * 
 * Note: Global retry queue flush happens on page load (ChatPage),
 * so we don't need to flush here.
 * 
 * @param threadId - The thread to load messages for
 * @returns Array of messages in chronological order
 */
export async function loadThreadMessages(threadId: string): Promise<SavedMessage[]> {
  try {
    const token = await getAuthToken()
    
    const response = await fetch(
      `${API_BASE}/v1/threads/${encodeURIComponent(threadId)}/messages?limit=500`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        return []  // Thread doesn't exist yet (new conversation)
      }
      throw new Error(`Failed to load messages: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Clear retry queue for this thread (messages loaded successfully)
    clearRetryQueueForThread(threadId)
    
    return data.messages || []
    
  } catch (error) {
    console.error('Failed to load thread messages:', error)
    return []
  }
}

/**
 * List user's conversation threads.
 * 
 * @param agentSlug - Optional filter by agent
 * @param limit - Max threads to return
 * @param offset - Pagination offset
 */
export async function listThreads(
  agentSlug?: string,
  limit = 20,
  offset = 0
): Promise<{ threads: ThreadSummary[]; total: number; hasMore: boolean }> {
  try {
    const token = await getAuthToken()
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    if (agentSlug) {
      params.set('agent_slug', agentSlug)
    }
    
    const response = await fetch(
      `${API_BASE}/v1/threads?${params.toString()}`,
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
 * @param threadId - The thread to delete
 */
export async function deleteThread(threadId: string): Promise<boolean> {
  try {
    const token = await getAuthToken()
    
    const response = await fetch(
      `${API_BASE}/v1/threads/${encodeURIComponent(threadId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Failed to delete thread: ${response.statusText}`)
    }
    
    // Also clear from retry queue
    clearRetryQueueForThread(threadId)
    
    return true
    
  } catch (error) {
    console.error('Failed to delete thread:', error)
    return false
  }
}

/**
 * Flush the retry queue by batch saving pending messages.
 * Called automatically on page load.
 */
export async function flushRetryQueue(): Promise<void> {
  const messagesToRetry = getMessagesToRetry()
  
  if (messagesToRetry.length === 0) {
    return
  }
  
  console.log(`Flushing retry queue: ${messagesToRetry.length} messages`)
  
  try {
    const token = await getAuthToken()
    
    // Convert to API format
    const batchPayload = messagesToRetry.map(m => ({
      thread_id: m.threadId,
      agent_slug: m.agentSlug,
      role: m.role,
      content: m.content,
      tool_calls_summary: m.toolCallsSummary,
    }))
    
    const response = await fetch(`${API_BASE}/v1/messages/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: batchPayload }),
    })
    
    if (response.ok) {
      // Success - remove from queue
      removeFromRetryQueue(messagesToRetry.map(m => m.id))
      console.log('Retry queue flushed successfully')
    } else {
      // Failed - increment retry count
      markMessagesRetried(messagesToRetry.map(m => m.id))
      console.warn('Retry queue flush failed, will retry later')
    }
    
  } catch (error) {
    // Mark as retried (increments count)
    markMessagesRetried(messagesToRetry.map(m => m.id))
    console.warn('Retry queue flush error:', error)
  }
}

// Re-export persistence utilities for convenience
export { 
  compressToolCalls,
  type ToolCallSummary,
  type QueuedMessage,
} from './persistence'
