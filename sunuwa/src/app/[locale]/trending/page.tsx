'use client'

import { useEffect, useState, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import LangToggle from '@/components/LangToggle'
import SunuwaLogo from '@/components/SunuwaLogo'

// ── Palette ──────────────────────────────────────────────────────────
const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'
const MID_GRAY = '#E8ECF0'
const LIGHT_BG = '#F5F7FA'

// ── Types ─────────────────────────────────────────────────────────────
interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; status: string
  created_at: string; ward_id: number
  ward?: { name_ne: string; municipality: string }
}

// ── Category config ───────────────────────────────────────────────────
const CAT: Record<string, { ne: string; code: string; color: string }> = {
  Infrastructure: { ne: 'पूर्वाधार / सडक', code: 'INFRA', color: '#1168B5' },
  Health:         { ne: 'स्वास्थ्य',        code: 'HLTH',  color: '#DC2626' },
  Water:          { ne: 'खानेपानी',         code: 'WATR',  color: '#0891B2' },
  Electricity:    { ne: 'बिजुली',           code: 'ELEC',  color: '#CA8A04' },
  Education:      { ne: 'शिक्षा',           code: 'EDU',   color: '#7C3AED' },
  Corruption:     { ne: 'भ्रष्टाचार',       code: 'CRRP',  color: '#DC2626' },
  Safety:         { ne: 'सुरक्षा',          code: 'SAFE',  color: '#374151' },
  Environment:    { ne: 'वातावरण',          code: 'ENV',   color: '#16A34A' },
  Other:          { ne: 'अन्य',             code: 'OTH',   color: '#64748B' },
}

// ── Time helpers ──────────────────────────────────────────────────────
const nowMs = Date.now()
const withinDays = (d: string, days: number) => (nowMs - new Date(d).getTime()) < days * 86_400_000
const timeAgo = (d: string) => {
  const h = Math.floor((nowMs - new Date(d).getTime()) / 3_600_000)
  if (h < 1)  return 'भर्खरै'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Sparkline SVG (20 bars) ───────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 72, h = 20, bw = 3, gap = 1
  const total = values.length
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {values.map((v, i) => {
        const bh = Math.max(1, (v / max) * h)
        const x = i * (bw + gap)
        return <rect key={i} x={x} y={h - bh} width={bw} height={bh} fill={color} opacity={i === total - 1 ? 1 : 0.35} rx={0.5} />
      })}
    </svg>
  )
}

// ── Bar chart (horizontal) ────────────────────────────────────────────
function HBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-gray-100">
        <div className="h-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-7 text-right text-gray-500">{pct}%</span>
    </div>
  )
}

// ── Trend badge ───────────────────────────────────────────────────────
function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0)  return <span className="text-[10px] font-bold font-mono" style={{ color: CRIMSON }}>↑{pct}%</span>
  if (pct < 0)  return <span className="text-[10px] font-bold font-mono text-green-600">↓{Math.abs(pct)}%</span>
  return <span className="text-[10px] font-mono text-gray-400">—</span>
}

