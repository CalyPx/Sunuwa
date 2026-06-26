import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'no_api_key' }, { status: 500 })

    const formData  = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) return NextResponse.json({ error: 'no_audio' }, { status: 400 })

    const audioBuffer = await audioFile.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    const mimeType    = audioFile.type || 'audio/webm'

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              {
                text: 'Transcribe this audio recording exactly as spoken. The speaker may be in Nepali (Devanagari script), Romanized Nepali, or English. Return ONLY the transcribed text with no commentary, no translation, no labels.',
              },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 600 },
        }),
      }
    )
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('Transcribe error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
