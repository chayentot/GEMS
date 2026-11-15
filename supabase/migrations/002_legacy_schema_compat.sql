-- GEMS compatibility upgrade for the ORIGINAL database foundation
-- Safe additive migration: preserves existing tables, records, balances, and signup trigger.
-- Run this on the database that uses mining_sessions and recharge_orders.
-- Do NOT run the newer 001_gems_schema.sql against that legacy schema.

begin;

-- The original database already has admin_users and is_admin().
-- Add the two admin actions used for completing the existing request workflow.

create or replace function public.admin_reject_recharge(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  update public.recharge_orders
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_order_id
     and status = 'pending';

  if not found then
    raise exception 'Pending recharge order not found.';
  end if;
end;
$function$;

create or replace function public.admin_mark_withdrawal_paid(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  update public.withdrawal_requests
     set status = 'paid',
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id
     and status in ('pending', 'approved');

  if not found then
    raise exception 'Pending or approved withdrawal request not found.';
  end if;
end;
$function$;

-- These functions are called from the signed-in admin application.
revoke all on function public.admin_reject_recharge(uuid) from public, anon;
revoke all on function public.admin_mark_withdrawal_paid(uuid) from public, anon;
grant execute on function public.admin_reject_recharge(uuid) to authenticated;
grant execute on function public.admin_mark_withdrawal_paid(uuid) to authenticated;

commit;

-- Existing player RPCs remain unchanged and continue to use:
--   player_gemstones + mining_sessions
--   recharge_orders
--   withdrawal_requests
-- Existing handle_new_user() trigger is intentionally preserved.
