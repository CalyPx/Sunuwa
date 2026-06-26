import { NextRequest, NextResponse } from 'next/server'

const CAT_NE: Record<string, string> = {
  Infrastructure: 'पूर्वाधार', Health: 'स्वास्थ्य', Education: 'शिक्षा',
  Water: 'खानेपानी', Electricity: 'बिजुली', Corruption: 'भ्रष्टाचार',
  Safety: 'सुरक्षा', Environment: 'वातावरण', Other: 'अन्य',
}

const CATEGORY_BASE: Record<string, number> = {
  Health: 7, Corruption: 7, Safety: 7, Electricity: 6,
  Water: 6, Infrastructure: 5, Environment: 5, Education: 5, Other: 4,
}

// ── Keyword-based fallback classifier ─────────────────────────────
function keywordClassify(text: string): string {
  const t = text.toLowerCase()
  if (/सडक|खाल्डो|पुल|नाली|ढल|road|bridge|drain|pothole|infrastructure/.test(t)) return 'Infrastructure'
  if (/अस्पताल|स्वास्थ्य|डाक्टर|औषधि|hospital|health|doctor|medicine|clinic/.test(t)) return 'Health'
  if (/विद्यालय|स्कूल|शिक्षक|किताब|school|teacher|education|student/.test(t)) return 'Education'
  if (/पानी|धारा|खानेपानी|water|pipe|leak|supply/.test(t)) return 'Water'
  if (/बिजुली|खम्बा|तार|लोडसेडिङ|electricity|power|pole|wire|transformer/.test(t)) return 'Electricity'
  if (/घूस|भ्रष्ट|रिसवत|corrupt|bribe|fraud|irregularity/.test(t)) return 'Corruption'
  if (/चोरी|डकैती|अपराध|crime|theft|safety|accident|violence/.test(t)) return 'Safety'
  if (/फोहोर|प्रदूषण|वातावरण|garbage|pollution|environment|waste/.test(t)) return 'Environment'
  return 'Other'
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || text.trim().length < 5) {
      return NextResponse.json({ error: 'too_short' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    let category_en = 'Other'
    let summary_ne = ''
    let severity = 5

    // ── Try Gemini first ─────────────────────────────────────────────
    if (apiKey) {
      try {
        const prompt = `You are a Nepali government complaint classifier. 
Analyze this complaint and respond with ONLY valid JSON (no markdown, no extra text):

Complaint: "${text.slice(0, 500)}"

Respond with this exact JSON structure:
{
  "category_en": "<one of: Infrastructure, Health, Education, Water, Electricity, Corruption, Safety, Environment, Other>",
  "severity": <integer 1-10, where 10 is most urgent>,
  "summary_ne": "<1-2 sentence summary in Nepali language>"
}

Consider: safety risks, duration, number affected, public impact for severity.`

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
            }),
          }
        )
        const geminiData = await res.json()
        const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        // Strip markdown code fences if present
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        if (parsed.category_en && CAT_NE[parsed.category_en]) {
          category_en = parsed.category_en
          severity    = Math.min(10, Math.max(1, parseInt(parsed.severity) || 5))
          summary_ne  = parsed.summary_ne || ''
        }
      } catch (geminiErr) {
        console.warn('Gemini classify failed, using keyword fallback:', geminiErr)
        category_en = keywordClassify(text)
        severity    = CATEGORY_BASE[category_en] ?? 5
      }
    } else {
      // No API key — use keyword classifier
      category_en = keywordClassify(text)
      severity    = CATEGORY_BASE[category_en] ?? 5
    }

    return NextResponse.json({
      category_en,
      category_ne: CAT_NE[category_en] || 'अन्य',
      severity,
      summary_ne,
    })
  } catch (err) {
    console.error('Classify error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
