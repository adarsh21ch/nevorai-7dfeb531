
# Insights Unification + My Videos Premium Upgrade

This is a large spec. I'll ship it in **4 phases** so each is reviewable and works end‑to‑end before the next. Phase 1 unblocks everything else because real analytics depend on a new tracking table.

---

## Phase 1 — Backend foundation (DB + tracking)

**Goal:** capture real view data so KPIs/retention/live‑viewer aren't placeholders.

New table `public.video_view_events`:
```
id uuid pk
video_id uuid → video_assets(id) on delete cascade
session_id text         -- anon localStorage id
viewer_user_id uuid null -- if logged in
ip_hash text            -- sha256(ip + daily_salt), never raw ip
country text null       -- from cf-ipcountry header
device_type text        -- mobile|desktop|tablet
referrer_source text    -- whatsapp|instagram|direct|other
watch_position_seconds int default 0
max_position_seconds int default 0  -- furthest reached (retention)
duration_seconds int null
completed boolean default false
skip_attempts int default 0
started_at timestamptz default now()
last_heartbeat_at timestamptz default now()
```
Indexes: `(video_id, started_at desc)`, `(video_id, last_heartbeat_at desc)`, `(session_id, video_id)`.
RLS: owner of the video can SELECT; INSERT/UPDATE only via server fn (admin client, no public policy).

New column `profiles.pref_default_allow_seek boolean default true`.

New server functions in `src/lib/videoTracking.functions.ts`:
- `trackVideoEvent({ slug, sessionId, event: 'play'|'heartbeat'|'end'|'skip_attempt', position, duration })` — upserts on `(session_id, video_id)`, increments counters; uses `supabaseAdmin`, validates slug exists.
- `getVideoInsights({ videoId })` — returns KPI block, retention buckets (10 segments), daily views (30d), device split, source split, last 20 viewers.
- `getLiveViewers({ videoId })` — count where `last_heartbeat_at > now() - 15s`.
- `getRecentActivity({ days })` — feed for Insights Recent tab.

Wire `trackVideoEvent` calls into `PublicVideoPage.tsx`: on play, every 5s heartbeat, on ended, on blocked seek.

---

## Phase 2 — Insights unification

- Rename mobile bottom nav `Activity → Insights`, icon `BarChart2`, route `/insights` (matches desktop). Edit `DashboardLayout.tsx`.
- Rebuild `InsightsPage.tsx`:
  - Sticky header with title + time filter chips (Today/Week/Month/All, default Week).
  - KPI strip: Total Views, Unique Viewers, Avg Watch Time, Leads — each with trend chip vs previous period (↑/↓/→).
  - Horizontal scrollable Tabs: **Recent / Videos / Funnels / Landing Pages / Live**.
  - Recent: grouped feed (Today/Yesterday/This Week) of view bursts, new leads, live sessions, skip attempts.
  - Videos: card grid with thumb, weekly views + trend, avg watch %, live dot if active.
  - Funnels / Landing Pages / Live: same card pattern using existing tables.
  - Skeleton loaders everywhere, empty states with simple SVG illustrations.

---

## Phase 3 — Per‑video insights + My Videos overhaul

**Route** `src/routes/videos.$slug.insights.tsx` → page `VideoInsightsPage.tsx`:
- Header: back link, title, Share / Edit Details / Use in Funnel.
- KPI row (6 cards) incl. Live Now (pulse), Skip Attempts, Lead Conversions.
- Retention curve (Recharts LineChart) — gated behind ≥10 viewers, else helper text.
- Views over time (7/30 toggle), Traffic Sources (Pie), Devices (Donut), Recent Viewers table.
- Empty state with Share button when 0 views.

**My Videos overhaul (`VideosPage.tsx`):**
- Desktop ≥768px: visible inline buttons per row → `Copy Link`, `Insights`, `Use in Funnel`, then `⋮` (Edit Title, Edit Details, Delete). Hover elevation + live‑viewer pulse dot.
- Mobile <768px: only `Copy Link` inline + `⋮` (Insights, Use in Funnel, Edit Details, Delete). Remove existing Share dropdown on mobile.
- Number formatting via `formatCompact` already in `src/lib/format.ts`.

---

## Phase 4 — Upload flow, Preview, polish

- **Smart Upload Content Protection step** in `VideoUploadModal.tsx`: after R2 confirm, show step with `Allow viewers to skip forward` (default = `profiles.pref_default_allow_seek`) and `Allow downloads`. On save, persist toggle + update profile pref. First‑time tooltip on the seek toggle.
- **Preview modal** (desktop, on Edit Details and My Videos): iframe `/v/{slug}` in mobile‑frame (375px) with mobile/desktop switch, reflects live skip behavior.
- **Polish:** TrendChip component, live pulse dot component, skeleton loaders across Insights + My Videos, sonner toast position (bottom‑right desktop, top‑center mobile) with success/error variants, empty‑state SVGs, keyboard shortcuts (`/`, `N`, `U`, `?`) on desktop, dark mode pass.

---

## Out of scope / clarifications

- Country comes from `cf-ipcountry` request header (Cloudflare Worker). No external GeoIP service.
- IP hashing uses a daily‑rotating salt stored as env var — privacy preserving, still lets us dedupe within a day.
- Keyboard shortcuts only registered on `md+` viewports.

---

## Confirm before I start

1. **OK to create `video_view_events` table + `profiles.pref_default_allow_seek` column** via migration? (Required for everything real in Insights.)
2. **Should I run all 4 phases in sequence in this single turn**, or stop after Phase 1 for you to verify tracking before I build the UI on top?
3. **Live‑viewer polling interval — 5s OK?** (Heavier on requests; 10s is gentler.)
