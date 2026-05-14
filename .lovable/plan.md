## Goal

When a Nevorai video link (`/v/:id`) is pasted into WhatsApp / Telegram / Instagram / iMessage / Twitter, show a rich preview with the video's thumbnail, title, description, and (where supported) an inline player — the way YouTube does.

## Root cause

`PublicVideoPage.tsx` writes OG tags from a `useEffect` (client-side, after mount). Social crawlers never run JS, so they only see the generic site-wide tags from `__root.tsx`. Fix = emit per-video meta in the **server-rendered HTML** via TanStack Start's route `loader` + `head()`.

## Changes

### 1. `src/routes/v.$id.tsx` — add SSR loader + head()

Currently this file is just `createFileRoute("/v/$id")({})` and the component lives in `v.$id.lazy.tsx`. We turn it into a data-fetching route:

- `loader({ params })` → query `video_assets` for `id, title, description, thumbnail_url, public_url, duration_seconds, is_shared`. Use the public Supabase client (anon key, RLS-safe) so it works on the server with no auth header. If the row is missing or `is_shared = false`, return `null` and let the component show its 404 state.
- `head({ loaderData })` → emit:
  - `<title>{title} — Nevorai</title>`
  - `description`, `og:title`, `og:description`, `og:url`, `og:type = "video.other"`, `og:site_name = "Nevorai"`
  - `og:image`, `og:image:secure_url`, `og:image:width`, `og:image:height` (use `thumbnail_url`; fall back to omitting if null — no image is better than a broken one)
  - `og:video`, `og:video:secure_url`, `og:video:type = "video/mp4"`, `og:video:width = 1280`, `og:video:height = 720` (using `public_url`)
  - `twitter:card = "player"`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:player` (points to `/v/:id`), `twitter:player:width/height`, `twitter:player:stream`, `twitter:player:stream:content_type`
- `links` → canonical to `https://nevorai.com/v/{id}` (leaf only, per project SSR rules).
- `scripts` → JSON-LD `VideoObject` (helps Google video search show a thumbnail in results).

Build absolute URLs from a fixed `https://nevorai.com` base — never `window.location` (undefined during SSR).

### 2. `src/pages/PublicVideoPage.tsx` — remove client-side meta block

Delete the `useEffect` that mutates `document.title` and injects `<meta>` tags. The route file is now the single source of truth, and keeping both creates duplicate / conflicting tags. Component stays purely visual.

### 3. `src/routes/v.$id.lazy.tsx` — unchanged

Still exports the lazy component. Lazy + non-lazy route file pair is the standard TanStack Start pattern: `head()` and `loader` run on the server in the non-lazy file; the heavy component code-splits via the lazy file.

## What this fixes per platform

| Platform | Before | After |
|---|---|---|
| WhatsApp | generic site card | thumbnail + title + description |
| Telegram | generic card | thumbnail + inline play button |
| Instagram DM | URL only | thumbnail + title |
| iMessage | small URL chip | large rich preview with thumbnail |
| Twitter/X | summary card | player card with inline video |
| LinkedIn | generic | thumbnail + title + description |
| Google search | no rich result | VideoObject rich snippet |

## Caveats to call out

- **Cache busting**: WhatsApp, Facebook, and LinkedIn aggressively cache previews per URL. For URLs already shared before this fix, the old preview will stick until the cache expires (hours to days) or the URL is re-scraped via Facebook's Sharing Debugger / LinkedIn's Post Inspector. New shares will work immediately.
- **Inline player support varies**: Only Twitter and Telegram render `og:video` as an actual inline player. WhatsApp and Instagram only ever show the thumbnail + title (this is a platform limitation, not ours — YouTube has the same behavior on WhatsApp).
- **Thumbnail required for best result**: Videos without a `thumbnail_url` will get a text-only card. We already auto-extract a frame in `VideoThumbnail.tsx` for in-app previews; consider a follow-up to also persist that frame as `thumbnail_url` on upload so every video has one. Out of scope for this prompt.
- **CORS / direct R2 URLs**: `og:video` should point to a publicly accessible MP4 (R2 public URL) — confirmed already the case for `public_url`.

## Files touched

- `src/routes/v.$id.tsx` — add loader + head + JSON-LD
- `src/pages/PublicVideoPage.tsx` — remove client-side meta useEffect

No backend, schema, RLS, or edge function changes.