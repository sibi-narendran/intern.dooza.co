/**
 * SEO Analysis Types
 * 
 * TypeScript interfaces for structured SEO tool results.
 * These types mirror the data structure returned by the backend SEO tools.
 */

// ============================================================================
// Base Types
// ============================================================================

export type ScoreLevel = 'excellent' | 'good' | 'fair' | 'poor'
export type Priority = 'high' | 'medium' | 'low'

export interface SEOIssue {
  message: string
  priority?: Priority
  category?: string
}

// ============================================================================
// Meta Tags Analysis
// ============================================================================

export interface OpenGraphTags {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: string
  site_name?: string
  [key: string]: string | undefined
}

export interface TwitterTags {
  card?: string
  title?: string
  description?: string
  image?: string
  site?: string
  creator?: string
  [key: string]: string | undefined
}

export interface MetaTagsResult {
  title: string | null
  title_length: number
  description: string | null
  description_length: number
  keywords: string | null
  canonical: string | null
  robots: string | null
  og_tags: OpenGraphTags
  twitter_tags: TwitterTags
  issues: string[]
  score: number
}

// ============================================================================
// Headings Analysis
// ============================================================================

export interface HeadingItem {
  level: number
  text: string
}

export interface HeadingsResult {
  h1_count: number
  h1_texts: string[]
  h2_count: number
  h2_texts: string[]
  h3_count: number
  h4_count: number
  h5_count: number
  h6_count: number
  hierarchy: HeadingItem[]
  issues: string[]
  score: number
}

// ============================================================================
// Images Analysis
// ============================================================================

export interface ImagesResult {
  total_images: number
  images_with_alt: number
  images_without_alt: number
  images_with_empty_alt: number
  missing_alt_images: string[]
  issues: string[]
  score: number
}

// ============================================================================
// Keywords Analysis
// ============================================================================

export interface KeywordItem {
  keyword: string
  count: number
  density: number
}

export interface KeywordsResult {
  success: boolean
  url: string
  word_count: number
  keywords: KeywordItem[]
}

// ============================================================================
// Full SEO Analysis (seo_analyze_url)
// ============================================================================

export interface SEOAnalysisResult {
  success: boolean
  url: string
  overall_score: number
  issues_count: number
  
  meta_tags: {
    title: string | null
    title_length: number
    description: string | null
    description_length: number
    canonical: string | null
    og_tags: OpenGraphTags
    score: number
    issues: string[]
  }
  
  headings: {
    h1_count: number
    h1_texts: string[]
    h2_count: number
    h2_texts: string[]
    score: number
    issues: string[]
  }
  
  images: {
    total: number
    with_alt: number
    without_alt: number
    score: number
    issues: string[]
  }
  
  keywords: KeywordItem[]
  word_count: number
  all_issues: string[]
}

// ============================================================================
// Tool Data Event
// ============================================================================

export interface ToolDataEvent {
  tool: string
  data: SEOAnalysisResult | MetaTagsResult | HeadingsResult | ImagesResult | KeywordsResult
  category: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate score level from numeric score
 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/**
 * Get score color configuration
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
 * Determine issue priority from message content
 */
export function getIssuePriority(issue: string): Priority {
  const lowerIssue = issue.toLowerCase()
  
  // High priority indicators
  if (
    lowerIssue.includes('missing title') ||
    lowerIssue.includes('missing meta description') ||
    lowerIssue.includes('no h1') ||
    lowerIssue.includes('multiple h1')
  ) {
    return 'high'
  }
  
  // Medium priority indicators
  if (
    lowerIssue.includes('too short') ||
    lowerIssue.includes('too long') ||
    lowerIssue.includes('missing og:') ||
    lowerIssue.includes('missing canonical')
  ) {
    return 'medium'
  }
  
  // Default to low
  return 'low'
}

/**
 * Type guard to check if data is SEOAnalysisResult
 */
export function isSEOAnalysisResult(data: unknown): data is SEOAnalysisResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'overall_score' in data &&
    'meta_tags' in data &&
    'headings' in data
  )
}

/**
 * Type guard for MetaTagsResult
 */
export function isMetaTagsResult(data: unknown): data is MetaTagsResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'title' in data &&
    'og_tags' in data &&
    !('overall_score' in data)
  )
}

/**
 * Type guard for HeadingsResult
 */
export function isHeadingsResult(data: unknown): data is HeadingsResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'h1_count' in data &&
    'hierarchy' in data
  )
}

/**
 * Type guard for ImagesResult
 */
export function isImagesResult(data: unknown): data is ImagesResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'total_images' in data &&
    'images_with_alt' in data
  )
}

/**
 * Type guard for KeywordsResult
 */
export function isKeywordsResult(data: unknown): data is KeywordsResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'keywords' in data &&
    'word_count' in data &&
    !('overall_score' in data)
  )
}
