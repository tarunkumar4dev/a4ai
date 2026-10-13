-- 19_test_generation_reserve.sql — DRAFT (13 Oct 2026). Human reviews and runs it.
--
-- Race: the backend did check_usage (read) → generate the paper (10–60 s) → record_usage (+1). Parallel
-- requests all passed the check before any was counted, so a free user (limit 2/month) could get many
-- papers by firing requests at once.
--
-- Fix: reserve first, refund on failure.
--   reserve_test_generation(user)        per-user advisory lock → plan limit check → +1 in the same
--                                        transaction. Parallel calls queue on the lock; the extra ones
--                                        see the new count and are refused.
--   release_test_generation(user, period) −1 for that billing period when the generation failed.
-- Period stays the calendar month in UTC ('YYYY-MM'), exactly like check_usage / get_user_plan_status /
-- record_usage, so the dashboard numbers keep matching.
-- Backend (RAG-BACKEND fix/quota-race) calls reserve/release; if this migration isn't applied yet it falls
-- back to the old check-then-record path, so the order of deploys doesn't break anything.
-- Also: record_usage was SECURITY DEFINER without a fixed search_path → pinned to public.
-- Safe to re-run.

begin;

create or replace function public.reserve_test_generation(p_user_id uuid, p_action text default 'test_generated')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_plan   record;
  v_period text := to_char(now(), 'YYYY-MM');
  v_used   integer;
begin
  if p_user_id is null then
    return jsonb_build_object('allowed', false, 'error', 'no_user');
  end if;

  -- one generation decision at a time per user + action
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_user_id::text || ':' || p_action, 0));

  -- usage_records.user_id references teacher_profiles; some accounts never got a row
  insert into teacher_profiles (id) values (p_user_id) on conflict (id) do nothing;

  select * into v_plan from a4_effective_plan(p_user_id);

  select coalesce(sum(count), 0) into v_used
    from usage_records
   where user_id = p_user_id and action_type = p_action and billing_period = v_period;

  if v_plan.test_limit >= 0 and v_used >= v_plan.test_limit then
    return jsonb_build_object('allowed', false, 'error', 'limit_reached', 'plan', v_plan.slug,
                              'used', v_used, 'limit', v_plan.test_limit, 'remaining', 0);
  end if;

  insert into usage_records (user_id, action_type, billing_period, count, created_at, updated_at)
  values (p_user_id, p_action, v_period, 1, now(), now())
  on conflict (user_id, action_type, billing_period)
  do update set count = usage_records.count + 1, updated_at = now();

  return jsonb_build_object(
    'allowed',   true,
    'reserved',  true,
    'period',    v_period,
    'plan',      v_plan.slug,
    'used',      v_used + 1,
    'limit',     v_plan.test_limit,
    'remaining', case when v_plan.test_limit < 0 then -1 else v_plan.test_limit - (v_used + 1) end);
end;
$$;

create or replace function public.release_test_generation(p_user_id uuid, p_period text,
                                                          p_action text default 'test_generated')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('usage:' || p_user_id::text || ':' || p_action, 0));

  update usage_records
     set count = count - 1, updated_at = now()
   where user_id = p_user_id and action_type = p_action and billing_period = p_period and count > 0
  returning count into v_count;

  return jsonb_build_object('released', v_count is not null, 'used', coalesce(v_count, 0));
end;
$$;

revoke execute on function public.reserve_test_generation(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_test_generation(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.reserve_test_generation(uuid, text) to service_role;
grant  execute on function public.release_test_generation(uuid, text, text) to service_role;

alter function public.record_usage(uuid, text) set search_path = public;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY 1 (read-only; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'app cannot reserve', not has_function_privilege('authenticated', 'public.reserve_test_generation(uuid,text)', 'execute')
-- union all select 'anon cannot release', not has_function_privilege('anon', 'public.release_test_generation(uuid,text,text)', 'execute')
-- union all select 'backend can reserve', has_function_privilege('service_role', 'public.reserve_test_generation(uuid,text)', 'execute')
-- union all select 'record_usage search_path', (select proconfig::text like '%search_path=public%' from pg_proc where proname = 'record_usage');
--
-- ════════════════════════════════════════════════════════════════════
-- VERIFY 2 (behaviour, free user). Reserves up to the limit + 1, checks the extra one is refused, then
-- releases everything it reserved and removes the row if it created it. Net change = zero.
-- Raises 'FAIL …' on a problem (then the whole block rolls back).
-- ════════════════════════════════════════════════════════════════════
-- do $$
-- declare
--   v_user uuid; v_limit int; v_period text := to_char(now(), 'YYYY-MM');
--   v_had_row boolean; r jsonb; i int; v_reserved int := 0;
-- begin
--   select t.id into v_user from teacher_profiles t
--    where (select slug from public.a4_effective_plan(t.id)) = 'free'
--      and not exists (select 1 from usage_records u where u.user_id = t.id and u.billing_period = v_period and u.count > 0)
--    limit 1;
--   if v_user is null then raise exception 'no free user without usage this month'; end if;
--   select test_limit into v_limit from public.a4_effective_plan(v_user);
--   v_had_row := exists (select 1 from usage_records where user_id = v_user and action_type = 'test_generated' and billing_period = v_period);
--
--   for i in 1..v_limit loop
--     r := public.reserve_test_generation(v_user);
--     if not (r->>'allowed')::boolean then raise exception 'FAIL reservation % refused: %', i, r; end if;
--     v_reserved := v_reserved + 1;
--   end loop;
--   r := public.reserve_test_generation(v_user);
--   if (r->>'allowed')::boolean or r->>'error' <> 'limit_reached' then raise exception 'FAIL over-limit allowed: %', r; end if;
--
--   r := public.release_test_generation(v_user, v_period);
--   if not (r->>'released')::boolean or (r->>'used')::int <> v_limit - 1 then raise exception 'FAIL release: %', r; end if;
--   v_reserved := v_reserved - 1;
--   for i in 1..v_reserved loop perform public.release_test_generation(v_user, v_period); end loop;
--   if not v_had_row then
--     delete from usage_records where user_id = v_user and action_type = 'test_generated' and billing_period = v_period and count = 0;
--   end if;
--   raise notice 'PASS: % reservations allowed, the next refused, release refunds one', v_limit;
-- end $$;
