-- ════════════════════════════════════════════════════════════════════════════
-- Payment pipeline + plan entitlements (01 Oct 2026)
--
-- Fixes:
--   * Activation was impossible: activate_subscription() inserted a second
--     payments row for the same order (unique violation) and the backend
--     fallback wrote columns that do not exist (started_at, metadata) and a
--     status the check constraint rejects ('captured'). A payment could end up
--     captured with no subscription.
--   * Plan was read from three places that disagreed (subscriptions vs
--     teacher_profiles.plan_id). Now one rule everywhere: an active, unexpired
--     subscription, otherwise Free.
--   * activate_subscription / check_usage / record_usage / increment_usage were
--     executable with the anon key (anyone could give themselves a paid plan or
--     burn another user's quota).
--   * WhatsApp papers were unlimited and uncounted.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Additive except for the REVOKEs at the end. Verification and rollback queries
-- are at the bottom of this file.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Effective plan ───────────────────────────────────────────────────────
-- The plan a user is entitled to right now: their active, unexpired
-- subscription, otherwise the Free plan.
create or replace function public.a4_effective_plan(p_user_id uuid)
returns table (
  plan_id uuid,
  slug text,
  display_name text,
  test_limit integer,
  price_paise integer,
  features jsonb,
  subscription_status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select s.plan_id, s.expires_at
    from subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and s.expires_at > now()
    limit 1
  )
  select p.id, p.slug, p.display_name, p.test_limit, p.price_paise, p.features,
         case when sub.plan_id is not null then 'active' else 'none' end,
         sub.expires_at
  from plans p
  left join sub on true
  where p.id = coalesce(sub.plan_id, (select f.id from plans f where f.slug = 'free' limit 1));
$$;

-- ── 2. Usage checks (website test generation) ───────────────────────────────
-- Same response shape as before: {allowed, used, limit, remaining}.
create or replace function public.check_usage(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_used integer;
begin
  select * into v_plan from a4_effective_plan(p_user_id);

  select coalesce(sum(count), 0) into v_used
  from usage_records
  where user_id = p_user_id
    and action_type = 'test_generated'
    and billing_period = to_char(now(), 'YYYY-MM');

  if v_plan.test_limit < 0 then
    return jsonb_build_object('allowed', true, 'used', v_used, 'limit', -1, 'remaining', -1,
                              'plan', v_plan.slug);
  end if;

  return jsonb_build_object(
    'allowed', v_used < v_plan.test_limit,
    'used', v_used,
    'limit', v_plan.test_limit,
    'remaining', greatest(v_plan.test_limit - v_used, 0),
    'plan', v_plan.slug);
end;
$$;

-- Check + count in one step (POST /payment/check-usage).
create or replace function public.increment_usage(p_user_id uuid, p_action text default 'test_generated')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_period text := to_char(now(), 'YYYY-MM');
  v_used integer;
begin
  select * into v_plan from a4_effective_plan(p_user_id);

  select coalesce(sum(count), 0) into v_used
  from usage_records
  where user_id = p_user_id and action_type = p_action and billing_period = v_period;

  if v_plan.test_limit >= 0 and v_used >= v_plan.test_limit then
    return jsonb_build_object('allowed', false, 'error', 'limit_reached', 'plan', v_plan.slug,
                              'used', v_used, 'limit', v_plan.test_limit);
  end if;

  insert into usage_records (user_id, action_type, billing_period, count)
  values (p_user_id, p_action, v_period, 1)
  on conflict (user_id, action_type, billing_period)
  do update set count = usage_records.count + 1, updated_at = now();

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', v_plan.test_limit,
    'remaining', case when v_plan.test_limit < 0 then -1 else v_plan.test_limit - (v_used + 1) end,
    'plan', v_plan.slug);
end;
$$;

-- ── 3. Plan status for the dashboard ────────────────────────────────────────
-- Same keys as before. Signed-in users may only read their own status; the
-- backend (service_role, no auth.uid()) may read anyone's.
create or replace function public.get_user_plan_status(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_used integer;
  v_period text := to_char(now(), 'YYYY-MM');
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_plan from a4_effective_plan(p_user_id);

  select coalesce(sum(count), 0) into v_used
  from usage_records
  where user_id = p_user_id and action_type = 'test_generated' and billing_period = v_period;

  return jsonb_build_object(
    'plan_slug', v_plan.slug,
    'plan_name', v_plan.display_name,
    'test_limit', v_plan.test_limit,
    'price_paise', v_plan.price_paise,
    'features', v_plan.features,
    'tests_used', v_used,
    'tests_remaining', case when v_plan.test_limit < 0 then -1
                            else greatest(0, v_plan.test_limit - v_used) end,
    'billing_period', v_period,
    'subscription_status', v_plan.subscription_status,
    'subscription_expires', v_plan.expires_at);
end;
$$;

-- ── 4. Capture a paid order (verify-payment and the Razorpay webhook) ───────
-- One transaction: lock the order we created, mark it paid, start or extend the
-- subscription, sync teacher_profiles.plan_id. Idempotent: a second call for the
-- same order returns the existing subscription and changes nothing.
-- The caller must already have verified Razorpay's signature.
create or replace function public.capture_payment(
  p_order_id text,
  p_payment_id text,
  p_signature text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay payments%rowtype;
  v_plan plans%rowtype;
  v_sub subscriptions%rowtype;
  v_cycle text;
  v_start timestamptz := now();
  v_expires timestamptz;
begin
  select * into v_pay from payments where razorpay_order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  if v_pay.status in ('paid', 'refunded') then
    select * into v_sub from subscriptions where user_id = v_pay.user_id;
    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'user_id', v_pay.user_id,
      'plan', (select slug from plans where id = v_sub.plan_id),
      'subscription_id', v_sub.id,
      'expires_at', v_sub.expires_at);
  end if;

  select * into v_plan from plans where id = v_pay.plan_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'plan_missing');
  end if;

  v_cycle := coalesce(v_pay.metadata ->> 'billing_cycle', 'monthly');
  if v_cycle not in ('monthly', 'yearly') then
    v_cycle := 'monthly';
  end if;

  -- Renewing the same plan before it runs out extends it; anything else starts now.
  select * into v_sub from subscriptions where user_id = v_pay.user_id for update;
  if found and v_sub.status = 'active' and v_sub.plan_id = v_plan.id and v_sub.expires_at > now() then
    v_start := v_sub.expires_at;
  end if;
  v_expires := v_start + case when v_cycle = 'yearly' then interval '365 days' else interval '30 days' end;

  insert into subscriptions (user_id, plan_id, status, razorpay_order_id, razorpay_payment_id, starts_at, expires_at)
  values (v_pay.user_id, v_plan.id, 'active', p_order_id, p_payment_id, now(), v_expires)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        razorpay_order_id = excluded.razorpay_order_id,
        razorpay_payment_id = excluded.razorpay_payment_id,
        starts_at = excluded.starts_at,
        expires_at = excluded.expires_at
  returning * into v_sub;

  update payments
     set status = 'paid',
         razorpay_payment_id = p_payment_id,
         razorpay_signature = coalesce(p_signature, razorpay_signature),
         captured_at = now(),
         subscription_id = v_sub.id
   where id = v_pay.id;

  update teacher_profiles set plan_id = v_plan.id, updated_at = now() where id = v_pay.user_id;

  return jsonb_build_object(
    'success', true,
    'already_processed', false,
    'user_id', v_pay.user_id,
    'plan', v_plan.slug,
    'billing_cycle', v_cycle,
    'subscription_id', v_sub.id,
    'expires_at', v_sub.expires_at);
end;
$$;

-- ── 5. WhatsApp papers ──────────────────────────────────────────────────────
-- A phone that belongs to an a4ai account uses that account's plan and monthly
-- quota. Any other phone gets the Free plan's monthly limit, counted here.
create table if not exists public.whatsapp_usage (
  phone text not null,
  billing_period text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (phone, billing_period)
);
alter table public.whatsapp_usage enable row level security;  -- no policies: service_role only

-- p_consume = false: check only. p_consume = true: count one paper (call after the PDF is sent).
create or replace function public.whatsapp_paper_quota(p_phone text, p_consume boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_user uuid;
  v_plan record;
  v_period text := to_char(now(), 'YYYY-MM');
  v_used integer;
  v_limit integer;
begin
  if length(v_digits) < 10 then
    return jsonb_build_object('allowed', false, 'error', 'invalid_phone');
  end if;

  -- Match on the last 10 digits so "919310791676", "+91 93107 91676" and "9310791676" agree.
  select id into v_user
  from teacher_profiles
  where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = right(v_digits, 10)
  order by updated_at desc
  limit 1;

  if v_user is not null then
    if p_consume then
      return increment_usage(v_user, 'test_generated') || jsonb_build_object('linked', true);
    end if;
    return check_usage(v_user) || jsonb_build_object('linked', true);
  end if;

  select test_limit into v_limit from plans where slug = 'free' limit 1;
  v_limit := coalesce(v_limit, 2);

  select coalesce(count, 0) into v_used from whatsapp_usage
  where phone = v_digits and billing_period = v_period;
  v_used := coalesce(v_used, 0);

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit, 'remaining', 0,
                              'plan', 'free', 'linked', false);
  end if;

  if p_consume then
    insert into whatsapp_usage (phone, billing_period, count) values (v_digits, v_period, 1)
    on conflict (phone, billing_period)
    do update set count = whatsapp_usage.count + 1, updated_at = now();
    v_used := v_used + 1;
  end if;

  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit,
                            'remaining', greatest(v_limit - v_used, 0), 'plan', 'free', 'linked', false);
