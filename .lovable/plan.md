# Wave 1 — Ship Today

Three fixes in one PR. All changes must pass `npm run build`.

## 1. C1 — Dashboard hooks reorder

**File:** `src/pages/Dashboard.tsx`

**Problem:** `useQuery` and other hooks are called after early returns (`if (authLoading) return ...`), violating Rules of Hooks. This is the root cause of the recurring "Something went wrong" boundary trip.

**Fix:** Move ALL hook calls (`useAuth`, `useQuery`, `useStorageUsage`, `useState`, `useEffect`, `useNavigate`, etc.) to the top of the component, before any conditional return. Loading/error/empty states render via JSX branches at the bottom, not via early returns that skip hooks.

## 2. C2 — Free-user upload unblock

**Files:**
- `src/hooks/useStorageUsage.ts`
- SQL update to `plan_config` table (free plan row)

**Problem:** `data?.max_storage_mb ?? FREE_FALLBACK_MB` — nullish coalescing only fires on `null`/`undefined`. The DB row exists with `max_storage_mb = 0`, so the expression resolves to `0` and every upload is rejected as "over quota".

**Fix:**
- Replace `??` with `||` so `0` falls back to `FREE_FALLBACK_MB` (defensive).
- Run SQL `UPDATE plan_config SET max_storage_mb = 1024 WHERE plan_id = 'free'` (real fix — restore intended free quota).
- Audit other `?? FREE_FALLBACK` patterns in the same hook for the same bug.

## 3. M1 + M3 + M9 + Part D — Upload modal copy, format leniency, server-side size cap

**Files:**
- `src/components/upload/VideoUploadModal.tsx` (or current modal path)
- `supabase/functions/get-r2-upload-url/index.ts`

**M1 — Copy cleanup:** Replace generic "Upload failed" / "Something went wrong" toasts with specific, actionable messages ("File too large — your plan allows up to {N} MB", "Format not supported — try MP4 or MOV", etc.).

**M3 — Friendly empty/error states:** Replace red error blocks with neutral guidance + retry CTA.

**M9 — Format leniency:** Expand accepted MIME types and extensions (mp4, mov, webm, m4v, mkv, avi). Replace hard rejection with a soft suggestion when the format is unusual but probably playable; only hard-reject truly unsupported formats.

**Part D (server-side file size validation):** In `get-r2-upload-url`, validate `fileSize` against the user's plan max BEFORE returning the presigned URL. Reject with 400 + clear error if oversized. (Full quota/storage check arrives in Wave 2 / C3 — this pass only validates per-file size.)

## Verification (manual, performed before handing off)

1. Open `/dashboard` as authenticated user → no boundary, no "Something went wrong" toast. Reload 5×, navigate away and back.
2. As free user (plan = `free`), upload a ~100 MB MP4 → completes; storage bar updates.
3. Try uploading a 600 MB file as free user → modal shows "File too large — free plan allows up to {N} MB", no presigned URL issued (verified via network tab + edge function logs).
4. Try `.mkv` → accepted with soft notice. Try `.txt` → cleanly rejected with format-specific copy.
5. `npm run build` — zero TypeScript errors.

## Out of scope for Wave 1
Items 4–10 (C3 server quota, H4 strict feature flag, modal redesign, useAuth memo, _authenticated migration, lazy-splits, perf pass) — Wave 2 / Wave 3.

## Technical details
- No schema changes; only data UPDATE on `plan_config`.
- No new dependencies.
- Modal file path will be confirmed during implementation; if logic is split across hook + modal, both get the matching error-copy update.