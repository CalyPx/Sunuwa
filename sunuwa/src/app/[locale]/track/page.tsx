'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import SunuwaLogo from '@/components/SunuwaLogo'
import LangToggle from '@/components/LangToggle'
import { useLocale } from 'next-intl'

// == Design tokens ==
const NAV  = '#123A6B'
const DEEP = '#0B2D52'
const CRIM = '#C8102E'
const GRN  = '#1F8A4D'
const AMB  = '#D97706'
const BDR  = '#E5E7EB'
const TXT  = '#111827'

const CAT_META: Record<string, { icon: string; color: string }> = {
  Infrastructure: { icon: '🏗️', color: AMB   },
  Health:         { icon: '🏥', color: GRN   },
  Water:          { icon: '💧', color: '#0891B2' },
  Electricity:    { icon: '⚡', color: '#CA8A04' },
  Education:      { icon: '📚', color: '#7C3AED' },
  Corruption:     { icon: '⚖️', color: CRIM  },
  Safety:         { icon: '🔒', color: '#374151' },
  Environment:    { icon: '🌿', color: GRN   },
  Other:          { icon: '📋', color: '#6B7280' },
}

interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; status: string
  created_at: string; escalation_level: number; days_old: number
  tracking_code?: string
  officer_notes?: string[]
  referred_to?: string | null
  ward: { name_ne: string; municipality: string } | null
}

// == Stage config ==
const STAGES = [
  { level: 1, labelNe: 'वडा',        label: 'Ward Office',     icon: '🏛' },
  { level: 2, labelNe: 'नगरपालिका', label: 'Municipality',    icon: '🏢' },
  { level: 3, labelNe: 'प्रदेश',     label: 'Province',        icon: '🏛️' },
  { level: 4, labelNe: 'मन्त्रालय',  label: 'Ministry',        icon: '⚖️' },
]

function sevColor(s: number) {
  if (s >= 8) return CRIM
  if (s >= 5) return AMB
  return GRN
}
function sevLabel(s: number) {
  if (s >= 8) return 'Critical'
  if (s >= 5) return 'Moderate'
  return 'Low'
}

const TT = {
  ne: { title: 'तपाईंको उजुरीको स्थिति', sub: 'ट्र्याकिङ कोड राखेर आफ्नो उजुरी कहाँ पुग्यो हेर्नुहोस्', search: 'खोज्नुहोस्', searching: 'खोज्दैछ...', notFound: 'यो Tracking ID फेला परेन। कृपया फेरि जाँच्नुहोस्।', submit: '+ उजुरी दर्ता', placeholder: 'ट्र्याकिङ कोड — e.g. KTM-7-3QP' },
  en: { title: 'Your Complaint Status', sub: 'Enter your tracking code to see where your complaint stands', search: 'Search', searching: 'Searching...', notFound: 'Tracking ID not found. Please check and try again.', submit: '+ File Complaint', placeholder: 'Tracking code — e.g. KTM-7-3QP' },
}

