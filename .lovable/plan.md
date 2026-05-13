## Goal
Remove the primary-color highlight on the "n" in the nFlow wordmark, and switch the weight pairing so "n" renders in a lighter (non-bold) weight while "Flow" stays bold. Same foreground color for both letters.

## Files to update

1. **`src/components/landing/Logo.tsx`**
   - Drop `color: hsl(var(--primary))` on the `n` span — both `n` and `Flow` use `hsl(var(--foreground))`.
   - Split weights: wrap `n` in `fontWeight: 400` (regular) and `Flow` in `fontWeight: 800` (extrabold). Keep the shared Plus Jakarta Sans family + tight letter-spacing on the parent.

2. **`src/components/brand/NFlowLogo.tsx`**
   - Remove the `nColor` (primary) variant logic; use the same `flowColor` token for both letters.
   - Replace the single `font-extrabold` wrapper with per-letter weights: `<span className="font-normal">n</span><span className="font-extrabold">Flow</span>`.
   - Keep size map, byline ("by Nevorai"), tagline, and `variant` (default / white / dark) behavior unchanged.

3. **`src/components/landing/AnimatedLogo3D.tsx`** — no change (image-based mark, not the wordmark).

## Out of scope
- No changes to colors elsewhere, byline, tagline copy, sizing, or layout.
- No edits to Supabase, auth, payments, uploads, or routes.
- The favicon/logo image (`nevorai-mark.png`) is untouched.

## Verification
- Visually confirm the dashboard sidebar logo, mobile header logo, and any landing surfaces render `n` thin + `Flow` bold, both in foreground color.
- `npm run build` runs automatically — confirm zero TS errors.
