## Goal

A purely visual + copy pass. Two outcomes:

1. Replace user-facing "nFlow" / "nFlow by Nevorai" wording with the new brand: **Nevorai Flow**, short form **Flow**, full lockup **Flow by Nevorai**.
2. Make **light theme the default**, with a **deep, trustworthy blue** as the primary color. Dark mode stays available via the existing toggle.

Out of scope (will not touch):
- Razorpay / billing logic, plan limits, webhook code
- Supabase schema, edge functions, RLS, env vars, table/column names
- Video upload pipeline, R2 wiring, funnel/landing/live publish & preview logic
- Auth flows, Google OAuth
- Internal identifiers, file names, env var names, DB-stored slugs (e.g. `nflow-...` slugs stay as-is)
- `manifest.webmanifest` `short_name` (keep for PWA icon stability) — only updates the long `name` field

---

## Phase A — Brand rename (single source of truth first)

`src/config/brand.ts` is already wired as the central brand object. Update its values; downstream components that already read from it pick up the change for free.

New values:
```
name:        "Nevorai Flow"
nameShort:   "Flow"
nameAccent:  "Flow"
fullBrand:   "Flow by Nevorai"
parent:      "Nevorai"
tagline:     "Turn every video into a smart sales funnel."
description: "Upload a video, share a smart link, capture leads. Flow by Nevorai turns every video into a sales funnel."
footer.poweredBy:     "Powered by Nevorai Flow"
footer.poweredByFull: "Powered by Flow by Nevorai"
footer.copyright:     "© {year} Nevorai Flow. All rights reserved."
```

Then sweep the ~50 files that hardcode "nFlow" instead of reading from `brand`. Replace strings only — no logic changes. Mapping rules:

| Context | Replace with |
|---|---|
| SEO title / og:title / apple-mobile-web-app-title (`__root.tsx`, page `head()`) | `Nevorai Flow` |
| Long descriptions / hero copy | `Nevorai Flow` (or `Flow by Nevorai` for the lockup) |
| Sidebar / compact nav logo text | `Flow` with `by Nevorai` underneath if layout allows |
| Footer / public watermark (`BrandingWatermark`, `LandingPagePreview`, public funnel/video/live/LP pages) | `Powered by Nevorai Flow` |
| Toasts, modals, button labels referencing the product (`CopyNflowLinkButton` label, `VideoLinkModal`, `VideoRenameModal`, `VideoUploadModal` done screen, etc.) | `Nevorai Flow` or just `Flow` where space is tight |
| Auth screens (`AuthPage`), onboarding (`Onboarding`, `UploadFirstOnboarding`), member welcome | `Nevorai Flow` |
| Legal pages (`TermsPage`, `PrivacyPage`, `RefundPolicyPage`) — only the displayed brand name, not legal entity references | `Nevorai Flow` |
| Marketing landing (`HeroSection`, `Navbar`, `WhyNevorai`, `Testimonials`, `ProspectJourney`, `PricingSection`) | `Nevorai Flow` headline, taglines updated |
| `useDocumentTitle`, `useCurrency`, certificate generator, hooks that interpolate brand | route through `brand` config |
| `public/manifest.webmanifest` `name` field | `Nevorai Flow` (leave `short_name: "Flow"`) |

Component file names like `CopyNflowLinkButton.tsx` are NOT renamed (avoids churn in import graph). Only the visible label inside changes.

Files identified by grep (will be edited for visible strings only):
- `src/config/brand.ts`, `src/routes/__root.tsx`, `public/manifest.webmanifest`
- Pages: `Dashboard.tsx`, `VideosPage.tsx`, `VideoDetailPage.tsx`, `UploadFirstOnboarding.tsx`, `Onboarding.tsx`, `SettingsPage.tsx`, `BillingPage.tsx`, `PricingFullPage.tsx`, `AboutPage.tsx`, `EnterpriseInquiryPage.tsx`, `TermsPage.tsx`, `PrivacyPage.tsx`, `RefundPolicyPage.tsx`, `PublicVideoPage.tsx`, `PublicFunnel.tsx`, `PublicLandingPage.tsx`, `PublicLivePage.tsx`, `routes/dashboard.tsx`
- Components: `auth/AuthPage.tsx`, `landing/{HeroSection,Navbar,WhyNevorai,Testimonials,ProspectJourney,PricingSection}.tsx`, `funnel/{LandingPagePreview,LandingPageCodeGate,MultiStepViewer,FunnelLivePreview,PrivateLeadForm,member/certificate}.ts(x)`, `BrandingWatermark.tsx`, `CopyNflowLinkButton.tsx`, `VideoUploadModal.tsx`, `VideoLinkModal.tsx`, `VideoRenameModal.tsx`, `RefundRequestModal.tsx`, `MonthlyViewsBanner.tsx`, `TopUpViewsCard.tsx`, `GuaranteeBanner.tsx`, `NevoraiMemberWelcome.tsx`, `billing/ViewCapacityCard.tsx`, `admin/{EnterpriseCardSettings,MemberGatewayTab}.tsx`, `layout/DashboardLayout.tsx` (sidebar logo)
- Hooks: `useDocumentTitle.ts`, `useCurrency.tsx`, `useOwnerBranding.tsx`
- Lib: `lib/liveSession.ts`, `config/planFeatures.ts`

