/**
 * useAgentChat - Primary chat hook using Vercel AI SDK
 *
 * This is the single source of truth for chat functionality.
 *
 * Architecture:
 * - Uses Vercel AI SDK's useChat hook for state management and streaming
 * - Connects to /api/agents/{slug}/chat backend endpoint
 * - Backend handles thread registration automatically
 * - Thread ID returned via message annotations (AI SDK protocol)
 *
 * Usage:
 * ```tsx
 * const { messages, input, handleInputChange, handleSubmit, isLoading } = useAgentChat('soshie')
 * ```
 */

import { useChat } from 'ai/react'
import { useCallback, useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useAgentChat(agentSlug: string) {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  // Unique ID for this chat instance to prevent cross-agent interference
  const chatId = useMemo(() => `${agentSlug}-${Date.now()}`, [agentSlug])

  // Auth token management with Supabase
  useEffect(() => {
    const getToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthToken(session?.access_token || null)
    }
    getToken()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Reset state when agent changes
  useEffect(() => {
    setThreadId(null)
  }, [agentSlug])

  // Vercel AI SDK useChat hook
  const chat = useChat({
    id: chatId,
    api: `${API_BASE}/api/agents/${agentSlug}/chat`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: { data: { threadId } },
    onError: (error) => {
      console.error('[useAgentChat] Stream error:', error)
    },
  })

  // Extract threadId from message annotations (AI SDK Data Stream Protocol)
  // Backend emits: 8:[{"threadId":"thread_123"}]
  // AI SDK parses this as annotations on messages
  useEffect(() => {
    const lastMsg = chat.messages[chat.messages.length - 1]
    if (lastMsg?.annotations) {
      for (const annotation of lastMsg.annotations) {
        if (
          typeof annotation === 'object' &&
          annotation !== null &&
          'threadId' in annotation
        ) {
          const newThreadId = (annotation as { threadId: string }).threadId
          if (newThreadId && newThreadId !== threadId) {
            setThreadId(newThreadId)
          }
          break
        }
      }
    }
  }, [chat.messages, threadId])

  // Start a new conversation (clears messages and thread)
  const newChat = useCallback(() => {
    chat.setMessages([])
    setThreadId(null)
  }, [chat])

  // Load a specific thread (for history navigation)
  // Call this after loading messages via loadThreadMessages()
  const loadThread = useCallback((newThreadId: string) => {
    setThreadId(newThreadId)
  }, [])

  return {
    // All useChat properties spread
    ...chat,

    // Thread management
    threadId,
    newChat,
    loadThread,
  }
}
