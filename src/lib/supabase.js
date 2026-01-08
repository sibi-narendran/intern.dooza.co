import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const cookieDomain = import.meta.env.VITE_COOKIE_DOMAIN

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

// Use @supabase/ssr's createBrowserClient - same as accounts.dooza.ai
// This ensures cookie compatibility for cross-subdomain SSO
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    cookieOptions: {
      // Set domain for cross-subdomain cookie sharing
      // Must match the accounts app: .dooza.ai
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  }
)
