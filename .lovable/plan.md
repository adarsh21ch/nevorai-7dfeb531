## Nevorai Monochrome Rebrand — Landing Page

A focused rebrand of the **landing page only**. Light mode becomes the default. The only color on the page is the saffron primary CTA. Theme toggle in nav. App/dashboard/admin pages are out of scope.

### 1. Design tokens (`src/styles.css`)
- Replace landing surface tokens with: `--bg-base`, `--bg-elevated`, `--bg-glass`, `--border-subtle`, `--border-strong`, `--text-primary/secondary/tertiary`, `--logo-color`, `--accent-cta` (#F97316), `--accent-cta-hover`, `--accent-cta-glow`.
- Light mode = default `:root`. Dark mode = `[data-theme="dark"]` overrides.
- Remove `.gradient-text`, `.gradient-primary`, `.text-gradient-hero`, hero blob gradients, animated grid, color radial backgrounds — replace with monochrome utility classes (`.btn-saffron`, `.btn-glass-mono`, `.badge-mono`, `.card-mono`, `.logo-halo`).
- Keep saffron CTA gradient (single allowed colored element).

### 2. Theme toggle (Navbar)
- Add 36×36 icon button between FAQ and Log in (Sun/Moon from lucide-react), `useTheme()` hook already exists.
- Rewrite Navbar to use semantic tokens (`text-primary`, `bg-base/80`, `border-subtle`) — drop hardcoded `text-white`, `bg-hero-bg`, gradient backgrounds.
- Use Case dropdown icons drop `bg-gradient-brand`, become monochrome (border + foreground icon).
- Mobile version mirrors the same.

### 3. Logo
- Convert mark to inline SVG component that uses `currentColor` (replaces PNG imports for landing usage). Set color via `var(--logo-color)`.
- Halo glow becomes white (dark) / saffron (light) via CSS class `.logo-halo`. Dot opacity pulse animation kept.
- Existing PNG logo retained for non-landing surfaces to avoid touching dashboard.

### 4. Hero (`HeroSection.tsx`)
- Remove `<FlowParticles />` and `bg-gradient-hero-glow`.
- Background = `bg-base` (white default).
- Replace cyan "Built for Creators Who Sell" badge with `.badge-mono`.
- Both headline lines = `text-primary`, no gradient. "Twice the conversion." gets `italic` for subtle emphasis.
- CTA buttons reuse `.btn-saffron` + `.btn-glass-mono`.
- Optional 3% noise overlay for paper-texture depth.

### 5. Comparison (`ResultsComparison.tsx`)
- YouTube ✗ → `text-tertiary` (muted), not bright red.
- Nevorai ✓ → first row uses `text-accent-cta` (saffron), rest use `text-primary`.

### 6. Other landing sections (Features, HowItWorks, Pricing, FAQ, ProblemSolution, Footer, etc.)
- Sweep: replace `bg-hero-bg`, `text-white`, `text-hero-muted`, `bg-gradient-brand`, `text-brand-emerald`, colored glows, particle/blob backgrounds with the new monochrome tokens and utility classes.
- All section badges → `.badge-mono`.
- All cards → `.card-mono`.
- Remove FlowParticles imports anywhere they appear.

### 7. Verification
- `npm run build` passes.
- Visit `/` in browser, screenshot light + dark hero, comparison section, mobile (375px) light + dark.
- Confirm: no cyan/blue/purple anywhere, logo inverts cleanly, CTA is the only color, theme toggle persists.

### Out of scope (not touched)
- Routing, auth, Supabase, admin panel, dashboard, funnel/landing-page editors, app pages, copy text.
- Existing PNG logo files (kept so non-landing surfaces don't break).

### Technical notes
- Inline SVG logo component lives at `src/components/landing/LogoMark.tsx` so theming works via `currentColor`.
- Theme provider already wired in `__root.tsx` (verified — `useTheme` exists). Only adding the toggle UI.
- Sweep is mechanical class replacement across ~15 landing components; no logic changes.
