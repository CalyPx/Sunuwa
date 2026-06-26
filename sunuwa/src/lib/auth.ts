import { supabase } from './supabase'

export interface UserRole {
  role: 'ward' | 'ward_official' | 'minister' | 'admin'
  ward_id?: number
  ministry_slug?: string
}

/** Sign in with email + password. Returns role info on success. */
export async function signIn(email: string, password: string): Promise<{ user: UserRole | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { user: null, error: error?.message || 'Login failed' }

  // Fetch role from user_roles table
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, ward_id, ministry_slug')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!roleRow) return { user: null, error: 'No role assigned to this account. Contact admin.' }

  return { user: roleRow as UserRole, error: null }
}

/** Sign out */
export async function signOut() {
  await supabase.auth.signOut()
}

/** Get current session + role (call from page components) */
export async function getSessionAndRole(): Promise<{ user: UserRole | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { user: null }

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, ward_id, ministry_slug')
    .eq('user_id', session.user.id)
    .maybeSingle()

  return { user: (roleRow as UserRole) || null }
}
