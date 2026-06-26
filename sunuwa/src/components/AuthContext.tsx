'use client'

import {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import AuthModal from '@/components/AuthModal'

// ── Types ──────────────────────────────────────────────────────────────────
export interface Citizen {
  id: string
  phone_number: string
  created_at: string
  ward_number: number | null
}

interface AuthContextValue {
  user:      User | null
  citizen:   Citizen | null
  loading:   boolean
  authOpen:  boolean
  openAuth:  () => void
  closeAuth: () => void
  signOut:   () => Promise<void>
}

// ── Context ────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user:      null,
  citizen:   null,
  loading:   true,
  authOpen:  false,
  openAuth:  () => {},
  closeAuth: () => {},
  signOut:   async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null)
  const [citizen,  setCitizen]  = useState<Citizen | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const mounted = useRef(true)

  const fetchCitizen = useCallback(async (uid: string) => {
    const { data } = await supabase.from('citizens').select('*').eq('id', uid).single()
    if (mounted.current) setCitizen(data ?? null)
  }, [])

  const upsertCitizen = useCallback(async (u: User) => {
    await supabase.from('citizens').upsert(
      { id: u.id, phone_number: u.phone ?? '' },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    await fetchCitizen(u.id)
  }, [fetchCitizen])

  useEffect(() => {
    mounted.current = true

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted.current) return
      const u = session?.user ?? null
      setUser(u)
      if (u) upsertCitizen(u)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted.current) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await upsertCitizen(u)
          setAuthOpen(false)   // close modal on successful login
        } else {
          setCitizen(null)
        }
      }
    )

    return () => {
      mounted.current = false
      subscription.unsubscribe()
    }
  }, [upsertCitizen])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCitizen(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, citizen, loading,
      authOpen,
      openAuth:  () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      signOut,
    }}>
      {children}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
        />
      )}
    </AuthContext.Provider>
  )
}
