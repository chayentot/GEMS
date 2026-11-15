-- GEMS economy catalog: exact values supplied and confirmed by the owner.
-- Additive migration for the ORIGINAL database (player_gemstones + mining_sessions).
-- Do not run 001_gems_schema.sql on this database.

begin;

alter table public.gemstones
  add column if not exists earning_units_per_minute jsonb not null default '[]'::jsonb,
  add column if not exists units_per_gems numeric(20,8),
  add column if not exists level_up_cost_units jsonb not null default '[]'::jsonb,
  add column if not exists unlock_cost_units numeric(20,4) not null default 0,
  add column if not exists requires_gemstone_id uuid references public.gemstones(id);

alter table public.player_gemstones
  add column if not exists gemstone_units_balance numeric(24,8) not null default 0;

-- Preserve the current Garnet record and add the other nine catalog entries if missing.
insert into public.gemstones (code, name, description, unlock_cost_gems, mining_reward_per_hour, is_available)
select v.code, v.name, v.description, 0, 0, true
from (values
  ('MOONSTONE','Moonstone','Moonstone mining gemstone'),
  ('BLACK_OPAL','Black Opal','Black Opal mining gemstone'),
  ('AQUAMARINE','Aquamarine','Aquamarine mining gemstone'),
  ('TOPAZ','Topaz','Topaz mining gemstone'),
  ('AMETHYST','Amethyst','Amethyst mining gemstone'),
  ('EMERALD','Emerald','Emerald mining gemstone'),
  ('SAPPHIRE','Sapphire','Sapphire mining gemstone'),
  ('RUBY','Ruby','Ruby mining gemstone'),
  ('DIAMOND','Diamond','Diamond mining gemstone')
) as v(code,name,description)
where not exists (
  select 1 from public.gemstones g where upper(g.code) = v.code or lower(g.name) = lower(v.name)
);

-- Exact per-level earning values (gemstone units per minute), level-up unit costs,
-- and conversion quantities (gemstone units required for 1 GEMS).
update public.gemstones g set
  earning_units_per_minute = v.earning::jsonb,
  level_up_cost_units = v.level_cost::jsonb,
  units_per_gems = v.conversion::numeric,
  unlock_cost_units = v.unlock_cost::numeric,
  requires_gemstone_id = (select p.id from public.gemstones p where upper(p.code) = v.requires_code limit 1),
  is_available = true
from (values
 ('GARNET','[10,11,13,17,24,36,58,98,176,335]','[150,165,198,257,360,541,865,1470,2646,5028]',2880,0,null),
 ('MOONSTONE','[9,10,12,15,22,32,52,88,159,302]','[135,149,178,232,324,486,778,1323,2382,4525]',1296,194400,'GARNET'),
 ('BLACK_OPAL','[8,9,11,14,19,29,46,78,141,268]','[120,132,158,206,288,432,692,1176,2117,4023]',384,230400,'MOONSTONE'),
 ('AQUAMARINE','[7,8,9,12,17,25,40,69,124,235]','[105,116,139,180,252,378,605,1029,1853,3520]',201.6,302400,'BLACK_OPAL'),
 ('TOPAZ','[6,7,8,10,14,22,35,59,106,201]','[90,99,119,154,216,324,519,882,1588,3017]',100.8,302400,'AQUAMARINE'),
 ('AMETHYST','[5,6,7,9,12,18,29,49,88,168]','[75,83,99,129,180,270,432,735,1323,2514]',36,216000,'TOPAZ'),
 ('EMERALD','[4,4,5,7,10,14,23,39,71,134]','[60,66,79,103,144,216,346,588,1059,2011]',11.52,172800,'AMETHYST'),
 ('SAPPHIRE','[3,3,4,5,7,11,17,29,53,101]','[45,50,59,77,108,162,259,441,794,1508]',8.64,151200,'EMERALD'),
 ('RUBY','[2,2,3,3,5,7,12,20,35,67]','[30,33,40,51,72,108,173,294,529,1006]',5.76,115200,'SAPPHIRE'),
 ('DIAMOND','[1,1,1,2,2,4,6,10,18,34]','[15,17,20,26,36,54,86,147,265,503]',2.88,86400,'RUBY')
) as v(code,earning,level_cost,conversion,unlock_cost,requires_code)
where upper(g.code) = v.code;


