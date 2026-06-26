# Sunuwa — Session Notes 3
**Date:** 2026-06-26  
**Project root:** `D:\Sunuwa\`  
**Dev server:** `http://localhost:3000` (Next.js, already running as node.exe PID 15000)  
**FastAPI backend:** `http://localhost:8000` (separate Python process)

---

## What We Are Building

**Sunuwa (सुनुवाइ)** is Nepal's first civic intelligence platform — a full-stack web app where Nepali citizens file complaints (road, water, electricity, health, etc.) and those complaints are automatically AI-classified, routed to the correct government body, publicly tracked, and auto-escalated if unresolved.

**Core value proposition:** A citizen types or speaks their problem in Nepali or English → AI classifies it → ward office gets it → if ignored it escalates automatically up to municipality → province → ministry → everything is publicly transparent.

---

## Tech Stack

### Frontend — `D:\Sunuwa\sunuwa\`
- **Next.js** (App Router) with `[locale]` dynamic routing
- **next-intl** for i18n — locales: `ne` (Nepali, primary) and `en`
- **React 19** with hooks
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Supabase** (`@supabase/supabase-js`) for database
- **Leaflet** + `react-leaflet` for maps
- **Lucide React** + **Radix UI** for some components
- **NO Framer Motion** (not installed — use pure CSS animations + IntersectionObserver)
- All redesigned pages use **inline React `style` objects** (not Tailwind classes)
- `Link` import: `import { Link } from '@/i18n/navigation'` — this auto-prefixes locale, so hrefs must be WITHOUT locale prefix (e.g. `href="/submit"` not `href="/ne/submit"`)

### Backend — `D:\Sunuwa\sunuwa-api\` (FastAPI / Python)
- **FastAPI** with CORS open to all
- **Groq API** (Llama 3.3 70B) for complaint classification
- **Gemini API** for embeddings/briefs
- **Supabase** (service role) for DB writes
- Routers: `classify`, `embed`, `cluster`, `brief`, `news`, `escalation`

### Database — Supabase
- URL: `https://edevounhaxtdqpgzngsp.supabase.co`
- Tables: `complaints`, `wards`, `ministries` (at minimum)
- Complaints have: `id`, `category_en`, `category_ne`, `severity` (1–10), `summary_ne`, `summary_en`, `status`, `escalation_level` (1–4), `ward_id`, `lat`, `lng`, `tracking_code`, `created_at`, `updated_at`, `embedding`

---

## Design System (CRITICAL — never deviate)

### Colors
```
DEEP        = '#060C18'   // near-black, hero backgrounds
NAVY / NAV  = '#0B3C6F'   // primary navy (also '#123A6B' on submit page)
GOV_BLUE    = '#0B3C6F'   // same as NAVY
DEEP_NAVY   = '#0B2D52'   // darker navy for hover states
CRIMSON     = '#C8102E'   // Nepal red, accent
SUCCESS     = '#1F8A4D'   // green for resolved/ok states
BACKGROUND  = '#FAFBFC'   // light page background (submit page)
```

### Fonts
```
Nepali text: 'Noto Sans Devanagari, sans-serif'
English/UI:  'system-ui, -apple-system, sans-serif'
Monospace:   'monospace' (tracking codes, numbers)
```

### Emojis
**BANNED.** Do not use any emoji anywhere. Replace with:
- Location pin: SVG path (map pin icon from Heroicons outline)
- Checkmark: SVG `<path d="M5 13l4 4L19 7"/>` or unicode ✓ (OK for small indicators)
- Category icons: colored `ab` abbreviation badges (e.g. `SR` for सडक, `KP` for खानेपानी)
- GPS: SVG crosshair/target
- All other emojis: remove or replace with SVG

### Category abbreviation badges (used everywhere instead of emoji)
```
Education      → ab:'SH'  color:'#2563EB'
Infrastructure → ab:'SR'  color:'#D97706'
Health         → ab:'SW'  color:'#059669'
Water          → ab:'KP'  color:'#0891B2'
Electricity    → ab:'BJ'  color:'#CA8A04'
Corruption     → ab:'BH'  color:'#DC2626'
Safety         → ab:'SU'  color:'#7C3AED'
Environment    → ab:'VA'  color:'#65A30D'
Other          → ab:'AN'  color:'#64748B'
```

