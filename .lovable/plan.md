
# Design System Refactor — Whole App

**Goal:** Same look. Better bones. Pages become token-driven, theme-aware, responsive, and 3-5× faster to change going forward.

**Scope:** ~141 components + ~50 pages. Done in 6 phases over multiple turns. Each phase ends with a visual diff so you can confirm nothing looks different.

**Non-goals:** No new features. No visual redesign. No backend changes. Same copy, same icons, same flows.

---

## Current state (audit numbers)

- **191 files** in `src/components` + `src/pages`
- **41 files** use `style={{...}}` inline styles
- **33 files** use hardcoded hex colors (`#00C896`, `#0066FF`, `#EF4444`, etc.)
- **17 files** use `rgba(...)` directly
- **1 file** still imports from `react-router-dom`
- `src/styles.css` is only 179 lines — design tokens basically don't exist yet

---

## Phase 1 — Build the design system foundation

**One turn. No visual change.**

1. Define semantic tokens in `src/styles.css` (oklch values):
   - **Brand**: `--brand-emerald` (#00C896), `--brand-blue` (#0066FF), `--brand-red` (#EF4444)
   - **Gradients**: `--gradient-brand`, `--gradient-danger`, `--gradient-subtle`
   - **Surfaces**: `--surface-1`, `--surface-2`, `--surface-glass`, `--border-subtle`, `--border-strong`
   - **Shadows**: `--shadow-glow-brand`, `--shadow-glow-danger`, `--shadow-elegant`
   - **Hero/marketing-only**: `--hero-bg`, `--hero-text`, `--hero-muted`
2. Wire all tokens into Tailwind via `@theme` so classes like `bg-brand-emerald`, `text-hero-muted`, `shadow-glow-brand`, `bg-gradient-brand` exist.
3. Add typography scale tokens: `--font-display`, `--font-body` + utility classes.
4. Add responsive container utility: `.container-app` = `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
5. Document the token map in `src/styles.css` as a comment block (so future you can find them).

**Deliverable:** `src/styles.css` grows from 179 → ~400 lines. Zero component changes. App looks identical.

---

## Phase 2 — Refactor the landing/marketing pages

**One turn. ~18 files.**

Targets: `src/components/landing/*` + `src/pages/Index.tsx`.

For each component:
- Replace `style={{ background: "#00C896" }}` → `className="bg-brand-emerald"`
- Replace `style={{ background: "linear-gradient(...)" }}` → `className="bg-gradient-brand"`
- Replace ad-hoc `rgba(255,255,255,0.04)` → `bg-surface-glass`
- Replace `style={{ color: "#8896B3" }}` → `text-hero-muted`
- Replace `container max-w-3xl` → `container-app max-w-3xl`
- Fix responsive font sizes: `text-3xl sm:text-4xl md:text-5xl` instead of `clamp()` inline
- Deduplicate: extract a single `<FunnelRow>` component and feed both YouTube/nFlow datasets into it (kills ~100 duplicated lines in `LeakyFunnel.tsx`)

**Deliverable:** Visual diff matches Phase 0. Zero hex colors left in landing components.

---

## Phase 3 — Refactor the app shell + auth

**One turn. ~15 files.**

Targets: `DashboardLayout`, `AdminLayout`, `Navbar`, `Footer`, `AuthPage`, `ResetPassword`, `UpdatePassword`, sidebar, top bar.

- Same substitutions as Phase 2
- Audit responsive breakpoints: every layout renders cleanly at 375 / 768 / 1024 / 1440
- Touch targets: every `<Button>`, link, and tab gets `min-h-11` on mobile
- Containers use `container-app`
- Fix the lone remaining `react-router-dom` import

**Deliverable:** Auth + shell are mobile-perfect.

---

## Phase 4 — Refactor dashboard pages

**Two turns. ~25 files.**

Targets: `Dashboard`, `Funnels*`, `LiveSessions*`, `Videos*`, `Leads*`, `Insights*`, `Payments*`, `Notifications*`, `Profile*`, `Settings*`, `Billing*`.

Per page:
- Strip inline styles, replace with token classes
- Wrap content in `container-app`
- Tables become responsive: horizontal scroll inside a card (not the page), or stack-on-mobile cards
- Forms: full-width inputs on mobile, two-column on `md:`
- Cards: consistent `rounded-xl bg-surface-1 border border-border-subtle p-6`

**Deliverable:** Every dashboard page looks the same on desktop, usable on mobile. No horizontal page scroll anywhere.

---

## Phase 5 — Refactor admin + public pages

**One turn. ~20 files.**

Targets: `AdminDashboard`, `AdminUsers`, `AdminSubscriptions`, `AdminSupport`, `AdminKYC`, `AdminVideos`, `AdminWhatsApp`, `AdminSettings`, public funnel/lander pages (`/f/$slug`, `/l/$slug`), legal pages.

Same treatment as Phase 4. Public pages get extra attention since they're seen by prospects on mobile.

**Deliverable:** Admin tables don't break the layout. Public funnel/lander pages render flawlessly on a phone.

---

## Phase 6 — Cleanup + verification

**One turn.**

1. Grep sweep: zero `style={{` for color/background/border anywhere in `src/components` and `src/pages` (inline `style` is OK only for dynamic widths/heights/transforms).
2. Grep sweep: zero raw `#XXXXXX` hex in component files.
3. Visual QA at 5 viewports (375, 768, 1024, 1440, 1920) for: home, auth, dashboard, funnel editor, public funnel, admin users.
4. Console error sweep on each page.
5. Update memory: save the new color tokens and component conventions to `mem://design/tokens` so future sessions follow the system.

**Deliverable:** A short report listing what was checked and what passed.

---

## What you'll see between phases

After each phase I'll show you a screenshot comparison (before/after) at the affected breakpoints, so you can confirm we kept the same look. If any page drifts visually, we adjust the token values, not the component.

## Risks + mitigations

- **Risk:** A token replacement subtly shifts a color. **Mitigation:** Phase 1 defines tokens from the *exact* current hex values. Visual diff per phase catches drift.
- **Risk:** Time. This is ~6 turns of focused work. **Mitigation:** Each phase is independently shippable — you can stop after Phase 2 if you want and the homepage will already be much cleaner.
- **Risk:** I introduce a regression in a page I haven't seen recently. **Mitigation:** I screenshot each page after refactoring before moving on.

## What I will NOT do

- Change copy, headlines, button labels, or imagery
- Reorder sections
- Add or remove features
- Change Supabase queries, RLS, or any business logic
- Touch the database

## Recommended start

Approve the plan → I begin with **Phase 1** (tokens only, zero visual change). That's the lowest-risk step and unlocks everything after.