-- Economy RPCs: mining earns gemstone units, conversion is explicit, and
-- gemstone unlocking / level-ups consume the exact unit requirements above.
-- Drop the three legacy signatures first because their original return types differ.
drop function if exists public.start_mining(uuid);
drop function if exists public.collect_mining(uuid);
drop function if exists public.purchase_gemstone(uuid);

create or replace function public.start_mining(p_player_gemstone_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_pg public.player_gemstones%rowtype;
  v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_pg
  from public.player_gemstones
  where id = p_player_gemstone_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Gemstone not found.'; end if;
  if not v_pg.is_active then raise exception 'This gemstone is inactive.'; end if;

  if exists (
    select 1 from public.mining_sessions
    where player_gemstone_id = p_player_gemstone_id
      and user_id = auth.uid()
      and is_active = true
  ) then
    raise exception 'A mining session is still active. Collect its rewards before starting another cycle.';
  end if;

  insert into public.mining_sessions(player_gemstone_id,user_id,started_at,ends_at,last_collected_at,is_active)
  values (p_player_gemstone_id,auth.uid(),now(),now()+interval '24 hours',now(),true)
  returning id into v_session_id;

  return v_session_id;
end;
$function$;

create or replace function public.collect_mining(p_player_gemstone_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_pg public.player_gemstones%rowtype;
  v_session public.mining_sessions%rowtype;
  v_gem public.gemstones%rowtype;
  v_rate numeric;
  v_cutoff timestamptz;
  v_units numeric;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_pg
  from public.player_gemstones
  where id = p_player_gemstone_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Gemstone not found.'; end if;

  select * into v_session
  from public.mining_sessions
  where player_gemstone_id = p_player_gemstone_id
    and user_id = auth.uid()
    and is_active = true
  order by started_at desc
  limit 1
  for update;
  if not found then raise exception 'No active mining session.'; end if;

  select * into v_gem from public.gemstones where id = v_pg.gemstone_id;
  v_rate := coalesce((v_gem.earning_units_per_minute ->> (v_pg.level - 1))::numeric,0);
  if v_rate <= 0 then raise exception 'Mining rate is not configured for this level.'; end if;

  v_cutoff := least(now(),v_session.ends_at);
  v_units := round(v_rate * greatest(0,extract(epoch from (v_cutoff-v_session.last_collected_at))/60.0),8);
  if v_units <= 0 then raise exception 'No mining units are available yet.'; end if;

  update public.player_gemstones
  set gemstone_units_balance = gemstone_units_balance + v_units
  where id = p_player_gemstone_id;

  if v_cutoff >= v_session.ends_at then
    update public.mining_sessions set is_active=false,last_collected_at=v_cutoff where id=v_session.id;
  else
    update public.mining_sessions set last_collected_at=v_cutoff where id=v_session.id;
  end if;

  return v_units;
end;
$function$;

create or replace function public.convert_gemstone_units(p_player_gemstone_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_pg public.player_gemstones%rowtype;
  v_gem public.gemstones%rowtype;
  v_gems numeric;
  v_units_used numeric;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_pg
  from public.player_gemstones
  where id=p_player_gemstone_id and user_id=auth.uid()
  for update;
  if not found then raise exception 'Gemstone not found.'; end if;

  select * into v_gem from public.gemstones where id=v_pg.gemstone_id;
  if v_gem.units_per_gems is null or v_gem.units_per_gems <= 0 then
    raise exception 'Conversion rate is not configured.';
  end if;

  v_gems := floor(v_pg.gemstone_units_balance / v_gem.units_per_gems);
  if v_gems < 1 then raise exception 'Not enough gemstone units for 1 GEMS.'; end if;
  v_units_used := v_gems * v_gem.units_per_gems;

  update public.player_gemstones
  set gemstone_units_balance=gemstone_units_balance-v_units_used
  where id=p_player_gemstone_id;

  update public.wallets
  set gems_balance=gems_balance+v_gems,updated_at=now()
  where user_id=auth.uid();
  if not found then raise exception 'Wallet not found.'; end if;

  insert into public.wallet_transactions(user_id,transaction_type,amount,description,reference_id)
  values (auth.uid(),'gemstone_conversion',v_gems,
    'Converted '||v_units_used||' '||v_gem.name||' units into GEMS',p_player_gemstone_id);

  return v_gems;
end;
$function$;

create or replace function public.purchase_gemstone(p_gemstone_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_gem public.gemstones%rowtype;
  v_previous public.player_gemstones%rowtype;
  v_inventory_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_gem from public.gemstones where id=p_gemstone_id and is_available=true for update;
  if not found then raise exception 'Gemstone is unavailable.'; end if;

  if exists(select 1 from public.player_gemstones where user_id=auth.uid() and gemstone_id=v_gem.id) then
    raise exception 'You already own this gemstone.';
  end if;

  if v_gem.requires_gemstone_id is null then
    update public.wallets
    set gems_balance=gems_balance-v_gem.unlock_cost_gems,updated_at=now()
    where user_id=auth.uid() and gems_balance>=v_gem.unlock_cost_gems;
    if not found then raise exception 'Insufficient GEMS balance.'; end if;
  else
    select * into v_previous
    from public.player_gemstones
    where user_id=auth.uid() and gemstone_id=v_gem.requires_gemstone_id
    for update;
    if not found then raise exception 'You must unlock the previous gemstone first.'; end if;
    if v_previous.gemstone_units_balance < v_gem.unlock_cost_units then
      raise exception 'Not enough previous-gemstone units to unlock this gemstone.';
    end if;
    update public.player_gemstones
    set gemstone_units_balance=gemstone_units_balance-v_gem.unlock_cost_units
    where id=v_previous.id;
  end if;

  insert into public.player_gemstones(user_id,gemstone_id,level,is_active)
  values(auth.uid(),v_gem.id,1,true)
  returning id into v_inventory_id;

  insert into public.wallet_transactions(user_id,transaction_type,amount,description,reference_id)
  values(auth.uid(),'gemstone_unlock',0,'Unlocked '||v_gem.name,v_inventory_id);

  return v_inventory_id;
end;
$function$;

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
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;

  select * into v_pg from public.player_gemstones
  where id=p_player_gemstone_id and user_id=auth.uid()
  for update;
  if not found then raise exception 'Gemstone not found.'; end if;
  if v_pg.level >= 10 then raise exception 'This gemstone is already at maximum level.'; end if;

  select * into v_gem from public.gemstones where id=v_pg.gemstone_id;
  v_cost := coalesce((v_gem.level_up_cost_units ->> (v_pg.level - 1))::numeric,0);
  if v_cost <= 0 then raise exception 'Level-up cost is not configured.'; end if;
  if v_pg.gemstone_units_balance < v_cost then raise exception 'Not enough gemstone units to level up.'; end if;

  v_new_level := v_pg.level + 1;
  update public.player_gemstones
  set gemstone_units_balance=gemstone_units_balance-v_cost,level=v_new_level
  where id=p_player_gemstone_id;

  return v_new_level;
end;
$function$;

revoke all on function public.start_mining(uuid),public.collect_mining(uuid),
  public.convert_gemstone_units(uuid),public.purchase_gemstone(uuid),
  public.level_up_gemstone(uuid) from public,anon;
grant execute on function public.start_mining(uuid),public.collect_mining(uuid),
  public.convert_gemstone_units(uuid),public.purchase_gemstone(uuid),
  public.level_up_gemstone(uuid) to authenticated;


-- Keep the original free starter Garnet assignment and all existing player balances.
commit;

-- Verification query:
-- select code,name,earning_units_per_minute,level_up_cost_units,units_per_gems,unlock_cost_units
-- from public.gemstones order by case code
--   when 'GARNET' then 1 when 'MOONSTONE' then 2 when 'BLACK_OPAL' then 3
--   when 'AQUAMARINE' then 4 when 'TOPAZ' then 5 when 'AMETHYST' then 6
--   when 'EMERALD' then 7 when 'SAPPHIRE' then 8 when 'RUBY' then 9 else 10 end;
