-- GEMS three-level referral rewards.
-- Commission is earned only when a player spends GEMS in a successful market BUY.
-- Recharge approvals, market SELLs, mining, unit conversions and unit-only upgrades
-- do not generate referral commission.

begin;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id);

update public.profiles
set referral_code = 'GEMS' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
where referral_code is null or btrim(referral_code) = '';

create unique index if not exists profiles_referral_code_uidx
  on public.profiles(referral_code);

create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_not_self_referred'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_not_self_referred
      check (referred_by is null or referred_by <> id);
  end if;
end $$;

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(id) on delete restrict,
  source_user_id uuid not null references public.profiles(id) on delete restrict,
  market_transaction_id uuid not null references public.market_transactions(id) on delete restrict,
  referral_level smallint not null check (referral_level between 1 and 3),
  commission_rate numeric(5,4) not null check (commission_rate in (0.08,0.03,0.01)),
  spend_amount numeric(24,8) not null check (spend_amount > 0),
  commission_amount numeric(24,8) not null check (commission_amount > 0),
  created_at timestamptz not null default now(),
  constraint referral_commissions_once_per_beneficiary
    unique (market_transaction_id, beneficiary_id)
);

create index if not exists referral_commissions_beneficiary_created_idx
  on public.referral_commissions(beneficiary_id, created_at desc);
create index if not exists referral_commissions_source_idx
  on public.referral_commissions(source_user_id, created_at desc);

alter table public.referral_commissions enable row level security;

drop policy if exists "Players read own referral commissions" on public.referral_commissions;
create policy "Players read own referral commissions"
  on public.referral_commissions for select to authenticated
  using (beneficiary_id = auth.uid() or public.is_admin());

drop policy if exists "GEMS admins read all referral commissions" on public.referral_commissions;
create policy "GEMS admins read all referral commissions"
  on public.referral_commissions for select to authenticated
  using (public.is_admin());

revoke all on public.referral_commissions from anon, authenticated;
grant select on public.referral_commissions to authenticated;

-- Every newly created player receives a unique referral code automatically.
create or replace function public.assign_gems_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    loop
      new.referral_code := 'GEMS' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists (
        select 1 from public.profiles p
        where p.referral_code = new.referral_code
      );
    end loop;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_assign_gems_referral_code on public.profiles;
create trigger profiles_assign_gems_referral_code
before insert on public.profiles
for each row execute function public.assign_gems_referral_code();

-- Bind a new account to the referral code submitted on the signup form.
-- The zzzz trigger name makes this run after the existing profile-creation trigger.
create or replace function public.apply_gems_signup_referral()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_code text;
  v_referrer uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  if v_code = '' then return new; end if;

  select id into v_referrer
  from public.profiles
  where upper(referral_code) = v_code
  limit 1;

  if v_referrer is not null and v_referrer <> new.id then
    update public.profiles
       set referred_by = v_referrer
     where id = new.id
       and referred_by is null;
  end if;

  return new;
end;
$function$;

drop trigger if exists zzzz_gems_apply_signup_referral on auth.users;
create trigger zzzz_gems_apply_signup_referral
after insert on auth.users
for each row execute function public.apply_gems_signup_referral();

-- Award commissions atomically with the market transaction. A failed commission
-- credit rolls back the purchase as part of the same database transaction.
create or replace function public.award_gems_referral_commissions()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_referrer uuid;
  v_level integer;
  v_rate numeric(5,4);
  v_amount numeric(24,8);
  v_commission_id uuid;
  v_balance numeric(24,8);
begin
  if new.side <> 'buy' then return new; end if;

  select referred_by into v_referrer
  from public.profiles
  where id = new.user_id;

  for v_level in 1..3 loop
    exit when v_referrer is null;

    v_rate := case v_level
      when 1 then 0.08
      when 2 then 0.03
      else 0.01
    end;
    v_amount := round(new.gems_amount * v_rate, 8);
    v_commission_id := null;

    if v_amount > 0 then
      insert into public.referral_commissions
        (beneficiary_id, source_user_id, market_transaction_id,
         referral_level, commission_rate, spend_amount, commission_amount)
      values
        (v_referrer, new.user_id, new.id,
         v_level, v_rate, new.gems_amount, v_amount)
      on conflict (market_transaction_id, beneficiary_id) do nothing
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
             (v_rate * 100)::text || '%) from GEMS market spending',
           new.id);
      end if;
    end if;

    select referred_by into v_referrer
    from public.profiles
    where id = v_referrer;
  end loop;

  return new;
end;
$function$;

drop trigger if exists market_buy_awards_referral_commissions
  on public.market_transactions;
create trigger market_buy_awards_referral_commissions
after insert on public.market_transactions
for each row
when (new.side = 'buy')
execute function public.award_gems_referral_commissions();

-- Safe read-only summary for the signed-in player's referral panel.
create or replace function public.get_my_referral_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  with recursive downline(user_id, depth) as (
    select p.id, 1
    from public.profiles p
    where p.referred_by = auth.uid()
    union all
    select child.id, parent.depth + 1
    from public.profiles child
    join downline parent on child.referred_by = parent.user_id
    where parent.depth < 3
  )
  select jsonb_build_object(
    'referral_code', p.referral_code,
    'level1_count', (select count(*) from downline where depth = 1),
    'level2_count', (select count(*) from downline where depth = 2),
    'level3_count', (select count(*) from downline where depth = 3),
    'total_earned', coalesce((
      select sum(c.commission_amount)
      from public.referral_commissions c
      where c.beneficiary_id = auth.uid()
    ), 0)
  )
  from public.profiles p
  where p.id = auth.uid();
$function$;

revoke all on function public.get_my_referral_summary() from public, anon;
grant execute on function public.get_my_referral_summary() to authenticated;

-- Referral commission rows are private to the beneficiary and GEMS admins.
revoke all on function public.assign_gems_referral_code() from public, anon, authenticated;\nrevoke all on function public.apply_gems_signup_referral() from public, anon, authenticated;
revoke all on function public.award_gems_referral_commissions() from public, anon, authenticated;

-- Add the commission ledger to the existing Supabase Realtime publication if present.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'referral_commissions'
     ) then
    alter publication supabase_realtime add table public.referral_commissions;
  end if;
end $$;

commit;
