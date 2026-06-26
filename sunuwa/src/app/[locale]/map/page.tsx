'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import 'leaflet/dist/leaflet.css'

// ── Palette (shared across all pages) ────────────────────────────────────────
const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'
const MID_GRAY = '#E8ECF0'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ward { id: number; name: string; name_ne: string; municipality: string; district: string; lat: number; lng: number }
interface Complaint { id: string; category_en: string; category_ne: string; severity: number; summary_ne?: string; status: string; created_at: string; escalation_level?: number }
interface WardStats { ward: Ward; total: number; active: number; critical: number; resolved: number; topCategory: string; complaints: Complaint[] }

// ── Category config ───────────────────────────────────────────────────────────
const CAT: Record<string, { color: string; ne: string; code: string }> = {
  Infrastructure: { color: '#1168B5', ne: 'पूर्वाधार / सडक', code: 'INFRA' },
  Health:         { color: CRIMSON,   ne: 'स्वास्थ्य',        code: 'HLTH'  },
  Water:          { color: '#0891B2', ne: 'खानेपानी',         code: 'WATR'  },
  Electricity:    { color: '#CA8A04', ne: 'बिजुली',           code: 'ELEC'  },
  Education:      { color: '#7C3AED', ne: 'शिक्षा',           code: 'EDU'   },
  Corruption:     { color: '#DC2626', ne: 'भ्रष्टाचार',       code: 'CRRP'  },
  Safety:         { color: '#374151', ne: 'सुरक्षा',          code: 'SAFE'  },
  Environment:    { color: '#16A34A', ne: 'वातावरण',          code: 'ENV'   },
  Other:          { color: '#64748B', ne: 'अन्य',             code: 'OTH'   },
}

type Layer    = 'problems' | 'progress' | 'trends' | 'community'
type TimeRange = '24h' | '7d' | '30d' | '6m' | '1y'

const LAYERS: { key: Layer; label: string; desc: string }[] = [
  { key: 'problems',  label: 'Problems',  desc: 'Active complaint heatmap' },
  { key: 'progress',  label: 'Progress',  desc: 'Resolved & improving areas' },
  { key: 'trends',    label: 'Trends',    desc: 'Complaint growth patterns' },
  { key: 'community', label: 'Community', desc: 'Citizen engagement' },
]

const TIMES: { key: TimeRange; label: string; days: number }[] = [
  { key: '24h', label: 'Last 24h',    days: 1   },
  { key: '7d',  label: 'Last 7 Days', days: 7   },
  { key: '30d', label: 'Last 30 Days',days: 30  },
  { key: '6m',  label: '6 Months',    days: 180 },
  { key: '1y',  label: '1 Year',      days: 365 },
]

// ── Resolve color by layer + ward stats ───────────────────────────────────────
function wardColor(ws: WardStats, layer: Layer): string {
  const resRate = ws.total > 0 ? ws.resolved / ws.total : 0
  if (layer === 'progress') {
    if (resRate >= 0.75) return '#16A34A'
    if (resRate >= 0.5)  return '#4ADE80'
    if (resRate >= 0.25) return '#86EFAC'
    return '#D1FAE5'
  }
  if (layer === 'community') {
    const pulse = resRate * 0.6 + (ws.total > 0 ? Math.min(ws.total / 20, 1) * 0.4 : 0)
    if (pulse >= 0.7) return '#0B3C6F'
    if (pulse >= 0.4) return '#1168B5'
    return '#93C5FD'
  }
  if (layer === 'trends') {
    if (ws.critical > 3) return CRIMSON
    if (ws.critical > 0) return '#F97316'
    return '#CA8A04'
  }
  // problems layer
  if (ws.critical > 5) return CRIMSON
  if (ws.critical > 2) return '#F97316'
  if (ws.total > 5)    return '#EAB308'
  if (resRate >= 0.6)  return '#16A34A'
  return GOV_BLUE
}

