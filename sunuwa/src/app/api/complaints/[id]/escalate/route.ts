import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const raw = id.trim()

    // Lookup complaint WITHOUT citizen_escalated column — the column may not
    // exist yet if the migration hasn't been run; we only need id/status here.
    const SELECT = 'id, status, escalation_level, tracking_code'

    const { data: rows1, error: e1 } = await supabaseAdmin
      .from('complaints')
      .select(SELECT)
      .ilike('tracking_code', raw.toUpperCase())
      .limit(1)

    let complaint = rows1?.[0] ?? null

    if (!complaint) {
      const uuidSearch = raw.toLowerCase().replace(/[^a-f0-9-]/g, '')
      if (uuidSearch.length >= 8) {
        const { data: rows2 } = await supabaseAdmin
          .from('complaints')
          .select(SELECT)
          .filter('id::text', 'ilike', `${uuidSearch}%`)
          .limit(1)
        complaint = rows2?.[0] ?? null
      }
    }

    if (e1 && !complaint) {
      console.error('Lookup error:', e1)
      return NextResponse.json({ error: 'db_error', detail: e1.message }, { status: 500 })
    }

    if (!complaint) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (complaint.status === 'resolved') return NextResponse.json({ error: 'already_resolved' }, { status: 400 })

    // Build update payload — try citizen_escalated columns; if missing they're ignored by Supabase
    const updatePayload: Record<string, unknown> = {
      escalation_level: Math.max(complaint.escalation_level || 1, 4),
      status:           'escalated',
    }

    // Attempt to set the new columns. If they don't exist yet the update will
    // still succeed for the columns that DO exist (Supabase ignores unknown keys
    // at the JS level before they hit the DB).
    updatePayload.citizen_escalated    = true
    updatePayload.citizen_escalated_at = new Date().toISOString()

    const { error: updateErr } = await supabaseAdmin
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaint.id)

    if (updateErr) {
      // If failure is because citizen_escalated column doesn't exist, fall back
      // to updating only the columns we know exist.
      if (updateErr.message?.includes('citizen_escalated') || updateErr.code === '42703') {
        const { error: fallbackErr } = await supabaseAdmin
          .from('complaints')
          .update({ escalation_level: Math.max(complaint.escalation_level || 1, 4), status: 'escalated' })
          .eq('id', complaint.id)
        if (fallbackErr) {
          console.error('Fallback escalate error:', fallbackErr)
          return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
        }
        // Return success with a hint that the migration is needed
        return NextResponse.json({ success: true, migration_needed: true })
      }
      console.error('Escalate update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Escalate route error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
