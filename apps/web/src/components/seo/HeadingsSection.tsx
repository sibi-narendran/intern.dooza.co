/**
 * HeadingsSection Component
 * 
 * Displays heading structure analysis with visual hierarchy.
 */

import { Heading1, Heading2, CheckCircle2, AlertTriangle } from 'lucide-react'
import ScoreGauge from './ScoreGauge'

interface HeadingsSectionProps {
  h1Count: number
  h1Texts: string[]
  h2Count: number
  h2Texts: string[]
  h3Count?: number
  h4Count?: number
  h5Count?: number
  h6Count?: number
  score: number
  issues: string[]
}

function HeadingCounter({ level, count }: { level: number; count: number }) {
  const isH1 = level === 1
  const hasIssue = isH1 && count !== 1
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: hasIssue ? '#fef2f2' : 'white',
      borderRadius: '8px',
      border: `1px solid ${hasIssue ? '#fecaca' : 'var(--gray-200)'}`,
    }}>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        background: hasIssue ? '#fee2e2' : 'var(--gray-100)',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 700,
        color: hasIssue ? '#dc2626' : 'var(--gray-700)',
      }}>
        H{level}
      </span>
      <span style={{
        fontSize: '20px',
        fontWeight: 700,
        color: hasIssue ? '#dc2626' : 'var(--gray-800)',
      }}>
        {count}
      </span>
      {isH1 && (
        count === 1 ? (
          <CheckCircle2 size={16} color="#22c55e" />
        ) : (
          <AlertTriangle size={16} color="#dc2626" />
        )
      )}
    </div>
  )
}

function HeadingText({ level, text }: { level: number; text: string }) {
  const sizes = {
    1: { fontSize: '16px', fontWeight: 700 },
    2: { fontSize: '14px', fontWeight: 600 },
    3: { fontSize: '13px', fontWeight: 500 },
  }
  
  const style = sizes[level as keyof typeof sizes] || sizes[3]
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '10px 12px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid var(--gray-200)',
    }}>
      <span style={{
        flexShrink: 0,
        padding: '2px 6px',
        background: level === 1 ? 'var(--primary-100)' : 'var(--gray-100)',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        color: level === 1 ? 'var(--primary-700)' : 'var(--gray-600)',
      }}>
        H{level}
      </span>
      <span style={{
        ...style,
        color: 'var(--gray-800)',
        lineHeight: 1.4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {text}
      </span>
    </div>
  )
}

export default function HeadingsSection({
  h1Count,
  h1Texts,
  h2Count,
  h2Texts,
  h3Count = 0,
  h4Count = 0,
  h5Count = 0,
  h6Count = 0,
  score,
  issues,
}: HeadingsSectionProps) {
  return (
    <div className="seo-headings-section">
      {/* Header with score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--gray-100)',
      }}>
        <div>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-800)',
            marginBottom: '4px',
          }}>
            Heading Structure
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
            H1-H6 hierarchy analysis
          </p>
        </div>
        <ScoreGauge score={score} size="sm" showLabel={false} />
      </div>
      
      {/* Heading counts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        marginBottom: '20px',
      }}>
        <HeadingCounter level={1} count={h1Count} />
        <HeadingCounter level={2} count={h2Count} />
        <HeadingCounter level={3} count={h3Count} />
        <HeadingCounter level={4} count={h4Count} />
        <HeadingCounter level={5} count={h5Count} />
        <HeadingCounter level={6} count={h6Count} />
      </div>
      
      {/* H1 Tags */}
      {h1Texts.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--gray-700)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Heading1 size={14} />
            H1 Headings
            {h1Count !== 1 && (
              <span style={{
                fontSize: '11px',
                color: '#dc2626',
                fontWeight: 500,
              }}>
                {h1Count === 0 ? '(missing!)' : '(should have exactly 1)'}
              </span>
            )}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {h1Texts.map((text, idx) => (
              <HeadingText key={idx} level={1} text={text} />
            ))}
          </div>
        </div>
      )}
      
      {/* H2 Tags */}
      {h2Texts.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--gray-700)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Heading2 size={14} />
            H2 Headings
            <span style={{
              fontSize: '11px',
              color: 'var(--gray-500)',
              fontWeight: 400,
            }}>
              (showing first {h2Texts.length})
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {h2Texts.map((text, idx) => (
              <HeadingText key={idx} level={2} text={text} />
            ))}
          </div>
        </div>
      )}
      
      {/* Issues */}
      {issues.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca',
        }}>
          <h4 style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#dc2626',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <AlertTriangle size={12} />
            Heading Issues
          </h4>
          <ul style={{
            margin: 0,
            paddingLeft: '16px',
            fontSize: '13px',
            color: '#991b1b',
          }}>
            {issues.map((issue, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
