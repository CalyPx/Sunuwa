import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Short tracking code: e.g. KTM-16-A7B ──────────────────────────
function generateTrackingCode(wardId: number, district = 'KTM'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${district}-${wardId}-${rand}`
}

// ── Hybrid severity: rule-based base + category modifier ─────────
const CATEGORY_BASE: Record<string, number> = {
  Health:         75,
  Corruption:     70,
  Safety:         70,
  Electricity:    60,
  Water:          60,
  Infrastructure: 50,
  Environment:    45,
  Education:      45,
  Other:          40,
}
function computeBaseSeverity(category_en: string, followup?: Record<string, string>): number {
  let score = CATEGORY_BASE[category_en] ?? 40
  if (followup) {
    const duration = followup.duration_days || followup.since_days || followup.days || ''
    const days = parseInt(String(duration)) || 0
    if (days > 30) score += 20
    else if (days > 14) score += 12
    else if (days > 7)  score += 6
    const affected = (followup.affected_area || followup.people_affected || '').toLowerCase()
    if (affected.includes('ward') || affected.includes('city') || affected.includes('सहर')) score += 15
    else if (affected.includes('street') || affected.includes('सडक')) score += 8
    else if (affected.includes('house') || affected.includes('घर')) score += 4
  }
  return Math.min(Math.round(score / 10), 10) // normalise to 1-10
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, ward_id, category_en, category_ne, severity, summary_ne, lat, lng, followup, citizen_phone } = body

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: 'too_short' }, { status: 400 })
    }
    if (!ward_id) {
      return NextResponse.json({ error: 'no_ward' }, { status: 400 })
    }

    const insertData: Record<string, unknown> = {
      text:    text.trim(),
      ward_id: Number(ward_id),
      status:  'active',
    }

    // Generate short readable tracking code
    const tracking_code = generateTrackingCode(Number(ward_id))
    insertData.tracking_code = tracking_code

    // Hybrid severity
    const computedSev = severity
      ? Number(severity)
      : computeBaseSeverity(category_en || 'Other', followup)

    if (category_en)  insertData.category_en   = category_en
    if (category_ne)  insertData.category_ne   = category_ne
    insertData.severity = computedSev
    if (summary_ne)   insertData.summary_ne     = summary_ne
    if (lat)          insertData.lat            = Number(lat)
    if (lng)          insertData.lng            = Number(lng)
    if (followup)     insertData.followup_data  = followup
    if (citizen_phone) insertData.citizen_phone  = citizen_phone

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    // Fire-and-forget: generate embedding for semantic clustering
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${appUrl}/api/generate-embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint_id: complaint.id }),
    }).catch(err => console.warn('Embedding generation failed:', err))

    return NextResponse.json({ success: true, complaint_id: complaint.id, tracking_code })
  } catch (err) {
    console.error('Complaint submission error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ward_id = searchParams.get('ward_id')
  const limit = Number(searchParams.get('limit') || '50')

  let query = supabaseAdmin
    .from('complaints')
    .select('*, ward:wards(name_ne, municipality)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (ward_id) {
    query = query.eq('ward_id', ward_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ complaints: data })
}
