/**
 * KeywordsSection Component
 * 
 * Displays keyword analysis with density visualization.
 */

import { TrendingUp, Hash } from 'lucide-react'
import type { KeywordItem } from '../../types/seo'

interface KeywordsSectionProps {
  keywords: KeywordItem[]
  wordCount: number
  maxDisplay?: number
}

function KeywordBar({ keyword, maxCount }: { keyword: KeywordItem; maxCount: number }) {
  const percentage = (keyword.count / maxCount) * 100
  
  // Determine density status
  let densityStatus: 'good' | 'high' | 'low'
  if (keyword.density >= 1 && keyword.density <= 3) {
    densityStatus = 'good'
  } else if (keyword.density > 3) {
    densityStatus = 'high'
  } else {
    densityStatus = 'low'
  }
  
  const densityColors = {
    good: { bar: '#22c55e', text: '#16a34a' },
    high: { bar: '#f97316', text: '#ea580c' },
    low: { bar: '#94a3b8', text: '#64748b' },
  }
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid var(--gray-200)',
    }}>
      {/* Keyword */}
      <div style={{
        width: '120px',
        flexShrink: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--gray-800)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {keyword.keyword}
      </div>
      
      {/* Bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: '8px',
          background: 'var(--gray-100)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: densityColors[densityStatus].bar,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
      
      {/* Count */}
      <div style={{
        width: '50px',
        flexShrink: 0,
        textAlign: 'right',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--gray-700)',
      }}>
        {keyword.count}×
      </div>
      
      {/* Density */}
      <div style={{
        width: '60px',
        flexShrink: 0,
        textAlign: 'right',
        fontSize: '12px',
        fontWeight: 500,
        color: densityColors[densityStatus].text,
        background: densityStatus === 'good' ? '#f0fdf4' : densityStatus === 'high' ? '#fff7ed' : 'var(--gray-50)',
        padding: '2px 8px',
        borderRadius: '4px',
      }}>
        {keyword.density}%
      </div>
    </div>
  )
}

export default function KeywordsSection({
  keywords,
  wordCount,
  maxDisplay = 10,
}: KeywordsSectionProps) {
  const displayKeywords = keywords.slice(0, maxDisplay)
  const maxCount = keywords.length > 0 ? Math.max(...keywords.map(k => k.count)) : 1
  
  return (
    <div className="seo-keywords-section">
      {/* Header */}
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
            Keyword Analysis
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
            Top keywords extracted from content
          </p>
        </div>
        
        {/* Word count badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          background: 'var(--gray-50)',
          borderRadius: '8px',
          border: '1px solid var(--gray-200)',
        }}>
          <Hash size={14} color="var(--gray-500)" />
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--gray-700)',
          }}>
            {wordCount.toLocaleString()}
          </span>
          <span style={{
            fontSize: '12px',
            color: 'var(--gray-500)',
          }}>
            words
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '11px',
        color: 'var(--gray-500)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
          1-3% density (optimal)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f97316' }} />
          {">"} 3% (may be over-optimized)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#94a3b8' }} />
          {"<"} 1% (low density)
        </div>
      </div>
      
      {/* Keywords list */}
      {displayKeywords.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayKeywords.map((keyword, idx) => (
            <KeywordBar key={idx} keyword={keyword} maxCount={maxCount} />
          ))}
          
          {keywords.length > maxDisplay && (
            <div style={{
              textAlign: 'center',
              padding: '8px',
              fontSize: '13px',
              color: 'var(--gray-500)',
            }}>
              +{keywords.length - maxDisplay} more keywords
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--gray-500)',
          background: 'var(--gray-50)',
          borderRadius: '8px',
        }}>
          No keywords extracted
        </div>
      )}
      
      {/* Tip */}
      <div style={{
        marginTop: '16px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, var(--primary-50), white)',
        borderRadius: '8px',
        border: '1px solid var(--primary-100)',
        fontSize: '13px',
        color: 'var(--gray-600)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <TrendingUp size={16} color="var(--primary-600)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong style={{ color: 'var(--primary-700)' }}>Tip:</strong> Aim for 1-3% keyword density for your target keywords. 
          Ensure they appear naturally in headings, meta description, and body content.
        </span>
      </div>
    </div>
  )
}
