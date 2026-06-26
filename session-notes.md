# Sunuwa — Session Notes
Last updated: 2026-06-25

---

## Files Read This Session

| File | Why |
|------|-----|
| `sunuwa-api/main.py` | Checked registered routers before adding escalation |
| `sunuwa-api/routers/brief.py` | Fixed English brief being always null |
| `sunuwa-api/supabase/schema.sql` | Verified missing columns, added migration block |
| `sunuwa/src/app/globals.css` | Rewrote — removed shadcn imports |
| `sunuwa/src/app/layout.tsx` | Replaced Inter with Mukta font |
| `sunuwa/src/app/[locale]/page.tsx` | Design system pass — home page |
| `sunuwa/src/app/[locale]/submit/page.tsx` | Design system + multi-category feature |
| `sunuwa/src/app/[locale]/track/page.tsx` | Fix crash on line 182 |
| `sunuwa/src/app/[locale]/login/page.tsx` | Fix redirect + demo password |
| `sunuwa/src/app/[locale]/trending/page.tsx` | Design system pass |
| `sunuwa/src/app/[locale]/ward/[id]/page.tsx` | Design system pass, read full layout |
| `sunuwa/src/app/[locale]/minister/[slug]/page.tsx` | Design system pass |
| `sunuwa/src/components/WardMapLight.tsx` | Read full file — rewrote boundary fetch |

---

## Files Created This Session

| File | What it does |
|------|-------------|
| `sunuwa-api/routers/escalation.py` | Auto-escalation SLA job. `POST /api/run-escalation` triggers background scan of all non-resolved complaints, escalates those past SLA deadline. `GET /api/escalation-status` returns counts by level. SLA table: Health/Safety 2d, Electricity 3d, Water 3d, Corruption 5d, Infrastructure/Education/Environment 7d — doubles at each escalation level. |
| `session-notes.md` | This file |

---

## Files Changed This Session

### `sunuwa-api/routers/escalation.py` — CREATED
New file. Registers two endpoints on the escalation router:
- `POST /api/run-escalation` — triggers background SLA check
- `GET /api/escalation-status` — returns ward/municipality/province/ministry complaint counts

### `sunuwa-api/main.py` — MODIFIED
Added `from routers import ... escalation` and `app.include_router(escalation.router, prefix="/api")`.

### `sunuwa-api/routers/brief.py` — MODIFIED
Was: only generating Nepali brief, `content_en` always saved as `None`.
Now: two separate Gemini calls — `prompt_ne` and `prompt_en`. Both saved to DB. Fallback strings exist for both languages if Gemini is down.

### `sunuwa-api/supabase/schema.sql` — MODIFIED
Added 4 missing columns to `complaints` CREATE TABLE:
- `tracking_code TEXT`
- `followup_data JSONB`
- `officer_notes TEXT[] DEFAULT '{}'`
- `referred_to TEXT`

Added Step 6 migration block (safe to run on existing DB):
```sql
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS followup_data JSONB;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS officer_notes TEXT[] DEFAULT '{}';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS referred_to TEXT;
CREATE INDEX IF NOT EXISTS complaints_tracking_idx ON complaints (tracking_code) WHERE tracking_code IS NOT NULL;
```

### `sunuwa/src/app/globals.css` — REWRITTEN
Removed all shadcn/tw-animate-css imports and oklch color variables. Now contains only:
- Tailwind import
- Sunuwa CSS design tokens (`--s-green`, `--s-bg`, `--s-saffron`, etc.)
- Mukta font on `html`, warm background on `body`
- Leaflet baseline rule

### `sunuwa/src/app/layout.tsx` — MODIFIED
Replaced Google Fonts link from Inter to Mukta + Noto Sans Devanagari. Removed inline body styles.

### `sunuwa/src/app/[locale]/page.tsx` — MODIFIED
Design system pass:
- `#16A34A` → `#1B4332` (all instances)
- `#15803D` → `#143728`
- `bg-white` main → `bg-[#F5F0E8]`
- Navbar background → `bg-[#F5F0E8]/95`
- Section backgrounds → `bg-[#EDE8DF]`
- Border colors → `border-[#DDD8CE]`
- Removed inline `fontFamily: "'Inter'..."` (handled by globals.css)

### `sunuwa/src/app/[locale]/submit/page.tsx` — MODIFIED
Design system pass (same color swaps as above) plus:
- Added `selectedCategories: string[]` state
- AI-classified category auto-added to `selectedCategories` on classify
- In followup step: added multi-select checkbox grid (2 columns, all 9 categories)
- Selected categories rendered as removable pills above grid
- At least 1 category must remain selected
- On submit: `followup.categories` sent as comma-separated string e.g. `"Infrastructure,Water"`

### `sunuwa/src/app/[locale]/track/page.tsx` — MODIFIED
**Bug fix:** Line 182 — `complaint.id.slice(0,13)` crashed when `id` was undefined.
Changed to: `complaint?.id?.slice(0,13).toUpperCase() ?? ''`

### `sunuwa/src/app/[locale]/login/page.tsx` — MODIFIED
**Bug fix 1 — redirect:** `.single()` was throwing when user has no `user_roles` row; error was swallowed, always fell through to `router.push('/ne')`. Changed to `.maybeSingle()` which returns `null` gracefully.

**Bug fix 2 — extra getUser call:** Removed the redundant `supabase.auth.getUser()` call; user is already on `authData.user` from `signInWithPassword`.

