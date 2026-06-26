'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const FullWardMap = dynamic(() => import('@/components/FullWardMap'), { ssr: false })

interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; text?: string
  status: string; created_at: string; escalation_level: number
  lat?: number; lng?: number
  followup_data?: Record<string, string>
}
interface Ward {
  id: number; name: string; name_ne: string
  municipality: string; district: string; lat: number; lng: number
}

const CAT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  Education:      { color: '#2563EB', bg: '#EFF6FF', icon: '📚' },
  Infrastructure: { color: '#D97706', bg: '#FFFBEB', icon: '🏗️' },
  Health:         { color: '#059669', bg: '#ECFDF5', icon: '🏥' },
  Water:          { color: '#0891B2', bg: '#ECFEFF', icon: '💧' },
  Electricity:    { color: '#CA8A04', bg: '#FEFCE8', icon: '⚡' },
  Corruption:     { color: '#DC2626', bg: '#FEF2F2', icon: '⚖️' },
  Safety:         { color: '#7C3AED', bg: '#F5F3FF', icon: '🔒' },
  Environment:    { color: '#65A30D', bg: '#F7FEE7', icon: '🌿' },
  Other:          { color: '#64748B', bg: '#F8FAFC', icon: '📋' },
}
const CAT_NE: Record<string, string> = {
  Education: 'शिक्षा', Infrastructure: 'पूर्वाधार', Health: 'स्वास्थ्य',
  Water: 'खानेपानी', Electricity: 'बिजुली', Corruption: 'भ्रष्टाचार',
  Safety: 'सुरक्षा', Environment: 'वातावरण', Other: 'अन्य',
}

export default function WardMapPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#16A34A] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>नक्शा लोड हुँदैछ...</p>
        </div>
      </div>
    }>
      <WardMapPageInner />
    </Suspense>
  )
}

