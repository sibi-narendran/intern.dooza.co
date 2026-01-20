/**
 * IssuesList Renderer
 * 
 * Displays a list of issues/warnings with priority indicators.
 * Used for audit results with actionable items.
 */

import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { 
  ToolUISchema, 
  getNestedValue,
} from '../../types/tool-ui'

interface IssuesListProps {
  data: unknown
  schema: ToolUISchema
}

type Priority = 'high' | 'medium' | 'low'

/**
 * Determine issue priority from message content.
 */
function getIssuePriority(issue: string): Priority {
  const lowerIssue = issue.toLowerCase()
  
  // High priority indicators
  if (
    lowerIssue.includes('missing title') ||
    lowerIssue.includes('missing meta description') ||
    lowerIssue.includes('no h1') ||
    lowerIssue.includes('multiple h1') ||
    lowerIssue.includes('missing')
  ) {
    return 'high'
  }
  
  // Medium priority indicators
  if (
    lowerIssue.includes('too short') ||
    lowerIssue.includes('too long') ||
    lowerIssue.includes('missing og:') ||
    lowerIssue.includes('missing canonical') ||
    lowerIssue.includes('empty')
  ) {
    return 'medium'
  }
  
  return 'low'
}

const priorityConfig = {
  high: {
    icon: AlertCircle,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
  medium: {
    icon: AlertTriangle,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  low: {
    icon: Info,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
}

export default function IssuesList({ data, schema }: IssuesListProps) {
  const fields = schema.fields || []
  
  // Find the issues array
  const issuesField = fields.find(f => {
    const value = getNestedValue(data, f.path)
    return Array.isArray(value)
  })
  
  const issues = issuesField 
    ? (getNestedValue(data, issuesField.path) as string[]) 
    : []
  
  if (!issues || issues.length === 0) {
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#f0fdf4',
        borderRadius: '8px',
      }}>
        <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
        <div>
          <p style={{ 
            margin: 0, 
            fontWeight: 600, 
            color: '#166534',
            fontSize: '14px',
          }}>
            No issues found
          </p>
          <p style={{ 
            margin: '4px 0 0 0', 
            color: '#15803d',
            fontSize: '13px',
          }}>
            Everything looks good!
          </p>
        </div>
      </div>
    )
  }
  
  // Sort issues by priority
  const sortedIssues = [...issues].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[getIssuePriority(a)] - priorityOrder[getIssuePriority(b)]
  })
  
  return (
    <div style={{ padding: '16px' }}>
      {schema.title && (
        <h4 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--gray-700)',
          marginBottom: '12px',
          margin: '0 0 12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {schema.title}
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'white',
            background: issues.length > 0 ? '#dc2626' : '#16a34a',
            padding: '2px 8px',
            borderRadius: '10px',
          }}>
            {issues.length}
          </span>
        </h4>
      )}
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {sortedIssues.map((issue, idx) => {
          const priority = getIssuePriority(issue)
          const config = priorityConfig[priority]
          const Icon = config.icon
          
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                background: config.bg,
                border: `1px solid ${config.border}`,
                borderRadius: '8px',
              }}
            >
              <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: '1px' }} />
              <span style={{
                fontSize: '13px',
                color: 'var(--gray-800)',
                lineHeight: '1.5',
              }}>
                {issue}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
