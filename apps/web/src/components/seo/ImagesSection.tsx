/**
 * ImagesSection Component
 * 
 * Displays image alt tag analysis with visual statistics.
 */

import { Image, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import ScoreGauge from './ScoreGauge'

interface ImagesSectionProps {
  total: number
  withAlt: number
  withoutAlt: number
  score: number
  issues: string[]
}

export default function ImagesSection({
  total,
  withAlt,
  withoutAlt,
  score,
  issues,
}: ImagesSectionProps) {
  const percentage = total > 0 ? Math.round((withAlt / total) * 100) : 100
  
  return (
    <div className="seo-images-section">
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
            Image Optimization
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
            Alt tag coverage analysis
          </p>
        </div>
        <ScoreGauge score={score} size="sm" showLabel={false} />
      </div>
      
      {/* Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Total images */}
        <div style={{
          padding: '16px',
          background: 'var(--gray-50)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <Image size={18} color="var(--gray-500)" />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--gray-800)',
            lineHeight: 1,
            marginBottom: '4px',
          }}>
            {total}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--gray-500)',
            fontWeight: 500,
          }}>
            Total Images
          </div>
        </div>
        
        {/* With alt */}
        <div style={{
          padding: '16px',
          background: '#f0fdf4',
          borderRadius: '10px',
          textAlign: 'center',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <CheckCircle2 size={18} color="#16a34a" />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#166534',
            lineHeight: 1,
            marginBottom: '4px',
          }}>
            {withAlt}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#16a34a',
            fontWeight: 500,
          }}>
            With Alt Text
          </div>
        </div>
        
        {/* Without alt */}
        <div style={{
          padding: '16px',
          background: withoutAlt > 0 ? '#fef2f2' : '#f0fdf4',
          borderRadius: '10px',
          textAlign: 'center',
          border: `1px solid ${withoutAlt > 0 ? '#fecaca' : '#bbf7d0'}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            {withoutAlt > 0 ? (
              <XCircle size={18} color="#dc2626" />
            ) : (
              <CheckCircle2 size={18} color="#16a34a" />
            )}
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: withoutAlt > 0 ? '#991b1b' : '#166534',
            lineHeight: 1,
            marginBottom: '4px',
          }}>
            {withoutAlt}
          </div>
          <div style={{
            fontSize: '12px',
            color: withoutAlt > 0 ? '#dc2626' : '#16a34a',
            fontWeight: 500,
          }}>
            Missing Alt Text
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{
        padding: '16px',
        background: 'white',
        borderRadius: '10px',
        border: '1px solid var(--gray-200)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)' }}>
            Alt Tag Coverage
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: percentage === 100 ? '#16a34a' : percentage >= 80 ? '#ca8a04' : '#dc2626',
          }}>
            {percentage}%
          </span>
        </div>
        
        <div style={{
          height: '10px',
          background: 'var(--gray-100)',
          borderRadius: '5px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: percentage === 100 
              ? 'linear-gradient(90deg, #22c55e, #16a34a)' 
              : percentage >= 80 
                ? 'linear-gradient(90deg, #eab308, #ca8a04)'
                : 'linear-gradient(90deg, #ef4444, #dc2626)',
            borderRadius: '5px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: 'var(--gray-500)',
        }}>
          {percentage === 100 
            ? '✓ All images have alt text!' 
            : `${withoutAlt} image${withoutAlt !== 1 ? 's' : ''} need alt text for accessibility`
          }
        </div>
      </div>
      
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
            Image Issues
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
