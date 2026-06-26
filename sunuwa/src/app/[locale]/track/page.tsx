'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'

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

export default function TrackPage() {
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

  // Case journey events derived from escalation level
  const journeyEvents = complaint ? [
    { done: true,  icon: '✓', title: 'Complaint submitted',          sub: filed,       current: false },
    { done: true,  icon: '✓', title: 'AI classified — ' + (complaint.category_en || 'Other'), sub: filed, current: false },
    { done: true,  icon: '✓', title: 'Assigned to ' + (complaint.ward?.name_ne || 'Ward Office'), sub: filed, current: false },
    { done: escLevel > 1,  icon: escLevel > 1 ? '✓' : '○', title: 'Officer review',   sub: escLevel > 1 ? `${daysOld - 2}d after filing` : '', current: escLevel === 1 },
    { done: escLevel > 2,  icon: escLevel > 2 ? '✓' : '○', title: 'Escalated to Municipality', sub: '', current: escLevel === 2 },
    { done: escLevel > 3,  icon: escLevel > 3 ? '✓' : '○', title: 'Escalated to Province', sub: '', current: escLevel === 3 },
    { done: complaint.status === 'resolved', icon: complaint.status === 'resolved' ? '✓' : '○', title: 'Resolution', sub: '', current: complaint.status === 'resolved' },
  ] : []

  return (
    <main style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* == Navbar == */}
      <header style={{ background: NAV, borderBottom: `2px solid ${DEEP}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: 4, height: 28, background: CRIM }} />
              <div style={{ width: 4, height: 28, marginLeft: 2, background: '#003893' }} />
              <div style={{ width: 28, height: 28, marginLeft: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 12 }}>स</div>
            </div>
            <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>सुनुवाइ</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/map"    style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Map</Link>
            <Link href="/submit" style={{ fontSize: 12, fontWeight: 700, background: CRIM, color: '#fff', padding: '6px 14px', textDecoration: 'none' }}>
              + उजुरी दर्ता
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
            तपाईंको उजुरीको स्थिति
          </h1>
          <p style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 15, color: '#6B7280', margin: '0 0 32px' }}>
            ट्र्याकिङ कोड राखेर आफ्नो उजुरी कहाँ पुग्यो हेर्नुहोस्
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
                placeholder="Enter tracking code — e.g. KTM-7-3QP"
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
                {loading ? 'Searching...' : 'खोज्नुहोस्'}
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
              यो Tracking ID फेला परेन। कृपया फेरि जाँच्नुहोस्।
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
                  background: complaint.status === 'resolved' ? `${GRN}25` : `rgba(255,255,255,0.12)`,
                  color: complaint.status === 'resolved' ? '#4ADE80' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${complaint.status === 'resolved' ? '#4ADE8040' : 'rgba(255,255,255,0.2)'}`,
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {complaint.status === 'resolved' ? '✓ Resolved' : complaint.status === 'pending' ? 'Under Review' : 'Active'}
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
                        {/* Dot */}
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
                          {ev.sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{ev.sub}</p>}
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
                  <p style={{ fontSize: 13, color: TXT, lineHeight: 1.65, margin: '0 0 12px', fontStyle: 'italic' }}>
                    {complaint.status === 'resolved'
                      ? '"Complaint successfully resolved. Issue has been addressed by the responsible authority."'
                      : '"Complaint received and assigned. Field officer has been notified for inspection."'
                    }
                  </p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                    {STAGES[Math.min(escLevel,4)-1]?.label} · {daysOld === 0 ? 'Today' : `${daysOld}d ago`}
                  </p>
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
