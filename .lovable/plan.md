# Fix: Creator DP + name not showing on video preview

## Why it's broken

`PublicVideoPage.tsx` (line 110–135) reads the creator from a Supabase view called `profiles_public`:

```ts
supabase.from("profiles_public")
  .select("id, display_name, avatar_url, is_verified, username, cta_label, cta_url")
  .eq("id", video.owner_id)
```

That view **does not exist in the database**. The migration that creates it (`creator_identity_verification_migration.sql`) lives at the project root but was never moved into `supabase/migrations/` and never applied. The query fails silently (`if (error) return null`), so `creatorProfile` is always `null` and the creator row is skipped on every video.

## Fix

1. Create a real, timestamped migration under `supabase/migrations/` that:
   - Ensures `profiles` has the columns the view selects: `display_name`, `avatar_url`, `is_verified`, `username`, `cta_label`, `cta_url` (add any that are missing; leave existing ones alone).
   - Creates `public.profiles_public` as a `security_invoker=on` view that selects ONLY public-safe columns from `profiles` (no email, phone, address, KYC docs).
   - Grants `SELECT` on the view to `anon` and `authenticated` (public watch page is unauthenticated, so `anon` is required).
   - Confirms RLS on `profiles` itself stays restrictive — public reads go through the view, not the base table.
2. Delete the stale root-level `creator_identity_verification_migration.sql` so it's not mistaken for an applied migration.
3. After the migration runs, hard-refresh the public video page; the creator avatar, display name, verified tick, and optional CTA will render.

## Out of scope (intentionally)

- No changes to `PublicVideoPage.tsx` — the query is already correct.
- No KYC / admin / profile-editor work in this pass — that surface is already wired and only blocked by the same missing view.
- No styling changes to the creator row.

## Technical details

- View shape:
  ```sql
  CREATE OR REPLACE VIEW public.profiles_public
  WITH (security_invoker=on) AS
  SELECT id, display_name, avatar_url, is_verified, username, cta_label, cta_url
  FROM public.profiles;

  GRANT SELECT ON public.profiles_public TO anon, authenticated;
  ```
- `security_invoker=on` means the view runs with the caller's privileges, so RLS on `profiles` is still honored — anon only sees rows that a `profiles` RLS policy allows. If `profiles` currently has no anon-readable policy, add a narrow one limited to the public-safe columns scenario (read everyone's row, but only via this view).
- File naming: use the next Supabase timestamp prefix (`YYYYMMDDHHMMSS_creator_profiles_public.sql`).
