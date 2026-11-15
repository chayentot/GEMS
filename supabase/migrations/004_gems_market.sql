-- GEMS Market: fixed platform exchange with a 5% fee on both sides.
-- Buying spends GEMS and credits gemstone units to the player's inventory.
-- Selling consumes gemstone units and credits net GEMS to the player's wallet.

begin;

create table if not exists public.market_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemstone_id uuid not null references public.gemstones(id),
  side text not null check (side in ('buy','sell')),
  gems_amount numeric(24,8) not null check (gems_amount > 0),
  gemstone_units numeric(24,8) not null check (gemstone_units > 0),
  fee_gems numeric(24,8) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists market_transactions_user_created_idx
  on public.market_transactions(user_id, created_at desc);

alter table public.market_transactions enable row level security;

drop policy if exists "Players can read their own market transactions" on public.market_transactions;
create policy "Players can read their own market transactions"
  on public.market_transactions for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.market_buy_gemstone(
  p_gemstone_id uuid,
  p_gems_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_gem public.gemstones%rowtype;
  v_wallet public.wallets%rowtype;
  v_inventory_id uuid;
  v_units numeric(24,8);
  v_fee_gems numeric(24,8);
  v_new_balance numeric(24,8);
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;
  if p_gems_amount is null or p_gems_amount <= 0 then
    raise exception 'Enter a GEMS amount greater than zero.';
  end if;

  select * into v_gem
  from public.gemstones
  where id = p_gemstone_id and is_available = true
  for share;
  if not found then raise exception 'Gemstone is unavailable.'; end if;
  if v_gem.units_per_gems is null or v_gem.units_per_gems <= 0 then
    raise exception 'This gemstone does not have a valid market rate.';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_user
  for update;
  if not found then raise exception 'Wallet not found.'; end if;
  if v_wallet.gems_balance < p_gems_amount then
    raise exception 'Insufficient GEMS balance.';
  end if;

  -- 5% is deducted from the gemstone units delivered to the buyer.
  v_fee_gems := round(p_gems_amount * 0.05, 8);
  v_units := round(p_gems_amount * v_gem.units_per_gems * 0.95, 8);
  if v_units <= 0 then raise exception 'Purchase amount is too small.'; end if;

  v_new_balance := v_wallet.gems_balance - p_gems_amount;
  update public.wallets
  set gems_balance = v_new_balance, updated_at = now()
  where user_id = v_user;

  insert into public.player_gemstones(user_id, gemstone_id, level, is_active, gemstone_units_balance)
  values (v_user, v_gem.id, 1, true, v_units)
  on conflict (user_id, gemstone_id)
  do update set gemstone_units_balance =
    player_gemstones.gemstone_units_balance + excluded.gemstone_units_balance
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id, transaction_type, amount, balance_after, description, reference_id)
  values (v_user, 'market_buy', -p_gems_amount, v_new_balance,
    'Bought ' || v_units || ' ' || v_gem.name || ' units (5% market fee)', v_inventory_id);

  insert into public.market_transactions(user_id, gemstone_id, side, gems_amount, gemstone_units, fee_gems)
  values (v_user, v_gem.id, 'buy', p_gems_amount, v_units, v_fee_gems);

  return jsonb_build_object(
    'side','buy','gems_spent',p_gems_amount,'gemstone_units_received',v_units,
    'fee_gems_equivalent',v_fee_gems,'new_gems_balance',v_new_balance
  );
end;
$function$;

create or replace function public.market_sell_gemstone(
  p_player_gemstone_id uuid,
  p_gemstone_units numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_inventory public.player_gemstones%rowtype;
  v_gem public.gemstones%rowtype;
  v_wallet public.wallets%rowtype;
  v_gross_gems numeric(24,8);
  v_fee_gems numeric(24,8);
  v_net_gems numeric(24,8);
  v_new_balance numeric(24,8);
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;
  if p_gemstone_units is null or p_gemstone_units <= 0 then
    raise exception 'Enter gemstone units greater than zero.';
  end if;

  select * into v_inventory
  from public.player_gemstones
  where id = p_player_gemstone_id and user_id = v_user
  for update;
  if not found then raise exception 'Gemstone inventory not found.'; end if;
  if v_inventory.gemstone_units_balance < p_gemstone_units then
    raise exception 'You do not have enough gemstone units to sell.';
  end if;

  select * into v_gem
  from public.gemstones
  where id = v_inventory.gemstone_id and is_available = true
  for share;
  if not found or v_gem.units_per_gems is null or v_gem.units_per_gems <= 0 then
    raise exception 'This gemstone does not have a valid market rate.';
  end if;

  -- 5% is deducted from the GEMS payout received by the seller.
  v_gross_gems := p_gemstone_units / v_gem.units_per_gems;
  v_fee_gems := round(v_gross_gems * 0.05, 8);
  v_net_gems := round(v_gross_gems * 0.95, 8);
  if v_net_gems <= 0 then raise exception 'Sale amount is too small.'; end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_user
  for update;
  if not found then raise exception 'Wallet not found.'; end if;

  update public.player_gemstones
  set gemstone_units_balance = gemstone_units_balance - p_gemstone_units
  where id = p_player_gemstone_id;

  v_new_balance := v_wallet.gems_balance + v_net_gems;
  update public.wallets
  set gems_balance = v_new_balance, updated_at = now()
  where user_id = v_user;

  insert into public.wallet_transactions(user_id, transaction_type, amount, balance_after, description, reference_id)
  values (v_user, 'market_sell', v_net_gems, v_new_balance,
    'Sold ' || p_gemstone_units || ' ' || v_gem.name || ' units (5% market fee)', p_player_gemstone_id);

  insert into public.market_transactions(user_id, gemstone_id, side, gems_amount, gemstone_units, fee_gems)
  values (v_user, v_gem.id, 'sell', v_net_gems, p_gemstone_units, v_fee_gems);

  return jsonb_build_object(
    'side','sell','gemstone_units_sold',p_gemstone_units,'gems_received',v_net_gems,
    'fee_gems',v_fee_gems,'new_gems_balance',v_new_balance
  );
end;
$function$;

revoke all on function public.market_buy_gemstone(uuid,numeric) from public, anon;
revoke all on function public.market_sell_gemstone(uuid,numeric) from public, anon;
grant execute on function public.market_buy_gemstone(uuid,numeric) to authenticated;
grant execute on function public.market_sell_gemstone(uuid,numeric) to authenticated;

commit;
