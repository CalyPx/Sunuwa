import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache — avoids hammering Nominatim for identical queries
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchNominatim(url: string, retries = 3): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Sunuwa-CivicApp/1.0 (contact@sunuwa.gov.np)',
          'Accept-Language': 'ne,en',
          'Accept': 'application/json',
        },
        // 8 second timeout
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw new Error('All retries failed')
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type    = searchParams.get('type') // 'search' | 'reverse'
  const q       = searchParams.get('q')
  const lat     = searchParams.get('lat')
  const lon     = searchParams.get('lon')

  let nominatimUrl: string

  if (type === 'reverse' && lat && lon) {
    nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
  } else if (type === 'search' && q) {
    nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' Nepal')}&format=json&limit=5&countrycodes=np`
  } else {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  // Cache hit
  const cached = cache.get(nominatimUrl)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT' },
    })
  }

  try {
    const data = await fetchNominatim(nominatimUrl)
    cache.set(nominatimUrl, { data, ts: Date.now() })
    // Evict old entries if cache grows large
    if (cache.size > 500) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
      cache.delete(oldest[0])
    }
    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS' },
    })
  } catch {
    return NextResponse.json({ error: 'geocode_failed' }, { status: 502 })
  }
}
