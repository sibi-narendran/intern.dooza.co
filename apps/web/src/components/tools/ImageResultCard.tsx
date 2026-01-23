/**
 * ImageResultCard
 * 
 * Renders generated images from tool results.
 * Used by ToolIndicator when the create_image tool completes successfully.
 * 
 * This provides a robust way to display images that doesn't depend on
 * the LLM outputting correct markdown syntax.
 */

import { useState } from 'react'
import { Download, ExternalLink, AlertCircle, Image as ImageIcon } from 'lucide-react'

interface ImageResultData {
  status: 'success' | 'error' | 'filtered' | 'stub' | 'pending'
  image_url?: string | null
  image_data_url?: string | null
  prompt_used?: string
  enhanced_prompt?: string
  style?: string
  platform?: string
  dimensions?: string
  message?: string
  provider?: string
  model?: string
}

interface ImageResultCardProps {
  data: ImageResultData
}

export default function ImageResultCard({ data }: ImageResultCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  
  // Get the best available image source
  const imageSrc = data.image_url || data.image_data_url
  const isSuccess = data.status === 'success' && imageSrc
  
  // Handle non-success states
  if (!isSuccess) {
    return (
      <div style={{
        padding: '16px',
        background: data.status === 'filtered' ? '#fef3c7' : '#fef2f2',
        borderRadius: '12px',
        border: `1px solid ${data.status === 'filtered' ? '#fcd34d' : '#fecaca'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertCircle size={16} style={{ color: data.status === 'filtered' ? '#d97706' : '#dc2626' }} />
          <span style={{ 
            fontWeight: 600, 
            color: data.status === 'filtered' ? '#92400e' : '#991b1b',
            fontSize: '14px',
          }}>
            {data.status === 'filtered' ? 'Image Blocked by Safety Filters' : 
             data.status === 'stub' ? 'Image Generation Not Configured' : 
             'Image Generation Failed'}
          </span>
        </div>
        {data.message && (
          <p style={{ 
            fontSize: '13px', 
            color: data.status === 'filtered' ? '#78350f' : '#7f1d1d',
            margin: 0,
          }}>
            {data.message}
          </p>
        )}
      </div>
    )
  }
  
  const handleDownload = async () => {
    if (!imageSrc) return
    
    try {
      const response = await fetch(imageSrc)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${Date.now()}.${blob.type.includes('png') ? 'png' : 'jpg'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      // Fallback: open in new tab
      window.open(imageSrc, '_blank')
    }
  }
  
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
    }}>
      {/* Image container */}
      <div style={{
        position: 'relative',
        background: '#f8fafc',
        minHeight: '200px',
      }}>
        {isLoading && !hasError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
          }}>
            <ImageIcon size={32} style={{ color: '#94a3b8', animation: 'pulse 2s infinite' }} />
          </div>
        )}
        
        {hasError ? (
          <div style={{
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            color: '#64748b',
          }}>
            <AlertCircle size={32} />
            <span style={{ fontSize: '14px' }}>Failed to load image</span>
            {data.image_url && (
              <a 
                href={data.image_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '13px',
                  color: 'var(--primary-600)',
                  textDecoration: 'underline',
                }}
              >
                Open directly
              </a>
            )}
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={data.prompt_used || 'Generated image'}
            style={{
              width: '100%',
              height: 'auto',
              display: isLoading ? 'none' : 'block',
              maxHeight: '500px',
              objectFit: 'contain',
            }}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        )}
      </div>
      
      {/* Action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'var(--primary-600)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            Download
          </button>
          
          {data.image_url && (
            <a
              href={data.image_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: 'white',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} />
              Open
            </a>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: '#64748b',
            border: 'none',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      
      {/* Details panel */}
      {showDetails && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontSize: '13px',
        }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            {data.platform && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#64748b', minWidth: '80px' }}>Platform:</span>
                <span style={{ color: '#334155', textTransform: 'capitalize' }}>{data.platform}</span>
              </div>
            )}
            {data.dimensions && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#64748b', minWidth: '80px' }}>Size:</span>
                <span style={{ color: '#334155' }}>{data.dimensions}</span>
              </div>
            )}
            {data.style && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#64748b', minWidth: '80px' }}>Style:</span>
                <span style={{ color: '#334155', textTransform: 'capitalize' }}>{data.style.replace('_', ' ')}</span>
              </div>
            )}
            {data.model && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#64748b', minWidth: '80px' }}>Model:</span>
                <span style={{ color: '#334155' }}>{data.model}</span>
              </div>
            )}
            {data.prompt_used && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Prompt:</span>
                <p style={{ 
                  color: '#475569', 
                  margin: 0,
                  padding: '8px 12px',
                  background: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  lineHeight: 1.5,
                }}>
                  {data.prompt_used}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Type guard to check if tool result is an image generation result
 */
export function isImageResult(data: unknown): data is ImageResultData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.status === 'string' &&
    ['success', 'error', 'filtered', 'stub', 'pending'].includes(d.status) &&
    (d.image_url !== undefined || d.image_data_url !== undefined || d.prompt_used !== undefined)
  )
}
