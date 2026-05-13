## Goal
Use the full brand name **"Nevorai Flow"** in the marketing header (navbar) and footer wordmark, instead of the current "nFlow / by Nevorai" lockup. Keep the short "nFlow" form only in tight, in-app spaces where the small app icon already carries the brand (sidebar collapsed, mobile header, favicon-adjacent UI, copy-link buttons, etc.).

This is purely a wordmark/copy change — no color, layout, routing, or logic changes.

## Approach

The `Logo` component (`src/components/landing/Logo.tsx`) currently renders:
- icon + `nFlow` (with split weights on `n` / `Flow`)
- optional `by Nevorai` byline underneath

It's used in two marketing surfaces:
1. **`src/components/landing/Navbar.tsx`** — `<Logo showByline />`
2. **`src/components/landing/Footer.tsx`** — `<Logo size="sm" />`

I'll add a new `variant` prop to `Logo` so callers can choose between the short form and the full form, without touching any other place that imports `Logo`.

### Files to update

1. **`src/components/landing/Logo.tsx`**
   - Add `variant?: "short" | "full"` prop (default `"short"` — preserves current behavior everywhere else).
   - When `variant="full"`: render icon + the wordmark **"Nevorai Flow"** as a single line. Keep Plus Jakarta Sans, tight letter-spacing, foreground color. Use `font-weight: 600` for "Nevorai" and `font-weight: 800` for "Flow" so it visually echoes the existing `n` (light) + `Flow` (bold) pairing. No byline (the full name is self-explanatory).
   - When `variant="short"`: keep the existing `n` + `Flow` + optional `by Nevorai` byline exactly as it is today.

2. **`src/components/landing/Navbar.tsx`**
   - Replace `<Logo showByline />` with `<Logo variant="full" />` (desktop + mobile both use the same `<Logo>` instance, so a single edit covers both).

3. **`src/components/landing/Footer.tsx`**
   - Replace `<Logo size="sm" />` with `<Logo variant="full" size="sm" />`.

### Out of scope
- Sidebar / mobile app header / auth page logo — these stay on the short `nFlow` form (compact UI where the icon carries the brand).
- `NFlowLogo.tsx` (in-app brand component) — unchanged.
- `brand.ts` config, page titles, copy strings, watermark text — unchanged (these already say "Nevorai Flow").
- No color, gradient, font, spacing, or animation changes.
- No backend, routing, or data changes.

## Verification
- Reload `/` and confirm the navbar (top-left) and footer (bottom-left) both read **"Nevorai Flow"** in one line, no "by Nevorai" byline.
- Confirm dashboard sidebar, mobile dashboard header, and auth page still show the compact `nFlow` wordmark (unchanged).
- Light/dark contrast unchanged — both letters use `hsl(var(--foreground))`.
- `npm run build` passes (auto-run).
