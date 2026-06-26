import { NextRequest, NextResponse } from 'next/server'

const UNIT_RATES: Record<string, string> = {
  Infrastructure: `
- Road blacktopping (per m²): NPR 2,500–4,000
- Pothole repair (per m²): NPR 800–1,500
- Drain/culvert construction (per m): NPR 3,000–6,000
- Bridge repair (per m²): NPR 8,000–15,000
- Footpath repair (per m²): NPR 1,200–2,500
- Street light installation (per unit): NPR 15,000–35,000
- Retaining wall (per m²): NPR 5,000–10,000`,
  Water: `
- HDPE pipe replacement (per m, 50mm): NPR 400–800
- HDPE pipe replacement (per m, 100mm): NPR 900–1,600
- Water meter replacement (per unit): NPR 3,500–6,000
- Storage tank repair (5000L): NPR 15,000–35,000
- Valve/fitting replacement (per point): NPR 1,500–3,500
- Pump repair (per unit): NPR 8,000–25,000`,
}

export async function POST(req: NextRequest) {
  try {
    const { complaint_text, category_en, followup_data } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'no_api_key' }, { status: 500 })

    const rates = UNIT_RATES[category_en] || UNIT_RATES.Infrastructure
    const followupStr = followup_data
      ? Object.entries(followup_data as Record<string, string>)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
          .join('\n')
      : ''

    const prompt = `You are a Nepal government civil works cost estimator.

Complaint: ${(complaint_text || '').slice(0, 400)}
Category: ${category_en}
${followupStr ? `Details:\n${followupStr}` : ''}

Nepal Government Standard Unit Rates (2024):${rates}

Estimate the NPR cost range to fix this specific issue. Base your estimate on the scale described.
Respond with ONLY valid JSON (no markdown):
{
  "min_npr": <number>,
  "max_npr": <number>,
  "estimate_ne": "<1–2 sentences in Nepali explaining the cost range>",
  "breakdown": [{"item": "<work item>", "unit": "<m/m²/unit>", "qty": "<estimate>", "rate": "<NPR range>"}]
}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      }
    )
    const data = await res.json()
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(json))
  } catch (err) {
    console.error('Budget estimate error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
