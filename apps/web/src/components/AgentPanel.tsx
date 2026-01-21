/**
 * Agent Panel
 * 
 * Clean, simple left panel for chat pages
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, MessageSquare, Loader2, Layers, Construction } from 'lucide-react'
import { GalleryAgent } from '../lib/agent-api'
import { listThreads, type ThreadSummary } from '../lib/chat-api'

// Agents that have workspace/calendar support
const WORKSPACE_ENABLED_AGENTS = new Set(['soshie'])

interface AgentPanelProps {
  agent: GalleryAgent | null
  agentSlug: string
  currentThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onWorkspaceToggle?: () => void
  showWorkspace?: boolean
  isStreaming?: boolean
}

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AgentPanel({
  agent,
  agentSlug,
  currentThreadId,
  onSelectThread,
  onNewChat,
  onWorkspaceToggle,
  showWorkspace = false,
  isStreaming = false,
}: AgentPanelProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchThreads = useCallback(async () => {
    if (!agentSlug) return
    
    try {
      const result = await listThreads(agentSlug, 20, 0)
      setThreads(result.threads)
      setHasLoaded(true)
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    } finally {
      setLoading(false)
    }
  }, [agentSlug])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    if (currentThreadId && hasLoaded) {
      fetchThreads()
    }
  }, [currentThreadId, hasLoaded, fetchThreads])

  return (
    <aside className="agent-panel">
      {/* Header */}
      <div className="agent-panel__header">
        <div 
          className="agent-panel__avatar"
          style={{ background: agent?.gradient || 'var(--primary-600)' }}
        >
          {agent?.avatar_url && (
            <img src={agent.avatar_url} alt={agent?.name || 'Agent'} />
          )}
        </div>
        
        <h2 className="agent-panel__name">{agent?.name || 'Agent'}</h2>
        <p className="agent-panel__role">{agent?.role || 'AI Assistant'}</p>

        {/* Action Buttons */}
        <div className="agent-panel__buttons">
          {WORKSPACE_ENABLED_AGENTS.has(agentSlug) ? (
            <button 
              onClick={onWorkspaceToggle}
              className={`agent-panel__btn agent-panel__btn--secondary ${showWorkspace ? 'agent-panel__btn--active' : ''}`}
            >
              <Layers size={16} />
              Workspace
            </button>
          ) : (
            <span 
              className="agent-panel__btn agent-panel__btn--secondary agent-panel__btn--disabled"
              title="Coming soon"
            >
              <Construction size={16} />
              Work in progress
            </span>
          )}
        </div>

        <button
          onClick={onNewChat}
          disabled={isStreaming}
          className="agent-panel__btn agent-panel__btn--primary"
        >
          <Plus size={16} />
          New chat
        </button>
      </div>

      {/* Recents */}
      <div className="agent-panel__recents">
        <h3 className="agent-panel__recents-title">Recents</h3>
        
        <div className="agent-panel__recents-list">
          {loading && !hasLoaded ? (
            <div className="agent-panel__empty">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="agent-panel__empty">
              <MessageSquare size={20} />
              <span>No conversations yet</span>
            </div>
          ) : (
            threads.map((thread) => {
              const isCurrent = thread.thread_id === currentThreadId
              return (
                <button
                  key={thread.thread_id}
                  onClick={() => onSelectThread(thread.thread_id)}
                  className={`agent-panel__thread ${isCurrent ? 'agent-panel__thread--active' : ''}`}
                  disabled={isStreaming}
                >
                  <span className="agent-panel__thread-title">{thread.title}</span>
                  <span className="agent-panel__thread-time">{formatRelativeTime(thread.updated_at)}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </aside>
  )
}
