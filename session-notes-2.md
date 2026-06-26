# SUNUWA SESSION NOTES — COMPLETE STATE AS OF 2026-06-26

This file is the canonical resume point after /clear or context loss.
Written exhaustively — nothing omitted.

---

## 1. PROJECT OVERVIEW

### What Sunuwa Is
Sunuwa (सुनुवाइ — "to be heard") is a Nepali civic complaint intelligence platform.
Citizens submit complaints about public services (roads, water, electricity, health, corruption, etc.)
via a web form. AI classifies the complaint, assigns severity, and routes it to the correct
government office. If the government doesn't act, complaints auto-escalate up the chain.
The platform is bilingual: Nepali (ne) primary, English secondary.

### Who It Serves
- Citizens: submit and track complaints
- Ward Officials: see complaints for their ward, take action
- Ministers: see escalated, critical issues across their ministry
- Admins: full system access

### Core Problem It Solves
Nepal has no unified digital complaint channel. Citizens don't know if their complaint reached anyone.
Sunuwa creates transparency, accountability, and an escalation chain that forces government response.

### Nepal Government Structure (3-tier)
1. वडा (Ward) — smallest unit, ~4,753 across Nepal. Handles local issues 0–3 days.
2. नगरपालिका (Municipality) — 284 municipalities. Takes over if ward ignores for 3–7 days.
3. प्रदेश (Province) — 7 provinces. Escalates if municipality ignores for 7–14 days.
4. संघीय मन्त्रालय (Federal Ministry) — takes over at 14+ days.

Escalation is time-based and automatic. The ward dashboard shows warnings when a complaint
is about to escalate ("⚠️ 2 दिनमा नगरपालिका तहमा जान्छ").

---

## 2. TECH STACK

### Framework
- Next.js 16.2.9 (App Router, not Pages Router)
- React 19.2.4
- TypeScript ^5
- Tailwind CSS v4 (with @tailwindcss/postcss)

