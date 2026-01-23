/**
 * Chat Page
 * 
 * Simplified chat interface using structured UI actions from backend.
 * No more segment/delegation tracking - backend handles all that.
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
  Mic,
  ExternalLink,
  Link2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAgentDetails, GalleryAgent } from '../lib/agent-api'
import { 
  streamChat, 
  generateMessageId, 
  loadThreadMessages,
  listThreads,
  type LangGraphMessage,
} from '../lib/chat-api'
import type { 
  ChatMessage, 
  ToolCall, 
  UIAction,
  StructuredResponse,
} from '../lib/chat-types'
import { 
  isConnectionPromptAction, 
  isTaskCreatedAction, 
  isPublishResultAction,
} from '../lib/chat-types'
import AgentPanel from '../components/AgentPanel'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { DynamicToolRenderer, ImageResultCard, isImageResult } from '../components/tools'
import { ToolUISchema, formatSummary } from '../types/tool-ui'
import WelcomeScreen from '../components/WelcomeScreen'
import { formatToolName } from '../config/tool-display-names'
import { WorkspaceEmbed, IntegrationActionCard, isIntegrationAction } from '../components/workspace'

// ============================================================================
// Components
// ============================================================================

/** 
 * Tool indicator with expandable results.
 */
function ToolIndicator({ tool }: { tool: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const isComplete = tool.status === 'complete'
  const isRunning = tool.status === 'running' || tool.status === 'pending'
  const hasResult = tool.result !== undefined
  
  const parsedResult = (() => {
    if (!tool.result) return null
    try {
      return typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
    } catch {
      return null
    }
  })()
  
  const uiSchema = tool.ui_schema as ToolUISchema | undefined
  
  const getResultSummary = () => {
    if (!parsedResult) return null
    if (uiSchema?.summary_template) {
      return formatSummary(uiSchema.summary_template, parsedResult)
    }
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
    <div className="tool-indicator">
      <div 
        onClick={() => hasResult && setIsExpanded(!isExpanded)}
        className={`tool-indicator__header ${hasResult ? 'tool-indicator__header--clickable' : ''}`}
      >
        {hasResult && (
          <span className={`tool-indicator__expand ${isExpanded ? 'tool-indicator__expand--open' : ''}`}>
            ▶
          </span>
        )}
        
        {isRunning ? (
          <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />
        ) : isComplete ? (
          <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
        ) : (
          <AlertCircle size={14} style={{ color: '#dc2626' }} />
        )}
        
        <span className="tool-indicator__name">{friendlyName}</span>
        
        {url && <span className="tool-indicator__url">({url})</span>}
        
        {resultSummary && !isExpanded && (
          <span className="tool-indicator__summary">{resultSummary}</span>
        )}
      </div>
      
      {isExpanded && hasResult && (
        <div className="tool-indicator__content">
          {/* Image generation gets special card */}
          {tool.name === 'generate_image' && isImageResult(parsedResult) ? (
            <ImageResultCard data={parsedResult} />
          ) : (
            <DynamicToolRenderer data={parsedResult} schema={uiSchema || null} />
          )}
        </div>
      )}
      
      {/* Special cards for specific tools - always visible */}
      {tool.name === 'request_connect_integration' && isComplete && parsedResult && isIntegrationAction(parsedResult) && (
        <div className="tool-indicator__special-card">
          <IntegrationActionCard data={parsedResult} />
        </div>
      )}
    </div>
  )
}

/**
 * UI Action Card - renders structured actions from backend
 */
function UIActionCard({ action }: { action: UIAction }) {
  if (isConnectionPromptAction(action)) {
  return (
      <div className="ui-action-card ui-action-card--connection">
        <div className="ui-action-card__header">
          <Link2 size={18} />
          <span>Connect your accounts</span>
        </div>
        <p className="ui-action-card__message">{action.message}</p>
        <div className="ui-action-card__platforms">
          {action.platforms.map(platform => (
            <button key={platform} className="ui-action-card__connect-btn">
              Connect {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </button>
          ))}
        </div>
      </div>
    )
  }
  
  if (isTaskCreatedAction(action)) {
    return (
      <div className="ui-action-card ui-action-card--task">
        <div className="ui-action-card__header">
          <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
          <span>Task Created</span>
        </div>
        <p className="ui-action-card__title">{action.title}</p>
        <div className="ui-action-card__meta">
          <span className="ui-action-card__platform">{action.platform}</span>
          <a href={`/workspace?task=${action.task_id}`} className="ui-action-card__link">
            View in Workspace <ExternalLink size={14} />
          </a>
        </div>
    </div>
  )
}

  if (isPublishResultAction(action)) {
    const isSuccess = action.success
  return (
      <div className={`ui-action-card ui-action-card--publish ${isSuccess ? 'ui-action-card--success' : 'ui-action-card--error'}`}>
        <div className="ui-action-card__header">
          {isSuccess ? (
            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#dc2626' }} />
          )}
          <span>{isSuccess ? 'Published!' : 'Publish Failed'}</span>
      </div>
        <p className="ui-action-card__platform-name">
          {action.platform.charAt(0).toUpperCase() + action.platform.slice(1)}
        </p>
        {isSuccess && action.post_url && (
          <a href={action.post_url} target="_blank" rel="noopener noreferrer" className="ui-action-card__link">
            View Post <ExternalLink size={14} />
          </a>
        )}
        {!isSuccess && action.error && (
          <p className="ui-action-card__error">{action.error}</p>
        )}
    </div>
  )
}

  return null
}

/**
 * Working indicator during streaming
 */
function WorkingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="working-indicator">
      <div className="working-indicator__dots">
        <span className="working-dot" style={{ animationDelay: '0ms' }} />
        <span className="working-dot" style={{ animationDelay: '150ms' }} />
        <span className="working-dot" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="working-indicator__text">{agentName} is working...</span>
    </div>
  )
}

