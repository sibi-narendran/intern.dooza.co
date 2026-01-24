/**
 * ToolInvocationCard - Collapsible card for displaying tool calls
 *
 * Shows tool name, status, input preview, and expandable results.
 * Uses DynamicToolRenderer for rich result display.
 *
 * Uses Vercel AI SDK's ToolInvocation type for full compatibility.
 */

import { useState } from 'react'
import { Loader2, CheckCircle, ChevronDown } from 'lucide-react'
import type { ToolInvocation } from 'ai'
import { formatToolName } from '../../lib/chat-api'
import DynamicToolRenderer from '../tools/DynamicToolRenderer'

interface ToolInvocationCardProps {
  tool: ToolInvocation
}

/**
 * Extract a preview string from tool arguments
 * Prioritizes common parameter names that are user-meaningful
 */
function getInputPreview(args: Record<string, unknown>): string | null {
  if (!args || typeof args !== 'object') return null

  // Priority list of keys to show as preview
  const previewKeys = ['url', 'query', 'search', 'text', 'message', 'input', 'prompt', 'path', 'filename', 'name']

  for (const key of previewKeys) {
    const value = args[key]
    if (typeof value === 'string' && value.length > 0) {
      // Truncate long values
      return value.length > 60 ? value.substring(0, 57) + '...' : value
    }
  }

  // Fallback: show first string value found
  for (const [, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > 0) {
      return value.length > 60 ? value.substring(0, 57) + '...' : value
    }
  }

  return null
}

export default function ToolInvocationCard({ tool }: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isRunning = tool.state === 'call' || tool.state === 'partial-call'
  const hasResult = tool.state === 'result' && tool.result !== undefined

  // Extract key input for preview
  const inputPreview = getInputPreview(tool.args)

  const handleHeaderClick = () => {
    if (hasResult) {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className={`tool-card tool-card--${tool.state}`}>
      <div
        className={`tool-card__header ${hasResult ? 'tool-card__header--clickable' : ''}`}
        onClick={handleHeaderClick}
      >
        <div className="tool-card__status">
          {isRunning ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle size={18} />
          )}
        </div>

        <div className="tool-card__info">
          <span className="tool-card__name">
            {isRunning ? `${formatToolName(tool.toolName)}...` : formatToolName(tool.toolName)}
          </span>
          {inputPreview && (
            <span className="tool-card__input">{inputPreview}</span>
          )}
        </div>

        {hasResult && (
          <ChevronDown
            size={18}
            className={`tool-card__expand ${isExpanded ? 'tool-card__expand--open' : ''}`}
          />
        )}
      </div>

      {isExpanded && hasResult && (
        <div className="tool-card__result">
          <DynamicToolRenderer
            data={tool.result}
            schema={null}
          />
        </div>
      )}
    </div>
  )
}
