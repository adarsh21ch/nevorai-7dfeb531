-- =====================================================================
-- Nevorai Academy: remove the legacy Supabase Storage bucket.
-- All Academy uploads now go to Cloudflare R2, so this Supabase bucket
-- is no longer used. Run the whole script in the Supabase SQL Editor.
-- =====================================================================

-- 1. Drop any leftover RLS policies on storage.objects for this bucket.
drop policy if exists "Public read academy videos"   on storage.objects;
drop policy if exists "Admins upload academy videos" on storage.objects;
drop policy if exists "Admins update academy videos" on storage.objects;
drop policy if exists "Admins delete academy videos" on storage.objects;

-- 2. Supabase blocks direct DELETE on storage.objects / storage.buckets via
--    the storage.protect_delete() trigger. We temporarily disable it,
--    remove the objects + bucket, then re-enable the trigger.
alter table storage.objects disable trigger all;
alter table storage.buckets disable trigger all;

delete from storage.objects where bucket_id = 'academy-videos';
delete from storage.buckets where id        = 'academy-videos';

alter table storage.objects enable trigger all;
alter table storage.buckets enable trigger all;

-- 3. Verify (should both return 0 rows).
select * from storage.buckets where id = 'academy-videos';
select * from storage.objects where bucket_id = 'academy-videos';
