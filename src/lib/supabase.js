import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const cookieDomain = import.meta.env.VITE_COOKIE_DOMAIN

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use cookie-based sessions for cross-subdomain SSO
    storage: {
      getItem: (key) => {
        if (typeof document === 'undefined') return null
        const cookies = document.cookie.split(';')
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=')
          if (name === key) {
            return decodeURIComponent(value)
          }
        }
        return null
      },
      setItem: (key, value) => {
        if (typeof document === 'undefined') return
        const isSecure = window.location.protocol === 'https:'
        // Only set domain if we're actually on that domain (or subdomain)
        // This allows localhost development to work even if VITE_COOKIE_DOMAIN is set
        const domain = cookieDomain && window.location.hostname.includes(cookieDomain.replace(/^\./, '')) 
          ? `domain=${cookieDomain};` 
          : ''
        const secureAttr = isSecure ? ';Secure' : ''
        document.cookie = `${key}=${encodeURIComponent(value)};${domain}path=/;max-age=31536000;SameSite=Lax${secureAttr}`
      },
      removeItem: (key) => {
        if (typeof document === 'undefined') return
        const domain = cookieDomain && window.location.hostname.includes(cookieDomain.replace(/^\./, '')) 
          ? `domain=${cookieDomain};` 
          : ''
        document.cookie = `${key}=;${domain}path=/;max-age=0;SameSite=Lax`
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
