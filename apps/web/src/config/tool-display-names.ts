/**
 * Tool Display Names Configuration
 * 
 * Maps internal tool names to user-friendly display text.
 * Used in the chat interface when showing tool execution status.
 */

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // SEO Tools
  'seo_analyze_url': 'Analyzing URL',
  'seo_audit_meta_tags': 'Checking meta tags',
  'seo_analyze_headings': 'Analyzing headings',
  'seo_check_images': 'Checking images',
  'seo_extract_keywords': 'Extracting keywords',
  
  // Social Tools (for soshie)
  'social_create_post': 'Creating post',
  'social_schedule_content': 'Scheduling content',
  'social_analyze_engagement': 'Analyzing engagement',
}

/**
 * Formats a tool name for user-friendly display.
 * Uses the mapping if available, otherwise formats the name nicely.
 */
export function formatToolName(name: string): string {
  if (TOOL_DISPLAY_NAMES[name]) {
    return TOOL_DISPLAY_NAMES[name]
  }
  // Fallback: convert snake_case to Title Case
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
