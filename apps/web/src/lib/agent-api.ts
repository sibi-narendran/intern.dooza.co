import { supabase } from './supabase'

// API base URL - defaults to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Get the current session's access token for API authentication.
 */
async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    throw new Error('Not authenticated')
  }
  
  return session.access_token
}

/**
 * Chat message from the stream.
 */
export interface StreamEvent {
  type: 'thread_id' | 'token' | 'end' | 'error'
  thread_id?: string
  content?: string
  error?: string
}

/**
 * Stream a chat message to an agent.
 * 
 * @param agentId - The agent to chat with (pam, penn, seomi, etc.)
 * @param message - The user's message
 * @param threadId - Optional thread ID for continuing a conversation
 * @param onEvent - Callback for each stream event
 * @returns The thread_id (useful for new conversations)
 */
export async function streamChat(
  agentId: string,
  message: string,
  threadId: string | null,
  onEvent: (event: StreamEvent) => void
): Promise<string> {
  const token = await getAccessToken()
  
  const response = await fetch(`${API_URL}/v1/chat/${agentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      thread_id: threadId,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }
  
  const decoder = new TextDecoder()
  let resultThreadId = threadId || ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          
          if (data === '[DONE]') {
            break
          }
          
          try {
            const event: StreamEvent = JSON.parse(data)
            
            // Capture thread_id for return
            if (event.type === 'thread_id' && event.thread_id) {
              resultThreadId = event.thread_id
            }
            
            onEvent(event)
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  return resultThreadId
}

/**
 * Thread metadata.
 */
export interface Thread {
  id: string
  agent_id: string
  title: string | null
  created_at: string
  updated_at: string
}

/**
 * List conversation threads for the current user.
 * 
 * @param agentId - Optional filter by agent
 */
export async function listThreads(agentId?: string): Promise<Thread[]> {
  const token = await getAccessToken()
  
  const url = new URL(`${API_URL}/v1/threads`)
  if (agentId) {
    url.searchParams.set('agent_id', agentId)
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  return data.threads
}

/**
 * Message in a thread.
 */
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Get messages from a thread.
 * 
 * @param threadId - The thread to fetch
 */
export async function getThreadMessages(threadId: string): Promise<Message[]> {
  const token = await getAccessToken()
  
  const response = await fetch(`${API_URL}/v1/threads/${threadId}/messages`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  return data.messages
}

/**
 * Health check - useful for testing connectivity.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}