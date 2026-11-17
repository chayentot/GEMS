-- Persist each player's Mining Empire progress across sessions and devices.
-- The row is private to its owning authenticated player.

create table if not exists public.mining_empire_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.mining_empire_saves enable row level security;

drop policy if exists "Players read own Mining Empire save" on public.mining_empire_saves;
create policy "Players read own Mining Empire save"
  on public.mining_empire_saves
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Players insert own Mining Empire save" on public.mining_empire_saves;
create policy "Players insert own Mining Empire save"
  on public.mining_empire_saves
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Players update own Mining Empire save" on public.mining_empire_saves;
create policy "Players update own Mining Empire save"
  on public.mining_empire_saves
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.mining_empire_saves from anon, authenticated;
grant select, insert, update on public.mining_empire_saves to authenticated;
