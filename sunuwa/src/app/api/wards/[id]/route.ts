import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const wardId = Number(id)
  if (isNaN(wardId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  // Ward info
  const { data: ward, error: wardErr } = await supabaseAdmin
    .from('wards')
    .select('id, name, name_ne, municipality, district, province, lat, lng')
    .eq('id', wardId)
    .single()

  if (wardErr || !ward) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Complaints for this ward
  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, text, category_en, category_ne, severity, summary_ne, escalation_level, status, created_at, lat, lng, followup_data, tracking_code, officer_notes, referred_to')
    .eq('ward_id', wardId)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const list = complaints || []

  // Stats
  const total   = list.length
  const active  = list.filter((c) => c.status === 'active').length
  const pending = list.filter((c) => c.status === 'pending').length
  const avgSev  = total
    ? Math.round(list.reduce((s, c) => s + (c.severity || 5), 0) / total)
    : 0

  // Category breakdown
  const catMap: Record<string, { en: string; ne: string; count: number; totalSev: number }> = {}
  list.forEach((c) => {
    const key = c.category_en || 'Other'
    if (!catMap[key]) catMap[key] = { en: key, ne: c.category_ne || key, count: 0, totalSev: 0 }
    catMap[key].count++
    catMap[key].totalSev += c.severity || 5
  })
  const categories = Object.values(catMap)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ ...c, avgSev: Math.round(c.totalSev / c.count) }))

  return NextResponse.json({ ward, complaints: list, stats: { total, active, pending, avgSev }, categories })
}
