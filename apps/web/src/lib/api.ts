import { supabase } from './supabase'

// Types
export interface UserProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  intended_product: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string | null
  owner_id: string
  created_at: string
  updated_at: string
  role?: string
  products?: { product: string; role: string }[]
}

export interface ProductAccess {
  hasAccess: boolean
  role: string | null
  orgId: string | null
}

interface ApiResponse<T> {
  data: T | null
  error: Error | null
}

/**
 * Fetch user profile from public.users table
 */
export async function getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

/**
 * Fetch user's organizations with their role
 */
export async function getUserOrganizations(userId: string): Promise<ApiResponse<Organization[]>> {
  // Get organizations where user is owner
  const { data: ownedOrgs, error: ownedError } = await supabase
    .from('organizations')
    .select('*')
    .eq('owner_id', userId)

  if (ownedError) {
    return { data: null, error: ownedError }
  }

  // Get organizations through product_access
  const { data: accessOrgs, error: accessError } = await supabase
    .from('product_access')
    .select(`
      org_id,
      product,
      role,
      organizations (
        id,
        name,
        slug,
        owner_id
      )
    `)
    .eq('user_id', userId)

  if (accessError) {
    return { data: null, error: accessError }
  }

  // Merge and deduplicate organizations
  const orgMap = new Map<string, Organization>()
  
  ownedOrgs?.forEach(org => {
    orgMap.set(org.id, { ...org, role: 'owner', products: [] })
  })

  accessOrgs?.forEach((access) => {
    const org = access.organizations as unknown as Organization | null
    if (org) {
      const existing = orgMap.get(access.org_id)
      if (existing) {
        existing.products?.push({ product: access.product, role: access.role })
      } else {
        orgMap.set(access.org_id, {
          ...org,
          role: access.role,
          products: [{ product: access.product, role: access.role }]
        })
      }
    }
  })

  return { data: Array.from(orgMap.values()), error: null }
}

/**
 * Check if user has access to a specific product
 */
export async function checkProductAccess(
  userId: string, 
  product: string = 'workforce'
): Promise<ProductAccess & { error: Error | null }> {
  const { data, error } = await supabase
    .from('product_access')
    .select('*')
    .eq('user_id', userId)
    .eq('product', product)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { hasAccess: false, role: null, orgId: null, error }
  }

  return {
    hasAccess: !!data,
    role: data?.role || null,
    orgId: data?.org_id || null,
    error: null
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string, 
  updates: Partial<UserProfile>
): Promise<ApiResponse<UserProfile>> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}
