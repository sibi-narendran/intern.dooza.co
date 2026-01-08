import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useRef, 
  useCallback,
  type ReactNode 
} from 'react'
import { supabase } from '../lib/supabase'
import { 
  getUserProfile, 
  getUserOrganizations, 
  checkProductAccess,
  type UserProfile,
  type Organization,
  type ProductAccess
} from '../lib/api'
import type { User } from '@supabase/supabase-js'

// Types
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

// Context
const AuthContext = createContext<AuthContextType | null>(null)

// Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Provider
interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [productAccess, setProductAccess] = useState<ProductAccess | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Refs to prevent duplicate fetches and track initialization
  const profileFetchedRef = useRef(false)
  const initializingRef = useRef(false)

  // Fetch profile data - only once per user
  const fetchProfileData = useCallback(async (authUser: User) => {
    if (!authUser || profileFetchedRef.current) return
    profileFetchedRef.current = true

    try {
      const [profileResult, orgsResult, accessResult] = await Promise.all([
        getUserProfile(authUser.id).catch(() => ({ data: null, error: new Error('Failed') })),
        getUserOrganizations(authUser.id).catch(() => ({ data: [], error: new Error('Failed') })),
        checkProductAccess(authUser.id, 'agent').catch(() => ({ 
          hasAccess: false, role: null, orgId: null, error: new Error('Failed') 
        }))
      ])

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
      // Profile fetch failed - app continues with auth data only
    }
  }, [])

  // Reset profile state
  const resetProfileState = useCallback(() => {
    profileFetchedRef.current = false
    setProfile(null)
    setOrganizations([])
    setCurrentOrg(null)
    setProductAccess(null)
  }, [])

  // Refresh profile manually
  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchedRef.current = false
      await fetchProfileData(user)
    }
  }, [user, fetchProfileData])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      resetProfileState()
      setUser(null)
      
      const accountsUrl = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
      window.location.href = `${accountsUrl}/signin`
    } catch {
      window.location.href = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.dooza.ai'
    }
  }, [resetProfileState])

  // Initialize auth
  useEffect(() => {
    if (initializingRef.current) return
    initializingRef.current = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          fetchProfileData(session.user)
        }
        
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          if (!user || user.id !== session.user.id) {
            setUser(session.user)
            resetProfileState()
            fetchProfileData(session.user)
          }
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          resetProfileState()
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

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
