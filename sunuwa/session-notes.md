# Sunuwa Session Notes
_Last updated: 2026-06-25_

---

## 1. Known Files

### App Pages
- `src/app/[locale]/page.tsx` — Landing page (REDESIGNED ✓)
- `src/app/[locale]/trending/page.tsx` — Trending / Intelligence Dashboard (REDESIGNED ✓)
- `src/app/[locale]/login/page.tsx` — Login (REDESIGNED ✓)
- `src/app/[locale]/ward/[id]/page.tsx` — Ward Civic Intelligence Command Center (REDESIGNED ✓)
- `src/app/[locale]/minister/[slug]/page.tsx` — Minister page (REDESIGN IN PROGRESS ✗)
- `src/app/[locale]/map/page.tsx` — Public map page (unknown state)
- `src/app/[locale]/layout.tsx` — Root layout with next-intl
- `src/app/api/minister/[slug]/route.ts` — Minister data API
- `src/app/api/generate-brief/[slug]/route.ts` — Gemini brief generation
- `src/app/api/generate-embeddings/route.ts` — Embedding generation
- `src/app/api/run-clustering/route.ts` — pgvector clustering
- `src/app/api/auth/role/route.ts` — Role-based redirect after Supabase auth

### Components
- `src/components/WardMapLight.tsx` — Multi-level Leaflet map (REDESIGNED ✓)

### Config / Lib
- `src/lib/auth.ts` — `getSessionAndRole()`, `signOut()` helpers
- `src/i18n/navigation.ts` — next-intl `Link`, `useRouter`, etc.
- `.env.local` — Supabase keys, Gemini key; needs `NEXT_PUBLIC_APP_URL=http://localhost:3000`

---

## 2. What Is Working

- Landing page `/ne` — Government institutional design, province SVG map, animated stats, trust table
- Trending page `/ne/trending` — Intelligence Dashboard with sparklines, HBar charts, AI insights
- Login page `/ne/login` — Split layout, gov-blue trust panel, Supabase auth flow intact
- Ward page `/ne/ward/[id]` — Command center layout, KPI strip, 3-mode left panel (overview/category/back), slide-in inspector (360px), 5-step timeline, officer action controls
- WardMapLight.tsx — 5-layer intelligence map: heatmap, clusters, pins, critical zones (pulsing rings), resolution; zoom-responsive; cluster analysis floating panel; `buildClusters()` spatial grid
- Auth flow — Supabase signIn → `/api/auth/role` → role-based redirect (ward/minister)

---

## 3. What Is Broken / Incomplete

- **Minister page** — The redesign was started but NOT saved. The file still contains the old code (generic complaint cards, basic stats grid). The new code was written but the Write tool failed because the session compaction reset the file-read tracking state. The file must be read first and then overwritten.
- **`.env.local`** — Missing `NEXT_PUBLIC_APP_URL=http://localhost:3000` (may cause issues with certain API routes)
- **SQL not confirmed run:**
  ```sql
  ALTER TABLE complaints ADD COLUMN IF NOT EXISTS confirmations_count INTEGER DEFAULT 0;
  CREATE UNIQUE INDEX IF NOT EXISTS news_items_url_idx ON news_items (url);
  ```
- **news_items table** — Planned for RSS scraping (Onlinekhabar/Setopati) to enrich minister brief. Not built.
- **pgvector clustering** — Schema exists but semantic clustering job (cosine grouping) was never built. The `/api/run-clustering` route may be a stub.

---

## 4. What Was Just Being Attempted

**Redesigning `src/app/[locale]/minister/[slug]/page.tsx`** as a National Government Situation Room per `minister.md` spec.

The full replacement code was written (approx 400 lines) but failed to save due to session compaction resetting the Read-tracking state (both Write and Edit require a prior Read in the same session context window).

### The new design includes:
- **Dark gov-blue command bar** with live timestamp and LIVE indicator
- **Ministry title bar** (dark `#0D2E54`) with RESTRICTED ACCESS badge
- **Executive KPI Strip** (5 columns, no cards): Active Escalated Cases, Critical Cases, Resolution Rate, Municipalities Requiring Attention, SLA Violations — each with `Trend` badge and optional `MiniSpark`
- **AI Situation Brief** (large structured panel, left ~65% width): 6 sections rendered from parsed brief content — Current Situation / Emerging Risks / Affected Areas / Root Cause Analysis / Recommended Actions / Predicted Escalations. Two-column layout per section (label column + content column). Critical sections highlighted crimson.
- **Decision Support** (right ~35% width): 4 AI-generated action recommendations with urgency color coding (critical/high/medium)
- **Ministry Pipeline** sidebar card: avg severity, cluster count, total complaints
- **Escalation Intelligence Flow** (full-width): `EscStage` components for Ward → Municipality → Province → Ministry, each showing case count, resolution rate, avg delay, bottleneck indicator
- **Issue Clusters grid** (3-col): topic-grouped, severity bar, trend badge, affected area, NOT raw complaint cards
- **Helper components**: `Trend`, `MiniSpark`, `EscStage`, `parseBrief`
- Auth logic preserved verbatim (same `getSessionAndRole`, `signOut`, redirect logic)

---

## 5. Exact Next Steps (Priority Order)

### IMMEDIATE — Minister page (blocked, must do first)
1. `Read` `src/app/[locale]/minister/[slug]/page.tsx` (even just 1 line) to register it in session
2. `Write` the full new minister page code (the code exists in prior session, reconstruct from the design above)
3. Verify dev server on port 3000 picks up the change

### HIGH
4. Add `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env.local`
5. Run the two SQL statements in Supabase SQL editor:
   ```sql
   ALTER TABLE complaints ADD COLUMN IF NOT EXISTS confirmations_count INTEGER DEFAULT 0;
   CREATE UNIQUE INDEX IF NOT EXISTS news_items_url_idx ON news_items (url);
   ```

### MEDIUM
6. Verify ward page `/ne/ward/1` renders without TypeScript errors (the `as any` casts on WardMap props were the fix)
7. Check `/ne/trending` renders correctly with real data

### LOW
8. Build `news_items` RSS scraper (Onlinekhabar/Setopati) to enrich minister brief context
9. Verify pgvector clustering pipeline actually works end-to-end

---

## Design System (All Pages)

```
GOV_BLUE  = '#0B3C6F'
CRIMSON   = '#C8102E'
LIGHT_BG  = '#F5F7FA'
MID_GRAY  = '#E8ECF0'
Font      = Noto Sans Devanagari (Nepali), system-ui (English)
No rounded cards. No glassmorphism. No gradient backgrounds.
Severity colors: #C8102E (≥8 critical), #F97316 (≥6 high), #EAB308 (≥4 med), #22C55E (low)
```