end;
$$;

-- ── 6. Who may call what ────────────────────────────────────────────────────
-- Functions are executable by PUBLIC by default; close that for everything that
-- grants plans or spends quota. The backend uses the service_role key.
revoke execute on function public.activate_subscription(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.capture_payment(text, text, text)                  from public, anon, authenticated;
revoke execute on function public.check_usage(uuid)                                  from public, anon, authenticated;
revoke execute on function public.record_usage(uuid, text)                           from public, anon, authenticated;
revoke execute on function public.increment_usage(uuid, text)                        from public, anon, authenticated;
revoke execute on function public.whatsapp_paper_quota(text, boolean)                from public, anon, authenticated;
revoke execute on function public.a4_effective_plan(uuid)                            from public, anon, authenticated;
revoke execute on function public.get_user_plan_status(uuid)                         from public, anon;

grant execute on function public.capture_payment(text, text, text)      to service_role;
grant execute on function public.check_usage(uuid)                      to service_role;
grant execute on function public.record_usage(uuid, text)               to service_role;
grant execute on function public.increment_usage(uuid, text)            to service_role;
grant execute on function public.whatsapp_paper_quota(text, boolean)    to service_role;
grant execute on function public.a4_effective_plan(uuid)                to service_role;
grant execute on function public.get_user_plan_status(uuid)             to authenticated, service_role;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY (run after the migration; every row should say true)
-- ════════════════════════════════════════════════════════════════════════════
-- select 'capture_payment exists' as check, to_regprocedure('public.capture_payment(text,text,text)') is not null as ok
-- union all select 'anon cannot activate', not has_function_privilege('anon', 'public.activate_subscription(uuid,text,text,text,text)', 'EXECUTE')
-- union all select 'anon cannot capture', not has_function_privilege('anon', 'public.capture_payment(text,text,text)', 'EXECUTE')
-- union all select 'anon cannot check_usage', not has_function_privilege('anon', 'public.check_usage(uuid)', 'EXECUTE')
-- union all select 'authenticated cannot record_usage', not has_function_privilege('authenticated', 'public.record_usage(uuid,text)', 'EXECUTE')
-- union all select 'authenticated can read own plan', has_function_privilege('authenticated', 'public.get_user_plan_status(uuid)', 'EXECUTE')
-- union all select 'free plan resolves', (select slug from public.a4_effective_plan('00000000-0000-4000-8000-000000000000')) = 'free'
-- union all select 'whatsapp_usage has RLS', (select relrowsecurity from pg_class where oid = 'public.whatsapp_usage'::regclass);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK: supabase/migrations/20261001200001_payment_pipeline_ROLLBACK.sql.txt
-- (exact previous function bodies + grants; .txt so migration tooling never runs it)
-- ════════════════════════════════════════════════════════════════════════════
