-- 32_quota_reserve_voice_allowance.sql  (Gate 2 fix #5)  — NOT APPLIED. Review, fill the TODOs, then apply.
--
-- What this changes
--   1. Atomic quota for paid AI actions: a4_reserve_usage locks the user's usage_records row, checks the plan limit
--      and counts the unit in ONE statement (today check_usage and record_usage are two calls 20–60 s apart, so two
--      requests with one paper left both pass). The reservation is keyed by the client's Idempotency-Key, so a retry
--      of an already-counted request answers "duplicate" instead of charging again; a_release_usage gives the unit
--      back when generation fails.
--   2. Per-plan monthly voice allowance: plans.voice_monthly_limit (NULL/unset = 0 = voice not in the plan) and
--      a4_voice_allowance(uid). Voice use is counted in usage_records with action_type 'voice_query' (no new usage
--      table; the one new table below is the reservation ledger).
--
-- Backend behaviour before this is applied: app/core/quota.py detects the missing function (PGRST202) and falls
-- back to the old check_usage/record_usage pair, so nothing breaks; the atomic path switches on by itself once
-- these functions exist. The agent treats a missing a4_voice_allowance as limit 0 (voice blocked in live mode).
--
-- Rollback: 32_quota_reserve_voice_allowance_rollback.sql

begin;

-- ── 1. Per-plan monthly voice allowance ─────────────────────────────────────────────────────────────────────────
alter table public.plans add column if not exists voice_monthly_limit integer;
comment on column public.plans.voice_monthly_limit is
  'Voice questions per calendar month included in the plan. NULL = 0 = voice not included. -1 = unlimited.';

-- TODO (Tarun): one number per plan. Cost reference: ~Rs 0.27 per voice question with Haiku routing
-- (docs/COST_MAP.md §1 row 10); yearly price / 12 is the monthly revenue to keep the 60–70 % margin against.
update public.plans set voice_monthly_limit = NULL where slug = 'free';                 -- TODO e.g. 0
update public.plans set voice_monthly_limit = NULL where slug = 'starter';              -- TODO
update public.plans set voice_monthly_limit = NULL where slug = 'pro';                  -- TODO
update public.plans set voice_monthly_limit = NULL where slug = 'institute_start';      -- TODO
update public.plans set voice_monthly_limit = NULL where slug = 'institute_scale';      -- TODO
update public.plans set voice_monthly_limit = NULL where slug = 'institute_enterprise'; -- TODO
update public.plans set voice_monthly_limit = NULL where slug = 'individual_199';       -- TODO (legacy plan)
update public.plans set voice_monthly_limit = NULL where slug = 'individual_249';       -- TODO (legacy plan)

-- ── 2. Reservation ledger (idempotency + release) ───────────────────────────────────────────────────────────────
create table if not exists public.usage_reservations (
  request_id     text primary key,                       -- the client's Idempotency-Key (or a server uuid)
  user_id        uuid not null,
  action_type    text not null,
  billing_period text not null,
  state          text not null check (state in ('reserved', 'consumed', 'released')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists usage_reservations_user_idx on public.usage_reservations (user_id, created_at desc);
alter table public.usage_reservations enable row level security;   -- no policies: service_role only
comment on table public.usage_reservations is
  'One row per paid AI request: reserved at the quota check, consumed on success, released on failure. '
  'Holds ids only (no content). Rows older than 90 days can be deleted.';

-- ── 3. Limit per action ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.a4_action_limit(p_user_id uuid, p_action text)
returns table (plan_slug text, action_limit integer)
language sql stable security definer set search_path = public as $$
  select p.slug,
         case
           when p_action = 'voice_query' then coalesce(pl.voice_monthly_limit, 0)
           else p.test_limit
         end
  from a4_effective_plan(p_user_id) p
  join plans pl on pl.id = p.plan_id;
$$;

-- ── 4. Reserve: lock + check + count, in one statement ──────────────────────────────────────────────────────────
create or replace function public.a4_reserve_usage(p_user_id uuid, p_action text, p_request_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_limit  integer;
  v_slug   text;
  v_used   integer;
  v_state  text;
begin
  if p_request_id is null or length(p_request_id) = 0 or length(p_request_id) > 80 then
    raise exception 'bad request_id';
  end if;

  select state into v_state from usage_reservations where request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'state', v_state);
  end if;

  select plan_slug, action_limit into v_slug, v_limit from a4_action_limit(p_user_id, p_action);

  -- the row for (user, action, period) is the lock: insert it at 0 if missing, then lock it
  insert into usage_records (user_id, action_type, billing_period, count, created_at, updated_at)
  values (p_user_id, p_action, v_period, 0, now(), now())
  on conflict (user_id, action_type, billing_period) do nothing;

  select count into v_used from usage_records
   where user_id = p_user_id and action_type = p_action and billing_period = v_period
   for update;

  if v_limit >= 0 and v_used >= v_limit then
    return jsonb_build_object('status', 'limit_reached', 'allowed', false, 'used', v_used, 'limit', v_limit,
                              'remaining', 0, 'plan', v_slug);
  end if;

  update usage_records set count = count + 1, updated_at = now()
   where user_id = p_user_id and action_type = p_action and billing_period = v_period;
  insert into usage_reservations (request_id, user_id, action_type, billing_period, state)
  values (p_request_id, p_user_id, p_action, v_period, 'reserved');

  return jsonb_build_object('status', 'reserved', 'allowed', true, 'used', v_used + 1, 'limit', v_limit,
                            'remaining', case when v_limit < 0 then -1 else v_limit - (v_used + 1) end,
                            'plan', v_slug);
end;
$$;

-- ── 5. Consume / release ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.a4_consume_usage(p_user_id uuid, p_request_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  update usage_reservations set state = 'consumed', updated_at = now()
   where request_id = p_request_id and user_id = p_user_id and state = 'reserved';
  get diagnostics v_rows = row_count;
  return jsonb_build_object('consumed', v_rows = 1);
end;
$$;

create or replace function public.a4_release_usage(p_user_id uuid, p_request_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update usage_reservations set state = 'released', updated_at = now()
   where request_id = p_request_id and user_id = p_user_id and state = 'reserved'
   returning action_type, billing_period into r;
  if not found then
    return jsonb_build_object('released', false);
  end if;
  update usage_records set count = greatest(count - 1, 0), updated_at = now()
   where user_id = p_user_id and action_type = r.action_type and billing_period = r.billing_period;
  return jsonb_build_object('released', true);
end;
$$;

-- ── 6. Voice allowance read (agent) ─────────────────────────────────────────────────────────────────────────────
create or replace function public.a4_voice_allowance(p_user_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'limit', l.action_limit,
    'used',  coalesce((select sum(count) from usage_records
                        where user_id = p_user_id and action_type = 'voice_query'
                          and billing_period = to_char(now(), 'YYYY-MM')), 0),
    'plan',  l.plan_slug)
  from a4_action_limit(p_user_id, 'voice_query') l;
$$;

-- ── 7. Grants: backend (service_role) only; the agent's read role may read the allowance ───────────────────────
revoke execute on function public.a4_action_limit(uuid, text)         from public, anon, authenticated;
revoke execute on function public.a4_reserve_usage(uuid, text, text)  from public, anon, authenticated;
revoke execute on function public.a4_consume_usage(uuid, text)        from public, anon, authenticated;
revoke execute on function public.a4_release_usage(uuid, text)        from public, anon, authenticated;
revoke execute on function public.a4_voice_allowance(uuid)            from public, anon, authenticated;
-- TODO (Tarun): uncomment if the agent's database role is named agent_ro (agent/db_real.py):
-- grant execute on function public.a4_voice_allowance(uuid) to agent_ro;
-- Counting voice use (record_usage(uid, 'voice_query')) needs a read-write role; the agent falls back to an
-- in-process counter and logs a warning until one is configured (AGENT_DATABASE_URL).

commit;
