-- GEMS admin dashboard read access.
-- Additive policies: existing player policies remain in place.
begin;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.player_gemstones enable row level security;
alter table public.mining_sessions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.recharge_orders enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.market_transactions enable row level security;

drop policy if exists "GEMS admins read all profiles" on public.profiles;
create policy "GEMS admins read all profiles" on public.profiles
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all wallets" on public.wallets;
create policy "GEMS admins read all wallets" on public.wallets
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all player gemstones" on public.player_gemstones;
create policy "GEMS admins read all player gemstones" on public.player_gemstones
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all mining sessions" on public.mining_sessions;
create policy "GEMS admins read all mining sessions" on public.mining_sessions
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all wallet transactions" on public.wallet_transactions;
create policy "GEMS admins read all wallet transactions" on public.wallet_transactions
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all recharge orders" on public.recharge_orders;
create policy "GEMS admins read all recharge orders" on public.recharge_orders
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all withdrawal requests" on public.withdrawal_requests;
create policy "GEMS admins read all withdrawal requests" on public.withdrawal_requests
for select to authenticated using (public.is_admin());

drop policy if exists "GEMS admins read all market transactions" on public.market_transactions;
create policy "GEMS admins read all market transactions" on public.market_transactions
for select to authenticated using (public.is_admin());


-- Grant administrator access to the explicitly designated account.
-- The account must already exist in Supabase Authentication.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('cerithel@gmail.com')
on conflict (user_id) do nothing;

commit;
