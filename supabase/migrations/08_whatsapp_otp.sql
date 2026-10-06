-- 08_whatsapp_otp.sql — server-side limit for login OTPs sent over WhatsApp (Edge Function send-whatsapp-otp).
-- Human runs it. Safe to re-run.
--
-- Why: every OTP costs money. The login page's rate limiter lives in the browser and can be bypassed with a
-- script, so the real per-number limit lives here and is called by the Edge Function (service_role only).
-- Only a SHA-256 hash of the phone number is stored — never the number, never the OTP.
--
-- Limits per phone number: 1 per 60 s, 5 per hour, 10 per day.

begin;

create table if not exists public.otp_send_log (
  id          bigserial primary key,
  phone_hash  text        not null,
  sent_at     timestamptz not null default now()
);
create index if not exists otp_send_log_hash_time_idx on public.otp_send_log (phone_hash, sent_at desc);

alter table public.otp_send_log enable row level security;   -- no policies: service_role only
revoke all on public.otp_send_log from anon, authenticated;

-- Check the limits and record the send in one atomic step.
-- Returns { allowed: true } or { allowed: false, reason, retry_after_sec }.
create or replace function public.a4_otp_rate_check(p_phone_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_last   timestamptz;
  v_hour   int;
  v_day    int;
begin
  if p_phone_hash is null or length(p_phone_hash) < 32 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid', 'retry_after_sec', 0);
  end if;

  -- one caller per number at a time (two quick clicks can't both pass)
  perform pg_advisory_xact_lock(hashtext('otp:' || p_phone_hash));

  select max(sent_at),
         count(*) filter (where sent_at > now() - interval '1 hour'),
         count(*) filter (where sent_at > now() - interval '1 day')
    into v_last, v_hour, v_day
    from otp_send_log
   where phone_hash = p_phone_hash
     and sent_at > now() - interval '1 day';

  if v_last is not null and v_last > now() - interval '60 seconds' then
    return jsonb_build_object('allowed', false, 'reason', 'too_soon',
      'retry_after_sec', ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::int);
  end if;
  if v_hour >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_limit', 'retry_after_sec', 3600);
  end if;
  if v_day >= 10 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retry_after_sec', 86400);
  end if;

  insert into otp_send_log (phone_hash) values (p_phone_hash);

  -- housekeeping: keep only the last 2 days (cheap, indexed)
  delete from otp_send_log where sent_at < now() - interval '2 days';

  return jsonb_build_object('allowed', true);
end;
$$;

revoke execute on function public.a4_otp_rate_check(text) from public, anon, authenticated;
grant  execute on function public.a4_otp_rate_check(text) to service_role;

commit;

-- TEST (SQL editor):
--   select public.a4_otp_rate_check(repeat('a', 64));   -- {"allowed": true}
--   select public.a4_otp_rate_check(repeat('a', 64));   -- {"allowed": false, "reason": "too_soon", ...}
--   delete from public.otp_send_log where phone_hash = repeat('a', 64);
