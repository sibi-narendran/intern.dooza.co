import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Environment Variables
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const cookieDomain = import.meta.env.VITE_COOKIE_DOMAIN as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

// ============================================================================
// Auth Request Rate Limiting
// ============================================================================

/**
 * Tracks auth endpoint failures to prevent infinite retry loops.
 * When refresh token is invalid (400) or rate limited (429), Supabase's
 * internal retry mechanism can cause infinite loops. This intercepts
 * those failures at the fetch level.
 */
const authRateLimiter = {
  failureCount: 0,
  lastFailureTime: 0,
  isBlocked: false,
  blockUntil: 0,
  
  // After 3 rapid failures, block auth requests for 60 seconds
  MAX_FAILURES: 3,
  FAILURE_WINDOW_MS: 10_000, // Count failures within 10 seconds
  BLOCK_DURATION_MS: 60_000, // Block for 60 seconds after max failures
  
  recordFailure(): boolean {
    const now = Date.now()
    
    // Reset count if we're outside the failure window
    if (now - this.lastFailureTime > this.FAILURE_WINDOW_MS) {
      this.failureCount = 0
    }
    
    this.failureCount++
    this.lastFailureTime = now
    
    if (this.failureCount >= this.MAX_FAILURES) {
      this.isBlocked = true
      this.blockUntil = now + this.BLOCK_DURATION_MS
      console.warn('[Supabase] Auth rate limit triggered - blocking requests for 60s')
      return true
    }
    
    return false
  },
  
  shouldBlock(): boolean {
    if (!this.isBlocked) return false
    
    const now = Date.now()
    if (now >= this.blockUntil) {
      // Unblock and reset
      this.isBlocked = false
      this.failureCount = 0
      return false
    }
    
    return true
  },
  
  reset(): void {
    this.failureCount = 0
    this.isBlocked = false
    this.blockUntil = 0
  }
}

// Flag to track if we've already triggered a session clear
let isCleaningSession = false

// ============================================================================
// Supabase Client Configuration
// ============================================================================

/**
 * Browser Supabase client with production-safe configuration
 * 
 * Key settings:
 * - autoRefreshToken: true - Automatically refresh tokens before expiry
 * - persistSession: true - Store session in localStorage for persistence
 * - detectSessionInUrl: true - Handle OAuth redirects
 * - flowType: 'pkce' - Use PKCE flow for better security
 * 
 * The client uses @supabase/ssr for cross-domain cookie support
 */
export const supabase: SupabaseClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Session persistence
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      
      // Use implicit flow - tokens come from accounts.dooza.ai in URL hash
      // PKCE is used by accounts.dooza.ai during the actual OAuth flow
      // This app receives the final tokens, not a code to exchange
      flowType: 'implicit',
      
      // Storage key - use a consistent key to avoid orphaned sessions
      storageKey: 'dooza-agent-auth',
    },
    cookieOptions: {
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
    global: {
      // Custom fetch with rate limit protection for auth endpoints
      fetch: async (url, options) => {
        const urlString = typeof url === 'string' ? url : url.toString()
        const isAuthEndpoint = urlString.includes('/auth/v1/token')
        const isAnyAuthEndpoint = urlString.includes('/auth/v1/')
        
        // Block auth requests if we've hit the rate limit
        if (isAuthEndpoint && authRateLimiter.shouldBlock()) {
          // Return a fake 429 response to stop Supabase from retrying
          return new Response(
            JSON.stringify({ 
              error: 'rate_limited', 
              message: 'Auth requests temporarily blocked due to repeated failures' 
            }),
            { 
              status: 429, 
              headers: { 'Content-Type': 'application/json' } 
            }
          )
        }
        
        // Create timeout controller
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => timeoutController.abort(), 30_000) // 30s timeout
        
        // Merge with existing signal if present
        const existingSignal = options?.signal as AbortSignal | undefined
        let mergedSignal: AbortSignal = timeoutController.signal
        
        if (existingSignal) {
          // Use AbortSignal.any if available, otherwise just use timeout
          if ('any' in AbortSignal) {
            mergedSignal = AbortSignal.any([existingSignal, timeoutController.signal])
          }
        }
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: mergedSignal,
          })
          
          // Handle auth endpoint failures (400, 401, 429)
          if (isAnyAuthEndpoint && (response.status === 429 || response.status === 400 || response.status === 401)) {
            const shouldBlock = authRateLimiter.recordFailure()
            
            // On 400/401 (invalid/expired token), clear the corrupted session
            if ((response.status === 400 || response.status === 401) && !isCleaningSession) {
              isCleaningSession = true
              console.warn('[Supabase] Invalid/expired token detected - clearing session')
              
              // Schedule session cleanup (don't await - let current request complete)
              setTimeout(() => {
                clearAuthStorage()
                isCleaningSession = false
                // Dispatch custom event for AuthContext to handle
                window.dispatchEvent(new CustomEvent('supabase:session-corrupted'))
              }, 0)
            }
            
            // If we've hit the limit, return a blocking response
            if (shouldBlock) {
              return new Response(
                JSON.stringify({ 
                  error: 'auth_blocked', 
                  message: 'Session invalid - please sign in again' 
                }),
                { 
                  status: 401, 
                  headers: { 'Content-Type': 'application/json' } 
                }
              )
            }
          }
          
          // Reset rate limiter on successful auth requests
          if (isAuthEndpoint && response.ok) {
            authRateLimiter.reset()
          }
          
          return response
        } catch (error) {
          // Handle network errors gracefully
          if (error instanceof Error && error.name === 'AbortError') {
            // Timeout or manual abort
            return new Response(
              JSON.stringify({ error: 'timeout', message: 'Request timed out' }),
              { status: 408, headers: { 'Content-Type': 'application/json' } }
            )
          }
          // Re-throw other errors
          throw error
        } finally {
          clearTimeout(timeoutId)
        }
      },
    },
  }
)

// ============================================================================
// Auth Storage Utilities
// ============================================================================

/**
 * Clear all auth-related storage
 */
function clearAuthStorage(): void {
  const storageKeys = ['dooza-agent-auth']
  
  // Clear localStorage
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && (
      key.includes('supabase') || 
      key.includes('sb-') || 
      storageKeys.includes(key)
    )) {
      localStorage.removeItem(key)
    }
  }
  
  // Clear sessionStorage
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (key && (
      key.includes('supabase') || 
      key.includes('sb-') || 
      storageKeys.includes(key)
    )) {
      sessionStorage.removeItem(key)
    }
  }
}

// ============================================================================
// Auth Error Recovery Utilities
// ============================================================================

/**
 * Force clear all auth state - use this when auth is in an unrecoverable state
 * This is a last resort when the normal signOut flow fails
 */
export async function forceAuthReset(): Promise<void> {
  // Reset the rate limiter
  authRateLimiter.reset()
  isCleaningSession = false
  
  try {
    // Try normal sign out first
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Ignore errors - we're doing a force reset anyway
  }
  
  // Clear all auth storage
  clearAuthStorage()
}

/**
 * Reset the auth rate limiter - call this after successful login
 */
export function resetAuthRateLimiter(): void {
  authRateLimiter.reset()
}
