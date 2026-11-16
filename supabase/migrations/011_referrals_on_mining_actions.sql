-- GEMS referral rewards for Mining progression.
-- Commissions are based on the GEMS-equivalent value of the units consumed:
-- equivalent GEMS = gemstone units spent / gemstones.units_per_gems.
-- Rates remain 8%, 3%, and 1% for referral levels 1-3.
-- Market BUY commissions are disabled; historical rows are preserved.

begin;

alter table public.referral_commissions
  alter column market_transaction_id drop not null,
  add column if not exists source_type text,
  add column if not exists source_reference_id uuid,
  add column if not exists source_description text,
  add column if not exists source_units_spent numeric(24,8);

update public.referral_commissions
set source_type = coalesce(source_type, 'market_buy'),
    source_reference_id = coalesce(source_reference_id, market_transaction_id),
    source_description = coalesce(source_description, 'Historical Market purchase'),
    source_units_spent = coalesce(source_units_spent, 0);

alter table public.referral_commissions
  alter column source_type set default 'market_buy',
  alter column source_type set not null,
  alter column source_reference_id set not null;

alter table public.referral_commissions
  drop constraint if exists referral_commissions_source_type_check;
alter table public.referral_commissions
  add constraint referral_commissions_source_type_check
  check (source_type in ('market_buy','gemstone_unlock','gemstone_level_up'));

create unique index if not exists referral_commissions_source_once_uidx
  on public.referral_commissions(source_type, source_reference_id, beneficiary_id);

create index if not exists referral_commissions_source_type_created_idx
  on public.referral_commissions(source_type, created_at desc);

-- Market purchases no longer earn referral commissions. Keep old records visible.
drop trigger if exists market_buy_awards_referral_commissions
  on public.market_transactions;

-- Internal helper. It is called from the unlock/level-up RPCs in the same
-- database transaction, so a failed reward credit rolls back the Mining action.
create or replace function public.award_mining_referral_commissions(
  p_source_user_id uuid,
  p_event_id uuid,
  p_source_type text,
  p_source_description text,
  p_gemstone_name text,
  p_units_spent numeric,
  p_units_per_gems numeric
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_referrer uuid;
  v_seen uuid[] := array[p_source_user_id];
  v_level integer;
  v_rate numeric(5,4);
  v_equivalent_gems numeric(24,8);
  v_amount numeric(24,8);
  v_commission_id uuid;
  v_balance numeric(20,6);
begin
  if p_source_type not in ('gemstone_unlock','gemstone_level_up') then
    raise exception 'Invalid Mining referral event type.';
  end if;
  if p_units_spent is null or p_units_spent <= 0
     or p_units_per_gems is null or p_units_per_gems <= 0 then
    raise exception 'Invalid gemstone conversion for referral commission.';
  end if;

  v_equivalent_gems := p_units_spent / p_units_per_gems;

  select referred_by into v_referrer
  from public.profiles
  where id = p_source_user_id;

  for v_level in 1..3 loop
    exit when v_referrer is null;
    exit when v_referrer = any(v_seen);
    v_seen := array_append(v_seen, v_referrer);

    v_rate := case v_level
      when 1 then 0.08
      when 2 then 0.03
      else 0.01
    end;
    -- Wallet and wallet transaction amounts use six decimal places.
    v_amount := round(v_equivalent_gems * v_rate, 6);

    if v_amount > 0 then
      v_commission_id := null;
      insert into public.referral_commissions
        (beneficiary_id, source_user_id, market_transaction_id,
         referral_level, commission_rate, spend_amount, commission_amount,
         source_type, source_reference_id, source_description, source_units_spent)
      values
        (v_referrer, p_source_user_id, null,
         v_level, v_rate, v_equivalent_gems, v_amount,
         p_source_type, p_event_id, p_source_description, p_units_spent)
      on conflict (source_type, source_reference_id, beneficiary_id) do nothing
      returning id into v_commission_id;

      if v_commission_id is not null then
        update public.wallets
        set gems_balance = gems_balance + v_amount,
            updated_at = now()
        where user_id = v_referrer
        returning gems_balance into v_balance;

        if not found then
          raise exception 'Referral wallet not found for beneficiary %.', v_referrer;
        end if;

        insert into public.wallet_transactions
          (user_id, transaction_type, amount, balance_after, description, reference_id)
        values
          (v_referrer, 'referral_commission', v_amount, v_balance,
           'Level ' || v_level || ' referral commission (' ||
             (v_rate * 100)::text || '%) from ' || p_source_description ||
             ' · ' || p_gemstone_name,
           p_event_id);
      end if;
    end if;

    select referred_by into v_referrer
    from public.profiles
    where id = v_referrer;
  end loop;
end;
$function$;

-- Unlock a gemstone using its own accumulated units, then reward the referrer
-- chain based on the unit cost converted into GEMS-equivalent value.
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
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_gem from public.gemstones
  where id=p_gemstone_id and is_available=true
  for update;
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
  if v_gem.unlock_cost_units is null or v_gem.unlock_cost_units <= 0
     or v_gem.units_per_gems is null or v_gem.units_per_gems <= 0 then
    raise exception 'Gemstone unlock or conversion rate is not configured.';
  end if;
  if v_inventory.gemstone_units_balance < v_gem.unlock_cost_units then
    raise exception 'Not enough % units. Required: %.', v_gem.name, v_gem.unlock_cost_units;
  end if;

  update public.player_gemstones
  set gemstone_units_balance=gemstone_units_balance-v_gem.unlock_cost_units,
      is_unlocked=true,level=1,is_active=true
  where id=v_inventory.id
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id,transaction_type,amount,description,reference_id)
  values(auth.uid(),'gemstone_unlock',0,
    'Unlocked '||v_gem.name||' using '||v_gem.unlock_cost_units||' '||v_gem.name||' units',
    v_inventory_id)
  returning id into v_event_id;

  perform public.award_mining_referral_commissions(
    auth.uid(), v_event_id, 'gemstone_unlock',
    v_gem.name || ' unlock', v_gem.name,
    v_gem.unlock_cost_units, v_gem.units_per_gems
  );

  return v_inventory_id;