export default function TrackPage() {
  const locale = useLocale() as 'ne' | 'en'
  const t = TT[locale]
  const [trackId,   setTrackId]   = useState('')
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [notFound,  setNotFound]  = useState(false)

  const handleTrack = async () => {
    const id = trackId.trim()
    if (id.length < 6) return
    setLoading(true); setNotFound(false); setComplaint(null)
    const res = await fetch(`/api/complaints/${id}`)
    if (res.ok) setComplaint(await res.json())
    else setNotFound(true)
    setLoading(false)
  }

  const escLevel  = complaint?.escalation_level || 1
  const sev       = complaint?.severity || 5
  const cat       = CAT_META[complaint?.category_en || ''] || CAT_META.Other
  const daysOld   = complaint?.days_old ?? (complaint ? Math.floor((Date.now() - new Date(complaint.created_at).getTime()) / 86400000) : 0)
  const trackCode = complaint?.tracking_code || complaint?.id?.slice(0, 13)?.toUpperCase() || ''
  const filed     = complaint ? new Date(complaint.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  // Case journey events derived from real DB fields
  const isResolved   = complaint?.status === 'resolved'
  const isEscalated  = complaint?.status === 'escalated'
  const isInProgress = complaint?.status === 'in_progress'
  const hasNotes     = (complaint?.officer_notes?.length ?? 0) > 0
  const journeyEvents = complaint ? [
    { done: true,        title: 'Complaint submitted',                              sub: filed,   current: false },
    { done: true,        title: 'AI classified — ' + (complaint.category_en || 'Other'), sub: filed, current: false },
    { done: true,        title: 'Assigned to ' + (complaint.ward?.name_ne || 'Ward Office'), sub: '', current: false },
    { done: hasNotes || isInProgress || isResolved || escLevel > 1, title: 'Officer review started', sub: hasNotes ? 'Officer has added notes' : '', current: !hasNotes && !isInProgress && !isResolved && escLevel === 1 },
    { done: escLevel > 2 || isEscalated, title: 'Escalated to Municipality', sub: complaint.referred_to ? `Referred to ${complaint.referred_to}` : '', current: escLevel === 2 && !isEscalated },
    { done: escLevel > 3, title: 'Escalated to Province',     sub: '', current: escLevel === 3 },
    { done: isResolved,   title: 'Resolution',                 sub: isResolved ? 'Issue addressed' : '', current: isResolved },
  ] : []

  return (
    <main style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* == Navbar == */}
      <header style={{ background: NAV, borderBottom: `2px solid ${DEEP}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SunuwaLogo size={96} />
            <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>सुनुवा</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LangToggle />
            <Link href="/submit" style={{ fontSize: 12, fontWeight: 700, background: CRIM, color: '#fff', padding: '6px 14px', textDecoration: 'none' }}>
              {t.submit}
            </Link>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* == Hero + Search == */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: CRIM, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
            Complaint Tracking System
          </p>
          <h1 style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 32, fontWeight: 800, color: TXT, margin: '0 0 8px', lineHeight: 1.2 }}>
            {t.title}
          </h1>
          <p style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 15, color: '#6B7280', margin: '0 0 32px' }}>
            {t.sub}
          </p>

          {/* Search bar */}
          <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: `1px solid ${BDR}`, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: 20, borderRadius: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2} style={{ flexShrink: 0 }}>
                <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={trackId}
                onChange={e => setTrackId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                placeholder={t.placeholder}
                style={{
                  flex: 1, border: 'none', outline: 'none', fontFamily: 'monospace',
                  fontSize: 15, color: TXT, background: 'transparent', letterSpacing: 1,
                }}
              />
              <button
                onClick={handleTrack}
                disabled={loading || trackId.trim().length < 6}
                style={{
                  background: loading ? '#9CA3AF' : NAV, color: '#fff',
                  border: 'none', padding: '10px 22px', fontWeight: 700, fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0,
                  fontFamily: 'Noto Sans Devanagari, sans-serif', borderRadius: 8,
                  opacity: trackId.trim().length < 6 ? 0.5 : 1,
                }}>
                {loading ? t.searching : t.search}
              </button>
            </div>
          </div>

          {/* Tracking ID badge */}
          {complaint && (
            <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 10, background: '#EEF2F7', border: `1px solid #C7D4E5`, padding: '8px 18px', borderRadius: 8 }}>
              <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke={NAV} strokeWidth={2}>
                <rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Tracking ID</span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: NAV, letterSpacing: 2 }}>{trackCode}</span>
            </div>
          )}
        </div>

        {/* == Not found == */}
        {notFound && (
          <div style={{ maxWidth: 560, margin: '0 auto 32px', background: '#FEF2F2', border: `1px solid #FECACA`, borderLeft: `4px solid ${CRIM}`, padding: '16px 20px', borderRadius: 8 }}>
            <p style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 14, color: CRIM, margin: 0, fontWeight: 600 }}>
              {t.notFound}
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>Format: KTM-7-3QP or full complaint ID</p>
          </div>
        )}

        {/* == Complaint detail == */}
        {complaint && (
          <div style={{ display: 'grid', gap: 20 }}>

            {/* STATUS OVERVIEW PANEL */}
            <div style={{ background: '#fff', border: `1px solid ${BDR}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ background: NAV, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>Case Summary</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                  background: complaint.status === 'resolved' ? `${GRN}25` : complaint.status === 'escalated' ? `${CRIM}25` : complaint.status === 'in_progress' ? 'rgba(59,130,246,0.15)' : `rgba(255,255,255,0.12)`,
                  color: complaint.status === 'resolved' ? '#4ADE80' : complaint.status === 'escalated' ? '#FCA5A5' : complaint.status === 'in_progress' ? '#93C5FD' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${complaint.status === 'resolved' ? '#4ADE8040' : complaint.status === 'escalated' ? `${CRIM}50` : complaint.status === 'in_progress' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.2)'}`,
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {complaint.status === 'resolved' ? '✓ Resolved' : complaint.status === 'escalated' ? '↑ Escalated' : complaint.status === 'in_progress' ? 'In Progress' : 'Active'}
                </span>
              </div>
              <div style={{ padding: '20px 24px' }}>
                {complaint.summary_ne && (
                  <p style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 15, color: TXT, margin: '0 0 20px', lineHeight: 1.65 }}>
                    {complaint.summary_ne}
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: `1px solid ${BDR}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Category',      value: complaint.category_en || 'Other',                    extra: cat.icon },
                    { label: 'Severity',      value: `${sevLabel(sev)} (${sev}/10)`,                      color: sevColor(sev) },
                    { label: 'Current Owner', value: STAGES[Math.min(escLevel,4)-1]?.label || 'Ward Office', color: NAV },
                    { label: 'Filed',         value: `${daysOld} days ago`,                               extra: '' },
                    { label: 'Expected Response', value: escLevel <= 1 ? '3 days' : escLevel === 2 ? '7 days' : '14 days', color: AMB },
                    { label: 'Current Stage', value: STAGES[Math.min(escLevel,4)-1]?.labelNe || 'वडा',     ne: true },
                  ].map((f, i) => (
                    <div key={f.label} style={{
                      padding: '14px 18px',
                      borderRight:   (i % 3 < 2) ? `1px solid ${BDR}` : 'none',
                      borderBottom:  i < 3 ? `1px solid ${BDR}` : 'none',
                      background:    '#fff',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 5px' }}>{f.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: f.color || TXT, margin: 0, fontFamily: f.ne ? 'Noto Sans Devanagari, sans-serif' : 'inherit' }}>
                        {f.extra ? `${f.extra} ` : ''}{f.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PROGRESS TRACKER */}
            <div style={{ background: '#fff', border: `1px solid ${BDR}`, borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 24px' }}>Progress Tracker</p>

              {/* Horizontal timeline */}
              <div style={{ position: 'relative' }}>
                {/* Connector line */}
                <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 2, background: BDR, zIndex: 0 }} />
                {/* Filled portion */}
                <div style={{ position: 'absolute', top: 20, left: 20, height: 2, background: GRN, zIndex: 1, width: `${Math.min(((escLevel - 1) / 3) * 100, 100)}%`, transition: 'width 1s ease' }} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', position: 'relative', zIndex: 2 }}>
                  {STAGES.map(s => {
                    const past    = s.level < escLevel
                    const current = s.level === escLevel
                    const future  = s.level > escLevel
                    return (
                      <div key={s.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        {/* Circle */}
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: past ? 14 : 13,
                          background: past ? GRN : current ? NAV : '#F3F4F6',
                          color:      past ? '#fff' : current ? '#fff' : '#D1D5DB',
                          border:     current ? `3px solid ${DEEP}` : past ? `2px solid ${GRN}` : `2px solid ${BDR}`,
                          boxShadow:  current ? `0 0 0 4px ${NAV}18` : 'none',
                          transition: 'all 0.3s ease',
                        }}>
                          {past ? '✓' : s.icon}
                        </div>
                        {/* Label */}
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 12, fontWeight: current ? 800 : 600, color: past ? GRN : current ? NAV : '#9CA3AF', margin: 0 }}>
                            {s.labelNe}
                          </p>
                          <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>{s.label}</p>
                          {current && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 700, color: NAV, background: '#EEF2F7', border: `1px solid #C7D4E5`, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>
                              CURRENT
                            </span>
                          )}
                          {past && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, color: GRN, fontWeight: 600 }}>Completed</span>
                          )}
                          {future && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, color: '#D1D5DB', fontWeight: 600 }}>Pending</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CASE JOURNEY + OFFICIAL STATUS side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

              {/* Case journey */}
              <div style={{ background: '#fff', border: `1px solid ${BDR}`, borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 20px' }}>Case Journey</p>
                <div style={{ position: 'relative', paddingLeft: 28 }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: BDR }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {journeyEvents.map((ev, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: i < journeyEvents.length - 1 ? 20 : 0 }}>
                        <div style={{
                          position: 'absolute', left: -28, top: 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: ev.done ? GRN : ev.current ? NAV : '#F3F4F6',
                          border: `2px solid ${ev.done ? GRN : ev.current ? NAV : BDR}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', fontWeight: 800, zIndex: 1,
                        }}>
                          {ev.done ? '✓' : ev.current ? '●' : ''}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: ev.current ? 700 : 500, color: ev.done ? TXT : ev.current ? NAV : '#9CA3AF', margin: 0 }}>{ev.title}</p>
                          {ev.sub && <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{ev.sub}</p>}
                          {ev.current && <p style={{ fontSize: 11, fontWeight: 700, color: NAV, margin: '3px 0 0' }}>In progress</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column: Official status + Confidence panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Official status message */}
                <div style={{ background: '#fff', border: `1px solid ${BDR}`, borderLeft: `4px solid ${NAV}`, borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 10px' }}>Latest Official Update</p>
                  {complaint.officer_notes && complaint.officer_notes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[...complaint.officer_notes].reverse().slice(0, 3).map((note, i) => (
                        <div key={i} style={{ borderLeft: `3px solid ${i === 0 ? NAV : BDR}`, paddingLeft: 10 }}>
                          <p style={{ fontSize: 13, color: i === 0 ? TXT : '#6B7280', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                            &ldquo;{note.replace(/^\[.*?\]\s*/, '')}&rdquo;
                          </p>
                          {note.match(/^\[(.+?)\]/) && (
                            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '3px 0 0' }}>
                              {note.match(/^\[(.+?)\]/)?.[1]} · {STAGES[Math.min(escLevel,4)-1]?.label}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, margin: '0 0 12px', fontStyle: 'italic' }}>
                      {complaint.status === 'resolved'
                        ? '"Complaint successfully resolved. Issue has been addressed by the responsible authority."'
                        : '"Complaint received and assigned. Field officer has been notified for inspection."'
                      }
                    </p>
                  )}
                  {complaint.referred_to && (
                    <p style={{ fontSize: 11, color: NAV, fontWeight: 600, margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                      Referred to: {complaint.referred_to}
                    </p>
                  )}
                  {(!complaint.officer_notes || complaint.officer_notes.length === 0) && (
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '8px 0 0' }}>
                      {STAGES[Math.min(escLevel,4)-1]?.label} · {daysOld === 0 ? 'Today' : `${daysOld}d ago`}
                    </p>
                  )}
                </div>

                {/* Citizen confidence panel */}
                <div style={{ background: '#fff', border: `1px solid ${BDR}`, borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px' }}>Complaint Status</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Complaint received',            done: true  },
                      { label: 'Responsible authority assigned', done: true  },
                      { label: 'Investigation started',          done: escLevel >= 1 },
                      { label: 'Under active review',            done: escLevel >= 2 || complaint.status !== 'pending' },
                      { label: 'Resolution',                     done: complaint.status === 'resolved' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: item.done ? GRN : '#F3F4F6', color: item.done ? '#fff' : '#D1D5DB', border: `2px solid ${item.done ? GRN : BDR}` }}>
                          {item.done ? '✓' : ''}
                        </div>
                        <p style={{ fontSize: 12, color: item.done ? TXT : '#9CA3AF', margin: 0, fontWeight: item.done ? 500 : 400 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BDR}` }}>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px' }}>Expected response time</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: NAV, margin: 0 }}>
                      {escLevel <= 1 ? '3 days (Ward SLA)' : escLevel === 2 ? '7 days (Municipality SLA)' : '14 days (Province SLA)'}
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!complaint && !notFound && !loading && (
          <div style={{ textAlign: 'center', marginTop: 48, color: '#9CA3AF' }}>
            <svg width={48} height={48} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}>
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <p style={{ fontSize: 14, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>ट्र्याकिङ कोड राखेर खोज्नुहोस्</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Example: KTM-7-3QP</p>
          </div>
        )}

      </div>
    </main>
  )
}
