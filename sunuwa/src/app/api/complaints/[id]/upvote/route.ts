import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: complaint, error } = await supabaseAdmin
    .from('complaints')
    .select('confirmations_count, severity')
    .eq('id', id)
    .single()

  if (error || !complaint) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const newCount    = (complaint.confirmations_count || 0) + 1
  // Boost severity by 1 for every 5 upvotes, capped at 10
  const baseScore   = complaint.severity || 5
  const boostSteps  = Math.floor(newCount / 5)
  const newSeverity = Math.min(10, baseScore + boostSteps)

  const { error: updateErr } = await supabaseAdmin
    .from('complaints')
    .update({ confirmations_count: newCount, severity: newSeverity })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ confirmations_count: newCount, severity: newSeverity })
}
