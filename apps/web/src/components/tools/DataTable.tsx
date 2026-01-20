/**
 * DataTable Renderer
 * 
 * Displays array data as a table.
 * Used for keyword lists, rankings, etc.
 */

import { 
  ToolUISchema, 
  getNestedValue, 
  formatValue,
} from '../../types/tool-ui'

interface DataTableProps {
  data: unknown
  schema: ToolUISchema
}

interface TableRow {
  [key: string]: unknown
}

export default function DataTable({ data, schema }: DataTableProps) {
  const fields = schema.fields || []
  
  // Find the array field to display
  const arrayField = fields.find(f => {
    const value = getNestedValue(data, f.path)
    return Array.isArray(value)
  })
  
  if (!arrayField) {
    // No array found, show as key-value
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--gray-500)', margin: 0 }}>No tabular data found</p>
      </div>
    )
  }
  
  const rows = getNestedValue(data, arrayField.path) as TableRow[]
  
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--gray-500)', margin: 0 }}>No data available</p>
      </div>
    )
  }
  
  // Extract column names from first row
  const columns = Object.keys(rows[0])
  
  // Format column header
  const formatHeader = (col: string) => {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
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
        overflowX: 'auto',
        borderRadius: '8px',
        border: '1px solid var(--gray-200)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)' }}>
              {columns.map((col) => (
                <th 
                  key={col}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--gray-600)',
                    borderBottom: '1px solid var(--gray-200)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                style={{
                  background: rowIdx % 2 === 0 ? 'white' : 'var(--gray-50)',
                }}
              >
                {columns.map((col) => {
                  const value = row[col]
                  const format = col.includes('density') ? 'percent' : 
                                 col.includes('count') ? 'number' : undefined
                  
                  return (
                    <td 
                      key={col}
                      style={{
                        padding: '10px 12px',
                        color: 'var(--gray-800)',
                        borderBottom: '1px solid var(--gray-100)',
                      }}
                    >
                      {formatValue(value, format)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {rows.length > 20 && (
        <p style={{
          fontSize: '12px',
          color: 'var(--gray-500)',
          marginTop: '8px',
          textAlign: 'center',
        }}>
          Showing 20 of {rows.length} items
        </p>
      )}
    </div>
  )
}
