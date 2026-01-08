import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const cookieDomain = import.meta.env.VITE_COOKIE_DOMAIN

// Debug: Log configuration (remove in production if needed)
console.log('[Supabase] Config:', {
  url: supabaseUrl ? '✓ Set' : '✗ MISSING',
  key: supabaseAnonKey ? '✓ Set' : '✗ MISSING', 
  domain: cookieDomain || '(not set - using default)',
})

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase environment variables!\n' +
    'Make sure these are set in your .env file or Vercel dashboard:\n' +
    '  - VITE_SUPABASE_URL\n' +
    '  - VITE_SUPABASE_ANON_KEY\n' +
    '  - VITE_COOKIE_DOMAIN (for cross-subdomain auth)'
  )
}

// Use @supabase/ssr's createBrowserClient - same as accounts.dooza.ai
// This ensures cookie compatibility for cross-subdomain SSO
export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    cookieOptions: {
      // Set domain for cross-subdomain cookie sharing
      // Must match the accounts app: .dooza.ai
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  }
)
