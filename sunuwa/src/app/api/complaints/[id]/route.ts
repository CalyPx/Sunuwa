import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const raw = id.trim().toUpperCase()

  // 1. Try tracking_code first (short code like KTM-16-A7B)
  let query = supabaseAdmin
    .from('complaints')
    .select('id, category_en, category_ne, severity, summary_ne, status, created_at, escalation_level, lat, lng, followup_data, tracking_code, officer_notes, referred_to, ward:wards(name_ne, municipality)')
    .ilike('tracking_code', raw)
    .limit(1)

  let { data: complaint, error } = await query

  // 2. Fall back to UUID prefix search if not found by tracking_code
  if (!complaint || error) {
    const uuidSearch = id.toLowerCase().replace(/[^a-f0-9-]/g, '')
    const res2 = await supabaseAdmin
      .from('complaints')
      .select('id, category_en, category_ne, severity, summary_ne, status, created_at, escalation_level, lat, lng, followup_data, tracking_code, officer_notes, referred_to, ward:wards(name_ne, municipality)')
      .filter('id::text', 'ilike', `${uuidSearch}%`)
      .limit(1)
    complaint = res2.data?.[0] ?? null
    error = res2.error
  }

  if (!complaint) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const daysOld = (Date.now() - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24)
  let liveLevel = 1
  if (daysOld >= 14) liveLevel = 4
  else if (daysOld >= 7) liveLevel = 3
  else if (daysOld >= 3) liveLevel = 2
  const escalation_level = Math.max(liveLevel, complaint.escalation_level || 1)

  return NextResponse.json({ ...complaint, escalation_level, days_old: Math.floor(daysOld) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { officer_note, referred_to, status } = body

    const { data: existing } = await supabaseAdmin
      .from('complaints').select('officer_notes').eq('id', id).single()

    const currentNotes: string[] = existing?.officer_notes || []
    const timestamp = new Date().toLocaleString('ne-NP', { dateStyle: 'short', timeStyle: 'short' })
    const newNote = officer_note ? `[${timestamp}] ${officer_note}` : null

    const updates: Record<string, unknown> = {}
    if (newNote) updates.officer_notes = [...currentNotes, newNote]
    if (referred_to !== undefined) updates.referred_to = referred_to
    if (status) updates.status = status
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })

    const { error } = await supabaseAdmin.from('complaints').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
