/**
 * Chat Page
 * 
 * Full-screen chat interface for interacting with AI agents.
 * Supports streaming responses and tool execution indicators.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Send, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Bot,
  User,
  Paperclip,
  Mic
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAgentDetails, GalleryAgent } from '../lib/agent-api'
import { 
  streamChat, 
  generateMessageId, 
  Message,
  ToolCall,
  ToolData,
  saveMessage,
  loadThreadMessages,
  listThreads,
  flushRetryQueue,
  type SavedMessage,
} from '../lib/chat-api'
import { getQueuedMessageCount } from '../lib/persistence'
import AgentPanel from '../components/AgentPanel'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { DynamicToolRenderer } from '../components/tools'
import { ToolUISchema, formatSummary } from '../types/tool-ui'
import WelcomeScreen from '../components/WelcomeScreen'
import { formatToolName } from '../config/tool-display-names'
import TaskCreatedCard from '../components/workspace/TaskCreatedCard'
import { WorkspaceEmbed } from '../components/workspace'

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

/** 
 * User-friendly tool indicator with expandable results.
 * Uses Server-Driven UI - renders based on ui_schema from backend.
 */
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
  
  // Get UI schema from tool (Server-Driven UI)
  const uiSchema = tool.ui_schema as ToolUISchema | undefined
  
  // Get result summary from schema template or fallback
  const getResultSummary = () => {
    if (!parsedResult) return null
    
    // Use schema's summary_template if available
    if (uiSchema?.summary_template) {
      return formatSummary(uiSchema.summary_template, parsedResult)
    }
    
    // Fallback for legacy/unknown tools
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
  const friendlyName = formatToolName(tool.name)
  
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
      
      {/* Expanded content - Dynamic renderer based on ui_schema */}
      {isExpanded && hasResult && (
        <div style={{
          borderTop: '1px solid #e2e8f0',
          background: 'white',
        }}>
          <DynamicToolRenderer 
            data={parsedResult} 
            schema={uiSchema || null} 
          />
        </div>
      )}
      
      {/* Special card for create_task tool - always show when complete */}
      {tool.name === 'create_task' && isComplete && parsedResult && (
        <div style={{
          borderTop: '1px solid #e2e8f0',
          padding: '12px',
        }}>
          <TaskCreatedCard result={parsedResult} />
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

/** Compact inline delegation indicator - shows which specialist is working */
function DelegationIndicator({ delegation }: { delegation: Delegation }) {
  const isActive = delegation.status === 'active'
  
  // Format specialist name for display (e.g., "social_research" -> "Social Research")
  const formatAgentName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  const specialistName = formatAgentName(delegation.toAgent)
  
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
            {specialistName} working...
          </span>
        </>
      ) : (
        <>
          <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
          <span style={{ color: '#16a34a', fontWeight: 500 }}>
            {specialistName}
          </span>
        </>
      )}
    </div>
  )
}

