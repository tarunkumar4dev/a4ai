-- 20261001100000_ai_chat_usage.sql
-- Per-user daily AI chat counter (IST day) used by the backend /api/v1/chat proxy.
-- Additive and safe to run before the backend deploy. Service-role only: RLS on, no policies.

create table if not exists public.ai_chat_usage (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null,
  count      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.ai_chat_usage enable row level security;

-- Atomically consumes one message from today's quota; refuses once the limit is reached.
create or replace function public.consume_ai_chat_quota(p_user_id uuid, p_daily_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Asia/Kolkata')::date;
  v_count integer;
begin
  insert into ai_chat_usage (user_id, day, count)
  values (p_user_id, v_day, 1)
  on conflict (user_id, day) do update
    set count = ai_chat_usage.count + 1, updated_at = now()
    where ai_chat_usage.count < p_daily_limit
  returning count into v_count;

  if v_count is null then
    return jsonb_build_object('allowed', false, 'used', p_daily_limit, 'limit', p_daily_limit, 'remaining', 0);
  end if;
  return jsonb_build_object('allowed', true, 'used', v_count, 'limit', p_daily_limit,
                            'remaining', greatest(p_daily_limit - v_count, 0));
end $$;

revoke all on function public.consume_ai_chat_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_chat_quota(uuid, integer) to service_role;

-- Verify after running:
--   select relrowsecurity from pg_class where oid = 'public.ai_chat_usage'::regclass;   -- true
--   select has_function_privilege('anon', 'public.consume_ai_chat_quota(uuid,integer)', 'EXECUTE'),
--          has_function_privilege('authenticated', 'public.consume_ai_chat_quota(uuid,integer)', 'EXECUTE'),
--          has_function_privilege('service_role', 'public.consume_ai_chat_quota(uuid,integer)', 'EXECUTE');
--   -- false | false | true
--
-- Rollback:
--   drop function if exists public.consume_ai_chat_quota(uuid, integer);
--   drop table if exists public.ai_chat_usage;
