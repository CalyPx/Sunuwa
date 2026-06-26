import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses service role key — bypasses RLS so we can always read user_roles
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json()
    if (!user_id) return NextResponse.json({ role: null }, { status: 400 })

    const { data, error } = await adminSupabase
      .from('user_roles')
      .select('role, ward_id, ministry_slug')
      .eq('user_id', user_id)
      .maybeSingle()

    if (error) {
      console.error('role lookup error:', error.message)
      return NextResponse.json({ role: null, error: error.message })
    }

    return NextResponse.json({ role: data })
  } catch (e) {
    return NextResponse.json({ role: null, error: String(e) }, { status: 500 })
  }
}
