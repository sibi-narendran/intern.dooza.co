/**
 * DynamicToolRenderer
 * 
 * Server-Driven UI renderer for tool results.
 * Routes to the appropriate component based on UI schema.
 * 
 * This is the main entry point for rendering any tool result.
 * The frontend doesn't need to know about specific tools - it just
 * renders based on the schema provided by the backend.
 */

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ToolUISchema } from '../../types/tool-ui'
import ScoreCard from './ScoreCard'
import KeyValueList from './KeyValueList'
import DataTable from './DataTable'
import IssuesList from './IssuesList'
import TabbedView from './TabbedView'
import RawJSON from './RawJSON'

interface DynamicToolRendererProps {
  /** The tool result data */
  data: unknown
  /** UI schema from the backend (null for legacy tools) */
  schema: ToolUISchema | null | undefined
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary to catch rendering errors gracefully
 */
class RendererErrorBoundary extends Component<
  { children: ReactNode; data: unknown },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; data: unknown }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <AlertTriangle size={16} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '13px', color: '#991b1b' }}>
              Error rendering tool result. Showing raw data.
            </span>
          </div>
          <RawJSON data={this.props.data} />
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Validate that schema has required fields
 */
function isValidSchema(schema: unknown): schema is ToolUISchema {
  if (!schema || typeof schema !== 'object') return false
  const s = schema as Record<string, unknown>
  return (
    typeof s.display === 'string' &&
    typeof s.title === 'string'
  )
}

/**
 * Ensure schema has default values for optional fields
 */
function normalizeSchema(schema: ToolUISchema): ToolUISchema {
  return {
    ...schema,
    fields: schema.fields || [],
    sections: schema.sections || [],
    expandable: schema.expandable ?? true,
  }
}

/**
 * DynamicToolRenderer
 * 
 * Renders tool results based on server-provided UI schema.
 * Falls back to RawJSON when no schema is provided or on error.
 */
export default function DynamicToolRenderer({ data, schema }: DynamicToolRendererProps) {
  // No schema or invalid schema = fallback to raw JSON
  if (!schema || !isValidSchema(schema)) {
    return <RawJSON data={data} />
  }
  
  // Normalize schema with defaults
  const normalizedSchema = normalizeSchema(schema)
  
  return (
    <RendererErrorBoundary data={data}>
      <DynamicRendererContent data={data} schema={normalizedSchema} />
    </RendererErrorBoundary>
  )
}

/**
 * Inner component that does the actual rendering
 */
function DynamicRendererContent({ 
  data, 
  schema 
}: { 
  data: unknown
  schema: ToolUISchema 
}) {
  // Has sections = use tabbed view
  if (schema.sections && schema.sections.length > 1) {
    return <TabbedView data={data} schema={schema} />
  }
  
  // Route based on display type
  switch (schema.display) {
    case 'score_card':
      return <ScoreCard data={data} schema={schema} />
    
    case 'key_value':
      return <KeyValueList data={data} schema={schema} />
    
    case 'data_table':
      return <DataTable data={data} schema={schema} />
    
    case 'issues_list':
      return <IssuesList data={data} schema={schema} />
    
    case 'raw':
    default:
      return <RawJSON data={data} />
  }
}

// Re-export individual components for direct use if needed
export { ScoreCard, KeyValueList, DataTable, IssuesList, TabbedView, RawJSON }
