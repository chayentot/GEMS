-- GEMS Mining platform schema
-- Apply once in Supabase SQL Editor. Do not expose service-role keys in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gems_balance numeric(20,6) not null default 0 check (gems_balance >= 0),
  diamonds_balance numeric(20,6) not null default 0 check (diamonds_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gemstones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  mining_reward_per_hour numeric(20,8) not null default 0 check (mining_reward_per_hour >= 0),
  unlock_cost_gems numeric(20,6) not null default 1 check (unlock_cost_gems >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.player_gemstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemstone_id uuid not null references public.gemstones(id),
  level integer not null default 1 check (level >= 1),
  is_active boolean not null default true,
  is_mining boolean not null default false,
  mining_started_at timestamptz,
  mining_last_collected_at timestamptz,
  mining_cycle_ends_at timestamptz,
  pending_reward_gems numeric(20,8) not null default 0 check (pending_reward_gems >= 0),
  created_at timestamptz not null default now(),
  constraint mining_timestamps_consistent check (
    (is_mining and mining_started_at is not null and mining_last_collected_at is not null and mining_cycle_ends_at is not null)
    or
    (not is_mining)
  )
);

create index if not exists player_gemstones_user_idx on public.player_gemstones(user_id);
create index if not exists player_gemstones_mining_idx on public.player_gemstones(is_mining, mining_cycle_ends_at);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  amount numeric(20,6) not null,
  description text,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);

create table if not exists public.recharge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  php_amount numeric(20,2) not null check (php_amount > 0),
  gems_amount numeric(20,6) not null check (gems_amount > 0),
  payment_reference text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recharge_requests_status_idx on public.recharge_requests(status, created_at);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gems_amount numeric(20,6) not null check (gems_amount >= 150),
  fee_gems numeric(20,6) not null check (fee_gems >= 0),
  net_php_amount numeric(20,2) not null check (net_php_amount >= 0),
  payout_details text not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests(status, created_at);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- New accounts receive a wallet and one free Level 1 Garnet.
create or replace function public.handle_new_gems_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_username text;
  v_garnet_id uuid;
begin
  v_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username','')), '');
  if v_username is null then
    v_username := split_part(coalesce(new.email, 'player'), '@', 1) || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles(id, username)
  values (new.id, v_username)
  on conflict (id) do nothing;

  insert into public.wallets(user_id) values (new.id)
  on conflict (user_id) do nothing;

  select id into v_garnet_id from public.gemstones where name = 'Garnet';
  if v_garnet_id is not null then
    insert into public.player_gemstones(user_id, gemstone_id, level, is_active)
    values (new.id, v_garnet_id, 1, true);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_gems on auth.users;
create trigger on_auth_user_created_gems
after insert on auth.users
for each row execute procedure public.handle_new_gems_user();

insert into public.gemstones(name, mining_reward_per_hour, unlock_cost_gems, is_available)
values ('Garnet', 0.01, 1, true)
on conflict (name) do nothing;

