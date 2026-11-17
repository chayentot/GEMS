-- GEMS Gemstone Frontier persistent gameplay backend.
-- Additive only: does not modify wallets, GEMS balances, recharge, withdrawals,
-- player_gemstones, mining_sessions, or referral commissions.

begin;

create table if not exists public.gem_world_catalog (
  id integer primary key,
  name text not null,
  icon text not null,
  kind text not null,
  unlock_cost_gold numeric(20,4) not null default 0 check (unlock_cost_gold >= 0),
  sale_value_gold numeric(20,4) not null default 0 check (sale_value_gold >= 0),
  inputs jsonb not null default '[]'::jsonb,
  is_available boolean not null default true
);

insert into public.gem_world_catalog
  (id,name,icon,kind,unlock_cost_gold,sale_value_gold,inputs)
values
  (1,'Garnet Mine','⛏️','EXTRACTION',0,1,'[]'),
  (2,'Ore Washer','💧','WASHING',50,2,'[[1,2]]'),
  (3,'Crystal Sorter','🔮','SORTING',120,4,'[[2,2]]'),
  (4,'Gem Cutter','💎','CUTTING',220,6,'[[3,2]]'),
  (5,'Polishing Mill','⚙️','POLISHING',350,8,'[[1,1],[4,1]]'),
  (6,'Crystal Press','🏗️','PROCESSING',500,12,'[[2,1],[5,1]]'),
  (7,'Gem Lab','🧪','REFINING',700,18,'[[3,1],[6,1]]'),
  (8,'Vault Workshop','🏦','STORAGE',950,25,'[[4,1],[6,1]]'),
  (9,'Deep Core Drill','🚜','DEEP MINING',1250,35,'[[5,1],[7,1]]'),
  (10,'Legendary Crystal Forge','✨','MASTER FORGE',1600,60,'[[6,1],[7,1],[8,1],[9,1]]')
on conflict (id) do update set
  name=excluded.name, icon=excluded.icon, kind=excluded.kind,
  unlock_cost_gold=excluded.unlock_cost_gold,
  sale_value_gold=excluded.sale_value_gold, inputs=excluded.inputs,
  is_available=true;

create table if not exists public.gem_worlds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gold_balance numeric(20,4) not null default 0 check (gold_balance >= 0),
  total_produced bigint not null default 0 check (total_produced >= 0),
  total_shipped bigint not null default 0 check (total_shipped >= 0),
  last_tick_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gem_world_facilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id integer not null references public.gem_world_catalog(id),
  level integer not null default 1 check (level between 1 and 10),
  is_unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create table if not exists public.gem_world_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id integer not null references public.gem_world_catalog(id),
  material_id integer not null references public.gem_world_catalog(id),
  amount numeric(20,4) not null default 0 check (amount >= 0 and amount <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, facility_id, material_id)
);

create table if not exists public.gem_world_shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id integer not null references public.gem_world_catalog(id),
  amount numeric(20,4) not null check (amount > 0),
  sale_value_gold numeric(20,4) not null check (sale_value_gold >= 0),
  arrive_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists gem_world_shipments_due_idx
  on public.gem_world_shipments(user_id, arrive_at);
create index if not exists gem_world_inventory_user_idx
  on public.gem_world_inventory(user_id);

alter table public.gem_world_catalog enable row level security;
alter table public.gem_worlds enable row level security;
alter table public.gem_world_facilities enable row level security;
alter table public.gem_world_inventory enable row level security;
alter table public.gem_world_shipments enable row level security;

drop policy if exists "Authenticated players read Gem World catalog" on public.gem_world_catalog;
create policy "Authenticated players read Gem World catalog"
  on public.gem_world_catalog for select to authenticated using (is_available);

drop policy if exists "Players read own Gem World" on public.gem_worlds;
create policy "Players read own Gem World"
  on public.gem_worlds for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Players read own Gem World facilities" on public.gem_world_facilities;
create policy "Players read own Gem World facilities"
  on public.gem_world_facilities for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Players read own Gem World inventory" on public.gem_world_inventory;
create policy "Players read own Gem World inventory"
  on public.gem_world_inventory for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Players read own Gem World shipments" on public.gem_world_shipments;
