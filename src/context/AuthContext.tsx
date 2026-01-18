import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useRef, 
  useCallback,
  type ReactNode 
} from 'react'
import { supabase, resetAuthRateLimiter, forceAuthReset } from '../lib/supabase'
import { 
  getUserProfile, 
  getUserOrganizations, 
  checkProductAccess,
  type UserProfile,
  type Organization,
  type ProductAccess
} from '../lib/api'
import type { User, AuthChangeEvent } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  profile: UserProfile | null
  organizations: Organization[]
  currentOrg: Organization | null
  productAccess: ProductAccess | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setCurrentOrg: (org: Organization | null) => void
}

// ============================================================================
// Constants
// ============================================================================

const ACCOUNTS_URL = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'

// Allowed redirect origins (prevent open redirect attacks)
const ALLOWED_REDIRECT_ORIGINS = [
  window.location.origin,
  'https://accounts.dooza.ai',
  'https://agent.dooza.ai',
  'https://dooza.ai',
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
]

// Circuit breaker settings
const MAX_AUTH_FAILURES = 3
const AUTH_FAILURE_RESET_MS = 60_000 // Reset failure count after 1 minute of no failures

// Storage event key for multi-tab sync
const AUTH_SYNC_KEY = 'dooza-auth-sync'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate that a redirect URL is safe (same origin or allowed origins)
 * Prevents open redirect attacks
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_REDIRECT_ORIGINS.some(origin => parsed.origin === origin)
  } catch {
    // Invalid URL - allow relative paths
    return url.startsWith('/')
  }
}

/**
 * Get safe redirect URL, falling back to current origin if invalid
 */
function getSafeRedirectUrl(): string {
  const currentUrl = window.location.href
  if (isValidRedirectUrl(currentUrl)) {
    return encodeURIComponent(currentUrl)
  }
  // Fallback to just the pathname if origin is suspicious
  return encodeURIComponent(window.location.origin + window.location.pathname)
}

/**
 * Redirect to login page with validated URL
 */
function redirectToLogin(): void {
  const redirectUrl = getSafeRedirectUrl()
  window.location.href = `${ACCOUNTS_URL}/signin?redirect=${redirectUrl}`
}

/**
 * Broadcast auth state change to other tabs
 */
