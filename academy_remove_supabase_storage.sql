-- Optional cleanup: remove the old Supabase Storage bucket previously used by Nevorai Academy.
-- Run this only if you no longer need any files inside `academy-videos`.

drop policy if exists "Public read academy videos" on storage.objects;
drop policy if exists "Admins upload academy videos" on storage.objects;
drop policy if exists "Admins update academy videos" on storage.objects;
drop policy if exists "Admins delete academy videos" on storage.objects;

delete from storage.objects where bucket_id = 'academy-videos';
delete from storage.buckets where id = 'academy-videos';