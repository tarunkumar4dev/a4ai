-- ════════════════════════════════════════════════════════════════════════════
-- Coupon codes for checkout (17 Oct 2026)
--
--   * coupons            — one row per code (e.g. AMANX50 = 50% off). No RLS
--                          policies: only service_role / SECURITY DEFINER reads it.
--   * coupon_redemptions — one row per PAID order that used a coupon. Written by a
--                          trigger on payments when status becomes 'paid', so
--                          capture_payment() is not changed.
--   * a4_quote_price(user, plan, cycle, coupon) — the ONE place that decides the
--                          price. Backend create-order must charge final_paise.
--   * quote_price(plan, cycle, coupon) — same, for the signed-in user (checkout UI).
--
-- Prices are rounded DOWN to whole rupees (₹199 at 50% → ₹99), minimum ₹1
-- (Razorpay rejects ₹0 orders).
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Additive only. Verify + rollback at the bottom.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  code            text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  percent_off     integer not null check (percent_off between 1 and 99),
  plan_slugs      text[],                       -- null = every plan
  billing_cycles  text[],                       -- null = monthly and yearly
  max_uses        integer check (max_uses > 0), -- null = unlimited (paid orders, all users)
  per_user_limit  integer not null default 1 check (per_user_limit > 0),
  starts_at       timestamptz,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  note            text,
  created_at      timestamptz not null default now()
);
alter table public.coupons enable row level security;  -- no policies: service_role only

create table if not exists public.coupon_redemptions (
  id                 uuid primary key default gen_random_uuid(),
  coupon_code        text not null,   -- no FK: a deleted coupon must never block capture_payment
  user_id            uuid not null,
  razorpay_order_id  text not null unique,
  plan_id            uuid,
  billing_cycle      text,
  base_paise         integer,
  discount_paise     integer,
  final_paise        integer,
  redeemed_at        timestamptz not null default now()
);
create index if not exists coupon_redemptions_code_user_idx
  on public.coupon_redemptions (coupon_code, user_id);
alter table public.coupon_redemptions enable row level security;  -- no policies: service_role only

insert into public.coupons (code, percent_off, per_user_limit, note)
values ('AMANX50', 50, 1, '50% off any teacher plan, once per user')
on conflict (code) do nothing;

-- ── 2. Price quote ──────────────────────────────────────────────────────────
-- Returns {ok, plan_slug, billing_cycle, base_paise, discount_paise, final_paise,
--          coupon_code, percent_off}  or  {ok:false, error}.
-- A coupon that was given but cannot be used is an error (never a silent full price).
-- Errors: plan_not_found, cycle_unavailable, coupon_invalid, coupon_expired,
--         coupon_not_applicable, coupon_used, coupon_limit_reached.
create or replace function public.a4_quote_price(
  p_user_id uuid,
  p_plan_slug text,
  p_cycle text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan plans%rowtype;
  v_cycle text := lower(coalesce(p_cycle, 'monthly'));
  v_code text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  v_coupon coupons%rowtype;
  v_base integer;
  v_final integer;
  v_used integer;
begin
  if v_cycle not in ('monthly', 'yearly') then
    v_cycle := 'monthly';
  end if;

  select * into v_plan from plans where slug = p_plan_slug and is_active = true limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'plan_not_found');
  end if;

  v_base := case when v_cycle = 'yearly' then v_plan.price_yearly_paise else v_plan.price_paise end;
  if coalesce(v_base, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'cycle_unavailable');
  end if;

  if v_code is null then
    return jsonb_build_object('ok', true, 'plan_slug', v_plan.slug, 'billing_cycle', v_cycle,
                              'base_paise', v_base, 'discount_paise', 0, 'final_paise', v_base,
                              'coupon_code', null, 'percent_off', 0);
  end if;

  select * into v_coupon from coupons where code = v_code;
  if not found or not v_coupon.is_active or (v_coupon.starts_at is not null and v_coupon.starts_at > now()) then
    return jsonb_build_object('ok', false, 'error', 'coupon_invalid');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'coupon_expired');
  end if;
  if (v_coupon.plan_slugs is not null and not (v_plan.slug = any (v_coupon.plan_slugs)))
     or (v_coupon.billing_cycles is not null and not (v_cycle = any (v_coupon.billing_cycles))) then
    return jsonb_build_object('ok', false, 'error', 'coupon_not_applicable');
  end if;

  if p_user_id is not null then
    select count(*) into v_used from coupon_redemptions
    where coupon_code = v_code and user_id = p_user_id;
    if v_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'error', 'coupon_used');
    end if;
  end if;

  if v_coupon.max_uses is not null then
    select count(*) into v_used from coupon_redemptions where coupon_code = v_code;
    if v_used >= v_coupon.max_uses then
      return jsonb_build_object('ok', false, 'error', 'coupon_limit_reached');
    end if;
  end if;

  -- Whole rupees, rounded down, never below ₹1.
  v_final := greatest(100, (v_base * (100 - v_coupon.percent_off) / 100) / 100 * 100);

  return jsonb_build_object('ok', true, 'plan_slug', v_plan.slug, 'billing_cycle', v_cycle,
                            'base_paise', v_base, 'discount_paise', v_base - v_final,
                            'final_paise', v_final, 'coupon_code', v_code,
                            'percent_off', v_coupon.percent_off);
