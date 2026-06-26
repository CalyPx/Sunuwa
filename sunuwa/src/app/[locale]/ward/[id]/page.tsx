'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSessionAndRole, signOut } from '@/lib/auth'
import { computeEscalation } from '@/lib/escalation'
import dynamic from 'next/dynamic'

const WardMap = dynamic(() => import('@/components/WardMapLight'), { ssr: false })

// ── Palette ──────────────────────────────────────────────────────────
const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'
const MID_GRAY = '#E8ECF0'
const LIGHT_BG = '#F5F7FA'

// ── Types ─────────────────────────────────────────────────────────────
interface Complaint {
  id: string; text: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; escalation_level: number
  status: string; created_at: string; tracking_code?: string
  lat?: number; lng?: number
  followup_data?: Record<string, string>
  officer_notes?: string[]; referred_to?: string
}
interface Ward { id: number; name: string; name_ne: string; municipality: string; district: string; province: string; lat: number; lng: number }
interface Stats { total: number; active: number; pending: number; avgSev: number }
interface WardData { ward: Ward; complaints: Complaint[]; stats: Stats; categories: { en: string; ne: string; count: number; avgSev: number }[] }

// ── Category config ───────────────────────────────────────────────────
const CAT: Record<string, { ne: string; color: string; bg: string; border: string; icon: string }> = {
  Infrastructure: { ne: 'पूर्वाधार',   color: '#1168B5', bg: '#EFF6FF', border: '#BFDBFE', icon: '🏗️' },
  Health:         { ne: 'स्वास्थ्य',   color: CRIMSON,   bg: '#FEF2F2', border: '#FECACA', icon: '🏥' },
  Water:          { ne: 'खानेपानी',    color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: '💧' },
  Electricity:    { ne: 'बिजुली',      color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A', icon: '⚡' },
  Education:      { ne: 'शिक्षा',      color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: '📚' },
  Corruption:     { ne: 'भ्रष्टाचार',  color: CRIMSON,   bg: '#FEF2F2', border: '#FECACA', icon: '⚖️' },
  Safety:         { ne: 'सुरक्षा',     color: '#374151', bg: '#F9FAFB', border: '#E5E7EB', icon: '🔒' },
  Environment:    { ne: 'वातावरण',     color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: '🌿' },
  Other:          { ne: 'अन्य',        color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: '📋' },
}

// ── SLA days per category ─────────────────────────────────────────────
const SLA_DAYS: Record<string, number> = {
  Health: 1, Safety: 1, Electricity: 2, Water: 3,
  Corruption: 5, Infrastructure: 7, Education: 7, Environment: 5, Other: 7,
}

function getSlaStatus(c: Complaint): { label: string; color: string; dot: string; level: number } {
  if (c.status === 'resolved') return { label: 'Resolved', color: '#16A34A', dot: '#16A34A', level: 0 }
  const days = (Date.now() - new Date(c.created_at).getTime()) / 86_400_000
  const sla  = SLA_DAYS[c.category_en] ?? 7
  const pct  = days / sla
  if (pct >= 1.5) return { label: 'Overdue',  color: CRIMSON,   dot: CRIMSON,   level: 3 }
  if (pct >= 1.0) return { label: 'Late',     color: '#D97706', dot: '#D97706', level: 2 }
  if (pct >= 0.7) return { label: 'Due Today',color: '#CA8A04', dot: '#CA8A04', level: 1 }
  return              { label: 'On Time',  color: '#16A34A', dot: '#16A34A', level: 0 }
}

const DEPARTMENTS = ['NEA (बिजुली)', 'KUKL (खानेपानी)', 'DoR (सडक)', 'DoE (शिक्षा)', 'स्वास्थ्य कार्यालय', 'प्रहरी', 'नगरपालिका', 'वडा कार्यालय']

// ── Panel mode ────────────────────────────────────────────────────────
type PanelMode = 'overview' | 'hotspot' | 'category'

// ── Severity color ────────────────────────────────────────────────────
function sevColor(sev: number): string {
  if (sev >= 8) return CRIMSON
  if (sev >= 5) return '#D97706'
  return GOV_BLUE
}

// ── Main page ─────────────────────────────────────────────────────────
export default function WardDashboard() {
  const params = useParams()
  const router = useRouter()
  const wardId = params.id as string

  const [data,       setData]       = useState<WardData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [authed,     setAuthed]     = useState<boolean | null>(null)
  const [selected,   setSelected]   = useState<Complaint | null>(null)
  const [flyTo,      setFlyTo]      = useState<Complaint | null>(null)
  const [catFilter,  setCatFilter]  = useState<string>('all')
  const [panelMode,  setPanelMode]  = useState<PanelMode>('overview')
  const [drillCat,   setDrillCat]   = useState<string | null>(null)

  // Officer update state
  const [note,      setNote]      = useState('')
  const [referred,  setReferred]  = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    getSessionAndRole().then(({ user }) => {
      if (!user) { router.push('/ne/login'); return }
      if (user.role === 'minister') { router.push(`/ne/minister/${user.ministry_slug}`); return }
      setAuthed(true)
    })
  }, [router])

  useEffect(() => {
    if (!authed) return
    fetch(`/api/wards/${wardId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [wardId, authed])

  const reload = () => {
    fetch(`/api/wards/${wardId}`).then(r => r.json()).then(d => setData(d))
  }

  const handleSaveNote = async () => {
    if (!selected || !note.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/complaints/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_note: note.trim(),
          referred_to:  referred || undefined,
          status:       newStatus || undefined,
        }),
      })
      setSaved(true); setNote(''); setReferred(''); setNewStatus('')
      setTimeout(() => setSaved(false), 2000)
      reload()
    } finally { setSaving(false) }
  }

  // ── Derived data ──────────────────────────────────────────────────
  const enriched = useMemo(() =>
    (data?.complaints || []).map(c => ({
      ...c,
      esc: computeEscalation(c.created_at, c.status, c.escalation_level),
      sla: getSlaStatus(c),
    })),
  [data])

  const catDistribution = useMemo(() => {
    const map: Record<string, number> = {}
    enriched.forEach(c => { map[c.category_en] = (map[c.category_en] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [enriched])

  const critical    = useMemo(() => enriched.filter(c => c.sla.level >= 2).length, [enriched])
  const overdue     = useMemo(() => enriched.filter(c => c.sla.level === 3).length, [enriched])
  const resRate     = useMemo(() => {
    const res = enriched.filter(c => c.status === 'resolved').length
    return enriched.length ? Math.round(res / enriched.length * 100) : 0
  }, [enriched])

  const mapFiltered = useMemo(() =>
    catFilter === 'all' ? enriched : enriched.filter(c => c.category_en === catFilter),
  [enriched, catFilter])

  const drillComplaints = useMemo(() =>
    drillCat ? enriched.filter(c => c.category_en === drillCat) : enriched,
  [enriched, drillCat])

  // AI-style insights
  const insights = useMemo(() => {
    const ins: string[] = []
    const top = catDistribution[0]
    if (top) ins.push(`${CAT[top[0]]?.ne || top[0]} सम्बन्धी समस्या सबैभन्दा बढी (${top[1]} उजुरी) — तत्काल ध्यान दिनुस्।`)
    if (overdue > 0) ins.push(`${overdue} उजुरीको SLA म्याद नाघिसकेको छ — escalation आवश्यक।`)
    const water = enriched.filter(c => c.category_en === 'Water').length
    if (water > 3) ins.push(`खानेपानी उजुरीहरू KUKL मा तत्काल पठाउन सिफारिस।`)
    if (resRate < 50) ins.push(`समाधान दर ${resRate}% मात्र — प्रतिक्रिया गति बढाउन आवश्यक।`)
    return ins.slice(0, 4)
  }, [catDistribution, overdue, enriched, resRate])

  const handleCardClick = (c: typeof enriched[0]) => {
    setSelected(c); setFlyTo(c)
    setNote(''); setReferred(c.referred_to || ''); setNewStatus(c.status)
  }

  const handleDrillCat = (cat: string) => {
    setDrillCat(cat)
    setCatFilter(cat)
    setPanelMode('category')
  }

  const backToOverview = () => {
    setPanelMode('overview')
    setDrillCat(null)
    setCatFilter('all')
  }

  if (!authed || loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: LIGHT_BG }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: GOV_BLUE, borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-400 font-mono">Loading intelligence data...</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="h-screen flex items-center justify-center" style={{ background: LIGHT_BG }}>
      <p className="text-gray-500" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>डेटा फेला परेन</p>
    </div>
  )

  const { ward, stats } = data

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══ COMMAND HEADER ══════════════════════════════════════════════ */}
      <header className="flex-shrink-0 border-b-2 z-50" style={{ background: GOV_BLUE, borderColor: '#08305A' }}>

        {/* Top row */}
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex">
              <div className="w-1 h-7" style={{ background: CRIMSON }} />
              <div className="w-1 h-7 ml-0.5" style={{ background: '#003893' }} />
              <div className="w-7 h-7 ml-1 flex items-center justify-center font-bold text-white text-xs"
                style={{ background: 'rgba(255,255,255,0.12)' }}>
                स
              </div>
            </div>
            <div>
              <span className="font-bold text-white text-sm" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवाइ</span>
              <span className="text-white/30 mx-1.5 text-xs">/</span>
              <span className="text-white/70 text-xs" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{ward.name_ne}</span>
            </div>
          </div>

          {/* Emergency counter */}
          {critical > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 border ml-1"
              style={{ background: 'rgba(200,16,46,0.2)', borderColor: CRIMSON }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CRIMSON }} />
              <span className="text-[11px] font-bold text-white">{critical} Critical</span>
            </div>
          )}

          {/* KPI strip */}
          <div className="hidden md:flex items-center gap-px ml-3 border border-white/10">
            {[
              { label: 'Total',      value: stats.total,    color: 'white' },
              { label: 'Active',     value: stats.active,   color: '#FCD34D' },
              { label: 'Resolved %', value: `${resRate}%`,  color: '#4ADE80' },
              { label: 'Overdue',    value: overdue,        color: '#FCA5A5' },
            ].map((k, i) => (
              <div key={k.label} className="px-4 py-1.5 text-center border-r border-white/10 last:border-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider leading-none mb-0.5">{k.label}</p>
                <p className="text-sm font-bold tabular-nums leading-none" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Cat filter */}
            <div className="hidden lg:flex items-center gap-1 border border-white/15 px-2 py-1"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => { setCatFilter('all'); backToOverview() }}
                className="text-[10px] font-bold px-2 py-1 transition-all"
                style={{ background: catFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white' }}>
                All
              </button>
              {catDistribution.slice(0, 5).map(([cat]) => {
                const c = CAT[cat] || CAT.Other
                return (
                  <button key={cat}
                    onClick={() => handleDrillCat(cat)}
                    className="text-[10px] font-bold px-2 py-1 transition-all"
                    style={{ background: catFilter === cat ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    {c.ne}
                  </button>
                )
              })}
            </div>

            <Link href="/submit"
              className="text-[11px] font-bold px-3 py-1.5 flex-shrink-0"
              style={{ background: CRIMSON, color: 'white' }}>
              + उजुरी
            </Link>
            <button onClick={() => signOut().then(() => router.push('/ne/login'))}
              className="text-[11px] text-white/50 hover:text-white transition-colors px-2">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ══ MAIN LAYOUT ═════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT INTELLIGENCE PANEL ───────────────────────────────────── */}
        <aside className="w-[280px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden z-10">

          {/* Panel mode header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 flex-shrink-0"
            style={{ background: LIGHT_BG }}>
            {panelMode === 'overview' ? (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Intelligence Overview</span>
            ) : panelMode === 'category' ? (
              <div className="flex items-center gap-2">
                <button onClick={backToOverview}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
                  ← Overview
                </button>
                {drillCat && (
                  <span className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: CAT[drillCat]?.color, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    / {CAT[drillCat]?.ne || drillCat}
                  </span>
                )}
              </div>
            ) : (
              <button onClick={backToOverview}
                className="text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
                ← Overview
              </button>
            )}
            <span className="text-[10px] font-mono text-gray-400">{enriched.length} total</span>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── OVERVIEW MODE ── */}
            {panelMode === 'overview' && (
              <div className="space-y-0">

                {/* Hotspots */}
                <div className="border-b border-gray-100">
                  <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: LIGHT_BG }}>
                    <div className="w-1 h-4" style={{ background: CRIMSON }} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Issue Hotspots</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {catDistribution.slice(0, 5).map(([cat, count], i) => {
                      const c = CAT[cat] || CAT.Other
                      const pct = Math.round(count / (enriched.length || 1) * 100)
                      return (
                        <button key={cat} onClick={() => handleDrillCat(cat)}
                          className="w-full text-left p-2.5 border border-gray-200 hover:border-gray-400 transition-all group"
                          style={{ borderLeft: `3px solid ${c.color}` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold" style={{ color: c.color, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                              {c.ne}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold tabular-nums" style={{ color: i === 0 ? CRIMSON : '#374151' }}>{count}</span>
                              {i === 0 && (
                                <span className="text-[9px] font-bold px-1 py-0.5 border"
                                  style={{ color: CRIMSON, borderColor: CRIMSON }}>CRITICAL</span>
                              )}
                            </div>
                          </div>
                          <div className="h-1 bg-gray-100 w-full">
                            <div className="h-full" style={{ width: `${pct}%`, background: c.color }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">
                            {pct}% of complaints → Investigate →
                          </p>
                        </button>
                      )
                    })}
                    {catDistribution.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>कुनै उजुरी छैन</p>
                    )}
                  </div>
                </div>

                {/* AI Intelligence Alerts */}
                <div className="border-b border-gray-100">
                  <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: LIGHT_BG }}>
                    <div className="w-1 h-4" style={{ background: GOV_BLUE }} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AI Intelligence</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {insights.map((ins, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 border border-gray-100"
                        style={{ background: i === 0 ? '#FEF2F2' : LIGHT_BG, borderLeft: `3px solid ${i === 0 ? CRIMSON : GOV_BLUE}` }}>
                        <span className="text-[9px] font-bold flex-shrink-0 mt-0.5 text-white px-1 py-0.5"
                          style={{ background: i === 0 ? CRIMSON : GOV_BLUE }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <p className="text-[11px] text-gray-600 leading-relaxed"
                          style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                          {ins}
                        </p>
                      </div>
                    ))}
                    {insights.length === 0 && (
                      <p className="text-[11px] text-gray-400 text-center py-3">Insufficient data for insights.</p>
                    )}
                  </div>
                </div>

                {/* SLA Status summary */}
                <div className="border-b border-gray-100">
                  <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: LIGHT_BG }}>
                    <div className="w-1 h-4" style={{ background: '#CA8A04' }} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">SLA Performance</p>
                  </div>
                  <div className="p-3">
                    {[
                      { label: 'Overdue',    count: enriched.filter(c => c.sla.level === 3).length, color: CRIMSON },
                      { label: 'Late',       count: enriched.filter(c => c.sla.level === 2).length, color: '#D97706' },
                      { label: 'Due Today',  count: enriched.filter(c => c.sla.level === 1).length, color: '#CA8A04' },
                      { label: 'On Time',    count: enriched.filter(c => c.sla.level === 0 && c.status !== 'resolved').length, color: '#16A34A' },
                      { label: 'Resolved',   count: enriched.filter(c => c.status === 'resolved').length, color: '#6B7280' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-xs text-gray-600">{s.label}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent critical (3-5 items only) */}
                <div>
                  <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: LIGHT_BG }}>
                    <div className="w-1 h-4" style={{ background: CRIMSON }} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Critical Alerts</p>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {enriched.filter(c => c.sla.level >= 2).slice(0, 5).map(c => {
                      const cat = CAT[c.category_en] || CAT.Other
                      return (
                        <button key={c.id} onClick={() => handleCardClick(c)}
                          className="w-full text-left p-2.5 border border-gray-200 hover:border-gray-400 transition-all"
                          style={{ borderLeft: `3px solid ${c.sla.dot}` }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold" style={{ color: cat.color, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                              {cat.ne}
                            </span>
                            <span className="text-[9px] font-bold px-1 py-0.5 text-white" style={{ background: c.sla.color }}>
                              {c.sla.label.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 line-clamp-1" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                            {c.summary_ne || c.text?.slice(0, 60)}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 mt-1">{c.tracking_code || c.id.slice(0, 8).toUpperCase()}</p>
                        </button>
                      )
                    })}
                    {enriched.filter(c => c.sla.level >= 2).length === 0 && (
                      <p className="text-[11px] text-green-700 text-center py-3 font-semibold">✓ No critical alerts</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── CATEGORY DRILL-DOWN MODE ── */}
            {panelMode === 'category' && (
              <div>
                {drillCat && (
                  <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0"
                    style={{ borderLeft: `4px solid ${CAT[drillCat]?.color || GOV_BLUE}` }}>
                    <p className="text-xs font-bold" style={{ color: CAT[drillCat]?.color, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      {CAT[drillCat]?.ne || drillCat}
                    </p>
                    <p className="text-[10px] text-gray-400">{drillComplaints.length} complaints</p>
                  </div>
                )}
                <div className="space-y-0">
                  {drillComplaints.map(c => (
                    <button key={c.id} onClick={() => handleCardClick(c)}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex gap-2.5"
                      style={{ borderLeft: `3px solid ${c.sla.dot}`, borderLeftWidth: selected?.id === c.id ? 3 : 3,
                        background: selected?.id === c.id ? LIGHT_BG : undefined }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold font-mono text-gray-400">
                            {c.tracking_code || c.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.5 text-white flex-shrink-0"
                            style={{ background: c.sla.color }}>
                            {c.sla.label.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed"
                          style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                          {c.summary_ne || c.text?.slice(0, 80)}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex-1 h-1 bg-gray-100">
                            <div className="h-full" style={{ width: `${(c.severity || 5) * 10}%`, background: sevColor(c.severity || 5) }} />
                          </div>
                          <span className="text-[10px] font-mono font-bold" style={{ color: sevColor(c.severity || 5) }}>
                            {c.severity || 5}/10
                          </span>
                          <span className="text-[10px] text-gray-400">{Math.floor(c.esc.daysOld)}d</span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {drillComplaints.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      कुनै उजुरी छैन
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAP (primary — takes all remaining space) ──────────────────── */}
        <div className="flex-1 relative overflow-hidden">

          {/* Map layer label */}
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest shadow-sm"
              style={{ background: 'rgba(11,60,111,0.85)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Map — {ward.name_ne}
            </div>
            {catFilter !== 'all' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm border"
                style={{ background: CAT[catFilter]?.color || GOV_BLUE, borderColor: 'rgba(255,255,255,0.2)' }}>
                {(CAT[catFilter]?.ne || catFilter).toUpperCase()}
                <button onClick={() => { setCatFilter('all'); backToOverview() }}
                  className="ml-1 hover:opacity-70 transition-opacity">×</button>
              </div>
            )}
          </div>

          {/* Map legend */}
          <div className="absolute bottom-4 left-3 z-[1000] px-3 py-2 border border-gray-200 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.95)' }}>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Severity</p>
            {[
              { label: 'Critical (8-10)', color: CRIMSON },
              { label: 'High (5-7)',      color: '#D97706' },
              { label: 'Low (1-4)',       color: GOV_BLUE },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 mb-1 last:mb-0">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>

          
          

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <WardMap
            ward={ward as any}
            complaints={mapFiltered as any}
            flyTo={flyTo as any}
            selectedId={selected?.id}
            onSelect={handleCardClick as any}
          />

          {/* ── COMPLAINT INSPECTOR (right slide-in drawer) ──────────── */}
          <div
            className="absolute right-0 top-0 bottom-0 z-[9999] flex flex-col overflow-y-auto border-l border-gray-200 shadow-2xl transition-all duration-300"
            style={{
              width: selected ? 360 : 0,
              opacity: selected ? 1 : 0,
              background: 'white',
              pointerEvents: selected ? 'auto' : 'none',
            }}>
            {selected && (
              <ComplaintDetailPanel
                complaint={selected as Complaint}
                note={note} setNote={setNote}
                referred={referred} setReferred={setReferred}
                newStatus={newStatus} setNewStatus={setNewStatus}
                saving={saving} saved={saved}
                onSave={handleSaveNote}
                departments={DEPARTMENTS}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Complaint Inspector Panel ─────────────────────────────────────────
function ComplaintDetailPanel({
  complaint, note, setNote, referred, setReferred,
  newStatus, setNewStatus, saving, saved, onSave, departments, onClose,
}: {
  complaint: Complaint
  note: string; setNote: (v: string) => void
  referred: string; setReferred: (v: string) => void
  newStatus: string; setNewStatus: (v: string) => void
  saving: boolean; saved: boolean
  onSave: () => void
  departments: string[]
  onClose?: () => void
}) {
  const cat     = CAT[complaint.category_en] || CAT.Other
  const sev     = complaint.severity || 5
  const sc      = sevColor(sev)
  const daysOld = Math.floor((Date.now() - new Date(complaint.created_at).getTime()) / 86_400_000)
  const sla     = getSlaStatus(complaint)

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Inspector header */}
      <div className="px-4 py-3 border-b-2 border-gray-200 flex-shrink-0" style={{ background: GOV_BLUE }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Complaint Inspector</p>
            <h3 className="font-bold text-white text-sm" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              {cat.ne}
            </h3>
            <p className="text-white/50 text-[10px] font-mono mt-0.5">
              {complaint.tracking_code || complaint.id.slice(0, 8).toUpperCase()} · {daysOld}d ago
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-center px-2 py-1 border border-white/20"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <p className="text-[9px] text-white/50">SEV</p>
              <p className="text-base font-bold text-white">{sev}</p>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-1 flex-shrink-0"
              style={{ background: sla.color, color: 'white' }}>
              {sla.label.toUpperCase()}
            </span>
            {onClose && (
              <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white transition-colors text-lg leading-none flex-shrink-0">
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline strip */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0" style={{ background: LIGHT_BG }}>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Timeline</p>
        <div className="flex items-center gap-0">
          {[
            { label: 'Submitted', done: true },
            { label: 'Assigned',  done: !!complaint.referred_to },
            { label: 'In Review', done: complaint.status === 'pending' || complaint.status === 'resolved' },
            { label: 'Action',    done: (complaint.officer_notes?.length || 0) > 0 },
            { label: 'Resolved',  done: complaint.status === 'resolved' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                  style={{ background: step.done ? GOV_BLUE : '#E5E7EB' }}>
                  {step.done && (
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-[8px] text-gray-400 mt-1 text-center w-12 leading-tight">{step.label}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px mb-4" style={{ background: step.done ? GOV_BLUE : '#E5E7EB' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">

          {/* Severity bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Severity</p>
              <span className="text-xs font-bold tabular-nums" style={{ color: sc }}>{sev}/10</span>
            </div>
            <div className="h-2 bg-gray-100 w-full">
              <div className="h-full" style={{ width: `${sev * 10}%`, background: sc }} />
            </div>
          </div>

          {/* AI Summary */}
          {complaint.summary_ne && (
            <div className="p-3 border border-gray-200" style={{ borderLeft: `3px solid ${GOV_BLUE}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOV_BLUE }}>AI Summary</p>
              <p className="text-xs text-gray-700 leading-relaxed"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                {complaint.summary_ne}
              </p>
            </div>
          )}


          {/* Original complaint */}
          {complaint.text && (
            <div className="p-3 border border-gray-200" style={{ background: LIGHT_BG }}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Citizen Report</p>
              <p className="text-xs text-gray-600 leading-relaxed"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                {complaint.text.slice(0, 250)}{complaint.text.length > 250 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Followup data */}
          {complaint.followup_data && Object.keys(complaint.followup_data).length > 0 && (
            <div className="p-3 border border-gray-200" style={{ background: LIGHT_BG }}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Form Data</p>
              <table className="w-full text-[10px]">
                <tbody>
                  {Object.entries(complaint.followup_data).filter(([, v]) => v).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 text-gray-400 capitalize pr-2">{k.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 font-semibold text-gray-700" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Past officer notes */}
          {complaint.officer_notes && complaint.officer_notes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Officer History</p>
              <div className="space-y-1.5">
                {complaint.officer_notes.map((n, i) => (
                  <div key={i} className="p-2.5 border border-gray-200 text-xs text-gray-600"
                    style={{ background: LIGHT_BG, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Officer Action Panel */}
          <div className="border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-1.5" style={{ background: MID_GRAY }}>
              <div className="w-1 h-4" style={{ background: GOV_BLUE }} />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Action Controls</p>
            </div>
            <div className="p-3 space-y-3">

              {/* Status */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Update Status</label>
                <div className="flex gap-1">
                  {[['active', 'Active', GOV_BLUE], ['pending', 'In Review', '#D97706'], ['resolved', 'Resolved', '#16A34A']].map(([v, l, c]) => (
                    <button key={v} onClick={() => setNewStatus(v)}
                      className="flex-1 text-[11px] py-2 font-bold transition-all border"
                      style={{
                        background: newStatus === v ? c : 'white',
                        color: newStatus === v ? 'white' : '#6B7280',
                        borderColor: newStatus === v ? c : '#D1D5DB',
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Assign / Refer To</label>
                <select value={referred} onChange={e => setReferred(e.target.value)}
                  className="w-full text-xs border border-gray-300 px-3 py-2 text-gray-700 bg-white outline-none transition-all"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  <option value="">Select department...</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Officer Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Action taken today..."
                  className="w-full text-xs border border-gray-300 px-3 py-2 text-gray-700 placeholder-gray-400 outline-none resize-none transition-all"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
                />
              </div>

              <button onClick={onSave} disabled={saving || !note.trim()}
                className="w-full py-2.5 text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: saved ? '#16A34A' : GOV_BLUE, color: 'white' }}>
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  : saved ? '✓ Saved'
                  : 'Save Update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// sevColor is defined at module level above
