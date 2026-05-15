-- Run this in Supabase SQL Editor (one-time).
-- Idempotent: safe to re-run.

create table if not exists public.landing_content (
  id text primary key,
  section text not null,
  sort_order int not null default 0,
  title text,
  subtitle text,
  bullets jsonb not null default '[]'::jsonb,
  image_url text,
  animation text not null default 'fade-up',
  updated_at timestamptz not null default now()
);

alter table public.landing_content enable row level security;

drop policy if exists "landing_content public read" on public.landing_content;
create policy "landing_content public read"
  on public.landing_content for select
  to anon, authenticated
  using (true);

drop policy if exists "landing_content admin write" on public.landing_content;
create policy "landing_content admin write"
  on public.landing_content for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public)
values ('landing-images', 'landing-images', true)
on conflict (id) do nothing;

drop policy if exists "landing-images public read" on storage.objects;
create policy "landing-images public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'landing-images');

drop policy if exists "landing-images admin write" on storage.objects;
create policy "landing-images admin write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'landing-images' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'landing-images' and public.has_role(auth.uid(), 'admin'));

insert into public.landing_content (id, section, sort_order, title, subtitle, bullets, animation) values
  ('story.skip',     'story',   1, 'Your prospects skip your video in the first 30 seconds.', 'On YouTube, Loom, Vimeo — the skip button is always there.', '[]'::jsonb, 'fade-up'),
  ('story.no-skip',  'story',   2, 'With Nevorai, they watch the entire thing.',              'No skip button. No distractions. Just your message, start to finish.', '["91% of viewers watch to the end"]'::jsonb, 'ken-burns'),
  ('story.unknown',  'story',   3, 'You share a video. Then you wonder: did they watch?',     'YouTube doesn''t tell you who opened your link, or how far they got.', '[]'::jsonb, 'fade-up'),
  ('story.realtime', 'story',   4, 'See who watched in real-time. Even mid-meeting.',         'Know exactly who opened your link, from where, on which device — and how much they watched.', '["Live activity updates as they watch"]'::jsonb, 'parallax'),
  ('story.clutter',  'story',   5, 'While they''re watching your pitch, YouTube recommends cat videos.', 'Suggested videos, comments, autoplay — prospects leave mid-message.', '[]'::jsonb, 'fade-up'),
  ('story.clean',    'story',   6, 'Your video. Nothing else. No escape routes.',             'Clean player. No suggestions. No comments. Just your message, full-screen ready.', '["Full attention. Zero leakage."]'::jsonb, 'zoom-hover'),
  ('compare.youtube','compare', 1, 'YouTube Route → 6–8% conversion',                          'Share link → opens YouTube → distractions → leaves without buying.', '["Viewers see 5+ suggested videos","Comments distract them","Autoplay confuses them","Most leave before your pitch ends"]'::jsonb, 'fade-up'),
  ('compare.nevorai','compare', 2, 'Nevorai Route → 16–18% conversion',                        'Share link → opens Nevorai → watches full video → captures lead → converts.', '["Can''t skip, so they watch","Zero distractions, stays focused","Automatic lead capture","Follow-up scheduled instantly"]'::jsonb, 'ken-burns')
on conflict (id) do nothing;
