/**
 * MarkdownRenderer
 * 
 * Renders markdown content with rich formatting for chat messages.
 * Optimized for SEO analysis output with:
 * - Proper heading hierarchy
 * - Score visualizations
 * - Issue lists with indicators
 * - Code blocks for technical content
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

// Score badge component for inline score detection
function ScoreBadge({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return { bg: '#dcfce7', text: '#166534', border: '#86efac' }
    if (s >= 60) return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }
    if (s >= 40) return { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' }
    return { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' }
  }
  
  const colors = getScoreColor(score)
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '20px',
      background: colors.bg,
      color: colors.text,
      fontWeight: 600,
      fontSize: '14px',
      border: `1px solid ${colors.border}`,
    }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: colors.text,
      }} />
      {score}/100
    </span>
  )
}

// Custom components for markdown rendering
const markdownComponents: Components = {
  // Headings with proper visual hierarchy
  h1: ({ children }) => (
    <h1 style={{
      fontSize: '20px',
      fontWeight: 700,
      color: 'var(--gray-900)',
      marginTop: '24px',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '2px solid var(--primary-200)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      {children}
    </h1>
  ),
  
  h2: ({ children }) => (
    <h2 style={{
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--gray-800)',
      marginTop: '20px',
      marginBottom: '12px',
    }}>
      {children}
    </h2>
  ),
  
  h3: ({ children }) => (
    <h3 style={{
      fontSize: '15px',
      fontWeight: 600,
      color: 'var(--gray-700)',
      marginTop: '16px',
      marginBottom: '8px',
    }}>
      {children}
    </h3>
  ),
  
  // Paragraphs
  p: ({ children }) => (
    <p style={{ margin: '12px 0', lineHeight: 1.6 }}>
      {children}
    </p>
  ),
  
  // Strong/Bold text - detect scores
  strong: ({ children }) => {
    const text = String(children)
    
    // Check for score patterns
    const scoreMatch = text.match(/(?:Score|score):\s*(\d+)\/100/)
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1], 10)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontWeight: 600, color: 'var(--gray-800)' }}>Score:</strong>
          <ScoreBadge score={score} />
        </span>
      )
    }
    
    // Check for "Overall Score" pattern
    const overallMatch = text.match(/(?:Overall Score):\s*(\d+)\/100/)
    if (overallMatch) {
      const score = parseInt(overallMatch[1], 10)
      return (
        <span style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, var(--gray-50), white)',
          borderRadius: '12px',
          border: '1px solid var(--gray-200)',
          marginTop: '12px',
          marginBottom: '12px',
        }}>
          <strong style={{ fontWeight: 600, color: 'var(--gray-700)', fontSize: '15px' }}>
            Overall Score
          </strong>
          <ScoreBadge score={score} />
        </span>
      )
    }
    
    return (
      <strong style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
        {children}
      </strong>
    )
  },
  
  // Lists
  ul: ({ children }) => (
    <ul style={{
      margin: '12px 0',
      paddingLeft: '20px',
      listStyle: 'disc',
    }}>
      {children}
    </ul>
  ),
  
  ol: ({ children }) => (
    <ol style={{
      margin: '12px 0',
      paddingLeft: '20px',
      listStylePosition: 'outside',
    }}>
      {children}
    </ol>
  ),
  
  li: ({ children }) => (
    <li style={{
      marginBottom: '6px',
      lineHeight: 1.6,
      color: 'var(--gray-700)',
    }}>
      {children}
    </li>
  ),
  
  // Code blocks (for technical SEO info)
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-')
    
    if (isBlock) {
      return (
        <code style={{
          display: 'block',
          padding: '16px',
          background: 'var(--gray-900)',
          color: '#e5e7eb',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: "'JetBrains Mono', monospace",
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {children}
        </code>
      )
    }
    
    return (
      <code style={{
        padding: '2px 6px',
        background: 'var(--gray-100)',
        color: 'var(--primary-700)',
        borderRadius: '4px',
        fontSize: '13px',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {children}
      </code>
    )
  },
  
  pre: ({ children }) => (
    <pre style={{
      margin: '16px 0',
      overflow: 'visible',
    }}>
      {children}
    </pre>
  ),
  
  // Blockquotes for tips/notes
  blockquote: ({ children }) => (
    <blockquote style={{
      margin: '16px 0',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, var(--primary-50), white)',
      borderLeft: '4px solid var(--primary-500)',
      borderRadius: '0 8px 8px 0',
      color: 'var(--gray-700)',
      fontStyle: 'normal',
    }}>
      {children}
    </blockquote>
  ),
  
  // Tables for structured data
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
      }}>
        {children}
      </table>
    </div>
  ),
  
  thead: ({ children }) => (
    <thead style={{
      background: 'var(--gray-100)',
    }}>
      {children}
    </thead>
  ),
  
  th: ({ children }) => (
    <th style={{
      padding: '10px 12px',
      textAlign: 'left',
      fontWeight: 600,
      color: 'var(--gray-700)',
      borderBottom: '2px solid var(--gray-200)',
    }}>
      {children}
    </th>
  ),
  
  td: ({ children }) => (
    <td style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--gray-100)',
      color: 'var(--gray-600)',
    }}>
      {children}
    </td>
  ),
  
  // Horizontal rule
  hr: () => (
    <hr style={{
      margin: '20px 0',
      border: 'none',
      height: '1px',
      background: 'linear-gradient(90deg, transparent, var(--gray-300), transparent)',
    }} />
  ),
  
  // Links
  a: ({ href, children }) => (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--primary-600)',
        textDecoration: 'none',
        borderBottom: '1px solid var(--primary-300)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </a>
  ),
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return null
  }
  
  return (
    <div className={className} style={{
      fontSize: '15px',
      lineHeight: 1.6,
      color: 'var(--gray-700)',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
