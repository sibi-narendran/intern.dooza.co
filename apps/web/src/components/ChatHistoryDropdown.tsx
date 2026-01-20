/**
 * Chat History Dropdown
 * 
 * A dropdown component that shows past conversations for an agent.
 * Users can click to load a previous conversation or start a new one.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, Loader2, MessageSquare, Plus, ChevronDown } from 'lucide-react'
import { listThreads, type ThreadSummary } from '../lib/chat-api'

// ============================================================================
// Types
// ============================================================================

interface ChatHistoryDropdownProps {
  agentSlug: string
  currentThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  disabled?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a date as relative time (e.g., "2h ago", "Yesterday")
 */
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
  
  // For older dates, show the date
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// Component
// ============================================================================

export default function ChatHistoryDropdown({
  agentSlug,
  currentThreadId,
  onSelectThread,
  onNewChat,
  disabled = false,
}: ChatHistoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Fetch threads when dropdown opens
  const fetchThreads = useCallback(async () => {
    if (!agentSlug) return
    
    setLoading(true)
    try {
      const result = await listThreads(agentSlug)
      setThreads(result.threads)
      setHasLoaded(true)
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    } finally {
      setLoading(false)
    }
  }, [agentSlug])
  
  // Fetch on open
  useEffect(() => {
    if (isOpen && !hasLoaded) {
      fetchThreads()
    }
  }, [isOpen, hasLoaded, fetchThreads])
  
  // Re-fetch when dropdown opens (to get latest)
  useEffect(() => {
    if (isOpen) {
      fetchThreads()
    }
  }, [isOpen, fetchThreads])
  
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])
  
  const handleSelectThread = (threadId: string) => {
    onSelectThread(threadId)
    setIsOpen(false)
  }
  
  const handleNewChat = () => {
    onNewChat()
    setIsOpen(false)
  }
  
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* History button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: isOpen ? 'var(--gray-100)' : 'white',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--gray-700)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <Clock size={16} />
          History
          <ChevronDown 
            size={14} 
            style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }} 
          />
        </button>
        
        {/* New Chat button */}
        <button
          onClick={handleNewChat}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: 'var(--primary-600)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>
      
      {/* Dropdown panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '320px',
          maxHeight: '400px',
          background: 'white',
          border: '1px solid var(--gray-200)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden',
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--gray-100)',
            background: 'var(--gray-50)',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--gray-600)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Recent Conversations
            </h3>
          </div>
          
          {/* Content */}
          <div style={{
            maxHeight: '340px',
            overflowY: 'auto',
          }}>
            {loading && !hasLoaded ? (
              // Loading state
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                gap: '8px',
                color: 'var(--gray-500)',
              }}>
                <Loader2 size={18} className="animate-spin" />
                <span style={{ fontSize: '14px' }}>Loading...</span>
              </div>
            ) : threads.length === 0 ? (
              // Empty state
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--gray-500)',
              }}>
                <MessageSquare 
                  size={32} 
                  style={{ 
                    margin: '0 auto 12px',
                    opacity: 0.5,
                  }} 
                />
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                  No conversations yet
                </p>
                <p style={{ 
                  margin: '4px 0 0', 
                  fontSize: '13px',
                  color: 'var(--gray-400)',
                }}>
                  Start a new chat to begin
                </p>
              </div>
            ) : (
              // Thread list
              <div>
                {threads.map((thread) => {
                  const isCurrent = thread.thread_id === currentThreadId
                  
                  return (
                    <button
                      key={thread.thread_id}
                      onClick={() => handleSelectThread(thread.thread_id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 16px',
                        background: isCurrent ? 'var(--primary-50)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--gray-100)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.background = 'var(--gray-50)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isCurrent ? 'var(--primary-50)' : 'transparent'
                      }}
                    >
                      {/* Title */}
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: isCurrent ? 'var(--primary-700)' : 'var(--gray-800)',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {thread.title}
                      </div>
                      
                      {/* Meta */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--gray-500)',
                      }}>
                        <span>{formatRelativeTime(thread.updated_at)}</span>
                        <span>•</span>
                        <span>{thread.message_count} messages</span>
                        {isCurrent && (
                          <>
                            <span>•</span>
                            <span style={{ 
                              color: 'var(--primary-600)',
                              fontWeight: 500,
                            }}>
                              Current
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
                
                {/* Loading more indicator */}
                {loading && hasLoaded && (
                  <div style={{
                    padding: '12px',
                    textAlign: 'center',
                    color: 'var(--gray-400)',
                    fontSize: '12px',
                  }}>
                    <Loader2 size={14} className="animate-spin" style={{ display: 'inline-block' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Animation styles */}
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