### i18n
- next-intl ^4.13.0
- Locale segment: `[locale]` — routes are `/ne/...` and `/en/...`
- Navigation imports: `import { Link } from '@/i18n/navigation'`
- Router: `import { useRouter } from 'next/navigation'` (not next-intl router)
- Files: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`

### Database & Auth
- Supabase (@supabase/supabase-js ^2.108.2)
- `src/lib/supabase.ts` — browser client
- `src/lib/supabase-admin.ts` — server-side admin client (for API routes)
- `src/lib/auth.ts` — `signIn()`, `signOut()`, `getSessionAndRole()`
- Tables: `complaints`, `wards`, `clusters`, `ministries`, `user_roles`, `ward_stats`

### UI Libraries
- lucide-react ^1.21.0 — icons (used in some older components, being phased out)
- radix-ui ^1.6.0 — headless primitives
- shadcn ^4.11.0 — component library (card, button, badge, table, alert, tabs, input, textarea, select, label, separator)
- class-variance-authority ^0.7.1
- clsx ^2.1.1
- tailwind-merge ^3.6.0

### Maps
- leaflet ^1.9.4 + @types/leaflet ^1.9.21
- react-leaflet ^5.0.0
- Dynamic import in useEffect (NOT `dynamic()` from Next) for Leaflet on client pages
- CartoDB light_nolabels tiles: `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png`
- GeoJSON source: `https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-provinces.geojson`

### AI / External APIs
- Claude (Anthropic) — used server-side in `/api/generate-brief/[slug]` and `/api/classify`
- Whisper (OpenAI) — `/api/transcribe` — voice-to-text for complaint submission
- `/api/estimate-budget` — AI estimates repair cost for infrastructure complaints
- `/api/fetch-news` — scrapes/fetches relevant news for minister brief context
- `/api/generate-embeddings` + `/api/run-clustering` — vector embedding + K-means cluster complaints by similarity

### Python Scripts (in project root or scripts/)
- `brief.py` — generates minister situational brief, writes to Supabase. English content was broken (was outputting Nepali headers with English content mixed). Fixed to output purely English in content_en column and purely Nepali in content_ne.
- `escalation.py` — created this session. Runs escalation logic in Python (mirrors `src/lib/escalation.ts`). Updates `escalation_level` in Supabase for stale complaints.

---

## 3. DESIGN SYSTEM (COMPLETE)

### Primary Palette (used across all pages)
```
GOV_BLUE  = '#0B3C6F'   // Primary navy — navbar bg, primary buttons, section headers
CRIMSON   = '#C8102E'   // Nepal red — accent, critical badges, submit button, flag strip
DEEP_NAVY = '#0B2D52'   // Deeper navy — navbar border-bottom
LIGHT_BG  = '#F5F7FA'   // Page background on ward/minister/trending pages
MID_GRAY  = '#E8ECF0'   // Borders, dividers
DARK_TEXT = '#1A1A2E'   // Body text (landing page)
```

### Tracking Page Palette (slightly different spec, intentional)
```
NAV  = '#123A6B'   // Primary navy for tracking page (slightly lighter than GOV_BLUE)
DEEP = '#0B2D52'   // Navbar border-bottom
CRIM = '#C8102E'   // Crimson
GRN  = '#1F8A4D'   // Success green
AMB  = '#D97706'   // Warning amber
BDR  = '#E5E7EB'   // Border
TXT  = '#111827'   // Text
```

### Landing Page CivicPulseWidget Palette (new, this session)
```
#163B6D   // Navy header for the widget card
#F8FAFC   // Card background
#E2E8F0   // Border
#166534   // Success green (government activity dots)
#D97706   // Warning amber (ministries dot)
#4ADE80   // Live indicator green
```

### What NOT to Do (rejected approaches)
- #040D18 dark background — REJECTED. All pages are white/light bg.
- Inter font — NOT used. Font is `system-ui, -apple-system, sans-serif` inline.
- #16A34A green — sometimes present in older code, being standardized to #1F8A4D or #166534.
- #F8FAFC as page bg — only on tracking page. Other pages use #F5F7FA.
- Rounded-2xl cards — REJECTED. Cards use borderRadius 8–14px max, never 24px+.
- Glassmorphism / gradients — REJECTED.
- Bootstrap-style blue-600 buttons — REJECTED. Always use GOV_BLUE or NAV navy.
- Mukta font — NOT used. (Was mentioned in early notes from a different session.)
- #1B4332 dark green — NOT used (old remnant, fully removed).

### Fonts
- `Noto Sans Devanagari` — all Nepali text (सुनुवाइ logo, Nepali labels, Nepali body text)
- `system-ui, -apple-system, sans-serif` — all English UI text, body text
- `monospace` — tracking codes (e.g. KTM-7-3QP), time displays
- Inter — mentioned in trackingpage.md spec but NOT actually loaded via CSS import. system-ui renders close enough.

### Navbar Pattern (identical across ALL pages)
```tsx
<header style={{ background: '#0B3C6F', borderBottom: '2px solid #0B2D52', position: 'sticky', top: 0, zIndex: 50 }}>
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    {/* Logo: Nepal flag strips + "स" box + सुनुवाइ */}
    <Link href="/ne">
      <div style={{ display: 'flex' }}>
        <div style={{ width: 4, height: 28, background: '#C8102E' }} />          {/* red flag strip */}
        <div style={{ width: 4, height: 28, marginLeft: 2, background: '#003893' }} />  {/* blue flag strip */}
        <div style={{ width: 28, height: 28, marginLeft: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 12 }}>स</div>
      </div>
      <span style={{ fontFamily: 'Noto Sans Devanagari, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>सुनुवाइ</span>
    </Link>
    {/* Right links: Map | Track | + उजुरी दर्ता (red button) */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Link href="/ne/map" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Map</Link>
      <Link href="/ne/track" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Track</Link>
      <Link href="/ne/submit" style={{ fontSize: 12, fontWeight: 700, background: '#C8102E', color: '#fff', padding: '6px 14px', textDecoration: 'none' }}>
        + उजुरी दर्ता
      </Link>
    </div>
  </div>
</header>
```
NOTE: Ward and minister pages have slightly extended navbars with sign-out button on right.

### Section Panel Pattern (ward/minister pages)
```tsx
{/* Section header — GOV_BLUE bar */}
<div style={{ background: GOV_BLUE, padding: '10px 20px' }}>
  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>SECTION TITLE</span>
</div>
{/* Section body */}
<div style={{ background: '#fff', border: `1px solid ${MID_GRAY}` }}>
  {/* content */}
</div>
```
NO border-radius on these panels. Sharp corners only.

### Card Pattern (landing page, tracking page)
```
border: '1px solid #E2E8F0' or '1px solid #E5E7EB'
borderRadius: 12–14px
boxShadow: '0 2px 12px rgba(0,0,0,0.04)' or '0 4px 32px rgba(22,59,109,0.08)'
background: '#fff'
```

### Skill Files Location
- Frontend design: `C:\Users\Gaming F16\.claude\skills\frontend-design\SKILL.md`
- UI/UX Pro Max: `C:\Users\Gaming F16\.claude\skills\ui-ux-pro-max\SKILL.md`

---

## 4. EVERY FILE IN THE PROJECT

### App Pages
```
src/app/page.tsx
  — Root redirect (probably redirects to /ne)

src/app/layout.tsx
  — Root HTML layout, font imports

src/app/[locale]/layout.tsx
  — Locale layout, sets html lang attribute, wraps with next-intl provider

src/app/[locale]/page.tsx
  — Landing/home page (citizen-facing)
  — Navbar + Hero (headline + CivicPulseWidget) + Province SVG map + Stats + Features + CTA
  — CivicPulseWidget: intelligence card with Live Activity Feed, AI Insights, Trust Metrics, Gov Activity
  — WORKING (redesigned this session twice — first Leaflet map, then intelligence card)

src/app/[locale]/submit/page.tsx
  — Complaint submission form
  — Category select → follow-up questions (category-specific) → text/voice → location picker → submit
  — Uses /api/complaints POST, /api/transcribe, /api/classify, /api/estimate-budget
  — LocationPicker component for lat/lng
  — WORKING but multi-select for categories is single-select only (known gap)

src/app/[locale]/track/page.tsx
  — Complaint tracking page
  — Search by tracking code → fetch /api/complaints/[id] → show status
  — Design: navy navbar + hero + search bar + Status Overview Panel + Horizontal Progress Tracker + Case Journey + Official Status Message + Citizen Confidence Panel
  — REDESIGNED THIS SESSION per trackingpage.md
  — KNOWN ISSUE: complaint.id can be undefined if API returns no id field (see section 5)

src/app/[locale]/login/page.tsx
  — Login page for ward officials and ministers
  — Left panel: GOV_BLUE with Nepal map SVG watermark + trust badges
  — Right panel: email/password form
  — On success: fetches role from /api/auth/role → redirects to /ne/minister/[slug] or /ne/ward/[id]
  — WORKING

src/app/[locale]/trending/page.tsx
  — Public trending page (citizen-facing)
  — Shows live complaint feed + category bar chart + province activity
  — Uses GOV_BLUE palette
  — WORKING (was the reference page used to extract correct design system)

src/app/[locale]/map/page.tsx
  — Public Nepal live problem map (citizen-facing)
  — Left insight panel (288px) + Leaflet map (full width)
  — 4 map layers: problems, progress, trends, community
  — Time controls at bottom: 24h / 7d / 30d / 6m / 1y
  — Ward click: sidebar transforms to ward detail
  — REDESIGNED THIS SESSION per maps.md
  — WORKING (Leaflet, dynamic import)

src/app/[locale]/ward/[id]/page.tsx
  — Ward dashboard (ward official view, auth required)
  — Shows ward complaints list with SLA badges, escalation warnings, category breakdown
  — Uses computeEscalation() from lib/escalation.ts
  — Uses WardMap (dynamic import from WardMapLight)
  — GOV_BLUE palette, sharp corners
  — WORKING

src/app/[locale]/ward/[id]/map/page.tsx
  — Ward map sub-page (ward boundary + complaint pins)
  — PARTIALLY DONE — ward boundary GeoJSON overlay not implemented

src/app/[locale]/minister/[slug]/page.tsx
  — Minister dashboard (minister/admin auth required, not ward)
  — Auth: getSessionAndRole() → redirect ward users
  — KPI strip: 5 columns (Active Escalated, Critical Cases, Resolution Rate, Municipalities, SLA Violations)
  — Main layout: lg:grid-cols-[1fr_320px]
  — AI Situation Brief: parseBrief() → 6 sections in grid-cols-2, critical sections get crimson left-border
  — Escalation Flow: EscStage components (Ward → Municipality → Province → Ministry)
  — Issue Clusters: grid-cols-3 with severity bar
  — Right sidebar: Decision Support, Ministry Pipeline, escalated complaints list
  — GOV_BLUE palette, LIGHT_BG page background
  — WORKING (redesigned this session)
```

### API Routes
```
src/app/api/complaints/route.ts
  — POST: create new complaint (called from submit page)
  — GET: list complaints (with filters)

src/app/api/complaints/[id]/route.ts
  — GET: fetch single complaint by id OR tracking_code
  — Used by track page: /api/complaints/${id}
  — KNOWN ISSUE: if tracking_code lookup returns multiple rows, may return wrong shape

src/app/api/complaints/[id]/upvote/route.ts
  — POST: increment upvote count on a complaint

src/app/api/wards/route.ts
  — GET: list all wards

src/app/api/wards/[id]/route.ts
  — GET: fetch ward by id with complaints and stats

src/app/api/minister/[slug]/route.ts
  — GET: fetch minister dashboard data (escalated complaints, clusters, brief, stats)
  — Joins ministries → clusters → complaints tables
  — Returns: { ministry, complaints, clusters, brief, stats }

src/app/api/map/route.ts
  — GET: fetch ward-level complaint density for map page

src/app/api/classify/route.ts
  — POST: calls Claude to classify a complaint text into category + severity

src/app/api/auth/role/route.ts
  — POST: { user_id } → returns role row from user_roles table
  — Used by login page after Supabase auth

src/app/api/estimate-budget/route.ts
  — POST: calls Claude to estimate repair budget for infrastructure complaint

src/app/api/transcribe/route.ts
  — POST: sends audio blob to OpenAI Whisper, returns transcript

src/app/api/generate-embeddings/route.ts
  — POST: generates vector embeddings for complaints (for clustering)

src/app/api/run-clustering/route.ts
  — POST: runs K-means clustering on complaint embeddings, writes to clusters table

src/app/api/generate-brief/[slug]/route.ts
  — POST: generates AI situational brief for minister [slug], stores in Supabase

src/app/api/fetch-news/route.ts
  — GET: fetches relevant Nepali news for minister brief context
```

### Library Files
```
src/lib/auth.ts
  — signIn(email, password): Promise<{user: UserRole | null, error: string | null}>
  — signOut(): void
  — getSessionAndRole(): Promise<{user: UserRole | null}>
  — UserRole type: { role: 'ward' | 'ward_official' | 'minister' | 'admin', ward_id?: number, ministry_slug?: string }

src/lib/supabase.ts
  — Browser-side Supabase client (uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)

src/lib/supabase-admin.ts
  — Server-side admin client (uses SUPABASE_SERVICE_ROLE_KEY, for API routes only)

src/lib/escalation.ts
  — computeEscalation(createdAt, status, storedLevel?): EscalationInfo
  — Thresholds: 0d=Ward, 3d=Municipality, 7d=Province, 14d=Ministry
  — CATEGORY_TO_MINISTRY mapping: e.g. Health→'health', Infrastructure→'infrastructure'
  — escalationBorder(level): Tailwind border class

src/lib/utils.ts
  — Standard shadcn cn() utility
```

### Components
```
src/components/LocationPicker.tsx
  — Leaflet map click to pick lat/lng for submit form
  — Dynamic import (client-only)

src/components/WardMapLight.tsx
  — Leaflet map for ward dashboard (lighter version)
  — Dynamic import

src/components/WardMapComponent.tsx
  — Alternative ward map component

src/components/FullWardMap.tsx
  — Full ward map with boundaries

src/components/MapComponent.tsx
  — Generic map component

src/components/HeroSection.tsx
  — Legacy hero (may be unused now)

src/components/ui/
  — button.tsx, badge.tsx, card.tsx, table.tsx, alert.tsx, tabs.tsx
  — input.tsx, textarea.tsx, select.tsx, label.tsx, separator.tsx
  — All shadcn-generated components (mostly unused in redesigned pages which use inline styles)
```

### Config / i18n
```
src/i18n/routing.ts     — defineRouting({ locales: ['ne', 'en'], defaultLocale: 'ne' })
src/i18n/request.ts     — getRequestConfig for next-intl
src/i18n/navigation.ts  — exports Link, redirect, useRouter etc from next-intl/navigation
```

---

## 5. WHAT WAS FIXED THIS SESSION

### Design system applied to minister page
- First attempt: dark #040D18 theme. REJECTED by user.
- Read trending/page.tsx to extract exact colors, navbar pattern.
- Full rewrite using GOV_BLUE #0B3C6F, white bg, LIGHT_BG, MID_GRAY, sharp corners.
- Result: matches all other pages.

### Map page redesigned (maps.md spec)
- Left insight panel (288px): Nepal Today stats, Trending Problems with sparklines, Areas Improving/Requiring Attention, Government Impact feed.
- Leaflet map with layer switcher (4 layers) and time controls.
- Ward click transforms sidebar.

### Landing page CivicPulseWidget — Iteration 1 (Leaflet map)
- Removed SVG-based ProvinceMap heatmap from hero.
- Added real Leaflet map with density blobs (L.circle), city hotspot labels (L.divIcon), CartoDB tiles.
- Province GeoJSON overlay via fetch (fail-silent).
- Feed panel with auto-updating items.

### Landing page CivicPulseWidget — Iteration 2 (intelligence card, THIS SESSION)
- User rejected Leaflet map in hero: "do not show a miniature map, heatmap, chart, graph..."
- Removed entire Leaflet map. Removed import 'leaflet/dist/leaflet.css'.
- Replaced with 4-section intelligence card:
  * Live Activity Feed (scrollable, auto-updates every 5s)
  * AI Insight (rotates 4 summaries every 6s)
  * Trust Metrics (2×2 grid: 18,420 total / 15,830 resolved / 86% rate / 3.2d avg)
  * Government Activity (4 status rows with green/amber dots)
- Navy #163B6D header, #F8FAFC background, 2-col grid body.

### Tracking page redesigned (trackingpage.md spec)
- Removed narrow max-w-md card layout.
- Added correct navbar (same as all other pages).
- Max-width 1100px container, #FAFBFC background.
- Hero: Devanagari title + tracking ID badge.
- Search bar: full-width with navy #123A6B button (not blue-600).
- Status Overview Panel: 3×2 grid (Category, Severity, Owner / Filed, ETA, Stage).
- Horizontal Progress Tracker: Ward→Municipality→Province→Ministry with connector line, green fill.
- Case Journey: vertical timeline with dots.
- Official Status Message: left-bordered panel.
- Citizen Confidence Panel: checklist + SLA.

### Rust panic fix
- Box-drawing chars (═══) in JSX comments caused Next.js Rust code frame to panic at char boundary.
- Fixed with replace_all Edit replacing ══ with ==.

### MAP_DOTS is not defined fix
- Deleted HEAT_BLOBS/HOTSPOTS/MAP_DOTS constants but left MAP_DOTS.map() in ProvinceMap.
- Fixed by removing the MAP_DOTS.map() JSX block from ProvinceMap.

### TypeScript fixes for Leaflet
- L.LeafletMouseEvent not available as import. Used eslint-disable + any typing.
- GeoJSON.FeatureCollection not available without import. Used any typing.

### brief.py English content
- Was outputting mixed content. Fixed to output clean English in content_en.

### escalation.py created
- New Python script mirroring lib/escalation.ts logic.
- Updates escalation_level in Supabase for stale complaints.

### Schema migration (4 columns added — from prior session notes)
- complaints table: added tracking_code, days_old, officer_notes, referred_to
- These are now used by track/page.tsx and ward/page.tsx

---

## 6. WHAT IS STILL BROKEN

### Tracking page — complaint.id possibly undefined
- Line: `const trackCode = complaint?.tracking_code || complaint?.id?.slice(0, 13)?.toUpperCase() || ''`
- If the API returns the complaint without an `id` field (shape mismatch), trackCode is empty string.
- More critically: `complaint?.id?.slice(0, 13)` — if id is a UUID, `slice(0,13)` gives a partial UUID, not a friendly code.
- Real fix: ensure tracking_code is always set when complaint is created, and /api/complaints/[id] always returns it.

### Login redirect fallback
- If a ward user has no ward_id in their role row (data error), they redirect to `/ne` (landing page).
- Should redirect to a proper error page or show a message.
- Current code: `else router.push('/ne')`

### Minister page — brief loading
- parseBrief() will silently show empty sections if the brief format from Claude doesn't match expected section headers exactly.
- No error state if /api/minister/[slug] returns an empty brief.

### Ward map page
- `src/app/[locale]/ward/[id]/map/page.tsx` — ward boundary GeoJSON overlay not implemented.
- Just shows a map without the ward's actual boundary polygon.

### Complaint ID vs tracking_code confusion in API
- `/api/complaints/[id]` — the `[id]` param is used for both UUID lookup and tracking_code lookup.
- If a citizen enters a tracking code like "KTM-7-3QP", the route needs to detect whether it's a UUID or a code and query appropriately.
- This may not be implemented — needs verification.

---

## 7. WHAT IS NOT BUILT YET

### Ward boundary GeoJSON overlay
- The ward map page exists but has no boundary polygon for the specific ward.
- Need to either store boundary data in Supabase or fetch from a public Nepal GeoJSON source.

### Multi-select for complaint categories
- Submit page has a single category dropdown.
- The spec intended multi-select (a complaint can belong to multiple categories).
- Not implemented.

### Voice complaint on mobile
- Transcribe API exists. Submit page has a ref for audio recording.
- Need to verify the full record → transcribe → populate-text flow works end to end on mobile.

### Success Stories layer on map
- maps.md specified a "Success Stories" layer showing 🟢 resolved markers with before/after photos.
- Only 4 layers implemented: problems, progress, trends, community.
- Success Stories not built.

### Community Pulse score on map
- maps.md specified a per-municipality pulse score (82% ↑ Improving, 41% ↓ Declining).
- Not displayed on map.

### Time Travel / timeline slider on map
- maps.md specified a bottom slider for 24h/7d/30d/6m/1y with animated map changes.
- Time buttons exist in the UI but don't actually change the map data (static mock data).

### Province-level GeoJSON interaction
- maps.md: hover province → show tooltip with complaints/rate/top issue.
- Current implementation: fetches GeoJSON and adds it with hover opacity change.
- But the tooltip data (complaint counts per province) is not wired up from the API.

### Complaint upvote UX on public pages
- The upvote API exists but no UI on the public-facing pages for citizens to upvote.

### Admin panel
- No admin panel built. Admins use Supabase dashboard directly.

---

## 8. FRONTEND PLAN (DETAILED)

### Landing Page (`/ne`)
Current state: WORKING but CivicPulseWidget was rebuilt twice this session.
Structure:
1. Navbar (sticky, GOV_BLUE)
2. Hero: left column = headline + subtitle + two CTA buttons. Right column = CivicPulseWidget.
3. ProvinceMap: SVG-based interactive Nepal province map with hover tooltip.
4. Stats row: count-up numbers (18,420 complaints / 15,830 resolved / 77% / 4 provinces).
5. Feature cards section.
6. Final CTA banner.

CivicPulseWidget (current, as of this session):
- Header bar: #163B6D, "Nepal Civic Pulse" + live dot + clock
- 2-column grid body:
  * Left: Live Activity Feed (6 items, auto-update every 5s)
  * Right: AI Insight card (rotates every 6s) + Trust Metrics 2×2 + Government Activity 4 rows
- No map, no heatmap, no charts

### Submit Page (`/ne/submit`)
Current state: WORKING
Flow: Category select → follow-up questions (dynamic, per-category) → text area / voice → location picker → submit.
Submit calls:
  - /api/complaints POST with { ward_id, text, category_en, category_ne, severity, lat, lng, followup_data }
  - /api/classify (optional pre-fill)
  - /api/transcribe (voice)
  - /api/estimate-budget (infrastructure only)
Gap: single-select only, no multi-category.

### Ward Dashboard (`/ne/ward/[id]`)
Current state: WORKING
Auth: getSessionAndRole() — redirects non-ward users.
Shows: ward name + municipality, stats row, complaint list with SLA badges, category breakdown.
Uses: computeEscalation() for time-based escalation display.
Gap: WardMap component shows generic Nepal map, not ward-specific boundary.

### Ward Map Sub-page (`/ne/ward/[id]/map`)
Current state: PARTIALLY DONE
Shows Leaflet map with complaint pins from the ward.
Gap: no ward boundary polygon overlay.

### Minister Page (`/ne/minister/[slug]`)
Current state: WORKING after redesign this session.
Auth: getSessionAndRole() — ward users redirected.
Slug examples: 'health', 'infrastructure', 'education', 'energy-water', 'home-affairs', 'environment', 'ciaa'.
Layout:
- Sticky navbar with "RESTRICTED" badge in title bar
- KPI strip: 5 columns
- Main: lg:grid-cols-[1fr_320px]
  * Left: AI Situation Brief (parseBrief → 6 sections) + Escalation Flow + Issue Clusters
  * Right sidebar: Decision Support + Ministry Pipeline + escalated complaints list
Colors: GOV_BLUE, CRIMSON, LIGHT_BG, MID_GRAY, sharp corners, no border-radius on section panels.

### Trending Page (`/ne/trending`)
Current state: WORKING
Shows: live complaint feed, category breakdowns, time filters.
This page was the reference page for extracting the correct design system.

### Map Page (`/ne/map`)
Current state: WORKING after redesign this session.
Citizen-facing. Left panel (288px) + Leaflet map.
4 layer buttons: Problems / Progress / Trends / Community.
Time buttons: 24h / 7d / 30d / 6m / 1y (UI only, data not filtered yet).
Ward click: sidebar transforms.

### Tracking Page (`/ne/track`)
Current state: REDESIGNED this session, see section 5.
Search by tracking code → Status Overview → Progress Tracker → Case Journey → Official Status → Confidence Panel.
Known issue: id/tracking_code confusion.

---

## 9. NEXT STEPS IN PRIORITY ORDER

1. **Fix tracking page complaint.id bug** — ensure /api/complaints/[id] handles both UUID and tracking_code lookups and always returns id + tracking_code fields.

2. **Demo end-to-end test** — submit a complaint → get tracking code → track it → verify all panels show real data.

3. **Wire map time controls to real data** — the 24h/7d/30d/6m/1y buttons in map/page.tsx need to filter the API call and re-render markers.

4. **Province GeoJSON tooltip with real data** — hover a province and show actual complaint counts from the API, not hardcoded.

5. **Ward boundary overlay** — add the ward's polygon to /ne/ward/[id]/map.

6. **Multi-select complaint categories** — upgrade submit form.

7. **Success Stories layer** — map layer showing resolved complaints with before/after.

8. **Community Pulse scores on map** — per-ward pulse score visible on map.

9. **Admin panel (basic)** — at minimum a /ne/admin page listing all complaints with status management.

10. **Voice recording full-flow verification** — test on mobile.

---

## 10. API KEYS AND FALLBACKS

### Environment Variables (in .env.local or Supabase dashboard)
```
NEXT_PUBLIC_SUPABASE_URL         — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    — Supabase anon key (browser)
SUPABASE_SERVICE_ROLE_KEY        — Supabase service role (server/API routes only)
ANTHROPIC_API_KEY                — Claude API for classify, generate-brief, estimate-budget
OPENAI_API_KEY                   — Whisper transcription
```

### Fallbacks
- /api/classify: if Claude fails, falls back to "Other" category with severity 5
- /api/generate-brief: if Claude fails, brief shows empty or last cached brief from Supabase
- /api/transcribe: if Whisper fails, citizen must type manually
- /api/estimate-budget: if Claude fails, no estimate shown (UI hides that field)
- Province GeoJSON (maps.md): fetched from GitHub, fails silently — map still shows tiles
- CartoDB tiles: if CDN fails, map shows blank. No fallback tile server configured.

---

## 11. DEMO FLOW (EXACT STEPS)

The hackathon demo should show this journey:

1. **Open landing page** `/ne`
   - Show: Nepal Civic Pulse widget (live feed updating, AI insight rotating, metrics)
   - Point out: bilingual UI, government-grade design

2. **Province map hover**
   - Hover a province on the SVG map
   - Show tooltip: complaint count, resolution rate, top issue

3. **Submit a complaint** `/ne/submit`
   - Select category: Infrastructure (road problem)
   - Fill follow-up: सडकको नाम, problem type (खाल्डो/खाडल), duration, impact
   - Type or voice-record description
   - Drop a location pin on the map
   - Submit → get tracking code displayed

4. **Track the complaint** `/ne/track`
   - Enter the tracking code just received
   - Show: Status Overview Panel (category, severity, owner, filed date)
   - Show: Progress Tracker (Ward highlighted as current)
   - Show: Case Journey (submitted → AI classified → assigned)
   - Show: Citizen Confidence Panel (received ✓, assigned ✓, investigation started ✓)

5. **Live Problem Map** `/ne/map`
   - Show: Nepal-wide heatmap (problems layer)
   - Click a ward hotspot → sidebar shows ward detail
   - Switch to Progress layer → show green improvement zones
   - Point out: time controls, layer switcher

6. **Ward Dashboard** `/ne/ward/[id]`
   - Log in as ward official (demo account)
   - Show: complaint just submitted, SLA badge, escalation warning
   - Show: category breakdown

7. **Minister Dashboard** `/ne/minister/health`
   - Log in as health minister (demo account)
   - Show: KPI strip (critical cases, resolution rate)
   - Show: AI Situation Brief (6 sections with Nepali content)
   - Show: Escalation Flow (bottleneck highlighted)
   - Show: Decision Support with CRITICAL/HIGH badges

---

## 12. KNOWN SHARP EDGES FOR DEMO

- If no complaints exist in DB for the demo ward, ward dashboard will be empty. Pre-seed test data.
- The tracking code format "KTM-7-3QP" is a display convenience — actual lookup may use UUID internally. Verify this works before demo.
- Minister brief generation takes ~10 seconds (Claude API). Run it before the demo and cache the result.
- Map page: if the ward API returns no data, the sidebar will show zeros. Pre-seed ward data.
- Voice transcription requires microphone permission. Test on demo device in advance.
- Leaflet on map/page.tsx requires client-side hydration. The map won't show on SSR/pre-render. This is expected behavior, not a bug.

---

## 13. FILE PATHS QUICK REFERENCE

```
D:\Sunuwa\sunuwa\                         — project root
D:\Sunuwa\sunuwa\package.json
D:\Sunuwa\sunuwa\src\app\[locale]\page.tsx            — landing page
D:\Sunuwa\sunuwa\src\app\[locale]\submit\page.tsx     — submit form
D:\Sunuwa\sunuwa\src\app\[locale]\track\page.tsx      — tracking page
D:\Sunuwa\sunuwa\src\app\[locale]\login\page.tsx      — login
D:\Sunuwa\sunuwa\src\app\[locale]\trending\page.tsx   — trending (reference design)
D:\Sunuwa\sunuwa\src\app\[locale]\map\page.tsx        — public map
D:\Sunuwa\sunuwa\src\app\[locale]\ward\[id]\page.tsx  — ward dashboard
D:\Sunuwa\sunuwa\src\app\[locale]\minister\[slug]\page.tsx — minister dashboard
D:\Sunuwa\sunuwa\src\lib\auth.ts
D:\Sunuwa\sunuwa\src\lib\supabase.ts
D:\Sunuwa\sunuwa\src\lib\supabase-admin.ts
D:\Sunuwa\sunuwa\src\lib\escalation.ts
D:\Sunuwa\sunuwa\src\i18n\routing.ts
D:\Sunuwa\sunuwa\src\i18n\navigation.ts
C:\Users\Gaming F16\.claude\skills\frontend-design\SKILL.md
C:\Users\Gaming F16\.claude\skills\ui-ux-pro-max\SKILL.md
C:\Users\Gaming F16\.claude\projects\D--Sunuwa\memory\   — memory directory
D:\Sunuwa\session-notes-2.md              — THIS FILE
```

---

## 14. COMPONENT IMPORT CONVENTIONS

```tsx
// Navigation (always use next-intl Link, not next/link)
import { Link } from '@/i18n/navigation'

// Leaflet (always dynamic, never static import at module level)
// In useEffect:
import('leaflet').then(L => { ... })

// Dynamic components
const WardMap = dynamic(() => import('@/components/WardMapLight'), { ssr: false })

// Auth
import { getSessionAndRole, signOut } from '@/lib/auth'

// Supabase (client)
import { supabase } from '@/lib/supabase'

// Escalation
import { computeEscalation, CATEGORY_TO_MINISTRY } from '@/lib/escalation'
```

---

End of session-notes-2.md
