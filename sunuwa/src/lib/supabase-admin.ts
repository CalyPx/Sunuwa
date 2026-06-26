import { createClient } from '@supabase/supabase-js'

// ⚠️ Server-side ONLY — uses service role key, bypasses RLS
// Never import this in client components or pages with 'use client'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
