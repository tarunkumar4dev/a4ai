-- 27_otp_limit_5_per_day.sql — WhatsApp login OTP: max 5 per number per rolling 24 h, 20 s between sends.
-- Human runs it. Safe to re-run. Replaces a4_otp_rate_check from 08 (was 60 s / 5 per hour / 10 per day).
--
-- Why: every OTP costs money; the login page lets the user resend 20 s after a send and shows
-- "N left today". The browser limiter (src/lib/security/rateLimiter.ts OTP_MAX_PER_DAY / OTP_RESEND_AFTER_SEC)
-- mirrors these numbers but can be bypassed — this function is the real limit.
-- The hourly cap is gone: 5 per day is already below it.
--
-- ALSO (not SQL): Supabase Auth has its own phone-OTP gap, `sms_max_frequency` (Auth settings / Management API,
-- `[auth.sms] max_frequency` in config.toml). If it is longer than 20 s, an early Resend gets
-- "only request this after N seconds" — the page then counts down N. Set it to 20s to match.

begin;

create or replace function public.a4_otp_rate_check(p_phone_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_last   timestamptz;
  v_first  timestamptz;
  v_day    int;
begin
  if p_phone_hash is null or length(p_phone_hash) < 32 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid', 'retry_after_sec', 0);
  end if;

  -- one caller per number at a time (two quick clicks can't both pass)
  perform pg_advisory_xact_lock(hashtext('otp:' || p_phone_hash));

  select max(sent_at), min(sent_at), count(*)
    into v_last, v_first, v_day
    from otp_send_log
   where phone_hash = p_phone_hash
     and sent_at > now() - interval '1 day';

  if v_day >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_first + interval '1 day' - now())))::int));
  end if;
  if v_last is not null and v_last > now() - interval '20 seconds' then
    return jsonb_build_object('allowed', false, 'reason', 'too_soon',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_last + interval '20 seconds' - now())))::int));
  end if;

  insert into otp_send_log (phone_hash) values (p_phone_hash);

  -- housekeeping: keep only the last 2 days (cheap, indexed)
  delete from otp_send_log where sent_at < now() - interval '2 days';

  return jsonb_build_object('allowed', true);
end;
$$;

revoke execute on function public.a4_otp_rate_check(text) from public, anon, authenticated;
grant  execute on function public.a4_otp_rate_check(text) to service_role;


-- ── "N left today" on the login page, read from this table (not from the browser) ──────────────
-- The log stores only a hash, so the page can't count rows itself; these two functions do it.
-- a4_otp_phone_hash must produce the SAME hash as the Edge Function:
--   sha256(`${OTP_HASH_PEPPER}:91XXXXXXXXXX`)   (send-whatsapp-otp/index.ts → normalizeIndianMobile + sha256Hex)
-- The pepper comes from Vault secret `otp_hash_pepper`; with no such secret it is '' — which matches an
-- Edge Function deployed without OTP_HASH_PEPPER. If you set one there, add the same value to Vault:
--   select vault.create_secret('<the same value>', 'otp_hash_pepper');
-- Get it wrong and the hashes differ: the page would show "5 left" while the server still blocks correctly.

create or replace function public.a4_otp_phone_hash(p_phone text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d      text;
  pepper text := '';
begin
  d := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(d) = 11 and left(d, 1) = '0'  then d := substr(d, 2); end if;
  if length(d) = 12 and left(d, 2) = '91' then d := substr(d, 3); end if;
  if length(d) <> 10 or left(d, 1) !~ '[6-9]' then return null; end if;

  -- Vault is optional (local/self-hosted may not have it) → fall back to no pepper.
  if to_regclass('vault.decrypted_secrets') is not null then
    begin
      execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'otp_hash_pepper' limit 1$q$
        into pepper;
    exception when others then pepper := ''; end;
  end if;

  -- built-in sha256() (Postgres 11+), so this needs neither pgcrypto nor the extensions schema
  return encode(sha256(convert_to(coalesce(pepper, '') || ':91' || d, 'UTF8')), 'hex');
end;
$$;

revoke execute on function public.a4_otp_phone_hash(text) from public, anon, authenticated;

-- Read-only quota for the login/signup page. Anon-callable: the user has no session yet.
-- Returns counts only — never a phone number, never whether an account exists.
create or replace function public.a4_otp_quota(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash  text;
  v_used  int;
  v_first timestamptz;
  v_last  timestamptz;
begin
  v_hash := a4_otp_phone_hash(p_phone);
  if v_hash is null then
    return jsonb_build_object('valid', false, 'max', 5, 'used', 0, 'left', 5,
                              'next_in_sec', 0, 'reset_in_sec', 0);
  end if;

  select count(*), min(sent_at), max(sent_at)
    into v_used, v_first, v_last
    from otp_send_log
   where phone_hash = v_hash
     and sent_at > now() - interval '1 day';

  return jsonb_build_object(
    'valid', true,
    'max',   5,
    'used',  v_used,
    'left',  greatest(0, 5 - v_used),
    -- seconds until the next send is allowed (20 s gap)
    'next_in_sec', case when v_last is null then 0
      else greatest(0, ceil(extract(epoch from (v_last + interval '20 seconds' - now())))::int) end,
    -- seconds until the oldest of the 5 falls out of the 24 h window
    'reset_in_sec', case when v_first is null then 0
      else greatest(0, ceil(extract(epoch from (v_first + interval '1 day' - now())))::int) end);
end;
$$;

grant execute on function public.a4_otp_quota(text) to anon, authenticated;

commit;

-- VERIFY (SQL editor; uses a fake hash, cleans up after itself):
--   select public.a4_otp_rate_check(repeat('b', 64));   -- {"allowed": true}
--   select public.a4_otp_rate_check(repeat('b', 64));   -- {"allowed": false, "reason": "too_soon", "retry_after_sec": ≤20}
--   insert into public.otp_send_log (phone_hash, sent_at)
--     select repeat('b', 64), now() - interval '1 hour' from generate_series(1, 4);
--   select public.a4_otp_rate_check(repeat('b', 64));   -- {"allowed": false, "reason": "daily_limit", ...}
--   delete from public.otp_send_log where phone_hash = repeat('b', 64);
--
-- VERIFY the quota the page reads (use a number nobody is logging in with):
--   select public.a4_otp_quota('9999999999');          -- {"valid": true, "used": 0, "left": 5, ...}
--   insert into public.otp_send_log (phone_hash) select public.a4_otp_phone_hash('9999999999');
--   select public.a4_otp_quota('09999 999999');        -- {"used": 1, "left": 4, "next_in_sec": ≤20}
--   select public.a4_otp_quota('12345');               -- {"valid": false, ...}  (not a mobile number)
--   delete from public.otp_send_log where phone_hash = public.a4_otp_phone_hash('9999999999');
--
-- VERIFY the hash matches the Edge Function (otherwise "N left" is wrong while the block still works):
--   send yourself one real OTP from /login, then:
--   select public.a4_otp_quota('<your 10-digit number>');  -- "used" must be 1, not 0
--   If it says 0: the Vault secret `otp_hash_pepper` and the function's OTP_HASH_PEPPER env differ.
