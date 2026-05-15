# Admin-Managed Landing Content + Settings Tabs

## Goal
1. Let you upload/replace every landing page image (and edit its title/subtitle/bullets) from the admin panel — no more re-prompting the LLM or redeploying.
2. Reorganise `/admin/settings` into a clean tabbed layout (sidebar on desktop, horizontal scroll tabs on mobile) so each setting group has its own page.
3. Add tasteful image animations (fade-in, parallax-on-scroll, subtle zoom on hover, Ken-Burns drift) so any photo you upload automatically feels alive.

---

## 1. Database + Storage

**New table `landing_content`** (single row per "slot"):
```
id           text primary key   -- e.g. "story.skip", "story.unknown", "compare.youtube", "compare.nevorai"
section      text               -- "story" | "compare" | "hero"
sort_order   int
title        text
subtitle     text
bullets      jsonb              -- string[]
image_url    text               -- public storage URL
animation    text               -- "fade-up" | "parallax" | "ken-burns" | "zoom-hover"
updated_at   timestamptz
```
- RLS: public `select`, admin-only `insert/update`.
- Seeded with the current 6 story sections + 2 comparison sections + their existing image paths (so nothing breaks before you edit anything).

**New storage bucket `landing-images`** (public read, admin-only write).

---

## 2. Admin Settings — tabbed layout

Refactor `AdminSettingsPage` into a parent layout with sub-tabs:

```
/admin/settings              → Gmail
/admin/settings/announcement → Announcement banner
/admin/settings/maintenance  → Maintenance mode
/admin/settings/verification → Verified badge toggle
/admin/settings/creator      → Testimonials + creator settings
/admin/settings/landing      → ★ NEW: Landing page content manager
```

- **Desktop**: vertical sidebar (200px) on the left, content on the right.
- **Mobile**: horizontal scroll tab bar at the top (same pattern as existing `AdminLayout` tabs).
- Each tab is its own component — no giant single page.

### New tab: "Landing Page Content"
A list of cards, one per slot, grouped by section ("Story sections", "Comparison: YouTube vs Nevorai", "Hero"). Each card shows:
- Current image preview (with replace button → uploads to `landing-images` bucket)
- Editable title, subtitle, bullets (textarea, one per line)
- Animation dropdown: Fade up / Parallax / Ken-Burns / Zoom on hover
- Drag handle to reorder (updates `sort_order`)
- Save button (per card) with optimistic update + toast

---

## 3. Wire the landing page to the DB

- `StorySections.tsx` and `ResultsComparison.tsx` fetch from `landing_content` via React Query (5-min cache, public read).
- Fall back to the existing bundled images if a row has no `image_url` yet → zero-downtime migration.
- New `<AnimatedImage>` wrapper component handles the four animation modes uniformly using framer-motion + `useInView`. Any uploaded image automatically gets:
  - aspect-ratio lock (16:10) + `object-cover` for consistent framing
  - rounded corners + brand shadow from design tokens
  - the chosen entrance animation
  - subtle hover state

---

## 4. Mobile + desktop polish
- All admin tabs tested at 375px and 1280px.
- Image cards stack vertically on mobile, 2-up on desktop.
- Upload uses the same R2/Supabase storage flow already in the project.

---

## Files

**New**
- `supabase/migrations/<ts>_landing_content.sql` (table + RLS + bucket + seed)
- `src/components/admin/settings/SettingsTabs.tsx` (sidebar + mobile tab bar)
- `src/components/admin/settings/LandingContentManager.tsx`
- `src/components/admin/settings/LandingSlotCard.tsx`
- `src/components/landing/AnimatedImage.tsx`
- `src/hooks/useLandingContent.ts`
- `src/routes/admin.settings.announcement.tsx` + `.lazy.tsx`
- `src/routes/admin.settings.maintenance.tsx` + `.lazy.tsx`
- `src/routes/admin.settings.verification.tsx` + `.lazy.tsx`
- `src/routes/admin.settings.creator.tsx` + `.lazy.tsx`
- `src/routes/admin.settings.landing.tsx` + `.lazy.tsx`

**Edited**
- `src/pages/AdminSettingsPage.tsx` → split into per-tab pages, becomes Gmail tab only
- `src/components/landing/StorySections.tsx` → read from `landing_content`, use `<AnimatedImage>`
- `src/components/landing/ResultsComparison.tsx` → same
- `src/routes/admin.settings.tsx` → wraps children with `<SettingsTabs>` layout

**Untouched**: hero, navigation, pricing, FAQ, auth, edge functions, Razorpay, public video page.

---

## What I'll need from you after build
1. Run the SQL migration (I'll print it — same flow as last time).
2. Open `/admin/settings/landing` and upload your improved images. Existing bundled images keep working until you replace them.

Confirm this plan and I'll build it end-to-end.