end;
$$;

-- Checkout UI: quote for the signed-in user only.
create or replace function public.quote_price(
  p_plan_slug text,
  p_cycle text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return a4_quote_price(auth.uid(), p_plan_slug, p_cycle, p_coupon_code);
end;
$$;

-- ── 3. Record redemption when an order is paid ──────────────────────────────
-- create-order stores the quote in payments.metadata
-- ({billing_cycle, coupon_code, base_paise, discount_paise, final_paise}).
-- Never raises: a bookkeeping problem must not roll back a captured payment.
create or replace function public.a4_record_coupon_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into coupon_redemptions (coupon_code, user_id, razorpay_order_id, plan_id, billing_cycle,
                                    base_paise, discount_paise, final_paise)
    values (upper(new.metadata ->> 'coupon_code'), new.user_id, new.razorpay_order_id, new.plan_id,
            new.metadata ->> 'billing_cycle',
            nullif(new.metadata ->> 'base_paise', '')::integer,
            nullif(new.metadata ->> 'discount_paise', '')::integer,
            nullif(new.metadata ->> 'final_paise', '')::integer)
    on conflict (razorpay_order_id) do nothing;
  exception when others then
    raise warning 'coupon redemption not recorded for order %: %', new.razorpay_order_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists payments_coupon_redemption on public.payments;
create trigger payments_coupon_redemption
  after update of status on public.payments
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid'
        and coalesce(new.metadata ->> 'coupon_code', '') <> '')
  execute function public.a4_record_coupon_redemption();

-- ── 4. Who may call what ────────────────────────────────────────────────────
revoke execute on function public.a4_quote_price(uuid, text, text, text)  from public, anon, authenticated;
revoke execute on function public.quote_price(text, text, text)           from public, anon;
revoke execute on function public.a4_record_coupon_redemption()           from public, anon, authenticated;

grant execute on function public.a4_quote_price(uuid, text, text, text) to service_role;
grant execute on function public.quote_price(text, text, text)          to authenticated, service_role;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY (every row should say true)
-- ════════════════════════════════════════════════════════════════════════════
-- select 'AMANX50 exists' as check, exists(select 1 from public.coupons where code = 'AMANX50') as ok
-- union all select 'starter monthly 50% = 9900',
--   (public.a4_quote_price(null, 'starter', 'monthly', 'amanx50') ->> 'final_paise')::int = 9900
-- union all select 'no coupon = full price',
--   (public.a4_quote_price(null, 'starter', 'monthly', null) ->> 'discount_paise')::int = 0
-- union all select 'bad coupon rejected',
--   public.a4_quote_price(null, 'starter', 'monthly', 'NOPE') ->> 'error' = 'coupon_invalid'
-- union all select 'anon cannot quote', not has_function_privilege('anon', 'public.quote_price(text,text,text)', 'EXECUTE')
-- union all select 'authenticated cannot call a4_quote_price',
--   not has_function_privilege('authenticated', 'public.a4_quote_price(uuid,text,text,text)', 'EXECUTE')
-- union all select 'coupons has RLS', (select relrowsecurity from pg_class where oid = 'public.coupons'::regclass)
-- union all select 'redemptions has RLS', (select relrowsecurity from pg_class where oid = 'public.coupon_redemptions'::regclass);
--
-- Manage coupons (SQL Editor):
--   insert into coupons (code, percent_off, max_uses, expires_at) values ('DIWALI30', 30, 100, '2026-11-15');
--   update coupons set is_active = false where code = 'AMANX50';
--   select coupon_code, count(*), sum(discount_paise)/100 as rupees_off from coupon_redemptions group by 1;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop trigger if exists payments_coupon_redemption on public.payments;
-- drop function if exists public.a4_record_coupon_redemption();
-- drop function if exists public.quote_price(text, text, text);
-- drop function if exists public.a4_quote_price(uuid, text, text, text);
-- drop table if exists public.coupon_redemptions;
-- drop table if exists public.coupons;
-- commit;
