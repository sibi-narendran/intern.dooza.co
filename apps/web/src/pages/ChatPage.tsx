/**
 * Chat Page
 * 
 * Full-screen chat interface for interacting with AI agents.
 * Supports streaming responses and tool execution indicators.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  formatAgentName,
  Message,
  ToolCall,
  ToolData
} from '../lib/chat-api'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { SEOAnalysisCard } from '../components/seo'
import { SEOAnalysisResult, isSEOAnalysisResult } from '../types/seo'

// ============================================================================
// Types
// ============================================================================

interface Delegation {
  toAgent: string
  status: 'active' | 'complete'
}

/** A segment of text from a specific agent */
interface TextSegment {
  agent: string  // 'agent' = orchestrator, 'seo_tech', 'seo_content', etc.
  text: string
}

interface ChatMessage extends Message {
  agentSlug?: string
  toolData?: ToolData[]  // Structured tool results for UI rendering
  delegations?: Delegation[]  // Track delegation events
  activeAgent?: string  // Currently active agent
  segments?: TextSegment[]  // Text segments with agent attribution
}

// ============================================================================
// Components
// ============================================================================

function ToolIndicator({ tool }: { tool: ToolCall }) {
  const statusConfig = {
    pending: { 
      icon: <Loader2 className="animate-spin" size={16} />,
      text: 'Preparing...',
      bgClass: '',
    },
    running: { 
      icon: <Loader2 className="animate-spin" size={16} />,
      text: 'Analyzing...',
      bgClass: '',
    },
    complete: { 
      icon: <CheckCircle2 size={16} style={{ color: '#16a34a' }} />,
      text: 'Complete',
      bgClass: 'tool-execution--complete',
    },
    error: { 
      icon: <AlertCircle size={16} style={{ color: '#dc2626' }} />,
      text: 'Failed',
      bgClass: 'tool-execution--error',
    },
  }
  
  const status = statusConfig[tool.status]
  
  // Get tool description based on name
  const getToolDescription = (name: string) => {
    const descriptions: Record<string, string> = {
      'seo_analyze_url': 'Running comprehensive SEO audit',
      'seo_audit_meta_tags': 'Checking meta tags and Open Graph',
      'seo_analyze_headings': 'Analyzing heading structure (H1-H6)',
      'seo_check_images': 'Auditing image alt tags',
      'seo_extract_keywords': 'Extracting top keywords',
    }
    return descriptions[name] || 'Processing...'
  }
  
  // Get URL from args if available
  const url = tool.args?.url as string | undefined
  
  return (
    <div className={`tool-execution ${status.bgClass}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, var(--gray-50), white)',
      border: '1px solid var(--gray-200)',
      borderRadius: '12px',
      marginBottom: '12px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tool.status === 'complete' ? '#dcfce7' : 
                   tool.status === 'error' ? '#fef2f2' : 'var(--primary-100)',
        color: tool.status === 'complete' ? '#16a34a' : 
               tool.status === 'error' ? '#dc2626' : 'var(--primary-600)',
        borderRadius: '10px',
        flexShrink: 0,
      }}>
        <Wrench size={18} />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--gray-800)',
        }}>
          {formatToolName(tool.name)}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--gray-500)',
          marginTop: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {tool.status === 'running' || tool.status === 'pending' ? (
            getToolDescription(tool.name)
          ) : url ? (
            <span style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              maxWidth: '200px',
            }}>
              {url}
            </span>
          ) : (
            status.text
          )}
        </div>
      </div>
      
      {status.icon}
    </div>
  )
}

/** Agent label badge - shows which agent is speaking */
function AgentBadge({ agent, isActive = false }: { agent: string; isActive?: boolean }) {
  const config: Record<string, { name: string; color: string; icon: string }> = {
    'agent': { name: 'SEOmi', color: '#8b5cf6', icon: '🎯' },
    'seo_tech': { name: 'Technical', color: '#2563eb', icon: '🔧' },
    'seo_content': { name: 'Content', color: '#059669', icon: '📝' },
    'seo_analytics': { name: 'Analytics', color: '#7c3aed', icon: '📊' },
  }
  
  const { name, color, icon } = config[agent] || { name: formatAgentName(agent), color: '#6b7280', icon: '🤖' }
  
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: `${color}10`,
      borderRadius: '6px',
      marginBottom: '8px',
    }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span style={{
        fontSize: '12px',
        fontWeight: 600,
        color: color,
        letterSpacing: '0.01em',
      }}>
        {name}
      </span>
      {isActive && (
        <Loader2 size={10} className="animate-spin" style={{ color, marginLeft: '2px' }} />
      )}
    </div>
  )
}

/** Renders a text segment from a specific agent */
function SegmentBlock({ 
  segment, 
  isStreaming = false,
  isLast = false 
}: { 
  segment: TextSegment
  isStreaming?: boolean
  isLast?: boolean
}) {
  if (!segment.text.trim()) return null
  
  return (
    <div style={{ marginBottom: isLast ? 0 : '16px' }}>
      <AgentBadge agent={segment.agent} isActive={isStreaming && isLast} />
      <div style={{
        fontSize: '15px',
        lineHeight: '1.6',
        color: 'var(--gray-800)',
      }}>
        <MarkdownRenderer content={segment.text} />
        {isStreaming && isLast && (
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '16px',
            background: 'var(--primary-600)',
            marginLeft: '2px',
            animation: 'blink 1s infinite',
            verticalAlign: 'text-bottom',
          }} />
        )}
      </div>
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

/** Compact inline delegation indicator */
function DelegationIndicator({ delegation }: { delegation: Delegation }) {
  const agentConfig: Record<string, { color: string; icon: string; name: string }> = {
    'seo_tech': { color: '#2563eb', icon: '🔧', name: 'Technical' },
    'seo_content': { color: '#059669', icon: '📝', name: 'Content' },
    'seo_analytics': { color: '#7c3aed', icon: '📊', name: 'Analytics' },
  }
  
  const config = agentConfig[delegation.toAgent] || { 
    color: '#6b7280', 
    icon: '🤖', 
    name: formatAgentName(delegation.toAgent) 
  }
  const isActive = delegation.status === 'active'
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0',
      margin: '4px 0',
      color: 'var(--gray-500)',
      fontSize: '13px',
    }}>
      <div style={{
        width: '20px',
        height: '1px',
        background: 'var(--gray-300)',
      }} />
      
      {isActive ? (
        <>
          <Loader2 size={12} className="animate-spin" style={{ color: config.color }} />
          <span style={{ color: config.color, fontWeight: 500 }}>
            Calling {config.name}...
          </span>
        </>
      ) : (
        <>
          <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
          <span style={{ color: 'var(--gray-600)' }}>
            {config.name} complete
          </span>
        </>
      )}
      
      <div style={{
        flex: 1,
        height: '1px',
        background: 'var(--gray-200)',
      }} />
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
        maxWidth: isUser ? '70%' : '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {/* User message - simple bubble */}
        {isUser && message.content && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '16px',
            background: 'var(--primary-600)',
            color: 'white',
            fontSize: '15px',
            lineHeight: '1.5',
          }}>
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          </div>
        )}
        
        {/* Assistant message - structured with agent labels */}
        {!isUser && (
          <div style={{
            padding: '16px 20px',
            borderRadius: '16px',
            background: 'white',
            border: '1px solid var(--gray-200)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}>
            {/* Working indicator */}
            {isWorking && (
              <WorkingIndicator agentName={agent?.name || 'Agent'} />
            )}
            
            {/* Segments with agent labels - OR fallback to content */}
            {message.segments && message.segments.length > 0 ? (
              <>
                {message.segments.map((segment, idx) => {
                  const isLastSegment = idx === message.segments!.length - 1
                  // Find delegation indicator that should appear before this segment
                  const delegationBefore = message.delegations?.find(
                    d => d.toAgent === segment.agent && segment.agent !== 'agent'
                  )
                  
                  return (
                    <div key={`segment-${idx}`}>
                      {/* Show delegation indicator when switching to specialist */}
                      {delegationBefore && idx > 0 && (
                        <DelegationIndicator delegation={delegationBefore} />
                      )}
                      <SegmentBlock 
                        segment={segment} 
                        isStreaming={message.isStreaming}
                        isLast={isLastSegment}
                      />
                    </div>
                  )
                })}
                
                {/* Active delegation indicator at end */}
                {message.delegations?.filter(d => d.status === 'active').map((d, idx) => (
                  <DelegationIndicator key={`active-${idx}`} delegation={d} />
                ))}
              </>
            ) : message.content ? (
              /* Fallback: render content without segments */
              <div>
                <AgentBadge agent={message.activeAgent || 'agent'} isActive={message.isStreaming} />
                <div style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--gray-800)' }}>
                  <MarkdownRenderer content={message.content} />
                  {message.isStreaming && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '16px',
                      background: 'var(--primary-600)',
                      marginLeft: '2px',
                      animation: 'blink 1s infinite',
                      verticalAlign: 'text-bottom',
                    }} />
                  )}
                </div>
                
                {/* Delegation indicators */}
                {message.delegations?.map((delegation, idx) => (
                  <DelegationIndicator key={`delegation-${idx}`} delegation={delegation} />
                ))}
              </div>
            ) : null}
            
            {/* Tool calls */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                {message.toolCalls.map((tool, idx) => (
                  <ToolIndicator key={idx} tool={tool} />
                ))}
              </div>
            )}
            
            {/* Structured tool data - SEO analysis cards */}
            {message.toolData?.map((td, idx) => {
              if (td.category === 'seo' && isSEOAnalysisResult(td.data)) {
                return (
                  <SEOAnalysisCard 
                    key={`tool-data-${idx}`} 
                    data={td.data as SEOAnalysisResult} 
                  />
                )
              }
              return null
            })}
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
  useAuth() // Ensure user is authenticated
  
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
  
  // Load agent info
  useEffect(() => {
    async function loadAgent() {
      if (!agentSlug) return
      
      setLoading(true)
      try {
        const agentData = await getAgentDetails(agentSlug)
        setAgent(agentData)
        
        // Check localStorage for existing threadId (for conversation continuity)
        const stored = localStorage.getItem(getStorageKey(agentSlug))
        if (stored) {
          try {
            const data = JSON.parse(stored)
            if (data.threadId) {
              setThreadId(data.threadId)
            }
          } catch (e) {
            console.error('Failed to parse stored data:', e)
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
      toolData: [],
      delegations: [],
      activeAgent: 'agent',
      segments: [{ agent: 'agent', text: '' }],  // Start with orchestrator segment
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
          onToken: (content, agent) => {
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              
              const currentAgent = agent || msg.activeAgent || 'agent'
              const segments = msg.segments || [{ agent: 'agent', text: '' }]
              const lastSegment = segments[segments.length - 1]
              
              // If same agent, append to current segment
              if (lastSegment.agent === currentAgent) {
                const updatedSegments = [
                  ...segments.slice(0, -1),
                  { agent: currentAgent, text: lastSegment.text + content }
                ]
                return { 
                  ...msg, 
                  content: msg.content + content,
                  segments: updatedSegments,
                  activeAgent: currentAgent
                }
              }
              
              // Different agent - create new segment
              const updatedSegments = [
                ...segments,
                { agent: currentAgent, text: content }
              ]
              return { 
                ...msg, 
                content: msg.content + content,
                segments: updatedSegments,
                activeAgent: currentAgent
              }
            }))
          },
          
          onToolStart: (toolName, args) => {
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { 
                    ...msg, 
                    toolCalls: [...(msg.toolCalls || []), { name: toolName, args, status: 'running' as const }]
                  }
                : msg
            ))
          },
          
          onToolEnd: (toolName, result) => {
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant' && msg.toolCalls
                ? {
                    ...msg,
                    toolCalls: msg.toolCalls.map(t => 
                      t.name === toolName && t.status === 'running'
                        ? { ...t, status: 'complete' as const, result }
                        : t
                    )
                  }
                : msg
            ))
          },
          
          onToolData: (toolData) => {
            // Add structured tool data for UI rendering (with deduplication)
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              const existingData = msg.toolData || []
              const isDuplicate = existingData.some(
                td => td.tool === toolData.tool && 
                      JSON.stringify(td.data) === JSON.stringify(toolData.data)
              )
              if (isDuplicate) return msg
              return { ...msg, toolData: [...existingData, toolData] }
            }))
          },
          
          onDelegate: (toAgent) => {
            // Add delegation indicator
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              const existingDelegations = msg.delegations || []
              const existing = existingDelegations.find(d => d.toAgent === toAgent)
              if (existing) return msg
              return { 
                ...msg, 
                delegations: [...existingDelegations, { toAgent, status: 'active' as const }],
                activeAgent: toAgent
              }
            }))
          },
          
          onAgentSwitch: (agent) => {
            // Mark previous delegation as complete when switching agents
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              const existingDelegations = msg.delegations || []
              // If switching back to supervisor, mark all as complete
              if (agent === 'agent') {
                return {
                  ...msg,
                  delegations: existingDelegations.map(d => ({ ...d, status: 'complete' as const })),
                  activeAgent: agent
                }
              }
              return { ...msg, activeAgent: agent }
            }))
          },
          
          onThreadId: (id) => {
            setThreadId(id)
          },
          
          onError: (err) => {
            setError(err)
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { 
                    ...msg, 
                    isStreaming: false, 
                    content: msg.content || 'Sorry, an error occurred. Please try again.'
                  }
                : msg
            ))
          },
          
          onEnd: () => {
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, isStreaming: false }
                : msg
            ))
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
