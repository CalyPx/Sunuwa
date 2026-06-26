import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Category → ministry slug mapping (same as routing.json in FastAPI)
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Ministry info
  const { data: ministry, error: mErr } = await supabaseAdmin
    .from('ministries')
    .select('id, name, name_ne, slug')
    .eq('slug', slug)
    .single()

  if (mErr || !ministry) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Latest AI brief
  const { data: brief } = await supabaseAdmin
    .from('briefs')
    .select('id, content_ne, content_en, generated_at')
    .eq('ministry_id', ministry.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  // Clusters for this ministry (by ministry_id)
  const { data: clusters } = await supabaseAdmin
    .from('clusters')
    .select('id, category_en, category_ne, summary_ne, complaint_count, urgency_score, escalation_level, avg_severity, ward:wards(name_ne, municipality)')
    .eq('ministry_id', ministry.id)
    .order('urgency_score', { ascending: false })
    .limit(20)

  // Complaints: match by ministry_id OR by category→slug mapping
  // This handles seed data where ministry_id wasn't set but category was
  const matchingCategories = Object.entries(CAT_TO_SLUG)
    .filter(([, s]) => s === slug)
    .map(([cat]) => cat)

  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, category_en, category_ne, severity, summary_ne, status, created_at, escalation_level, ward:wards(name_ne, municipality)')
    .or(`ministry_id.eq.${ministry.id},category_en.in.(${matchingCategories.map(c => `"${c}"`).join(',')})`)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const list = complaints || []
  const clList = clusters || []

  // Compute live escalation levels (override stored if age-based is higher)
  const now = Date.now()
  const enriched = list.map(c => {
    const daysOld = (now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
    let liveLevel = 1
    if (daysOld >= 14) liveLevel = 4
    else if (daysOld >= 7) liveLevel = 3
    else if (daysOld >= 3) liveLevel = 2
    const level = Math.max(liveLevel, c.escalation_level || 1)
    return { ...c, escalation_level: level, days_old: Math.floor(daysOld) }
  })

  const totalComplaints = enriched.length
  const avgSev = totalComplaints
    ? Math.round(enriched.reduce((s, c) => s + (c.severity || 5), 0) / totalComplaints)
    : 0
  const criticalCount  = enriched.filter(c => (c.severity || 0) >= 8).length
  const escalatedCount = enriched.filter(c => (c.escalation_level || 1) >= 3).length

  return NextResponse.json({
    ministry,
    brief: brief || null,
    clusters: clList,
    complaints: enriched,
    stats: { totalComplaints, avgSev, criticalCount, escalatedCount, activeClusters: clList.length },
  })
}
