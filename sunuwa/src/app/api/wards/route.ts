import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('wards')
    .select('id, name, name_ne, municipality, district, province')
    .order('municipality')
    .order('id')

  if (error) return NextResponse.json({ wards: [], error: error.message }, { status: 500 })
  return NextResponse.json({ wards: data || [] })
}
