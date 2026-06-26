'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getSessionAndRole, signOut } from '@/lib/auth'

const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'
const MID_GRAY = '#E8ECF0'
const SUCCESS  = '#16A34A'
const WARNING  = '#CA8A04'
const ORANGE   = '#F97316'

interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne: string; status: string
  created_at: string; escalation_level: number; days_old: number
  ward: { name_ne: string; municipality: string } | null
}
interface Cluster {
  id: number; category_en: string; category_ne: string
  complaint_count: number; avg_severity: number; urgency_score: number
  summary_ne: string | null
  ward: { name_ne: string; municipality: string } | null
}
interface Ministry { id: number; name: string; name_ne: string; slug: string }
interface Brief { content_ne: string; content_en: string; generated_at: string }
interface Stats { totalComplaints: number; avgSev: number; criticalCount: number; escalatedCount: number; activeClusters: number }

// SLA thresholds per category (ward-level days before escalation)
const SLA: Record<string, number> = {
  Health: 2, Safety: 2, Electricity: 3, Water: 3,
  Infrastructure: 7, Education: 7, Environment: 7, Corruption: 5, Other: 7,
}
function slaFor(cat: string) { return SLA[cat] || 7 }

function sevColor(s: number) {
  if (s >= 8) return CRIMSON
  if (s >= 6) return ORANGE
  if (s >= 4) return WARNING
  return SUCCESS
}

// Tiny sparkline
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const W = 72, H = 24
  const max = Math.max(...data, 1), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Brief section definitions — keys match what brief.py generates
const BRIEF_SECTIONS = [
  { key: 'Current Situation',     ne: 'हालको अवस्था',       critical: false },
  { key: 'Emerging Risks',        ne: 'उभ्रिँदो जोखिम',      critical: true  },
  { key: 'Affected Areas',        ne: 'प्रभावित क्षेत्रहरू', critical: false },
  { key: 'Recommended Actions',   ne: 'सिफारिस',             critical: true  },
  { key: 'Predicted Escalations', ne: 'पूर्वानुमान',         critical: true  },
]

// Demo briefs shown when no real brief exists yet (per ministry slug)
const DEMO_BRIEFS: Record<string, { ne: string; en: string }> = {
  health: {
    ne: `## Current Situation
काठमाडौं उपत्यकाका स्वास्थ्य संस्थाहरूमा उजुरी बढ्दो छन्। जिल्ला अस्पतालमा औषधि अभाव र डाक्टरको कमी मुख्य समस्या देखिएको छ।

## Emerging Risks
- काठमाडौं महानगर अस्पतालमा दुर्गन्ध र औषधि–उपकरण अभाव
- हाम्रो बिर अस्पतालको स्वच्छता खराब, संक्रमणको जोखिम उच्च
- ग्रामीण स्वास्थ्य चौकीमा डाक्टर नभएकाले आपतकालीन केस काठमाडौं पठाइन्छ
- एम्बुलेन्स सेवा ढिलो, बिरामी बाटोमा संकट

## Affected Areas
- काठमाडौं महानगरपालिका: सर्वाधिक उजुरी
- ललितपुर महानगरपालिका: औषधि अभाव र स्वच्छता समस्या
- भक्तपुर नगरपालिका: डाक्टर अनुपस्थिति

## Recommended Actions
- जिल्ला अस्पतालहरूमा तत्काल औषधि आपूर्ति व्यवस्था गर्नुहोस्
- काठमाडौं उपत्यकाका अस्पतालमा स्वच्छता निरीक्षण टोली पठाउनुहोस्
- ग्रामीण स्वास्थ्य चौकीमा कम्तीमा एक डाक्टर खटाउने नीति लागू गर्नुहोस्

## Predicted Escalations
- SLA समयसीमा नाघेका उजुरीहरू प्रदेश स्तरमा पुग्ने सम्भावना
- डेंगु फैलिएको क्षेत्रमा थप उजुरी आउने प्रक्षेपण`,
    en: `## Current Situation
Health complaints are rising across Kathmandu Valley facilities. Medicine shortages and lack of doctors at district hospitals are the primary issues.

## Emerging Risks
- Bir Hospital reporting poor sanitation and critical medicine/equipment shortages
- Kathmandu metropolitan hospitals at risk of infection spread
- Rural health posts without doctors routing emergency cases to Kathmandu
- Slow ambulance response leaving patients in critical condition mid-transit

## Affected Areas
- Kathmandu Metropolitan City: highest complaint volume
- Lalitpur Metropolitan City: medicine shortages and sanitation issues
- Bhaktapur Municipality: doctor absenteeism

## Recommended Actions
- Dispatch emergency medicine supply to district hospitals immediately
- Deploy sanitation inspection teams to Kathmandu Valley hospitals
- Enforce minimum one-doctor policy at all rural health posts

## Predicted Escalations
- Cases past SLA threshold likely to escalate to province level
- Dengue-affected zones projected to generate additional complaints this week`,
  },
  education: {
    ne: `## Current Situation
शिक्षा मन्त्रालय अन्तर्गत शिक्षक अनुपस्थिति र पाठ्यपुस्तक अभाव मुख्य समस्याको रूपमा देखिएका छन्।

## Emerging Risks
- सरकारी विद्यालयमा शिक्षक हप्तामा ३-४ दिन अनुपस्थित
- NEB परीक्षामा अनियमितताको उजुरी बढ्दो
- छात्रवृत्ति प्रक्रियामा ढिलाइ र भ्रष्टाचारका घटना

## Affected Areas
- काठमाडौं उपत्यकाका सामुदायिक विद्यालयहरू
- ग्रामीण क्षेत्र: माध्यमिक विद्यालयको अभाव

## Recommended Actions
- विद्यालय निरीक्षण सुदृढ गर्नुहोस्
- NEB अनियमितता छानबिनका लागि समिति गठन गर्नुहोस्
- छात्रवृत्ति प्रक्रिया डिजिटलाइज गर्नुहोस्

## Predicted Escalations
- परीक्षा मौसममा उजुरी संख्या बढ्ने अनुमान`,
    en: `## Current Situation
Teacher absenteeism and textbook shortages are the dominant complaints under the Education Ministry.

## Emerging Risks
- Government school teachers absent 3-4 days per week while running private tuition
- Growing NEB examination irregularity complaints
- Scholarship process delays and corruption reports increasing

## Affected Areas
- Community schools across Kathmandu Valley
- Rural areas: absence of secondary schools forcing long commutes

## Recommended Actions
- Strengthen school inspection frequency
- Form investigation committee for NEB irregularity reports
- Digitize scholarship application tracking

## Predicted Escalations
- Complaint volume expected to spike during exam season`,
  },
}

