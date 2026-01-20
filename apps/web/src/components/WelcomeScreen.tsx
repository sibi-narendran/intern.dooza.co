/**
 * Welcome Screen Component
 * 
 * ChatGPT-style welcome screen for chat interface.
 * Displays agent avatar, greeting, and clickable suggestion prompts.
 */

import { Sparkles } from 'lucide-react'
import { GalleryAgent } from '../lib/agent-api'
import { getPromptsForAgent } from '../config/agent-prompts'

interface WelcomeScreenProps {
  agent: GalleryAgent | null
  onSuggestionClick: (prompt: string) => void
}

export default function WelcomeScreen({ agent, onSuggestionClick }: WelcomeScreenProps) {
  // Future: Use agent.suggested_prompts from backend when available
  const prompts = getPromptsForAgent(agent?.slug)

  return (
    <div className="chat-welcome">
      {/* Agent avatar */}
      <div 
        className="chat-welcome__avatar" 
        style={{
          background: agent?.gradient || 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        }}
      >
        {agent?.avatar_url ? (
          <img 
            src={agent.avatar_url} 
            alt={agent.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Sparkles size={32} color="white" />
        )}
      </div>
      
      {/* Greeting */}
      <h1 className="chat-welcome__greeting">
        How can I help you today?
      </h1>
      
      {/* Suggestion prompts */}
      <div className="chat-welcome__suggestions">
        {prompts.map((prompt, idx) => (
          <button
            key={idx}
            className="chat-welcome__suggestion"
            onClick={() => onSuggestionClick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