---

## File Structure (important files)

```
D:\Sunuwa\sunuwa\src\
  app\
    [locale]\
      page.tsx          ← Landing page (FULLY redesigned, revolutionary dark theme)
      layout.tsx        ← next-intl provider wrapper
      submit\page.tsx   ← Complaint submission (FULLY redesigned)
      track\page.tsx    ← Complaint tracking by code (existing design)
      map\page.tsx      ← Interactive complaint map (existing design)
      trending\page.tsx ← Transparency/trending data (existing design)
      login\            ← Officer login
      minister\[slug]\  ← Minister dashboard
      ward\             ← Ward officer view
    api\
      complaints\route.ts        ← GET/POST complaints
      complaints\[id]\route.ts   ← GET single complaint
      classify\route.ts          ← Proxies to FastAPI classify
      transcribe\route.ts        ← Whisper voice transcription
      wards\route.ts             ← Ward list
      map\route.ts               ← Map data
      minister\route.ts          ← Minister API
      auth\route.ts              ← Authentication
  components\
    LocationPicker.tsx    ← Leaflet map component (dynamically imported, SSR:false)
    FullWardMap.tsx
    HeroSection.tsx
    MapComponent.tsx
    WardMapComponent.tsx
    WardMapLight.tsx
    ui\                   ← shadcn UI components

D:\Sunuwa\sunuwa-api\
  main.py               ← FastAPI app entrypoint
  routers\
    classify.py          ← Groq Llama 3.3 classification
    embed.py             ← Embeddings
    cluster.py           ← Complaint clustering
    brief.py             ← AI brief generation
    news.py              ← News feed
    escalation.py        ← Auto-escalation cron job
  services\
    cluster_service.py
```

---

## Page-by-Page Current Status

### `/ne` — Landing Page (`page.tsx`) ✅ FULLY REDESIGNED
**Dark revolutionary aesthetic.** All sections use inline styles.

**Key components in the file:**
- `Intro` — cinematic loading screen: black bg, Nepali characters emerge one-by-one, glow sweep, fade out. localStorage key: `sunuwa_intro_v2` (replays after 12h). Skippable by click.
- `VoiceCanvas` — animated particle network on `<canvas>` with connection lines. `dark` prop for dark bg variant.
- `CivicPulse` — live feed widget showing real-time complaint activity, AI insights, metrics, gov status. Auto-updates every 4.5s (feed) / 5s (insights) / 30s (clock).
- `ProvinceMap` — SVG Nepal map with 7 provinces, hover tooltip showing complaint stats.
- `useCounter(target, duration, active)` — count-up animation hook using requestAnimationFrame.
- `useReveal(threshold)` — IntersectionObserver scroll reveal hook.

**Sections in order:**
1. Navbar (sticky, transparent → dark glass on scroll)
2. Hero: `#060C18` dark bg, particle canvas, manifesto headline "नागरिकको आवाज, / सरकारसम्म।", CivicPulse widget on right
3. Crimson marquee band (scrolling text: नागरिकको आवाज · सरकारको सुनाइ · पारदर्शिता · जवाबदेहिता)
4. Why This Exists: dark `#080F1C`, storytelling + abstract SVG network diagram (citizen→AI→government)
5. Stats Counter: 4-column count-up on `#060C18`
6. How It Works: light `#F8FAFE`, 5-step horizontal timeline (text labels, no emoji)
7. Intelligence Map: dark `#0D1520`, ProvinceMap + data table + escalation bars + recent resolutions
8. Real Impact: light `#F8FAFE`, 3 before/after cards + 3 testimonials
9. Final CTA/Manifesto: dark `#060C18`, massive typography "जनताको भनाइ, / सरकारको सुनाइ।"
10. Footer: `#030810` with crimson top border

**CSS keyframes defined in `<style>` tag at bottom:**
- `pulse`, `ring`, `introShine`, `fadeSlideUp`, `scrollCue`, `marquee`

