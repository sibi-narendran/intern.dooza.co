import { supabase } from './supabase'

/**
 * Fetch user profile from public.users table
 * @param {string} userId - The user's UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

/**
 * Fetch user's organizations with their role
 * @param {string} userId - The user's UUID
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getUserOrganizations(userId) {
  // Get organizations where user is owner OR has product access
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
  const orgMap = new Map()
  
  ownedOrgs?.forEach(org => {
    orgMap.set(org.id, { ...org, role: 'owner', products: [] })
  })

  accessOrgs?.forEach(access => {
    if (access.organizations) {
      const existing = orgMap.get(access.org_id)
      if (existing) {
        existing.products.push({ product: access.product, role: access.role })
      } else {
        orgMap.set(access.org_id, {
          ...access.organizations,
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
 * @param {string} userId - The user's UUID
 * @param {string} product - Product name ('agent', 'desk', 'table', etc.)
 * @returns {Promise<{hasAccess: boolean, role: string|null, orgId: string|null, error: Error|null}>}
 */
export async function checkProductAccess(userId, product = 'agent') {
  const { data, error } = await supabase
    .from('product_access')
    .select('*')
    .eq('user_id', userId)
    .eq('product', product)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
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
 * @param {string} userId - The user's UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateUserProfile(userId, updates) {
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