end;
$function$;

-- Level-up rewards use the exact level-specific unit cost consumed.
create or replace function public.level_up_gemstone(p_player_gemstone_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_pg public.player_gemstones%rowtype;
  v_gem public.gemstones%rowtype;
  v_cost numeric;
  v_new_level integer;
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_pg from public.player_gemstones
  where id=p_player_gemstone_id and user_id=auth.uid()
  for update;
  if not found then raise exception 'Gemstone not found.'; end if;
  if not v_pg.is_unlocked then raise exception 'Unlock this gemstone before upgrading it.'; end if;
  if v_pg.level >= 10 then raise exception 'This gemstone is already at maximum level.'; end if;

  select * into v_gem from public.gemstones where id=v_pg.gemstone_id;
  v_cost := coalesce((v_gem.level_up_cost_units ->> (v_pg.level - 1))::numeric,0);
  if v_cost <= 0 then raise exception 'Level-up cost is not configured.'; end if;
  if v_gem.units_per_gems is null or v_gem.units_per_gems <= 0 then
    raise exception 'Gemstone conversion rate is not configured.';
  end if;
  if v_pg.gemstone_units_balance < v_cost then
    raise exception 'Not enough gemstone units to level up.';
  end if;

  v_new_level := v_pg.level + 1;
  update public.player_gemstones
  set gemstone_units_balance=gemstone_units_balance-v_cost,level=v_new_level
  where id=p_player_gemstone_id;

  insert into public.wallet_transactions(user_id,transaction_type,amount,description,reference_id)
  values(auth.uid(),'gemstone_level_up',0,
    'Upgraded '||v_gem.name||' to level '||v_new_level||' using '||v_cost||' units',
    p_player_gemstone_id)
  returning id into v_event_id;

  perform public.award_mining_referral_commissions(
    auth.uid(), v_event_id, 'gemstone_level_up',
    v_gem.name || ' upgrade to level ' || v_new_level, v_gem.name,
    v_cost, v_gem.units_per_gems
  );

  return v_new_level;
end;
$function$;

revoke all on function public.award_mining_referral_commissions(uuid,uuid,text,text,text,numeric,numeric)
  from public, anon, authenticated;
revoke all on function public.purchase_gemstone(uuid), public.level_up_gemstone(uuid)
  from public, anon;
grant execute on function public.purchase_gemstone(uuid), public.level_up_gemstone(uuid)
  to authenticated;

commit;