### `/ne/submit` — Submit Page (`submit/page.tsx`) ✅ FULLY REDESIGNED
**Light `#FAFBFC` background.** Two-screen flow.

**State machine:** `'write' | 'classify' | 'followup' | 'submitting' | 'success'`

**Screen 1 (write/classify steps):**
- Navbar (NAV `#123A6B` bg, red+blue flag strips, Devanagari सुनुवाइ logo)
- Horizontal progress bar below navbar
- Hero title "तपाईंको समस्या के हो?"
- Large textarea with rotating Nepali placeholder examples every 3s
- Bottom toolbar: voice recording button (SVG mic → animated waveform bars on record → spinner on transcribe) + char count
- Ward searchable dropdown (calls `/api/wards`)
- Quick chips row (Infrastructure/Electricity/Water/Health/Education/Environment — but currently unused/not rendered)
- Primary CTA: "AI विश्लेषण गर्नुहोस्" → calls FastAPI `/api/classify`

**Screen 2 (followup/submitting steps):**
- AI Analysis card (navy header, 2×2 grid: category/severity/location/authority + summary)
- Complaint text preview (left navy border)
- Multi-category selector grid (9 categories, checkboxes with SVG tick)
- Follow-up questions (from `FOLLOWUP` record, category-specific: text/select/textarea)
- LocationPicker map (optional exact location)
- Submission info card (authority / response time / tracking code info)
- "उजुरी दर्ता गर्नुहोस्" CTA → calls `/api/complaints`

**Success screen:** tracking code card with copy button, escalation journey timeline, "अर्को उजुरी" + "ट्र्याक गर्नुहोस्" buttons

**API calls:**
- `GET /api/wards` → ward list
- `POST http://localhost:8000/api/classify` (FastAPI) → `{category_en, category_ne, severity, summary_ne}`
- `POST /api/complaints` → `{text, ward_id, category_en, category_ne, severity, summary_ne, followup, lat, lng}`
- `POST /api/transcribe` (Whisper) → voice transcription

### `/ne/track` — Track Page ✅ EXISTING (not redesigned)
Search by tracking code → shows complaint status, escalation level, journey timeline, authority contacts. Has emoji icons (not yet cleaned up).

### `/ne/map` — Map Page ✅ EXISTING (not redesigned)
Full Leaflet map with ward markers, complaint heatmap, layer switcher (Problems/Progress/Trends/Community), time range selector, ward detail panel.

### `/ne/trending` — Transparency Page ✅ EXISTING (not redesigned)
Live complaint feed, trending by category, charts.

### `/ne/minister/[slug]` — Minister Dashboard ✅ EXISTING
Minister-specific complaint overview per ministry slug.

---

## Components

### `LocationPicker.tsx` ✅ FIXED (this session)
- Leaflet map (CartoDB Positron light tiles)
- Nominatim geocoding search (debounced 400ms)
- GPS button (SVG crosshair icon, no emoji)
- Draggable green pin marker (SVG in divIcon HTML string, no emoji)
- **Layout glitch fix:** `invalidateSize()` called at 100ms + 400ms after init, plus `ResizeObserver` on container
- Map container uses `position:absolute; inset:0` inside fixed-height wrapper
- All emojis replaced with SVG

---

## Routing Rules (CRITICAL)

The `Link` component from `@/i18n/navigation` **automatically prepends the current locale**.  
**ALWAYS write hrefs WITHOUT locale prefix:**

```
✅ href="/"           → renders as /ne
✅ href="/submit"     → renders as /ne/submit
✅ href="/track"      → renders as /ne/track
✅ href="/map"        → renders as /ne/map
✅ href="/trending"   → renders as /ne/trending
✅ href="/login"      → renders as /ne/login

❌ href="/ne/submit"  → renders as /ne/ne/submit  ← DOUBLE PREFIX BUG
```

This applies to ALL pages. If you see any `href="/ne/..."` in a `Link` component, it is a bug.  
Plain `<a href="...">` tags (like in the footer) are not affected.

---

## FastAPI Backend Details

