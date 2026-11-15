-- Fix market buying: locked gemstone inventory must still satisfy level >= 1.
-- Locked status is controlled by is_unlocked, not by setting level to zero.

begin;

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

  v_fee_gems := round(p_gems_amount * 0.05, 8);
  v_units := round(p_gems_amount * v_gem.units_per_gems * 0.95, 8);
  if v_units <= 0 then raise exception 'Purchase amount is too small.'; end if;

  v_new_balance := v_wallet.gems_balance - p_gems_amount;
  update public.wallets
  set gems_balance = v_new_balance, updated_at = now()
  where user_id = v_user;

  -- Keep level at 1 to satisfy the database constraint.
  -- is_unlocked=false prevents mining until the player unlocks it.
  insert into public.player_gemstones
    (user_id, gemstone_id, level, is_active, gemstone_units_balance, is_unlocked)
  values
    (v_user, v_gem.id, 1, false, v_units, false)
  on conflict (user_id, gemstone_id)
  do update set gemstone_units_balance =
    player_gemstones.gemstone_units_balance + excluded.gemstone_units_balance
  returning id into v_inventory_id;

  insert into public.wallet_transactions
    (user_id, transaction_type, amount, balance_after, description, reference_id)
  values
    (v_user, 'market_buy', -p_gems_amount, v_new_balance,
     'Bought ' || v_units || ' ' || v_gem.name || ' units (5% market fee)', v_inventory_id);

  insert into public.market_transactions
    (user_id, gemstone_id, side, gems_amount, gemstone_units, fee_gems)
  values
    (v_user, v_gem.id, 'buy', p_gems_amount, v_units, v_fee_gems);

  return jsonb_build_object(
    'side', 'buy',
    'gems_spent', p_gems_amount,
    'gemstone_units_received', v_units,
    'fee_gems_equivalent', v_fee_gems,
    'new_gems_balance', v_new_balance
  );
end;
$function$;

revoke all on function public.market_buy_gemstone(uuid,numeric) from public, anon;
grant execute on function public.market_buy_gemstone(uuid,numeric) to authenticated;

commit;
