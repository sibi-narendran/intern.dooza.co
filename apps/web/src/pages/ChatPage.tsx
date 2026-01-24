/**
 * ChatPage - Beautiful agent chat interface
 *
 * Features:
 * - Two-column layout with AgentPanel sidebar
 * - Welcome screen with suggestion prompts
 * - Rich markdown rendering
 * - Tool execution indicators
 * - Workspace toggle support
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Square, Bot, User } from 'lucide-react'
import { useAgentChat } from '../hooks/useAgentChat'
import AgentPanel from '../components/AgentPanel'
import WorkspaceEmbed from '../components/workspace/WorkspaceEmbed'
import WelcomeScreen from '../components/WelcomeScreen'
import MarkdownRenderer from '../components/MarkdownRenderer'
import ToolInvocationCard from '../components/chat/ToolInvocationCard'
import { getAgentDetails, type GalleryAgent } from '../lib/agent-api'
import { loadThreadMessages } from '../lib/chat-api'

export default function ChatPage() {
  const { agentSlug } = useParams<{ agentSlug: string }>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Agent and workspace state
  const [agent, setAgent] = useState<GalleryAgent | null>(null)
  const [showWorkspace, setShowWorkspace] = useState(false)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    threadId,
    newChat,
    setMessages,
    loadThread,
    append,
  } = useAgentChat(agentSlug || '')

  // Load agent details
  useEffect(() => {
    async function loadAgent() {
      if (!agentSlug) return
      const agentData = await getAgentDetails(agentSlug)
      setAgent(agentData)
    }
    loadAgent()
  }, [agentSlug])

  // Load thread messages when selecting from history
  const handleSelectThread = useCallback(async (selectedThreadId: string) => {
    if (!agentSlug) return

    // Backend returns AI SDK format - use directly
    const messages = await loadThreadMessages(agentSlug, selectedThreadId)
    setMessages(messages)
    loadThread(selectedThreadId)
  }, [agentSlug, setMessages, loadThread])

  // Handle new chat
  const handleNewChat = useCallback(() => {
    newChat()
    setShowWorkspace(false)
  }, [newChat])

  // Toggle workspace view
  const handleWorkspaceToggle = useCallback(() => {
    setShowWorkspace(prev => !prev)
  }, [])

  // Handle suggestion click from welcome screen
  const handleSuggestionClick = useCallback((prompt: string) => {
    append({ role: 'user', content: prompt })
  }, [append])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-focus input
  useEffect(() => {
    if (!showWorkspace) {
      inputRef.current?.focus()
    }
  }, [showWorkspace])

  // Handle textarea auto-resize
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }
    }
  }

  return (
    <div className="chat-layout">
      {/* Agent Sidebar */}
      <AgentPanel
        agent={agent}
        agentSlug={agentSlug || ''}
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onWorkspaceToggle={handleWorkspaceToggle}
        showWorkspace={showWorkspace}
        isStreaming={isLoading}
      />

      {/* Main Content Area */}
      <div className="chat-layout__content">
        {showWorkspace ? (
          <WorkspaceEmbed
            agentSlug={agentSlug || ''}
            onBackToChat={() => setShowWorkspace(false)}
          />
        ) : (
          <div className="chat-main">
            {/* Messages Area */}
            <div className="chat-main__messages">
              {messages.length === 0 ? (
                <WelcomeScreen
                  agent={agent}
                  onSuggestionClick={handleSuggestionClick}
                />
              ) : (
                <div className="chat-main__thread">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message chat-message--${msg.role}`}>
                      {/* Avatar */}
                      <div className="chat-message__avatar">
                        {msg.role === 'user' ? (
                          <User size={18} />
                        ) : agent?.avatar_url ? (
                          <img src={agent.avatar_url} alt={agent.name} />
                        ) : (
                          <Bot size={18} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="chat-message__body">
                        {/* Role label */}
                        <div className="chat-message__role">
                          {msg.role === 'user' ? 'You' : agent?.name || 'Assistant'}
                        </div>

                        {/* Tool invocations */}
                        {msg.role === 'assistant' && msg.toolInvocations && msg.toolInvocations.length > 0 && (
                          <div className="chat-tools">
                            {msg.toolInvocations.map((tool) => (
                              <ToolInvocationCard
                                key={tool.toolCallId}
                                tool={tool}
                              />
                            ))}
                          </div>
                        )}

                        {/* Message content */}
                        {msg.content && (
                          <div className="chat-message__content">
                            {msg.role === 'user' ? (
                              <p>{msg.content}</p>
                            ) : (
                              <MarkdownRenderer content={msg.content} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="chat-message chat-message--assistant">
                      <div className="chat-message__avatar">
                        {agent?.avatar_url ? (
                          <img src={agent.avatar_url} alt={agent.name} />
                        ) : (
                          <Bot size={18} />
                        )}
                      </div>
                      <div className="chat-message__body">
                        <div className="chat-message__role">{agent?.name || 'Assistant'}</div>
                        <div className="chat-typing">
                          <span className="chat-typing__dot" />
                          <span className="chat-typing__dot" />
                          <span className="chat-typing__dot" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="chat-main__input">
              <form onSubmit={handleSubmit} className="chat-input">
                <div className="chat-input__wrapper">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={onKeyDown}
                    placeholder={`Message ${agent?.name || 'assistant'}...`}
                    rows={1}
                    disabled={isLoading}
                    className="chat-input__textarea"
                  />
                  <div className="chat-input__actions">
                    {isLoading ? (
                      <button
                        type="button"
                        onClick={stop}
                        className="chat-input__btn chat-input__btn--stop"
                        title="Stop generating"
                      >
                        <Square size={18} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="chat-input__btn chat-input__btn--send"
                        title="Send message"
                      >
                        <Send size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="chat-input__hint">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