/**
 * Workflow progress indicator
 */
function WorkflowNodeIndicator({ nodeName }: { nodeName: string }) {
  const nodeConfig: Record<string, { label: string; emoji: string; description: string }> = {
    'parallel_research': { label: 'Researching', emoji: '🔍', description: 'Gathering hashtags, timing & ideas' },
    'validate_research': { label: 'Validating', emoji: '✓', description: 'Checking research quality' },
    'create_brief': { label: 'Creating Brief', emoji: '📋', description: 'Synthesizing research into plan' },
    'generate_draft': { label: 'Writing Draft', emoji: '✍️', description: 'Creating your content' },
    'evaluate_content': { label: 'Evaluating', emoji: '🔎', description: 'Checking content quality' },
    'refine_content': { label: 'Refining', emoji: '✨', description: 'Improving based on feedback' },
    'polish_final': { label: 'Polishing', emoji: '💎', description: 'Final touches' },
    'create_task': { label: 'Saving', emoji: '💾', description: 'Creating task in workspace' },
  }
  
  const config = nodeConfig[nodeName] || { 
    label: nodeName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
    emoji: '⚙️',
    description: 'Processing...'
  }
  
  return (
    <div className="workflow-indicator">
      <span className="workflow-indicator__emoji">{config.emoji}</span>
      <div className="workflow-indicator__content">
        <div className="workflow-indicator__label">
          {config.label}
          <Loader2 size={12} className="animate-spin" />
        </div>
        <div className="workflow-indicator__description">{config.description}</div>
      </div>
    </div>
  )
}

