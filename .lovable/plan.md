# nFlow — Navigation Restructure + Brand + UX Polish

Frontend-only. No Supabase / auth / Razorpay / edge function / R2-upload-logic changes. Every step keeps the existing TanStack Start route tree, just adds/edits files.

## What already exists (no rework needed)
- `NFlowLogo` component at `src/components/brand/NFlowLogo.tsx` (already used in many places).
- `useDocumentTitle` hook → reuse instead of creating a duplicate `usePageTitle`.
- `public/manifest.webmanifest` already present (just needs a small content tweak).
- `ConfirmDialogProvider`, debounced search, `NumberInput`, `EmptyState`, format helpers — all in place from prior batches.
- TanStack Start uses `head()` in `__root.tsx` (no `index.html`).

## Section 1 — Mobile bottom nav: 4 tabs
- Edit `src/components/layout/DashboardLayout.tsx`: replace the 5-cell mobile `<nav>` (lines ~264–290) with a 4-cell grid: **Home `/dashboard`**, **My Videos `/videos`**, **Tools `/tools`**, **Profile `/profile`** using lucide `Home, Video, Wrench, User`.
- Active state: exact match for `/dashboard`, `startsWith` for `/tools` (covers sub-tabs), `startsWith` for `/videos` and `/profile`.
- Keep `safe-area-pb` and `min-h-[64px]` cells. Main content already has `pb-24` — keep.

## Section 2 — Tools page (combines Funnels + Landing Pages + Live)
- Create `src/pages/ToolsPage.tsx`: horizontal pill sub-tabs (Funnels / Landing Pages / Live Sessions) backed by `?tab=` search param. Renders the matching list inside `DashboardLayout`.
- Create route `src/routes/tools.tsx` registering `ToolsPage`.
- Refactor list pages to support embedding without double-wrapping the layout:
  - Add an optional `embedded?: boolean` prop to `FunnelsPage`, `LandingPagesPage`, `LivePage`.
  - When `embedded` is true, render their content without the outer `<DashboardLayout>` wrapper (extract body into a shared inner block, or conditionally skip the wrapper).
- Existing routes `/funnels`, `/landing-pages`, `/live` continue to render the non-embedded versions unchanged.
- Add `.scrollbar-hide` utility to `src/styles.css` if missing.

## Section 3 — Home redesign (`src/routes/dashboard.tsx`)
Restack the page top-to-bottom:
1. **Greeting block** — small "nFlow by Nevorai" eyebrow + `Good morning/afternoon/evening/night, {firstName} 👋`.
2. **Today's Views hero card** (keep existing but show % change vs yesterday using `useDailyViews` + a yesterday query helper).
3. **Watching Right Now strip** — new component `src/components/dashboard/WatchingNowStrip.tsx`. Read-only query of `funnel_video_analytics` (or equivalent existing view) for sessions with `last_seen_at` within 60s, top 3, refetch every 15s. Empty state: "Share your nFlow link to start seeing viewers in real-time" with a Copy Link button. Footer link "See all in Insights →" → `/insights`.
4. **Quick stats row (3 cells)** — Videos · Leads · Views Today (reuse stat tiles).
5. **Recent activity (5 items)** — keep existing `DashboardContentRow` if it covers this; otherwise add a compact list.

Also: replace `/leads` bottom-nav target with `/insights` link in the hero card footer (nav itself no longer points to leads).

## Section 4 — Insights progressive reveal
- Keep `/insights` route + `InsightsPage` as-is.
- Add a "Who watched this" card to `src/pages/VideoDetailPage.tsx`: top 3 viewers (name, watch %, last viewed) with "See all →" linking to `/insights?video={id}`.
- In `InsightsPage`, when total viewers across all videos is zero, render an `EmptyState` ("When someone watches your nFlow link, they'll appear here…").

## Section 5 — Auto thumbnail from first video frame
- Create `src/lib/videoThumbnail.ts` with `captureFirstFrame(file: File): Promise<Blob | null>` (off-DOM `<video>` + canvas, seek to `min(0.5, duration/2)`, JPEG @ 0.85).
- In `src/components/VideoUploadModal.tsx`, after R2 upload succeeds and only if no manual thumbnail was chosen:
  1. Call `captureFirstFrame(file)`.
  2. Upload the blob via the existing R2 upload helper to `{videoKey}_thumb.jpg`.
  3. Patch `video_assets.thumbnail_url` for the new row (single update, no schema changes).
- Fallback for legacy videos: in video card components that render a thumbnail, when `thumbnail_url` is missing, use `<video preload="metadata" muted playsInline poster src={url + '#t=0.5'} />`.

## Section 6 — Brand + titles + PWA polish
- **Spelling sweep** (only brand mentions, never CSS classes): replace `NFlow`→`nFlow`, `Nflow`→`nFlow`, `Nevorai Flow`→`nFlow by Nevorai`, `alt="Flow"`→`alt="nFlow"`, `title="Flow"`→`title="nFlow"`. Use ripgrep with word boundaries; manually review hits inside CSS/util names like `overflow`, `flex-flow`.
- **Logo coverage** — ensure `NFlowLogo` is used in: mobile header, desktop sidebar, `AuthPage`, splash/loading, Profile footer (with version).
- **Page titles** — standardize via existing `useDocumentTitle(title)` (already produces `"{title} — nFlow"`-style via the hook; verify suffix and fix if needed). Apply to: Dashboard("Home"), VideosPage("My Videos"), ToolsPage("Tools"), ProfilePage("Profile"), InsightsPage("Insights"), BillingPage("Billing"), AuthPage("Sign in"). Do **not** introduce a parallel `usePageTitle` hook.
- **Root `head()`** in `src/routes/__root.tsx`: ensure title default = `nFlow by Nevorai`, description, theme-color `#0EA5E9`, og:site_name `nFlow`, link to `/manifest.webmanifest`, apple-touch-icon, viewport with `viewport-fit=cover`.
- **manifest.webmanifest**: update `name` from `"Nevorai Flow"` → `"nFlow by Nevorai"`. Keep existing icon paths (`/icons/icon-…`).
- **Share copy** — wherever a share message is built (search `WhatsAppShareButton`, `CopyNflowLinkButton`, `VideoShareModal`), use:
  `Watch this video on nFlow — you can't skip it 😄\n\n${link}\n\nShared via nFlow by Nevorai`.

## Out of scope (do not touch)
Supabase schema/RLS, auth logic, Razorpay, edge functions, R2 upload internals, DB queries beyond the small thumbnail update, existing route paths (only `/tools` is added).

## Verification
- `npm run build` clean (TS strict).
- Mobile nav shows 4 tabs; `/tools` switches sub-tabs via `?tab=`; `/funnels`, `/landing-pages`, `/live` still load standalone.
- Home: greeting + live strip + Insights link present.
- New video upload writes a thumbnail blob; legacy video cards fall back to poster.
- No `NFlow` / `Nevorai Flow` / `Nflow` strings remain in user-visible copy.
