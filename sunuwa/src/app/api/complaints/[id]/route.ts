import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const raw = id.trim().toUpperCase()

  const SELECT = 'id, category_en, category_ne, severity, summary_ne, status, created_at, escalation_level, lat, lng, followup_data, tracking_code, officer_notes, referred_to, ward:wards(name_ne, municipality)'

  // 1. Try exact tracking_code match first (e.g. KTM-16-A7B)
  const { data: rows1 } = await supabaseAdmin
    .from('complaints')
    .select(SELECT)
    .ilike('tracking_code', raw)
    .limit(1)

  let complaint = rows1?.[0] ?? null

  // 2. Fall back to UUID prefix search only if input looks like a UUID fragment (8+ hex chars)
  if (!complaint) {
    const uuidSearch = id.toLowerCase().replace(/[^a-f0-9-]/g, '')
    if (uuidSearch.length >= 8) {
      const { data: rows2 } = await supabaseAdmin
        .from('complaints')
        .select(SELECT)
        .filter('id::text', 'ilike', `${uuidSearch}%`)
        .limit(1)
      complaint = rows2?.[0] ?? null
    }
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
