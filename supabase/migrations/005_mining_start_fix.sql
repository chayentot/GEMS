-- Fix mining start for owned gemstones that are currently marked inactive.
-- Starting a cycle reactivates the player's gemstone; it does not change any
-- earning rate, level-up cost, unlock cost, or balance.

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
  if not found then raise exception 'Gemstone not found in your collection.'; end if;

  if exists (
    select 1 from public.mining_sessions
    where player_gemstone_id = p_player_gemstone_id
      and user_id = auth.uid()
      and is_active = true
  ) then
    raise exception 'A mining session is already active. Collect your rewards before starting another cycle.';
  end if;

  -- An owned gemstone can be reactivated when its owner starts mining.
  update public.player_gemstones
  set is_active = true
  where id = p_player_gemstone_id and user_id = auth.uid();

  insert into public.mining_sessions
    (player_gemstone_id,user_id,started_at,ends_at,last_collected_at,is_active)
  values
    (p_player_gemstone_id,auth.uid(),now(),now()+interval '24 hours',now(),true)
  returning id into v_session_id;

  return v_session_id;
end;
$function$;

revoke all on function public.start_mining(uuid) from public,anon;
grant execute on function public.start_mining(uuid) to authenticated;
