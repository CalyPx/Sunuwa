import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CAT_TO_SLUG: Record<string, string> = {
  Education:      'education',
  Infrastructure: 'infrastructure',
  Health:         'health',
  Water:          'energy-water',
  Electricity:    'energy-water',
  Corruption:     'ciaa',
  Safety:         'home-affairs',
  Environment:    'environment',
  Other:          'home-affairs',
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no_api_key' }, { status: 500 })

  const { data: ministry } = await supabaseAdmin
    .from('ministries')
    .select('id, name, name_ne, slug')
    .eq('slug', slug)
    .single()

  if (!ministry) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const matchingCats = Object.entries(CAT_TO_SLUG)
    .filter(([, s]) => s === slug)
    .map(([cat]) => cat)

  // Fetch active complaints
  const catFilter = matchingCats.length > 0
    ? `ministry_id.eq.${ministry.id},category_en.in.(${matchingCats.map(c => `"${c}"`).join(',')})`
    : `ministry_id.eq.${ministry.id}`

  const [complaintsRes, clustersRes, newsRes] = await Promise.all([
    supabaseAdmin
      .from('complaints')
      .select('category_en, severity, summary_ne, status, created_at, escalation_level')
      .or(catFilter)
      .neq('status', 'resolved')
      .order('severity', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('clusters')
      .select('category_en, summary_ne, complaint_count, urgency_score')
      .eq('ministry_id', ministry.id)
      .order('urgency_score', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('news_items')
      .select('title, source, category_en, published_at')
      .in('category_en', matchingCats.length > 0 ? matchingCats : ['Other'])
      .order('published_at', { ascending: false })
      .limit(6),
  ])

  const complaints = complaintsRes.data || []
  const clusters   = clustersRes.data  || []
  const news       = newsRes.data      || []

  const complaintLines = complaints.slice(0, 20).map((c, i) =>
    `${i + 1}. [${c.category_en}] गम्भीरता ${c.severity}/10 — ${c.summary_ne || 'विवरण छैन'}`
  ).join('\n')

  const clusterLines = clusters.map(cl =>
    `• ${cl.category_en}: ${cl.complaint_count} उजुरी — urgency ${cl.urgency_score} — ${cl.summary_ne?.slice(0, 100) || ''}`
  ).join('\n')

  const newsLines = news.map(n =>
    `• [${n.source}] ${n.title}`
  ).join('\n')

  const prompt = `तपाईं ${ministry.name_ne} (${ministry.name}) मन्त्रालयका लागि AI खुफिया सल्लाहकार हुनुहुन्छ।

आजका सक्रिय उजुरीहरू (${complaints.length} वटा):
${complaintLines || 'कुनै उजुरी छैन'}

समूहीकृत समस्याहरू (AI clusters):
${clusterLines || 'कुनै cluster छैन'}

सम्बन्धित समाचारहरू (Onlinekhabar / Setopati):
${newsLines || 'कुनै समाचार छैन'}

माथिको आधारमा मन्त्री महोदयका लागि आजको कार्यमुखी ब्रिफिङ नेपालीमा तयार गर्नुहोस्।

## मुख्य समस्याहरू
(शीर्ष ३–५ ठोस बुँदामा)

## तत्काल कारवाही चाहिने
(आज वा भोलि गर्नुपर्ने)

## प्रवृत्ति विश्लेषण
(बढ्दो वा घट्दो ट्रेन्ड)

## सिफारिस
(नीतिगत वा कार्यात्मक सुझाव)

सरकारी भाषाशैली प्रयोग गर्नुहोस् — संक्षिप्त र ठोस रहनुहोस्।`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    }
  )
  const geminiData = await res.json()
  const content_ne = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

  if (!content_ne) {
    console.error('Gemini returned empty:', JSON.stringify(geminiData))
    return NextResponse.json({ error: 'gemini_failed' }, { status: 500 })
  }

  const { error: insertErr } = await supabaseAdmin
    .from('briefs')
    .insert({ ministry_id: ministry.id, content_ne, content_en: '' })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ success: true, content_ne })
}
