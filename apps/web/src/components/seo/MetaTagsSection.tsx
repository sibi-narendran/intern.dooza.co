/**
 * MetaTagsSection Component
 * 
 * Displays meta tags analysis with visual length indicators.
 */

import { FileText, Image, Link2, CheckCircle2, XCircle } from 'lucide-react'
import ScoreGauge from './ScoreGauge'

interface MetaTagsSectionProps {
  title: string | null
  titleLength: number
  description: string | null
  descriptionLength: number
  canonical: string | null
  ogTags: Record<string, string | undefined>
  score: number
}

// Optimal length ranges
const TITLE_MIN = 30
const TITLE_MAX = 60
const DESC_MIN = 120
const DESC_MAX = 160

function LengthIndicator({ 
  current, 
  min, 
  max, 
  label 
}: { 
  current: number
  min: number
  max: number
  label: string
}) {
  const isOptimal = current >= min && current <= max
  const isTooShort = current < min
  
  const percentage = Math.min((current / max) * 100, 100)
  
  let status: 'good' | 'warning' | 'error'
  let statusText: string
  
  if (isOptimal) {
    status = 'good'
    statusText = 'Optimal length'
  } else if (isTooShort) {
    status = 'warning'
    statusText = `${min - current} more characters needed`
  } else {
    status = 'error'
    statusText = `${current - max} characters over limit`
  }
  
  const colors = {
    good: { bar: '#22c55e', text: '#16a34a' },
    warning: { bar: '#eab308', text: '#ca8a04' },
    error: { bar: '#ef4444', text: '#dc2626' },
  }
  
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
          {label}: {current} characters
        </span>
        <span style={{ 
          fontSize: '11px', 
          color: colors[status].text,
          fontWeight: 500,
        }}>
          {statusText}
        </span>
      </div>
      
      <div style={{
        height: '6px',
        background: 'var(--gray-100)',
        borderRadius: '3px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Optimal range indicator */}
        <div style={{
          position: 'absolute',
          left: `${(min / max) * 100}%`,
          width: `${((max - min) / max) * 100}%`,
          height: '100%',
          background: 'rgba(34, 197, 94, 0.2)',
        }} />
        
        {/* Current progress */}
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: colors[status].bar,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '2px',
        fontSize: '10px',
        color: 'var(--gray-400)',
      }}>
        <span>0</span>
        <span>{min}-{max} optimal</span>
        <span>{max}+</span>
      </div>
    </div>
  )
}

function TagDisplay({ 
  label, 
  value, 
  icon: Icon,
  truncate = false,
}: { 
  label: string
  value: string | null
  icon: React.ElementType
  truncate?: boolean
}) {
  const hasValue = value && value.trim().length > 0
  
  return (
    <div style={{
      padding: '12px 16px',
      background: hasValue ? 'white' : '#fef2f2',
      borderRadius: '8px',
      border: `1px solid ${hasValue ? 'var(--gray-200)' : '#fecaca'}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <Icon size={14} color={hasValue ? 'var(--gray-500)' : '#dc2626'} />
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--gray-600)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {label}
        </span>
        {hasValue ? (
          <CheckCircle2 size={14} color="#22c55e" style={{ marginLeft: 'auto' }} />
        ) : (
          <XCircle size={14} color="#dc2626" style={{ marginLeft: 'auto' }} />
        )}
      </div>
      
      <div style={{
        fontSize: '14px',
        color: hasValue ? 'var(--gray-800)' : '#dc2626',
        fontStyle: hasValue ? 'normal' : 'italic',
        overflow: truncate ? 'hidden' : 'visible',
        textOverflow: truncate ? 'ellipsis' : 'clip',
        whiteSpace: truncate ? 'nowrap' : 'normal',
        lineHeight: 1.5,
      }}>
        {hasValue ? value : 'Not found'}
      </div>
    </div>
  )
}

export default function MetaTagsSection({
  title,
  titleLength,
  description,
  descriptionLength,
  canonical,
  ogTags,
  score,
}: MetaTagsSectionProps) {
  const hasOgImage = ogTags.image && ogTags.image.trim().length > 0
  const hasOgTitle = ogTags.title && ogTags.title.trim().length > 0
  const hasOgDesc = ogTags.description && ogTags.description.trim().length > 0
  
  return (
    <div className="seo-meta-tags-section">
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
            Meta Tags
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
            Title, description, and Open Graph tags
          </p>
        </div>
        <ScoreGauge score={score} size="sm" showLabel={false} />
      </div>
      
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <TagDisplay label="Title" value={title} icon={FileText} />
        {title && (
          <LengthIndicator 
            current={titleLength} 
            min={TITLE_MIN} 
            max={TITLE_MAX}
            label="Title length"
          />
        )}
      </div>
      
      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <TagDisplay label="Meta Description" value={description} icon={FileText} />
        {description && (
          <LengthIndicator 
            current={descriptionLength} 
            min={DESC_MIN} 
            max={DESC_MAX}
            label="Description length"
          />
        )}
      </div>
      
      {/* Canonical */}
      <div style={{ marginBottom: '20px' }}>
        <TagDisplay label="Canonical URL" value={canonical} icon={Link2} truncate />
      </div>
      
      {/* Open Graph */}
      <div style={{
        padding: '16px',
        background: 'var(--gray-50)',
        borderRadius: '12px',
      }}>
        <h4 style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--gray-700)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Image size={14} />
          Open Graph Tags
        </h4>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}>
          {[
            { label: 'og:title', has: hasOgTitle },
            { label: 'og:description', has: hasOgDesc },
            { label: 'og:image', has: hasOgImage },
          ].map(({ label, has }) => (
            <div 
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: 'white',
                borderRadius: '6px',
                fontSize: '12px',
                color: has ? '#16a34a' : '#dc2626',
                border: `1px solid ${has ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              {has ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
