-- 15_ai_chat_quota.sql — daily AI chat limit for the dashboard help bot (12 Oct 2026)
--
-- The backend (RAG-BACKEND app/api/v1/endpoints/chat.py) already calls consume_ai_chat_quota, but the
-- function never existed on live → every serverless instance counted in its own memory (no real limit).
--
-- Rules (per user, per IST day):
--   * Free users: p_daily_limit messages (backend sends 10). Every message counts, repeats included.
--   * Paid users: unlimited NEW messages. Sending a message they already sent today (same text after
--     normalising) counts as abuse against the same daily pool; once it's used up, repeats are refused.
--   * Paid = own active paid subscription, or active member of an institute whose OWNER has an active
--     paid subscription (only the payment pipeline writes subscriptions; institutes.plan_id is editable
--     by admins, so it is not trusted).
-- ai_chat_usage: RLS on, no policies → only service_role (backend) touches it. Only hashes are stored.
-- Safe to re-run.

begin;

create table if not exists public.ai_chat_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,                    -- IST date
  msg_hash   text,                             -- sha256 of the normalised user message (from the backend)
  counted    boolean not null,                 -- true = used one of the daily-limited slots
  created_at timestamptz not null default now()
);
create index if not exists ai_chat_usage_user_day_idx on public.ai_chat_usage (user_id, day);

alter table public.ai_chat_usage enable row level security;
revoke all on public.ai_chat_usage from anon, authenticated;

-- ── Paid check ───────────────────────────────────────────────────────────────
create or replace function public.a4_is_paid_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from subscriptions s join plans p on p.id = s.plan_id
            where s.user_id = p_user_id and s.status = 'active' and s.expires_at > now()
              and p.price_paise > 0)
      or exists (
           select 1
             from institute_members m
             join institutes i on i.id = m.institute_id and coalesce(i.is_active, true)
             join subscriptions s on s.user_id = i.owner_id and s.status = 'active' and s.expires_at > now()
             join plans p on p.id = s.plan_id and p.price_paise > 0
            where m.user_id = p_user_id and m.status = 'active');
$$;
revoke execute on function public.a4_is_paid_user(uuid) from public, anon, authenticated;
grant  execute on function public.a4_is_paid_user(uuid) to service_role;

-- ── Consume one message ──────────────────────────────────────────────────────
-- Returns {allowed, paid, duplicate, used, limit, remaining, reason}.
-- remaining/limit are null for a paid user's normal (unlimited) message.
create or replace function public.consume_ai_chat_quota(
  p_user_id      uuid,
  p_daily_limit  integer,
  p_message_hash text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_day   date := (now() at time zone 'Asia/Kolkata')::date;
  v_limit integer := greatest(coalesce(p_daily_limit, 10), 0);
  v_paid  boolean;
  v_dup   boolean := false;
  v_used  integer;
begin
  if p_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_user');
  end if;
  -- one request at a time per user, so parallel calls can't both take the last slot
  perform pg_advisory_xact_lock(hashtextextended('ai_chat:' || p_user_id::text, 0));

  v_paid := public.a4_is_paid_user(p_user_id);
  if p_message_hash is not null then
    v_dup := exists (select 1 from ai_chat_usage
                      where user_id = p_user_id and day = v_day and msg_hash = p_message_hash);
  end if;

  if v_paid and not v_dup then
    insert into ai_chat_usage (user_id, day, msg_hash, counted) values (p_user_id, v_day, p_message_hash, false);
    return jsonb_build_object('allowed', true, 'paid', true, 'duplicate', false,
                              'used', null, 'limit', null, 'remaining', null);
  end if;

  select count(*) into v_used from ai_chat_usage where user_id = p_user_id and day = v_day and counted;
  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'paid', v_paid, 'duplicate', v_dup,
                              'used', v_used, 'limit', v_limit, 'remaining', 0,
                              'reason', case when v_paid then 'duplicate_limit' else 'daily_limit' end);
  end if;

  insert into ai_chat_usage (user_id, day, msg_hash, counted) values (p_user_id, v_day, p_message_hash, true);
  return jsonb_build_object('allowed', true, 'paid', v_paid, 'duplicate', v_dup,
                            'used', v_used + 1, 'limit', v_limit, 'remaining', v_limit - v_used - 1);
end $$;
revoke execute on function public.consume_ai_chat_quota(uuid, integer, text) from public, anon, authenticated;
grant  execute on function public.consume_ai_chat_quota(uuid, integer, text) to service_role;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (read-only; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'usage table rls', (select relrowsecurity from pg_class where oid = 'public.ai_chat_usage'::regclass)
-- union all select 'no usage policies', not exists (select 1 from pg_policies where tablename = 'ai_chat_usage')
-- union all select 'app cannot call quota', not has_function_privilege('authenticated', 'public.consume_ai_chat_quota(uuid,integer,text)', 'execute')
-- union all select 'backend can call quota', has_function_privilege('service_role', 'public.consume_ai_chat_quota(uuid,integer,text)', 'execute');
--
-- Today's usage:
--   select user_id, count(*) filter (where counted) as limited, count(*) as total
--     from public.ai_chat_usage where day = (now() at time zone 'Asia/Kolkata')::date group by user_id order by total desc;
