/**
 * Agent Welcome Prompts Configuration
 * 
 * SMB-friendly suggestion prompts for each agent's welcome screen.
 * 
 * TODO: Move to backend - add suggested_prompts field to agent_gallery table.
 * This file serves as a temporary frontend fallback until backend supports it.
 */

export const AGENT_PROMPTS: Record<string, string[]> = {
  seomi: [
    "How can I get more visitors to my website?",
    "Why isn't my business showing up on Google?",
    "Help me rank higher in search results",
    "What's wrong with my website?",
  ],
  soshie: [
    "Help me create content for social media",
    "What should I post this week?",
    "How do I get more followers?",
    "Create a post about my business",
  ],
}

export const DEFAULT_PROMPTS = [
  "What can you help me with?",
  "Show me what you can do",
]

/**
 * Get prompts for an agent by slug.
 * Falls back to DEFAULT_PROMPTS if agent has no configured prompts.
 */
export function getPromptsForAgent(slug: string | undefined): string[] {
  if (slug && AGENT_PROMPTS[slug]) {
    return AGENT_PROMPTS[slug]
  }
  return DEFAULT_PROMPTS
}
