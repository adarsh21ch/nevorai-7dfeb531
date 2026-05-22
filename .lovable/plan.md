
# Reduce Supabase Cached Egress

## Root causes found

The biggest contributors to your Supabase egress, ranked by impact:

### 1. `video_assets` rows ship a base64 thumbnail (HUGE)
Your network logs show every `video_assets` row carries `thumbnail_url` as an inline `data:image/jpeg;base64,...` string (~80–120 KB each). Every `select("*")` on this table multiplies row count × ~100 KB.

Worst offenders calling `select("*")`:
- `src/hooks/useAuth.tsx` — prefetches **all** of the user's videos on every login/page-load after auth state change.
- `src/pages/VideosPage.tsx` (×2) — list + bulk re-fetch.
- `src/pages/insights/VideoInsightsPage.tsx` — single video, OK but still `*`.
- `src/pages/AdminVideosPage.tsx` — admins pull *all* videos with thumbnails.

### 2. `useAuth` prefetches everything on every login
`src/hooks/useAuth.tsx` (lines 64–118) eagerly prefetches:
- `dashboard_summary` RPC
- unread notifications
- `funnels.*`, `video_assets.*`, `landing_pages.*`, `live_sessions.*`
- `funnel_leads.*` limit 500 (with joined funnels)

All with `select("*")`. Runs whenever `user?.id` becomes set — fires again after every token refresh / tab restore because the effect depends on `router`/`queryClient` too.

### 3. Router preloads with stale time 0
`src/router.tsx` sets `defaultPreload: "render"` + `defaultPreloadStaleTime: 0`. Every `<Link>` rendered in the viewport triggers a route preload, and loaders re-fire because preload data is immediately stale. Combined with `DashboardLayout` proactively preloading 12 routes on mount, this multiplies traffic.

### 4. Aggressive polling intervals
Even though gated by `usePageVisible`, several pages poll fast:
- `src/pages/InsightsPage.tsx` — **7 concurrent queries** at 15–30 s.
- `src/pages/insights/*InsightsPage.tsx` (4 files) — 60 s + 15 s "live now" counters.
- `src/components/dashboard/WatchingNowStrip.tsx` — every 15 s, runs 2–3 queries each tick (funnels → analytics → leads).
- `src/components/layout/DashboardLayout.tsx` — unread notifications every 60 s on every authenticated page.
- `src/pages/LiveDetailPage.tsx`, `src/pages/Dashboard.tsx`, `src/hooks/useDailyViews.tsx` — 30 s polls.

### 5. PublicLivePage heartbeat storm
`src/pages/PublicLivePage.tsx`:
- `syncVideoProgress` runs **every 250 ms** (4× per second), plus on every `timeupdate` event.
- Heartbeat RPC every 15 s.
- Live state fetch every 30 s.
Each concurrent viewer = ~4 writes/sec to Supabase.

### 6. Per-funnel realtime channels
`MultiStepViewer` and `LeadProgressTab` each open `postgres_changes` subscriptions. Each open viewer = an active WebSocket. Fine in small numbers but each subscription delivers row payloads on every change.

### 7. Repeatedly fetched static-ish data
- `landing_content` (full `select *` ordered) on every landing-page mount.
- `plan_config` full table on every dashboard mount.
- `platform_settings`, `app_settings` fired twice (DashboardLayout + landing page) per session.

## Plan

### Phase 1 — Stop shipping base64 thumbnails (biggest win)
1. **Audit `video_assets.thumbnail_url`**: confirm rows contain `data:image/...;base64,...`. If yes, generate real R2 thumbnails on upload and store the URL only. Migration:
   - Add column `thumbnail_url_clean text` (or reuse `r2_thumbnail_key`).
   - One-off backfill: for rows where `thumbnail_url` starts with `data:`, set to `null` and mark for re-generation.
2. **Stop fetching it in list views**. Replace every `select("*")` on `video_assets` with an explicit column list excluding `thumbnail_url` when not rendered, or selecting it only as `r2_thumbnail_key` (URL).
3. Update components that render thumbnails to fall back to a placeholder when missing.

### Phase 2 — Slim down `useAuth` prefetch
1. Remove the bulk prefetches of `funnels.*`, `video_assets.*`, `landing_pages.*`, `live_sessions.*`, `funnel_leads.*`. Let routes load their own data on demand (TanStack Query already caches).
2. Keep only: `dashboard_summary` + `unread-notifications`.
3. Add an effect-mount guard so prefetch runs once per `user.id`, not on every router context change.

### Phase 3 — Tame router preloads
1. In `src/router.tsx` change `defaultPreload: "render"` → `"intent"` (preload on hover/focus only) **or** keep `"render"` but set `defaultPreloadStaleTime: 30_000` so preloaded data is reused.
2. Remove the proactive 12-route preload loop in `DashboardLayout.useEffect` — `defaultPreload` handles this. Keep the hover/focus `onMouseEnter` handler only.

### Phase 4 — Slow polling and dedupe queries
1. `DashboardLayout` unread count: poll 5 min, not 60 s. (Realtime updates can re-fetch on `notifications` insert if needed.)
2. `WatchingNowStrip`: 60 s instead of 15 s; collapse into single RPC `get_watching_now(user_id)` that returns the joined viewer rows server-side (one round-trip instead of 3).
3. `InsightsPage` "live now" counts: 60 s instead of 15 s. Other charts: 2–5 min.
4. Insights detail pages (`/insights/*`): live-now 60 s, charts 5 min.
5. Cache static-ish reference data (`plan_config`, `landing_content`, `platform_settings`, `app_settings`) with `staleTime: 30 * 60_000`, `gcTime: 60 * 60_000`, single shared query key per table.

### Phase 5 — Fix PublicLivePage write storm
1. Drop `setInterval(syncVideoProgress, 250)` — `timeupdate` already fires ~4×/sec and `syncVideoProgress` is wired to it. The interval is redundant.
2. Throttle heartbeat to 30 s (was 15 s).
3. Throttle live-state poll to 60 s when not in "starting" window.

### Phase 6 — Realtime hygiene
1. `MultiStepViewer` realtime: only subscribe when the viewer is the **creator previewing**, not for every public viewer (currently the channel is funnel-scoped — confirm it's not opened on the public page).
2. `LeadProgressTab`: filter to `funnel_id=eq.${funnelId}` (already done) and `unsubscribe` on tab blur via `usePageVisible`.

### Phase 7 — Verify
1. Open DevTools Network panel before/after on `/dashboard`, `/insights`, and a public funnel page. Measure total bytes over 60 s idle.
2. Compare Supabase dashboard "Egress" metric over 24 h after deploy.

## Technical details

- `select("*")` count in repo: **81 occurrences**. Phase 1+2 targets the ~10 hot ones; remaining can be hardened later.
- All polling changes are mechanical: edit `refetchInterval` constants.
- Router config change is a 2-line edit in `src/router.tsx`.
- `useAuth` prefetch trim removes ~50 lines.
- The base64-thumbnail fix is the only one that needs a DB migration + edge function update (upload pipeline must write a real thumbnail URL going forward). If you don't want to touch upload yet, the column-projection change alone (Phase 1.2) immediately stops shipping the blob to the client and recovers most of the egress.

## Out of scope
- Any UI / visual changes.
- Replacing TanStack Query or Supabase client.
- Re-architecting the live-session feature beyond throttling.
