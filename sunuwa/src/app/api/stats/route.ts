import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    // Total complaints
    const { count: total } = await supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact', head: true })

    // Resolved complaints
    const { count: resolved } = await supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved')

    // Avg resolution time in days (resolved complaints with created_at and updated_at)
    const { data: resolvedRows } = await supabaseAdmin
      .from('complaints')
      .select('created_at, updated_at')
      .eq('status', 'resolved')
      .not('updated_at', 'is', null)
      .limit(500)

    let avgDays: number | null = null
    if (resolvedRows && resolvedRows.length > 0) {
      const diffs = resolvedRows
        .map(r => {
          const ms = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()
          return ms / (1000 * 60 * 60 * 24)
        })
        .filter(d => d >= 0 && d < 365)
      if (diffs.length > 0) {
        avgDays = Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
      }
    }

    // Category breakdown
    const { data: catRows } = await supabaseAdmin
      .from('complaints')
      .select('category_en')

    const catCounts: Record<string, number> = {}
    for (const row of catRows ?? []) {
      const key = row.category_en || 'Other'
      catCounts[key] = (catCounts[key] || 0) + 1
    }

    const t = total ?? 0
    const categories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: t > 0 ? Math.round((count / t) * 100) : 0 }))

    const resolutionRate = t > 0 && resolved != null
      ? Math.round((resolved / t) * 100)
      : null

    return NextResponse.json({
      total:          total ?? 0,
      resolved:       resolved ?? 0,
      resolutionRate,
      avgDays,
      categories,
    })
  } catch (err) {
    console.error('Stats error:', err)
    return NextResponse.json({ error: 'stats_failed' }, { status: 500 })
  }
}