Also add a tagline option `Stop sending plain YouTube links. Send a smart video link that captures leads.` available on the marketing hero (only swap the headline copy, no layout work).

---

## Phase B — Theme: light default + deep-blue primary

### B1. Default to light
`src/hooks/useTheme.tsx` currently initializes `useState<Theme>("dark")`. Change initial state to `"light"`. The localStorage read still respects an existing user preference. Existing toggle in `SettingsPage` keeps working unchanged.

### B2. Re-tune the light palette in `src/styles.css`
Today the light theme uses a teal-green primary (`168 100% 38%`) and a separate cyan accent. Re-tune to a deep, trustworthy blue:

```
[data-theme="light"] {
  --background:        216 33% 98%;   /* clean off-white */
  --foreground:        222 47% 11%;
  --card:              0 0% 100%;
  --card-foreground:   222 47% 11%;
  --popover:           0 0% 100%;
  --popover-foreground:222 47% 11%;

  --primary:           221 83% 45%;   /* deep blue (≈ #1E50C8) */
  --primary-foreground:0 0% 100%;
  --secondary:         210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --accent:            210 100% 56%;  /* light/bright blue accent */
  --accent-foreground: 0 0% 100%;
  --muted:             216 16% 94%;
  --muted-foreground:  215 16% 40%;

  --destructive:       0 75% 50%;     /* red */
  --destructive-foreground: 0 0% 100%;
  --success:           160 70% 36%;   /* green only for success */
  --success-foreground: 0 0% 100%;
  --warning:           38 92% 50%;    /* amber/saffron */
  --warning-foreground: 0 0% 0%;

  --border:            215 20% 80%;   /* visible border, not pure black */
  --input:             216 16% 92%;
  --ring:              221 83% 45%;

  --surface-1:         0 0% 100%;
  --surface-2:         216 16% 96%;
  --surface-glass:     222 47% 11%;
  --border-subtle:     215 20% 80%;
  --border-strong:     215 25% 60%;
}
```

Notes:
- `--border: 0 0% 0%` was forcing pure-black hairlines through the global `* { border-color: hsl(var(--border) / 0.08) }`. New value gives a softer neutral.
- Dark theme tokens left untouched so the existing dark experience is byte-identical.
- Brand gradient utilities (`.gradient-primary`, `.gradient-text`) are kept — they're used on the dark marketing landing and in dark mode and shouldn't be ripped out in this pass.

### B3. Add a light-only subtle gradient surface
Add a `[data-theme="light"] .gradient-bg-subtle` override that uses faint blue tints instead of the dark teal/cyan radials, so light pages don't look one-note.

### B4. Spot-check & fix obvious dark-only assumptions
Search for hardcoded `text-white`, `bg-[#…]`, inline `style={{color:'#fff'}}` on dashboard/app surfaces (NOT marketing landing, which is dark-only by memory rule) and swap to semantic tokens (`text-foreground`, `bg-card`, etc.) where they break in light. Scope cap: app shell + dashboard + Videos page + Video detail page. If anything bigger surfaces, list it and stop — don't expand the pass.

---

## Phase C — Verification (no code, just checks)

1. `bun run build` (typecheck + bundle) — must pass.
2. Open in preview at `/` (marketing), `/auth`, `/dashboard`, `/videos`, `/videos/:id`, a public funnel, public video, public landing, public live. Confirm:
   - Brand text reads "Nevorai Flow" / "Flow by Nevorai" everywhere (no public "nFlow").
   - Light theme renders by default for new visitors; toggle still flips to dark and persists.
   - No pure-white-on-white or pure-black-on-black regressions on the app shell, sidebar, cards, buttons, inputs.
   - Console clean.
3. Confirm marketing landing (which is dark-only per project memory) still looks correct because we didn't change its tokens.

---

## Final report will include

- Files changed grouped by phase
- Confirmation that **no SQL** and **no edge function redeploys** are required
- Any spots where a string was kept (e.g. `manifest.short_name`, `CopyNflowLinkButton` filename) and why
- Manual QA checklist for the user (toggle theme, public funnel, public video, share buttons)

---

## Technical notes

- `useTheme` SSR concern: the initial state runs on server too. Switching default from `"dark"` → `"light"` means SSR markup uses `data-theme="light"`. Users with stored `"dark"` preference will see a one-frame flash on hydration (same behavior as today, just inverted). Acceptable for this pass; a no-flash inline script is out of scope.
- All token edits are in `src/styles.css` `[data-theme="light"]` only — `:root` (which doubles as dark) is untouched, preserving the existing dark experience exactly.
- No component API changes. No new dependencies. No new routes.
