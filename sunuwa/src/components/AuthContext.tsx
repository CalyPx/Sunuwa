'use client'

import {
  createContext, useContext, useEffect, useState,
  useCallback, type ReactNode,
} from 'react'
import AuthModal from '@/components/AuthModal'

const SESSION_KEY  = 'sunuwa_citizen_session'
const SESSION_TTL  = 24 * 60 * 60 * 1000   // 24 hours

// ── Types ──────────────────────────────────────────────────────────────────
export interface Citizen {
  phone_number: string
  authenticated: boolean
  expiresAt: number
}

interface StoredSession {
  phone_number: string
  expiresAt: number
}

interface AuthContextValue {
  citizen:   Citizen | null
  loading:   boolean
  authOpen:  boolean
  openAuth:  () => void
  closeAuth: () => void
  signOut:   () => void
}

// ── Context ────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  citizen:   null,
  loading:   true,
  authOpen:  false,
  openAuth:  () => {},
  closeAuth: () => {},
  signOut:   () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// ── Helpers ────────────────────────────────────────────────────────────────
function readSession(): Citizen | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s: StoredSession = JSON.parse(raw)
    if (Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { phone_number: s.phone_number, authenticated: true, expiresAt: s.expiresAt }
  } catch {
    return null
  }
}

export function writeSession(phone: string): Citizen {
  const expiresAt = Date.now() + SESSION_TTL
  const session: StoredSession = { phone_number: phone, expiresAt }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { phone_number: phone, authenticated: true, expiresAt }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [citizen,  setCitizen]  = useState<Citizen | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    setCitizen(readSession())
    setLoading(false)
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setCitizen(null)
  }, [])

  const handleSuccess = useCallback((phone: string) => {
    const c = writeSession(phone)
    setCitizen(c)
    setAuthOpen(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      citizen, loading,
      authOpen,
      openAuth:  () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      signOut,
    }}>
      {children}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </AuthContext.Provider>
  )
}
