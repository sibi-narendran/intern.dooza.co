import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserProfile, getUserOrganizations, checkProductAccess } from '../lib/api'

const AuthContext = createContext({
  user: null,
  profile: null,
  organizations: [],
  currentOrg: null,
  productAccess: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  setCurrentOrg: () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [currentOrg, setCurrentOrg] = useState(null)
  const [productAccess, setProductAccess] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch full profile data from public.users and related tables
  // This is NON-BLOCKING - auth will complete even if this fails
  const fetchProfileData = async (authUser) => {
    if (!authUser) {
      setProfile(null)
      setOrganizations([])
      setCurrentOrg(null)
      setProductAccess(null)
      return
    }

    console.log('[Auth] Fetching profile data for:', authUser.id)

    // Fetch profile data in parallel, with individual error handling
    // Don't let one failure block the others
    const profilePromise = getUserProfile(authUser.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Profile] Error:', error.message)
          return null
        }
        console.log('[Profile] Loaded:', data?.email)
        return data
      })
      .catch(err => {
        console.error('[Profile] Exception:', err.message)
        return null
      })

    const orgsPromise = getUserOrganizations(authUser.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Orgs] Error:', error.message)
          return []
        }
        console.log('[Orgs] Loaded:', data?.length || 0, 'organizations')
        return data || []
      })
      .catch(err => {
        console.error('[Orgs] Exception:', err.message)
        return []
      })

    const accessPromise = checkProductAccess(authUser.id, 'agent')
      .then(({ hasAccess, role, orgId, error }) => {
        if (error) {
          console.error('[Access] Error:', error.message)
          return { hasAccess: false, role: null, orgId: null }
        }
        console.log('[Access] Agent access:', hasAccess ? `Yes (${role})` : 'No')
        return { hasAccess, role, orgId }
      })
      .catch(err => {
        console.error('[Access] Exception:', err.message)
        return { hasAccess: false, role: null, orgId: null }
      })

    // Wait for all with a timeout
    try {
      const results = await Promise.race([
        Promise.all([profilePromise, orgsPromise, accessPromise]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
        )
      ])

      const [profileData, orgsData, accessData] = results
      setProfile(profileData)
      setOrganizations(orgsData)
      if (orgsData?.length > 0) {
        setCurrentOrg(orgsData[0])
      }
      setProductAccess(accessData)
    } catch (err) {
      console.error('[Auth] Profile fetch failed or timed out:', err.message)
      // Still continue - user can use the app with just auth data
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileData(user)
    }
  }

  useEffect(() => {
    let isMounted = true
    let authCompleted = false  // Track if auth has completed
    
    // Timeout to prevent infinite loading - only if auth hasn't completed
    const timeout = setTimeout(() => {
      if (isMounted && !authCompleted) {
        console.error('Auth check timed out after 10 seconds')
        setLoading(false)
        // Don't set user to null - just stop loading
      }
    }, 10000)

    // Get initial session
    const getSession = async () => {
      try {
        console.log('[Auth] Checking session...')
        console.log('[Auth] Cookies available:', document.cookie ? 'Yes' : 'No')
        
        // Log all sb-* cookies (without values for security)
        const sbCookies = document.cookie
          .split(';')
          .filter(c => c.trim().startsWith('sb-'))
          .map(c => c.trim().split('=')[0])
        console.log('[Auth] Supabase cookies found:', sbCookies.length > 0 ? sbCookies : 'None')
        
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth] Error getting session:', error.message, error)
          if (isMounted) {
            setUser(null)
            setLoading(false)
          }
          return
        }
        
        const session = data?.session
        const authUser = session?.user ?? null
        console.log('[Auth] Session result:', {
          hasSession: !!session,
          hasUser: !!authUser,
          email: authUser?.email || 'N/A'
        })
        
        if (isMounted) {
          authCompleted = true  // Mark auth as completed
          setUser(authUser)
          setLoading(false)
          
          // Fetch profile in background (non-blocking)
          if (authUser) {
            fetchProfileData(authUser)
          }
        }
      } catch (err) {
        console.error('[Auth] Exception during session check:', err.message, err)
        if (isMounted) {
          authCompleted = true  // Mark auth as completed (even on error)
          setUser(null)
          setLoading(false)
        }
      }
    }

    getSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] State change:', event)
        if (!isMounted) return
        
        authCompleted = true  // Mark auth as completed
        const authUser = session?.user ?? null
        setUser(authUser)
        setLoading(false)
        
        // Fetch profile in background (non-blocking)
        if (authUser) {
          fetchProfileData(authUser)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(timeout)
      subscription?.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      // Redirect to accounts app after logout
      const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
      window.location.href = `${accountsUrl}/signin`
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    profile,
    organizations,
    currentOrg,
    productAccess,
    loading,
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
