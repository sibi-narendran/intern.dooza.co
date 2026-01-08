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
  const fetchProfileData = async (authUser) => {
    if (!authUser) {
      setProfile(null)
      setOrganizations([])
      setCurrentOrg(null)
      setProductAccess(null)
      return
    }

    try {
      // Fetch user profile from public.users
      const { data: profileData, error: profileError } = await getUserProfile(authUser.id)
      if (profileError) {
        console.error('Error fetching profile:', profileError)
      } else {
        setProfile(profileData)
      }

      // Fetch user's organizations
      const { data: orgsData, error: orgsError } = await getUserOrganizations(authUser.id)
      if (orgsError) {
        console.error('Error fetching organizations:', orgsError)
      } else {
        setOrganizations(orgsData || [])
        // Set first org as current if none selected
        if (orgsData?.length > 0 && !currentOrg) {
          setCurrentOrg(orgsData[0])
        }
      }

      // Check agent product access
      const { hasAccess, role, orgId, error: accessError } = await checkProductAccess(authUser.id, 'agent')
      if (accessError) {
        console.error('Error checking product access:', accessError)
      } else {
        setProductAccess({ hasAccess, role, orgId })
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileData(user)
    }
  }

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        }
        const authUser = session?.user ?? null
        setUser(authUser)
        await fetchProfileData(authUser)
      } catch (err) {
        console.error('Failed to get session:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authUser = session?.user ?? null
        setUser(authUser)
        await fetchProfileData(authUser)
        setLoading(false)
      }
    )

    return () => {
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
