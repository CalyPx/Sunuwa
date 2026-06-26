import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SIMILARITY_THRESHOLD = 0.75
const MIN_CLUSTER_SIZE      = 2

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  if (Array.isArray(raw)) return raw as number[]
  return null
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export async function POST(_req: NextRequest) {
  try {
    // Fetch all unresolved complaints with embeddings
    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('id, ward_id, ministry_id, category_en, category_ne, severity, summary_ne, embedding')
      .not('embedding', 'is', null)
      .neq('status', 'resolved')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!complaints?.length) return NextResponse.json({ clusters_created: 0, message: 'no embedded complaints' })

    // Parse embeddings
    const items = complaints
      .map(c => ({ ...c, vec: parseEmbedding(c.embedding) }))
      .filter(c => c.vec !== null) as (typeof complaints[0] & { vec: number[] })[]

    // Greedy union-find clustering: same ward + category, cosine sim > threshold
    const clusterOf = new Map<string, number>() // complaint_id → cluster_id
    let nextId = 1

    // Group by ward_id + category_en to limit comparisons
    const grouped = new Map<string, typeof items>()
    for (const item of items) {
      const key = `${item.ward_id}|${item.category_en}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(item)
    }

    for (const group of grouped.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const sim = cosine(group[i].vec, group[j].vec)
          if (sim >= SIMILARITY_THRESHOLD) {
            // Assign both to same cluster
            const cid = clusterOf.get(group[i].id) ?? clusterOf.get(group[j].id) ?? nextId++
            clusterOf.set(group[i].id, cid)
            clusterOf.set(group[j].id, cid)
          }
        }
      }
    }

    // Aggregate clusters
    const clusterMap = new Map<number, typeof items>()
    for (const [id, cid] of clusterOf) {
      const item = items.find(c => c.id === id)!
      if (!clusterMap.has(cid)) clusterMap.set(cid, [])
      clusterMap.get(cid)!.push(item)
    }

    // Only keep clusters with MIN_CLUSTER_SIZE or more
    const validClusters = [...clusterMap.values()].filter(g => g.length >= MIN_CLUSTER_SIZE)

    // Clear old clusters for these wards
    await supabaseAdmin.from('clusters').delete().neq('id', 0)

    // Insert new clusters
    let clustersCreated = 0
    for (const group of validClusters) {
      const first     = group[0]
      const avgSev    = group.reduce((s, c) => s + (c.severity || 5), 0) / group.length
      const maxEsc    = Math.max(...group.map(c => 1))
      const urgency   = avgSev * group.length * 0.1 // simple urgency score

      // Use first item's ward/ministry info
      const { data: wardData } = await supabaseAdmin
        .from('wards').select('lat, lng').eq('id', first.ward_id).single()

      const { error: insertErr } = await supabaseAdmin
        .from('clusters')
        .insert({
          category_en:      first.category_en,
          category_ne:      first.category_ne,
          ward_id:          first.ward_id,
          ministry_id:      first.ministry_id,
          complaint_count:  group.length,
          avg_severity:     Math.round(avgSev * 10) / 10,
          summary_ne:       group.map(c => c.summary_ne).filter(Boolean).join(' | ').slice(0, 500) || null,
          escalation_level: maxEsc,
          urgency_score:    Math.round(urgency * 10) / 10,
          lat:              wardData?.lat || null,
          lng:              wardData?.lng || null,
          last_clustered_at: new Date().toISOString(),
        })

      if (!insertErr) clustersCreated++
    }

    // Update cluster_id on each complaint
    for (const [complaintId, cid] of clusterOf) {
      const groupIdx = validClusters.findIndex(g => g.some(c => c.id === complaintId))
      if (groupIdx >= 0) {
        await supabaseAdmin
          .from('complaints')
          .update({ cluster_id: groupIdx + 1 })
          .eq('id', complaintId)
      }
    }

    return NextResponse.json({
      clusters_created: clustersCreated,
      complaints_clustered: clusterOf.size,
      total_with_embeddings: items.length,
    })
  } catch (err) {
    console.error('Clustering error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