/** Workflow progress indicator - shows current step in content creation */
function WorkflowNodeIndicator({ nodeName }: { nodeName: string }) {
  // Map node names to user-friendly labels and icons
  const nodeConfig: Record<string, { label: string; emoji: string; description: string }> = {
    'parallel_research': { label: 'Researching', emoji: '🔍', description: 'Gathering hashtags, timing & ideas' },
    'validate_research': { label: 'Validating', emoji: '✓', description: 'Checking research quality' },
    'create_brief': { label: 'Creating Brief', emoji: '📋', description: 'Synthesizing research into plan' },
    'generate_draft': { label: 'Writing Draft', emoji: '✍️', description: 'Creating your content' },
    'evaluate_content': { label: 'Evaluating', emoji: '🔎', description: 'Checking content quality' },
    'refine_content': { label: 'Refining', emoji: '✨', description: 'Improving based on feedback' },
    'polish_final': { label: 'Polishing', emoji: '💎', description: 'Final touches' },
    'create_task': { label: 'Saving', emoji: '💾', description: 'Creating task in workspace' },
    // Generic fallback for any other nodes
    'content_workflow': { label: 'Processing', emoji: '⚙️', description: 'Working on your request' },
  }
  
  const config = nodeConfig[nodeName] || { 
    label: nodeName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
    emoji: '⚙️',
    description: 'Processing...'
  }
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      margin: '8px 0',
      background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      borderRadius: '10px',
      border: '1px solid #bae6fd',
      fontSize: '13px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <span style={{ fontSize: '16px' }}>{config.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontWeight: 600,
          color: '#0369a1',
        }}>
          {config.label}
          <Loader2 size={12} className="animate-spin" style={{ color: '#0ea5e9' }} />
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: '#64748b',
          marginTop: '2px',
        }}>
          {config.description}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ 
  message, 
  agent,
  currentWorkflowNode,
}: { 
  message: ChatMessage
  agent: GalleryAgent | null 
  currentWorkflowNode?: string | null
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
            {isWorking && !currentWorkflowNode && (
              <WorkingIndicator agentName={agent?.name || 'Agent'} />
            )}
            
            {/* Workflow progress indicator - shows current step in content creation */}
            {message.isStreaming && currentWorkflowNode && (
              <WorkflowNodeIndicator nodeName={currentWorkflowNode} />
            )}
            
            {/* Segments with agent labels - OR fallback to content */}
            {message.segments && message.segments.length > 0 ? (
              <>
                {message.segments.map((segment, idx) => {
                  const isLastSegment = idx === message.segments!.length - 1
                  
                  // Find the delegation for this specialist (if any)
                  const isSpecialist = segment.agent !== 'agent' && segment.agent !== 'tools'
                  const delegation = isSpecialist 
                    ? message.delegations?.find(d => d.toAgent === segment.agent)
                    : undefined
                  
                  // Check segment content
                  const hasTools = segment.tools && segment.tools.length > 0
                  const hasOrchestratorText = segment.agent === 'agent' && segment.text.trim()
                  const hasSpecialistContent = isSpecialist && (hasTools || segment.text.trim())
                  
                  // Show delegation indicator for ANY specialist segment that has content (text or tools)
                  // Specialists may respond with just text (no tools) - we still want to show they worked
                  const showDelegation = isSpecialist && delegation && hasSpecialistContent
                  
                  // Skip rendering completely empty segments
                  // Orchestrator: needs text | Specialist: needs delegation with content | Tools: needs tools
                  if (!hasOrchestratorText && !showDelegation && !hasTools) return null
                  
                  return (
                    <div key={`segment-${idx}`}>
                      {/* Show delegation indicator when specialist has content */}
                      {showDelegation && (
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
            
            {/* Streaming indicator - shows while stream is in progress and content exists */}
            {message.isStreaming && !isWorking && (
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid var(--gray-100)',
              }}>
                <span className="working-dot" style={{ animationDelay: '0ms' }} />
                <span className="working-dot" style={{ animationDelay: '150ms' }} />
                <span className="working-dot" style={{ animationDelay: '300ms' }} />
              </div>
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
  useAuth() // Ensure user is authenticated
  
  // Agent info
  const [agent, setAgent] = useState<GalleryAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Retry queue indicator
  const [pendingCount, setPendingCount] = useState(0)
  
  // Thread ID - always start fresh (cross-device via History dropdown)
  const [threadId, setThreadId] = useState<string | null>(null)
  
  // Workspace view toggle (for agents with workspace support like Soshie)
  const [showWorkspace, setShowWorkspace] = useState(false)
  
  // Workflow progress tracking - shows current node in content_workflow
  const [currentWorkflowNode, setCurrentWorkflowNode] = useState<string | null>(null)
  
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
  
  // Transform saved messages to ChatMessage format
  const transformSavedMessages = useCallback((savedMessages: SavedMessage[]): ChatMessage[] => {
    return savedMessages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      // Reconstruct tool calls from summary (limited data, but enough for display)
      // Expand compressed field names back to original format for ToolIndicator
      toolCalls: msg.tool_calls_summary?.map(tc => ({
        name: tc.name,
        args: tc.args,
        status: (tc.status || 'complete') as 'pending' | 'running' | 'complete' | 'error',
        result: tc.summary ? {
          // Expand compressed -> original field names
          overall_score: tc.summary.score,
          issues_count: tc.summary.issueCount,
          success: tc.summary.success,
        } : undefined,
      })),
      isStreaming: false,
    }))
  }, [])
  
  // Load agent info and most recent conversation
  // Optimized: Run independent API calls in parallel, defer non-critical work
  useEffect(() => {
    async function loadAgentAndRecentChat() {
      if (!agentSlug) return
      
      setLoading(true)
      try {
        // Parallel fetch: agent details + most recent thread
        // These are independent and can run simultaneously
        const [agentData, { threads }] = await Promise.all([
          getAgentDetails(agentSlug),
          listThreads(agentSlug, 1, 0),
        ])
        
        setAgent(agentData)
        
        // Show UI immediately after critical data loads
        setLoading(false)
        
        // Load thread messages if we have a recent conversation
        if (threads.length > 0) {
          const mostRecent = threads[0]
          setThreadId(mostRecent.thread_id)
          setLoadingMessages(true)
          
          try {
            const savedMessages = await loadThreadMessages(mostRecent.thread_id)
            if (savedMessages.length > 0) {
              const chatMessages = transformSavedMessages(savedMessages)
              setMessages(chatMessages)
            }
          } catch (msgErr) {
            console.error('Failed to load messages:', msgErr)
            // Don't show error - just start fresh
          } finally {
            setLoadingMessages(false)
          }
        }
        
        // Defer non-critical work: flush retry queue in background
        // This doesn't block UI and can happen asynchronously
        flushRetryQueue().then(() => {
          setPendingCount(getQueuedMessageCount())
        }).catch(err => {
          console.warn('Retry queue flush failed:', err)
        })
        
      } catch (err) {
        console.error('Failed to load agent:', err)
        setLoading(false)
      }
    }
    
    loadAgentAndRecentChat()
    document.title = `Chat with ${agentSlug} | Dooza`
  }, [agentSlug, transformSavedMessages])
  
  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueuedMessageCount())
    }, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !agentSlug) return
    
    const currentThreadId = threadId || `thread_${Date.now()}`
    
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
    
    // Track user message content for saving when we get the real thread ID
    const userMessageContent = userMessage.content
    let userMessageSaved = false
    let receivedThreadId: string | null = null
    
    // Track assistant message for saving on completion
    let finalAssistantContent = ''
    let finalToolCalls: ToolCall[] = []
    
    try {
      const result = await streamChat(
        agentSlug,
        userMessage.content,
        {
          onToken: (content, agent) => {
            finalAssistantContent += content
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
            const newTool = { name: toolName, args, status: 'running' as const }
            finalToolCalls.push(newTool)
            
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              
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
          
          onToolEnd: (toolName, result, uiSchema) => {
            // Update tracked tool calls with result and ui_schema
            finalToolCalls = finalToolCalls.map(t => 
              t.name === toolName && t.status === 'running'
                ? { ...t, status: 'complete' as const, result, ui_schema: uiSchema }
                : t
            )
            
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              
              // Update tool status in both top-level and segments
              const updateTool = (t: ToolCall) => 
                t.name === toolName && t.status === 'running'
                  ? { ...t, status: 'complete' as const, result, ui_schema: uiSchema }
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
          
          onNodeStart: (nodeName) => {
            // Show workflow progress for content_workflow nodes
            setCurrentWorkflowNode(nodeName)
          },
          
          onNodeEnd: () => {
            // Clear workflow progress (will show next node or nothing when done)
            // We don't clear immediately - let onNodeStart of next node update it
            // Only clear when stream ends
          },
          
          onThreadId: (id) => {
            setThreadId(id)
            receivedThreadId = id
            
            // Save user message immediately when we get the real thread ID
            // This ensures persistence even if streaming fails afterward
            if (!userMessageSaved) {
              userMessageSaved = true
              saveMessage({
                threadId: id,
                agentSlug,
                role: 'user',
                content: userMessageContent,
              }).catch(err => console.warn('Failed to save user message:', err))
            }
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
            setCurrentWorkflowNode(null) // Clear workflow progress
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, isStreaming: false }
                : msg
            ))
          },
        },
        currentThreadId
      )
      
      // Ensure streaming flag is cleared (fallback if onEnd callback didn't fire)
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 && msg.role === 'assistant'
          ? { ...msg, isStreaming: false }
          : msg
      ))
      
      // Use thread ID from result or from callback (whichever we got)
      const finalThreadId = result.threadId || receivedThreadId
      
      if (finalThreadId) {
        setThreadId(finalThreadId)
        
        // Save user message if not already saved via onThreadId callback
        if (!userMessageSaved) {
          userMessageSaved = true
          saveMessage({
            threadId: finalThreadId,
            agentSlug,
            role: 'user',
            content: userMessageContent,
          }).catch(err => console.warn('Failed to save user message:', err))
        }
        
        // Save assistant message after streaming completes
        if (finalAssistantContent) {
          saveMessage({
            threadId: finalThreadId,
            agentSlug,
            role: 'assistant',
            content: finalAssistantContent,
            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
          }).catch(err => console.warn('Failed to save assistant message:', err))
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
      
      // Save user message even on early failures (e.g., network error before onThreadId fires)
      // This ensures user messages aren't lost when streaming fails
      if (!userMessageSaved) {
        userMessageSaved = true
        saveMessage({
          threadId: currentThreadId,
          agentSlug,
          role: 'user',
          content: userMessageContent,
        }).catch(saveErr => console.warn('Failed to save user message on error:', saveErr))
      }
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
  
  // Select a thread from history
  const handleSelectThread = useCallback(async (selectedThreadId: string) => {
    setThreadId(selectedThreadId)
    setLoadingMessages(true)
    setError(null)
    
    try {
      const savedMessages = await loadThreadMessages(selectedThreadId)
      const chatMessages = transformSavedMessages(savedMessages)
      setMessages(chatMessages)
    } catch (err) {
      console.error('Failed to load thread:', err)
      setError('Failed to load conversation')
    } finally {
      setLoadingMessages(false)
    }
  }, [transformSavedMessages])
  
  // Start a new chat (clear current state)
  const handleNewChat = useCallback(() => {
    setMessages([])
    setThreadId(null)
    setError(null)
    setShowWorkspace(false)
  }, [])
  
  // Toggle workspace view
  const handleWorkspaceToggle = useCallback(() => {
    setShowWorkspace(prev => !prev)
  }, [])
  
  // Loading state
  if (loading) {
    return (
      <>
        <AgentPanel
          agent={null}
          agentSlug={agentSlug || ''}
          currentThreadId={null}
          onSelectThread={() => {}}
          onNewChat={() => {}}
          onWorkspaceToggle={() => {}}
          showWorkspace={false}
          isStreaming={false}
        />
        <div className="chat-layout__content">
          <div className="chat-page chat-page--loading">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
            <span style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
              Loading conversation...
            </span>
          </div>
        </div>
      </>
    )
  }
  
  return (
    <>
      {/* Agent Panel - left sidebar */}
      <AgentPanel
        agent={agent}
        agentSlug={agentSlug || ''}
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onWorkspaceToggle={handleWorkspaceToggle}
        showWorkspace={showWorkspace}
        isStreaming={isStreaming}
      />
      
      {/* Main Content - Chat or Workspace */}
      <div className="chat-layout__content">
        {showWorkspace ? (
          /* Workspace View */
          <WorkspaceEmbed 
            agentSlug={agentSlug || ''} 
            onBackToChat={() => setShowWorkspace(false)} 
          />
        ) : (
          /* Chat View */
          <div className="chat-page">
            {/* Messages */}
            <div className="chat-page__messages">
              {/* Loading messages indicator */}
              {loadingMessages && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  gap: '8px',
                  color: 'var(--gray-500)',
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span style={{ fontSize: '14px' }}>Loading conversation history...</span>
                </div>
              )}
              
              {messages.length === 0 && !loadingMessages && (
                <WelcomeScreen 
                  agent={agent} 
                  onSuggestionClick={(prompt) => {
                    setInput(prompt)
                    // Focus input after setting the prompt
                    setTimeout(() => inputRef.current?.focus(), 0)
                  }}
                />
              )}
              
              {messages.map((message, idx) => (
                <MessageBubble 
                  key={message.id} 
                  message={message} 
                  agent={agent}
                  currentWorkflowNode={
                    // Only show workflow progress for the last message (the streaming one)
                    idx === messages.length - 1 && message.isStreaming 
                      ? currentWorkflowNode 
                      : null
                  }
                />
              ))}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Error banner */}
            {error && (
              <div className="chat-page__error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            
            {/* Pending indicator */}
            {pendingCount > 0 && (
              <div className="chat-page__pending-banner">
                <AlertCircle size={14} />
                {pendingCount} message(s) pending sync
              </div>
            )}
            
            {/* Input - Modern style with attachment and mic icons */}
            <div className="chat-page__input-container">
              <div className="chat-page__input-wrapper">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message"
                  disabled={isStreaming}
                  rows={1}
                  className="chat-page__textarea"
                />
                <div className="chat-page__input-actions">
                  <button 
                    className="chat-page__action-btn"
                    title="Attach file"
                    type="button"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button 
                    className="chat-page__action-btn"
                    title="Voice input"
                    type="button"
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
                    className="chat-page__send-btn"
                  >
                    {isStreaming ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              </div>
              <p className="chat-page__disclaimer">
                Sintra Helpers can make mistakes. Verify important information.
              </p>
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
        )}
      </div>
    </>
  )
}
