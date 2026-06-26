import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DEMO_OTP = '123456'

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json()

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
    }

    const clean = phone.replace(/\D/g, '')
    if (!/^(97|98)\d{8}$/.test(clean)) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
    }

    if (otp !== DEMO_OTP) {
      return NextResponse.json({ error: 'invalid_otp' }, { status: 401 })
    }

    // Upsert citizen — find existing or create new
    const { data, error } = await supabaseAdmin
      .from('citizens')
      .upsert(
        { phone_number: clean },
        { onConflict: 'phone_number', ignoreDuplicates: false }
      )
      .select('id, phone_number, created_at, ward_number')
      .single()

    if (error) {
      console.error('Citizens upsert error:', error)
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ citizen: data })
  } catch (err) {
    console.error('Auth citizen error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
