/**
 * Social Platforms Configuration
 * 
 * UI constants for displaying social media platforms in the app.
 * Used by IntegrationsPanel, IntegrationActionCard, and publish UIs.
 */

// ============================================================================
// Supported Platforms
// ============================================================================

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook', 
  'linkedin',
  'tiktok',
  'youtube',
] as const

export type SocialPlatform = typeof SOCIAL_PLATFORMS[number]

// ============================================================================
// Platform Display Metadata
// ============================================================================

export interface PlatformInfo {
  name: string
  color: string
  bgColor: string
  gradient: string
}

export const PLATFORM_INFO: Record<SocialPlatform, PlatformInfo> = {
  instagram: {
    name: 'Instagram',
    color: '#E4405F',
    bgColor: '#fdf2f8',
    gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
  },
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    bgColor: '#eff6ff',
    gradient: 'linear-gradient(180deg, #1877F2, #0d65d9)',
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0A66C2',
    bgColor: '#eff6ff',
    gradient: 'linear-gradient(180deg, #0A66C2, #084d94)',
  },
  tiktok: {
    name: 'TikTok',
    color: '#000000',
    bgColor: '#f3f4f6',
    gradient: 'linear-gradient(180deg, #25f4ee, #fe2c55)',
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    bgColor: '#fef2f2',
    gradient: 'linear-gradient(180deg, #FF0000, #cc0000)',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string is a valid social platform
 */
export function isSocialPlatform(platform: string): platform is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(platform as SocialPlatform)
}

/**
 * Get platform info with fallback for unknown platforms
 */
export function getPlatformInfo(platform: string): PlatformInfo {
  if (isSocialPlatform(platform)) {
    return PLATFORM_INFO[platform]
  }
  // Fallback for unknown platforms
  return {
    name: platform.charAt(0).toUpperCase() + platform.slice(1),
    color: '#6B7280',
    bgColor: '#f3f4f6',
    gradient: 'linear-gradient(180deg, #6B7280, #4B5563)',
  }
}
