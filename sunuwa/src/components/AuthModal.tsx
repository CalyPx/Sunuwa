'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Design tokens ──────────────────────────────────────────────────────────
const NAVY   = '#0F172A'
const NAVY2  = '#1E293B'
const RED    = '#DC2626'
const RED_H  = '#B91C1C'
const SLATE  = '#94A3B8'
const DEV    = 'Noto Sans Devanagari, sans-serif'

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

type Screen = 'phone' | 'otp'

// ── Helpers ────────────────────────────────────────────────────────────────
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return '+977' + digits
}

function isValidNepalPhone(phone: string): boolean {
  return /^(97|98)\d{8}$/.test(phone.replace(/\s/g, ''))
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, onSuccess }: Props) {
  const [screen,    setScreen]    = useState<Screen>('phone')
  const [phone,     setPhone]     = useState('')
  const [otp,       setOtp]       = useState(['', '', '', '', '', ''])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resendSec, setResendSec] = useState(0)

  const phoneRef  = useRef<HTMLInputElement>(null)
  const otpRefs   = useRef<(HTMLInputElement | null)[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Focus phone input on mount
  useEffect(() => { phoneRef.current?.focus() }, [])

  // Resend countdown
  const startCountdown = useCallback(() => {
    setResendSec(30)
    timerRef.current = setInterval(() => {
      setResendSec(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0 }
        return s - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Focus first OTP box when screen changes
  useEffect(() => {
    if (screen === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 80)
  }, [screen])

  // ── Send OTP ─────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError('')
    const clean = phone.replace(/\s/g, '')
    if (!isValidNepalPhone(clean)) {
      setError('मान्य नेपाली फोन नम्बर प्रविष्ट गर्नुहोस् (98XXXXXXXX)')
      return
    }
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone: toE164(clean) })
      if (e) throw e
      setScreen('otp')
      startCountdown()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'OTP पठाउन सकिएन। पुनः प्रयास गर्नुहोस्।'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async (code: string) => {
    setError('')
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: toE164(phone.replace(/\s/g, '')),
        token: code,
        type:  'sms',
      })
      if (e) throw e
      onSuccess()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'गलत कोड। पुनः प्रयास गर्नुहोस्।'
      setError(msg)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }, [phone, onSuccess])

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[idx] = val
    setOtp(next)
    setError('')

    if (val && idx < 5) otpRefs.current[idx + 1]?.focus()

    // Auto-submit when all 6 filled
    if (val && idx === 5) {
      const code = [...next.slice(0, 5), val].join('')
      if (code.length === 6) handleVerify(code)
    }
  }

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      handleVerify(text)
    }
  }

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendSec > 0) return
    setError('')
    setOtp(['', '', '', '', '', ''])
    const { error: e } = await supabase.auth.signInWithOtp({ phone: toE164(phone.replace(/\s/g, '')) })
    if (e) { setError('पुनः पठाउन सकिएन।'); return }
    startCountdown()
    setTimeout(() => otpRefs.current[0]?.focus(), 80)
  }

  // ── Close on backdrop click ───────────────────────────────────────────────
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const otpFull = otp.every(d => d !== '')

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: NAVY, borderRadius: 16,
        width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        animation: 'authSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 20, background: RED }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: SLATE, textTransform: 'uppercase' }}>
                {screen === 'phone' ? 'नागरिक पहिचान' : 'OTP प्रमाणीकरण'}
              </span>
            </div>
            <h2 style={{ fontFamily: DEV, fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
              {screen === 'phone' ? 'लग इन / दर्ता' : 'कोड प्रविष्ट गर्नुहोस्'}
            </h2>
            <p style={{ fontFamily: DEV, fontSize: 13, color: SLATE, margin: '6px 0 0', lineHeight: 1.5 }}>
              {screen === 'phone'
                ? 'कुनै पासवर्ड आवश्यक छैन। फोन नम्बरले मात्र पहिचान हुन्छ।'
                : `${phone} मा OTP पठाइयो।`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: SLATE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div style={{ padding: '24px' }}>

          {/* PHONE SCREEN */}
          {screen === 'phone' && (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SLATE, marginBottom: 8, letterSpacing: '0.04em' }}>
                फोन नम्बर
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: NAVY2, borderRadius: 10, border: `1.5px solid ${error ? RED : 'rgba(255,255,255,0.1)'}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                <span style={{ padding: '0 12px 0 14px', fontSize: 14, color: SLATE, fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.08)', lineHeight: '50px', whiteSpace: 'nowrap' }}>
                  🇳🇵 +977
                </span>
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    padding: '0 14px', height: 50, fontSize: 17, fontWeight: 600,
                    color: '#fff', letterSpacing: '0.06em', fontFamily: 'monospace',
                  }}
                />
              </div>

              {error && (
                <p style={{ fontFamily: DEV, fontSize: 12, color: '#FCA5A5', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </p>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || phone.length < 10}
                style={{
                  width: '100%', marginTop: 16, height: 50, borderRadius: 10, border: 'none',
                  background: loading || phone.length < 10 ? 'rgba(220,38,38,0.4)' : RED,
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || phone.length < 10 ? 'not-allowed' : 'pointer',
                  fontFamily: DEV, letterSpacing: '0.02em', transition: 'background 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading && phone.length >= 10) (e.currentTarget as HTMLButtonElement).style.background = RED_H }}
                onMouseLeave={e => { if (!loading && phone.length >= 10) (e.currentTarget as HTMLButtonElement).style.background = RED }}
              >
                {loading ? (
                  <><Spinner /> OTP पठाउँदै...</>
                ) : (
                  <>OTP पठाउनुहोस् →</>
                )}
              </button>

              <p style={{ textAlign: 'center', fontSize: 11, color: SLATE, marginTop: 14, lineHeight: 1.6 }}>
                लग इन गर्नाले तपाईं Sunuwa को{' '}
                <span style={{ color: '#93C5FD' }}>सेवाका शर्तहरू</span> मान्नुभएको हुन्छ।
              </p>
            </>
          )}

          {/* OTP SCREEN */}
          {screen === 'otp' && (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SLATE, marginBottom: 16, letterSpacing: '0.04em' }}>
                ६-अङ्कको कोड
              </label>

              <div
                onPaste={handleOtpPaste}
                style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    disabled={loading}
                    style={{
                      width: 46, height: 54, textAlign: 'center', fontSize: 22, fontWeight: 700,
                      background: digit ? 'rgba(220,38,38,0.12)' : NAVY2,
                      border: `2px solid ${digit ? RED : error ? RED : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 10, color: digit ? '#fff' : SLATE,
                      outline: 'none', transition: 'all 0.12s',
                      fontFamily: 'monospace', cursor: loading ? 'not-allowed' : 'text',
                    }}
                  />
                ))}
              </div>

              {error && (
                <p style={{ fontFamily: DEV, fontSize: 12, color: '#FCA5A5', marginTop: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </p>
              )}

              <button
                onClick={() => handleVerify(otp.join(''))}
                disabled={!otpFull || loading}
                style={{
                  width: '100%', marginTop: 20, height: 50, borderRadius: 10, border: 'none',
                  background: !otpFull || loading ? 'rgba(220,38,38,0.4)' : RED,
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: !otpFull || loading ? 'not-allowed' : 'pointer',
                  fontFamily: DEV, transition: 'background 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (otpFull && !loading) (e.currentTarget as HTMLButtonElement).style.background = RED_H }}
                onMouseLeave={e => { if (otpFull && !loading) (e.currentTarget as HTMLButtonElement).style.background = RED }}
              >
                {loading ? <><Spinner /> प्रमाणीकरण...</> : 'पुष्टि गर्नुहोस् →'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <button
                  onClick={() => { setScreen('phone'); setOtp(['', '', '', '', '', '']); setError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: SLATE, fontFamily: DEV }}
                >
                  ← फोन बदल्नुहोस्
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendSec > 0}
                  style={{ background: 'none', border: 'none', cursor: resendSec > 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: resendSec > 0 ? SLATE : '#93C5FD', fontFamily: DEV }}
                >
                  {resendSec > 0 ? `पुनः पठाउनुहोस् (${resendSec}s)` : 'पुनः पठाउनुहोस्'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Demo hint ─────────────────────────────────────────────── */}
        <div style={{ margin: '0 24px 24px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: SLATE, margin: 0, lineHeight: 1.6 }}>
            <span style={{ color: '#FCD34D', fontWeight: 700 }}>Demo:</span>{' '}
            फोन <span style={{ fontFamily: 'monospace', color: '#fff' }}>9800000000</span> र OTP{' '}
            <span style={{ fontFamily: 'monospace', color: '#fff' }}>123456</span> प्रयोग गर्नुहोस्।
          </p>
        </div>
      </div>

      {/* Keyframe for slide-up animation */}
      <style>{`
        @keyframes authSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Tiny spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      style={{ animation: 'spin 0.7s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  )
}
