import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const RSS_FEEDS = [
  { url: 'https://www.onlinekhabar.com/feed', source: 'Onlinekhabar' },
  { url: 'https://www.setopati.com/feed',     source: 'Setopati' },
]

const CAT_KEYWORDS: Record<string, string[]> = {
  Infrastructure: ['सडक', 'पुल', 'निर्माण', 'ढल', 'नाली', 'road', 'bridge', 'infrastructure', 'construction'],
  Health:         ['अस्पताल', 'स्वास्थ्य', 'औषधि', 'रोग', 'hospital', 'health', 'disease', 'medicine', 'clinic'],
  Education:      ['विद्यालय', 'शिक्षा', 'विश्वविद्यालय', 'school', 'education', 'university', 'student', 'teacher'],
  Water:          ['पानी', 'खानेपानी', 'water', 'pipe', 'irrigation', 'drought', 'flood'],
  Electricity:    ['बिजुली', 'लोडसेडिङ', 'electricity', 'power', 'NEA', 'transformer'],
  Corruption:     ['भ्रष्ट', 'घूस', 'corrupt', 'bribe', 'CIAA', 'fraud', 'scam'],
  Safety:         ['सुरक्षा', 'दुर्घटना', 'crime', 'accident', 'police', 'safety', 'violence'],
  Environment:    ['वातावरण', 'प्रदूषण', 'environment', 'pollution', 'climate', 'forest', 'river'],
}

function detectCategory(title: string, desc: string): string {
  const text = (title + ' ' + desc).toLowerCase()
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) return cat
  }
  return 'Other'
}

function extractText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))
  return m ? m[1].trim() : ''
}

export async function GET(_req: NextRequest) {
  const items: Array<{
    title: string; summary: string; url: string; source: string
    category_en: string; published_at: string
  }> = []

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'SunuwaGovBot/1.0 (civic-intelligence)' },
        signal:  AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const xml = await res.text()

      const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
      for (const block of itemBlocks.slice(0, 15)) {
        const title   = extractText(block, 'title')
        const link    = extractText(block, 'link') || (block.match(/<link>(.*?)<\/link>/)?.[1] || '')
        const desc    = extractText(block, 'description').replace(/<[^>]*>/g, '').slice(0, 300)
        const pubDate = extractText(block, 'pubDate')

        if (title && link) {
          items.push({
            title,
            summary:      desc,
            url:          link.trim(),
            source:       feed.source,
            category_en:  detectCategory(title, desc),
            published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          })
        }
      }
    } catch (err) {
      console.warn(`RSS fetch failed for ${feed.source}:`, err)
    }
  }

  if (items.length > 0) {
    // Deduplicate by URL before inserting — avoid constraint errors if no unique index on url
    const { data: existing } = await supabaseAdmin
      .from('news_items')
      .select('url')
      .in('url', items.map(i => i.url))

    const existingUrls = new Set((existing || []).map(e => e.url))
    const newItems = items.filter(i => !existingUrls.has(i.url))

    if (newItems.length > 0) {
      const { error } = await supabaseAdmin.from('news_items').insert(newItems)
      if (error) console.error('news_items insert:', error.message)
    }
  }

  return NextResponse.json({ fetched: items.length, items })
}
