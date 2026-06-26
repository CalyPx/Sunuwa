'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import SunuwaLogo from '@/components/SunuwaLogo'
import LangToggle from '@/components/LangToggle'

// ── Nepal silhouette (subtle background) ─────────────────────────────
const NEPAL_PATH =
  'M 18,112 C 22,100 28,88 40,77 C 52,66 70,56 95,48 C 120,40 150,34 185,29 ' +
  'C 222,24 262,21 305,19 C 348,17 392,16 435,16 C 478,16 521,17 562,19 ' +
  'C 603,21 642,25 678,32 C 712,39 742,49 766,61 C 787,72 803,84 814,97 ' +
  'C 822,107 826,118 824,127 L 795,132 758,134 724,131 ' +
  'C 700,127 682,121 665,118 L 635,115 605,118 576,122 ' +
  'C 555,126 534,127 512,123 L 482,116 452,113 422,117 ' +
  'C 400,121 378,128 354,132 L 325,135 295,133 265,129 ' +
  'C 238,124 212,116 184,113 L 152,112 118,115 88,120 ' +
  'C 68,124 50,126 35,123 L 20,116 Z'

const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'

export default function LoginPage() {
  const router = useRouter()
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: authData, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email वा Password गलत छ। पुनः प्रयास गर्नुहोस्।'); setLoading(false); return }

    const user = authData?.user
    if (!user) { setError('लगइन भएन।'); setLoading(false); return }

    const roleRes = await fetch('/api/auth/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
    const { role, error: roleErr } = await roleRes.json()

    if (roleErr) { setError(`भूमिका फेला परेन: ${roleErr}`); setLoading(false); return }
    if (!role)   { setError('यो खाताको कुनै भूमिका छैन। Admin लाई सम्पर्क गर्नुहोस्।'); setLoading(false); return }

    if (role.role === 'minister' && role.ministry_slug) router.push(`/ne/minister/${role.ministry_slug}`)
    else if (role.ward_id) router.push(`/ne/ward/${role.ward_id}`)
    else router.push('/ne')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══ TOP GOVERNMENT STRIPE ═════════════════════════════════════ */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${GOV_BLUE} 70%, ${CRIMSON} 100%)` }} />

      
      {/* ══ MAIN BODY ═════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT TRUST PANEL (40%) ────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between w-[42%] relative overflow-hidden"
          style={{ background: GOV_BLUE }}>

          {/* Nepal map SVG watermark */}
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none select-none"
            style={{ opacity: 0.06 }}>
            <svg viewBox="0 12 900 130" className="w-[120%]" preserveAspectRatio="xMidYMid meet">
              <path d={NEPAL_PATH} fill="white" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 p-10 pt-12 flex flex-col h-full justify-between">

            {/* Brand */}
            <div>
              {/* Nepal flag mark */}
              <div className="flex items-center gap-3 mb-10">
                <SunuwaLogo size={48} light={true} />
                <div>
                  <div className="font-bold text-white text-2xl leading-none"
                    style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवा</div>
                  <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mt-1">Civic Intelligence Platform</div>
                </div>
              </div>

              {/* Platform description */}
              <div className="mb-8 border-l-2 border-white/20 pl-4">
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2">Official Officer Access Portal</p>
                <h2 className="text-2xl font-bold text-white leading-snug mb-3"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  नागरिकको सेवामा,<br />सरकारको जिम्मेवारी।
                </h2>
                <p className="text-white/55 text-sm leading-relaxed"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  Serving citizens across Nepal through transparent grievance management.
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { value: '14,300+', label: 'Complaints Handled',    sub: 'All time' },
                  { value: '78%',     label: 'Resolution Rate',       sub: 'National avg.' },
                  { value: '77',      label: 'Active Departments',    sub: 'Across Nepal' },
                  { value: '340+',    label: 'Registered Officials',  sub: 'Ward to Ministry' },
                ].map(s => (
                  <div key={s.label} className="border border-white/10 p-3.5"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                    <p className="text-white/60 text-[11px] font-medium mt-0.5">{s.label}</p>
                    <p className="text-white/30 text-[10px] mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Access levels */}
              <div className="border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Access Levels</p>
                <div className="space-y-2">
                  {[
                    { role: 'वडा अधिकारी',   desc: 'Ward complaint management' },
                    { role: 'नगरपालिका',     desc: 'Municipal oversight & escalation' },
                    { role: 'मन्त्री / मन्त्रालय', desc: 'Ministry intelligence brief' },
                  ].map(a => (
                    <div key={a.role} className="flex items-center gap-2.5">
                      <div className="w-1 h-4 flex-shrink-0" style={{ background: CRIMSON }} />
                      <span className="text-white/70 text-xs font-semibold"
                        style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{a.role}</span>
                      <span className="text-white/30 text-[10px]">— {a.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom footer text */}
            <div className="border-t border-white/10 pt-5">
              <p className="text-white/30 text-[10px] leading-relaxed">
                Sunuwa is an official digital public service platform of the Government of Nepal.
                Unauthorized access is prohibited and subject to legal action.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT LOGIN PANEL (60%) ───────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white">

          {/* Top bar */}
          <div className="flex items-center justify-between px-8 md:px-12 py-5 border-b border-gray-100">
            {/* Mobile brand (visible only on small screens) */}
            <div className="flex lg:hidden items-center gap-2">
              <SunuwaLogo size={96} light={false} />
              <span className="font-bold text-sm" style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवा</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <LangToggle dark={false} />
              <Link href="/"
                className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Public Portal
              </Link>
            </div>
          </div>

          {/* Login form area */}
          <div className="flex-1 flex items-center justify-center px-6 md:px-12 py-10">
            <div className="w-full max-w-[420px]">

              {/* Section heading */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-px h-5" style={{ background: CRIMSON }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Authorized Personnel Only</span>
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  अधिकारी लगइन
                </h1>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  वडा कार्यालय, नगरपालिका, वा मन्त्रालय खाताबाट प्रवेश गर्नुहोस्।
                </p>
              </div>


              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">

                {/* Email */}
                <div>
                  <label htmlFor="email"
                    className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Official Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="officer@sunuwa.gov.np"
                    required
                    autoComplete="username"
                    className="w-full border border-gray-300 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-all outline-none"
                    style={{ fontFamily: 'monospace' }}
                    onFocus={e => { e.currentTarget.style.borderColor = GOV_BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(11,60,111,0.08)` }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password"
                      className="block text-xs font-bold text-gray-600 uppercase tracking-wider"
                      style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      पासवर्ड
                    </label>
                    <button type="button" className="text-[10px] font-medium transition-colors"
                      style={{ color: GOV_BLUE }}>
                      पासवर्ड बिर्सनुभयो?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full border border-gray-300 px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 transition-all outline-none"
                      onFocus={e => { e.currentTarget.style.borderColor = GOV_BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(11,60,111,0.08)` }}
                      onBlur={e  => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}>
                      {showPass ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 border-l-4 px-4 py-3"
                    role="alert"
                    style={{ borderColor: CRIMSON, background: '#FEF2F2' }}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: CRIMSON }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: CRIMSON, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full font-bold py-3.5 text-sm text-white transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
                  style={{ background: loading ? '#1a5fa0' : GOV_BLUE }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.background = '#0a3260')}
                  onMouseLeave={e => !loading && (e.currentTarget.style.background = GOV_BLUE)}>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>प्रमाणीकरण हुँदैछ...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>लगइन गर्नुहोस्</span>
                    </>
                  )}
                </button>
              </form>

              {/* Security notice */}
              <div className="mt-5 flex items-start gap-2.5 text-[11px] text-gray-400 leading-relaxed">
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong className="text-gray-500">Authorized government personnel only.</strong>{' '}
                  This system is monitored. Unauthorized access attempts are logged and reported to the National Information Technology Center (NITC).
                </span>
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-gray-200" />

              {/* Demo accounts */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Demo Access — Testing Only
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'वडा अधिकारी', sub: 'Ward 1 Officer',     email: 'ward1@sunuwa.gov.np' },
                    { label: 'वडा अधिकारी', sub: 'Ward 32 Officer',    email: 'ward32@sunuwa.gov.np' },
                    { label: 'स्वास्थ्य मन्त्री', sub: 'Minister, Health', email: 'health@sunuwa.gov.np' },
                  ].map(acc => (
                    <button key={acc.email}
                      onClick={() => { setEmail(acc.email); setPassword('demo1234') }}
                      className="w-full text-left px-3.5 py-2.5 border border-gray-200 hover:border-gray-400 transition-colors flex items-center gap-3">
                      <div className="w-1 h-7 flex-shrink-0" style={{ background: GOV_BLUE, opacity: 0.4 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                          {acc.label}
                        </p>
                        <p className="text-[10px] text-gray-400">{acc.sub}</p>
                      </div>
                      <p className="text-[10px] font-mono text-gray-400 flex-shrink-0 hidden sm:block">{acc.email}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Citizen redirect */}
              <div className="mt-6 p-4 border border-gray-200" style={{ background: '#F5F7FA' }}>
                <p className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  नागरिक हुनुहुन्छ? लगइन आवश्यक छैन।
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link href="/submit"
                    className="flex-1 text-center text-xs font-bold py-2 transition-all"
                    style={{ background: GOV_BLUE, color: 'white' }}>
                    + उजुरी दर्ता गर्नुहोस्
                  </Link>
                  <Link href="/track"
                    className="flex-1 text-center text-xs font-bold py-2 border-2 transition-all"
                    style={{ borderColor: GOV_BLUE, color: GOV_BLUE }}>
                    उजुरी ट्र्याक गर्नुहोस्
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom footer */}
          <div className="border-t border-gray-200 px-8 md:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2"
            style={{ background: '#F5F7FA' }}>
            <p className="text-[10px] text-gray-400">
              © 2081 B.S. Sunuwa — Nepal Civic Intelligence Platform
            </p>
            <div className="flex items-center gap-4 text-[10px] text-gray-400">
              <span>Platform v2.1.0</span>
              <span>·</span>
              <span>Last updated: Asar 2081</span>
              <span>·</span>
              <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
              <span>·</span>
              <a href="#" className="hover:text-gray-600 transition-colors">Accessibility</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
