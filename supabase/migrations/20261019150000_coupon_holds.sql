-- 20261019150000_coupon_holds.sql — close the "two tabs, two discounted payments" race on coupons
--
-- Problem: create-order checks per_user_limit / max_uses against coupon_redemptions, but a redemption is only
-- written when a payment is captured. Two orders opened before either is paid both pass the check, so a user
-- can pay twice at 50% with a once-per-user coupon (and max_uses can be overshot the same way).
--
-- Fix: create-order takes a short HOLD on the coupon before it creates the Razorpay order, under a lock:
--   * the same user + coupon may have only ONE live hold;
--   * a second checkout for the same plan + cycle gets the SAME Razorpay order back (reuse_order_id) — Razorpay
--     accepts only one successful payment per order, so it can be paid once;
--   * a second checkout for another plan / cycle is refused until the hold expires (coupon_in_checkout);
--   * live holds count towards max_uses.
-- Redemptions are still written by the existing trigger on payments; a hold whose order was redeemed no longer
-- counts as live. Nothing else changes; a4_quote_price / quote_price / capture_payment are untouched.
--
-- ORDER: deploy the backend change that calls a4_hold_coupon AFTER this migration (the old backend ignores it).
-- Not run on live. Tested on PGlite (Postgres 17 in WASM) with stub plans/payments tables — see the PR notes.

begin;

create table if not exists public.coupon_holds (
  id                uuid primary key default gen_random_uuid(),
  coupon_code       text not null,
  user_id           uuid not null,
  plan_slug         text not null,
  billing_cycle     text not null,
  razorpay_order_id text unique,             -- set by create-order right after the Razorpay order exists
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null
);
create index if not exists coupon_holds_code_user_idx on public.coupon_holds (coupon_code, user_id, expires_at);
alter table public.coupon_holds enable row level security;   -- no policies: service_role only
revoke all on public.coupon_holds from anon, authenticated;

-- Returns {ok:true, hold_id, reuse_order_id|null} or {ok:false, error[, retry_after]}.
-- Errors: coupon_invalid, coupon_used, coupon_limit_reached, coupon_in_checkout.
create or replace function public.a4_hold_coupon(
  p_user_id     uuid,
  p_coupon_code text,
  p_plan_slug   text,
  p_cycle       text,
  p_minutes     integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code   text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  v_coupon coupons%rowtype;
  v_hold   coupon_holds%rowtype;
  v_used   integer;
begin
  if v_code is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'coupon_invalid');
  end if;

  -- One checkout at a time per user + coupon. Released at commit.
  perform pg_advisory_xact_lock(hashtextextended('a4_coupon_user:' || v_code || ':' || p_user_id::text, 0));

  select * into v_coupon from coupons where code = v_code;
  if not found or not v_coupon.is_active then
    return jsonb_build_object('ok', false, 'error', 'coupon_invalid');
  end if;

  -- This user's live hold (not expired, its order not redeemed yet)
  select h.* into v_hold
    from coupon_holds h
   where h.coupon_code = v_code and h.user_id = p_user_id and h.expires_at > now()
     and not exists (select 1 from coupon_redemptions r where r.razorpay_order_id = h.razorpay_order_id)
   order by h.created_at desc
   limit 1;
  if found then
    if v_hold.plan_slug = p_plan_slug and v_hold.billing_cycle = p_cycle then
      return jsonb_build_object('ok', true, 'hold_id', v_hold.id, 'reuse_order_id', v_hold.razorpay_order_id);
    end if;
    return jsonb_build_object('ok', false, 'error', 'coupon_in_checkout', 'retry_after', v_hold.expires_at);
  end if;

  select count(*) into v_used from coupon_redemptions where coupon_code = v_code and user_id = p_user_id;
  if v_used >= v_coupon.per_user_limit then
    return jsonb_build_object('ok', false, 'error', 'coupon_used');
  end if;

  if v_coupon.max_uses is not null then
    perform pg_advisory_xact_lock(hashtextextended('a4_coupon_all:' || v_code, 0));
    select (select count(*) from coupon_redemptions where coupon_code = v_code)
         + (select count(*) from coupon_holds h
             where h.coupon_code = v_code and h.expires_at > now()
               and not exists (select 1 from coupon_redemptions r where r.razorpay_order_id = h.razorpay_order_id))
      into v_used;
    if v_used >= v_coupon.max_uses then
      return jsonb_build_object('ok', false, 'error', 'coupon_limit_reached');
    end if;
  end if;

  insert into coupon_holds (coupon_code, user_id, plan_slug, billing_cycle, expires_at)
  values (v_code, p_user_id, p_plan_slug, p_cycle, now() + make_interval(mins => greatest(1, least(coalesce(p_minutes, 30), 120))))
  returning * into v_hold;
  return jsonb_build_object('ok', true, 'hold_id', v_hold.id, 'reuse_order_id', null);
end;
$$;

revoke execute on function public.a4_hold_coupon(uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.a4_hold_coupon(uuid, text, text, text, integer) to service_role;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY (every row true; read-only)
-- ════════════════════════════════════════════════════════════════════════════
-- select 'coupon_holds has RLS' as check, (select relrowsecurity from pg_class where oid = 'public.coupon_holds'::regclass) as ok
-- union all select 'anon cannot read holds', not has_table_privilege('anon', 'public.coupon_holds', 'SELECT')
-- union all select 'anon cannot hold', not has_function_privilege('anon', 'public.a4_hold_coupon(uuid,text,text,text,integer)', 'EXECUTE')
-- union all select 'authenticated cannot hold', not has_function_privilege('authenticated', 'public.a4_hold_coupon(uuid,text,text,text,integer)', 'EXECUTE')
-- union all select 'service_role can hold', has_function_privilege('service_role', 'public.a4_hold_coupon(uuid,text,text,text,integer)', 'EXECUTE');
--
-- Monitoring (run now and then): users who still got more uses than allowed, e.g. an old order paid after its
-- hold expired.
-- select r.coupon_code, r.user_id, count(*) as uses, c.per_user_limit
--   from coupon_redemptions r join coupons c on c.code = r.coupon_code
--  group by 1, 2, 4 having count(*) > c.per_user_limit;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (deploy the old backend first, or create-order will fail on the missing function)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.a4_hold_coupon(uuid, text, text, text, integer);
-- drop table if exists public.coupon_holds;
-- commit;
