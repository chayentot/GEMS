-- Separate main-account Gold and Gems Tycoon 3 wallet.
begin;

alter table public.wallets
  add column if not exists gold_balance numeric(24,8) not null default 0
  check (gold_balance >= 0);

create table if not exists public.tycoon3_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gold_balance numeric(24,8) not null default 0 check (gold_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gold_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('market_buy','market_sell','deposit','withdraw')),
  gold_amount numeric(24,8) not null,
  gems_amount numeric(24,8) not null default 0,
  fee_amount numeric(24,8) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gold_transactions_user_created_idx
  on public.gold_transactions(user_id, created_at desc);

alter table public.tycoon3_wallets enable row level security;
alter table public.gold_transactions enable row level security;
drop policy if exists "Players read own Tycoon 3 wallet" on public.tycoon3_wallets;
create policy "Players read own Tycoon 3 wallet" on public.tycoon3_wallets
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Players read own Gold transactions" on public.gold_transactions;
create policy "Players read own Gold transactions" on public.gold_transactions
  for select to authenticated using (user_id = auth.uid());
revoke all on public.tycoon3_wallets, public.gold_transactions from anon, authenticated;
grant select on public.tycoon3_wallets, public.gold_transactions to authenticated;

create or replace function public.gold_market_buy(p_gems_amount numeric)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_wallet public.wallets%rowtype; v_fee numeric(24,8); v_gold numeric(24,8);
begin
 if v_uid is null then raise exception 'Sign in required.'; end if;
 if p_gems_amount is null or p_gems_amount<=0 then raise exception 'Enter a valid GEMS amount.'; end if;
 select * into v_wallet from public.wallets where user_id=v_uid for update;
 if not found then raise exception 'Main wallet not found.'; end if;
 if v_wallet.gems_balance<p_gems_amount then raise exception 'Insufficient GEMS balance.'; end if;
 v_fee:=round(p_gems_amount*0.05,8); v_gold:=round(p_gems_amount-v_fee,8);
 update public.wallets set gems_balance=gems_balance-p_gems_amount,gold_balance=gold_balance+v_gold,updated_at=now() where user_id=v_uid;
 insert into public.gold_transactions(user_id,transaction_type,gold_amount,gems_amount,fee_amount) values(v_uid,'market_buy',v_gold,p_gems_amount,v_fee);
 insert into public.wallet_transactions(user_id,transaction_type,amount,description) values(v_uid,'gold_market_buy',-p_gems_amount,'Bought Gold at 1:1 rate; 5% fee');
 return jsonb_build_object('gold_received',v_gold,'fee',v_fee);
end $$;

create or replace function public.gold_market_sell(p_gold_amount numeric)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_wallet public.wallets%rowtype; v_fee numeric(24,8); v_gems numeric(24,8);
begin
 if v_uid is null then raise exception 'Sign in required.'; end if;
 if p_gold_amount is null or p_gold_amount<=0 then raise exception 'Enter a valid Gold amount.'; end if;
 select * into v_wallet from public.wallets where user_id=v_uid for update;
 if not found then raise exception 'Main wallet not found.'; end if;
 if v_wallet.gold_balance<p_gold_amount then raise exception 'Insufficient main Gold balance.'; end if;
 v_fee:=round(p_gold_amount*0.05,8); v_gems:=round(p_gold_amount-v_fee,8);
 update public.wallets set gold_balance=gold_balance-p_gold_amount,gems_balance=gems_balance+v_gems,updated_at=now() where user_id=v_uid;
 insert into public.gold_transactions(user_id,transaction_type,gold_amount,gems_amount,fee_amount) values(v_uid,'market_sell',p_gold_amount,v_gems,v_fee);
 insert into public.wallet_transactions(user_id,transaction_type,amount,description) values(v_uid,'gold_market_sell',v_gems,'Sold Gold at 1:1 rate; 5% fee');
 return jsonb_build_object('gems_received',v_gems,'fee',v_fee);
end $$;

create or replace function public.tycoon3_gold_transfer(p_direction text,p_gold_amount numeric)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_main public.wallets%rowtype; v_map public.tycoon3_wallets%rowtype; v_fee numeric(24,8); v_net numeric(24,8);
begin
 if v_uid is null then raise exception 'Sign in required.'; end if;
 if p_direction not in ('deposit','withdraw') then raise exception 'Invalid transfer direction.'; end if;
 if p_gold_amount is null or p_gold_amount<=0 then raise exception 'Enter a valid Gold amount.'; end if;
 insert into public.tycoon3_wallets(user_id) values(v_uid) on conflict(user_id) do nothing;
 select * into v_main from public.wallets where user_id=v_uid for update;
 select * into v_map from public.tycoon3_wallets where user_id=v_uid for update;
 if not found then raise exception 'Map 3 wallet not found.'; end if;
 v_fee:=round(p_gold_amount*0.03,8); v_net:=round(p_gold_amount-v_fee,8);
 if v_net<=0 then raise exception 'Transfer amount is too small.'; end if;
 if p_direction='deposit' then
   if v_main.gold_balance<p_gold_amount then raise exception 'Insufficient main Gold balance.'; end if;
   update public.wallets set gold_balance=gold_balance-p_gold_amount,updated_at=now() where user_id=v_uid;
   update public.tycoon3_wallets set gold_balance=gold_balance+v_net,updated_at=now() where user_id=v_uid;
 else
   if v_map.gold_balance<p_gold_amount then raise exception 'Insufficient Map 3 Gold balance.'; end if;
   update public.tycoon3_wallets set gold_balance=gold_balance-p_gold_amount,updated_at=now() where user_id=v_uid;
   update public.wallets set gold_balance=gold_balance+v_net,updated_at=now() where user_id=v_uid;
 end if;
 insert into public.gold_transactions(user_id,transaction_type,gold_amount,fee_amount) values(v_uid,p_direction,p_gold_amount,v_fee);
 return jsonb_build_object('direction',p_direction,'amount',p_gold_amount,'fee',v_fee,'received',v_net);
end $$;

revoke all on function public.gold_market_buy(numeric),public.gold_market_sell(numeric),public.tycoon3_gold_transfer(text,numeric) from public,anon;
grant execute on function public.gold_market_buy(numeric),public.gold_market_sell(numeric),public.tycoon3_gold_transfer(text,numeric) to authenticated;
commit;
