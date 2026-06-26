'use client'

import { useState, useEffect, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/components/AuthContext'
import SunuwaLogo from '@/components/SunuwaLogo'
import LangToggle from '@/components/LangToggle'
import { useLocale } from 'next-intl'

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

// ── Hero Impact Visual ────────────────────────────────────────────────

const CATEGORIES = [
  { nameNe: 'सडक तथा पूर्वाधार', pct: 31, color: '#1168B5', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { nameNe: 'खानेपानी',           pct: 22, color: '#0891B2', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { nameNe: 'स्वास्थ्य',          pct: 18, color: '#C8102E', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { nameNe: 'बिजुली',             pct: 15, color: '#D97706', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { nameNe: 'शिक्षा',             pct: 14, color: '#7C3AED', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
]

const RESOLVED_FEED = [
  { id: 'KTM-5-A3X', cat: 'सडक',       ward: 'वडा ५, काठमाडौं', days: 4 },
  { id: 'PKR-3-B7Y', cat: 'खानेपानी',  ward: 'वडा ३, पोखरा',    days: 3 },
  { id: 'BRT-8-C2Z', cat: 'बिजुली',    ward: 'वडा ८, भरतपुर',   days: 2 },
  { id: 'LLT-2-D9W', cat: 'स्वास्थ्य', ward: 'वडा २, ललितपुर',   days: 1 },
]

const JOURNEY_STEPS = [
  { ne: 'दर्ता',    en: 'Filed',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: '#0B3C6F' },
  { ne: 'समीक्षा',  en: 'Reviewed',   icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', color: '#1168B5' },
  { ne: 'प्रक्रिया', en: 'In Progress', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: '#D97706' },
  { ne: 'समाधान',  en: 'Resolved',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#16A34A' },
]

interface StatsData {
  total: number
  resolved: number
  resolutionRate: number | null
  avgDays: number | null
  categories: { name: string; count: number; pct: number }[]
}

// Map English category names to Nepali + color
const CAT_META: Record<string, { ne: string; color: string }> = {
  Infrastructure: { ne: 'सडक तथा पूर्वाधार', color: '#1168B5' },
  Water:          { ne: 'खानेपानी',           color: '#0891B2' },
  Health:         { ne: 'स्वास्थ्य',          color: '#C8102E' },
  Electricity:    { ne: 'बिजुली',             color: '#D97706' },
  Education:      { ne: 'शिक्षा',             color: '#7C3AED' },
  Environment:    { ne: 'वातावरण',            color: '#16A34A' },
  Safety:         { ne: 'सुरक्षा',             color: '#DC2626' },
  Corruption:     { ne: 'भ्रष्टाचार',          color: '#9333EA' },
  Other:          { ne: 'अन्य',               color: '#64748B' },
}

function HeroImpactCard() {
  const [activeStep, setActiveStep] = useState(0)
  const [feedIdx, setFeedIdx] = useState(0)
  const [barWidths, setBarWidths] = useState<number[]>(CATEGORIES.map(() => 0))
  const [stats, setStats] = useState<StatsData | null>(null)
  const [liveCats, setLiveCats] = useState(CATEGORIES)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then((data: StatsData | null) => {
        if (!data) return
        setStats(data)
        // Replace CATEGORIES with real data if available
        if (data.categories?.length) {
          const mapped = data.categories.map(c => {
            const meta = CAT_META[c.name] ?? { ne: c.name, color: '#64748B' }
            // Reuse icon path from original CATEGORIES if matched, else default
            const orig = CATEGORIES.find(x => x.nameNe === meta.ne)
            return {
              nameNe: meta.ne,
              pct:    c.pct,
              color:  meta.color,
              icon:   orig?.icon ?? CATEGORIES[0].icon,
            }
          })
          setLiveCats(mapped)
          setBarWidths(mapped.map(() => 0))
          setTimeout(() => setBarWidths(mapped.map(c => c.pct)), 120)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    // Animate journey step forward
    const t1 = setInterval(() => setActiveStep(s => (s + 1) % JOURNEY_STEPS.length), 2200)
    // Cycle resolved feed
    const t2 = setInterval(() => setFeedIdx(i => (i + 1) % RESOLVED_FEED.length), 3500)
    // Animate bars after mount
    const t3 = setTimeout(() => setBarWidths(liveCats.map(c => c.pct)), 120)
    return () => { clearInterval(t1); clearInterval(t2); clearTimeout(t3) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const DEV = 'Noto Sans Devanagari, sans-serif'

  return (
    <div style={{
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 8px 48px rgba(11,60,111,0.13)',
      background: '#fff',
      border: '1px solid #E2E8F0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Top gradient header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0B3C6F 0%, #1A5FA0 60%, #1168B5 100%)',
        padding: '20px 22px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', right: 30, top: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, position: 'relative' }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 2.5, textTransform: 'uppercase', margin: 0 }}>Platform Impact</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '3px 0 0', fontFamily: DEV, letterSpacing: -0.3 }}>सुनुवा — वास्तविक परिवर्तन</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 20, padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'hicPulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#4ADE80', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>Live</span>
          </div>
        </div>

        {/* Big metric trio */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center', position: 'relative' }}>
          {[
            {
              value: stats ? stats.total.toLocaleString() : '—',
              label: 'उजुरी दर्ता', sub: 'Total Filed',
            },
            null,
            {
              value: stats?.resolutionRate != null ? `${stats.resolutionRate}%` : '—',
              label: 'समाधान दर', sub: 'Resolved Rate',
            },
            null,
            {
              value: stats?.avgDays != null ? `${stats.avgDays}d` : '—',
              label: 'औसत समय', sub: 'Avg Response',
            },
          ].map((m, i) =>
            m === null
              ? <div key={i} style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
              : (
                <div key={i} style={{ textAlign: 'center', padding: '0 6px' }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{m.value}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0', fontFamily: DEV }}>{m.label}</p>
                  <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', margin: '1px 0 0', letterSpacing: 0.5 }}>{m.sub}</p>
                </div>
              )
          )}
        </div>
      </div>

      {/* ── Complaint Journey ── */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9' }}>
        <p style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: 2, textTransform: 'uppercase' as const, margin: '0 0 14px' }}>Complaint Journey</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, position: 'relative' }}>
          {/* connecting line */}
          <div style={{ position: 'absolute', top: 18, left: '12.5%', right: '12.5%', height: 2, background: '#E2E8F0', zIndex: 0 }} />
          <div style={{
            position: 'absolute', top: 18, left: '12.5%', height: 2, background: 'linear-gradient(90deg, #0B3C6F, #16A34A)',
            width: `${(activeStep / (JOURNEY_STEPS.length - 1)) * 75}%`,
            transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
            zIndex: 1,
          }} />
          {JOURNEY_STEPS.map((step, i) => {
            const done    = i < activeStep
            const current = i === activeStep
            return (
              <div key={step.ne} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: done ? step.color : current ? step.color : '#F1F5F9',
                  border: `2px solid ${done || current ? step.color : '#E2E8F0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: current ? `0 0 0 4px ${step.color}22` : 'none',
                  transition: 'all 0.4s ease',
                }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                    stroke={done || current ? '#fff' : '#CBD5E1'} strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: done || current ? '#0F172A' : '#94A3B8', margin: 0, fontFamily: DEV, transition: 'color 0.3s' }}>{step.ne}</p>
                  <p style={{ fontSize: 9, color: '#CBD5E1', margin: '1px 0 0', letterSpacing: 0.3 }}>{step.en}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Category breakdown ── */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #F1F5F9' }}>
        <p style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: 2, textTransform: 'uppercase' as const, margin: '0 0 10px' }}>Top Categories</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {liveCats.map((cat, i) => (
            <div key={cat.nameNe} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 11, color: '#374151', margin: 0, minWidth: 120, fontFamily: DEV }}>{cat.nameNe}</p>
              <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 10,
                  background: cat.color,
                  width: `${barWidths[i]}%`,
                  transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                  transitionDelay: `${i * 80}ms`,
                }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, color: cat.color, margin: 0, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cat.pct}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recently resolved ticker ── */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#16A34A', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>Resolved</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p style={{
            fontSize: 11, color: '#374151', margin: 0, fontFamily: DEV,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            animation: 'tickerFade 0.4s ease',
            key: feedIdx,
          } as React.CSSProperties}>
            <span style={{ fontWeight: 700, color: '#0B3C6F', fontFamily: 'monospace', fontSize: 10 }}>{RESOLVED_FEED[feedIdx].id}</span>
            {' · '}{RESOLVED_FEED[feedIdx].cat}{' · '}{RESOLVED_FEED[feedIdx].ward}
          </p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 20, border: '1px solid #BBF7D0', flexShrink: 0 }}>
          {RESOLVED_FEED[feedIdx].days}d
        </span>
      </div>

      <style>{`
        @keyframes hicPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes tickerFade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
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
const T = {
  ne: {
    home: 'गृहपृष्ठ', track: 'उजुरी ट्र्याक', transparency: 'पारदर्शिता',
    login: 'लग इन / दर्ता', officer: 'अधिकारी', submit: 'उजुरी दर्ता',
    myComplaints: 'मेरा उजुरी',
    hero1: 'जनताको भनाइ,', hero2: 'सरकारको सुनाइ।',
    heroSub: 'तपाईंको गुनासो सही निकायसम्म पुग्छ, ट्र्याक हुन्छ, र समाधान प्रक्रिया पारदर्शी रूपमा देखिन्छ।',
    submitCta: 'उजुरी दर्ता गर्नुहोस्', trackCta: 'उजुरी ट्र्याक गर्नुहोस्',
  },
  en: {
    home: 'Home', track: 'Track Complaint', transparency: 'Transparency',
    login: 'Log In / Register', officer: 'Officer', submit: 'File Complaint',
    myComplaints: 'My Complaints',
    hero1: 'Citizens\' Voice,', hero2: 'Reaching Government.',
    heroSub: 'Your complaint reaches the right authority, gets tracked, and the resolution process is visible transparently.',
    submitCta: 'File a Complaint', trackCta: 'Track Your Complaint',
  },
}

export default function HomePage() {
  const { citizen: user, openAuth, signOut } = useAuth()
  const locale = useLocale() as 'ne' | 'en'
  const t = T[locale]
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
    { href: '/',         label: t.home },
    { href: '/track',    label: t.track },
    { href: '/trending', label: t.transparency },
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
            <SunuwaLogo size={96} />
            <div>
              <div className="font-bold text-white text-base tracking-tight leading-none"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                सुनुवा
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
                  title={user.phone_number ?? 'Sign out'}
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
                {t.login}
              </button>
            )}
            <LangToggle />
            <Link href="/login"
              className="hidden md:block text-sm text-white/50 hover:text-white/70 px-2 py-1.5 transition-colors">
              {t.officer}
            </Link>
            <Link href="/submit"
              className="text-sm font-bold px-4 py-2 transition-all flex items-center gap-1.5"
              style={{ background: CRIMSON, color: 'white' }}>
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{t.submit}</span>
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
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-6 px-3 py-1.5 "
           >
            
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5"
            style={{ color: DARK_TEXT, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            जनताको भनाइ,<br />
            <span style={{ color: GOV_BLUE }}>सरकारको सुनाइ।</span>
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

        {/* Right: Impact visual */}
        <HeroImpactCard />
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
                <span className="font-bold text-white" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवा</span>
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
