-- GEMS progression correction:
-- Each gemstone is unlocked by spending units of THAT SAME gemstone.
-- Market purchases can build a locked gemstone's unit balance without unlocking it.
-- Existing player gemstones remain unlocked; balances are preserved.

begin;

alter table public.player_gemstones
  add column if not exists is_unlocked boolean not null default true;

-- A market purchase of a gemstone not yet unlocked creates a locked unit wallet.
-- Existing unlocked gemstones remain unlocked when more units are purchased.
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

  select * into v_gem from public.gemstones
  where id=p_gemstone_id and is_available=true for share;
  if not found then raise exception 'Gemstone is unavailable.'; end if;
  if v_gem.units_per_gems is null or v_gem.units_per_gems<=0 then
    raise exception 'This gemstone does not have a valid market rate.';
  end if;

  select * into v_wallet from public.wallets where user_id=v_user for update;
  if not found then raise exception 'Wallet not found.'; end if;
  if v_wallet.gems_balance<p_gems_amount then raise exception 'Insufficient GEMS balance.'; end if;

  v_fee_gems:=round(p_gems_amount*0.05,8);
  v_units:=round(p_gems_amount*v_gem.units_per_gems*0.95,8);
  if v_units<=0 then raise exception 'Purchase amount is too small.'; end if;

  v_new_balance:=v_wallet.gems_balance-p_gems_amount;
  update public.wallets set gems_balance=v_new_balance,updated_at=now() where user_id=v_user;

  insert into public.player_gemstones
    (user_id,gemstone_id,level,is_active,gemstone_units_balance,is_unlocked)
  values (v_user,v_gem.id,0,false,v_units,false)
  on conflict (user_id,gemstone_id)
  do update set gemstone_units_balance =
    player_gemstones.gemstone_units_balance + excluded.gemstone_units_balance
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id,transaction_type,amount,balance_after,description,reference_id)
  values (v_user,'market_buy',-p_gems_amount,v_new_balance,
    'Bought '||v_units||' '||v_gem.name||' units (5% market fee)',v_inventory_id);

  insert into public.market_transactions(user_id,gemstone_id,side,gems_amount,gemstone_units,fee_gems)
  values(v_user,v_gem.id,'buy',p_gems_amount,v_units,v_fee_gems);

  return jsonb_build_object('side','buy','gems_spent',p_gems_amount,
    'gemstone_units_received',v_units,'fee_gems_equivalent',v_fee_gems,
    'new_gems_balance',v_new_balance);
end;
$function$;

-- Unlock consumes units from the target gemstone's own market/mining balance.
create or replace function public.purchase_gemstone(p_gemstone_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_gem public.gemstones%rowtype;
  v_inventory public.player_gemstones%rowtype;
  v_inventory_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_gem from public.gemstones
  where id=p_gemstone_id and is_available=true for update;
  if not found then raise exception 'Gemstone is unavailable.'; end if;

  if v_gem.code='GARNET' then
    raise exception 'Garnet is the free starter gemstone.';
  end if;

  select * into v_inventory from public.player_gemstones
  where user_id=auth.uid() and gemstone_id=v_gem.id
  for update;
  if not found then
    raise exception 'Buy this gemstone in the Market first, then collect enough units to unlock it.';
  end if;
  if v_inventory.is_unlocked then raise exception 'You already unlocked this gemstone.'; end if;
  if v_inventory.gemstone_units_balance<v_gem.unlock_cost_units then
    raise exception 'Not enough '||v_gem.name||' units. Required: '||v_gem.unlock_cost_units||'.';
  end if;

  update public.player_gemstones
  set gemstone_units_balance=gemstone_units_balance-v_gem.unlock_cost_units,
      is_unlocked=true,level=1,is_active=true
  where id=v_inventory.id
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id,transaction_type,amount,description,reference_id)
  values(auth.uid(),'gemstone_unlock',0,
    'Unlocked '||v_gem.name||' using '||v_gem.unlock_cost_units||' '||v_gem.name||' units',
    v_inventory_id);

  return v_inventory_id;
end;
$function$;

revoke all on function public.market_buy_gemstone(uuid,numeric),public.purchase_gemstone(uuid) from public,anon;
grant execute on function public.market_buy_gemstone(uuid,numeric),public.purchase_gemstone(uuid) to authenticated;

commit;
