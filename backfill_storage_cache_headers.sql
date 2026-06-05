-- =====================================================================
-- One-time backfill: set a 1-year Cache-Control on every existing object
-- in our public image/media buckets. Stops Supabase egress from being
-- burned by repeated re-downloads of the same unchanged files.
--
-- Excludes `kyc-documents` because those are served via signed URLs and
-- must not be cached publicly.
--
-- Run ONCE in the Supabase SQL editor after deploying the new upload
-- code paths. New uploads already pass cacheControl: "31536000".
-- =====================================================================

update storage.objects
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{cacheControl}',
  '"max-age=31536000"'
)
where bucket_id in (
  'avatars',
  'landing-images',
  'landing-page-assets',
  'landing-page-attachments',
  'whatsapp-media'
);

-- Spot-check: should report max-age=31536000 for every row.
select bucket_id, metadata->>'cacheControl' as cache_control, count(*) as files
from storage.objects
where bucket_id in (
  'avatars',
  'landing-images',
  'landing-page-assets',
  'landing-page-attachments',
  'whatsapp-media'
)
group by bucket_id, metadata->>'cacheControl'
order by bucket_id;
