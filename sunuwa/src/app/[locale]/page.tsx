'use client'

import { useState, useEffect, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/components/AuthContext'

// ── Color palette ────────────────────────────────────────────────────
const GOV_BLUE   = '#0B3C6F'
const CRIMSON    = '#C8102E'
const LIGHT_GRAY = '#F5F7FA'
const MID_GRAY   = '#E8ECF0'
const DARK_TEXT  = '#1A1A2E'

// ── Nepal silhouette path (900×180 viewBox) ──────────────────────────
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

// ── Province data (left→right in SVG x-space) ───────────────────────
const PROVINCES = [
  { id: 'p7', nameNe: 'सुदूरपश्चिम', name: 'Sudurpashchim', x: 18,  w: 140, complaints: 892,  resolved: 645,  top: 'खानेपानी' },
  { id: 'p6', nameNe: 'कर्णाली',     name: 'Karnali',        x: 158, w: 170, complaints: 1240, resolved: 980,  top: 'सडक' },
  { id: 'p5', nameNe: 'लुम्बिनी',   name: 'Lumbini',        x: 328, w: 110, complaints: 2180, resolved: 1820, top: 'स्वास्थ्य' },
  { id: 'p4', nameNe: 'गण्डकी',     name: 'Gandaki',        x: 438, w: 100, complaints: 1650, resolved: 1420, top: 'शिक्षा' },
  { id: 'p3', nameNe: 'बाग्मती',    name: 'Bagmati (KTM)',  x: 538, w: 100, complaints: 4820, resolved: 3980, top: 'पूर्वाधार' },
  { id: 'p2', nameNe: 'मधेश',       name: 'Madhesh',        x: 638, w: 112, complaints: 2340, resolved: 1890, top: 'बाढी' },
  { id: 'p1', nameNe: 'कोशी',       name: 'Koshi',          x: 750, w: 75,  complaints: 1980, resolved: 1650, top: 'भूस्खलन' },
]

// Province fill opacity based on complaint density
function getDensityColor(complaints: number): string {
  if (complaints > 4000) return '#C8102E'
  if (complaints > 2000) return '#1168B5'
  if (complaints > 1500) return '#1A5FA0'
  if (complaints > 1000) return '#235694'
  return '#2D4C7A'
}

// ── Nepal Civic Pulse — intelligence card (no map) ───────────────────

const FEED_CATS = [
  { name: 'Road Issue',       nameNe: 'सडक',       color: '#1168B5', icon: '🛣️'  },
  { name: 'Water Supply',     nameNe: 'खानेपानी',  color: '#0891B2', icon: '💧'  },
  { name: 'Electricity',      nameNe: 'बिजुली',    color: '#CA8A04', icon: '⚡'  },
  { name: 'Health Services',  nameNe: 'स्वास्थ्य', color: '#DC2626', icon: '🏥'  },
  { name: 'Education',        nameNe: 'शिक्षा',    color: '#7C3AED', icon: '📚'  },
  { name: 'Waste Management', nameNe: 'फोहोर',     color: '#16A34A', icon: '🗑️'  },
  { name: 'Sanitation',       nameNe: 'सरसफाई',    color: '#0891B2', icon: '🚿'  },
]
const FEED_WARDS = [
  { ward: 'Ward 5',  city: 'Kathmandu'  },
  { ward: 'Ward 12', city: 'Lalitpur'   },
  { ward: 'Ward 3',  city: 'Pokhara'    },
  { ward: 'Ward 7',  city: 'Biratnagar' },
  { ward: 'Ward 2',  city: 'Bharatpur'  },
  { ward: 'Ward 9',  city: 'Dharan'     },
  { ward: 'Ward 4',  city: 'Nepalgunj'  },
  { ward: 'Ward 8',  city: 'Butwal'     },
]
const FEED_TYPES: { label: string; color: string }[] = [
  { label: 'Reported',     color: '#DC2626' },
  { label: 'Under review', color: '#F97316' },
  { label: 'Resolved',     color: '#16A34A' },
]

interface FeedItem { id: number; cat: typeof FEED_CATS[0]; ward: typeof FEED_WARDS[0]; type: typeof FEED_TYPES[0]; minsAgo: number }

let _fid = 0
function makeFeedItem(minsAgo: number): FeedItem {
  return {
    id:      _fid++,
    cat:     FEED_CATS[Math.floor(Math.random() * FEED_CATS.length)],
    ward:    FEED_WARDS[Math.floor(Math.random() * FEED_WARDS.length)],
    type:    FEED_TYPES[Math.floor(Math.random() * FEED_TYPES.length)],
    minsAgo,
  }
}

const AI_INSIGHTS = [
  { icon: '📈', text: 'Road complaints up 23% in Bagmati this week — likely monsoon damage.' },
  { icon: '✅', text: 'Water supply resolutions improved 18% after Ward 5 pipeline repair.' },
  { icon: '⚠️', text: 'Electricity faults clustering in Nepalgunj — grid inspection recommended.' },
  { icon: '🏥', text: 'Health Services complaints steady — no major escalations this month.' },
]

function CivicPulseWidget() {
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    Array.from({ length: 6 }, (_, i) => makeFeedItem((i + 1) * 4))
  )
  const [insightIdx, setInsightIdx] = useState(0)
  const [clock, setClock] = useState('')

  useEffect(() => {
    setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    const t1 = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })), 30000)
    const t2 = setInterval(() => setFeed(f => [makeFeedItem(0), ...f.slice(0, 7)]), 5000)
    const t3 = setInterval(() => setInsightIdx(i => (i + 1) % AI_INSIGHTS.length), 6000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3) }
  }, [])

  const S = {
    card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
    label:   { fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: 2, textTransform: 'uppercase' as const, margin: '0 0 10px' },
  }

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 32px rgba(22,59,109,0.08)', background: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header bar */}
      <div style={{ background: '#163B6D', padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'cpPulse 2.4s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 2.5, textTransform: 'uppercase' }}>Nepal Civic Pulse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{clock}</span>
          <span style={{ fontSize: 9, background: 'rgba(74,222,128,0.18)', color: '#4ADE80', padding: '2px 8px', borderRadius: 20, fontWeight: 700, border: '1px solid rgba(74,222,128,0.25)' }}>LIVE</span>
        </div>
      </div>

      {/* Body: 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14 }}>

        {/* LEFT: Activity feed */}
        <div style={S.card}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #F1F5F9' }}>
            <p style={S.label}>Live Activity</p>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 210 }}>
            {feed.map((item, idx) => (
              <div key={item.id} style={{
                padding: '9px 14px', borderBottom: '1px solid #F8FAFC',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                opacity: idx === 0 ? 1 : 0.85,
                transition: 'opacity 0.4s ease',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{item.cat.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.3 }}>{item.cat.name}</p>
                  <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>{item.ward.ward}, {item.ward.city}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.type.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: item.type.color, fontWeight: 600 }}>
                      {item.minsAgo === 0 ? 'just now' : `${item.minsAgo}m ago`} · {item.type.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: AI insight + Trust metrics + Gov status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* AI Insight */}
          <div style={{ ...S.card, padding: '12px 14px', borderLeft: '3px solid #163B6D' }}>
            <p style={S.label}>AI Insight</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: 44 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{AI_INSIGHTS[insightIdx].icon}</span>
              <p style={{ fontSize: 12, color: '#334155', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                {AI_INSIGHTS[insightIdx].text}
              </p>
            </div>
          </div>

          {/* Trust metrics — 2x2 */}
          <div style={{ ...S.card, padding: '12px 14px' }}>
            <p style={S.label}>Platform Metrics</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid #F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { value: '18,420', sub: 'Total Complaints', color: '#163B6D' },
                { value: '15,830', sub: 'Resolved',          color: '#166534' },
                { value: '86%',    sub: 'Resolution Rate',   color: '#D97706' },
                { value: '3.2d',   sub: 'Avg Response',      color: '#163B6D' },
              ].map((m, i) => (
                <div key={m.sub} style={{
                  padding: '10px 10px',
                  borderRight:  i % 2 === 0 ? '1px solid #F1F5F9' : 'none',
                  borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none',
                  background: '#fff',
                }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: m.color, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>{m.value}</p>
                  <p style={{ fontSize: 9, color: '#94A3B8', margin: '3px 0 0', fontWeight: 600, letterSpacing: 0.5 }}>{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Government activity status */}
          <div style={{ ...S.card, padding: '12px 14px' }}>
            <p style={S.label}>Government Activity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { label: 'Active Wards',           value: '4,753', dot: '#166534' },
                { label: 'Municipalities Online',  value: '284',   dot: '#166534' },
                { label: 'Provinces Online',       value: '7 / 7', dot: '#166534' },
                { label: 'Ministries Monitoring',  value: '12',    dot: '#D97706' },
              ].map(g => (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.dot, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>{g.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{g.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes cpPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

// ── Counter hook ─────────────────────────────────────────────────────
function useCounter(target: number, duration: number, active: boolean): number {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(e * target))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active, target, duration])
  return val
}

// ── Province intelligence map ─────────────────────────────────────────
function ProvinceMap({ filter }: { filter: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const hp = PROVINCES.find(p => p.id === hovered)

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 12 900 130"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        style={{ maxHeight: 260 }}
      >
        <defs>
          <clipPath id="nepal-shape">
            <path d={NEPAL_PATH} />
          </clipPath>
          <filter id="dot-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Province strips clipped to Nepal silhouette */}
        {PROVINCES.map(p => (
          <rect
            key={p.id}
            x={p.x} y={0} width={p.w} height={160}
            fill={getDensityColor(p.complaints)}
            opacity={hovered === p.id ? 1 : 0.82}
            clipPath="url(#nepal-shape)"
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer transition-opacity duration-150"
          />
        ))}

        {/* Province border lines */}
        {PROVINCES.slice(0, -1).map(p => (
          <line
            key={`line-${p.id}`}
            x1={p.x + p.w} y1={12} x2={p.x + p.w} y2={145}
            stroke="white" strokeWidth={1} opacity={0.4}
            clipPath="url(#nepal-shape)"
          />
        ))}

        {/* Nepal outline */}
        <path
          d={NEPAL_PATH}
          fill="none"
          stroke="white"
          strokeWidth={1.5}
          opacity={0.6}
        />

        {/* Kathmandu marker */}
        <circle cx={590} cy={72} r={3} fill="white" opacity={0.9} />
        <text x={595} y={68} fill="white" fontSize={7} opacity={0.8} style={{ fontFamily: 'monospace' }}>KTM</text>

        {/* Province labels */}
        {PROVINCES.map(p => {
          const cx = p.x + p.w / 2
          return (
            <text
              key={`label-${p.id}`}
              x={cx} y={85}
              textAnchor="middle"
              fill="white"
              fontSize={p.w < 100 ? 6 : 7}
              fontWeight="600"
              opacity={hovered === p.id ? 1 : 0.7}
              clipPath="url(#nepal-shape)"
              style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', pointerEvents: 'none' }}
            >
              {p.nameNe}
            </text>
          )
        })}
      </svg>

      {/* Province tooltip */}
      {hp && (
        <div className="absolute top-2 right-2 bg-white border border-gray-300 p-3 min-w-[180px] shadow-lg"
          style={{ borderLeft: `4px solid ${GOV_BLUE}` }}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{hp.name}</p>
          <p className="text-lg font-bold" style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{hp.nameNe}</p>
          <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">कुल उजुरी</span>
              <span className="font-bold text-gray-900">{hp.complaints.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">समाधान</span>
              <span className="font-bold" style={{ color: '#16A34A' }}>{hp.resolved.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">समाधान दर</span>
              <span className="font-bold">{Math.round(hp.resolved / hp.complaints * 100)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">मुख्य समस्या</span>
              <span className="font-bold" style={{ color: CRIMSON, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{hp.top}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mapPulse {
          0%   { opacity: 1; transform: scale(1); }
          60%  { opacity: 0.3; transform: scale(2.5); }
          100% { opacity: 0; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, openAuth, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mapFilter,      setMapFilter]      = useState('all')
  const [statsActive,    setStatsActive]    = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  const totalComplaints = PROVINCES.reduce((s, p) => s + p.complaints, 0)
  const totalResolved   = PROVINCES.reduce((s, p) => s + p.resolved, 0)

  const c1 = useCounter(totalComplaints, 1800, statsActive)
  const c2 = useCounter(totalResolved,   1800, statsActive)
  const c3 = useCounter(77,              1600, statsActive)
  const c4 = useCounter(4,               1400, statsActive)

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect() } },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const NAV_LINKS = [
    { href: '/',               label: 'गृहपृष्ठ' },
    { href: '/map',            label: 'Complaint Map' },
    { href: '/track',          label: 'उजुरी ट्र्याक' },
    { href: '/trending',       label: 'Transparency' },
    { href: '/my-complaints',  label: 'मेरा उजुरी' },
  ]

  const MAP_FILTERS = [
    { key: 'all',     label: 'सबै' },
    { key: 'road',    label: 'सडक' },
    { key: 'water',   label: 'पानी' },
    { key: 'power',   label: 'बिजुली' },
    { key: 'health',  label: 'स्वास्थ्य' },
    { key: 'edu',     label: 'शिक्षा' },
    { key: 'waste',   label: 'फोहोर' },
  ]

  return (
    <main className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* == STICKY HEADER ============================================== */}
      <header className="sticky top-0 z-50 border-b-2" style={{ borderColor: GOV_BLUE, background: GOV_BLUE }}>
        
        {/* Main nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            {/* Nepal flag-inspired mark */}
            <div className="flex flex-shrink-0">
              <div className="w-1 h-9" style={{ background: CRIMSON }} />
              <div className="w-1 h-9 ml-0.5" style={{ background: '#003893' }} />
              <div className="w-9 h-9 ml-1.5 flex items-center justify-center font-bold text-white text-base"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                स
              </div>
            </div>
            <div>
              <div className="font-bold text-white text-base tracking-tight leading-none"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                सुनुवाइ
              </div>
              <div className="text-white/50 text-[10px] tracking-widest uppercase leading-none mt-0.5">
                Civic Intelligence
              </div>
            </div>
          </Link>

          {/* Center nav — desktop */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className="px-4 py-4 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium tracking-tight"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right CTA */}
          <div className="flex items-center gap-2">
            {/* Citizen auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/my-complaints"
                  className="text-sm text-white/80 hover:text-white px-3 py-1.5 transition-colors font-medium flex items-center gap-1.5"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                  मेरा उजुरी
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-white/50 hover:text-white/80 px-2 py-1.5 transition-colors"
                  title={user.phone ?? 'Sign out'}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={openAuth}
                className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white px-3 py-1.5 transition-colors border border-white/20 hover:border-white/40"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', borderRadius: 6 }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                लग इन / दर्ता
              </button>
            )}
            <Link href="/login"
              className="hidden md:block text-sm text-white/50 hover:text-white/70 px-2 py-1.5 transition-colors">
              अधिकारी
            </Link>
            <Link href="/submit"
              className="text-sm font-bold px-4 py-2 transition-all flex items-center gap-1.5"
              style={{ background: CRIMSON, color: 'white' }}>
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>उजुरी दर्ता</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden p-2 text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 pb-2" style={{ background: GOV_BLUE }}>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className="block px-6 py-3 text-sm text-white/80 hover:text-white border-b border-white/5"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* == HERO ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16 grid md:grid-cols-[1fr_1.1fr] gap-10 items-start">

        {/* Left: headline */}
        <div>
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-6 px-3 py-1.5 border"
            style={{ borderColor: GOV_BLUE, color: GOV_BLUE, background: '#EFF4FA' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CRIMSON }} />
            Live · Nepal Civic Intelligence Platform
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5"
            style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            नागरिकको आवाज,<br />
            <span style={{ color: GOV_BLUE }}>सरकारसम्म।</span>
          </h1>

          <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8 max-w-lg"
            style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            तपाईंको गुनासो सही निकायसम्म पुग्छ, ट्र्याक हुन्छ, र समाधान प्रक्रिया पारदर्शी रूपमा देखिन्छ।
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link href="/submit"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 transition-all"
              style={{ background: GOV_BLUE, color: 'white' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>उजुरी दर्ता गर्नुहोस्</span>
            </Link>
            <Link href="/track"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 border-2 transition-all"
              style={{ borderColor: GOV_BLUE, color: GOV_BLUE, background: 'white' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>उजुरी ट्र्याक गर्नुहोस्</span>
            </Link>
          </div>

          {/* How it differs from Hello Sarkar */}
         
        </div>

        {/* Right: Nepal Civic Pulse */}
        <CivicPulseWidget />
      </section>

    
      

      {/* == INTELLIGENCE MAP (CENTERPIECE) ==============================═ */}
      <section className="py-12 md:py-16" style={{ background: LIGHT_GRAY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Section header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-5 border-b-2"
            style={{ borderColor: GOV_BLUE }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>
                National Intelligence Dashboard
              </p>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                नेपाल उजुरी खुफिया नक्शा
              </h2>
              <p className="text-sm text-gray-500 mt-1">प्रत्येक प्रदेशमा नागरिक गुनासोको वास्तविक समय दृश्य</p>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              Last updated: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_280px] gap-6">

            {/* Map + filters */}
            <div className="bg-white border border-gray-200">
              {/* Category filter bar */}
              <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filter:</span>
                {MAP_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setMapFilter(f.key)}
                    className="text-xs px-3 py-1 font-medium transition-all border"
                    style={mapFilter === f.key
                      ? { background: GOV_BLUE, color: 'white', borderColor: GOV_BLUE }
                      : { background: 'white', color: '#374151', borderColor: '#D1D5DB' }}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <ProvinceMap filter={mapFilter} />
              </div>

              {/* Province stats table */}
              <div className="border-t border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: MID_GRAY }}>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">प्रदेश</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">उजुरी</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">समाधान</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider">दर %</th>
                      <th className="text-left px-4 py-2.5 font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">मुख्य</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROVINCES.map((p, i) => {
                      const rate = Math.round(p.resolved / p.complaints * 100)
                      return (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-semibold" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: DARK_TEXT }}>
                            {p.nameNe}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: i === 4 ? CRIMSON : DARK_TEXT }}>
                            {p.complaints.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-green-700">
                            {p.resolved.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 bg-gray-200 hidden md:block">
                                <div className="h-full" style={{ width: `${rate}%`, background: rate >= 80 ? '#16A34A' : rate >= 60 ? '#CA8A04' : CRIMSON }} />
                              </div>
                              <span className="font-mono font-bold" style={{ color: rate >= 80 ? '#16A34A' : rate >= 60 ? '#CA8A04' : CRIMSON }}>
                                {rate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell font-semibold"
                            style={{ color: CRIMSON, fontFamily: 'Noto Sans Devanagari, sans-serif', fontSize: 11 }}>
                            {p.top}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar insights */}
            <div className="space-y-4">
              {/* Mini escalation stats */}
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Escalation Pipeline</p>
                {[
                  { label: 'वडा तह',       count: 8420, pct: 60 },
                  { label: 'नगरपालिका',   count: 2840, pct: 20 },
                  { label: 'प्रदेश',       count: 1680, pct: 12 },
                  { label: 'मन्त्रालय',    count: 1120, pct: 8 },
                ].map(e => (
                  <div key={e.label} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', color: DARK_TEXT }}>{e.label}</span>
                      <span className="font-mono font-bold text-gray-700">{e.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 w-full">
                      <div className="h-full" style={{ width: `${e.pct}%`, background: GOV_BLUE }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* == HOW IT WORKS ================================================═ */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-10 pb-5 border-b border-gray-200">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>Process</p>
            <h2 className="text-2xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              उजुरीको यात्रा
            </h2>
          </div>

          {/* Horizontal timeline */}
          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-gray-200" style={{ zIndex: 0 }} />
            <div className="grid md:grid-cols-5 gap-6 relative" style={{ zIndex: 1 }}>
              {[
                { step: '01', title: 'उजुरी दर्ता', desc: 'नेपाली वा English मा — कुनै लगइन आवश्यक छैन', icon: '✍' },
                { step: '02', title: 'AI वर्गीकरण', desc: 'Gemini AI ले समस्या पहिचान गरी सही निकाय निर्धारण गर्छ', icon: '🤖' },
                { step: '03', title: 'निकायमा पठाइन्छ', desc: 'वडा कार्यालयले ३ दिनभित्र प्रतिक्रिया दिनुपर्छ', icon: '📋' },
                { step: '04', title: 'ट्र्याकिङ', desc: 'Short code मार्फत समस्याको स्थिति हेर्नुहोस्', icon: '📍' },
                { step: '05', title: 'समाधान', desc: 'नसमाधान भए स्वतः माथिल्लो तहमा escalate हुन्छ', icon: '✓' },
              ].map((s, i) => (
                <div key={s.step} className="flex flex-col items-center text-center">
                  {/* Step circle */}
                  <div className="w-16 h-16 flex items-center justify-center mb-4 border-2 font-bold text-2xl bg-white"
                    style={{ borderColor: GOV_BLUE, color: GOV_BLUE }}>
                    {s.icon}
                  </div>
                  <div className="text-[10px] font-bold tracking-widest mb-1" style={{ color: CRIMSON }}>STEP {s.step}</div>
                  <h3 className="font-bold text-sm mb-2" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    {s.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* == TRANSPARENCY DASHBOARD ====================================== */}
      <section className="py-12 md:py-16" style={{ background: LIGHT_GRAY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8 pb-5 border-b-2" style={{ borderColor: GOV_BLUE }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>
              Open Government Data
            </p>
            <h2 className="text-2xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              पारदर्शिता ड्यासबोर्ड
            </h2>
          </div>

          <div className="bg-white border border-gray-200">
            <div className="border-b border-gray-200 px-5 py-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">हालसालैका समाधान भएका उजुरीहरू</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: MID_GRAY }}>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Tracking ID</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">वर्ग</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">वडा</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider hidden lg:table-cell">दर्ता</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">समाधान</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">अवधि</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: 'KTM-5-A3X', cat: 'सडक', ward: 'वडा ५, काठमाडौं', filed: '२०८१-०३-१५', resolved: '२०८१-०३-१९', days: 4 },
                  { code: 'PKR-8-B7Y', cat: 'खानेपानी', ward: 'वडा ८, पोखरा', filed: '२०८१-०३-१०', resolved: '२०८१-०३-१३', days: 3 },
                  { code: 'BRT-2-C9Z', cat: 'बिजुली', ward: 'वडा २, भरतपुर', filed: '२०८१-०३-०८', resolved: '२०८१-०३-१०', days: 2 },
                  { code: 'BKT-12-D4W', cat: 'स्वास्थ्य', ward: 'वडा १२, भक्तपुर', filed: '२०८१-०३-०१', resolved: '२०८१-०३-०३', days: 2 },
                  { code: 'LLT-3-E6V', cat: 'शिक्षा', ward: 'वडा ३, ललितपुर', filed: '२०८१-०२-२५', resolved: '२०८१-०२-२९', days: 4 },
                ].map(row => (
                  <tr key={row.code} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold" style={{ color: GOV_BLUE }}>{row.code}</td>
                    <td className="px-5 py-3 text-xs font-semibold" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{row.cat}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden md:table-cell" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{row.ward}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 hidden lg:table-cell">{row.filed}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 border" style={{ background: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0' }}>
                        ✓ Resolved
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-bold" style={{ color: row.days <= 3 ? '#16A34A' : '#CA8A04' }}>
                      {row.days}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">Showing 5 of 14,300+ resolved complaints</p>
              <Link href="/trending" className="text-xs font-bold" style={{ color: GOV_BLUE }}>
                Full transparency data →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* == DEPARTMENTS ================================================= */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8 pb-5 border-b border-gray-200">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>Coverage</p>
            <h2 className="text-2xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              सेवारत मन्त्रालय र निकायहरू
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
            {[
              { icon: '🏗️', name: 'सडक तथा पूर्वाधार', sub: 'Ministry of Infrastructure', count: 4230 },
              { icon: '💧', name: 'खानेपानी',           sub: 'KUKL / Water Authority',   count: 3180 },
              { icon: '⚡', name: 'बिजुली',              sub: 'Nepal Electricity Auth.',  count: 2640 },
              { icon: '🏥', name: 'स्वास्थ्य',          sub: 'Ministry of Health',       count: 1920 },
              { icon: '📚', name: 'शिक्षा',              sub: 'Ministry of Education',    count: 1580 },
              { icon: '🏛️', name: 'नगरपालिका',          sub: 'Local Government',         count: 890 },
              { icon: '🚛', name: 'फोहोर व्यवस्थापन',   sub: 'Waste Management',         count: 760 },
              { icon: '🚌', name: 'यातायात',             sub: 'Transport Management',     count: 540 },
            ].map(dept => (
              <div key={dept.name} className="bg-white p-5 hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="text-2xl mb-3">{dept.icon}</div>
                <h3 className="font-bold text-sm mb-1 group-hover:underline"
                  style={{ color: GOV_BLUE, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  {dept.name}
                </h3>
                <p className="text-[10px] text-gray-400 mb-2">{dept.sub}</p>
                <p className="text-xs font-mono font-bold" style={{ color: CRIMSON }}>
                  {dept.count.toLocaleString()} complaints
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == SUCCESS STORIES ============================================═ */}
      <section className="py-12 md:py-16" style={{ background: LIGHT_GRAY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8 pb-5 border-b-2" style={{ borderColor: GOV_BLUE }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>Impact</p>
            <h2 className="text-2xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              वास्तविक परिवर्तन
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                before: 'सडकमा ७ महिनादेखि ठूलो खाल्डो',
                after:  '४ दिनमा blacktop मर्मत',
                ward:   'वडा ५, काठमाडौं',
                days:   4,
                cat:    'सडक',
              },
              {
                before: 'स्वास्थ्य चौकीमा ३ हप्तादेखि औषधि छैन',
                after:  '२ दिनमा औषधि आपूर्ति भयो',
                ward:   'वडा ३, पोखरा',
                days:   2,
                cat:    'स्वास्थ्य',
              },
              {
                before: 'ट्रान्सफर्मर खराब — १ हप्ता अँध्यारो',
                after:  'NEA ले ५ दिनमा बदल्यो',
                ward:   'वडा ८, भरतपुर',
                days:   5,
                cat:    'बिजुली',
              },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-100" style={{ background: MID_GRAY }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{s.cat} · {s.ward}</span>
                </div>
                <div className="p-5">
                  <div className="flex gap-4 items-start mb-4">
                    <div className="flex-1 border-l-4 pl-3" style={{ borderColor: CRIMSON }}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Before</p>
                      <p className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{s.before}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 border-l-4 pl-3" style={{ borderColor: '#16A34A' }}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">After</p>
                      <p className="text-sm font-semibold" style={{ color: '#15803D', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{s.after}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Resolution time</span>
                    <span className="text-sm font-bold font-mono" style={{ color: GOV_BLUE }}>{s.days} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == CITIZEN TESTIMONIALS ======================================== */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8 pb-5 border-b border-gray-200">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CRIMSON }}>Citizen Voices</p>
            <h2 className="text-2xl font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              नागरिकका अनुभव
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: 'उजुरी दिएको ३ दिनमा नै सडक बन्यो। यस्तो सेवा पहिले थिएन।', name: 'सुनिता श्रेष्ठ', loc: 'काठमाडौं, वडा ५' },
              { quote: 'Tracking code मार्फत के भैरहेको छ थाहा पाउन पाइयो। धेरै राम्रो।', name: 'रमेश पौडेल', loc: 'पोखरा, वडा ८' },
              { quote: 'अस्पतालको समस्या दर्ता गरेपछि २ दिनमा नै समाधान आयो। सत्य।', name: 'मीना तामाङ', loc: 'भरतपुर, वडा ३' },
            ].map((t, i) => (
              <div key={i} className="border border-gray-200 p-6">
                <blockquote className="text-sm text-gray-700 leading-relaxed mb-4"
                  style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-bold" style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{t.name}</p>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{t.loc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == CTA BANNER ================================================= */}
      <section className="py-12" style={{ background: GOV_BLUE }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3"
            style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            तपाईंको आवाज मायने राख्छ।
          </h2>
          <p className="text-white/60 text-sm mb-7"
            style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            अहिलेसम्म {totalComplaints.toLocaleString()}+ नागरिकले उजुरी दर्ता गरिसके।
          </p>
          <Link href="/submit"
            className="inline-flex items-center gap-2 text-sm font-bold px-8 py-3.5 transition-all"
            style={{ background: CRIMSON, color: 'white' }}>
            <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>उजुरी दर्ता गर्नुहोस्</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* == FOOTER ====================================================== */}
      <footer className="border-t-4" style={{ background: '#0A1628', borderColor: CRIMSON }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-10">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  <div className="w-1 h-8" style={{ background: CRIMSON }} />
                  <div className="w-1 h-8 ml-0.5" style={{ background: '#003893' }} />
                  <div className="w-8 h-8 ml-1.5 flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    स
                  </div>
                </div>
                <span className="font-bold text-white" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवाइ</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                नेपालको पहिलो नागरिक खुफिया प्लेटफर्म। गुनासोलाई intelligence मा बदल्ने।
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Platform</h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                {['उजुरी दर्ता', 'उजुरी ट्र्याक', 'Complaint Map', 'Transparency Data', 'Ward Dashboard'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Government */}
            <div>
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Government</h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                {['Minister Portal', 'Ward Officer Login', 'Department API', 'Open Data', 'Government Partners'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Information</h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                {['About Sunuwa', 'Privacy Policy', 'Terms of Service', 'Accessibility Statement', 'Contact Us'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-5 pt-5 border-t border-white/10">
                <p className="text-[10px] text-white/30 font-mono">Helpline: 1111</p>
                <p className="text-[10px] text-white/30 font-mono">info@sunuwa.gov.np</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-white/30">
              © 2081 B.S. Sunuwa — Nepal Civic Intelligence Platform. Built for the Government of Nepal.
            </p>
            <div className="flex items-center gap-4 text-[10px] text-white/30">
              <span>Open Source</span>
              <span>·</span>
              <span>WCAG 2.1 AA</span>
              <span>·</span>
              <span>Privacy First</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
