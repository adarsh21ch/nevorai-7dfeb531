-- Share landing-page leads with team members
-- Run this once in your Supabase SQL editor. Idempotent — safe to re-run.

-- 1. Tokenised share links per landing page (owner-managed)
create table if not exists public.landing_page_shares (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  role text not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists landing_page_shares_lp_idx on public.landing_page_shares(landing_page_id);
create index if not exists landing_page_shares_owner_idx on public.landing_page_shares(owner_id);

grant select, insert, update, delete on public.landing_page_shares to authenticated;
grant all on public.landing_page_shares to service_role;

alter table public.landing_page_shares enable row level security;

drop policy if exists "shares_owner_all" on public.landing_page_shares;
create policy "shares_owner_all" on public.landing_page_shares
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "shares_read_active" on public.landing_page_shares;
create policy "shares_read_active" on public.landing_page_shares
  for select to authenticated
  using (is_active = true);

-- 2. Collaborators (who accepted a share)
create table if not exists public.landing_page_collaborators (
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  granted_via_token text,
  joined_at timestamptz not null default now(),
  primary key (landing_page_id, user_id)
);

create index if not exists lp_collab_user_idx on public.landing_page_collaborators(user_id);

grant select, insert, update, delete on public.landing_page_collaborators to authenticated;
grant all on public.landing_page_collaborators to service_role;

alter table public.landing_page_collaborators enable row level security;

drop policy if exists "collab_self_read" on public.landing_page_collaborators;
create policy "collab_self_read" on public.landing_page_collaborators
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "collab_owner_read" on public.landing_page_collaborators;
create policy "collab_owner_read" on public.landing_page_collaborators
  for select to authenticated
  using (
    exists (select 1 from public.landing_pages lp
            where lp.id = landing_page_collaborators.landing_page_id
              and lp.owner_id = auth.uid())
  );

drop policy if exists "collab_owner_delete" on public.landing_page_collaborators;
create policy "collab_owner_delete" on public.landing_page_collaborators
  for delete to authenticated
  using (
    exists (select 1 from public.landing_pages lp
            where lp.id = landing_page_collaborators.landing_page_id
              and lp.owner_id = auth.uid())
  );

-- 3. Accept share RPC
create or replace function public.accept_landing_page_share(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_share record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_share from public.landing_page_shares
   where token = p_token and is_active = true
   limit 1;

  if v_share is null then
    raise exception 'Invalid or inactive share link';
  end if;

  insert into public.landing_page_collaborators
    (landing_page_id, user_id, role, granted_via_token)
  values
    (v_share.landing_page_id, auth.uid(), v_share.role, p_token)
  on conflict (landing_page_id, user_id) do nothing;

  return v_share.landing_page_id;
end;
$$;

grant execute on function public.accept_landing_page_share(text) to authenticated;

-- 4. Minimal info for the invite gate (non-PII)
create or replace function public.get_landing_page_share_info(p_token text)
returns table (
  landing_page_id uuid,
  landing_page_title text,
  owner_name text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select lp.id, lp.title,
         coalesce(p.full_name, p.email, 'A Nevorai user') as owner_name,
         s.is_active
  from public.landing_page_shares s
  join public.landing_pages lp on lp.id = s.landing_page_id
  left join public.profiles p on p.id = s.owner_id
  where s.token = p_token
  limit 1;
end;
$$;

grant execute on function public.get_landing_page_share_info(text) to anon, authenticated;

-- 5. Extend landing_page_registrations RLS: collaborators can read
drop policy if exists "registrations_collab_read" on public.landing_page_registrations;
create policy "registrations_collab_read" on public.landing_page_registrations
  for select to authenticated
  using (
    exists (
      select 1 from public.landing_page_collaborators c
      where c.landing_page_id = landing_page_registrations.landing_page_id
        and c.user_id = auth.uid()
    )
  );

-- 6. Realtime on the registrations table (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'landing_page_registrations'
  ) then
    execute 'alter publication supabase_realtime add table public.landing_page_registrations';
  end if;
exception when others then null;
end $$;
