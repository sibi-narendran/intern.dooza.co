/**
 * SEOAnalysisCard Component
 * 
 * Main container for displaying complete SEO analysis results.
 * Renders structured tool data with dedicated visualization components.
 */

import { useState } from 'react'
import { 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  FileText,
  Heading,
  Image,
  Key,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import ScoreGauge from './ScoreGauge'
import IssuesList from './IssuesList'
import MetaTagsSection from './MetaTagsSection'
import HeadingsSection from './HeadingsSection'
import ImagesSection from './ImagesSection'
import KeywordsSection from './KeywordsSection'
import { SEOAnalysisResult, getScoreLevel, getScoreColors } from '../../types/seo'

interface SEOAnalysisCardProps {
  data: SEOAnalysisResult
  defaultExpanded?: boolean
}

type TabKey = 'overview' | 'meta' | 'headings' | 'images' | 'keywords'

interface Tab {
  key: TabKey
  label: string
  icon: React.ElementType
  score?: number
}

export default function SEOAnalysisCard({ 
  data, 
  defaultExpanded = true 
}: SEOAnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  
  const level = getScoreLevel(data.overall_score)
  const colors = getScoreColors(data.overall_score)
  
  // Extract domain from URL
  const domain = (() => {
    try {
      const url = new URL(data.url.startsWith('http') ? data.url : `https://${data.url}`)
      return url.hostname
    } catch {
      return data.url
    }
  })()
  
  const tabs: Tab[] = [
    { key: 'overview', label: 'Overview', icon: Globe },
    { key: 'meta', label: 'Meta Tags', icon: FileText, score: data.meta_tags.score },
    { key: 'headings', label: 'Headings', icon: Heading, score: data.headings.score },
    { key: 'images', label: 'Images', icon: Image, score: data.images.score },
    { key: 'keywords', label: 'Keywords', icon: Key },
  ]
  
  return (
    <div 
      className="seo-analysis-card"
      style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--gray-200)',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '20px 24px',
          background: `linear-gradient(135deg, ${colors.bg}, white)`,
          borderBottom: isExpanded ? '1px solid var(--gray-100)' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}>
          {/* Score gauge */}
          <ScoreGauge score={data.overall_score} size="md" label="SEO Score" />
          
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
                SEO Analysis
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
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--gray-600)',
            }}>
              <Globe size={14} />
              <span style={{ fontWeight: 500 }}>{domain}</span>
              <a 
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ExternalLink size={12} />
              </a>
            </div>
            
            {/* Quick stats */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginTop: '12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: data.issues_count > 0 ? '#dc2626' : '#16a34a',
              }}>
                {data.issues_count > 0 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                {data.issues_count} issue{data.issues_count !== 1 ? 's' : ''} found
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--gray-500)',
              }}>
                {data.word_count.toLocaleString()} words
              </div>
            </div>
          </div>
          
          {/* Expand toggle */}
          <button 
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              color: 'var(--gray-400)',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              padding: '12px 24px',
              background: 'var(--gray-50)',
              borderBottom: '1px solid var(--gray-100)',
              overflowX: 'auto',
            }}>
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: isActive ? 'white' : 'transparent',
                      border: isActive ? '1px solid var(--gray-200)' : '1px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--gray-800)' : 'var(--gray-600)',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    <Icon size={14} />
                    {tab.label}
                    {tab.score !== undefined && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: getScoreColors(tab.score).bg,
                        color: getScoreColors(tab.score).text,
                      }}>
                        {tab.score}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            
            {/* Tab content */}
            <div style={{ padding: '24px' }}>
              {activeTab === 'overview' && (
                <div>
                  {/* Score breakdown */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '24px',
                  }}>
                    {[
                      { label: 'Meta Tags', score: data.meta_tags.score },
                      { label: 'Headings', score: data.headings.score },
                      { label: 'Images', score: data.images.score },
                    ].map((item) => (
                      <div 
                        key={item.label}
                        style={{
                          padding: '16px',
                          background: 'var(--gray-50)',
                          borderRadius: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <ScoreGauge score={item.score} size="sm" label={item.label} />
                      </div>
                    ))}
                  </div>
                  
                  {/* Issues */}
                  <IssuesList 
                    issues={data.all_issues} 
                    title="All Issues" 
                    maxItems={5}
                  />
                </div>
              )}
              
              {activeTab === 'meta' && (
                <MetaTagsSection
                  title={data.meta_tags.title}
                  titleLength={data.meta_tags.title_length}
                  description={data.meta_tags.description}
                  descriptionLength={data.meta_tags.description_length}
                  canonical={data.meta_tags.canonical}
                  ogTags={data.meta_tags.og_tags}
                  score={data.meta_tags.score}
                />
              )}
              
              {activeTab === 'headings' && (
                <HeadingsSection
                  h1Count={data.headings.h1_count}
                  h1Texts={data.headings.h1_texts}
                  h2Count={data.headings.h2_count}
                  h2Texts={data.headings.h2_texts}
                  score={data.headings.score}
                  issues={data.headings.issues}
                />
              )}
              
              {activeTab === 'images' && (
                <ImagesSection
                  total={data.images.total}
                  withAlt={data.images.with_alt}
                  withoutAlt={data.images.without_alt}
                  score={data.images.score}
                  issues={data.images.issues}
                />
              )}
              
              {activeTab === 'keywords' && (
                <KeywordsSection
                  keywords={data.keywords}
                  wordCount={data.word_count}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