create policy "Players read own Gem World shipments"
  on public.gem_world_shipments for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.gem_world_catalog, public.gem_worlds,
  public.gem_world_facilities, public.gem_world_inventory,
  public.gem_world_shipments from anon, authenticated;
grant select on public.gem_world_catalog, public.gem_worlds,
  public.gem_world_facilities, public.gem_world_inventory,
  public.gem_world_shipments to authenticated;

create or replace function public.gem_world_advance()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_world public.gem_worlds%rowtype;
  v_elapsed integer;
  v_tick integer;
  v_factory record;
  v_input record;
  v_target integer;
  v_current numeric;
  v_batches integer;
  v_ready boolean;
  v_due_gold numeric := 0;
  v_due_units numeric := 0;
  v_created integer := 0;
  v_material_value numeric;
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;

  insert into public.gem_worlds(user_id) values (v_user)
  on conflict (user_id) do nothing;
  insert into public.gem_world_facilities(user_id,facility_id,is_unlocked)
  values (v_user,1,true)
  on conflict (user_id,facility_id) do nothing;

  select * into v_world from public.gem_worlds
  where user_id=v_user for update;

  -- Credit conveyor shipments that have completed their travel animation.
  select coalesce(sum(amount*sale_value_gold),0), coalesce(sum(amount),0)
    into v_due_gold,v_due_units
  from public.gem_world_shipments
  where user_id=v_user and arrive_at<=now();

  if v_due_units > 0 then
    delete from public.gem_world_shipments
    where user_id=v_user and arrive_at<=now();
    update public.gem_worlds
       set gold_balance=gold_balance+v_due_gold,
           total_shipped=total_shipped+v_due_units::bigint,
           updated_at=now()
     where user_id=v_user
     returning * into v_world;
  end if;

  -- Offline progress is deliberately capped at 24 hours per visit.
  v_elapsed := least(1440,greatest(0,floor(extract(epoch from (now()-v_world.last_tick_at))/60)::integer));

  for v_tick in 1..v_elapsed loop
    -- The starter mine extracts five units each simulated minute.
    select c.id into v_target
    from public.gem_world_catalog c
    join public.gem_world_facilities f
      on f.user_id=v_user and f.facility_id=c.id and f.is_unlocked
    where c.id>1 and c.inputs @> '[ [1, 1] ]'::jsonb
      and coalesce((select sum(i.amount) from public.gem_world_inventory i
                    where i.user_id=v_user and i.facility_id=c.id),0) < 100
    order by c.id limit 1;

    if v_target is not null then
      insert into public.gem_world_inventory(user_id,facility_id,material_id,amount)
      values(v_user,v_target,1,5)
      on conflict (user_id,facility_id,material_id)
      do update set amount=least(100,gem_world_inventory.amount+5),updated_at=now();
    else
      insert into public.gem_world_shipments(user_id,material_id,amount,sale_value_gold,arrive_at)
      values(v_user,1,5,1,now()+interval '20 seconds');
      v_created := v_created+5;
    end if;
    update public.gem_worlds set total_produced=total_produced+5 where user_id=v_user;

    -- Run unlocked processing facilities in deterministic order.
    for v_factory in
      select c.* from public.gem_world_catalog c
      join public.gem_world_facilities f
        on f.user_id=v_user and f.facility_id=c.id and f.is_unlocked
      where c.id>1 order by c.id
    loop
      v_batches := 0;
      loop
        v_ready := true;
        for v_input in select value from jsonb_array_elements(v_factory.inputs) as e(value)
        loop
          select coalesce(amount,0) into v_current
          from public.gem_world_inventory
          where user_id=v_user and facility_id=v_factory.id
            and material_id=(v_input.value->>0)::integer;
          if coalesce(v_current,0) < (v_input.value->>1)::numeric then
            v_ready := false;
            exit;
          end if;
        end loop;
        exit when not v_ready;

        for v_input in select value from jsonb_array_elements(v_factory.inputs) as e(value)
        loop
          update public.gem_world_inventory
             set amount=amount-(v_input.value->>1)::numeric,updated_at=now()
           where user_id=v_user and facility_id=v_factory.id
             and material_id=(v_input.value->>0)::integer;
        end loop;
        v_batches := v_batches+1;
        exit when v_batches>=100;
      end loop;

      if v_batches>0 then
        update public.gem_worlds set total_produced=total_produced+v_batches where user_id=v_user;
        select c.id into v_target
        from public.gem_world_catalog c
        join public.gem_world_facilities f
          on f.user_id=v_user and f.facility_id=c.id and f.is_unlocked
        where c.id>v_factory.id
          and c.inputs @> jsonb_build_array(jsonb_build_array(v_factory.id,1))
          and coalesce((select sum(i.amount) from public.gem_world_inventory i
                        where i.user_id=v_user and i.facility_id=c.id),0) < 100
        order by c.id limit 1;

        if v_target is not null then
          insert into public.gem_world_inventory(user_id,facility_id,material_id,amount)
          values(v_user,v_target,v_factory.id,least(100,v_batches))
          on conflict (user_id,facility_id,material_id)
          do update set amount=least(100,gem_world_inventory.amount+excluded.amount),updated_at=now();
          if v_batches>100 then
            insert into public.gem_world_shipments(user_id,material_id,amount,sale_value_gold,arrive_at)
            values(v_user,v_factory.id,v_batches-100,v_factory.sale_value_gold,now()+interval '20 seconds');
          end if;
        else
          insert into public.gem_world_shipments(user_id,material_id,amount,sale_value_gold,arrive_at)
          values(v_user,v_factory.id,v_batches,v_factory.sale_value_gold,now()+interval '20 seconds');
        end if;
      end if;
    end loop;
  end loop;

  update public.gem_worlds set last_tick_at=now(),updated_at=now()
  where user_id=v_user returning * into v_world;

  return jsonb_build_object(
    'gold_balance',v_world.gold_balance,
    'total_produced',v_world.total_produced,
    'total_shipped',v_world.total_shipped,
    'last_tick_at',v_world.last_tick_at,
    'offline_minutes_processed',v_elapsed,
    'facilities',coalesce((
      select jsonb_agg(jsonb_build_object('facility_id',f.facility_id,'level',f.level,'is_unlocked',f.is_unlocked))
      from public.gem_world_facilities f where f.user_id=v_user
    ),'[]'::jsonb),
    'inventory',coalesce((
      select jsonb_agg(jsonb_build_object('facility_id',i.facility_id,'material_id',i.material_id,'amount',i.amount))
      from public.gem_world_inventory i where i.user_id=v_user and i.amount>0
    ),'[]'::jsonb),
    'shipments',coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'material_id',s.material_id,'amount',s.amount,'arrive_at',s.arrive_at))
      from public.gem_world_shipments s where s.user_id=v_user
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.gem_world_unlock(p_facility_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_catalog public.gem_world_catalog%rowtype;
  v_world public.gem_worlds%rowtype;
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;
  perform public.gem_world_advance();

  select * into v_catalog from public.gem_world_catalog
  where id=p_facility_id and is_available=true;
  if not found or p_facility_id=1 then raise exception 'Facility is unavailable.'; end if;

  select * into v_world from public.gem_worlds
  where user_id=v_user for update;

  if exists(select 1 from public.gem_world_facilities
            where user_id=v_user and facility_id=p_facility_id and is_unlocked) then
    raise exception 'This facility is already unlocked.';
  end if;
  if v_world.gold_balance < v_catalog.unlock_cost_gold then
    raise exception 'Not enough Gold. Required: %.',v_catalog.unlock_cost_gold;
  end if;

  update public.gem_worlds
     set gold_balance=gold_balance-v_catalog.unlock_cost_gold,updated_at=now()
   where user_id=v_user;

  insert into public.gem_world_facilities(user_id,facility_id,level,is_unlocked)
  values(v_user,p_facility_id,1,true)
  on conflict (user_id,facility_id)
  do update set is_unlocked=true,updated_at=now();

  return public.gem_world_advance();
end;
$function$;

revoke all on function public.gem_world_advance() from public,anon;
revoke all on function public.gem_world_unlock(integer) from public,anon;
grant execute on function public.gem_world_advance() to authenticated;
grant execute on function public.gem_world_unlock(integer) to authenticated;

commit;

-- Quick verification after applying:
-- select count(*) as catalog_facilities from public.gem_world_catalog;
-- select proname from pg_proc where proname in ('gem_world_advance','gem_world_unlock');
