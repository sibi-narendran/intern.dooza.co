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
  tools?: ToolCall[]  // Tools called during this segment
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

/** Industry-standard collapsible tool indicator with rich SEO card */
/** Format tool names for user-friendly display */
function formatToolNameForUser(name: string): string {
  const mapping: Record<string, string> = {
    'seo_analyze_url': 'Analyzing URL',
    'seo_audit_meta_tags': 'Checking meta tags',
    'seo_analyze_headings': 'Analyzing headings',
    'seo_check_images': 'Checking images',
    'seo_extract_keywords': 'Extracting keywords',
  }
  // Use mapping if available, otherwise format the name nicely
  return mapping[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** User-friendly tool indicator with expandable results */
function ToolIndicator({ tool }: { tool: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const isComplete = tool.status === 'complete'
  const isRunning = tool.status === 'running' || tool.status === 'pending'
  const hasResult = tool.result !== undefined
  
  // Parse result once
  const parsedResult = (() => {
    if (!tool.result) return null
    try {
      return typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
    } catch {
      return null
    }
  })()
  
  // Check if this is SEO data (has overall_score)
  const isSEOResult = parsedResult && isSEOAnalysisResult(parsedResult)
  
  // Get result summary
  const getResultSummary = () => {
    if (!parsedResult) return null
    if (parsedResult.overall_score !== undefined) {
      return `Score: ${parsedResult.overall_score}/100 • ${parsedResult.issues_count || 0} issues`
    }
    if (parsedResult.success !== undefined) {
      return parsedResult.success ? 'Success' : 'Failed'
    }
    return 'Completed'
  }
  
  const url = tool.args?.url as string | undefined
  const resultSummary = getResultSummary()
  const friendlyName = formatToolNameForUser(tool.name)
  
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      marginBottom: '8px',
      overflow: 'hidden',
    }}>
      {/* Header - always visible */}
      <div 
        onClick={() => hasResult && setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          cursor: hasResult ? 'pointer' : 'default',
          background: isExpanded ? '#f1f5f9' : 'transparent',
        }}
      >
        {/* Expand icon */}
        {hasResult && (
          <span style={{ 
            color: '#64748b', 
            fontSize: '10px',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ▶
          </span>
        )}
        
        {/* Status icon */}
        {isRunning ? (
          <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />
        ) : isComplete ? (
          <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
        ) : (
          <AlertCircle size={14} style={{ color: '#dc2626' }} />
        )}
        
        {/* Tool name - user friendly */}
        <span style={{
          fontSize: '13px',
          color: '#334155',
          fontWeight: 500,
        }}>
          {friendlyName}
        </span>
        
        {/* URL - shown nicely */}
        {url && (
          <span style={{
            fontSize: '12px',
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            ({url})
          </span>
        )}
        
        {/* Result summary */}
        {resultSummary && !isExpanded && (
          <span style={{
            fontSize: '12px',
            color: '#16a34a',
            marginLeft: 'auto',
            fontWeight: 500,
          }}>
            {resultSummary}
          </span>
        )}
      </div>
      
      {/* Expanded content - SEO card OR raw JSON */}
      {isExpanded && hasResult && (
        <div style={{
          borderTop: '1px solid #e2e8f0',
          background: isSEOResult ? 'white' : '#f1f5f9',
        }}>
          {isSEOResult ? (
            /* Rich SEO Analysis Card */
            <div style={{ padding: '0' }}>
              <SEOAnalysisCard data={parsedResult as SEOAnalysisResult} defaultExpanded={true} />
            </div>
          ) : (
            /* Fallback: Raw JSON */
            <div style={{ padding: '12px', maxHeight: '300px', overflow: 'auto' }}>
              <pre style={{
                fontSize: '11px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                color: '#475569',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}>
                {typeof tool.result === 'string' 
                  ? tool.result 
                  : JSON.stringify(tool.result, null, 2)
                }
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Renders a text segment from a specific agent with inline tools */
function SegmentBlock({ 
  segment, 
  isStreaming = false,
  isLast = false 
}: { 
  segment: TextSegment
  isStreaming?: boolean
  isLast?: boolean
}) {
  const isOrchestrator = segment.agent === 'agent'
  const hasTools = segment.tools && segment.tools.length > 0
  
  // For specialists: only show tools, hide text (orchestrator will summarize)
  // For orchestrator: show text only (no badge needed for user-friendly UI)
  const showText = isOrchestrator && segment.text.trim()
  const hasContent = showText || hasTools
  
  if (!hasContent) return null
  
  return (
    <div style={{ 
      marginBottom: isLast ? 0 : '16px',
    }}>
      {/* Tool calls - show for specialists (no agent badge needed) */}
      {hasTools && (
        <div style={{ marginBottom: showText ? '12px' : '0' }}>
          {segment.tools!.map((tool, idx) => (
            <ToolIndicator key={`tool-${idx}`} tool={tool} />
          ))}
        </div>
      )}
      
      {/* Text content - only for orchestrator */}
      {showText && (
        <div style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: '#1e293b',
          paddingLeft: '12px',
          borderLeft: '2px solid #8b5cf640',
        }}>
          <MarkdownRenderer content={segment.text} />
          {isStreaming && isLast && (
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '14px',
              background: '#8b5cf6',
              marginLeft: '2px',
              animation: 'blink 1s infinite',
              verticalAlign: 'text-bottom',
            }} />
          )}
        </div>
      )}
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

/** Compact inline delegation indicator - Cursor style */
/** User-friendly delegation indicator - no internal names exposed */
function DelegationIndicator({ delegation }: { delegation: Delegation }) {
  const isActive = delegation.status === 'active'
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      margin: '8px 0',
      background: isActive ? '#eff6ff' : '#f8fafc',
      borderRadius: '8px',
      border: `1px solid ${isActive ? '#bfdbfe' : '#e2e8f0'}`,
      fontSize: '13px',
    }}>
      {isActive ? (
        <>
          <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />
          <span style={{ color: '#3b82f6', fontWeight: 500 }}>
            Calling tool...
          </span>
        </>
      ) : (
        <>
          <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
          <span style={{ color: '#16a34a', fontWeight: 500 }}>
            Tool completed
          </span>
        </>
      )}
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
                  const prevSegment = idx > 0 ? message.segments![idx - 1] : null
                  
                  // Show delegation when switching FROM orchestrator TO specialist
                  const showDelegation = prevSegment && 
                    prevSegment.agent === 'agent' && 
                    segment.agent !== 'agent'
                  
                  // Find the delegation for this specialist
                  const delegation = message.delegations?.find(d => d.toAgent === segment.agent)
                  
                  return (
                    <div key={`segment-${idx}`}>
                      {/* Show delegation indicator when switching to specialist */}
                      {showDelegation && delegation && (
                        <DelegationIndicator delegation={delegation} />
                      )}
                      
                      <SegmentBlock 
                        segment={segment} 
                        isStreaming={message.isStreaming}
                        isLast={isLastSegment}
                      />
                    </div>
                  )
                })}
                
                {/* Active delegation at end - only if last segment is NOT the specialist yet */}
                {message.isStreaming && (() => {
                  const lastSegment = message.segments?.[message.segments.length - 1]
                  const activeDelegation = message.delegations?.find(d => d.status === 'active')
                  // Only show if there's an active delegation and last segment isn't the specialist's segment
                  if (activeDelegation && lastSegment?.agent !== activeDelegation.toAgent) {
                    return <DelegationIndicator key="active-wait" delegation={activeDelegation} />
                  }
                  return null
                })()}
              </>
            ) : message.content ? (
              /* Fallback: render content without segments (no agent badge for clean UI) */
              <div>
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
                
                {/* Tool calls for fallback mode */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    {message.toolCalls.map((tool, i) => (
                      <ToolIndicator key={i} tool={tool} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Note: SEO cards now rendered inside ToolIndicator for cleaner UX */}
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
              const segments = msg.segments || []
              const lastSegment = segments[segments.length - 1]
              
              // CHRONOLOGICAL: Only append to last segment if SAME agent
              // Otherwise create new segment - never merge with earlier segments
              if (lastSegment && lastSegment.agent === currentAgent) {
                // Append to current segment (preserve tools!)
                const updatedSegments = [
                  ...segments.slice(0, -1),
                  { ...lastSegment, text: lastSegment.text + content }
                ]
                return { 
                  ...msg, 
                  content: msg.content + content,
                  segments: updatedSegments,
                  activeAgent: currentAgent
                }
              }
              
              // New agent or first segment - create new segment
              const updatedSegments = [...segments, { agent: currentAgent, text: content }]
              return { 
                ...msg, 
                content: msg.content + content,
                segments: updatedSegments,
                activeAgent: currentAgent
              }
            }))
          },
          
          onToolStart: (toolName, args) => {
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              
              const newTool = { name: toolName, args, status: 'running' as const }
              const segments = msg.segments || []
              
              // Find the specialist - use multiple fallbacks for robustness
              // 1. Active delegation
              // 2. Any delegation (including complete - for timing issues)
              // 3. activeAgent (if not orchestrator)
              // 4. Last non-orchestrator segment
              const activeDelegation = msg.delegations?.find(d => d.status === 'active')
              const anyDelegation = msg.delegations?.[msg.delegations.length - 1] // Last delegation
              const specialistAgent = activeDelegation?.toAgent 
                || anyDelegation?.toAgent
                || (msg.activeAgent && msg.activeAgent !== 'agent' ? msg.activeAgent : null)
                || segments.slice().reverse().find(s => s.agent !== 'agent')?.agent
              
              let updatedSegments = [...segments]
              
              if (specialistAgent) {
                // Find or create segment for the specialist
                const specialistIdx = segments.findIndex(seg => seg.agent === specialistAgent)
                
                if (specialistIdx !== -1) {
                  // Add tool to specialist's segment
                  updatedSegments = segments.map((seg, i) => 
                    i === specialistIdx 
                      ? { ...seg, tools: [...(seg.tools || []), newTool] }
                      : seg
                  )
                } else {
                  // Create segment for specialist with this tool
                  updatedSegments.push({ agent: specialistAgent, text: '', tools: [newTool] })
                }
              } else {
                // No specialist found - create a tools segment
                updatedSegments.push({ agent: 'tools', text: '', tools: [newTool] })
              }
              
              return { 
                ...msg, 
                toolCalls: [...(msg.toolCalls || []), newTool],
                segments: updatedSegments
              }
            }))
          },
          
          onToolEnd: (toolName, result) => {
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              
              // Update tool status in both top-level and segments
              const updateTool = (t: ToolCall) => 
                t.name === toolName && t.status === 'running'
                  ? { ...t, status: 'complete' as const, result }
                  : t
              
              const updatedSegments = msg.segments?.map(seg => ({
                ...seg,
                tools: seg.tools?.map(updateTool)
              }))
              
              return {
                ...msg,
                toolCalls: msg.toolCalls?.map(updateTool),
                segments: updatedSegments
              }
            }))
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
            // Add delegation indicator AND create segment for the specialist
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              const existingDelegations = msg.delegations || []
              
              // Robust deduplication - check for any existing delegation to this agent
              const hasExisting = existingDelegations.some(d => d.toAgent === toAgent)
              if (hasExisting) {
                // Just update activeAgent if already delegated
                return { ...msg, activeAgent: toAgent }
              }
              
              // Create a new segment for the specialist (so tools go to the right place)
              const segments = msg.segments || []
              const hasSpecialistSegment = segments.some(s => s.agent === toAgent)
              const updatedSegments = hasSpecialistSegment 
                ? segments 
                : [...segments, { agent: toAgent, text: '', tools: [] }]
              
              return { 
                ...msg, 
                delegations: [...existingDelegations, { toAgent, status: 'active' as const }],
                activeAgent: toAgent,
                segments: updatedSegments
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
        
        {/* Typing indicator at bottom while streaming */}
        {isStreaming && (
          <div style={{ 
            display: 'flex', 
            gap: '4px', 
            padding: '12px 20px',
            marginLeft: '48px', 
          }}>
            <span className="working-dot" style={{ animationDelay: '0ms' }} />
            <span className="working-dot" style={{ animationDelay: '150ms' }} />
            <span className="working-dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        
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
