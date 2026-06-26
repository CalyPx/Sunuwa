'use client'

import { useState, useEffect, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/AuthContext'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })

const FOLLOWUP: Record<string, { id: string; label: string; label_ne: string; type: 'text' | 'select' | 'textarea'; options?: string[] }[]> = {
  Infrastructure: [
    { id: 'location',   label: 'Exact location / road name',          label_ne: 'सडकको नाम वा ठाउँ',       type: 'text' },
    { id: 'issue_type', label: 'Type of problem',                      label_ne: 'समस्याको किसिम',           type: 'select', options: ['खाल्डो/खाडल', 'भत्केको सडक', 'पुल समस्या', 'नाली समस्या', 'अन्य'] },
    { id: 'duration',   label: 'How long has this been a problem?',    label_ne: 'कति समयदेखि?',            type: 'select', options: ['१ हप्ताभन्दा कम', '१–४ हप्ता', '१–३ महिना', '३ महिनाभन्दा बढी'] },
    { id: 'impact',     label: 'How many people are affected?',        label_ne: 'कति मान्छे प्रभावित?',    type: 'select', options: ['केही घर', 'एक टोल', 'पूरै वडा', 'धेरै वडाहरू'] },
  ],
  Health: [
    { id: 'facility',   label: 'Hospital / health post name',          label_ne: 'अस्पताल वा स्वास्थ्य चौकीको नाम', type: 'text' },
    { id: 'issue_type', label: 'Type of issue',                        label_ne: 'समस्याको किसिम',           type: 'select', options: ['सरसफाई', 'कर्मचारी अनुपस्थित', 'औषधि अनुपलब्ध', 'उपकरण खराब', 'अन्य'] },
    { id: 'frequency',  label: 'Is this a recurring issue?',           label_ne: 'के यो बारम्बार हुने समस्या हो?', type: 'select', options: ['पहिलो पटक', 'कहिलेकाहीँ', 'प्रायः', 'सधैँ'] },
  ],
  Education: [
    { id: 'school',     label: 'School name',                          label_ne: 'विद्यालयको नाम',           type: 'text' },
    { id: 'issue_type', label: 'Type of issue',                        label_ne: 'समस्याको किसिम',           type: 'select', options: ['शिक्षक अनुपस्थित', 'पाठ्यपुस्तक छैन', 'भवन जीर्ण', 'शौचालय समस्या', 'परीक्षा अनियमितता', 'अन्य'] },
    { id: 'students',   label: 'Approx. number of students affected',  label_ne: 'कति विद्यार्थी प्रभावित?', type: 'select', options: ['५० भन्दा कम', '५०–२००', '२००–५००', '५०० भन्दा बढी'] },
  ],
  Water: [
    { id: 'area',       label: 'Affected area / tole',                 label_ne: 'प्रभावित टोल वा ठाउँ',    type: 'text' },
    { id: 'issue_type', label: 'Type of issue',                        label_ne: 'समस्याको किसिम',           type: 'select', options: ['पानी नआउने', 'दूषित पानी', 'पाइप फुटेको', 'धारा बन्द', 'अन्य'] },
    { id: 'duration',   label: 'Since when?',                          label_ne: 'कहिलेदेखि?',              type: 'select', options: ['१ दिन', '१ हप्ता', '१ महिना', '१ महिनाभन्दा बढी'] },
    { id: 'households', label: 'Number of affected households',         label_ne: 'कति घर प्रभावित?',        type: 'select', options: ['१–५', '५–२०', '२०–१००', '१०० भन्दा बढी'] },
  ],
  Electricity: [
    { id: 'area',       label: 'Affected area',                        label_ne: 'प्रभावित ठाउँ',           type: 'text' },
    { id: 'issue_type', label: 'Type of issue',                        label_ne: 'समस्याको किसिम',           type: 'select', options: ['लोडसेडिङ', 'ट्रान्सफर्मर खराब', 'तार टुटेको', 'मिटर समस्या', 'अन्य'] },
    { id: 'duration',   label: 'Duration of outage',                   label_ne: 'कति समयदेखि?',            type: 'select', options: ['केही घण्टा', '१–३ दिन', '१ हप्ता', '१ हप्ताभन्दा बढी'] },
  ],
  Corruption: [
    { id: 'office',     label: 'Government office / department',        label_ne: 'सरकारी कार्यालय',         type: 'text' },
    { id: 'issue_type', label: 'Type of incident',                     label_ne: 'घटनाको किसिम',            type: 'select', options: ['घूस माग', 'कागजात रोकिएको', 'सेवा दिन मना', 'अनियमितता', 'अन्य'] },
    { id: 'evidence',   label: 'Do you have any evidence?',            label_ne: 'कुनै प्रमाण छ?',          type: 'select', options: ['छ', 'छैन', 'अस्पष्ट'] },
    { id: 'details',    label: 'Describe what happened (briefly)',      label_ne: 'संक्षिप्त विवरण',         type: 'textarea' },
  ],
  Safety: [
    { id: 'location',   label: 'Exact location',                       label_ne: 'ठाउँको नाम',              type: 'text' },
    { id: 'issue_type', label: 'Type of incident',                     label_ne: 'घटनाको किसिम',            type: 'select', options: ['चोरी/डकैती', 'दुर्घटना', 'यौन उत्पीडन', 'मारपिट', 'अन्य'] },
    { id: 'timing',     label: 'When does this usually happen?',       label_ne: 'कहिले हुन्छ?',            type: 'select', options: ['दिन', 'राति', 'जुनसुकै समय', 'विशेष दिनमा'] },
  ],
  Environment: [
    { id: 'location',   label: 'Affected location',                    label_ne: 'ठाउँको नाम',              type: 'text' },
    { id: 'issue_type', label: 'Type of problem',                      label_ne: 'समस्याको किसिम',           type: 'select', options: ['फोहोर थुपारिएको', 'वायु प्रदूषण', 'नदी प्रदूषण', 'रूख काटिएको', 'अन्य'] },
    { id: 'impact',     label: 'Impact level',                         label_ne: 'असरको स्तर',              type: 'select', options: ['थोरै', 'मध्यम', 'गम्भीर', 'अत्यन्त गम्भीर'] },
  ],
  Other: [
    { id: 'details',    label: 'More details about the issue',         label_ne: 'थप विवरण',               type: 'textarea' },
    { id: 'urgency',    label: 'How urgent is this?',                  label_ne: 'कति जरुरी छ?',           type: 'select', options: ['सामान्य', 'महत्त्वपूर्ण', 'अत्यन्त जरुरी'] },
  ],
}

const CAT_NE: Record<string, string> = {
  Education: 'शिक्षा', Infrastructure: 'पूर्वाधार', Health: 'स्वास्थ्य',
  Water: 'खानेपानी', Electricity: 'बिजुली', Corruption: 'भ्रष्टाचार',
  Safety: 'सुरक्षा', Environment: 'वातावरण', Other: 'अन्य',
}

const CAT_STYLE: Record<string, { color: string; bg: string; border: string; ab: string }> = {
  Education:      { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', ab: 'SH' },
  Infrastructure: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', ab: 'SR' },
  Health:         { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', ab: 'SW' },
  Water:          { color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', ab: 'KP' },
  Electricity:    { color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A', ab: 'BJ' },
  Corruption:     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', ab: 'BH' },
  Safety:         { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', ab: 'SU' },
  Environment:    { color: '#65A30D', bg: '#F7FEE7', border: '#D9F99D', ab: 'VA' },
  Other:          { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', ab: 'AN' },
}

const QUICK_CHIPS = [
  { key: 'Infrastructure', label: 'सडक',       color: '#D97706' },
  { key: 'Electricity',    label: 'बिजुली',    color: '#CA8A04' },
  { key: 'Water',          label: 'खानेपानी',  color: '#0891B2' },
  { key: 'Health',         label: 'स्वास्थ्य', color: '#059669' },
  { key: 'Education',      label: 'शिक्षा',    color: '#2563EB' },
  { key: 'Environment',    label: 'सरसफाइ',    color: '#65A30D' },
]

const PLACEHOLDER_EXAMPLES = [
  'सडकमा ठूलो खाल्डो छ, ६ महिनादेखि कसैले मर्मत गरेको छैन।',
  'धारामा पानी आएको छैन। पूरै टोल प्रभावित छ।',
  'सडक बत्ती बिग्रिएको छ। राति अँध्यारो हुन्छ।',
  'फोहोर लामो समयदेखि उठाइएको छैन।',
  'अस्पतालमा डाक्टर हुँदैनन्। औषधि पनि छैन।',
]

const SEVERITY_LABEL: Record<number, { label: string; color: string; bg: string }> = {
  1:  { label: 'न्यून',       color: '#059669', bg: '#ECFDF5' },
  2:  { label: 'न्यून',       color: '#059669', bg: '#ECFDF5' },
  3:  { label: 'सामान्य',     color: '#0891B2', bg: '#ECFEFF' },
  4:  { label: 'सामान्य',     color: '#0891B2', bg: '#ECFEFF' },
  5:  { label: 'मध्यम',       color: '#D97706', bg: '#FFFBEB' },
  6:  { label: 'मध्यम',       color: '#D97706', bg: '#FFFBEB' },
  7:  { label: 'उच्च',        color: '#EA580C', bg: '#FFF7ED' },
  8:  { label: 'उच्च',        color: '#EA580C', bg: '#FFF7ED' },
  9:  { label: 'गम्भीर',      color: '#DC2626', bg: '#FEF2F2' },
  10: { label: 'अत्यन्त गम्भीर', color: '#991B1B', bg: '#FEF2F2' },
}

interface Ward { id: number; name: string; name_ne: string; municipality: string; district: string }
type Step = 'write' | 'classify' | 'followup' | 'submitting' | 'success'

const NAV = '#123A6B'
const DEEP = '#0B2D52'
const CRIM = '#C8102E'
const DEV = 'Noto Sans Devanagari, sans-serif'

export default function SubmitPage() {
  const { user } = useAuth()
  const [step,             setStep]             = useState<Step>('write')
  const [text,             setText]             = useState('')
  const [wardId,           setWardId]           = useState<number | null>(null)
  const [wardLabel,        setWardLabel]        = useState('')
  const [wardSearch,       setWardSearch]       = useState('')
  const [showWardList,     setShowWardList]     = useState(false)
  const [wards,            setWards]            = useState<Ward[]>([])
  const [category,         setCategory]         = useState<string | null>(null)
  const [categoryNe,       setCategoryNe]       = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [severity,         setSeverity]         = useState<number | null>(null)
  const [summaryNe,        setSummaryNe]        = useState<string>('')
  const [followupAnswers,  setFollowupAnswers]  = useState<Record<string, string>>({})
  const [complaintId,      setComplaintId]      = useState<string | null>(null)
  const [trackingCode,     setTrackingCode]     = useState<string | null>(null)
  const [copied,           setCopied]           = useState(false)
  const [error,            setError]            = useState('')
  const [pinLat,           setPinLat]           = useState<number | null>(null)
  const [pinLng,           setPinLng]           = useState<number | null>(null)
  const [recording,        setRecording]        = useState(false)
  const [transcribing,     setTranscribing]     = useState(false)
  const [placeholderIdx,   setPlaceholderIdx]   = useState(0)
  const [textareaFocused,  setTextareaFocused]  = useState(false)
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef          = useRef<Blob[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const classifyTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr     = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setTranscribing(true)
        const blob     = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        try {
          const res  = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.text) setText(prev => prev ? `${prev}\n${data.text}` : data.text)
        } catch { /* silently fail */ }
        setTranscribing(false)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setError('माइक्रोफोन अनुमति दिनुहोस् — ब्राउजर सेटिङमा गएर माइक्रोफोन अनुमति सक्षम गर्नुहोस्')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  const MAX_CHARS = 1000

  useEffect(() => {
    fetch('/api/wards').then(r => r.json()).then(d => setWards(d.wards || []))
  }, [])

  const filteredWards = wards.filter(w => {
    const q = wardSearch.toLowerCase()
    return w.name_ne.includes(wardSearch) || w.municipality.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)
  })

  const selectWard = (w: Ward) => {
    setWardId(w.id); setWardLabel(`${w.name_ne} — ${w.municipality}`)
    setWardSearch(''); setShowWardList(false)
  }

  const handleClassify = async () => {
    if (text.trim().length < 10) { setError('कम्तीमा १० अक्षर लेख्नुहोस्'); return }
    if (!wardId) { setError('कृपया आफ्नो वडा छनौट गर्नुहोस्'); return }
    setError('')
    setStep('classify')
    try {
      const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
      const res = await fetch(`${fastapiUrl}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      const cat  = data.category_en || 'Other'
      setCategory(cat)
      setCategoryNe(data.category_ne || CAT_NE[cat] || 'अन्य')
      setSelectedCategories([cat])
      setSeverity(data.severity || 5)
      setSummaryNe(data.summary_ne || '')
      setFollowupAnswers({})
      setStep('followup')
    } catch {
      setCategory('Other'); setCategoryNe('अन्य'); setSelectedCategories(['Other']); setSeverity(5); setStep('followup')
    }
  }

  const handleSubmit = async () => {
    setStep('submitting')
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          ward_id: wardId,
          category_en: category,
          category_ne: categoryNe,
          severity,
          summary_ne: summaryNe,
          followup: { ...followupAnswers, categories: selectedCategories.join(',') },
          lat: pinLat,
          lng: pinLng,
          ...(user ? { citizen_id: user.id } : {}),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setComplaintId(data.complaint_id)
        setTrackingCode(data.tracking_code || null)
        setStep('success')
      } else { setError('उजुरी पठाउन सकिएन। पुनः प्रयास गर्नुहोस्।'); setStep('followup') }
    } catch {
      setError('उजुरी पठाउन सकिएन।'); setStep('followup')
    }
  }

  const questions = FOLLOWUP[category || 'Other'] || FOLLOWUP.Other
  const cs        = CAT_STYLE[category || 'Other'] || CAT_STYLE.Other
  const sevInfo   = SEVERITY_LABEL[severity || 5] || SEVERITY_LABEL[5]
  const isWriteStep = step === 'write' || step === 'classify'
  const isFollowupStep = step === 'followup' || step === 'submitting'

  // ── NAVBAR (matches project pattern) ──────────────────────────────
  const Navbar = () => (
    <header style={{ background: NAV, borderBottom: `2px solid ${DEEP}`, position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 4, height: 28, background: CRIM }} />
            <div style={{ width: 4, height: 28, marginLeft: 2, background: '#003893' }} />
            <div style={{ width: 28, height: 28, marginLeft: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 12, fontFamily: DEV }}>स</div>
          </div>
          <span style={{ fontFamily: DEV, fontWeight: 700, fontSize: 14, color: '#fff' }}>सुनुवाइ</span>
        </Link>

        {/* Progress indicator */}
        {!isWriteStep || step === 'classify' ? null : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            { key: 'write',   label: 'समस्या लेख्नुहोस्' },
            { key: 'followup', label: 'विवरण पुष्टि गर्नुहोस्' },
          ].map((s, i) => {
            const isDone   = s.key === 'write' && (isFollowupStep || step === 'success')
            const isActive = (s.key === 'write' && isWriteStep) || (s.key === 'followup' && isFollowupStep)
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: isDone ? '#1F8A4D' : isActive ? '#fff' : 'rgba(255,255,255,0.15)',
                    color: isDone ? '#fff' : isActive ? NAV : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.2s',
                  }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span style={{
                    fontFamily: DEV, fontSize: 12,
                    color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                    display: 'none',
                  }} className="sm-show">
                    {s.label}
                  </span>
                </div>
                {i < 1 && (
                  <div style={{
                    width: 32, height: 2, borderRadius: 1,
                    background: isDone ? '#1F8A4D' : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </header>
  )

  // ── SUCCESS ────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px 40px' }}>
        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#ECFDF5',
            border: '2px solid #A7F3D0', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#1F8A4D" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{ fontFamily: DEV, fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            उजुरी दर्ता भयो!
          </h1>
          <p style={{ fontFamily: DEV, fontSize: 15, color: '#6B7280' }}>
            AI ले विश्लेषण गरी सम्बन्धित निकायमा पठाइनेछ।
          </p>
        </div>

        {/* Tracking code card */}
        {(trackingCode || complaintId) && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, fontFamily: DEV }}>
              तपाईंको ट्र्याकिङ कोड
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 26, color: '#111827', letterSpacing: 3 }}>
                {trackingCode || complaintId?.slice(0, 13).toUpperCase()}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(trackingCode || complaintId?.slice(0,13).toUpperCase() || '')
                  setCopied(true); setTimeout(() => setCopied(false), 2000)
                }}
                style={{
                  background: copied ? '#ECFDF5' : NAV, color: copied ? '#1F8A4D' : '#fff',
                  border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}>
                {copied ? '✓ कपी भयो' : 'कपी गर्नुहोस्'}
              </button>
            </div>
            <p style={{ fontFamily: DEV, fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>
              यो कोड सम्झनुहोस् — उजुरीको स्थिति जाँच्न काम लाग्छ
            </p>
          </div>
        )}

        {/* Category badge */}
        {category && (
          <div style={{ background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width:22,height:22,borderRadius:5,background:cs.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'#fff',flexShrink:0,letterSpacing:.3 }}>{cs.ab}</span>
            <span style={{ fontFamily: DEV, fontWeight: 600, color: cs.color, fontSize: 14 }}>{categoryNe}</span>
          </div>
        )}

        {/* Escalation journey */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14, fontFamily: DEV }}>
            उजुरीको यात्रा
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {[
              { label: 'वडा', active: true },
              { label: 'नगरपालिका', active: false },
              { label: 'प्रदेश', active: false },
              { label: 'मन्त्रालय', active: false },
            ].map((l, i) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', margin: '0 auto 4px',
                    background: l.active ? '#1F8A4D' : '#E5E7EB',
                    border: l.active ? '2px solid #1F8A4D' : '2px solid #E5E7EB',
                  }} />
                  <span style={{ fontFamily: DEV, fontSize: 11, color: l.active ? '#1F8A4D' : '#9CA3AF', fontWeight: l.active ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {l.label}
                  </span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: '#E5E7EB', margin: '0 4px', marginBottom: 14 }} />}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: DEV, fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>
            वडाले ३ दिनमा नसमाधान गरे स्वतः माथि जान्छ
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => { setText(''); setWardId(null); setWardLabel(''); setStep('write'); setCategory(null); setComplaintId(null) }}
            style={{ flex: 1, background: '#fff', border: '1px solid #E5E7EB', color: '#374151', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: DEV }}>
            अर्को उजुरी
          </button>
          <Link href="/track"
            style={{ flex: 1, background: NAV, color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center', fontFamily: DEV, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ट्र्याक गर्नुहोस् →
          </Link>
        </div>
      </div>
    </div>
  )

  // ── MAIN ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Navbar />

      {/* Progress bar — horizontal full-width */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', height: 56 }}>
            {[
              { key: 'write',    label: 'समस्या लेख्नुहोस्',       desc: 'Step 1' },
              { key: 'followup', label: 'विवरण पुष्टि गर्नुहोस्', desc: 'Step 2' },
            ].map((s, i) => {
              const isDone   = s.key === 'write' && isFollowupStep
              const isActive = (s.key === 'write' && isWriteStep) || (s.key === 'followup' && isFollowupStep)
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px',
                    borderBottom: isActive ? `3px solid ${NAV}` : isDone ? '3px solid #1F8A4D' : '3px solid transparent',
                    height: '100%', flex: 1,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      background: isDone ? '#1F8A4D' : isActive ? NAV : '#F3F4F6',
                      color: isDone || isActive ? '#fff' : '#9CA3AF',
                      transition: 'all 0.25s',
                    }}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div>
                      <p style={{ fontFamily: DEV, fontSize: 13, fontWeight: 600, color: isActive ? '#111827' : isDone ? '#1F8A4D' : '#9CA3AF', margin: 0, lineHeight: 1.2 }}>{s.label}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{s.desc}</p>
                    </div>
                  </div>
                  {i === 0 && (
                    <div style={{ width: 1, height: 28, background: '#E5E7EB', flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* ── SCREEN 1: Write ──────────────────────────────────────── */}
        {isWriteStep && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: 36, maxWidth: 620 }}>
              <h1 style={{ fontFamily: DEV, fontSize: 34, fontWeight: 800, color: '#111827', marginBottom: 10, lineHeight: 1.2 }}>
                तपाईंको समस्या के हो?
              </h1>
              <p style={{ fontFamily: DEV, fontSize: 16, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
                नेपाली वा English मा स्वाभाविक रूपमा लेख्नुहोस्। AI ले सही निकाय पहिचान गर्न मद्दत गर्छ।
              </p>
              {/* Trust badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {[
                  { icon: '✓', text: '१ मिनेटभन्दा कम समय लाग्छ' },
                  { icon: '✓', text: 'फोटो वा आवाज पनि प्रयोग गर्न सकिन्छ' },
                  { icon: '✓', text: 'तपाईंको उजुरी सम्बन्धित निकायसम्म पुग्नेछ' },
                ].map(b => (
                  <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#1F8A4D', fontWeight: 700, fontSize: 13 }}>{b.icon}</span>
                    <span style={{ fontFamily: DEV, fontSize: 13, color: '#6B7280' }}>{b.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Writing canvas */}
            <div style={{
              background: '#fff', border: `1.5px solid ${textareaFocused ? NAV : '#E5E7EB'}`,
              borderRadius: 14, marginBottom: 20,
              boxShadow: textareaFocused ? `0 0 0 3px rgba(18,58,107,0.08)` : '0 1px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}>
              <div style={{ padding: '20px 24px 0' }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                  onFocus={() => setTextareaFocused(true)}
                  onBlur={() => setTextareaFocused(false)}
                  placeholder={text ? '' : PLACEHOLDER_EXAMPLES[placeholderIdx]}
                  rows={7}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: DEV, fontSize: 16, color: '#111827', lineHeight: 1.7,
                    resize: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bottom toolbar */}
              <div style={{ padding: '12px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F3F4F6' }}>
                {/* Voice button */}
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: recording ? '#FEF2F2' : transcribing ? '#F9FAFB' : '#F3F4F6',
                    border: recording ? '1px solid #FECACA' : '1px solid #E5E7EB',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    color: recording ? '#DC2626' : '#374151', fontSize: 13, fontWeight: 500,
                    fontFamily: DEV, opacity: transcribing ? 0.6 : 1, transition: 'all 0.2s',
                  }}>
                  {transcribing ? (
                    <div style={{ width: 16, height: 16, border: '2px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : recording ? (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
                      {[3, 5, 4, 6, 3].map((h, i) => (
                        <div key={i} style={{ width: 2, height: h * 2, background: '#DC2626', borderRadius: 1, transformOrigin: 'bottom', animation: `wave ${0.4 + i * 0.08}s ease-in-out infinite alternate` }} />
                      ))}
                    </div>
                  ) : (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  )}
                  {transcribing ? 'लेख्दैछ...' : recording ? 'रोक्नुहोस्' : 'आवाजबाट भन्नुहोस्'}
                </button>

                {/* Char count */}
                <span style={{ fontSize: 12, color: text.length > 800 ? '#D97706' : '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>
                  {text.length}/{MAX_CHARS}
                </span>
              </div>
            </div>

            {/* Location / ward */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ width:32,height:32,borderRadius:8,background:'#F0FDF4',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1F8A4D" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                </span>
                <div>
                  <p style={{ fontFamily: DEV, fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>समस्या कहाँ छ?</p>
                  <p style={{ fontFamily: DEV, fontSize: 12, color: '#9CA3AF', margin: 0 }}>उजुरी सही निकायमा पठाउन वडा आवश्यक छ</p>
                </div>
              </div>

              {wardLabel ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1F8A4D" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg></div>
                    <span style={{ fontFamily: DEV, fontSize: 14, fontWeight: 600, color: '#111827' }}>{wardLabel}</span>
                  </div>
                  <button
                    onClick={() => { setWardLabel(''); setWardId(null) }}
                    style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: DEV, padding: '4px 8px', borderRadius: 6 }}>
                    बदल्नुहोस्
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={wardSearch}
                    onChange={e => { setWardSearch(e.target.value); setShowWardList(true) }}
                    onFocus={() => setShowWardList(true)}
                    placeholder="वडा खोज्नुहोस्... (Ward 1, Kathmandu...)"
                    style={{
                      width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB',
                      borderRadius: 10, padding: '11px 16px', fontSize: 14, color: '#111827',
                      outline: 'none', boxSizing: 'border-box', fontFamily: DEV,
                      transition: 'border-color 0.2s',
                    }}
                    onFocusCapture={e => { (e.target as HTMLInputElement).style.borderColor = NAV }}
                    onBlurCapture={e => { (e.target as HTMLInputElement).style.borderColor = '#E5E7EB' }}
                  />
                  {showWardList && filteredWards.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto',
                    }}>
                      {filteredWards.slice(0, 20).map(w => (
                        <button key={w.id} onClick={() => selectWard(w)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none',
                            borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2} style={{ flexShrink:0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                          <div>
                            <p style={{ fontFamily: DEV, fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 }}>{w.name_ne}</p>
                            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{w.municipality}, {w.district}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: DEV, fontSize: 14, color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Primary CTA */}
            <button
              onClick={handleClassify}
              disabled={step === 'classify'}
              style={{
                width: '100%', background: NAV, color: '#fff', border: 'none', borderRadius: 12,
                padding: '16px 24px', fontSize: 16, fontWeight: 700, cursor: step === 'classify' ? 'not-allowed' : 'pointer',
                fontFamily: DEV, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: step === 'classify' ? 0.8 : 1, transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(18,58,107,0.2)', marginBottom: 16,
              }}
              onMouseEnter={e => { if (step !== 'classify') (e.currentTarget as HTMLButtonElement).style.background = DEEP }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = NAV }}
            >
              {step === 'classify' ? (
                <>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  AI विश्लेषण गर्दैछ...
                </>
              ) : (
                <>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI विश्लेषण गर्नुहोस्
                </>
              )}
            </button>

            
          </>
        )}

        {/* ── SCREEN 2: Confirm ─────────────────────────────────────── */}
        {isFollowupStep && category && (
          <>
            {/* Page title */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: DEV, fontSize: 30, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
                तपाईंको उजुरी तयार छ
              </h1>
              <p style={{ fontFamily: DEV, fontSize: 15, color: '#6B7280' }}>
                AI ले तपाईंको विवरण विश्लेषण गरिसकेको छ। कृपया पुष्टि गर्नुहोस्।
              </p>
            </div>

            {/* AI Analysis card */}
            <div style={{ background: '#fff', border: `1.5px solid ${NAV}20`, borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: `0 4px 20px rgba(18,58,107,0.06)` }}>
              <div style={{ background: NAV, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>AI विश्लेषण</span>
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'विषय', value: categoryNe || '—', extra: category },
                  { label: 'गम्भीरता', value: `${severity || '—'}/10`, badge: sevInfo?.label, badgeColor: sevInfo?.color, badgeBg: sevInfo?.bg },
                  { label: 'स्थान', value: wardLabel || '—' },
                  { label: 'निकाय', value: 'वडा कार्यालय' },
                ].map(item => (
                  <div key={item.label} style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px', fontFamily: DEV }}>{item.label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontFamily: DEV, fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{item.value}</p>
                      {item.badge && (
                        <span style={{ fontFamily: DEV, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: item.badgeBg, color: item.badgeColor }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {summaryNe && (
                <div style={{ margin: '0 20px 20px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px', fontFamily: DEV }}>AI सारांश</p>
                  <p style={{ fontFamily: DEV, fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{summaryNe}</p>
                </div>
              )}
            </div>

            {/* Complaint preview */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontFamily: DEV, fontSize: 13, fontWeight: 600, color: '#6B7280', margin: 0 }}>तपाईंको उजुरी</p>
                <button
                  onClick={() => setStep('write')}
                  style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#6B7280', cursor: 'pointer', fontFamily: DEV }}>
                  सम्पादन गर्नुहोस्
                </button>
              </div>
              <p style={{ fontFamily: DEV, fontSize: 15, color: '#111827', lineHeight: 1.7, margin: 0, borderLeft: `3px solid ${NAV}`, paddingLeft: 14 }}>
                {text}
              </p>
            </div>

            {/* Category + multi-select */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: DEV, fontSize: 13, fontWeight: 600, color: '#6B7280', margin: '0 0 2px' }}>पहिचान भएको विषय</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 8, padding: '5px 10px' }}>
                    <span style={{ width:20,height:20,borderRadius:4,background:cs.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'#fff',flexShrink:0,letterSpacing:.3 }}>{cs.ab}</span>
                    <span style={{ fontFamily: DEV, fontSize: 14, fontWeight: 600, color: cs.color }}>{categoryNe}</span>
                  </div>
                </div>
              </div>
              <p style={{ fontFamily: DEV, fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
                मिल्दो थप विषयहरू छन्? (ऐच्छिक)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {Object.entries(CAT_STYLE).map(([cat, s]) => {
                  const checked = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategories(prev =>
                          checked ? (prev.length > 1 ? prev.filter(c => c !== cat) : prev) : [...prev, cat]
                        )
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                        background: checked ? s.bg : '#F9FAFB',
                        border: `1px solid ${checked ? s.border : '#E5E7EB'}`,
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: 4, border: checked ? 'none' : '1.5px solid #D1D5DB',
                        background: checked ? s.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {checked && <svg width="9" height="9" fill="none" viewBox="0 0 12 12" stroke="#fff" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5"/></svg>}
                      </div>
                      <span style={{ fontFamily: DEV, fontSize: 12, color: checked ? s.color : '#4B5563', fontWeight: checked ? 600 : 400 }}>{CAT_NE[cat]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Follow-up questions */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: DEV, fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                थप विवरण
              </h2>
              <p style={{ fontFamily: DEV, fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
                यी प्रश्नहरूले वडा कार्यालयलाई छिटो कारवाही गर्न मद्दत गर्छ। सबै ऐच्छिक हुन्।
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {questions.map(q => (
                  <div key={q.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px' }}>
                    <label style={{ display: 'block', fontFamily: DEV, fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 10 }}>
                      {q.label_ne}
                      <span style={{ color: '#9CA3AF', marginLeft: 6, fontWeight: 400, fontSize: 12 }}>({q.label})</span>
                    </label>
                    {q.type === 'select' ? (
                      <select
                        value={followupAnswers[q.id] || ''}
                        onChange={e => setFollowupAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        style={{
                          width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                          padding: '10px 14px', fontSize: 14, color: '#111827', fontFamily: DEV,
                          outline: 'none', cursor: 'pointer', appearance: 'none',
                        }}>
                        <option value="">छनौट गर्नुहोस्...</option>
                        {q.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : q.type === 'textarea' ? (
                      <textarea
                        value={followupAnswers[q.id] || ''}
                        onChange={e => setFollowupAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        rows={3}
                        placeholder="यहाँ लेख्नुहोस्..."
                        style={{
                          width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                          padding: '10px 14px', fontSize: 14, color: '#111827', fontFamily: DEV,
                          outline: 'none', resize: 'none', boxSizing: 'border-box',
                        }} />
                    ) : (
                      <input
                        type="text"
                        value={followupAnswers[q.id] || ''}
                        onChange={e => setFollowupAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="यहाँ लेख्नुहोस्..."
                        style={{
                          width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                          padding: '10px 14px', fontSize: 14, color: '#111827', fontFamily: DEV,
                          outline: 'none', boxSizing: 'border-box',
                        }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Location picker */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: DEV, fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ display:'inline',verticalAlign:'middle',marginRight:5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>समस्याको सटीक स्थान
                    <span style={{ fontFamily: DEV, fontSize: 12, fontWeight: 400, color: '#9CA3AF', marginLeft: 6 }}>(ऐच्छिक)</span>
                  </p>
                  <p style={{ fontFamily: DEV, fontSize: 12, color: '#9CA3AF', margin: 0 }}>खोजेर वा GPS बटन थिचेर ठाउँ राख्नुहोस्</p>
                </div>
                {pinLat && (
                  <span style={{ background: '#ECFDF5', color: '#1F8A4D', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, fontFamily: DEV }}>
                    ✓ छनौट भयो
                  </span>
                )}
              </div>
              <LocationPicker onSelect={(lat, lng) => { setPinLat(lat); setPinLng(lng) }} />
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: DEV, fontSize: 14, color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Final submission info card */}
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <p style={{ fontFamily: DEV, fontSize: 13, fontWeight: 700, color: '#0369A1', marginBottom: 14 }}>
                उजुरी पठाउनु अघि जान्नुहोस्
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'गन्तव्य निकाय',          value: wardLabel ? `${wardLabel} — वडा कार्यालय` : 'वडा कार्यालय' },
                  { label: 'प्रारम्भिक प्रतिक्रिया', value: '३ कार्य दिनभित्र' },
                  { label: 'ट्र्याकिङ कोड',           value: 'उजुरी दर्तापछि तुरुन्तै पाउनुहुनेछ' },
                  { label: 'पारदर्शिता स्तर',         value: 'सार्वजनिक ट्र्याकिङ प्रणालीमा दृश्यमान' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontFamily: DEV, fontSize: 12, color: '#0284C7', fontWeight: 600, width: 140, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontFamily: DEV, fontSize: 12, color: '#374151' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Final CTA */}
            <button
              onClick={handleSubmit}
              disabled={step === 'submitting'}
              style={{
                width: '100%', background: NAV, color: '#fff', border: 'none', borderRadius: 12,
                padding: '18px 24px', fontSize: 17, fontWeight: 700, cursor: step === 'submitting' ? 'not-allowed' : 'pointer',
                fontFamily: DEV, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: step === 'submitting' ? 0.8 : 1, transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(18,58,107,0.25)', marginBottom: 12,
              }}
              onMouseEnter={e => { if (step !== 'submitting') (e.currentTarget as HTMLButtonElement).style.background = DEEP }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = NAV }}
            >
              {step === 'submitting' ? (
                <>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  दर्ता गर्दैछ...
                </>
              ) : (
                <>
                  उजुरी दर्ता गर्नुहोस्
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>

            <button
              onClick={() => setStep('write')}
              style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: DEV, padding: '8px 0' }}>
              ← पछाडि जानुहोस्
            </button>
          </>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wave { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @media (min-width: 640px) { .sm-show { display: inline !important; } }
      `}</style>
    </div>
  )
}
