-- Enable Supabase Realtime for the GEMS dashboards.
-- Safe to run more than once. This does not alter balances or transaction records.

do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach table_name in array array[
    'profiles',
    'wallets',
    'player_gemstones',
    'wallet_transactions',
    'recharge_orders',
    'withdrawal_requests'
  ]
  loop
    if to_regclass('public.' || table_name) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
