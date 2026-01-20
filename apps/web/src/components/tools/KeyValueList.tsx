/**
 * KeyValueList Renderer
 * 
 * Displays data as label: value pairs.
 * Used for structured data with named fields.
 */

import { ExternalLink } from 'lucide-react'
import { 
  ToolUISchema, 
  getNestedValue, 
  formatValue,
} from '../../types/tool-ui'

interface KeyValueListProps {
  data: unknown
  schema: ToolUISchema
}

export default function KeyValueList({ data, schema }: KeyValueListProps) {
  const fields = schema.fields || []
  
  if (fields.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--gray-500)', fontSize: '13px' }}>
        No fields to display
      </div>
    )
  }
  
  return (
    <div style={{ padding: '16px' }}>
      {schema.title && (
        <h4 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--gray-700)',
          marginBottom: '12px',
          margin: '0 0 12px 0',
        }}>
          {schema.title}
        </h4>
      )}
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {fields.map((field) => {
          const value = getNestedValue(data, field.path)
          const isUrl = field.format === 'url' && typeof value === 'string'
          const isArray = Array.isArray(value)
          
          return (
            <div 
              key={field.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--gray-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {field.label}
              </span>
              
              {isUrl ? (
                <a 
                  href={value as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '14px',
                    color: 'var(--primary-600)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {value as string}
                  <ExternalLink size={12} />
                </a>
              ) : isArray ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  {(value as unknown[]).map((item, idx) => (
                    <span 
                      key={idx}
                      style={{
                        fontSize: '14px',
                        color: 'var(--gray-800)',
                        padding: '6px 10px',
                        background: 'var(--gray-50)',
                        borderRadius: '6px',
                        border: '1px solid var(--gray-100)',
                      }}
                    >
                      {typeof item === 'string' ? item : JSON.stringify(item)}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{
                  fontSize: '14px',
                  color: 'var(--gray-800)',
                  wordBreak: 'break-word',
                }}>
                  {formatValue(value, field.format)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
