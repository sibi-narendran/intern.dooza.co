/**
 * Chat API Client
 * 
 * Uses standard LangGraph streaming via /stream_events endpoint.
 * Simplified architecture - backend emits structured UI actions,
 * frontend renders directly without reconstruction.
 * 
 * Production-ready with:
 * - Type-safe event handling
 * - Structured response handling (UI actions)
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
import type { 
  ChatStreamCallbacks, 
  ToolCall,
  StructuredResponse,
  UIAction,
} from './chat-types'

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAX_MESSAGE_LENGTH = 32000
const REQUEST_TIMEOUT_MS = 120000 // 2 minutes for long-running operations

// ============================================================================
// Types (for backward compatibility)
// ============================================================================

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}

export interface ChatCallbacks extends ChatStreamCallbacks {
  // Legacy callbacks for backward compatibility
  onToolData?: (toolData: { tool: string; data: Record<string, unknown>; category: string }) => void
  onDelegate?: (toAgent: string) => void
  onAgentSwitch?: (agent: string) => void
  onStatus?: (status: string) => void
}

// Re-export types from chat-types
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
 * Simplified flow:
 * 1. Stream tokens and tool events
 * 2. Receive structured_response at stream end with UI actions
 * 3. Frontend renders UI actions directly
 * 
 * @param agentSlug - The agent to chat with (e.g., 'soshie')
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
): Promise<{ threadId: string; uiActions?: UIAction[] }> {
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
  let structuredResponse: StructuredResponse | null = null
  
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
          
          // Handle structured_response event (new simplified flow)
          if (eventType === 'structured_response') {
            structuredResponse = event as StructuredResponse
            callbacks.onStructuredResponse?.(structuredResponse)
            continue
          }
          
          // Handle workflow node events
          if (eventType === 'on_chain_start') {
            const langgraphNode = metadata.langgraph_node
            if (langgraphNode) {
              const internalNodes = ['model', 'agent', '__start__', '__end__', 'LangGraph']
              if (!internalNodes.includes(langgraphNode) && !event.name?.startsWith('RunnableSequence')) {
                callbacks.onNodeStart?.(langgraphNode)
              }
            }
          }
          
          else if (eventType === 'on_chain_end') {
            const langgraphNode = metadata.langgraph_node
            if (langgraphNode) {
              const internalNodes = ['model', 'agent', '__start__', '__end__', 'LangGraph']
              if (!internalNodes.includes(langgraphNode)) {
                callbacks.onNodeEnd?.(langgraphNode)
              }
            }
          }
          
          // Handle chat content events
          else if (eventType === 'on_chat_model_stream' || eventType === 'on_chat_model_end') {
            const content = event.content || ''
            if (content) {
              callbacks.onToken?.(content)
            }
          }
          
          // Handle tool start events
          else if (eventType === 'on_tool_start') {
            const toolName = event.name || ''
            const toolInput = event.input || {}
            
            // Check for delegation (legacy support)
            if (toolName.startsWith('transfer_to_')) {
              const targetAgent = toolName.replace('transfer_to_', '')
              callbacks.onDelegate?.(targetAgent)
            } else {
              callbacks.onToolStart?.(toolName, toolInput)
            }
          }
          
          // Handle tool end events
          else if (eventType === 'on_tool_end') {
            const toolName = event.name || ''
            const toolOutput = event.output
            const uiSchema = event.ui_schema
            
            // Skip delegation tool outputs
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
          console.warn('Failed to parse stream event:', data)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  return { 
    threadId: generatedThreadId,
    uiActions: structuredResponse?.ui_actions,
  }
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
 */
export async function saveMessage(message: SaveMessageRequest): Promise<SavedMessage | null> {
  const messageId = generateMessageId()
  
  try {
    const token = await getAuthToken()
    
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
 */
export async function saveMessageAsync(message: SaveMessageRequest): Promise<void> {
  saveMessage(message).catch(err => {
    console.warn('Async message save failed:', err)
  })
}

/**
 * Load messages for a thread.
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
        return []
      }
      throw new Error(`Failed to load messages: ${response.statusText}`)
    }
    
    const data = await response.json()
    clearRetryQueueForThread(threadId)
    
    return data.messages || []
    
  } catch (error) {
    console.error('Failed to load thread messages:', error)
    return []
  }
}

/**
 * List user's conversation threads.
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
    
    clearRetryQueueForThread(threadId)
    
    return true
    
  } catch (error) {
    console.error('Failed to delete thread:', error)
    return false
  }
}

/**
 * Flush the retry queue by batch saving pending messages.
 */
export async function flushRetryQueue(): Promise<void> {
  const messagesToRetry = getMessagesToRetry()
  
  if (messagesToRetry.length === 0) {
    return
  }
  
  console.log(`Flushing retry queue: ${messagesToRetry.length} messages`)
  
  try {
    const token = await getAuthToken()
    
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
      removeFromRetryQueue(messagesToRetry.map(m => m.id))
      console.log('Retry queue flushed successfully')
    } else {
      markMessagesRetried(messagesToRetry.map(m => m.id))
      console.warn('Retry queue flush failed, will retry later')
    }
    
  } catch (error) {
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