function WardMapPageInner() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const wardId       = params.id as string
  const highlightId  = searchParams.get('id')

  const [ward,       setWard]       = useState<Ward | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [selected,   setSelected]   = useState<Complaint | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [catFilter,  setCatFilter]  = useState<string>('all')

  useEffect(() => {
    fetch(`/api/wards/${wardId}`)
      .then(r => r.json())
      .then(d => {
        setWard(d.ward)
        const list: Complaint[] = d.complaints || []
        setComplaints(list)
        if (highlightId) {
          const match = list.find(c => c.id.startsWith(highlightId.toLowerCase()))
          if (match) setSelected(match)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [wardId, highlightId])

  const filtered = catFilter === 'all' ? complaints : complaints.filter(c => c.category_en === catFilter)
  const cats = [...new Set(complaints.map(c => c.category_en))].filter(Boolean)

  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#16A34A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>लोड हुँदैछ...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col overflow-hidden" style={{ fontFamily: "'Inter','Noto Sans Devanagari',sans-serif" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white z-50 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-all text-sm">
            ←
          </button>
          <div>
            <p className="text-slate-900 font-semibold text-sm" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
              {ward?.name_ne} — उजुरी नक्शा
            </p>
            <p className="text-slate-400 text-xs">{ward?.municipality} · {filtered.length} उजुरी</p>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 justify-end">
          <button onClick={() => setCatFilter('all')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              catFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`} style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
            सबै ({complaints.length})
          </button>
          {cats.map(cat => {
            const cs = CAT_STYLE[cat] || CAT_STYLE.Other
            return (
              <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1"
                style={{
                  background: catFilter === cat ? cs.color : cs.bg,
                  color: catFilter === cat ? 'white' : cs.color,
                }}>
                <span>{cs.icon}</span>
                <span style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>{CAT_NE[cat] || cat}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Map + Side panel */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Full map */}
        <div className="flex-1 relative">
          {ward && (
            <FullWardMap
              ward={ward}
              complaints={filtered}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
          )}
        </div>

        {/* Side panel — complaint detail */}
        <div
          className="absolute right-0 top-0 bottom-0 z-40 bg-white border-l border-slate-200 shadow-xl transition-transform duration-300"
          style={{ width: '320px', transform: selected ? 'translateX(0)' : 'translateX(100%)' }}>
          {selected && (
            <ComplaintDetail
              complaint={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ComplaintDetail({ complaint, onClose }: {
  complaint: Complaint
  onClose: () => void
}) {
  const sev      = complaint.severity || 5
  const sevColor = sev >= 8 ? '#DC2626' : sev >= 5 ? '#D97706' : '#2563EB'
  const sevBg    = sev >= 8 ? '#FEF2F2' : sev >= 5 ? '#FFFBEB' : '#EFF6FF'
  const daysOld  = Math.floor((Date.now() - new Date(complaint.created_at).getTime()) / 86400000)

  const cs         = CAT_STYLE[complaint.category_en] || CAT_STYLE.Other
  const escLabels  = ['', 'वडा', 'नगरपालिका', 'प्रदेश', 'मन्त्रालय']
  const escColors  = ['', '#64748B', '#2563EB', '#D97706', '#DC2626']
  const escLevel   = Math.min(complaint.escalation_level || 1, 4)
  const followup   = complaint.followup_data || {}
  const hasFollowup = Object.keys(followup).length > 0

  const gmapsUrl      = complaint.lat && complaint.lng ? `https://www.google.com/maps?q=${complaint.lat},${complaint.lng}&z=18` : null
  const streetViewUrl = complaint.lat && complaint.lng ? `https://www.google.com/maps/@${complaint.lat},${complaint.lng},3a,75y,90t/` : null

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Inter','Noto Sans Devanagari',sans-serif" }}>

      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: cs.bg }}>
            {cs.icon}
          </div>
          <div>
            <p className="text-slate-900 font-semibold text-sm" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
              {CAT_NE[complaint.category_en] || complaint.category_ne}
            </p>
            <p className="text-slate-400 text-xs" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
              {daysOld} दिन अघि · <span style={{ color: escColors[escLevel] }}>{escLabels[escLevel]}</span>
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none mt-1">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Severity */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>गम्भीरता</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: sevColor, background: sevBg }}>{sev}/10</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${sev * 10}%`, background: sevColor }} />
          </div>
        </div>

        {/* AI Summary */}
        {complaint.summary_ne && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-[#16A34A] mb-1.5">🤖 AI सारांश</p>
            <p className="text-sm text-slate-700 leading-relaxed" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
              {complaint.summary_ne}
            </p>
          </div>
        )}

        {/* Followup details */}
        {hasFollowup && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <p className="text-xs text-slate-400 uppercase tracking-wider">विवरण</p>
            {Object.entries(followup).filter(([, v]) => v).map(([key, val]) => (
              <div key={key}>
                <p className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-sm text-slate-700 font-medium" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>{val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Original text */}
        {complaint.text && (
          <div>
            <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">मूल उजुरी</p>
            <p className="text-sm text-slate-600 leading-relaxed" style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
              {complaint.text.slice(0, 300)}{complaint.text.length > 300 ? '...' : ''}
            </p>
          </div>
        )}

        {/* Escalation chain */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">उजुरीको स्तर</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['वडा', 'नगर', 'प्रदेश', 'मन्त्रालय'].map((l, i) => (
              <div key={l} className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium`}
                  style={{
                    background: i + 1 <= escLevel ? `${escColors[escLevel]}15` : '#F8FAFC',
                    color: i + 1 <= escLevel ? escColors[escLevel] : '#CBD5E1',
                    fontFamily: 'Noto Sans Devanagari,sans-serif',
                  }}>{l}</span>
                {i < 3 && <span className="text-slate-300 text-xs">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Location links */}
        {(gmapsUrl || streetViewUrl) && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">स्थान</p>
            {gmapsUrl && (
              <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition-all">
                🗺️ <span>Google Maps मा हेर्नुहोस्</span>
                <span className="ml-auto text-slate-300 text-xs">↗</span>
              </a>
            )}
            {streetViewUrl && (
              <a href={streetViewUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition-all">
                📸 <span>Street View हेर्नुहोस्</span>
                <span className="ml-auto text-slate-300 text-xs">↗</span>
              </a>
            )}
          </div>
        )}

        {/* Status */}
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium ${
          complaint.status === 'resolved' ? 'bg-green-50 border-green-200 text-green-700' :
          complaint.status === 'pending'  ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`} style={{ fontFamily: 'Noto Sans Devanagari,sans-serif' }}>
          <span>{complaint.status === 'resolved' ? '✓ समाधान भयो' : complaint.status === 'pending' ? '⏳ प्रक्रियामा' : '● सक्रिय'}</span>
          <span className="text-slate-400 font-normal">{new Date(complaint.created_at).toLocaleDateString('ne-NP')}</span>
        </div>
      </div>
    </div>
  )
}
