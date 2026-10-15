-- 20b_ai_chat_quota_paid_cap.sql — restore the final consume_ai_chat_quota (15 Oct 2026)
--
-- Live had only the FIRST version of 15: consume_ai_chat_quota(uuid, integer, text), without the paid hard cap.
-- The backend (chat.py since 37ab825) calls it with 4 named args incl. p_paid_daily_cap → PostgREST finds no
-- matching function → backend logs "AI chat quota store unavailable" and falls back to an in-memory counter:
-- 10/day PER SERVERLESS INSTANCE, paid users limited like free users, nothing stored (ai_chat_usage: 0 rows).
-- Users never see an error.
--
-- This drops the 3-arg version (otherwise a 3-arg call becomes ambiguous) and creates the 4-arg version,
-- body identical to the final 15_ai_chat_quota.sql. a4_is_paid_user and ai_chat_usage are unchanged.
-- Safe to re-run.

begin;

drop function if exists public.consume_ai_chat_quota(uuid, integer, text);

create or replace function public.consume_ai_chat_quota(
  p_user_id        uuid,
  p_daily_limit    integer,
  p_message_hash   text default null,
  p_paid_daily_cap integer default 200
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_day   date := (now() at time zone 'Asia/Kolkata')::date;
  v_limit integer := greatest(coalesce(p_daily_limit, 10), 0);
  v_cap   integer := greatest(coalesce(p_paid_daily_cap, 200), 0);
  v_paid  boolean;
  v_dup   boolean := false;
  v_used  integer;
  v_total integer;
begin
  if p_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_user');
  end if;
  -- one request at a time per user, so parallel calls can't both take the last slot
  perform pg_advisory_xact_lock(hashtextextended('ai_chat:' || p_user_id::text, 0));

  v_paid := public.a4_is_paid_user(p_user_id);

  if v_paid then
    select count(*) into v_total from ai_chat_usage where user_id = p_user_id and day = v_day;
    if v_total >= v_cap then
      return jsonb_build_object('allowed', false, 'paid', true, 'duplicate', null,
                                'used', v_total, 'limit', v_cap, 'remaining', 0, 'reason', 'paid_daily_cap');
    end if;
  end if;

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
revoke execute on function public.consume_ai_chat_quota(uuid, integer, text, integer) from public, anon, authenticated;
grant  execute on function public.consume_ai_chat_quota(uuid, integer, text, integer) to service_role;

commit;

-- VERIFY (all rows true):
-- select 'only the 4-arg version', (select count(*) from pg_proc where proname = 'consume_ai_chat_quota') = 1
-- union all select '4-arg exists', to_regprocedure('public.consume_ai_chat_quota(uuid,integer,text,integer)') is not null
-- union all select 'anon cannot call', not has_function_privilege('anon', 'public.consume_ai_chat_quota(uuid,integer,text,integer)', 'execute')
-- union all select 'app cannot call', not has_function_privilege('authenticated', 'public.consume_ai_chat_quota(uuid,integer,text,integer)', 'execute')
-- union all select 'backend can call', has_function_privilege('service_role', 'public.consume_ai_chat_quota(uuid,integer,text,integer)', 'execute');
