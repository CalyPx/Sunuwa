'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────
interface FeedItem {
  id: string
  category_en: string
  summary_ne: string
  ward_label: string
  time_ago: string
}

// ── Category config ────────────────────────────────────────────────────────
const CAT_ICON: Record<string, string> = {
  Education: '📚', Infrastructure: '🏗️', Health: '🏥', Water: '💧',
  Electricity: '⚡', Corruption: '⚖️', Safety: '🔒', Environment: '🌿', Other: '📋',
}
const CAT_COLOR: Record<string, string> = {
  Education: '#2563EB', Infrastructure: '#D97706', Health: '#059669', Water: '#0891B2',
  Electricity: '#CA8A04', Corruption: '#DC2626', Safety: '#7C3AED', Environment: '#65A30D', Other: '#64748B',
}

// ── Seeded fallback data ───────────────────────────────────────────────────
const FALLBACK: FeedItem[] = [
  { id: '1', category_en: 'Infrastructure', summary_ne: 'सडकमा ठूलो खाल्डो परेको छ मर्मत गर्नुपर्छ',        ward_label: 'वडा १',  time_ago: '२ घण्टा अघि' },
  { id: '2', category_en: 'Water',          summary_ne: 'तीन दिनदेखि धारामा पानी आएको छैन',               ward_label: 'वडा ३',  time_ago: '५ घण्टा अघि' },
  { id: '3', category_en: 'Health',         summary_ne: 'स्वास्थ्य चौकीमा औषधि सकिएको छ उपचार हुँदैन',    ward_label: 'वडा ७',  time_ago: '८ घण्टा अघि' },
  { id: '4', category_en: 'Electricity',    summary_ne: 'ट्रान्सफर्मर खराब भएको एक हप्ता भयो',            ward_label: 'वडा १२', time_ago: '१ दिन अघि' },
  { id: '5', category_en: 'Education',      summary_ne: 'विद्यालयमा शिक्षक नआउने भएको तीन हप्ता भयो',     ward_label: 'वडा ५',  time_ago: '२ दिन अघि' },
  { id: '6', category_en: 'Safety',         summary_ne: 'राति बत्ती नहुँदा मुख्य सडक असुरक्षित बन्यो',    ward_label: 'वडा ९',  time_ago: '२ दिन अघि' },
  { id: '7', category_en: 'Environment',    summary_ne: 'नजिकको खोलामा फोहोर फालिँदै छ प्रदूषण बढ्दो',    ward_label: 'वडा २',  time_ago: '३ दिन अघि' },
  { id: '8', category_en: 'Corruption',     summary_ne: 'कार्यालयमा काम गराउन घूस माग्ने गरेको भनिन्छ',   ward_label: 'वडा १५', time_ago: '४ दिन अघि' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'भर्खर'
  if (h < 24) return `${h} घण्टा अघि`
  const d = Math.floor(h / 24)
  return `${d} दिन अघि`
}

function truncate(text: string, wordLimit = 8): string {
  const words = text.trim().split(/\s+/)
  return words.length > wordLimit ? words.slice(0, wordLimit).join(' ') + '…' : text
}

// ── Stat counter hook ──────────────────────────────────────────────────────
function useCounter(target: number, duration: number, active: boolean): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, target, duration])

  return value
}

// ── Nepal outline SVG path (simplified geographic silhouette) ──────────────
// Viewbox 0 0 900 180 — Nepal's distinctive 5:1 horizontal elongation
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