-- If Garnet is added after this migration, existing accounts are not backfilled automatically.
-- Backfill starter Garnet for existing accounts that do not already own one.
insert into public.player_gemstones(user_id, gemstone_id, level, is_active)
select u.id, g.id, 1, true
from auth.users u
cross join public.gemstones g
where g.name = 'Garnet'
  and not exists (
    select 1 from public.player_gemstones pg
    where pg.user_id = u.id and pg.gemstone_id = g.id
  );

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.start_mining(p_player_gemstone_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_pg public.player_gemstones%rowtype;
  v_rate numeric(20,8);
  v_now timestamptz := now();
  v_accrued numeric(20,8);
begin
  select * into v_pg
  from public.player_gemstones
  where id = p_player_gemstone_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Gemstone not found.'; end if;
  if not v_pg.is_active then raise exception 'This gemstone is inactive.'; end if;

  select mining_reward_per_hour into v_rate
  from public.gemstones where id = v_pg.gemstone_id and is_available = true;
  if not found then raise exception 'Gemstone is unavailable.'; end if;

  if v_pg.is_mining then
    if v_now < v_pg.mining_cycle_ends_at then
      raise exception 'Mining is already running for this gemstone.';
    end if;
    v_accrued := v_rate * v_pg.level
      * greatest(0, extract(epoch from (v_pg.mining_cycle_ends_at - v_pg.mining_last_collected_at)) / 3600.0);
    update public.player_gemstones
      set pending_reward_gems = pending_reward_gems + v_accrued,
          is_mining = false,
          mining_started_at = null,
          mining_last_collected_at = null,
          mining_cycle_ends_at = null
    where id = v_pg.id;
  end if;

  update public.player_gemstones
  set is_mining = true,
      mining_started_at = v_now,
      mining_last_collected_at = v_now,
      mining_cycle_ends_at = v_now + interval '24 hours'
  where id = v_pg.id;
end;
$$;

create or replace function public.collect_mining(p_player_gemstone_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_pg public.player_gemstones%rowtype;
  v_rate numeric(20,8);
  v_now timestamptz := now();
  v_new_pending numeric(20,8);
  v_reward numeric(20,8);
  v_cutoff timestamptz;
begin
  select * into v_pg
  from public.player_gemstones
  where id = p_player_gemstone_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Gemstone not found.'; end if;

  v_new_pending := v_pg.pending_reward_gems;
  if v_pg.is_mining then
    select mining_reward_per_hour into v_rate from public.gemstones where id = v_pg.gemstone_id;
    v_cutoff := least(v_now, v_pg.mining_cycle_ends_at);
    v_new_pending := v_new_pending + v_rate * v_pg.level
      * greatest(0, extract(epoch from (v_cutoff - v_pg.mining_last_collected_at)) / 3600.0);
  end if;

  v_reward := round(v_new_pending, 6);
  if v_reward <= 0 then raise exception 'No mining reward is available yet.'; end if;

  update public.wallets
  set gems_balance = gems_balance + v_reward, updated_at = v_now
  where user_id = auth.uid();
  if not found then raise exception 'Wallet not found.'; end if;

  insert into public.wallet_transactions(user_id, transaction_type, amount, description, reference_id)
  values (auth.uid(), 'mining_reward', v_reward, 'Collected gemstone mining reward', v_pg.id);

  update public.player_gemstones
  set pending_reward_gems = 0,
      mining_last_collected_at = case when is_mining and v_now < mining_cycle_ends_at then v_now else null end,
      is_mining = case when is_mining and v_now < mining_cycle_ends_at then true else false end,
      mining_started_at = case when is_mining and v_now < mining_cycle_ends_at then mining_started_at else null end,
      mining_cycle_ends_at = case when is_mining and v_now < mining_cycle_ends_at then mining_cycle_ends_at else null end
  where id = v_pg.id;

  return v_reward;
end;
$$;

create or replace function public.create_recharge_request(p_php_amount numeric, p_payment_reference text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_php_amount is null or p_php_amount <= 0 or p_php_amount > 1000000 then
    raise exception 'Enter a valid recharge amount.';
  end if;
  if length(trim(coalesce(p_payment_reference,''))) < 3 then
    raise exception 'Enter a valid payment reference.';
  end if;

  insert into public.recharge_requests(user_id, php_amount, gems_amount, payment_reference)
  values (auth.uid(), round(p_php_amount,2), round(p_php_amount,6), trim(p_payment_reference))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.request_withdrawal(p_gems_amount numeric, p_payout_details text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_fee numeric(20,6);
  v_net numeric(20,2);
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_gems_amount is null or p_gems_amount < 150 or p_gems_amount > 1000000 then
    raise exception 'Minimum withdrawal is 150 GEMS.';
  end if;
  if length(trim(coalesce(p_payout_details,''))) < 5 then
    raise exception 'Enter valid payout details.';
  end if;

  v_fee := round(p_gems_amount * 0.06, 6);
  v_net := round((p_gems_amount - v_fee), 2);

  update public.wallets
  set gems_balance = gems_balance - p_gems_amount, updated_at = now()
  where user_id = auth.uid() and gems_balance >= p_gems_amount;
  if not found then raise exception 'Insufficient GEMS balance.'; end if;

  insert into public.withdrawal_requests(user_id, gems_amount, fee_gems, net_php_amount, payout_details)
  values (auth.uid(), round(p_gems_amount,6), v_fee, v_net, trim(p_payout_details))
  returning id into v_id;

  insert into public.wallet_transactions(user_id, transaction_type, amount, description, reference_id)
  values (auth.uid(), 'withdrawal_reserved', -round(p_gems_amount,6), 'GEMS reserved for withdrawal request', v_id);

  return v_id;
end;
$$;

create or replace function public.admin_approve_recharge(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_req public.recharge_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  select * into v_req from public.recharge_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then raise exception 'Pending recharge request not found.'; end if;

  update public.recharge_requests set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
  update public.wallets set gems_balance=gems_balance+v_req.gems_amount, updated_at=now() where user_id=v_req.user_id;
  insert into public.wallet_transactions(user_id, transaction_type, amount, description, reference_id)
  values (v_req.user_id, 'recharge', v_req.gems_amount, 'Approved recharge request', p_request_id);
end;
$$;

create or replace function public.admin_reject_recharge(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  update public.recharge_requests
  set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_request_id and status='pending';
  if not found then raise exception 'Pending recharge request not found.'; end if;
end;
$$;

create or replace function public.admin_mark_withdrawal_paid(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  update public.withdrawal_requests
  set status='paid', reviewed_by=auth.uid(), reviewed_at=now(), paid_at=now()
  where id=p_request_id and status in ('pending','approved');
  if not found then raise exception 'Pending or approved withdrawal request not found.'; end if;
end;
$$;

create or replace function public.admin_approve_withdrawal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  update public.withdrawal_requests
  set status='approved', reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_request_id and status='pending';
  if not found then raise exception 'Pending withdrawal request not found.'; end if;
end;
$$;

create or replace function public.admin_reject_withdrawal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_req public.withdrawal_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  select * into v_req from public.withdrawal_requests where id=p_request_id for update;
  if not found or v_req.status not in ('pending','approved') then raise exception 'Open withdrawal request not found.'; end if;

  update public.withdrawal_requests
  set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_request_id;
  update public.wallets set gems_balance=gems_balance+v_req.gems_amount, updated_at=now() where user_id=v_req.user_id;
  insert into public.wallet_transactions(user_id, transaction_type, amount, description, reference_id)
  values (v_req.user_id, 'withdrawal_refund', v_req.gems_amount, 'Refund for rejected withdrawal request', p_request_id);
end;
$$;


-- Buy an additional gemstone using the player's GEMS balance.
create or replace function public.purchase_gemstone(p_gemstone_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $
declare
  v_gem public.gemstones%rowtype;
  v_inventory_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_gem
  from public.gemstones
  where id = p_gemstone_id and is_available = true
  for update;
  if not found then raise exception 'Gemstone is unavailable.'; end if;

  update public.wallets
  set gems_balance = gems_balance - v_gem.unlock_cost_gems, updated_at = now()
  where user_id = auth.uid() and gems_balance >= v_gem.unlock_cost_gems;
  if not found then raise exception 'Insufficient GEMS balance.'; end if;

  insert into public.player_gemstones(user_id, gemstone_id, level, is_active)
  values (auth.uid(), v_gem.id, 1, true)
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id, transaction_type, amount, description, reference_id)
  values (auth.uid(), 'gemstone_purchase', -v_gem.unlock_cost_gems,
    'Purchased ' || v_gem.name, v_inventory_id);

  return v_inventory_id;
end;
$;

-- RLS: players can read only their own records. Writes are performed through trusted RPC functions.
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.gemstones enable row level security;
alter table public.player_gemstones enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.recharge_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Players read own profile" on public.profiles;
create policy "Players read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "Players read own wallet" on public.wallets;
create policy "Players read own wallet" on public.wallets for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Authenticated read gemstone catalog" on public.gemstones;
create policy "Authenticated read gemstone catalog" on public.gemstones for select to authenticated using (is_available = true or public.is_admin());
drop policy if exists "Players read own gemstones" on public.player_gemstones;
create policy "Players read own gemstones" on public.player_gemstones for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Players read own transactions" on public.wallet_transactions;
create policy "Players read own transactions" on public.wallet_transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Players read own recharge requests" on public.recharge_requests;
create policy "Players read own recharge requests" on public.recharge_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Players read own withdrawal requests" on public.withdrawal_requests;
create policy "Players read own withdrawal requests" on public.withdrawal_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins read admin list" on public.admin_users;
create policy "Admins read admin list" on public.admin_users for select to authenticated using (public.is_admin());

-- No direct client writes to balances, inventories, ledgers, or request statuses.
revoke all on public.profiles, public.wallets, public.gemstones, public.player_gemstones,
  public.wallet_transactions, public.recharge_requests, public.withdrawal_requests, public.admin_users
from anon, authenticated;
grant select on public.profiles, public.wallets, public.gemstones, public.player_gemstones,
  public.wallet_transactions, public.recharge_requests, public.withdrawal_requests, public.admin_users
to authenticated;

revoke all on function public.handle_new_gems_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.start_mining(uuid), public.collect_mining(uuid),
  public.create_recharge_request(numeric,text), public.request_withdrawal(numeric,text),
  public.admin_approve_recharge(uuid), public.admin_reject_recharge(uuid),
  public.admin_mark_withdrawal_paid(uuid), public.admin_approve_withdrawal(uuid),
  public.admin_reject_withdrawal(uuid), public.purchase_gemstone(uuid) from public, anon;
grant execute on function public.start_mining(uuid), public.collect_mining(uuid),
  public.create_recharge_request(numeric,text), public.request_withdrawal(numeric,text),
  public.admin_approve_recharge(uuid), public.admin_reject_recharge(uuid),
  public.admin_mark_withdrawal_paid(uuid), public.admin_approve_withdrawal(uuid),
  public.admin_reject_withdrawal(uuid), public.purchase_gemstone(uuid) to authenticated;

