import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BATCH_SIZE = 20
const EMBED_DIM  = 384

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'no_api_key' }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const { complaint_id } = body as { complaint_id?: string }

    // Fetch complaints that need embeddings
    const baseQuery = supabaseAdmin
      .from('complaints')
      .select('id, text, summary_ne, category_en')
      .not('text', 'is', null)

    const { data: complaints, error } = complaint_id
      ? await baseQuery.eq('id', complaint_id)
      : await baseQuery.is('embedding', null).limit(BATCH_SIZE)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!complaints?.length) return NextResponse.json({ processed: 0, message: 'nothing to embed' })

    let processed = 0
    const errors: string[] = []

    for (const complaint of complaints) {
      const textToEmbed = [
        complaint.category_en || '',
        complaint.summary_ne  || '',
        (complaint.text || '').slice(0, 400),
      ].filter(Boolean).join(' | ')

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: textToEmbed }] },
              outputDimensionality: EMBED_DIM,
            }),
          }
        )
        const data = await res.json()
        const values: number[] | undefined = data?.embedding?.values

        if (values && values.length === EMBED_DIM) {
          // pgvector expects the array as a string: "[0.1,0.2,...]"
          await supabaseAdmin
            .from('complaints')
            .update({ embedding: `[${values.join(',')}]` })
            .eq('id', complaint.id)
          processed++
        } else {
          errors.push(`${complaint.id}: dim=${values?.length}, expected ${EMBED_DIM}`)
        }
      } catch (err) {
        errors.push(`${complaint.id}: ${err}`)
      }
    }

    return NextResponse.json({ processed, total: complaints.length, errors })
  } catch (err) {
    console.error('Generate embeddings error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