function broadcastAuthChange(type: 'SIGNED_OUT' | 'SIGNED_IN' | 'SESSION_EXPIRED'): void {
  try {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ type, timestamp: Date.now() }))
    // Remove immediately - we only care about the storage event
    localStorage.removeItem(AUTH_SYNC_KEY)
  } catch {
    // Storage might be unavailable
  }
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Core state
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [productAccess, setProductAccess] = useState<ProductAccess | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Refs for preventing duplicate operations
  const profileFetchedRef = useRef(false)
  const initializingRef = useRef(false)
  const initialSessionHandledRef = useRef(false) // Prevents race between INITIAL_SESSION and getSession
  
  // Circuit breaker refs
  const authFailureCountRef = useRef(0)
  const lastFailureTimeRef = useRef(0)
  const isHandlingErrorRef = useRef(false)

  // ============================================================================
  // Circuit Breaker Logic
  // ============================================================================

  /**
   * Record an auth failure and check if we should stop retrying
   * Returns true if we've hit the failure limit and should give up
   */
  const recordAuthFailure = useCallback((): boolean => {
    const now = Date.now()
    
    // Reset failure count if enough time has passed since last failure
    if (now - lastFailureTimeRef.current > AUTH_FAILURE_RESET_MS) {
      authFailureCountRef.current = 0
    }
    
    authFailureCountRef.current++
    lastFailureTimeRef.current = now
    
    return authFailureCountRef.current >= MAX_AUTH_FAILURES
  }, [])

  /**
   * Handle unrecoverable auth failure - clear storage and redirect to login
   */
  const handleUnrecoverableAuthFailure = useCallback(async () => {
    // Prevent multiple simultaneous handling
    if (isHandlingErrorRef.current) return
    isHandlingErrorRef.current = true

    console.warn('[Auth] Unrecoverable auth failure - clearing session and redirecting to login')
    
    // Clear all auth state
    setUser(null)
    setProfile(null)
    setOrganizations([])
    setCurrentOrg(null)
    setProductAccess(null)
    setLoading(false)
    
    // Clear potentially corrupted storage (uses centralized function)
    await forceAuthReset()
    
    // Broadcast to other tabs
    broadcastAuthChange('SESSION_EXPIRED')
    
    // Small delay to ensure state is cleared before redirect
    setTimeout(() => {
      redirectToLogin()
    }, 100)
  }, [])

  // ============================================================================
  // Profile Data Fetching
  // ============================================================================

  // Track ongoing fetch to prevent race conditions
  const profileFetchAbortRef = useRef<AbortController | null>(null)

  const fetchProfileData = useCallback(async (authUser: User) => {
    if (!authUser) return
    
    // Cancel any ongoing fetch
    if (profileFetchAbortRef.current) {
      profileFetchAbortRef.current.abort()
    }
    
    // Skip if already fetched for this user
    if (profileFetchedRef.current) return
    
    const abortController = new AbortController()
    profileFetchAbortRef.current = abortController
    profileFetchedRef.current = true

    try {
      const [profileResult, orgsResult, accessResult] = await Promise.all([
        getUserProfile(authUser.id).catch(() => ({ data: null, error: new Error('Failed') })),
        getUserOrganizations(authUser.id).catch(() => ({ data: [], error: new Error('Failed') })),
        checkProductAccess(authUser.id, 'workforce').catch(() => ({ 
          hasAccess: false, role: null, orgId: null, error: new Error('Failed') 
        }))
      ])

      // Check if aborted before setting state
      if (abortController.signal.aborted) return

      if (profileResult.data) {
        setProfile(profileResult.data)
      }

      if (orgsResult.data && orgsResult.data.length > 0) {
        setOrganizations(orgsResult.data)
        setCurrentOrg(orgsResult.data[0])
      }

      setProductAccess({
        hasAccess: accessResult.hasAccess ?? false,
        role: accessResult.role,
        orgId: accessResult.orgId
      })
    } catch {
      // Profile fetch failed - allow retry on next attempt
      if (!abortController.signal.aborted) {
        profileFetchedRef.current = false
      }
    } finally {
      if (profileFetchAbortRef.current === abortController) {
        profileFetchAbortRef.current = null
      }
    }
  }, [])

  const resetProfileState = useCallback(() => {
    profileFetchedRef.current = false
    setProfile(null)
    setOrganizations([])
    setCurrentOrg(null)
    setProductAccess(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchedRef.current = false
      await fetchProfileData(user)
    }
  }, [user, fetchProfileData])

  // ============================================================================
  // Sign Out
  // ============================================================================

  const signOut = useCallback(async () => {
    try {
      // Clear local state first
      resetProfileState()
      setUser(null)
      
      // Broadcast to other tabs BEFORE clearing storage
      broadcastAuthChange('SIGNED_OUT')
      
      // Clear storage and sign out (uses centralized function)
      await forceAuthReset()
      
      // Redirect to login
      window.location.href = `${ACCOUNTS_URL}/signin`
    } catch {
      // Even if everything fails, redirect to login
      window.location.href = ACCOUNTS_URL
    }
  }, [resetProfileState])

  // ============================================================================
  // Auth State Change Handler
  // ============================================================================

  // Use ref to always access latest state without recreating the callback
  const userRef = useRef<User | null>(null)
  userRef.current = user

  const handleAuthStateChange = useCallback((event: AuthChangeEvent, session: { user: User } | null) => {
    // Ignore events while we're handling an error
    if (isHandlingErrorRef.current) return

    switch (event) {
      case 'SIGNED_IN':
        if (session?.user) {
          // Reset failure count on successful sign in
          authFailureCountRef.current = 0
          
          // Use ref to get current user value
          const currentUser = userRef.current
          if (!currentUser || currentUser.id !== session.user.id) {
            setUser(session.user)
            resetProfileState()
            fetchProfileData(session.user)
          }
          setLoading(false)
        }
        break

      case 'SIGNED_OUT':
        setUser(null)
        resetProfileState()
        setLoading(false)
        break

      case 'TOKEN_REFRESHED':
        if (session?.user) {
          // Reset failure count on successful token refresh
          authFailureCountRef.current = 0
          setUser(session.user)
        }
        break

      case 'USER_UPDATED':
        if (session?.user) {
          setUser(session.user)
        }
        break

      // Handle initial session on page load
      case 'INITIAL_SESSION':
        // Mark that we've handled the initial session (prevents race with initializeAuth)
        initialSessionHandledRef.current = true
        
        if (session?.user) {
          // User has a valid session (e.g., returning from OAuth redirect)
          authFailureCountRef.current = 0
          resetAuthRateLimiter()
          
          // Only reset profile if user changed
          const currentUser = userRef.current
          if (!currentUser || currentUser.id !== session.user.id) {
            setUser(session.user)
            resetProfileState()
            fetchProfileData(session.user)
          }
        }
        // Always set loading to false after initial session check
        setLoading(false)
        break

      default:
        // Unknown events - log for debugging in development
        if (import.meta.env.DEV) {
          console.log('[Auth] Unhandled auth event:', event)
        }
    }
  }, [resetProfileState, fetchProfileData]) // Removed 'user' - using ref instead

  // ============================================================================
  // Initialization Effect
  // ============================================================================

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null
    
    // Skip if already initializing, but use a timeout to ensure we don't get stuck
    // This handles HMR cases where refs persist but effects re-run
    if (initializingRef.current) {
      // Safety timeout: if we're stuck in loading after 5 seconds, force re-init
      const safetyTimeout = setTimeout(() => {
        if (mounted && loading) {
          console.warn('[Auth] Safety timeout triggered - forcing re-initialization')
          initializingRef.current = false
          isHandlingErrorRef.current = false
          setLoading(false)
        }
      }, 5000)
      
      return () => {
        mounted = false
        clearTimeout(safetyTimeout)
      }
    }
    
    initializingRef.current = true

    const initializeAuth = async () => {
      try {
        // =========================================================
        // STEP 1: Check for tokens in URL hash (cross-domain redirect)
        // =========================================================
        // When redirected from accounts.dooza.ai with tokens in hash:
        // http://localhost:5173/#access_token=...&refresh_token=...
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        if (accessToken && refreshToken) {
          console.log('[Auth] Detected tokens in URL hash - setting session')
          
          // Clean URL immediately (security: removes tokens from browser history)
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          
          // Set the session with the tokens from URL
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (!mounted) return
          
          if (setSessionError) {
            console.error('[Auth] Failed to set session from URL:', setSessionError.message)
            // Fall through to normal getSession flow
          } else if (data.session?.user) {
            console.log('[Auth] Session established from URL tokens')
            authFailureCountRef.current = 0
            resetAuthRateLimiter()
            setUser(data.session.user)
            fetchProfileData(data.session.user)
            setLoading(false)
            return // Success - exit early
          }
        }
        
        // =========================================================
        // STEP 2: Normal session check (existing session or no session)
        // =========================================================
        // Get current session - this may trigger a token refresh
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        // If INITIAL_SESSION already handled this, skip to avoid double processing
        if (initialSessionHandledRef.current) {
          // Just ensure loading is false (might already be)
          setLoading(false)
          return
        }

        if (error) {
          // Check if this is a rate limit or auth error
          const errorMessage = error.message?.toLowerCase() || ''
          const isRateLimited = errorMessage.includes('rate') || errorMessage.includes('429')
          const isAuthError = errorMessage.includes('refresh_token') || 
                             errorMessage.includes('invalid') ||
                             errorMessage.includes('expired') ||
                             errorMessage.includes('auth_blocked')
          
          if (isRateLimited || isAuthError) {
            const shouldGiveUp = recordAuthFailure()
            if (shouldGiveUp) {
              handleUnrecoverableAuthFailure()
              return
            }
          }
          
          // Non-fatal error - continue without session
          setLoading(false)
          return
        }

        // Success - we have a valid session or no session
        if (session?.user) {
          authFailureCountRef.current = 0 // Reset on success
          resetAuthRateLimiter() // Reset the fetch-level rate limiter too
          setUser(session.user)
          fetchProfileData(session.user)
        }
        
        setLoading(false)
      } catch (err) {
        if (!mounted) return
        
        // Unexpected error - check if we should give up
        const shouldGiveUp = recordAuthFailure()
        if (shouldGiveUp) {
          handleUnrecoverableAuthFailure()
          return
        }
        
        setLoading(false)
      }
    }

    // Set up auth state listener BEFORE initializing
    // This ensures we don't miss any events
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      handleAuthStateChange(event, session)
    })
    subscription = data.subscription

    // Listen for session corruption events from the Supabase client
    const handleSessionCorrupted = () => {
      if (!mounted || isHandlingErrorRef.current) return
      console.warn('[Auth] Session corruption detected at fetch level')
      handleUnrecoverableAuthFailure()
    }
    window.addEventListener('supabase:session-corrupted', handleSessionCorrupted)

    // Listen for auth changes from other tabs (multi-tab sync)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_KEY || !event.newValue) return
      
      try {
        const { type } = JSON.parse(event.newValue)
        if (type === 'SIGNED_OUT' || type === 'SESSION_EXPIRED') {
          console.log('[Auth] Sign out detected from another tab')
          // Don't redirect - just clear local state
          // The other tab is handling the redirect
          setUser(null)
          resetProfileState()
          setLoading(false)
          // Clear local storage too
          forceAuthReset()
        }
      } catch {
        // Ignore invalid JSON
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Now initialize
    initializeAuth()

    // Cleanup
    return () => {
      mounted = false
      subscription?.unsubscribe()
      window.removeEventListener('supabase:session-corrupted', handleSessionCorrupted)
      window.removeEventListener('storage', handleStorageChange)
      // Reset refs on unmount so HMR/re-mounts work correctly
      initializingRef.current = false
      isHandlingErrorRef.current = false
      initialSessionHandledRef.current = false
    }
  }, [handleUnrecoverableAuthFailure, resetProfileState, handleAuthStateChange, fetchProfileData, recordAuthFailure])

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    profile,
    organizations,
    currentOrg,
    productAccess,
    signOut,
    refreshProfile,
    setCurrentOrg,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
