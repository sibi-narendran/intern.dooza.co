/**
 * IssuesList Component
 * 
 * Displays SEO issues with priority indicators and clear actionable text.
 */

import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { Priority, getIssuePriority } from '../../types/seo'

interface IssuesListProps {
  issues: string[]
  title?: string
  maxItems?: number
  showEmpty?: boolean
  emptyMessage?: string
}

const priorityConfig = {
  high: {
    icon: AlertCircle,
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#dc2626',
    label: 'High',
  },
  medium: {
    icon: AlertTriangle,
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#d97706',
    label: 'Medium',
  },
  low: {
    icon: Info,
    bg: '#f0fdf4',
    border: '#bbf7d0',
    text: '#16a34a',
    label: 'Low',
  },
}

interface IssueItemProps {
  issue: string
  priority: Priority
}

function IssueItem({ issue, priority }: IssueItemProps) {
  const config = priorityConfig[priority]
  const Icon = config.icon
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '12px 16px',
      background: config.bg,
      borderRadius: '10px',
      border: `1px solid ${config.border}`,
    }}>
      <div style={{
        flexShrink: 0,
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}>
        <Icon size={16} color={config.text} />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          color: 'var(--gray-800)',
          lineHeight: 1.5,
        }}>
          {issue}
        </div>
      </div>
      
      <span style={{
        flexShrink: 0,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'white',
        color: config.text,
        border: `1px solid ${config.border}`,
      }}>
        {config.label}
      </span>
    </div>
  )
}

export default function IssuesList({
  issues,
  title = 'Issues Found',
  maxItems,
  showEmpty = true,
  emptyMessage = 'No issues found! Great job.',
}: IssuesListProps) {
  // Sort issues by priority
  const sortedIssues = [...issues].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[getIssuePriority(a)] - priorityOrder[getIssuePriority(b)]
  })
  
  const displayIssues = maxItems ? sortedIssues.slice(0, maxItems) : sortedIssues
  const hasMore = maxItems && sortedIssues.length > maxItems
  
  if (issues.length === 0 && !showEmpty) {
    return null
  }
  
  return (
    <div className="seo-issues-list">
      {title && (
        <h4 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--gray-700)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {title}
          <span style={{
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 500,
            background: issues.length > 0 ? '#fef2f2' : '#f0fdf4',
            color: issues.length > 0 ? '#dc2626' : '#16a34a',
          }}>
            {issues.length}
          </span>
        </h4>
      )}
      
      {issues.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
        }}>
          <CheckCircle2 size={20} color="#16a34a" />
          <span style={{ color: '#166534', fontWeight: 500 }}>{emptyMessage}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayIssues.map((issue, idx) => (
            <IssueItem 
              key={idx} 
              issue={issue} 
              priority={getIssuePriority(issue)} 
            />
          ))}
          
          {hasMore && maxItems && (
            <div style={{
              textAlign: 'center',
              padding: '8px',
              fontSize: '13px',
              color: 'var(--gray-500)',
            }}>
              +{sortedIssues.length - maxItems} more issues
            </div>
          )}
        </div>
      )}
    </div>
  )
}
