'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Design tokens (match Sunuwa dark theme) ────────────────────────────────
const BG      = '#071633'
const CARD    = '#102447'
const PRIMARY = '#0E4DA4'
const ACCENT  = '#D7263D'
const BORDER  = 'rgba(255,255,255,0.1)'
const SLATE   = '#94A3B8'
const DEV     = 'Noto Sans Devanagari, sans-serif'

const DEMO_OTP   = '1111'
const DEMO_PHONE = /^(97|98)\d{8}$/

interface Props {
  onClose:   () => void
  onSuccess: (phone: string) => void
}

type Screen = 'phone' | 'otp'

function isValidPhone(p: string) { return DEMO_PHONE.test(p.replace(/\s/g, '')) }

// ── Main component ─────────────────────────────────────────────────────────
export default function AuthModal({ onClose, onSuccess }: Props) {
  const [screen,  setScreen]  = useState<Screen>('phone')
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const phoneRef = useRef<HTMLInputElement>(null)
  const otpRefs  = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { phoneRef.current?.focus() }, [])
  useEffect(() => {
    if (screen === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 80)
  }, [screen])

  // ── Send (demo: just advance screen) ──────────────────────────────────────
  const handleSend = () => {
    setError('')
    if (!isValidPhone(phone)) {
      setError('मान्य नेपाली फोन नम्बर प्रविष्ट गर्नुहोस् (98XXXXXXXX)')
      return
    }
    setScreen('otp')
  }

  // ── Verify (demo: accept 1111) ─────────────────────────────────────────────
  const handleVerify = useCallback((code: string) => {
    setError('')
    if (code !== DEMO_OTP) {
      setError('गलत कोड। डेमोका लागि 1111 प्रयोग गर्नुहोस्।')
      setOtp(['', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
      return
    }
    setLoading(true)
    // Small delay for UX realism
    setTimeout(() => {
      setLoading(false)
      onSuccess(phone.replace(/\s/g, ''))
    }, 600)
  }, [phone, onSuccess])

  // ── OTP input handlers ─────────────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[idx] = val
    setOtp(next); setError('')
    if (val && idx < 3) otpRefs.current[idx + 1]?.focus()
    if (val && idx === 3) {
      const code = [...next.slice(0, 3), val].join('')
      if (code.length === 4) handleVerify(code)
    }
  }

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (text.length === 4) { setOtp(text.split('')); handleVerify(text) }
  }

  const otpFull = otp.every(d => d !== '')

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{
        background: BG,
        borderRadius: 18,
        width: '100%', maxWidth: 400,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        border: `1px solid ${BORDER}`,
        animation: 'authIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* Left: brand mark + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }}>
                <div style={{ width: 3, height: 18, background: ACCENT }} />
                <div style={{ width: 3, height: 18, marginLeft: 2, background: '#003893' }} />
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                color: SLATE, textTransform: 'uppercase',
                fontFamily: 'system-ui, sans-serif',
              }}>
                {screen === 'phone' ? 'नागरिक पहिचान' : 'OTP प्रमाणीकरण'}
              </span>
            </div>

            {/* DEMO badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#4ADE80',
              }}>DEMO</span>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: 'none',
                  borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                  color: SLATE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <h2 style={{
            fontFamily: DEV, fontSize: 22, fontWeight: 800,
            color: '#fff', margin: '0 0 6px', lineHeight: 1.2,
          }}>
            {screen === 'phone' ? 'लग इन / दर्ता' : 'कोड प्रविष्ट गर्नुहोस्'}
          </h2>
          <p style={{ fontFamily: DEV, fontSize: 13, color: SLATE, margin: 0, lineHeight: 1.5 }}>
            {screen === 'phone'
              ? 'फोन नम्बरबाट आफ्नो उजुरी हेर्न र दर्ता गर्न सक्नुहुन्छ'
              : `${phone} मा प्रमाणीकरण कोड पठाइयो`}
          </p>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div style={{ padding: '22px 24px 24px' }}>

          {screen === 'phone' && (
            <>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: SLATE, marginBottom: 8, letterSpacing: '0.06em',
                textTransform: 'uppercase', fontFamily: 'system-ui',
              }}>
                फोन नम्बर
              </label>

              <div style={{
                display: 'flex', alignItems: 'center',
                background: CARD, borderRadius: 12,
                border: `1.5px solid ${error ? ACCENT : BORDER}`,
                overflow: 'hidden', transition: 'border-color 0.15s',
              }}>
                <span style={{
                  padding: '0 14px', fontSize: 14, color: '#fff',
                  fontWeight: 600, borderRight: `1px solid ${BORDER}`,
                  lineHeight: '52px', whiteSpace: 'nowrap',
                  fontFamily: 'system-ui',
                }}>
                  +977
                </span>
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', padding: '0 14px',
                    height: 52, fontSize: 18, fontWeight: 600,
                    color: '#fff', letterSpacing: '0.08em', fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Demo hint */}
              <p style={{ fontSize: 11, color: 'rgba(74,222,128,0.7)', margin: '8px 0 0', fontFamily: DEV }}>
                OTP सेवा डेमोको लागि सरलीकृत गरिएको छ।
              </p>

              {error && <ErrorMsg msg={error} />}

              <button
                onClick={handleSend}
                disabled={phone.length < 10}
                style={{
                  width: '100%', marginTop: 16, height: 52, borderRadius: 12, border: 'none',
                  background: phone.length < 10
                    ? 'rgba(14,77,164,0.4)'
                    : `linear-gradient(135deg, ${PRIMARY} 0%, #1565C0 100%)`,
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: phone.length < 10 ? 'not-allowed' : 'pointer',
                  fontFamily: DEV, transition: 'opacity 0.15s',
                  opacity: phone.length < 10 ? 0.6 : 1,
                }}
              >
                लग इन गर्नुहोस् →
              </button>

              <button
                onClick={onClose}
                style={{
                  width: '100%', marginTop: 10, height: 44, borderRadius: 12,
                  border: `1px solid ${BORDER}`, background: 'transparent',
                  color: SLATE, fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: DEV,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                पछि गर्नुहोस्
              </button>
            </>
          )}

          {screen === 'otp' && (
            <>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: SLATE, marginBottom: 16, letterSpacing: '0.06em',
                textTransform: 'uppercase', fontFamily: 'system-ui',
              }}>
                OTP कोड
              </label>

              <div
                onPaste={handleOtpPaste}
                style={{ display: 'flex', gap: 10, justifyContent: 'center' }}
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
                      width: 64, height: 64, textAlign: 'center',
                      fontSize: 26, fontWeight: 700,
                      background: digit ? `rgba(14,77,164,0.2)` : CARD,
                      border: `2px solid ${digit ? PRIMARY : error ? ACCENT : BORDER}`,
                      borderRadius: 12, color: digit ? '#fff' : SLATE,
                      outline: 'none', transition: 'border-color 0.12s, background 0.12s',
                      fontFamily: 'monospace', cursor: loading ? 'not-allowed' : 'text',
                    }}
                  />
                ))}
              </div>

              {/* Demo hint */}
              <p style={{ fontSize: 11, color: 'rgba(74,222,128,0.7)', margin: '12px 0 0', textAlign: 'center', fontFamily: DEV }}>
                OTP सेवा डेमोको लागि सरलीकृत गरिएको छ।
              </p>

              {error && <ErrorMsg msg={error} center />}

              <button
                onClick={() => handleVerify(otp.join(''))}
                disabled={!otpFull || loading}
                style={{
                  width: '100%', marginTop: 18, height: 52, borderRadius: 12, border: 'none',
                  background: !otpFull || loading
                    ? 'rgba(14,77,164,0.4)'
                    : `linear-gradient(135deg, ${PRIMARY} 0%, #1565C0 100%)`,
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: !otpFull || loading ? 'not-allowed' : 'pointer',
                  fontFamily: DEV, transition: 'opacity 0.15s',
                  opacity: !otpFull || loading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading
                  ? <><Spinner /> प्रमाणीकरण...</>
                  : 'पुष्टि गर्नुहोस् →'}
              </button>

              <button
                onClick={() => { setScreen('phone'); setOtp(['', '', '', '']); setError('') }}
                style={{
                  display: 'block', margin: '12px auto 0', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 12,
                  color: SLATE, fontFamily: DEV,
                }}
              >
                ← फोन बदल्नुहोस्
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes authIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────
function ErrorMsg({ msg, center }: { msg: string; center?: boolean }) {
  return (
    <p style={{
      fontSize: 12, color: '#FCA5A5', marginTop: 10,
      display: 'flex', alignItems: 'center', gap: 6,
      justifyContent: center ? 'center' : undefined,
      fontFamily: 'Noto Sans Devanagari, sans-serif',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </p>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