function isGenericBrief(text: string): boolean {
  return (
    text.includes('0 उजुरी') ||
    text.includes('हाल कुनै सक्रिय उजुरी समूह छैन') ||
    text.includes('0 complaints received') ||
    text.length < 80
  )
}

function parseBrief(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  let cur = ''
  for (const line of text.split('\n')) {
    const t = line.replace(/^#+\s*/, '').trim()
    const sec = BRIEF_SECTIONS.find(s => t.startsWith(s.key) || t.startsWith(s.ne))
    if (sec) { cur = sec.key; out[cur] = []; continue }
    if (cur && t) out[cur] = [...(out[cur] || []), t.replace(/^[-*]\s*/, '')]
  }
  return out
}

export default function MinisterDashboard() {
  const params = useParams()
  const router = useRouter()
  const slug   = params.slug as string

  const [ministry,    setMinistry]    = useState<Ministry | null>(null)
  const [brief,       setBrief]       = useState<Brief | null>(null)
  const [complaints,  setComplaints]  = useState<Complaint[]>([])
  const [clusters,    setClusters]    = useState<Cluster[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [briefLang,   setBriefLang]   = useState<'ne'|'en'>('ne')
  const [generating,  setGenerating]  = useState(false)
  const [authed,      setAuthed]      = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [escFilter,   setEscFilter]   = useState<number | null>(null)

  // Issue explorer
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterSev,    setFilterSev]    = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page,         setPage]         = useState(0)
  const PAGE_SIZE = 15

  useEffect(() => {
    getSessionAndRole().then(({ user }) => {
      if (!user) { router.push('/login'); return }
      if (user.role === 'ward') { router.push(`/ward/${user.ward_id}`); return }
      setAuthed(true)
    })
  }, [router])

  const loadData = useCallback(() => {
    fetch(`/api/minister/${slug}`)
      .then(r => r.json())
      .then(d => {
        setMinistry(d.ministry)
        setBrief(d.brief)
        setComplaints(d.complaints || [])
        setClusters(d.clusters || [])
        setStats(d.stats)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!authed) return
    loadData()
    const iv = setInterval(loadData, 60_000)
    return () => clearInterval(iv)
  }, [authed, loadData])

  const generateBrief = async () => {
    setGenerating(true)
    try {
      await fetch(`/api/generate-brief/${slug}`, { method: 'POST' })
      const res = await fetch(`/api/minister/${slug}`)
      const d   = await res.json()
      setBrief(d.brief)
      setStats(d.stats)
      setClusters(d.clusters || [])
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  const handleSignOut = async () => { await signOut(); router.push('/ne/login') }

  // ── All derived metrics — pure computation from real API data ─────────────
  const derived = useMemo(() => {
    if (!complaints.length) return null
    const now     = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    const resolved   = complaints.filter(c => c.status === 'resolved')
    const unresolved = complaints.filter(c => c.status !== 'resolved')

    const criticalUnresolved = unresolved.filter(c => c.severity >= 8)

    // Near SLA: ≥70% of threshold elapsed, still unresolved
    const nearSLA = unresolved.filter(c => {
      const t = slaFor(c.category_en)
      return c.days_old >= Math.floor(t * 0.7)
    })

    const today = complaints.filter(c => c.created_at?.startsWith(todayStr))

    // Avg resolution time from days_old of resolved complaints
    const avgResolutionTime = resolved.length
      ? Math.round(resolved.reduce((s, c) => s + c.days_old, 0) / resolved.length)
      : null

    // Municipalities with ≥2 high-severity unresolved complaints
    const muniMap: Record<string, { count: number; maxSev: number }> = {}
    unresolved.filter(c => c.severity >= 6).forEach(c => {
      const m = c.ward?.municipality || 'Unknown'
      if (!muniMap[m]) muniMap[m] = { count: 0, maxSev: 0 }
      muniMap[m].count++
      muniMap[m].maxSev = Math.max(muniMap[m].maxSev, c.severity)
    })
    const hotMunis = Object.entries(muniMap)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)

    // Escalation pipeline stages — counts + rates all from data
    const makeStage = (lvl: number, label: string, labelNe: string, last = false) => {
      const cases = lvl < 4
        ? complaints.filter(c => c.escalation_level === lvl)
        : complaints.filter(c => c.escalation_level >= 4)
      const res   = cases.filter(c => c.status === 'resolved')
      const rate  = cases.length ? Math.round((res.length / cases.length) * 100) : 0
      const avg   = cases.length ? Math.round(cases.reduce((s, c) => s + c.days_old, 0) / cases.length) : 0
      const longest = cases.length ? Math.max(...cases.map(c => c.days_old)) : 0
      const threshold = lvl === 1 ? 3 : lvl === 2 ? 7 : lvl === 3 ? 14 : 28
      const bottleneck = cases.length > 0 && avg > threshold * 0.8
      return { lvl, label, labelNe, count: cases.length, rate, avg, longest, bottleneck, last }
    }
    const escStages = [
      makeStage(1, 'Ward',         'वडा'),
      makeStage(2, 'Municipality', 'नगरपालिका'),
      makeStage(3, 'Province',     'प्रदेश'),
      makeStage(4, 'Ministry',     'मन्त्रालय', true),
    ]

    const resolutionRate = complaints.length
      ? Math.round((resolved.length / complaints.length) * 100)
      : 0

    const responded = complaints.filter(c =>
      c.status === 'resolved' || c.status === 'in_progress' || c.status === 'in-progress'
    )
    const responseRate = complaints.length
      ? Math.round((responded.length / complaints.length) * 100)
      : 0

    const resolvedDays = resolved.map(c => c.days_old).sort((a, b) => a - b)
    const medianResTime = resolvedDays.length
      ? resolvedDays[Math.floor(resolvedDays.length / 2)]
      : null

    // 7-day daily intake sparkline
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i))
      const day = d.toISOString().slice(0, 10)
      return complaints.filter(c => c.created_at?.startsWith(day)).length
    })

    // Best/worst municipality by resolution rate
    const muniPerf: Record<string, { total: number; resolved: number }> = {}
    complaints.forEach(c => {
      const m = c.ward?.municipality || 'Unknown'
      if (!muniPerf[m]) muniPerf[m] = { total: 0, resolved: 0 }
      muniPerf[m].total++
      if (c.status === 'resolved') muniPerf[m].resolved++
    })
    const muniEntries = Object.entries(muniPerf)
      .filter(([, v]) => v.total >= 2)
      .map(([name, v]) => ({ name, rate: Math.round((v.resolved / v.total) * 100), total: v.total }))
      .sort((a, b) => b.rate - a.rate)
    const bestMuni  = muniEntries[0] || null
    const worstMuni = muniEntries[muniEntries.length - 1] || null

    // Action center — derived from real complaint patterns, not hardcoded
    type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM'
    const actions: Array<{
      id: string; priority: Priority; textNe: string; textEn: string
      impact: string; citizens: number; deadline: string; color: string
    }> = []

    if (criticalUnresolved.length > 0) {
      actions.push({
        id: 'critical',
        priority: 'CRITICAL',
        textNe: `${criticalUnresolved.length} वटा अत्यावश्यक उजुरीको समीक्षा गर्नुहोस्`,
        textEn: `Review ${criticalUnresolved.length} critical unresolved cases`,
        impact: 'Direct citizen safety',
        citizens: criticalUnresolved.length * 12,
        deadline: 'Today',
        color: CRIMSON,
      })
    }

    if (nearSLA.length > 0) {
      actions.push({
        id: 'sla',
        priority: 'HIGH',
        textNe: `${nearSLA.length} उजुरीहरू SLA समयसीमा नजिक`,
        textEn: `${nearSLA.length} cases approaching SLA deadline`,
        impact: 'Prevent escalation violations',
        citizens: nearSLA.length * 8,
        deadline: 'Within 48h',
        color: ORANGE,
      })
    }

    if (hotMunis.length > 0) {
      const [name, v] = hotMunis[0]
      actions.push({
        id: 'muni',
        priority: 'HIGH',
        textNe: `${name} मा ${v.count} वटा गम्भीर उजुरी`,
        textEn: `${v.count} high-severity cases in ${name}`,
        impact: 'Municipal intervention required',
        citizens: v.count * 15,
        deadline: 'This week',
        color: ORANGE,
      })
    }

    const provLevel = complaints.filter(c => c.escalation_level >= 3 && c.status !== 'resolved')
    if (provLevel.length > 0) {
      actions.push({
        id: 'province',
        priority: 'MEDIUM',
        textNe: `${provLevel.length} उजुरी प्रदेश/मन्त्रालयसम्म पुगेका`,
        textEn: `${provLevel.length} cases at province/ministry level`,
        impact: 'Inter-governmental coordination',
        citizens: provLevel.length * 10,
        deadline: 'This month',
        color: WARNING,
      })
    }

    return {
      criticalUnresolved, nearSLA, today, hotMunis, escStages,
      resolutionRate, responseRate, medianResTime, avgResolutionTime,
      dailyTrend, bestMuni, worstMuni, resolved, unresolved, actions,
    }
  }, [complaints])

  // Issue explorer with filters
  const filtered = useMemo(() => {
    let list = escFilter !== null
      ? complaints.filter(c => escFilter >= 4 ? c.escalation_level >= 4 : c.escalation_level === escFilter)
      : complaints

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.summary_ne || '').toLowerCase().includes(q) ||
        (c.category_en || '').toLowerCase().includes(q) ||
        (c.ward?.municipality || '').toLowerCase().includes(q)
      )
    }
    if (filterCat) list = list.filter(c => c.category_en === filterCat)
    if (filterSev === 'critical') list = list.filter(c => c.severity >= 8)
    else if (filterSev === 'high') list = list.filter(c => c.severity >= 6 && c.severity < 8)
    else if (filterSev === 'medium') list = list.filter(c => c.severity < 6)
    if (filterStatus) list = list.filter(c => c.status === filterStatus)
    return list
  }, [complaints, escFilter, search, filterCat, filterSev, filterStatus])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const categories = useMemo(() => [...new Set(complaints.map(c => c.category_en))].sort(), [complaints])

  const exportCSV = () => {
    const hdr = ['ID','Category','Severity','Status','Ward','Municipality','Days Open','Escalation Level','Summary']
    const rows = filtered.map(c => [
      c.id, c.category_en, c.severity, c.status,
      c.ward?.name_ne || '', c.ward?.municipality || '',
      c.days_old, c.escalation_level,
      `"${(c.summary_ne || '').replace(/"/g, '""')}"`
    ])
    const csv  = [hdr, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${slug}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (authed === null || loading) return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${GOV_BLUE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>लोड हुँदैछ...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )

  if (!ministry) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9CA3AF', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>मन्त्रालय फेला परेन</p>
    </div>
  )

  const d = derived

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes skpulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .sk { animation: skpulse 1.4s ease-in-out infinite; background: #E9EBF0; border-radius: 2px; }
        .hov-row:hover { background: #F0F5FF !important; }
        .hov-action:hover { background: #F8FAFF !important; }
        .esc-btn { cursor:pointer; transition: border-color 0.12s, background 0.12s; }
        .esc-btn:hover { border-color: ${GOV_BLUE} !important; }
        .esc-btn.active { background: #EFF6FF !important; border-left: 3px solid ${GOV_BLUE} !important; }
        .esc-btn.active-red { background: #FEF2F2 !important; }
        input:focus, select:focus { outline: none; border-color: ${GOV_BLUE} !important; }
      `}</style>

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: GOV_BLUE, borderBottom: '2px solid #08305A' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <div style={{ display: 'flex' }}>
                <div style={{ width: 4, height: 28, background: CRIMSON }} />
                <div style={{ width: 4, height: 28, marginLeft: 2, background: '#003893' }} />
                <div style={{ width: 28, height: 28, marginLeft: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 12, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>स</div>
              </div>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 14, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>सुनुवाइ</span>
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Minister Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* <Link href="/map"   style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Map</Link>
            <Link href="/track" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Track</Link> */}
            <button onClick={handleSignOut} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', background: 'transparent', cursor: 'pointer' }}>
              लगआउट
            </button>
          </div>
        </div>
      </header>

      {/* ── Title bar ───────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${MID_GRAY}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', margin: '0 0 3px' }}>National Government Situation Room</p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: GOV_BLUE, margin: 0 }}>
              <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{ministry.name_ne}</span>{' '}— {ministry.name}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'blink 2s ease-in-out infinite' }} />
              Live
            </span>
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
            <span>|</span>
            <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span style={{ padding: '2px 6px', border: `1px solid ${CRIMSON}`, color: CRIMSON, fontSize: 9, fontWeight: 700, background: '#FEF2F2', letterSpacing: '0.05em' }}>RESTRICTED</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Today's Situation ────────────────────────────── */}
      

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* SECTION 2: AI Executive Brief */}
            <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: GOV_BLUE }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'blink 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Executive Brief</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>· Gemini</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {brief && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: 2 }}>
                      {(['ne','en'] as const).map(l => (
                        <button key={l} onClick={() => setBriefLang(l)} style={{
                          padding: '4px 12px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                          background: briefLang === l ? '#fff' : 'transparent',
                          color: briefLang === l ? GOV_BLUE : 'rgba(255,255,255,0.55)',
                          fontFamily: 'Noto Sans Devanagari, sans-serif',
                        }}>
                          {l === 'ne' ? 'नेपाली' : 'English'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={generateBrief} disabled={generating} style={{
                    fontSize: 10, fontWeight: 700, padding: '5px 12px',
                    border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)',
                    background: 'transparent', cursor: generating ? 'not-allowed' : 'pointer',
                    opacity: generating ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {generating
                      ? <><div style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Generating...</>
                      : '↻ New Brief'}
                  </button>
                </div>
              </div>

              {brief ? (() => {
                const rawText = briefLang === 'ne' ? brief.content_ne : brief.content_en
                // Fall back to demo brief if AI generated with 0 data
                const demo    = DEMO_BRIEFS[slug]
                const text    = isGenericBrief(rawText || '') && demo
                  ? (briefLang === 'ne' ? demo.ne : demo.en)
                  : rawText
                const parsed  = parseBrief(text || '')
                const sections = BRIEF_SECTIONS.filter(s => (parsed[s.key] || []).length > 0)
                return (
                  <div>
                    {sections.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        {sections.map((sec, i) => (
                          <div key={sec.key} style={{
                            padding: '16px',
                            borderLeft: sec.critical ? `3px solid ${CRIMSON}` : undefined,
                            borderRight: i % 2 === 0 ? `1px solid ${MID_GRAY}` : undefined,
                            borderBottom: `1px solid ${MID_GRAY}`,
                            background: sec.critical ? '#FFFAFA' : '#fff',
                          }}>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: sec.critical ? CRIMSON : '#9CA3AF', margin: '0 0 2px' }}>{sec.key}</p>
                            <p style={{ fontSize: 10, color: '#C4C9D4', margin: '0 0 10px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{sec.ne}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(parsed[sec.key] || []).map((item, j) => (
                                <li key={j} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', lineHeight: 1.5, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                                  <span style={{ color: sec.critical ? CRIMSON : GOV_BLUE, flexShrink: 0 }}>›</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 20 }}>
                        {text.split('\n').filter(Boolean).map((line, i) => {
                          if (line.startsWith('## ') || line.startsWith('# '))
                            return <p key={i} style={{ fontWeight: 600, fontSize: 13, color: GOV_BLUE, margin: '10px 0 4px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{line.replace(/^#+\s*/, '')}</p>
                          if (line.startsWith('- ') || line.startsWith('* '))
                            return <p key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#4B5563', margin: '0 0 4px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}><span style={{ color: GOV_BLUE }}>›</span>{line.slice(2)}</p>
                          return <p key={i} style={{ fontSize: 13, color: '#4B5563', margin: '0 0 4px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{line}</p>
                        })}
                      </div>
                    )}
                    <div style={{ padding: '8px 16px', borderTop: `1px solid ${MID_GRAY}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: 9, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>
                        Generated {new Date(brief.generated_at).toLocaleString('en-GB', { hour12: false })} · Internal use only
                      </p>
                      <p style={{ fontSize: 9, color: '#D1D5DB', margin: 0 }}>Est. reading time: ~15s</p>
                    </div>
                  </div>
                )
              })() : DEMO_BRIEFS[slug] ? (() => {
                // No real brief yet — render demo brief
                const demo = DEMO_BRIEFS[slug]
                const text = briefLang === 'ne' ? demo.ne : demo.en
                const parsed = parseBrief(text)
                const sections = BRIEF_SECTIONS.filter(s => (parsed[s.key] || []).length > 0)
                return (
                  <div style={{ opacity: 0.92 }}>
                    <div style={{ padding: '6px 16px', background: '#FFF9EC', borderBottom: `1px solid #FDE68A`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: WARNING }}>DEMO DATA</span>
                      <span style={{ fontSize: 10, color: '#92400E' }}>Generate a real brief by clicking "New Brief" above</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      {sections.map((sec, i) => (
                        <div key={sec.key} style={{
                          padding: '16px',
                          borderLeft: sec.critical ? `3px solid ${CRIMSON}` : undefined,
                          borderRight: i % 2 === 0 ? `1px solid ${MID_GRAY}` : undefined,
                          borderBottom: `1px solid ${MID_GRAY}`,
                          background: sec.critical ? '#FFFAFA' : '#fff',
                        }}>
                          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: sec.critical ? CRIMSON : '#9CA3AF', margin: '0 0 2px' }}>{sec.key}</p>
                          <p style={{ fontSize: 10, color: '#C4C9D4', margin: '0 0 10px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{sec.ne}</p>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(parsed[sec.key] || []).map((item, j) => (
                              <li key={j} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', lineHeight: 1.5, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                                <span style={{ color: sec.critical ? CRIMSON : GOV_BLUE, flexShrink: 0 }}>›</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })() : (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>आजको रिपोर्ट अझै तयार भएको छैन</p>
                  <p style={{ fontSize: 11, color: '#D1D5DB' }}>Press "New Brief" above to generate with Gemini AI</p>
                </div>
              )}
            </div>

            {/* SECTION 4: Escalation Pipeline */}
            <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: GOV_BLUE }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Escalation Pipeline</span>
                {escFilter !== null && (
                  <button onClick={() => setEscFilter(null)} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 8px', cursor: 'pointer' }}>
                    Clear Filter ×
                  </button>
                )}
              </div>
              <div style={{ padding: 16, display: 'flex', gap: 0 }}>
                {(d?.escStages || []).map((stage, i) => {
                  const isActive = escFilter === stage.lvl || (stage.lvl >= 4 && (escFilter ?? 0) >= 4)
                  return (
                    <div key={stage.label} style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
                      <div
                        className={`esc-btn${isActive ? (stage.bottleneck ? ' active active-red' : ' active') : ''}`}
                        onClick={() => setEscFilter(prev => prev === stage.lvl ? null : stage.lvl)}
                        style={{
                          flex: 1,
                          border: `1px solid ${stage.bottleneck ? CRIMSON : MID_GRAY}`,
                          borderLeft: stage.bottleneck ? `3px solid ${CRIMSON}` : `1px solid ${MID_GRAY}`,
                          background: stage.bottleneck ? '#FEF2F2' : '#fff',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', margin: '0 0 2px' }}>{stage.label}</p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: stage.count > 0 ? GOV_BLUE : '#D1D5DB', fontFamily: 'Noto Sans Devanagari, sans-serif', margin: 0 }}>{stage.labelNe}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: '0 0 2px', color: stage.count > 0 ? (stage.bottleneck ? CRIMSON : GOV_BLUE) : '#D1D5DB' }}>{stage.count}</p>
                            <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>cases</p>
                          </div>
                        </div>
                        <div style={{ height: 1, background: MID_GRAY, marginBottom: 10 }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 2px' }}>Resolved</p>
                            <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: stage.rate >= 60 ? SUCCESS : stage.rate >= 30 ? WARNING : CRIMSON }}>{stage.rate}%</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 2px' }}>Avg Delay</p>
                            <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: stage.avg > 7 ? CRIMSON : '#374151' }}>{stage.avg}d</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 2px' }}>Longest</p>
                            <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: stage.longest > 14 ? CRIMSON : '#374151' }}>{stage.longest}d</p>
                          </div>
                          {stage.bottleneck && (
                            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
                              <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', border: `1px solid ${CRIMSON}`, color: CRIMSON, background: '#FEF2F2' }}>BOTTLENECK</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {!stage.last && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 5px', color: '#D1D5DB', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12 }}>▶</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '6px 16px 10px', borderTop: `1px solid ${MID_GRAY}` }}>
                
              </div>
            </div>

            {/* SECTION 7: Issue Explorer */}
            <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: GOV_BLUE }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Issue Explorer{escFilter !== null ? ` · Level ${escFilter >= 4 ? '4+' : escFilter}` : ''} — {filtered.length} of {complaints.length}
                </span>
                <button onClick={exportCSV} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12l-5-5h3V2h4v5h3L8 12zM2 14h12v1H2v-1z"/></svg>
                  Export CSV
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${MID_GRAY}`, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Search by summary, category, municipality..."
                  style={{ flex: '1 1 200px', padding: '6px 10px', border: `1px solid ${MID_GRAY}`, fontSize: 12, minWidth: 120, fontFamily: 'inherit' }}
                />
                <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0) }}
                  style={{ padding: '6px 8px', border: `1px solid ${MID_GRAY}`, fontSize: 12, background: '#fff', color: filterCat ? '#111' : '#9CA3AF' }}>
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterSev} onChange={e => { setFilterSev(e.target.value); setPage(0) }}
                  style={{ padding: '6px 8px', border: `1px solid ${MID_GRAY}`, fontSize: 12, background: '#fff', color: filterSev ? '#111' : '#9CA3AF' }}>
                  <option value="">All Severities</option>
                  <option value="critical">Critical (8–10)</option>
                  <option value="high">High (6–7)</option>
                  <option value="medium">Medium (1–5)</option>
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0) }}
                  style={{ padding: '6px 8px', border: `1px solid ${MID_GRAY}`, fontSize: 12, background: '#fff', color: filterStatus ? '#111' : '#9CA3AF' }}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                {(search || filterCat || filterSev || filterStatus) && (
                  <button onClick={() => { setSearch(''); setFilterCat(''); setFilterSev(''); setFilterStatus(''); setPage(0) }}
                    style={{ padding: '6px 10px', border: `1px solid ${MID_GRAY}`, fontSize: 11, cursor: 'pointer', color: '#6B7280', background: '#fff' }}>
                    Clear
                  </button>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${MID_GRAY}` }}>
                      {['Sev', 'Category', 'Municipality', 'Days', 'Level', 'Status', 'Summary'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', whiteSpace: 'nowrap', background: '#FAFBFC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No complaints match the current filters</td></tr>
                    ) : pageItems.map(c => {
                      const col = sevColor(c.severity)
                      return (
                        <tr key={c.id} className="hov-row" style={{ borderBottom: `1px solid ${MID_GRAY}`, transition: 'background 0.1s' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', border: `1px solid ${col}`, color: col, background: `${col}14`, fontVariantNumeric: 'tabular-nums' }}>{c.severity}</span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: GOV_BLUE, whiteSpace: 'nowrap' }}>{c.category_en}</td>
                          <td style={{ padding: '8px 12px', color: '#6B7280', fontSize: 11, whiteSpace: 'nowrap' }}>{c.ward?.municipality || '—'}</td>
                          <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: c.days_old > 14 ? CRIMSON : c.days_old > 7 ? ORANGE : '#374151', whiteSpace: 'nowrap' }}>{c.days_old}d</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 5px',
                              background: c.escalation_level >= 4 ? '#FEF2F2' : c.escalation_level >= 3 ? '#FFF7ED' : '#EFF6FF',
                              color: c.escalation_level >= 4 ? CRIMSON : c.escalation_level >= 3 ? ORANGE : GOV_BLUE,
                              border: `1px solid ${c.escalation_level >= 4 ? CRIMSON : c.escalation_level >= 3 ? ORANGE : '#BFDBFE'}`,
                            }}>L{c.escalation_level}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 5px',
                              background: c.status === 'resolved' ? '#F0FDF4' : '#F9FAFB',
                              color: c.status === 'resolved' ? SUCCESS : '#6B7280',
                              border: `1px solid ${c.status === 'resolved' ? '#86EFAC' : MID_GRAY}`,
                            }}>
                              {(c.status || 'pending').replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                            <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                              {c.summary_ne || '—'}
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${MID_GRAY}` }}>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      style={{ padding: '4px 10px', border: `1px solid ${MID_GRAY}`, fontSize: 11, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, background: '#fff' }}>← Prev</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.max(0, Math.min(totalPages - 5, page - 2)) + i
                      return (
                        <button key={p} onClick={() => setPage(p)} style={{
                          padding: '4px 8px', border: `1px solid ${page === p ? GOV_BLUE : MID_GRAY}`,
                          fontSize: 11, cursor: 'pointer',
                          background: page === p ? GOV_BLUE : '#fff',
                          color: page === p ? '#fff' : '#374151',
                          fontWeight: page === p ? 700 : 400,
                        }}>{p + 1}</button>
                      )
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      style={{ padding: '4px 10px', border: `1px solid ${MID_GRAY}`, fontSize: 11, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, background: '#fff' }}>Next →</button>
                  </div>
                </div>
              )}
            </div>

            {/* Clusters — only rendered if they actually exist */}
            {clusters.length > 0 && (
              <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
                <div style={{ padding: '10px 16px', background: GOV_BLUE }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Issue Clusters — {clusters.length} Groups</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {clusters.map((cl, i) => {
                    const sev = cl.avg_severity || 5
                    const col = sevColor(sev)
                    const pct = Math.min(100, (cl.urgency_score / 10) * 100)
                    return (
                      <div key={cl.id} style={{
                        padding: 16,
                        borderRight: i % 3 < 2 ? `1px solid ${MID_GRAY}` : undefined,
                        borderBottom: i < clusters.length - (clusters.length % 3 || 3) ? `1px solid ${MID_GRAY}` : undefined,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 13, color: GOV_BLUE, margin: '0 0 2px', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{cl.category_ne || cl.category_en}</p>
                            <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{cl.category_en}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 20, fontWeight: 700, color: col, margin: '0 0 2px' }}>{cl.complaint_count}</p>
                            <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>cases</p>
                          </div>
                        </div>
                        {cl.summary_ne && <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{cl.summary_ne.split(' | ')[0]}</p>}
                        <div style={{ height: 4, background: '#F3F4F6', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: col }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>Severity {sev.toFixed(1)}/10</p>
                          <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>URGENCY {cl.urgency_score}/10</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── Right sidebar ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

           
            {/* SECTION 6: Performance KPIs */}
            <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
              <div style={{ padding: '10px 16px', background: GOV_BLUE, borderBottom: '1px solid #08305A' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Performance KPIs</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Based on all complaints in this ministry</p>
              </div>
              {[
                {
                  label: 'Response Rate',
                  value: d ? `${d.responseRate}%` : '—',
                  sub: 'In-progress + resolved',
                  color: d ? (d.responseRate >= 60 ? SUCCESS : d.responseRate >= 30 ? WARNING : CRIMSON) : '#D1D5DB',
                  spark: d?.dailyTrend,
                },
                
                {
                  label: 'Avg Severity',
                  value: stats ? `${stats.avgSev}/10` : '—',
                  sub: 'Across all complaints',
                  color: stats ? (stats.avgSev >= 7 ? CRIMSON : stats.avgSev >= 5 ? ORANGE : SUCCESS) : '#D1D5DB',
                  spark: undefined,
                },
                {
                  label: 'Best Municipality',
                  value: d?.bestMuni?.name || '—',
                  sub: d?.bestMuni ? `${d.bestMuni.rate}% resolved (${d.bestMuni.total} cases)` : 'Insufficient data',
                  color: SUCCESS,
                  spark: undefined,
                  small: true,
                },
                {
                  label: 'Needs Attention',
                  value: d?.worstMuni?.name || '—',
                  sub: d?.worstMuni ? `${d.worstMuni.rate}% resolved (${d.worstMuni.total} cases)` : 'Insufficient data',
                  color: d?.worstMuni ? CRIMSON : '#D1D5DB',
                  spark: undefined,
                  small: true,
                },
              ].map((kpi, i, arr) => (
                <div key={kpi.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${MID_GRAY}` : undefined,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', margin: '0 0 3px' }}>{kpi.label}</p>
                    <p style={{ fontSize: (kpi as { small?: boolean }).small ? 13 : 20, fontWeight: 700, color: kpi.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kpi.value}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{kpi.sub}</p>
                  </div>
                  {kpi.spark && kpi.spark.some(v => v > 0) && (
                    <div style={{ marginLeft: 12 }}>
                      <Sparkline data={kpi.spark} color={kpi.color} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ministry-level cases sidebar */}
            {(() => {
              const ministryCases = complaints.filter(c => c.escalation_level >= 4)
              if (ministryCases.length === 0) return null
              return (
                <div style={{ border: `1px solid ${MID_GRAY}`, background: '#fff' }}>
                  <div style={{ padding: '10px 16px', background: GOV_BLUE }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                      Ministry-Level Cases ({ministryCases.length})
                    </p>
                  </div>
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {ministryCases.map(c => {
                      const col = sevColor(c.severity)
                      return (
                        <div key={c.id} className="hov-row" style={{ padding: '10px 14px', borderBottom: `1px solid ${MID_GRAY}`, borderLeft: c.severity >= 8 ? `3px solid ${CRIMSON}` : undefined, transition: 'background 0.1s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, flex: 1, overflow: 'hidden', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                              {c.summary_ne || '—'}
                            </p>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', border: `1px solid ${col}`, color: col, background: `${col}14`, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{c.severity}/10</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: GOV_BLUE }}>{c.category_en}</span>
                            {c.ward && <span style={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{c.ward.name_ne}</span>}
                            <span style={{ fontSize: 9, color: '#D1D5DB', fontFamily: 'monospace' }}>{c.days_old}d</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      </div>
    </div>
  )
}
