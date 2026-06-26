'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthContext'
import LangToggle from '@/components/LangToggle'
import { useLocale } from 'next-intl'

// ── Design tokens ──────────────────────────────────────────────────────────
const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'
const DEV      = 'Noto Sans Devanagari, sans-serif'

// ── Types ──────────────────────────────────────────────────────────────────
interface Complaint {
  id: string
  tracking_code: string
  text: string
  category_en: string | null
  category_ne: string | null
  severity: number | null
  status: string | null
  created_at: string
  ward_id: number | null
  ward?: { name_ne: string; municipality: string } | null
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  active:      { label: 'विचाराधीन',  bg: '#FEF9C3', color: '#854D0E' },
  in_progress: { label: 'प्रक्रियामा', bg: '#DBEAFE', color: '#1E40AF' },
  resolved:    { label: 'समाधान',     bg: '#DCFCE7', color: '#166534' },
  escalated:   { label: 'उन्नयन',     bg: '#FEE2E2', color: '#991B1B' },
}

function statusCfg(s: string | null) {
  return STATUS[s ?? ''] ?? { label: s ?? 'अज्ञात', bg: '#F3F4F6', color: '#374151' }
}

// ── Category abbreviation badges ───────────────────────────────────────────
const CAT_AB: Record<string, { ab: string; color: string }> = {
  Infrastructure: { ab: 'SR', color: '#D97706' },
  Health:         { ab: 'SW', color: '#059669' },
  Water:          { ab: 'KP', color: '#0891B2' },
  Electricity:    { ab: 'BJ', color: '#CA8A04' },
  Corruption:     { ab: 'BH', color: '#DC2626' },
  Safety:         { ab: 'SU', color: '#7C3AED' },
  Environment:    { ab: 'VA', color: '#65A30D' },
  Education:      { ab: 'SH', color: '#2563EB' },
  Other:          { ab: 'AN', color: '#64748B' },
}

function catBadge(cat: string | null) {
  return CAT_AB[cat ?? ''] ?? { ab: 'AN', color: '#64748B' }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MyComplaintsPage() {
  const { citizen, loading: authLoading, openAuth } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading,    setLoading]    = useState(false)
  const [selected,   setSelected]   = useState<Complaint | null>(null)

  useEffect(() => {
    if (!citizen) return
    setLoading(true)
    supabase
      .from('complaints')
      .select('*, ward:wards(name_ne, municipality)')
      .eq('citizen_phone', citizen.phone_number)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setComplaints(data as Complaint[])
        setLoading(false)
      })
  }, [citizen])

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!authLoading && !citizen) return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopBar />
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#EFF4FA', border: `2px solid ${GOV_BLUE}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke={GOV_BLUE} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h1 style={{ fontFamily: DEV, fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
          लग इन आवश्यक छ
        </h1>
        <p style={{ fontFamily: DEV, fontSize: 15, color: '#6B7280', marginBottom: 28, lineHeight: 1.6 }}>
          तपाईंका उजुरीहरू हेर्न लग इन गर्नुहोस्।
        </p>
        <button
          onClick={openAuth}
          style={{ background: GOV_BLUE, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: DEV }}
        >
          लग इन / दर्ता गर्नुहोस्
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopBar />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: DEV, fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
            मेरा उजुरीहरू
          </h1>
          <p style={{ fontFamily: DEV, fontSize: 14, color: '#6B7280' }}>
            तपाईंले दर्ता गर्नुभएका सबै उजुरीहरू
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${GOV_BLUE}30`, borderTopColor: GOV_BLUE, borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontFamily: DEV, fontSize: 14 }}>लोड हुँदैछ...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && complaints.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth={1} style={{ margin: '0 auto', display: 'block' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h3 style={{ fontFamily: DEV, fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
              अहिलेसम्म कुनै उजुरी दर्ता छैन
            </h3>
            <p style={{ fontFamily: DEV, fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
              तपाईंले दर्ता गर्नुभएका उजुरीहरू यहाँ देखिनेछन्।
            </p>
            <Link href="/submit" style={{ background: CRIMSON, color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: DEV }}>
              पहिलो उजुरी दर्ता गर्नुहोस्
            </Link>
          </div>
        )}

        {/* Complaints list */}
        {!loading && complaints.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complaints.map(c => {
              const st  = statusCfg(c.status)
              const cat = catBadge(c.category_en)
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: selected?.id === c.id ? '0 0 0 2px ' + GOV_BLUE : 'none' }}
                  onMouseEnter={e => { if (selected?.id !== c.id) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)' }}
                  onMouseLeave={e => { if (selected?.id !== c.id) (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                >
                  {/* Row 1: cat badge + tracking code + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 6, background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {cat.ab}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                      {c.tracking_code ?? c.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: DEV, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Row 2: complaint text preview */}
                  <p style={{ fontFamily: DEV, fontSize: 14, color: '#111827', margin: '0 0 10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.text}
                  </p>

                  {/* Row 3: meta */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#9CA3AF' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {fmtDate(c.created_at)}
                    </span>
                    {c.ward && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {c.ward.name_ne}, {c.ward.municipality}
                      </span>
                    )}
                    {c.severity != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                        गम्भीरता: {c.severity}/10
                      </span>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {selected?.id === c.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <DetailItem label="श्रेणी" value={c.category_ne ?? c.category_en ?? '—'} />
                        <DetailItem label="अवस्था" value={st.label} />
                        <DetailItem label="ट्र्याकिङ कोड" value={c.tracking_code ?? '—'} mono />
                        <DetailItem label="दर्ता मिति" value={fmtDate(c.created_at)} />
                      </div>
                      <Link
                        href={`/track?code=${c.tracking_code}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: GOV_BLUE, textDecoration: 'none', fontFamily: DEV }}
                      >
                        पूर्ण विवरण हेर्नुहोस्
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function TopBar() {
  const locale = useLocale() as 'ne' | 'en'
  const label = locale === 'ne' ? 'मेरा उजुरीहरू' : 'My Complaints'
  return (
    <header style={{ background: GOV_BLUE, borderBottom: `2px solid ${GOV_BLUE}` }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: 3, height: 24, background: CRIMSON }} />
              <div style={{ width: 3, height: 24, marginLeft: 2, background: '#003893' }} />
            </div>
            <span style={{ fontFamily: DEV, fontWeight: 800, fontSize: 16, color: '#fff' }}>सुनुवा</span>
          </Link>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          <span style={{ fontFamily: DEV, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{label}</span>
        </div>
        <LangToggle />
      </div>
    </header>
  )
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px', fontFamily: 'system-ui' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, fontFamily: mono ? 'monospace' : DEV }}>{value}</p>
    </div>
  )
}
