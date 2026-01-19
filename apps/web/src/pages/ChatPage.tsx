/**
 * Chat Page
 * 
 * Full-screen chat interface for interacting with AI agents.
 * Supports streaming responses and tool execution indicators.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Wrench, 
  CheckCircle2,
  AlertCircle,
  Bot,
  User,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAgentDetails, GalleryAgent } from '../lib/agent-api'
import { 
  streamChat, 
  generateMessageId, 
  formatToolName,
  getThreadHistory,
  Message,
  ToolCall 
} from '../lib/chat-api'

// ============================================================================
// Types
// ============================================================================

interface ChatMessage extends Message {
  agentSlug?: string
}

// ============================================================================
// Components
// ============================================================================

function ToolIndicator({ tool }: { tool: ToolCall }) {
  const statusIcons = {
    pending: <Loader2 className="animate-spin" size={14} />,
    running: <Loader2 className="animate-spin" size={14} />,
    complete: <CheckCircle2 size={14} style={{ color: '#22c55e' }} />,
    error: <AlertCircle size={14} style={{ color: '#ef4444' }} />,
  }
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'var(--gray-100)',
      borderRadius: '8px',
      fontSize: '13px',
      color: 'var(--gray-600)',
      marginBottom: '8px',
    }}>
      <Wrench size={14} />
      <span style={{ fontWeight: 500 }}>{formatToolName(tool.name)}</span>
      {statusIcons[tool.status]}
    </div>
  )
}

function WorkingIndicator({ agentName }: { agentName: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
      borderRadius: '16px',
      border: '1px solid var(--gray-200)',
      animation: 'pulse 2s ease-in-out infinite',
    }}>
      <div style={{
        display: 'flex',
        gap: '4px',
      }}>
        <span className="working-dot" style={{ animationDelay: '0ms' }} />
        <span className="working-dot" style={{ animationDelay: '150ms' }} />
        <span className="working-dot" style={{ animationDelay: '300ms' }} />
      </div>
      <span style={{ 
        fontSize: '14px', 
        color: 'var(--gray-600)',
        fontWeight: 500,
      }}>
        {agentName} is working...
      </span>
    </div>
  )
}

function MessageBubble({ 
  message, 
  agent 
}: { 
  message: ChatMessage
  agent: GalleryAgent | null 
}) {
  const isUser = message.role === 'user'
  const isWorking = message.isStreaming && !message.content && !message.toolCalls?.length
  
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {/* Avatar */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: isUser 
          ? 'var(--primary-600)' 
          : (agent?.gradient || 'linear-gradient(135deg, #8b5cf6, #a78bfa)'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {isUser ? (
          <User size={18} color="white" />
        ) : agent?.avatar_url ? (
          <img 
            src={agent.avatar_url} 
            alt={agent.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Bot size={18} color="white" />
        )}
      </div>
      
      {/* Content */}
      <div style={{
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {/* Working indicator - shows before any content */}
        {isWorking && (
          <WorkingIndicator agentName={agent?.name || 'Agent'} />
        )}
        
        {/* Tool calls */}
        {message.toolCalls?.map((tool, idx) => (
          <ToolIndicator key={idx} tool={tool} />
        ))}
        
        {/* Message content */}
        {message.content && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '16px',
            background: isUser ? 'var(--primary-600)' : 'white',
            color: isUser ? 'white' : 'var(--gray-800)',
            border: isUser ? 'none' : '1px solid var(--gray-200)',
            fontSize: '15px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {message.content}
            {message.isStreaming && (
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '16px',
                background: isUser ? 'white' : 'var(--primary-600)',
                marginLeft: '2px',
                animation: 'blink 1s infinite',
              }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChatPage() {
  const { agentSlug } = useParams<{ agentSlug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // Agent info
  const [agent, setAgent] = useState<GalleryAgent | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Chat state - persist thread ID in localStorage
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Thread ID - load from localStorage on mount
  const getStorageKey = (slug: string) => `dooza_chat_${slug}`
  const [threadId, setThreadId] = useState<string | null>(() => {
    if (agentSlug) {
      const stored = localStorage.getItem(getStorageKey(agentSlug))
      if (stored) {
        try {
          const data = JSON.parse(stored)
          return data.threadId || null
        } catch { return null }
      }
    }
    return null
  })
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  // Load agent info and chat history from DATABASE
  useEffect(() => {
    async function loadAgent() {
      if (!agentSlug) return
      
      setLoading(true)
      try {
        const agentData = await getAgentDetails(agentSlug)
        setAgent(agentData)
        
        // First check localStorage for existing threadId
        const stored = localStorage.getItem(getStorageKey(agentSlug))
        let savedThreadId: string | null = null
        if (stored) {
          try {
            const data = JSON.parse(stored)
            savedThreadId = data.threadId || null
          } catch (e) {
            console.error('Failed to parse stored data:', e)
          }
        }
        
        // If we have a threadId, try to load messages directly
        if (savedThreadId) {
          try {
            const historyResponse = await getThreadHistory(savedThreadId)
            
            if (historyResponse && historyResponse.length > 0) {
              setThreadId(savedThreadId)
              const loadedMessages: ChatMessage[] = historyResponse.map((msg: any) => ({
                id: msg.id || generateMessageId(),
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.created_at),
                isStreaming: false,
                toolCalls: msg.tool_calls?.map((tc: any) => ({
                  name: tc.name,
                  args: tc.args,
                  result: null,
                  status: 'complete' as const,
                })),
              }))
              setMessages(loadedMessages)
            } else {
              // Thread exists but no messages - keep threadId for continuity
              setThreadId(savedThreadId)
            }
          } catch (apiErr) {
            console.warn('[ChatPage] Failed to load messages from API:', apiErr)
            // Keep the threadId anyway so new messages continue the thread
            setThreadId(savedThreadId)
          }
        }
      } catch (err) {
        console.error('Failed to load agent:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadAgent()
    document.title = `Chat with ${agentSlug} | Dooza`
  }, [agentSlug])
  
  // Save threadId to localStorage (for quick lookup on next load)
  useEffect(() => {
    if (agentSlug && threadId) {
      localStorage.setItem(getStorageKey(agentSlug), JSON.stringify({ threadId }))
    }
  }, [threadId, agentSlug])
  
  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !agentSlug) return
    
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    
    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      toolCalls: [],
      isStreaming: true,
      agentSlug,
    }
    
    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)
    setError(null)
    
    try {
      const result = await streamChat(
        agentSlug,
        userMessage.content,
        {
          onToken: (content) => {
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg.role === 'assistant') {
                lastMsg.content += content
              }
              return updated
            })
          },
          
          onToolStart: (toolName, args) => {
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg.role === 'assistant') {
                lastMsg.toolCalls = lastMsg.toolCalls || []
                lastMsg.toolCalls.push({
                  name: toolName,
                  args,
                  status: 'running',
                })
              }
              return updated
            })
          },
          
          onToolEnd: (toolName, result) => {
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg.role === 'assistant' && lastMsg.toolCalls) {
                const tool = lastMsg.toolCalls.find(t => t.name === toolName && t.status === 'running')
                if (tool) {
                  tool.status = 'complete'
                  tool.result = result
                }
              }
              return updated
            })
          },
          
          onThreadId: (id) => {
            setThreadId(id)
          },
          
          onError: (err) => {
            setError(err)
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg.role === 'assistant') {
                lastMsg.isStreaming = false
                if (!lastMsg.content) {
                  lastMsg.content = 'Sorry, an error occurred. Please try again.'
                }
              }
              return updated
            })
          },
          
          onEnd: () => {
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg.role === 'assistant') {
                lastMsg.isStreaming = false
              }
              return updated
            })
          },
        },
        threadId || undefined
      )
      
      if (result.threadId) {
        setThreadId(result.threadId)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, agentSlug, threadId])
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  // Clear chat and start fresh
  const handleClearChat = useCallback(() => {
    if (agentSlug) {
      localStorage.removeItem(getStorageKey(agentSlug))
    }
    setMessages([])
    setThreadId(null)
    setError(null)
  }, [agentSlug])
  
  // Loading state
  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
      </div>
    )
  }
  
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--gray-50)',
    }}>
      {/* Header */}
      <header style={{
        padding: '12px 20px',
        background: 'white',
        borderBottom: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            borderRadius: '8px',
            cursor: 'pointer',
            color: 'var(--gray-600)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        
        {agent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: agent.gradient || 'var(--primary-600)',
              overflow: 'hidden',
            }}>
              {agent.avatar_url && (
                <img 
                  src={agent.avatar_url} 
                  alt={agent.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                {agent.name}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
                {agent.role}
              </p>
            </div>
          </div>
        )}
        
        {/* New Chat button */}
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            disabled={isStreaming}
            title="Start new conversation"
            style={{
              background: 'none',
              border: '1px solid var(--gray-300)',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              color: 'var(--gray-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              opacity: isStreaming ? 0.5 : 1,
            }}
          >
            <Trash2 size={16} />
            New Chat
          </button>
        )}
      </header>
      
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gray-500)',
            textAlign: 'center',
            padding: '40px',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: agent?.gradient || 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Sparkles size={28} color="white" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--gray-800)', marginBottom: '8px' }}>
              Chat with {agent?.name || 'Agent'}
            </h2>
            <p style={{ maxWidth: '400px', lineHeight: 1.5 }}>
              {agent?.slug === 'seomi' 
                ? "Enter a website URL and I'll analyze it for SEO improvements. For example: \"Analyze tmrgsolutions.com\""
                : `Ask ${agent?.name || 'me'} anything to get started.`
              }
            </p>
          </div>
        )}
        
        {messages.map(message => (
          <MessageBubble 
            key={message.id} 
            message={message} 
            agent={agent}
          />
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error banner */}
      {error && (
        <div style={{
          padding: '12px 20px',
          background: '#fef2f2',
          borderTop: '1px solid #fecaca',
          color: '#dc2626',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {/* Input */}
      <div style={{
        padding: '16px 20px',
        background: 'white',
        borderTop: '1px solid var(--gray-200)',
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              agent?.slug === 'seomi'
                ? "Enter a URL to analyze (e.g., example.com)"
                : "Type your message..."
            }
            disabled={isStreaming}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--gray-300)',
              fontSize: '15px',
              resize: 'none',
              fontFamily: 'inherit',
              outline: 'none',
              minHeight: '48px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--primary-600)',
              color: 'white',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isStreaming ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {isStreaming ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
      
      {/* Animations */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        
        .working-dot {
          width: 6px;
          height: 6px;
          background: var(--primary-600);
          border-radius: 50%;
          animation: bounce 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
