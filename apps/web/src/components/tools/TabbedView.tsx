/**
 * TabbedView Renderer
 * 
 * Renders tool results with multiple sections as tabs.
 * Used for comprehensive analysis tools like SEO.
 */

import { useState, useMemo } from 'react'
import { 
  Globe, 
  FileText, 
  Heading, 
  Image, 
  Key, 
  AlertCircle,
  BarChart3,
  List,
  Settings,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { 
  ToolUISchema, 
  UISection,
  getNestedValue, 
  formatSummary,
  getScoreColors,
  getScoreLevel,
} from '../../types/tool-ui'
import ScoreCard from './ScoreCard'
import KeyValueList from './KeyValueList'
import DataTable from './DataTable'
import IssuesList from './IssuesList'
import RawJSON from './RawJSON'

interface TabbedViewProps {
  data: unknown
  schema: ToolUISchema
}

/**
 * Icon registry - maps icon names to components.
 * Only includes commonly used icons to keep bundle size small.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  FileText,
  Heading,
  Image,
  Key,
  AlertCircle,
  BarChart3,
  List,
  Settings,
  Zap,
}

/**
 * Get Lucide icon by name from registry
 */
function getIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null
  return ICON_MAP[name] || null
}

/**
 * Score gauge mini component
 */
function MiniScoreGauge({ score }: { score: number }) {
  const colors = getScoreColors(score)
  const size = 48
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--gray-200)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.text}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: 'center',
          fontSize: '12px',
          fontWeight: 700,
          fill: colors.text,
        }}
      >
        {score}
      </text>
    </svg>
  )
}

/**
 * Render section content based on display type
 */
function SectionContent({ section, data }: { section: UISection; data: unknown }) {
  // Create a pseudo-schema for the section
  const sectionSchema: ToolUISchema = {
    display: section.display,
    title: '', // Don't show title inside tab
    fields: section.fields,
    score_field: section.score_field,
  }
  
  switch (section.display) {
    case 'score_card':
      return <ScoreCard data={data} schema={sectionSchema} />
    case 'key_value':
      return <KeyValueList data={data} schema={sectionSchema} />
    case 'data_table':
      return <DataTable data={data} schema={sectionSchema} />
    case 'issues_list':
      return <IssuesList data={data} schema={sectionSchema} />
    default:
      return <RawJSON data={data} />
  }
}

export default function TabbedView({ data, schema }: TabbedViewProps) {
  const [activeTab, setActiveTab] = useState(schema.sections?.[0]?.id || '')
  
  const sections = schema.sections || []
  
  // Get primary score
  const primaryScore = useMemo(() => {
    if (!schema.score_field) return null
    const value = getNestedValue(data, schema.score_field)
    return typeof value === 'number' ? value : null
  }, [data, schema.score_field])
  
  const colors = primaryScore !== null ? getScoreColors(primaryScore) : null
  const level = primaryScore !== null ? getScoreLevel(primaryScore) : null
  
  // Format summary
  const summary = formatSummary(schema.summary_template, data)
  
  const activeSection = sections.find(s => s.id === activeTab)
  
  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: colors ? `linear-gradient(135deg, ${colors.bg}, white)` : 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-100)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}>
          {/* Score gauge */}
          {primaryScore !== null && (
            <MiniScoreGauge score={primaryScore} />
          )}
          
          {/* Title and summary */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--gray-800)',
                margin: 0,
              }}>
                {schema.title}
              </h3>
              {level && colors && (
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: colors.bg,
                  color: colors.text,
                  textTransform: 'uppercase',
                }}>
                  {level}
                </span>
              )}
            </div>
            {summary && (
              <p style={{
                fontSize: '13px',
                color: 'var(--gray-600)',
                margin: 0,
              }}>
                {summary}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '12px 16px',
        background: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-100)',
        overflowX: 'auto',
      }}>
        {sections.map((section) => {
          const Icon = getIcon(section.icon)
          const isActive = activeTab === section.id
          const sectionScore = section.score_field 
            ? getNestedValue(data, section.score_field) as number | undefined
            : undefined
          
          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: isActive ? 'white' : 'transparent',
                border: isActive ? '1px solid var(--gray-200)' : '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--gray-800)' : 'var(--gray-600)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {Icon && <Icon size={14} />}
              {section.label}
              {sectionScore !== undefined && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: getScoreColors(sectionScore).bg,
                  color: getScoreColors(sectionScore).text,
                }}>
                  {sectionScore}
                </span>
              )}
            </button>
          )
        })}
      </div>
      
      {/* Tab content */}
      <div>
        {activeSection && (
          <SectionContent section={activeSection} data={data} />
        )}
      </div>
    </div>
  )
}