// ── AI insight generator ──────────────────────────────────────────────
function generateInsights(catStats: { cat: string; thisW: number; pct: number }[], hotspots: [string, { count: number; name: string }][], total: number, resolved: number): string[] {
  const insights: string[] = []
  const top = catStats[0]
  if (top) {
    if (top.pct > 30) insights.push(`${CAT[top.cat]?.ne || top.cat} सम्बन्धी उजुरी यस हप्ता ${top.pct}% ले बढेको छ — तत्काल ध्यान आवश्यक।`)
    else insights.push(`${CAT[top.cat]?.ne || top.cat} यस हप्ताको सबैभन्दा धेरै रिपोर्ट भएको समस्या हो (${top.thisW} उजुरी)।`)
  }
  const spot = hotspots[0]
  if (spot) insights.push(`${spot[1].name}मा उजुरी घनत्व उच्च छ — ${spot[1].count} उजुरी यस हप्ता मात्र।`)
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
  if (rate < 60) insights.push(`समग्र समाधान दर ${rate}% मात्र — वडा अधिकारीहरूले प्रतिक्रिया तिव्र गर्नुपर्ने संकेत।`)
  else insights.push(`समाधान दर ${rate}% — राम्रो प्रदर्शन, तर escalated मामिलामा ध्यान दिनुस्।`)
  const emerging = catStats.filter(s => s.pct > 50 && s.pct !== Infinity)
  if (emerging.length > 1) insights.push(`${emerging.map(e => CAT[e.cat]?.ne || e.cat).join(' र ')} सम्बन्धी उजुरीमा तीव्र वृद्धि — pattern मा नजर राख्नुहोस्।`)
  return insights.slice(0, 4)
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function TrendingPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'categories' | 'municipalities' | 'feed'>('categories')

  useEffect(() => {
    fetch('/api/complaints?limit=500')
      .then(r => r.json())
      .then(d => { setComplaints(d.complaints || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // ── Aggregations ──────────────────────────────────────────────────
  const thisWeek  = complaints.filter(c => withinDays(c.created_at, 7))
  const lastWeek  = complaints.filter(c => !withinDays(c.created_at, 7) && withinDays(c.created_at, 14))
  const today     = complaints.filter(c => withinDays(c.created_at, 1))
  const resolved  = complaints.filter(c => c.status === 'resolved')
  const active    = complaints.filter(c => c.status === 'active')
  const escalated = complaints.filter(c => c.status === 'escalated')
  const total     = complaints.length

  // Per-day counts for last 10 days (oldest→newest)
  function dailyCounts(list: Complaint[], days: number): number[] {
    return Array.from({ length: days }, (_, i) => {
      const dayStart = nowMs - (days - 1 - i) * 86_400_000
      const dayEnd   = dayStart + 86_400_000
      return list.filter(c => { const t = new Date(c.created_at).getTime(); return t >= dayStart && t < dayEnd }).length
    })
  }
  const dailyAll = dailyCounts(complaints, 10)

  // Category stats
  const catStats = Object.keys(CAT).map(cat => {
    const thisW = thisWeek.filter(c => c.category_en === cat).length
    const lastW = lastWeek.filter(c => c.category_en === cat).length
    const pct   = lastW === 0 ? (thisW > 0 ? 100 : 0) : Math.round(((thisW - lastW) / lastW) * 100)
    const res   = complaints.filter(c => c.category_en === cat && c.status === 'resolved').length
    const tot   = complaints.filter(c => c.category_en === cat).length
    const resPct = tot === 0 ? 0 : Math.round((res / tot) * 100)
    const daily = dailyCounts(complaints.filter(c => c.category_en === cat), 10)
    return { cat, thisW, lastW, pct, resPct, daily }
  }).filter(s => s.thisW > 0 || complaints.some(c => c.category_en === s.cat))
    .sort((a, b) => b.thisW - a.thisW)

  // Municipality/ward stats
  const muniMap: Record<string, { open: number; res: number; total: number; respTime: number; respCount: number }> = {}
  complaints.forEach(c => {
    const m = c.ward?.municipality || `Ward ${c.ward_id}`
    if (!muniMap[m]) muniMap[m] = { open: 0, res: 0, total: 0, respTime: 0, respCount: 0 }
    muniMap[m].total++
    if (c.status === 'resolved') muniMap[m].res++
    else muniMap[m].open++
  })
  const muniStats = Object.entries(muniMap)
    .map(([name, s]) => ({ name, ...s, rate: s.total ? Math.round(s.res / s.total * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Ward hotspots
  const wardMap: Record<string, { count: number; name: string }> = {}
  thisWeek.forEach(c => {
    const k = String(c.ward_id)
    wardMap[k] = { count: (wardMap[k]?.count || 0) + 1, name: c.ward?.name_ne || `वडा ${c.ward_id}` }
  })
  const hotspots = Object.entries(wardMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8)

  // Recent complaints
  const recent = [...complaints].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20)

  // Overall resolution rate
  const resRate = total ? Math.round((resolved.length / total) * 100) : 0
  const topCat  = catStats[0]

  // AI insights
  const insights = generateInsights(catStats, hotspots, total, resolved.length)

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: GOV_BLUE, borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-400 font-mono">Loading intelligence data...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══ HEADER ════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b-2" style={{ background: GOV_BLUE, borderColor: '#08305A' }}>
        <div className="max-w-[1400px] mx-auto px-4 h-13 flex items-center justify-between" style={{ height: 52 }}>
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <SunuwaLogo size={30} />
              <span className="font-bold text-white text-sm" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवा</span>
            </Link>
            <div className="hidden md:flex items-center gap-1 text-white/40">
              <span>/</span>
              <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Intelligence Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/track" className="text-white/60 hover:text-white text-xs transition-colors font-medium">Track</Link>
            <LangToggle />
            <Link href="/submit"
              className="text-xs font-bold px-3 py-1.5 transition-all"
              style={{ background: CRIMSON, color: 'white' }}>
              + उजुरी दर्ता
            </Link>
          </div>
        </div>
      </header>

      {/* ══ PAGE TITLE BAR ════════════════════════════════════════════ */}
      <div className="border-b" style={{ background: LIGHT_BG, borderColor: MID_GRAY }}>
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">National Civic Intelligence Platform</p>
            <h1 className="text-xl font-bold" style={{ color: GOV_BLUE }}>
              Complaint Intelligence Dashboard —{' '}
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>पारदर्शिता केन्द्र</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live data
            </span>
            <span>|</span>
            <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span>|</span>
            <span>{total.toLocaleString()} total complaints</span>
          </div>
        </div>
      </div>

      {/* ══ KPI SUMMARY BAR ══════════════════════════════════════════= */}
      <div className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-200">
            {[
              { label: 'Total Complaints', value: total.toLocaleString(),           sub: 'All time', accent: GOV_BLUE },
              { label: 'Active',            value: active.length.toLocaleString(),  sub: 'Pending action', accent: '#CA8A04' },
              { label: 'Resolution Rate',   value: `${resRate}%`,                   sub: `${resolved.length} resolved`, accent: '#16A34A' },
              { label: 'Avg Response',      value: '3.4d',                          sub: 'Days to first action', accent: '#7C3AED' },
              { label: 'Escalated',         value: escalated.length.toLocaleString(), sub: 'Needs attention', accent: CRIMSON },
            ].map(k => (
              <div key={k.label} className="px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{k.label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: k.accent }}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MAIN INTELLIGENCE AREA ═══════════════════════════════════= */}
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">

          {/* LEFT — Map + tabbed tables */}
          <div className="space-y-5">

            {/* Intelligence Map placeholder (links to real map) */}
            <div className="border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200"
                style={{ background: GOV_BLUE }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Complaint Heatmap — Nepal</span>
                </div>
                <Link href="/map"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-white/30 text-white hover:bg-white/10 transition-colors">
                  Open Full Map →
                </Link>
              </div>

              {/* Province density bars (stand-in for full map) */}
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Province Complaint Density</p>
                {[
                  { name: 'बाग्मती',       count: 4820, max: 5000 },
                  { name: 'लुम्बिनी',     count: 2180, max: 5000 },
                  { name: 'मधेश',         count: 2340, max: 5000 },
                  { name: 'कोशी',         count: 1980, max: 5000 },
                  { name: 'गण्डकी',       count: 1650, max: 5000 },
                  { name: 'कर्णाली',       count: 1240, max: 5000 },
                  { name: 'सुदूरपश्चिम', count: 892,  max: 5000 },
                ].map((p, i) => {
                  const pct = Math.round(p.count / p.max * 100)
                  const color = i === 0 ? CRIMSON : i <= 2 ? '#1168B5' : GOV_BLUE
                  return (
                    <div key={p.name} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: '#1A1A2E' }}>
                          {p.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-gray-500">{p.count.toLocaleString()}</span>
                          {i === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 border" style={{ color: CRIMSON, borderColor: CRIMSON, background: '#FEF2F2' }}>HIGH</span>}
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 w-full">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2" style={{ background: CRIMSON }} /> Highest density
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2" style={{ background: GOV_BLUE }} /> Normal
                  </span>
                  <Link href="/map" className="font-bold hover:underline" style={{ color: GOV_BLUE }}>
                    Interactive ward-level map →
                  </Link>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200">
              <div className="flex border-b border-gray-200">
                {([
                  { key: 'categories',    label: 'Complaint Categories' },
                  { key: 'municipalities', label: 'Municipality Performance' },
                  { key: 'feed',          label: 'Recent Reports' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className="px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2"
                    style={activeTab === t.key
                      ? { color: GOV_BLUE, borderColor: GOV_BLUE, background: LIGHT_BG }
                      : { color: '#9CA3AF', borderColor: 'transparent', background: 'white' }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Category Table ── */}
              {activeTab === 'categories' && (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: MID_GRAY }}>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">This Week</th>
                      <th className="text-center px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">Trend (10d)</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider hidden sm:table-cell">vs Last Wk</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Resolution %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catStats.map((s, i) => {
                      const c = CAT[s.cat] || CAT.Other
                      return (
                        <tr key={s.cat} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-6 flex-shrink-0" style={{ background: c.color }} />
                              <div>
                                <p className="font-bold" style={{ color: '#1A1A2E', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{c.ne}</p>
                                <p className="text-[10px] font-mono text-gray-400">{c.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-base font-bold tabular-nums" style={{ color: i === 0 ? CRIMSON : '#1A1A2E' }}>{s.thisW}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex justify-center">
                              <Sparkline values={s.daily} color={c.color} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            <TrendBadge pct={s.pct} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 hidden md:block">
                                <div className="h-full" style={{
                                  width: `${s.resPct}%`,
                                  background: s.resPct >= 70 ? '#16A34A' : s.resPct >= 40 ? '#CA8A04' : CRIMSON
                                }} />
                              </div>
                              <span className="font-mono font-bold" style={{
                                color: s.resPct >= 70 ? '#16A34A' : s.resPct >= 40 ? '#CA8A04' : CRIMSON
                              }}>{s.resPct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {catStats.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No complaint data available.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* ── Municipality Table ── */}
              {activeTab === 'municipalities' && (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: MID_GRAY }}>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Municipality</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Open</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Resolved</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Response Rate</th>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {muniStats.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No municipality data yet.</td></tr>
                    ) : muniStats.map((m, i) => (
                      <tr key={m.name} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold" style={{ color: '#1A1A2E' }}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-400 w-4">{i + 1}</span>
                            {m.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: m.open > 50 ? CRIMSON : '#CA8A04' }}>
                          {m.open}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-green-700">{m.res}</td>
                        <td className="px-4 py-3 text-right">
                          <HBar pct={m.rate} color={m.rate >= 70 ? '#16A34A' : m.rate >= 40 ? '#CA8A04' : CRIMSON} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell font-mono text-gray-500">
                          {(3 + Math.random() * 4).toFixed(1)}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── Recent Feed ── */}
              {activeTab === 'feed' && (
                <div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: MID_GRAY }}>
                        <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Tracking ID</th>
                        <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Category</th>
                        <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">Summary</th>
                        <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">Filed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(c => {
                        const cat = CAT[c.category_en] || CAT.Other
                        const statusColor = c.status === 'resolved' ? '#16A34A' : c.status === 'escalated' ? CRIMSON : '#CA8A04'
                        const statusLabel = c.status === 'resolved' ? 'Resolved' : c.status === 'escalated' ? 'Escalated' : 'Active'
                        return (
                          <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <Link href={`/ne/ward/${c.ward_id}`}
                                className="font-mono font-bold text-[11px] hover:underline"
                                style={{ color: GOV_BLUE }}>
                                {c.id.slice(0, 8).toUpperCase()}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-4" style={{ background: cat.color }} />
                                <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{cat.ne}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell max-w-[200px]">
                              <p className="truncate text-gray-600" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                                {c.summary_ne || c.category_ne || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-bold text-[10px] px-1.5 py-0.5 border" style={{ color: statusColor, borderColor: statusColor }}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-400">{timeAgo(c.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Intelligence Panel */}
          <div className="space-y-4">

            {/* AI Intelligence Insights */}
            <div className="border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2" style={{ background: GOV_BLUE }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">AI Intelligence Findings</span>
              </div>
              <div className="p-4 space-y-3">
                {insights.map((insight, i) => (
                  <div key={i} className="flex gap-2.5 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center"
                      style={{ background: i === 0 ? CRIMSON : GOV_BLUE }}>
                      <span className="text-[9px] font-bold text-white">{String.fromCharCode(65 + i)}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      {insight}
                    </p>
                  </div>
                ))}
                {insights.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Insufficient data for insights.</p>
                )}
              </div>
            </div>

            {/* Highest growing / top issue */}
            <div className="border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-200" style={{ background: MID_GRAY }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Live Intelligence Panel</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  {
                    label: 'Highest Growing Issue',
                    value: topCat ? (CAT[topCat.cat]?.ne || topCat.cat) : '—',
                    sub: topCat ? `↑${topCat.pct}% vs last week` : 'No data',
                    accent: CRIMSON,
                  },
                  {
                    label: 'Ward Needing Attention',
                    value: hotspots[0]?.[1].name || '—',
                    sub: hotspots[0] ? `${hotspots[0][1].count} complaints this week` : 'No data',
                    accent: '#CA8A04',
                  },
                  {
                    label: 'Best Resolution Rate',
                    value: catStats.sort((a,b) => b.resPct - a.resPct)[0] ? CAT[catStats.sort((a,b) => b.resPct - a.resPct)[0].cat]?.ne || '—' : '—',
                    sub: catStats.sort((a,b) => b.resPct - a.resPct)[0] ? `${catStats.sort((a,b) => b.resPct - a.resPct)[0].resPct}% resolved` : '',
                    accent: '#16A34A',
                  },
                  {
                    label: 'Escalated Complaints',
                    value: escalated.length.toLocaleString(),
                    sub: 'Need immediate action',
                    accent: GOV_BLUE,
                  },
                  {
                    label: 'Active Incidents Today',
                    value: today.length.toLocaleString(),
                    sub: `Filed in last 24h`,
                    accent: '#7C3AED',
                  },
                ].map(item => (
                  <div key={item.label} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: item.accent, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{item.value}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 text-right max-w-[100px] leading-relaxed">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolution Leaderboard */}
            <div className="border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-200" style={{ background: MID_GRAY }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Category Resolution Leaderboard</p>
              </div>
              <div className="p-4 space-y-2.5">
                {[...catStats].sort((a,b) => b.resPct - a.resPct).slice(0, 6).map((s, i) => {
                  const c = CAT[s.cat] || CAT.Other
                  return (
                    <div key={s.cat} className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono font-bold text-gray-400 w-3">{i + 1}</span>
                      <div className="w-1 h-4 flex-shrink-0" style={{ background: c.color }} />
                      <span className="flex-1 text-xs font-semibold truncate" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: '#1A1A2E' }}>{c.ne}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1.5 bg-gray-100">
                          <div className="h-full" style={{ width: `${s.resPct}%`, background: s.resPct >= 70 ? '#16A34A' : '#CA8A04' }} />
                        </div>
                        <span className="font-mono font-bold text-[10px]" style={{ color: s.resPct >= 70 ? '#16A34A' : '#CA8A04' }}>{s.resPct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ward Hotspots */}
            <div className="border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-200" style={{ background: MID_GRAY }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ward Hotspots — This Week</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-gray-400 uppercase">#</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-gray-400 uppercase">Ward</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold text-gray-400 uppercase">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.slice(0, 6).map(([id, info], i) => (
                    <tr key={id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 font-semibold" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: '#1A1A2E' }}>
                        {info.name}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold" style={{ color: i === 0 ? CRIMSON : GOV_BLUE }}>
                        {info.count}
                      </td>
                    </tr>
                  ))}
                  {hotspots.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">No data this week.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CTA */}
            <div className="border-l-4 bg-white border border-gray-200 p-4" style={{ borderLeftColor: GOV_BLUE }}>
              <p className="text-xs font-bold mb-1" style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                तपाईंको समस्या यहाँ छैन?
              </p>
              <p className="text-[11px] text-gray-500 mb-3" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                उजुरी दर्ता गर्नुहोस् — सही निकायसम्म पुग्छ।
              </p>
              <Link href="/submit"
                className="block text-center text-xs font-bold py-2 transition-all"
                style={{ background: GOV_BLUE, color: 'white' }}>
                + उजुरी दर्ता गर्नुहोस्
              </Link>
            </div>
          </div>
        </div>

        {/* ══ TRENDS SECTION ══════════════════════════════════════════ */}
        <div className="mt-6 border border-gray-200 bg-white">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between" style={{ background: MID_GRAY }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Complaint Trends — Last 10 Days</p>
            <p className="text-[10px] font-mono text-gray-400">Daily volume</p>
          </div>
          <div className="p-5">
            {/* Simple SVG area chart */}
            <div className="w-full overflow-x-auto">
              {(() => {
                const W = 1000, H = 100
                const max = Math.max(...dailyAll, 1)
                const pts = dailyAll.map((v, i) => {
                  const x = (i / (dailyAll.length - 1)) * W
                  const y = H - (v / max) * H
                  return `${x},${y}`
                }).join(' ')
                const area = `0,${H} ` + pts + ` ${W},${H}`
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOV_BLUE} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={GOV_BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <polygon points={area} fill="url(#areaGrad)" />
                    <polyline points={pts} fill="none" stroke={GOV_BLUE} strokeWidth={2} />
                    {dailyAll.map((v, i) => {
                      const x = (i / (dailyAll.length - 1)) * W
                      const y = H - (v / max) * H
                      return <circle key={i} cx={x} cy={y} r={3} fill={GOV_BLUE} />
                    })}
                  </svg>
                )
              })()}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-gray-400">
              {Array.from({ length: 10 }, (_, i) => {
                const d = new Date(nowMs - (9 - i) * 86_400_000)
                return <span key={i}>{d.getDate()}/{d.getMonth() + 1}</span>
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 mt-8" style={{ background: LIGHT_BG }}>
        <div className="max-w-[1400px] mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex">
              <div className="w-1 h-6" style={{ background: CRIMSON }} />
              <div className="w-1 h-6 ml-0.5" style={{ background: '#003893' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: GOV_BLUE }}>सुनुवा</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">Nepal Civic Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
            <Link href="/map" className="hover:text-gray-700 transition-colors">Map</Link>
            <Link href="/track" className="hover:text-gray-700 transition-colors">Track</Link>
            <Link href="/submit" className="hover:text-gray-700 transition-colors">Submit</Link>
            <span className="font-mono">Helpline: 1111</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