/**
 * Message bubble component
 */
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
    <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}>
      {/* Avatar */}
      <div 
        className="message-bubble__avatar"
        style={{
        background: isUser 
          ? 'var(--primary-600)' 
          : (agent?.gradient || 'linear-gradient(135deg, #8b5cf6, #a78bfa)'),
        }}
      >
        {isUser ? (
          <User size={18} color="white" />
        ) : agent?.avatar_url ? (
          <img src={agent.avatar_url} alt={agent.name} />
        ) : (
          <Bot size={18} color="white" />
        )}
      </div>
      
      {/* Content */}
      <div className="message-bubble__content">
        {/* User message */}
        {isUser && message.content && (
          <div className="message-bubble__user-text">{message.content}</div>
        )}
        
        {/* Assistant message */}
        {!isUser && (
          <div className="message-bubble__assistant-box">
            {/* Working indicator */}
            {isWorking && !currentWorkflowNode && (
              <WorkingIndicator agentName={agent?.name || 'Agent'} />
            )}
            
            {/* Workflow progress */}
            {message.isStreaming && currentWorkflowNode && (
              <WorkflowNodeIndicator nodeName={currentWorkflowNode} />
            )}
            
            {/* Tool calls */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="message-bubble__tools">
                {message.toolCalls.map((tool, idx) => (
                  <ToolIndicator key={`tool-${idx}`} tool={tool} />
                ))}
              </div>
            )}
                
            {/* Message content */}
            {message.content && (
              <div className="message-bubble__text">
                  <MarkdownRenderer content={message.content} />
                  {message.isStreaming && (
                  <span className="message-bubble__cursor" />
                  )}
                </div>
            )}
            
            {/* UI Actions - rendered directly from backend */}
            {message.uiActions && message.uiActions.length > 0 && (
              <div className="message-bubble__ui-actions">
                {message.uiActions.map((action, idx) => (
                  <UIActionCard key={`action-${idx}`} action={action} />
                    ))}
                  </div>
                )}
            
            {/* Streaming dots */}
            {message.isStreaming && !isWorking && (
              <div className="message-bubble__streaming-dots">
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
  useAuth()
  
  // Agent info
  const [agent, setAgent] = useState<GalleryAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Thread and workspace
  const [threadId, setThreadId] = useState<string | null>(null)
  const [showWorkspace, setShowWorkspace] = useState(false)
  
  // Workflow progress
  const [currentWorkflowNode, setCurrentWorkflowNode] = useState<string | null>(null)
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  // Transform LangGraph messages to ChatMessage format
  // This preserves full tool results including image_url, status, etc.
  const transformLangGraphMessages = useCallback((messages: LangGraphMessage[]): ChatMessage[] => {
    const result: ChatMessage[] = []
    let currentAssistantMsg: ChatMessage | null = null
    
    for (const msg of messages) {
      if (msg.type === 'human') {
        // Flush any pending assistant message
        if (currentAssistantMsg) {
          result.push(currentAssistantMsg)
          currentAssistantMsg = null
        }
        
        result.push({
          id: msg.id,
          role: 'user',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: new Date(),
          isStreaming: false,
        })
      } 
      else if (msg.type === 'ai') {
        // Flush any pending assistant message
        if (currentAssistantMsg) {
          result.push(currentAssistantMsg)
        }
        
        // Start new assistant message
        currentAssistantMsg = {
          id: msg.id,
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : '',
          timestamp: new Date(),
          toolCalls: msg.tool_calls?.map(tc => ({
            name: tc.name,
            args: tc.args,
            status: 'running' as const,
          })),
          isStreaming: false,
        }
      }
      else if (msg.type === 'tool') {
        // Tool message contains the full result - attach to current assistant message
        if (currentAssistantMsg && currentAssistantMsg.toolCalls) {
          const toolCallId = msg.tool_call_id
          const toolName = msg.name
          
          // Find and update the matching tool call with full result
          currentAssistantMsg.toolCalls = currentAssistantMsg.toolCalls.map(tc => {
            // Match by name (more reliable than tool_call_id for display)
            if (tc.name === toolName && tc.status === 'running') {
              return {
                ...tc,
                status: 'complete' as const,
                result: msg.content, // Full result including image_url, status, etc.
              }
            }
            return tc
          })
        }
      }
    }
    
    // Flush any remaining assistant message
    if (currentAssistantMsg) {
      result.push(currentAssistantMsg)
    }
    
    return result
  }, [])
  
  // Load agent and recent chat
  useEffect(() => {
    async function loadAgentAndRecentChat() {
      if (!agentSlug) return
      
      setLoading(true)
      try {
        const [agentData, { threads }] = await Promise.all([
          getAgentDetails(agentSlug),
          listThreads(agentSlug, 1, 0),
        ])
        
        setAgent(agentData)
        setLoading(false)
        
        if (threads.length > 0) {
          const mostRecent = threads[0]
          setThreadId(mostRecent.thread_id)
          setLoadingMessages(true)
          
          try {
            // Load from LangGraph checkpointer - returns full messages with tool results
            const langGraphMessages = await loadThreadMessages(agentSlug, mostRecent.thread_id)
            if (langGraphMessages.length > 0) {
              const chatMessages = transformLangGraphMessages(langGraphMessages)
              setMessages(chatMessages)
            }
          } catch (msgErr) {
            console.error('Failed to load messages:', msgErr)
          } finally {
            setLoadingMessages(false)
          }
        }
        
      } catch (err) {
        console.error('Failed to load agent:', err)
        setLoading(false)
      }
    }
    
    loadAgentAndRecentChat()
    document.title = `Chat with ${agentSlug} | Dooza`
  }, [agentSlug, transformLangGraphMessages])
  
  // Handle send message
  // LangGraph checkpointer auto-persists messages - no manual save needed
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !agentSlug) return
    
    // Pass actual threadId to streamChat - it will generate a new ID if null
    // This allows streamChat to know if it's a new conversation and register the thread
    const currentThreadId = threadId
    
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
      uiActions: [],
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
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              return { ...msg, content: msg.content + content }
            }))
          },
          
          onToolStart: (toolName, args) => {
            const newTool: ToolCall = { name: toolName, args, status: 'running' }
            
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              return { ...msg, toolCalls: [...(msg.toolCalls || []), newTool] }
            }))
          },
          
          onToolEnd: (toolName, result, uiSchema) => {
            setMessages(prev => prev.map((msg, idx) => {
              if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
              return {
                ...msg,
                toolCalls: msg.toolCalls?.map(t =>
                  t.name === toolName && t.status === 'running'
                    ? { ...t, status: 'complete', result, ui_schema: uiSchema }
                    : t
                ),
              }
            }))
          },
          
          onNodeStart: (nodeName) => {
            setCurrentWorkflowNode(nodeName)
          },
          
          onNodeEnd: () => {
            // Node end is handled by next onNodeStart or onEnd
          },
          
          onStructuredResponse: (response: StructuredResponse) => {
            // Update message with UI actions from backend
            if (response.ui_actions && response.ui_actions.length > 0) {
              setMessages(prev => prev.map((msg, idx) => {
                if (idx !== prev.length - 1 || msg.role !== 'assistant') return msg
                return { ...msg, uiActions: response.ui_actions }
              }))
            }
          },
          
          onThreadId: (id) => {
            setThreadId(id)
          },
          
          onError: (err) => {
            setError(err)
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, isStreaming: false, content: msg.content || 'Sorry, an error occurred.' }
                : msg
            ))
          },
          
          onEnd: () => {
            setCurrentWorkflowNode(null)
            setMessages(prev => prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, isStreaming: false }
                : msg
            ))
          },
        },
        currentThreadId
      )
      
      // Ensure streaming flag is cleared
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 && msg.role === 'assistant'
          ? { ...msg, isStreaming: false }
          : msg
      ))
      
      // Update thread ID from result
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
  
  // Thread selection
  const handleSelectThread = useCallback(async (selectedThreadId: string) => {
    if (!agentSlug) return
    
    setThreadId(selectedThreadId)
    setLoadingMessages(true)
    setError(null)
    
    try {
      // Load from LangGraph checkpointer
      const langGraphMessages = await loadThreadMessages(agentSlug, selectedThreadId)
      const chatMessages = transformLangGraphMessages(langGraphMessages)
      setMessages(chatMessages)
    } catch (err) {
      console.error('Failed to load thread:', err)
      setError('Failed to load conversation')
    } finally {
      setLoadingMessages(false)
    }
  }, [agentSlug, transformLangGraphMessages])
  
  // New chat
  const handleNewChat = useCallback(() => {
    setMessages([])
    setThreadId(null)
    setError(null)
    setShowWorkspace(false)
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
      <AgentPanel
        agent={agent}
        agentSlug={agentSlug || ''}
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onWorkspaceToggle={() => setShowWorkspace(prev => !prev)}
        showWorkspace={showWorkspace}
        isStreaming={isStreaming}
      />
      
      <div className="chat-layout__content">
        {showWorkspace ? (
          <WorkspaceEmbed 
            agentSlug={agentSlug || ''} 
            onBackToChat={() => setShowWorkspace(false)} 
          />
        ) : (
          <div className="chat-page">
            {/* Messages */}
            <div className="chat-page__messages">
              {loadingMessages && (
                <div className="chat-page__loading-messages">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading conversation history...</span>
                </div>
              )}
              
              {messages.length === 0 && !loadingMessages && (
                <WelcomeScreen 
                  agent={agent} 
                  onSuggestionClick={(prompt) => {
                    setInput(prompt)
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
            
            {/* Input */}
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
                  <button className="chat-page__action-btn" title="Attach file" type="button">
                    <Paperclip size={18} />
                  </button>
                  <button className="chat-page__action-btn" title="Voice input" type="button">
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
          
          {/* Styles */}
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
            
            /* Tool Indicator */
            .tool-indicator {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              margin-bottom: 8px;
              overflow: hidden;
            }
            
            .tool-indicator__header {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 12px;
            }
            
            .tool-indicator__header--clickable {
              cursor: pointer;
            }
            
            .tool-indicator__header--clickable:hover {
              background: #f1f5f9;
            }
            
            .tool-indicator__expand {
              color: #64748b;
              font-size: 10px;
              transition: transform 0.2s;
            }
            
            .tool-indicator__expand--open {
              transform: rotate(90deg);
            }
            
            .tool-indicator__name {
              font-size: 13px;
              color: #334155;
              font-weight: 500;
            }
            
            .tool-indicator__url {
              font-size: 12px;
              color: #64748b;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
            }
            
            .tool-indicator__summary {
              font-size: 12px;
              color: #16a34a;
              margin-left: auto;
              font-weight: 500;
            }
            
            .tool-indicator__content {
              border-top: 1px solid #e2e8f0;
              background: white;
            }
            
            .tool-indicator__special-card {
              border-top: 1px solid #e2e8f0;
              padding: 12px;
            }
            
            /* UI Action Cards */
            .ui-action-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
              margin-top: 12px;
            }
            
            .ui-action-card__header {
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 600;
              color: #334155;
              margin-bottom: 8px;
            }
            
            .ui-action-card__message {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 12px;
            }
            
            .ui-action-card__platforms {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            
            .ui-action-card__connect-btn {
              padding: 8px 16px;
              background: var(--primary-600);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            }
            
            .ui-action-card__connect-btn:hover {
              background: var(--primary-700);
            }
            
            .ui-action-card__title {
              font-size: 15px;
              font-weight: 500;
              color: #1e293b;
              margin-bottom: 8px;
            }
            
            .ui-action-card__meta {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            
            .ui-action-card__platform {
              font-size: 12px;
              color: #64748b;
              background: #f1f5f9;
              padding: 4px 8px;
              border-radius: 4px;
            }
            
            .ui-action-card__link {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 13px;
              color: var(--primary-600);
              text-decoration: none;
            }
            
            .ui-action-card__link:hover {
              text-decoration: underline;
            }
            
            .ui-action-card--success {
              border-color: #86efac;
              background: #f0fdf4;
            }
            
            .ui-action-card--error {
              border-color: #fca5a5;
              background: #fef2f2;
            }
            
            .ui-action-card__error {
              font-size: 13px;
              color: #dc2626;
            }
            
            /* Working Indicator */
            .working-indicator {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 12px 16px;
              background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
              border-radius: 16px;
              border: 1px solid var(--gray-200);
            }
            
            .working-indicator__dots {
              display: flex;
              gap: 4px;
            }
            
            .working-indicator__text {
              font-size: 14px;
              color: var(--gray-600);
              font-weight: 500;
            }
            
            /* Workflow Indicator */
            .workflow-indicator {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 14px;
              margin: 8px 0;
              background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
              border-radius: 10px;
              border: 1px solid #bae6fd;
              font-size: 13px;
            }
            
            .workflow-indicator__emoji {
              font-size: 16px;
            }
            
            .workflow-indicator__content {
              flex: 1;
            }
            
            .workflow-indicator__label {
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 600;
              color: #0369a1;
            }
            
            .workflow-indicator__description {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            
            /* Message Bubble */
            .message-bubble {
              display: flex;
              gap: 12px;
              align-items: flex-start;
            }
            
            .message-bubble--user {
              flex-direction: row-reverse;
            }
            
            .message-bubble__avatar {
              width: 36px;
              height: 36px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              overflow: hidden;
            }
            
            .message-bubble__avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            
            .message-bubble__content {
              max-width: 90%;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            
            .message-bubble--user .message-bubble__content {
              max-width: 70%;
            }
            
            .message-bubble__user-text {
              padding: 12px 16px;
              border-radius: 16px;
              background: var(--primary-600);
              color: white;
              font-size: 15px;
              line-height: 1.5;
              white-space: pre-wrap;
            }
            
            .message-bubble__assistant-box {
              padding: 16px 20px;
              border-radius: 16px;
              background: white;
              border: 1px solid var(--gray-200);
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            
            .message-bubble__tools {
              margin-bottom: 12px;
            }
            
            .message-bubble__text {
              font-size: 15px;
              line-height: 1.6;
              color: var(--gray-800);
            }
            
            .message-bubble__cursor {
              display: inline-block;
              width: 2px;
              height: 16px;
              background: var(--primary-600);
              margin-left: 2px;
              animation: blink 1s infinite;
              vertical-align: text-bottom;
            }
            
            .message-bubble__ui-actions {
              margin-top: 12px;
            }
            
            .message-bubble__streaming-dots {
              display: flex;
              gap: 4px;
              margin-top: 12px;
              padding-top: 8px;
              border-top: 1px solid var(--gray-100);
            }
            
            .chat-page__loading-messages {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              gap: 8px;
              color: var(--gray-500);
              font-size: 14px;
            }
          `}</style>
          </div>
        )}
      </div>
    </>
  )
}
