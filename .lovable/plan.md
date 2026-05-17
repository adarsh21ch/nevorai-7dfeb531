## Why the first-tab lag happens

The app is fast after a minute because everything is cached. The cold-start lag is **not** a data problem — data is already warm-prefetched in `useAuth`. It's a **JavaScript chunk** problem:

1. Every route in `src/routes/*.lazy.tsx` is a separate code-split chunk. The first time you click a tab (Videos, Funnels, Insights, etc.), the browser must download that chunk + its transitive imports (DashboardLayout, charts, modals, etc.), parse, and only then render. That's the 3–5s wait.
2. `defaultPreload: "render"` only preloads links that are currently rendered. On a fresh page load nothing is preloaded until React mounts and the sidebar paints — by then you've already clicked.
3. The SW cleanup in `__root.tsx` triggers a full `window.location.reload()` once per session on returning users, which compounds the first impression.
4. `AuthProvider` fires 6 parallel Supabase queries on mount competing with the initial route chunk download over the same HTTP/2 connection.

## Fix plan (frontend only, no business-logic changes)

### 1. Eagerly preload dashboard route chunks after login
In `src/hooks/useAuth.tsx`, once `user` is set, call `router.preloadRoute()` for every primary tab (`/dashboard`, `/videos`, `/insights`, `/funnels`, `/landing-pages`, `/live`, `/tools`, `/profile`, `/billing`, `/payments`, `/notifications`). This downloads the JS chunks during the idle moment right after login, so tab clicks become instant chunk-cache hits.

Use `requestIdleCallback` (fallback `setTimeout(…, 200)`) so it doesn't fight the first paint.

### 2. Preload on app shell mount, not just on hover
In `DashboardLayout.tsx`, in addition to `onMouseEnter`, run a one-shot `useEffect` that preloads all sidebar + bottom-nav routes after mount. Mobile users never hover, so today their tabs are never preloaded.

### 3. Stagger the auth-time data prefetch
In `useAuth.tsx`, the 6 parallel `prefetchQuery` calls block the network. Wrap them in `requestIdleCallback` and keep only `dashboard-summary` + `unread-notifications` as immediate. The rest fire after the first paint settles. This frees bandwidth for route chunks.

### 4. Kill the SW reload loop on returning users
In `src/routes/__root.tsx`, the SW-cleanup `useEffect` calls `window.location.reload()` once per session. The kill-switch SWs in `public/sw.js` already self-unregister. Drop the reload — just unregister silently. This removes a hard ~1s round-trip from cold start.

### 5. Add `modulepreload` hints for the heaviest shared chunks
In `__root.tsx` `head().links`, add `{ rel: "modulepreload", href: "/_build/assets/DashboardLayout-*.js" }` style hints — but since hashed filenames change per build, instead use Vite's built-in `<link rel="modulepreload">` injection by importing `DashboardLayout` from `__root.tsx`'s component graph indirectly (cheaper: just make sure DashboardLayout is in the initial chunk by importing it once at the root level for authenticated routes). Skip if it grows the initial bundle by >30KB.

### 6. Verification
- `npm run build` succeeds.
- Browser cold-load: open in incognito, log in, click each tab — first-click latency should drop from 3–5s to <500ms.
- Confirm Network panel shows `/dashboard`, `/videos`, `/insights` chunks downloading immediately after login (status 200, then 304 / cache on actual nav).

## Scope guard
- Frontend only. No DB, no Supabase functions, no business logic touched.
- No new dependencies.
- Files touched: `src/hooks/useAuth.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/routes/__root.tsx`. Possibly `src/router.tsx` for `defaultPreloadStaleTime` confirmation.
