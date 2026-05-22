-- Nevorai Academy: tutorials + completions + storage bucket
-- Run this in Supabase SQL editor.

-- 1. Tutorials table
create table if not exists public.academy_tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  video_url text not null,
  thumbnail_url text,
  category text not null default 'getting-started',
  order_index integer not null default 0,
  duration_seconds integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academy_tutorials_order
  on public.academy_tutorials (category, order_index);

alter table public.academy_tutorials enable row level security;

drop policy if exists "Anyone can read published tutorials" on public.academy_tutorials;
create policy "Anyone can read published tutorials"
  on public.academy_tutorials for select
  using (is_published = true);

drop policy if exists "Admins manage tutorials" on public.academy_tutorials;
create policy "Admins manage tutorials"
  on public.academy_tutorials for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Completion tracking per user
create table if not exists public.academy_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  tutorial_id uuid not null references public.academy_tutorials(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, tutorial_id)
);

alter table public.academy_completions enable row level security;

drop policy if exists "Users read own completions" on public.academy_completions;
create policy "Users read own completions"
  on public.academy_completions for select
  using (auth.uid() = user_id);

drop policy if exists "Users write own completions" on public.academy_completions;
create policy "Users write own completions"
  on public.academy_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own completions" on public.academy_completions;
create policy "Users delete own completions"
  on public.academy_completions for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket for tutorial videos (public read, admin write)
insert into storage.buckets (id, name, public)
values ('academy-videos', 'academy-videos', true)
on conflict (id) do nothing;

drop policy if exists "Public read academy videos" on storage.objects;
create policy "Public read academy videos"
  on storage.objects for select
  using (bucket_id = 'academy-videos');

drop policy if exists "Admins upload academy videos" on storage.objects;
create policy "Admins upload academy videos"
  on storage.objects for insert
  with check (bucket_id = 'academy-videos' and public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins update academy videos" on storage.objects;
create policy "Admins update academy videos"
  on storage.objects for update
  using (bucket_id = 'academy-videos' and public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins delete academy videos" on storage.objects;
create policy "Admins delete academy videos"
  on storage.objects for delete
  using (bucket_id = 'academy-videos' and public.has_role(auth.uid(),'admin'));
