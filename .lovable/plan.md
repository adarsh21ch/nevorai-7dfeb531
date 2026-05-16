# Activity / Insights v2

This is a large multi-part build. I'll ship it in **5 phases** so each ends in a working, reviewable state. Phase 1 is the small nav revert you asked for first; Phases 2–5 are the v2 upgrade.

---

## Phase 1 — Nav revert (small, ships first)

- Mobile bottom nav: label back to **"Activity"**, icon `Zap` (lightning/pulse), route `/insights?tab=recent`.
- Desktop sidebar: stays **"Insights"**, icon `BarChart2`, route `/insights?tab=overview`.
- `InsightsPage` reads `?tab=` from URL, syncs to state, default = `overview` on desktop, `recent` on mobile (via `useIsMobile`).
- Tab order: `Overview / Videos / Funnels / Landing Pages / Live` (Recent merges into Overview's activity feed; mobile just opens with the feed scrolled into view).

Files: `DashboardLayout.tsx`, `InsightsPage.tsx`.

---

## Phase 2 — Backend foundation (attribution + tracking)

New columns on `funnel_leads` and `landing_page_registrations`:
- `source_type text` (`'funnel' | 'landing_page' | 'video' | 'live_session'`)
- `source_id uuid`
- `referrer_url text`
- `utm_source text`, `utm_medium text`, `utm_campaign text`

New tables (mirroring `video_view_events`):
- `funnel_view_events` — `funnel_id, session_id, referrer_source, device_type, country, started_at, last_heartbeat_at`
- `landing_page_view_events` — same shape with `landing_page_id`
- `live_session_view_events` — same shape with `live_session_id`

RLS: owner SELECT only; writes via server fn with `supabaseAdmin`.

Server fns in `src/lib/insights.functions.ts`:
- `trackEntityView({ entityType, entityId, sessionId, referrer, device })`
- `getOverviewInsights({ period })` → KPIs, trend %, sparklines, attribution split, recent activity feed, top videos/funnels.
- `getVideoInsights({ slug })`, `getFunnelInsights({ slug })`, `getLandingPageInsights({ slug })`, `getLiveInsights({ slug })`
- `getLiveViewers({ entityType, entityId })` for the red-dot pulse.

Wire `trackEntityView` into `PublicFunnel`, `PublicLandingPage`, `PublicLivePage` (Video already tracks). Wire `source_type/source_id/referrer/utm` capture into the funnel/LP lead submit paths.

---

## Phase 3 — Unified `/insights` page (Level 1)

Rebuild `InsightsPage.tsx`:
- Sticky header: title (`Activity` mobile / `Insights` desktop), subtitle, time-filter chips `Today / 7d / 30d / All` persisted to `localStorage('insights:period')`.
- Sticky horizontal scroll tabs with URL sync (`?tab=overview|videos|funnels|landing-pages|live`).
- **Overview tab**: 4 hero KPI cards (Total Views, Unique Viewers, Total Leads, Live Viewers) with animated count-up, trend chip vs prev period, 7-day sparkline. Then Recent Activity feed (polls 30s, grouped Today/Yesterday/This Week). Then Top Videos + Top Funnels. Then Attribution stacked bar.
- **Videos tab**: card grid (list/grid toggle desktop) with per-video mini stats + live pulse. Sort + status filter. Empty state with upload CTA.
- **Funnels / Landing Pages / Live tabs**: same card pattern, entity-specific mini stats.

Shared components: `KpiCard`, `TrendChip`, `Sparkline`, `LivePulseDot`, `ActivityFeedItem`, `EntityCard`, `EmptyStateIllustration`, skeleton variants. All numbers via `formatCompact`.

---

## Phase 4 — Drill-down pages (Level 2)

New routes under `src/routes/insights.*`:
- `insights.videos.$slug.tsx` → `VideoInsightsPage`
- `insights.funnels.$slug.tsx` → `FunnelInsightsPage`
- `insights.landing-pages.$slug.tsx` → `LandingPageInsightsPage`
- `insights.live.$slug.tsx` → `LiveInsightsPage`

Each shares a `<DrillHeader />` (back, thumbnail/icon, title, public link + actions) and a `<KpiStrip />` of 6 cards.

Video-specific: retention curve (gated ≥10 viewers), views-over-time bar, traffic-source pie, device donut, recent viewers table, leads-from-this-video table.
Funnel-specific: step-by-step drop-off diagram (biggest drop highlighted red), completion rate, time-to-conversion, leads table with full attribution, best video in funnel.
Landing page: form submission rate, time on page, CTA CTR.
Live: registered vs attended, peak concurrent, replay views.

Cross-link from list cards → drill-down. Cross-link from existing My Videos / Funnels / LP rows → drill-down too.

---

## Phase 5 — Polish

- Animated count-up (lightweight hook, no extra dep).
- Skeleton loaders matched to each card/chart shape.
- TrendChip + Sparkline applied everywhere KPIs render.
- Live pulse dot (CSS keyframes) + 30s polling for live counts.
- Empty states with simple SVG illustrations + primary CTA.
- URL deep-linking for tabs + period.
- Mobile: snap-scroll KPI row, swipeable tabs, tables → cards <768px.
- Export CSV button (Pro-gated via `usePlan`), upgrade prompt for free users.
- Notification bell on insights header (reuses existing `notifications` query).

---

## Out of scope / clarifications

- No new edge functions — all writes go through `createServerFn` + `supabaseAdmin` (per project convention). The "unified track-event edge function" in the spec becomes `trackEntityView` server fn.
- Geographic heatmap deferred — `country` is captured (`cf-ipcountry`) but the actual map UI is hidden until Phase 5+ if time allows; otherwise shown as a top-5 list.
- Q&A engagement metric for Live is omitted (feature doesn't exist yet).
- "Notification bell on insights" reuses the existing notifications system, not a new one.

---

## Confirm before I start

1. **OK to add migration** for: `funnel_leads.{source_type,source_id,referrer_url,utm_*}`, `landing_page_registrations.{same}`, and the three new `*_view_events` tables (mirroring `video_view_events`)?
2. **Ship Phase 1 (nav revert) immediately and stop for your verification**, then continue 2→5 in subsequent turns? Or run all 5 phases in one go?
3. **Live polling interval — 30s OK** (spec says 30s for activity feed, but earlier you'd asked about 5s for live viewers). Confirm 30s for both, or 5s for live-viewer counts only?
