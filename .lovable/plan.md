
# Stop Supabase egress hits — caching + image optimization

No storage migration. Files stay on Supabase. We add 1-year cache headers, compress images client-side to WebP, lazy-load below-the-fold images, and backfill metadata on existing files.

## Audit (already done — call sites that upload to Supabase Storage)

| File | Bucket | Currently |
|---|---|---|
| `src/components/ProfilePhotoCropModal.tsx` | `avatars` | no cacheControl, JPEG 512×512 q0.9 |
| `src/components/funnel/TestimonialPhotoUpload.tsx` | `landing-page-assets` | no cacheControl, JPEG 400×400 q0.9 |
| `src/components/funnel/TestimonialVideoUpload.tsx` | `landing-page-assets` | no cacheControl (video + thumbnail) |
| `src/components/funnel/AudioNoteRecorder.tsx` | (param) | no cacheControl |
| `src/components/funnel/SpeakerPhotoUpload.tsx` | (likely landing-page-assets) | `cacheControl: "3600"` |
| `src/components/ui/image-upload-field.tsx` | `landing-page-assets` (configurable) | `cacheControl: "3600"` |
| `src/pages/LandingPageEditor.tsx` | `landing-page-attachments` | no cacheControl |
| `src/components/admin/settings/LandingContentTab.tsx` | `landing-images` | no cacheControl |
| `src/components/admin/WhatsAppMediaTab.tsx` | `whatsapp-media` | no cacheControl |
| `src/pages/AdminKYCPage.tsx` | `kyc-documents` | signed URLs, leave as-is |

R2 uploads (`VideoUploadModal`, `AdminVideosPage`, `AcademyTab`) already serve from R2 — out of scope.

## Step 1 — Shared image-compression helper

Create `src/lib/imageCompress.ts`:
- `compressImage(file, { maxDim, quality, type })` using `createImageBitmap` + `OffscreenCanvas` → WebP blob.
- Fallback to `HTMLCanvasElement` when `OffscreenCanvas` / `convertToBlob` unavailable (Safari quirks).
- Skip compression if file already WebP and within size budget.
- Preset constants: AVATAR (256, 0.85), TESTIMONIAL_PHOTO (400, 0.85), LANDING_IMAGE (1200, 0.85).

## Step 2 — Add `cacheControl: "31536000"` + WebP compression to every upload

Touch each call site to:
1. Compress with the appropriate preset (skip for video, audio, KYC).
2. Pass `cacheControl: "31536000"` and `contentType: "image/webp"` (or original for non-image).
3. Use `.webp` extension in the storage path so the filename matches the bytes.

