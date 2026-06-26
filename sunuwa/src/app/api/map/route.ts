import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  // Try clusters first — join ward to get lat/lng since cluster_service may not set it
  const { data: clusters } = await supabaseAdmin
    .from('clusters')
    .select('id, category_en, category_ne, summary_ne, complaint_count, urgency_score, escalation_level, ward:wards(lat, lng, name_ne, municipality, district)')
    .order('urgency_score', { ascending: false })
    .limit(100)

  if (clusters && clusters.length > 0) {
    // Flatten ward lat/lng to top-level so MapComponent can use point.lat / point.lng
    const flat = clusters.map((c: Record<string, unknown>) => {
      const ward = c.ward as Record<string, unknown> | null
      return { ...c, lat: ward?.lat ?? null, lng: ward?.lng ?? null }
    })
    return NextResponse.json({ type: 'clusters', data: flat })
  }

  // Fallback: raw complaints (before clustering has run)
  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, ward_id, category_en, category_ne, severity, summary_ne, summary_en, escalation_level, ward:wards(lat, lng, name_ne, municipality, district)')
    .eq('status', 'active')
    .not('ward_id', 'is', null)
    .order('severity', { ascending: false })
    .limit(500)

  // Flatten ward lat/lng to top-level
  const flat = (complaints || []).map((c: Record<string, unknown>) => {
    const ward = c.ward as Record<string, unknown> | null
    return { ...c, lat: ward?.lat ?? null, lng: ward?.lng ?? null }
  })

  return NextResponse.json({ type: 'complaints', data: flat })
}
