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
  metadata?: {
    category?: string
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
}

export interface ChatCallbacks {
  onToken?: (content: string, agent?: string) => void
  onToolStart?: (toolName: string, args?: Record<string, unknown>) => void
  onToolEnd?: (toolName: string, result?: unknown) => void
  onToolData?: (toolData: ToolData) => void  // Full structured data for UI rendering
  onDelegate?: (toAgent: string) => void
  onAgentSwitch?: (agent: string) => void
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
          
          // Track agent switches
          if (langgraphNode && langgraphNode !== currentAgent) {
            currentAgent = langgraphNode
            callbacks.onAgentSwitch?.(langgraphNode)
          }
          
          // Handle token streaming from all agents
          if (eventType === 'on_chat_model_stream') {
            const content = event.content || ''
            if (content) {
              callbacks.onToken?.(content, langgraphNode)
            }
          }
          
          // Handle tool start events
          else if (eventType === 'on_tool_start') {
            const toolName = event.name || ''
            const toolInput = event.input || {}
            
            // Check for delegation (transfer_to_* tools)
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
            
            // Skip delegation tool outputs (internal)
            if (toolName.startsWith('transfer_to_')) {
              continue
            }
            
            callbacks.onToolEnd?.(toolName, toolOutput)
            
            // Check if output contains SEO data for rich rendering
            if (toolOutput) {
              try {
                const parsed = typeof toolOutput === 'string' ? JSON.parse(toolOutput) : toolOutput
                if (parsed.overall_score !== undefined) {
                  callbacks.onToolData?.({
                    tool: toolName,
                    data: parsed,
                    category: 'seo',
                  })
                }
              } catch {
                // Not SEO JSON data
              }
            }
          }
          
          // Handle chain end (final output)
          else if (eventType === 'on_chain_end' && event.name === 'LangGraph') {
            callbacks.onEnd?.()
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
