/**
 * ScoreCard Renderer
 * 
 * Displays a circular score gauge with summary and optional fields.
 * Used for tools that return a primary score metric.
 */

import { useMemo } from 'react'
import { 
  ToolUISchema, 
  getNestedValue, 
  formatSummary, 
  formatValue,
  getScoreColors,
  getScoreLevel,
} from '../../types/tool-ui'

interface ScoreCardProps {
  data: unknown
  schema: ToolUISchema
}

/**
 * Circular score gauge component.
 */
function ScoreGauge({ 
  score, 
  size = 'md',
  label 
}: { 
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string 
}) {
  const colors = getScoreColors(score)
  
  const dimensions = {
    sm: { size: 60, stroke: 6, fontSize: 14 },
    md: { size: 80, stroke: 8, fontSize: 18 },
    lg: { size: 100, stroke: 10, fontSize: 24 },
  }
  
  const { size: dim, stroke, fontSize } = dimensions[size]
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '8px',
    }}>
      <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="var(--gray-200)"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={colors.text}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
        {/* Score text */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            fill: colors.text,
          }}
        >
          {score}
        </text>
      </svg>
      {label && (
        <span style={{
          fontSize: '12px',
          color: 'var(--gray-600)',
          fontWeight: 500,
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

export default function ScoreCard({ data, schema }: ScoreCardProps) {
  // Extract score from data using schema's score_field
  const score = useMemo(() => {
    if (!schema.score_field) return 0
    const value = getNestedValue(data, schema.score_field)
    return typeof value === 'number' ? value : 0
  }, [data, schema.score_field])
  
  const colors = getScoreColors(score)
  const level = getScoreLevel(score)
  
  // Format summary
  const summary = formatSummary(schema.summary_template, data)
  
  // Safely access fields
  const fields = schema.fields || []
  
  return (
    <div style={{
      padding: '20px',
      background: `linear-gradient(135deg, ${colors.bg}, white)`,
    }}>
      {/* Header with score gauge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        marginBottom: fields.length > 0 ? '20px' : 0,
      }}>
        <ScoreGauge score={score} size="md" />
        
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--gray-800)',
              margin: 0,
            }}>
              {schema.title}
            </h3>
            <span style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {level}
            </span>
          </div>
          
          {summary && (
            <p style={{
              fontSize: '14px',
              color: 'var(--gray-600)',
              margin: 0,
            }}>
              {summary}
            </p>
          )}
        </div>
      </div>
      
      {/* Fields grid */}
      {fields.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid var(--gray-200)',
        }}>
          {fields.map((field) => {
            const value = getNestedValue(data, field.path)
            return (
              <div key={field.path} style={{
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid var(--gray-100)',
              }}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--gray-500)',
                  marginBottom: '4px',
                }}>
                  {field.label}
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--gray-800)',
                  wordBreak: 'break-word',
                }}>
                  {formatValue(value, field.format)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