// ── Live feed component ────────────────────────────────────────────────────
function LiveFeed({ items }: { items: FeedItem[] }) {
  // Double the list so the CSS loop is seamless
  const doubled = [...items, ...items]

  return (
    <div className="relative h-[400px] overflow-hidden rounded-2xl select-none">
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-14 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, #F5F0E8 20%, transparent)' }} />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-14 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #F5F0E8 20%, transparent)' }} />

      {/* Scrolling track */}
      <div className="sunuwa-feed-track will-change-transform">
        {doubled.map((item, idx) => {
          const color = CAT_COLOR[item.category_en] ?? CAT_COLOR.Other
          const icon  = CAT_ICON[item.category_en]  ?? '📋'
          return (
            <div
              key={`${item.id}-${idx}`}
              className="mb-2 bg-white/90 backdrop-blur-[2px] rounded-xl px-3.5 py-3 shadow-sm border border-white/80"
            >
              <div className="flex items-start gap-3">
                {/* Category icon */}
                <span className="text-base flex-shrink-0 mt-px" aria-hidden="true">{icon}</span>

                <div className="min-w-0 flex-1">
                  {/* Blurred description — privacy */}
                  <p
                    className="text-[13px] text-slate-700 leading-snug mb-2"
                    style={{
                      fontFamily: 'Noto Sans Devanagari, sans-serif',
                      filter: 'blur(2.5px)',
                      userSelect: 'none',
                    }}
                    aria-hidden="true"
                  >
                    {truncate(item.summary_ne)}
                  </p>

                  {/* Ward badge + time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}
                    >
                      {item.ward_label}
                    </span>
                    <span
                      className="text-[10px] text-slate-400 flex-shrink-0"
                      style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
                    >
                      {item.time_ago}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Individual stat with count-up ──────────────────────────────────────────
function StatCell({
  rawValue, suffix, label, color, active,
}: {
  rawValue: number; suffix: string; label: string; color: string; active: boolean
}) {
  const count = useCounter(rawValue, 1800, active)
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold tabular-nums tracking-tight" style={{ color }}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className="text-xs text-slate-400 mt-0.5" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
        {label}
      </span>
    </div>
  )
}

// ── Main exported component ────────────────────────────────────────────────
export default function HeroSection() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(FALLBACK)
  const [statsActive, setStatsActive]  = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  // Fetch real complaints (fall back silently on RLS/error)
  useEffect(() => {
    supabase
      .from('complaints')
      .select('id, category_en, summary_ne, ward_id, created_at')
      .not('summary_ne', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data && data.length >= 4) {
          setFeedItems(
            data.map(c => ({
              id:          c.id,
              category_en: c.category_en ?? 'Other',
              summary_ne:  c.summary_ne  ?? 'उजुरी दर्ता भयो।',
              ward_label:  `वडा ${c.ward_id ?? '—'}`,
              time_ago:    timeAgo(c.created_at),
            }))
          )
        }
      })
      .catch(() => {/* stay on FALLBACK */})
  }, [])

  // Trigger stat count-up when row enters viewport
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsActive(true); obs.disconnect() } },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const STATS = [
    { rawValue: 14300, suffix: '+', label: 'दर्ता उजुरी',   color: '#1B4332' },
    { rawValue: 56,    suffix: '',   label: 'नगरपालिका',      color: '#2563EB' },
    { rawValue: 82,    suffix: '%',  label: 'समाधान दर',      color: '#D97706' },
    { rawValue: 3,     suffix: 'd',  label: 'Avg Resolution', color: '#7C3AED' },
  ]

  return (
    <>
      {/* ── Keyframe + feed track styles ── */}
      <style>{`
        @keyframes sunuwa-feed {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        .sunuwa-feed-track {
          animation: sunuwa-feed 32s linear infinite;
          padding-top: 6px;
        }
        .sunuwa-feed-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .sunuwa-feed-track {
            animation: none;
          }
        }
      `}</style>

      {/* ── Hero ── */}
      <section className="relative max-w-5xl mx-auto px-6 pt-20 pb-10 overflow-hidden">

        {/* Nepal map silhouette — 4% opacity background */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 900 180"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-4xl"
            style={{ opacity: 0.04 }}
          >
            <path fill="#1B4332" d={NEPAL_PATH} />
          </svg>
        </div>

        {/* Two-column layout */}
        <div className="relative grid md:grid-cols-[1fr_380px] gap-14 items-start">

          {/* ── Left: headline + CTAs ── */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#1B4332]/8 border border-[#1B4332]/20 text-[#1B4332] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-[#1B4332] rounded-full animate-pulse inline-block" />
              Nepal&apos;s First Civic Intelligence Platform
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-5 leading-tight tracking-tight">
              नागरिकको आवाज,<br />
              <span className="text-[#1B4332]">सरकारसम्म।</span>
            </h1>

            <p
              className="text-lg text-slate-500 mb-8 max-w-lg leading-relaxed"
              style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
            >
              AI ले तपाईंको उजुरी सही निकायमा पुर्‍याउँछ — र समाधान नभए माथि जान्छ।
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/submit"
                className="w-full sm:w-auto bg-[#1B4332] text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-[#143728] transition-all shadow-md hover:shadow-lg active:scale-95 text-sm"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
              >
                उजुरी दर्ता गर्नुहोस् →
              </Link>
              <Link
                href="/track"
                className="w-full sm:w-auto bg-white text-slate-700 font-semibold px-7 py-3.5 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 text-sm"
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
              >
                उजुरी ट्र्याक गर्नुहोस्
              </Link>
            </div>
          </div>

          {/* ── Right: live feed — desktop only ── */}
          <div className="hidden md:block">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Live — अहिले आएका उजुरीहरू
              </span>
            </div>

            <LiveFeed items={feedItems} />
          </div>
        </div>
      </section>

      {/* ── Stats row with count-up ── */}
      <div
        ref={statsRef}
        className="max-w-5xl mx-auto px-6 pb-16 flex flex-wrap items-center justify-center gap-8 md:gap-12 text-center"
      >
        {STATS.map(s => (
          <StatCell key={s.label} {...s} active={statsActive} />
        ))}
      </div>
    </>
  )
}