**Base URL:** `http://localhost:8000`  
**Accessed by Next.js as:** `process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'`

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/classify` | Classify complaint text (Groq Llama 3.3) |
| POST | `/api/embed` | Generate embeddings |
| POST | `/api/run-clustering` | Cluster complaints |
| POST | `/api/generate-brief` | Generate minister brief |
| GET | `/api/fetch-news` | Fetch Nepal civic news |
| POST | `/api/run-escalation` | Trigger escalation cron |
| GET | `/api/escalation-status` | Escalation level counts |
| POST | `/api/process-complaint` | Background: classify + embed + update DB |

### Escalation SLA Rules
```
Health/Safety:      Ward: 2d  → Municipality: 4d  → Province: 8d
Electricity/Water:  Ward: 3d  → Municipality: 6d  → Province: 12d
Infrastructure etc: Ward: 7d  → Municipality: 14d → Province: 28d
Corruption:         Ward: 5d  → Municipality: 10d → Province: 20d
```

---

## Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://edevounhaxtdqpgzngsp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
GROQ_API_KEY=[groq key]
GEMINI_API_KEY=[gemini key]
FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN= (empty — not used)
```

---

## What Was Done This Session (Session 3)

### 1. Landing Page Complete Rewrite (`page.tsx`)
Rewrote from scratch with:
- Cinematic intro overlay (`Intro` component, `sunuwa_intro_v2` localStorage key, 12h replay delay)
- Particle network canvas (`VoiceCanvas`)
- Dark hero `#060C18` with manifesto headline at 88px
- Crimson scrolling marquee band
- All sections with scroll-reveal animations via `useReveal`
- ProvinceMap SVG with hover tooltip
- CivicPulse dark-styled live widget
- Count-up stats via `useCounter`

### 2. Routing Bug Fixed
All `Link href="/ne/..."` → `href="/..."` in both `page.tsx` and `submit/page.tsx`.

### 3. Emojis Removed
Replaced across all three files with SVG icons or category abbreviation badges.

### 4. Voice Input Improved (`submit/page.tsx`)
- `alert()` → `setError()` for mic permission error
- Waveform bars: `alignItems:'flex-end'` + `transformOrigin:'bottom'`

### 5. LocationPicker Layout Glitch Fixed
- `invalidateSize()` at 100ms + 400ms post-init
- `ResizeObserver` on map container
- Map container now `position:absolute; inset:0` inside fixed-height wrapper
- All emojis replaced with SVG

---

## Known Remaining Issues / What Still Needs Work

### Pages Not Yet Redesigned (use old design, have emojis)
- `/ne/track` — has emoji icons in `CAT_META` and `STAGES`
- `/ne/map` — functional, uses GOV_BLUE/CRIMSON correctly but old-style UI
- `/ne/trending` — functional, old-style UI
- `/ne/minister/[slug]` — functional, old-style UI
- `/ne/login` — unknown state
- `/ne/ward` — unknown state

### Things To Consider
- Track, Map, Trending pages should eventually get the same design language (dark headers, no emojis, category abbreviation badges instead of emoji icons)
- The `QUICK_CHIPS` in `submit/page.tsx` are defined but never rendered in JSX — either add a chip row UI or remove the constant
- `session-notes.md` and `session-notes-2.md` exist at `D:\Sunuwa\` as historical context

---

## How To Start Working Next Session

1. **Read this file first.**
2. The dev server is already running at `localhost:3000` (existing node.exe process, don't try to restart it)
3. FastAPI is at `localhost:8000`
4. To edit landing page: `D:\Sunuwa\sunuwa\src\app\[locale]\page.tsx`
5. To edit submit page: `D:\Sunuwa\sunuwa\src\app\[locale]\submit\page.tsx`
6. To edit location picker: `D:\Sunuwa\sunuwa\src\components\LocationPicker.tsx`
7. For routing: always use `href="/path"` not `href="/ne/path"` in `Link` from `@/i18n/navigation`
8. Never use emojis — use SVG or category ab-badges
9. All page styles are inline React `style` objects — do not switch to Tailwind classes
10. No Framer Motion — use CSS `@keyframes` + IntersectionObserver for animations