Per file:
- `ProfilePhotoCropModal.tsx` — replace JPEG canvas export with `compressImage(blob, AVATAR)`; path `${userId}/avatar-${ts}.webp`.
- `TestimonialPhotoUpload.tsx` — compress cropped canvas blob with TESTIMONIAL_PHOTO preset; `.webp` path.
- `TestimonialVideoUpload.tsx` — keep video as-is (just add cacheControl); compress the auto-thumbnail with TESTIMONIAL_PHOTO preset.
- `SpeakerPhotoUpload.tsx` — AVATAR-ish preset (or TESTIMONIAL_PHOTO); update cacheControl `3600` → `31536000`.
- `image-upload-field.tsx` — LANDING_IMAGE preset; cacheControl `3600` → `31536000`.
- `LandingPageEditor.tsx` (attachments uploader at L731) — LANDING_IMAGE preset if image, else passthrough; add cacheControl.
- `LandingContentTab.tsx` — LANDING_IMAGE preset; add cacheControl.
- `WhatsAppMediaTab.tsx` — add cacheControl only (mixed media types — don't transform).
- `AudioNoteRecorder.tsx` — add cacheControl only (audio).
- `AdminKYCPage.tsx` — **leave alone** (private, signed URLs, must remain original).

## Step 3 — Backfill cache metadata on existing files

Add a SQL migration `backfill_storage_cache_headers.sql` that updates `storage.objects.metadata.cacheControl` to `max-age=31536000` for buckets: `avatars`, `landing-images`, `landing-page-assets`, `landing-page-attachments`, `whatsapp-media`. Excludes `kyc-documents`. User runs once.

(Skip the edge function approach — SQL update is sufficient and atomic.)

## Step 4 — Lazy-load + dimension hints on `<img>` usage

Pass over the rendering sites that show user-uploaded images and add `loading="lazy"` + `decoding="async"` + explicit `width`/`height` where the slot is known:
- `TestimonialsViewer.tsx`, `LandingPagePreview.tsx`, `FunnelLivePreview.tsx`, `MultiStepViewer.tsx`, `CodeGateScreen.tsx`, `LandingPageCodeGate.tsx`, `PublicLandingPage.tsx`, `PublicFunnel.tsx`, `PublicLivePage.tsx` — testimonial photos, speaker photos, hero images.
- `EntityCard.tsx`, `LatestVideoShareCard.tsx`, `ProfilePage.tsx` (avatar lists) — dashboard avatars.
- Above-the-fold hero in `landing/AnimatedImage.tsx` stays eager.
- `VideoThumbnail.tsx` already uses `loading="lazy"` on `<img>`.

Skip touching: `AdminKYCPage.tsx`, `InstallApp.tsx` (static), `HelpCenterPage.tsx` (static).

## Step 5 — Verification (manual, after deploy)

Document in commit message + chat reply:
1. Upload a new avatar → confirm file is .webp, ~10 kB, response header `cache-control: max-age=31536000`.
2. Run the SQL backfill in Supabase SQL editor.
3. `curl -I` one existing avatar URL → should now report `cache-control: max-age=31536000`.
4. DevTools → reload dashboard → avatars show "from disk cache".

## Out of scope (explicit)

- Admin "Storage Health" dashboard panel (Step 8 in the brief) — skipped this round to keep scope tight; can add later if you want a UI for the backfill.
- Re-compressing legacy uploads to WebP — leaving them as JPEG, just adding cache headers. The bandwidth win comes from caching; per-file size matters less once they're cached.
- R2 migration — not needed at current scale.

## Files changed

New:
- `src/lib/imageCompress.ts`
- `backfill_storage_cache_headers.sql`

Edited (upload call sites):
- `src/components/ProfilePhotoCropModal.tsx`
- `src/components/funnel/TestimonialPhotoUpload.tsx`
- `src/components/funnel/TestimonialVideoUpload.tsx`
- `src/components/funnel/SpeakerPhotoUpload.tsx`
- `src/components/funnel/AudioNoteRecorder.tsx`
- `src/components/ui/image-upload-field.tsx`
- `src/pages/LandingPageEditor.tsx`
- `src/components/admin/settings/LandingContentTab.tsx`
- `src/components/admin/WhatsAppMediaTab.tsx`

Edited (lazy-load + dimensions on `<img>`):
- `src/components/funnel/TestimonialsViewer.tsx`
- `src/components/funnel/LandingPagePreview.tsx`
- `src/components/funnel/FunnelLivePreview.tsx`
- `src/components/funnel/MultiStepViewer.tsx`
- `src/components/funnel/CodeGateScreen.tsx`
- `src/components/funnel/LandingPageCodeGate.tsx`
- `src/components/funnel/PrivateLeadForm.tsx`
- `src/components/funnel/PerStepSpeakerAssignment.tsx`
- `src/components/insights/EntityCard.tsx`
- `src/components/dashboard/LatestVideoShareCard.tsx`
- `src/pages/PublicLandingPage.tsx`
- `src/pages/PublicFunnel.tsx`
- `src/pages/PublicLivePage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/LivePage.tsx`
- `src/pages/FunnelEditor.tsx`
