-- See supabase/migrations/20260608000000_academy_format.sql
alter table public.academy_tutorials
  add column if not exists format text not null default 'short';
alter table public.academy_tutorials
  drop constraint if exists academy_tutorials_format_check;
alter table public.academy_tutorials
  add constraint academy_tutorials_format_check
  check (format in ('short', 'full'));
create index if not exists idx_academy_tutorials_format
  on public.academy_tutorials (format, category, order_index);
