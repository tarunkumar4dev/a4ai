-- Rollback of 32_quota_reserve_voice_allowance.sql. Safe: the backend falls back to check_usage/record_usage when
-- a4_reserve_usage is missing, and the agent treats a missing a4_voice_allowance as limit 0.
begin;
drop function if exists public.a4_voice_allowance(uuid);
drop function if exists public.a4_release_usage(uuid, text);
drop function if exists public.a4_consume_usage(uuid, text);
drop function if exists public.a4_reserve_usage(uuid, text, text);
drop function if exists public.a4_action_limit(uuid, text);
drop table if exists public.usage_reservations;
alter table public.plans drop column if exists voice_monthly_limit;
-- usage_records rows with action_type = 'voice_query' are left in place (history only).
commit;