**Bug fix 3 — demo password:** Demo account buttons previously called `setEmail(acc.email); setPassword('')`. Now call `setPassword('demo1234')`.

Design system pass (color swaps + removed inline Inter font).

### `sunuwa/src/app/[locale]/trending/page.tsx` — MODIFIED
Design system pass only. Removed inline Inter font from main `<div>` and loading state `<div>`.

### `sunuwa/src/app/[locale]/ward/[id]/page.tsx` — MODIFIED
Design system pass only (`#16A34A`→`#1B4332`, `#15803D`→`#143728`, `#F8FAFC`→`#F5F0E8`, removed two inline Inter font style props).

### `sunuwa/src/app/[locale]/minister/[slug]/page.tsx` — MODIFIED
Same design system pass. One inline Inter font reference left in the brief content renderer (intentional — brief body text uses Inter when in English mode).

### `sunuwa/src/components/WardMapLight.tsx` — MODIFIED
**Bug fix — ward boundary showing same dashed circle for all wards:**
Old code used OSM Overpass API with a query filtered by municipality name, then tried to match by ward number in the result tags. This was fragile — the query almost always failed or returned the same result regardless of ward, then fell back to `L.circle()` at the ward's lat/lng with a fixed 600m radius. Every ward showed the same dashed circle.

New code: fetches from Nominatim GeoJSON endpoint:
```
https://nominatim.openstreetmap.org/search?q=[ward.name_ne]+[ward.municipality]+Nepal&format=geojson&polygon_geojson=1&limit=3
```
Takes the first result whose geometry type is `Polygon` or `MultiPolygon`. Draws with `L.geoJSON()`:
- `color: '#1B4332'`, `weight: 2.5`, `opacity: 0.7`
- `fillColor: '#1B4332'`, `fillOpacity: 0.08`

If Nominatim returns no polygon or errors → silently skips. No fallback circle. This is intentional: a wrong circle is worse than no boundary.

---

## Current Bug Status

| Bug | Status | Notes |
|-----|--------|-------|
| Track page crash (line 182) | ✅ Fixed | Optional chaining added |
| Submit multi-category select | ✅ Fixed | Checkbox grid in followup step |
| Login redirect always → /ne | ✅ Fixed | `.maybeSingle()` + demo password |
| Ward boundary same circle for all | ✅ Fixed | Nominatim GeoJSON replaces Overpass |
| Schema missing 4 columns | ✅ Code fixed | **User must run Step 6 migration in Supabase** |
| Brief content_en always null | ✅ Fixed | Two separate Gemini calls |
| shadcn in globals.css | ✅ Fixed | Removed, Sunuwa tokens only |
| Design system wrong colors | ✅ Fixed | All 7 pages updated |
| Escalation job missing | ✅ Fixed | escalation.py created, registered |

---

## Exact Next Steps (in order)

### 1. Run the DB migration — REQUIRED before anything works
Open Supabase dashboard → SQL Editor → paste and run:
```sql
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS followup_data JSONB;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS officer_notes TEXT[] DEFAULT '{}';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS referred_to TEXT;
CREATE INDEX IF NOT EXISTS complaints_tracking_idx ON complaints (tracking_code) WHERE tracking_code IS NOT NULL;
```

### 2. Create demo accounts in Supabase Auth
Auth → Users → Add user for each:
- `ward1@sunuwa.gov.np` password `demo1234`
- `ward32@sunuwa.gov.np` password `demo1234`
- `health@sunuwa.gov.np` password `demo1234`

Then in SQL Editor:
```sql
-- Replace the UUIDs with the actual user IDs from Auth → Users
INSERT INTO user_roles (user_id, role, ward_id, ministry_slug) VALUES
  ('<ward1-user-uuid>',  'ward_official', 1,    null),
  ('<ward32-user-uuid>', 'ward_official', 4,    null),   -- Ward 32 is row id=4 in seed data
  ('<health-user-uuid>', 'minister',      null, 'health');
```

### 3. Start the FastAPI backend
```bash
cd sunuwa-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start the Next.js frontend
```bash
cd sunuwa
npm install
npm run dev
```

### 5. Set up hourly escalation cron
Options:
- **cron-job.org** (free): add job → URL `http://your-server:8000/api/run-escalation`, method POST, interval 1 hour
- **Local cron** (Linux/Mac): `0 * * * * curl -X POST http://localhost:8000/api/run-escalation`
- **Windows Task Scheduler**: action = `curl -X POST http://localhost:8000/api/run-escalation`, trigger = daily, repeat every 1 hour

### 6. Known limitation — ward boundaries
Nominatim has partial coverage for Nepal ward-level boundaries. Kathmandu Metropolitan City wards are usually in OSM. Smaller municipalities may not have polygon data. If the boundary doesn't appear for a ward, that's an OSM data gap — the map still works, just without the overlay polygon.

### 7. What's not built yet
- `trending` page pulls from live complaints but the stats cards (14,300+, 56 municipalities) are hardcoded placeholder numbers — wire up to a real `/api/stats` endpoint when ready
- Minister brief generation must be triggered manually via `POST /api/generate-brief/[slug]` — no scheduled job yet
- Cluster job (`/api/cluster`) must also be triggered manually
- No email/SMS notifications when complaints escalate
- No public map page (`/map` route referenced in navbar but page doesn't exist)
