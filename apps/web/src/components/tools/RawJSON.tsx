/**
 * RawJSON Renderer
 * 
 * Fallback renderer that displays formatted JSON.
 * Used when no schema is provided or for 'raw' display type.
 */

interface RawJSONProps {
  data: unknown
}

export default function RawJSON({ data }: RawJSONProps) {
  const formatted = typeof data === 'string' 
    ? data 
    : JSON.stringify(data, null, 2)
  
  return (
    <div style={{ 
      padding: '12px', 
      background: '#f8fafc',
      maxHeight: '400px', 
      overflow: 'auto',
    }}>
      <pre style={{
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        color: '#475569',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: 0,
        lineHeight: '1.5',
      }}>
        {formatted}
      </pre>
    </div>
  )
}
