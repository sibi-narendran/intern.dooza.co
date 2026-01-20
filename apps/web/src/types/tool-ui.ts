/**
 * Tool UI Schema Types
 * 
 * TypeScript types for Server-Driven UI schemas.
 * These mirror the backend ToolUISchema definitions.
 */

// =============================================================================
// Display Types
// =============================================================================

export type UIDisplayType = 
  | 'score_card'    // Circular gauge with score + summary
  | 'data_table'    // Rows and columns for tabular data
  | 'key_value'     // Label: value pairs for structured data
  | 'issues_list'   // Prioritized list of issues/warnings
  | 'raw'           // Formatted JSON fallback

// =============================================================================
// Field Mapping
// =============================================================================

export interface FieldMapping {
  /** Dot-notation path to value (e.g., 'meta_tags.title') */
  path: string
  /** Human-readable label for display */
  label: string
  /** Optional format hint ('url', 'percent', 'number', 'date') */
  format?: string | null
}

// =============================================================================
// UI Section (for tabbed layouts)
// =============================================================================

export interface UISection {
  /** Unique section identifier */
  id: string
  /** Tab/section label */
  label: string
  /** Display type for this section */
  display: UIDisplayType
  /** Lucide icon name (optional) */
  icon?: string | null
  /** Fields to show in this section */
  fields: FieldMapping[]
  /** JSON path to score (for score_card sections) */
  score_field?: string | null
}

// =============================================================================
// Main UI Schema
// =============================================================================

export interface ToolUISchema {
  /** Primary display type */
  display: UIDisplayType
  /** Card/section title */
  title: string
  /** Template string for summary (e.g., "Score: {overall_score}/100") */
  summary_template?: string | null
  /** JSON path to primary score (for score_card) */
  score_field?: string | null
  /** Field mappings for simple layouts */
  fields: FieldMapping[]
  /** Section definitions for tabbed layouts */
  sections?: UISection[]
  /** Whether result should be collapsible (default true) */
  expandable?: boolean
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a nested value from an object using dot notation path.
 * 
 * @param obj - The object to traverse
 * @param path - Dot notation path (e.g., 'meta_tags.title')
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(obj: unknown, path: string | null | undefined): unknown {
  if (!path || obj === null || obj === undefined) {
    return undefined
  }
  
  const parts = path.split('.')
  let current: unknown = obj
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  
  return current
}

/**
 * Format a summary template with values from data.
 * 
 * @param template - Template string with {field} placeholders
 * @param data - Data object to pull values from
 * @returns Formatted string
 */
export function formatSummary(template: string | null | undefined, data: unknown): string {
  if (!template) return ''
  
  return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path) => {
    const value = getNestedValue(data, path)
    if (value === null || value === undefined) return 'N/A'
    return String(value)
  })
}

/**
 * Format a value based on format hint.
 */
export function formatValue(value: unknown, format?: string | null): string {
  if (value === null || value === undefined) return '—'
  
  switch (format) {
    case 'percent':
      return `${value}%`
    case 'number':
      if (typeof value === 'number') {
        return value.toLocaleString()
      }
      return String(value)
    case 'url':
      return String(value)
    case 'date':
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value).toLocaleDateString()
      }
      return String(value)
    default:
      if (Array.isArray(value)) {
        return value.join(', ')
      }
      return String(value)
  }
}

/**
 * Get score level for color coding.
 */
export type ScoreLevel = 'excellent' | 'good' | 'fair' | 'poor'

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/**
 * Get color configuration for a score level.
 */
export function getScoreColors(score: number): {
  bg: string
  text: string
  border: string
  gradient: string
} {
  const level = getScoreLevel(score)
  
  const colors = {
    excellent: {
      bg: '#dcfce7',
      text: '#166534',
      border: '#86efac',
      gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    },
    good: {
      bg: '#fef9c3',
      text: '#854d0e',
      border: '#fde047',
      gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
    },
    fair: {
      bg: '#fed7aa',
      text: '#9a3412',
      border: '#fdba74',
      gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    },
    poor: {
      bg: '#fecaca',
      text: '#991b1b',
      border: '#fca5a5',
      gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    },
  }
  
  return colors[level]
}

/**
 * Type guard to check if schema is present.
 */
export function hasUISchema(obj: unknown): obj is { ui_schema: ToolUISchema } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'ui_schema' in obj &&
    typeof (obj as { ui_schema: unknown }).ui_schema === 'object'
  )
}
