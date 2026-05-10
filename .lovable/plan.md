## Goals

1. Fix admin panel — tabs (Users, Subs, KYC, WhatsApp, Support, Settings, Videos) currently change URL but render the Overview page.
2. Achieve exact parity with the source nFlow project for the funnel features that are still stubs in this app.
3. Eliminate the real causes of navigation lag (slow first paint, repeated waterfalls, unnecessary work on every route change).

Performance is the first priority, then admin, then parity — all delivered in one pass.

---

## 1. Performance pass (first)

What the live profile shows: TTFB 2.6s, FCP 4s, full load 6.5s, 238 script chunks, `lucide-react` alone is 179 KB / 1.5s, `styles.css` blocks render for ~1.2s, `@radix-ui/react-select` and `date-fns` are pulled into the cold path. So the lag is **not** "JS is doing too much CPU work" — it's **module graph bloat + render-blocking CSS + redundant queries on every layout mount**.

Concrete changes:

- **CSS**: move the Google Fonts `@import` in `src/styles.css` to a `<link rel="preconnect"> + <link rel="stylesheet">` in `__root.tsx`, and add `font-display: swap`. This eliminates the PostCSS warning ("@import must precede all other statements") and the render-blocking font fetch.
- **Icon bundle**: replace blanket `import { X, Y, Z } from "lucide-react"` in hot files (DashboardLayout, AdminLayout, navbars, KPI strips) with per-icon `lucide-react/dist/esm/icons/<name>` imports so only the icons used are shipped, dropping ~150 KB from the cold chunk.
- **Date / heavy deps**: lazy-load `date-fns`, `@radix-ui/react-select`, and `seroval` only inside the components that actually need them; remove unused `date-fns` re-exports from shared util files.
- **Query defaults**: keep the recent `staleTime: 30s / gcTime: 5min / refetchOnMount: false` defaults but additionally:
  - Set `placeholderData: keepPreviousData` on tab-switch queries (Funnels, Leads, Payments, Admin tabs) so switching tabs renders cached data instantly while revalidating.
  - Add a single `dashboard-bootstrap` query in `DashboardLayout` that fetches profile + plan + admin role + unread count in one parallel batch, instead of 4 separate hooks each waiting their turn.
- **Auth context**: `useAuth` currently re-fetches the profile on every `onAuthStateChange` event. Skip the fetch when the new session's user id and access token both match the previous values. This stops the cascade re-render that fires on every tab focus.
- **Router preload**: keep `defaultPreload: "intent"` but also set `defaultPreloadDelay: 30` and add `<link rel="modulepreload">` for the next-likely route chunks (`/dashboard`, `/funnels`, `/admin`) inside `__root.tsx` head, so first-click feels instant after login.
- **Code-split heavy editors**: `FunnelEditor`, `LandingPageEditor`, `AdminSubscriptionsPage`, `LivePage` already lazy-load via route, but they each re-import the same heavy components synchronously at the top. Convert their non-critical sections (TestimonialsBuilderStep, ViewTiersManager, PlanEditorTable, MemberGatewayTab, EnterpriseInquiriesTab, RefundsTab) to `React.lazy` + `Suspense` so the editor shell paints before the inner panels finish parsing.
- **Image weight**: `nevorai-mark.png` is 127 KB and render-blocking. Convert to a `<Logo />` SVG (already in `src/components/landing/Logo.tsx`) for inline use; keep the PNG only for og:image / favicon.

---

## 2. Admin panel fix

Cause: `src/routes/admin.tsx` is `createFileRoute("/admin")({})` (no component, no `<Outlet />`). The flat dot-named files like `admin.users.tsx` register **as children** of `/admin`. Since the parent has no `Outlet`, the child URL changes but the parent's `admin.lazy.tsx` (which renders `AdminDashboard`) is what shows up. Identical pattern to the earlier `funnels.tsx` bug.

Fix:

- Rename the parent files so they are leaf routes:
  - `src/routes/admin.tsx` → `src/routes/admin.index.tsx` with `createFileRoute("/admin/")` (and matching `admin.index.lazy.tsx` pointing at `AdminDashboard`).
  - Delete `src/routes/admin.tsx` and `src/routes/admin.lazy.tsx`.
- Verify the same pattern is correct for funnels and landing-pages (already migrated to `.index.tsx` — confirm and remove any leftover `funnels.tsx` / `landing-pages.tsx` shells).
- Re-test each admin tab via the browser tool to confirm correct page renders.

---

## 3. Port remaining nFlow stubs (exact parity)

Files in this project that are stubs but referenced by real screens (compared 1:1 against the `nFlow` source project):

| File | Status here | Action |
|---|---|---|
| `src/components/funnel/PerStepSpeakerAssignment.tsx` | Stub | Port full version from nFlow (per-step speaker editor with photo upload, copy across steps, draft state). |
| `src/components/funnel/ViewersAnalyticsTab.tsx` | Stub | Port full version (search, paginated viewer table, watch %/last seen, code-gate filter). |
| `src/components/funnel/PrivacySettings.tsx` | Header says "stub", body partially exists | Diff against nFlow and bring over any missing fields (visibility radio, code generator, required-fields toggles). |
| `src/components/funnel/SpeakerPhotoUpload.tsx` | "TODO: simplified" | Port full version with cropper (Slider + crop dialog) from nFlow. |
| `src/components/funnel/StepTypeSelector.tsx` | Marked stub but exports `getStepTypeMeta` | Verify metadata matches nFlow; add any missing step-type entries used by `JourneyPreview`. |

For each port:
1. `cross_project--read_project_file` the nFlow source.
2. Copy the file in full, adapting only imports (router-compat, design tokens) to this project's conventions.
3. Run a build to confirm no missing dep — install any missing shadcn primitives (e.g. Slider) the first time.

---

## 4. Verification

- After each section, reload preview and:
  - Click every admin tab; confirm correct page renders and is interactive.
  - Run `browser--performance_profile` — target FCP < 2.5s, total cold load < 4s, slowest script < 800ms.
  - Click through Dashboard → Funnels → Create → Funnel Editor → Privacy/Speakers tabs; confirm no "coming in next pass" placeholders.
- Check `browser--read_console_logs` for the `Minified React error #418` (text-mismatch hydration) and `g._nonReactive` runtime errors that appear in current logs; both are expected to disappear once the duplicate font-import / CSS warning is removed.

---

## Out of scope

- No DB schema changes, no new Supabase migrations.
- No marketing/landing visual redesign — only the font-loading change there.
- No new features beyond what already exists in the nFlow source.

## Technical notes

- Stack: TanStack Start v1, file-based routing under `src/routes`, React Query 5, Supabase JS, Tailwind v4 via `src/styles.css`.
- Routing convention reminder: a parent route file (`admin.tsx`) without `component` + `<Outlet />` will silently shadow its children. Always use `xxx.index.tsx` for the leaf and reserve `xxx.tsx` only for true layouts that render `<Outlet />`.
- React Query: prefer `placeholderData: keepPreviousData` over `staleTime: Infinity` for tab UIs so data stays fresh in the background.
- Lucide tree-shaking only works with deep imports (`lucide-react/dist/esm/icons/...`) under Vite when using the prebundled dep — barrel imports cost the full 179 KB.
