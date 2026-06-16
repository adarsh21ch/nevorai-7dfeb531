-- =====================================================================
-- Nevorai — Unify funnel view tracking on link_events
-- Run AFTER team_tracking_share_links_migration.sql + team_tracking_dashboard_migration.sql.
-- Safe to re-run (idempotent).
-- =====================================================================
create extension if not exists pgcrypto;

-- 1) Owner-default universal share link for every funnel ---------------
create or replace function public.ensure_owner_share_link(p_funnel_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_owner uuid;
begin
  select token into v_token
    from public.funnel_share_links
   where funnel_id = p_funnel_id and is_universal = true
   limit 1;
  if v_token is not null then return v_token; end if;

  select owner_id into v_owner from public.funnels where id = p_funnel_id;
  if v_owner is null then return null; end if;

  v_token := encode(gen_random_bytes(12), 'hex');
  begin
    insert into public.funnel_share_links
      (funnel_id, owner_id, label, token, assigned_user_id, is_universal, is_active)
    values
      (p_funnel_id, v_owner, 'Direct', v_token, v_owner, true, true);
  exception when unique_violation then
    -- another concurrent insert won; fall through
    null;
  end;

  select token into v_token
    from public.funnel_share_links
   where funnel_id = p_funnel_id and is_universal = true
   limit 1;
  return v_token;
end;
$$;
grant execute on function public.ensure_owner_share_link(uuid) to anon, authenticated;

-- Backfill: one universal share-link per existing funnel that lacks one.
insert into public.funnel_share_links
  (funnel_id, owner_id, label, token, assigned_user_id, is_universal, is_active)
select f.id, f.owner_id, 'Direct',
       encode(gen_random_bytes(12), 'hex'),
       f.owner_id, true, true
from public.funnels f
left join public.funnel_share_links sl
       on sl.funnel_id = f.id and sl.is_universal = true
where sl.id is null
on conflict do nothing;

-- 2) Single funnel-event RPC (resolves owner default when no token) ----
create or replace function public.track_funnel_event(
  p_funnel_id uuid,
  p_token text,
  p_step_id uuid,
  p_event_type text,
  p_fingerprint text,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
begin
  if v_token is null then
    v_token := public.ensure_owner_share_link(p_funnel_id);
    if v_token is null then return null; end if;
  end if;
  return public.track_link_event_v2(v_token, p_step_id, p_event_type, p_fingerprint, p_user_agent);
end;
$$;
grant execute on function public.track_funnel_event(uuid, text, uuid, text, text, text) to anon, authenticated;

-- 3) Keep funnels.total_views in sync with link_events -----------------
create or replace function public.bump_funnel_total_views()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type = 'view' then
    update public.funnels
       set total_views = coalesce(total_views, 0) + 1
     where id = new.funnel_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_funnel_total_views on public.link_events;
create trigger trg_bump_funnel_total_views
after insert on public.link_events
for each row execute function public.bump_funnel_total_views();

-- One-shot recompute: align total_views with unique viewers in link_events.
update public.funnels f
   set total_views = coalesce(sub.cnt, 0)
  from (
    select funnel_id,
           count(distinct coalesce(visitor_fingerprint, ip_ua_hash))::int as cnt
      from public.link_events
     where event_type = 'view'
     group by funnel_id
  ) sub
 where f.id = sub.funnel_id;

-- =====================================================================
-- OPTIONAL one-time backfill (RUN ONCE only).
-- Uncomment to:
--  (a) stamp existing funnel_leads with the owner-default share_link_id
--      when null, so historical leads attribute to the owner row.
--  (b) insert a synthetic view event for any lead lacking one, so
--      "0 views, N leads" disappears and leads ≤ unique viewers holds.
-- =====================================================================
/*
update public.funnel_leads fl
   set share_link_id = sl.id
  from public.funnel_share_links sl
 where sl.funnel_id = fl.funnel_id
   and sl.is_universal = true
   and fl.share_link_id is null;

insert into public.link_events
  (share_link_id, funnel_id, funnel_step_id, event_type,
   visitor_fingerprint, ip_ua_hash, user_agent, created_at)
select fl.share_link_id,
       fl.funnel_id,
       null,
       'view',
       coalesce(fl.session_id, encode(gen_random_bytes(8),'hex')),
       null,
       fl.user_agent,
       fl.submitted_at
  from public.funnel_leads fl
  left join public.link_events e
    on e.share_link_id = fl.share_link_id
   and e.event_type = 'view'
   and coalesce(e.visitor_fingerprint, e.ip_ua_hash) = coalesce(fl.session_id, '')
 where fl.share_link_id is not null
   and e.id is null
on conflict on constraint uq_link_events_unique_view do nothing;
*/