// ── Mini sparkline (10 bars) ──────────────────────────────────────────────────
function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <svg width={56} height={16} viewBox="0 0 56 16">
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * 16)
        return <rect key={i} x={i * 6} y={16 - h} width={4} height={h} fill={color} opacity={i === values.length - 1 ? 1 : 0.3} rx={0.5} />
      })}
    </svg>
  )
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
function TrendArrow({ pct }: { pct: number }) {
  if (pct > 10)  return <span className="text-[10px] font-bold font-mono" style={{ color: CRIMSON }}>↑{pct}%</span>
  if (pct < -10) return <span className="text-[10px] font-bold font-mono text-green-600">↓{Math.abs(pct)}%</span>
  return <span className="text-[10px] font-mono text-gray-400">→</span>
}

// ── Government impact feed (demo) ─────────────────────────────────────────────
const GOV_ACTIONS = [
  { ward: 'वडा ८', action: 'Road repaired near school',        days: 2  },
  { ward: 'वडा २', action: 'Water supply restored',            days: 3  },
  { ward: 'वडा १२',action: 'Hospital sanitation completed',    days: 5  },
  { ward: 'वडा ५', action: 'Streetlights fixed (14 units)',    days: 6  },
  { ward: 'वडा ३', action: 'Drainage cleared after flood',     days: 9  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicMapPage() {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInst     = useRef<L.Map | null>(null)
  const markersRef  = useRef<Map<number, L.Layer>>(new Map())

  const [wards,     setWards]     = useState<WardStats[]>([])
  const [loading,   setLoading]   = useState(true)
  const [layer,     setLayer]     = useState<Layer>('problems')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [selected,  setSelected]  = useState<WardStats | null>(null)
  const [totalC,    setTotalC]    = useState(0)
  const [critC,     setCritC]     = useState(0)
  const [resRate,   setResRate]   = useState(0)
  const [todayC,    setTodayC]    = useState(0)

  // Fetch data
  useEffect(() => {
    fetch('/api/wards')
      .then(r => r.json())
      .then(async (d: { wards: Ward[] }) => {
        const wardList: Ward[] = d.wards || []
        const results = await Promise.all(
          wardList.map(async (w) => {
            try {
              const r = await fetch(`/api/wards/${w.id}`)
              const data = await r.json()
              const complaints: Complaint[] = data.complaints || []
              const freq: Record<string, number> = {}
              complaints.forEach(c => { freq[c.category_en] = (freq[c.category_en] || 0) + 1 })
              const topCategory = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other'
              return {
                ward: w,
                total:    complaints.length,
                active:   complaints.filter(c => c.status === 'active').length,
                resolved: complaints.filter(c => c.status === 'resolved').length,
                critical: complaints.filter(c => (c.severity || 0) >= 8 || (c.escalation_level || 1) >= 3).length,
                topCategory,
                complaints,
              } as WardStats
            } catch {
              return { ward: w, total: 0, active: 0, resolved: 0, critical: 0, topCategory: 'Other', complaints: [] }
            }
          })
        )
        setWards(results)
        const tot  = results.reduce((s, r) => s + r.total, 0)
        const crit = results.reduce((s, r) => s + r.critical, 0)
        const res  = results.reduce((s, r) => s + r.resolved, 0)
        const now  = Date.now()
        const tod  = results.reduce((s, r) => s + r.complaints.filter(c => (now - new Date(c.created_at).getTime()) < 86_400_000).length, 0)
        setTotalC(tot); setCritC(crit)
        setResRate(tot > 0 ? Math.round(res / tot * 100) : 0)
        setTodayC(tod)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    import('leaflet').then(L => {
      if (!mapRef.current || mapInst.current) return
      const map = L.map(mapRef.current, {
        center: [28.0, 84.0], zoom: 7,
        zoomControl: false, attributionControl: true,
      })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapInst.current = map
    })
    return () => { mapInst.current?.remove(); mapInst.current = null; markersRef.current.clear() }
  }, [])

  // Draw markers when wards/layer/time changes
  useEffect(() => {
    const map = mapInst.current
    if (!map || wards.length === 0) return
    import('leaflet').then(L => {
      markersRef.current.forEach(m => (m as L.Layer).remove())
      markersRef.current.clear()

      const timeDays = TIMES.find(t => t.key === timeRange)?.days ?? 30
      const cutoff   = Date.now() - timeDays * 86_400_000

      wards.forEach(ws => {
        if (!ws.ward.lat || !ws.ward.lng) return
        const filtered: WardStats = {
          ...ws,
          complaints: ws.complaints.filter(c => new Date(c.created_at).getTime() >= cutoff),
          total:    ws.complaints.filter(c => new Date(c.created_at).getTime() >= cutoff).length,
          resolved: ws.complaints.filter(c => new Date(c.created_at).getTime() >= cutoff && c.status === 'resolved').length,
          critical: ws.complaints.filter(c => new Date(c.created_at).getTime() >= cutoff && ((c.severity||0)>=8||(c.escalation_level||1)>=3)).length,
          active:   ws.complaints.filter(c => new Date(c.created_at).getTime() >= cutoff && c.status === 'active').length,
        }
        if (filtered.total === 0 && layer !== 'community') return

        const color     = wardColor(filtered, layer)
        const maxTotal  = Math.max(...wards.map(w => w.total), 1)
        const ratio     = filtered.total / maxTotal
        const heatR     = 18000 + ratio * 55000

        const blob = L.circle([ws.ward.lat, ws.ward.lng], {
          radius: heatR, color: 'transparent',
          fillColor: color, fillOpacity: layer === 'progress' ? 0.12 + ratio * 0.15 : 0.07 + ratio * 0.18,
          interactive: false,
        }).addTo(map)

        const size = filtered.total === 0 ? 24 : Math.min(24 + filtered.total * 1.8, 54)
        const icon = L.divIcon({
          className: '',
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${color};color:#fff;font-weight:700;
            font-size:${size > 40 ? 13 : 11}px;font-family:system-ui,sans-serif;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px ${color}55;border:2px solid #fff;cursor:pointer;
          ">${filtered.total || ''}</div>`,
        })

        const marker = L.marker([ws.ward.lat, ws.ward.lng], { icon }).addTo(map)
        marker.on('click', () => {
          setSelected(filtered)
          map.flyTo([ws.ward.lat, ws.ward.lng], 13, { duration: 0.7 })
        })
        markersRef.current.set(ws.ward.id, blob)
        markersRef.current.set(ws.ward.id * 10000, marker)
      })
    })
  }, [wards, layer, timeRange])

  // ── Category trending (simple: count vs 2× prev period) ──────────────────
  const timeDays = TIMES.find(t => t.key === timeRange)?.days ?? 30
  const now      = Date.now()
  const allComplaints = wards.flatMap(w => w.complaints)
  const catStats = Object.keys(CAT).map(cat => {
    const thisP  = allComplaints.filter(c => c.category_en === cat && (now - new Date(c.created_at).getTime()) < timeDays * 86_400_000).length
    const lastP  = allComplaints.filter(c => c.category_en === cat && (now - new Date(c.created_at).getTime()) >= timeDays * 86_400_000 && (now - new Date(c.created_at).getTime()) < 2 * timeDays * 86_400_000).length
    const pct    = lastP === 0 ? (thisP > 0 ? 100 : 0) : Math.round(((thisP - lastP) / lastP) * 100)
    const daily  = Array.from({ length: 10 }, (_, i) => {
      const s = now - (9 - i) * 86_400_000, e = s + 86_400_000
      return allComplaints.filter(c => { const t = new Date(c.created_at).getTime(); return c.category_en === cat && t >= s && t < e }).length
    })
    return { cat, count: thisP, pct, daily }
  }).filter(s => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 6)

  const improving = [...wards].filter(w => w.total > 0 && w.resolved / w.total >= 0.6).sort((a, b) => b.resolved / b.total - a.resolved / a.total).slice(0, 4)
  const attention = [...wards].filter(w => w.critical > 0).sort((a, b) => b.critical - a.critical).slice(0, 4)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Navbar (matches all other pages) ─────────────────────────── */}
      <header className="flex-shrink-0 border-b-2 z-50" style={{ background: GOV_BLUE, borderColor: '#08305A', height: 52 }}>
        <div className="max-w-full px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex">
                <div className="w-1 h-7" style={{ background: CRIMSON }} />
                <div className="w-1 h-7 ml-0.5" style={{ background: '#003893' }} />
                <div className="w-7 h-7 ml-1.5 flex items-center justify-center font-bold text-white text-xs"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  स
                </div>
              </div>
              <span className="font-bold text-white text-sm" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवाइ</span>
            </Link>
            <div className="hidden md:flex items-center gap-1 text-white/40">
              <span>/</span>
              <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Nepal Live Problem Map</span>
            </div>
          </div>

          {/* Center search */}
          <div className="hidden md:flex items-center gap-2">
            <input
              placeholder="Search municipality, district, ward..."
              className="text-xs px-3 py-1.5 border border-white/20 text-white placeholder-white/40 bg-white/10 focus:outline-none focus:border-white/50 w-64"
              style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
              readOnly
            />
          </div>

          <div className="flex items-center gap-3">
            <Link href="/track" className="text-white/60 hover:text-white text-xs transition-colors font-medium"
              style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              मेरो उजुरी
            </Link>
            <Link href="/submit"
              className="text-xs font-bold px-3 py-1.5 transition-all"
              style={{ background: CRIMSON, color: 'white', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              + उजुरी दर्ता
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main area (sidebar + map) ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT INSIGHT PANEL ──────────────────────────────────────── */}
        <aside className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 288, background: '#fff', borderRight: `1px solid ${MID_GRAY}` }}>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">

              {/* Nepal Today */}
              <div className="p-4 border-b" style={{ borderColor: MID_GRAY }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nepal Today</p>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    LIVE
                  </span>
                </div>

                {/* Visual stats — not KPI cards */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-end justify-between mb-1">
                      <span className="text-3xl font-bold tabular-nums" style={{ color: GOV_BLUE }}>{todayC}</span>
                      <span className="text-xs text-gray-400" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>आज नयाँ रिपोर्ट</span>
                    </div>
                    <div className="h-1" style={{ background: MID_GRAY }}>
                      <div className="h-full" style={{ width: `${Math.min(100, (todayC / Math.max(totalC, 1)) * 500)}%`, background: GOV_BLUE }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-0 border" style={{ borderColor: MID_GRAY }}>
                    {[
                      { label: 'Need Action', value: critC,    color: CRIMSON   },
                      { label: 'Resolved',    value: Math.round(totalC * resRate / 100), color: '#16A34A' },
                      { label: 'Rate',        value: `${resRate}%`, color: GOV_BLUE },
                    ].map((s, i) => (
                      <div key={s.label} className="p-3 text-center" style={{ borderRight: i < 2 ? `1px solid ${MID_GRAY}` : 'none' }}>
                        <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trending Problems */}
              <div className="p-4 border-b" style={{ borderColor: MID_GRAY }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Trending Problems</p>
                <div className="space-y-2.5">
                  {catStats.map(s => (
                    <div key={s.cat} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 flex-shrink-0" style={{ background: CAT[s.cat]?.color || '#64748B' }} />
                        <span className="text-xs text-gray-700 truncate" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{CAT[s.cat]?.ne || s.cat}</span>
                      </div>
                      <Spark values={s.daily} color={CAT[s.cat]?.color || '#64748B'} />
                      <div className="text-right flex-shrink-0" style={{ minWidth: 36 }}>
                        <TrendArrow pct={s.pct} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas Improving */}
              {improving.length > 0 && (
                <div className="p-4 border-b" style={{ borderColor: MID_GRAY }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Areas Improving Fastest</p>
                  <div className="space-y-2">
                    {improving.map(ws => {
                      const rate = Math.round(ws.resolved / ws.total * 100)
                      return (
                        <button key={ws.ward.id} onClick={() => {
                          setSelected(ws)
                          if (ws.ward.lat && ws.ward.lng && mapInst.current)
                            mapInst.current.flyTo([ws.ward.lat, ws.ward.lng], 13, { duration: 0.7 })
                        }} className="w-full flex items-center justify-between text-left hover:bg-gray-50 px-2 py-1.5 -mx-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-800" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{ws.ward.name_ne}</p>
                            <p className="text-[9px] text-gray-400">{ws.ward.municipality}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{rate}%</p>
                            <p className="text-[9px] text-green-500">↑ resolved</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Areas Requiring Attention */}
              {attention.length > 0 && (
                <div className="p-4 border-b" style={{ borderColor: MID_GRAY }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Requiring Attention</p>
                  <div className="space-y-2">
                    {attention.map(ws => (
                      <button key={ws.ward.id} onClick={() => {
                        setSelected(ws)
                        if (ws.ward.lat && ws.ward.lng && mapInst.current)
                          mapInst.current.flyTo([ws.ward.lat, ws.ward.lng], 13, { duration: 0.7 })
                      }} className="w-full flex items-center justify-between text-left hover:bg-red-50 px-2 py-1.5 -mx-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-800" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{ws.ward.name_ne}</p>
                          <p className="text-[9px] text-gray-400">{ws.ward.municipality}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: CRIMSON }}>{ws.critical}</p>
                          <p className="text-[9px]" style={{ color: CRIMSON }}>critical</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Government Impact feed */}
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Government Impact</p>
                <div className="space-y-3">
                  {GOV_ACTIONS.map((a, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <div className="w-2 h-2 mt-1.5 flex-shrink-0 rounded-full" style={{ background: '#16A34A' }} />
                      <div>
                        <p className="text-xs text-gray-700">{a.action}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                          {a.ward} · {a.days}d ago
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </aside>

        {/* ── MAP ─────────────────────────────────────────────────────── */}
        <div className="flex-1 relative flex flex-col overflow-hidden">

          {/* Map layers toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b" style={{ background: '#fff', borderColor: MID_GRAY }}>
            <div className="flex items-center gap-1">
              {LAYERS.map(l => (
                <button key={l.key} onClick={() => setLayer(l.key)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: layer === l.key ? GOV_BLUE : 'transparent',
                    color:      layer === l.key ? '#fff' : '#6B7280',
                    borderBottom: layer === l.key ? `2px solid ${GOV_BLUE}` : '2px solid transparent',
                  }}>
                  {l.label}
                </button>
              ))}
              <span className="text-[10px] text-gray-300 ml-2 hidden md:inline">
                {LAYERS.find(l => l.key === layer)?.desc}
              </span>
            </div>
            {/* Legend */}
            <div className="hidden md:flex items-center gap-4 text-[10px] text-gray-500">
              {layer === 'problems' && (
                <>
                  {[['#C8102E','Many unresolved'],['#F97316','Growing'],['#EAB308','Moderate'],['#16A34A','Improving'],['#0B3C6F','Well-performing']].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />{l}
                    </span>
                  ))}
                </>
              )}
              {layer === 'progress' && (
                <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Resolved areas pulse green
                </span>
              )}
              {layer === 'trends' && <span className="text-orange-500 font-semibold">↑ Growth pattern overlay</span>}
              {layer === 'community' && (
                <span style={{ color: GOV_BLUE }} className="font-semibold">Community pulse scores</span>
              )}
            </div>
          </div>

          {/* The map itself */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full" />

            {/* Selected ward popup */}
            {selected && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-gray-200 shadow-lg p-4 w-80">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{selected.ward.municipality}</p>
                    <h3 className="font-bold text-base" style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      {selected.ward.name_ne}
                    </h3>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2 mt-1">×</button>
                </div>

                <div className="grid grid-cols-3 divide-x mb-3" style={{ borderColor: MID_GRAY, border: `1px solid ${MID_GRAY}` }}>
                  {[
                    { label: 'Active', value: selected.active,   color: GOV_BLUE },
                    { label: 'Critical',value: selected.critical, color: CRIMSON   },
                    { label: 'Resolved',value: `${selected.total > 0 ? Math.round(selected.resolved/selected.total*100) : 0}%`, color: '#16A34A' },
                  ].map((s, i) => (
                    <div key={s.label} className="py-3 text-center" style={{ borderRight: i < 2 ? `1px solid ${MID_GRAY}` : 'none' }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Top issue */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Top Issue</span>
                  <div className="w-2 h-2 flex-shrink-0" style={{ background: CAT[selected.topCategory]?.color || '#64748B' }} />
                  <span className="text-xs font-semibold" style={{ color: CAT[selected.topCategory]?.color || '#64748B', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    {CAT[selected.topCategory]?.ne || selected.topCategory}
                  </span>
                </div>

                {/* Community pulse */}
                <div className="px-1 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Community Pulse</span>
                    <span className="text-sm font-bold" style={{ color: selected.total > 0 && selected.resolved/selected.total >= 0.5 ? '#16A34A' : CRIMSON }}>
                      {selected.total > 0 ? Math.round(selected.resolved/selected.total*100) : 0}%
                    </span>
                  </div>
                  <div className="h-1.5" style={{ background: MID_GRAY }}>
                    <div className="h-full transition-all" style={{ width: `${selected.total > 0 ? Math.round(selected.resolved/selected.total*100) : 0}%`, background: selected.total > 0 && selected.resolved/selected.total >= 0.5 ? '#16A34A' : CRIMSON }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href="/submit"
                    className="flex-1 text-center text-xs font-bold py-2 transition-all"
                    style={{ background: GOV_BLUE, color: '#fff', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    + उजुरी दर्ता
                  </Link>
                  <Link href="/track"
                    className="flex-1 text-center text-xs font-bold py-2 border transition-all hover:bg-gray-50"
                    style={{ borderColor: MID_GRAY, color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    ट्र्याक गर्नुहोस्
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Time controls bar (bottom) ─────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t" style={{ background: '#fff', borderColor: MID_GRAY }}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-2">Time Range</span>
              {TIMES.map(t => (
                <button key={t.key} onClick={() => setTimeRange(t.key)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: timeRange === t.key ? GOV_BLUE : 'transparent',
                    color:      timeRange === t.key ? '#fff' : '#9CA3AF',
                    border:     `1px solid ${timeRange === t.key ? GOV_BLUE : MID_GRAY}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span>{totalC.toLocaleString()} total complaints</span>
              <span>·</span>
              <span className="font-bold" style={{ color: GOV_BLUE }}>{resRate}% resolved</span>
              <span>·</span>
              <span>{wards.filter(w => w.total > 0).length} wards</span>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .leaflet-control-zoom { border:none !important; border-radius:0 !important; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1) !important; }
        .leaflet-control-zoom a { background:white !important; color:#0F172A !important; border:none !important; border-bottom:1px solid #F1F5F9 !important; width:34px !important; height:34px !important; line-height:34px !important; font-size:16px !important; }
        .leaflet-control-zoom a:hover { background:#F8FAFC !important; }
        .leaflet-attribution-flag { display:none !important; }
      `}</style>
    </div>
  )
}
