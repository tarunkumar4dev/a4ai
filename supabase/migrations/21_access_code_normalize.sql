-- 21_access_code_normalize.sql — a correct access code typed the way students actually type it (23 Oct 2026).
--
-- Bug: a student typed a real 6-character code and got "wrong code". Live check (read-only, 23 Oct): 43 active
-- codes, all 6 characters, A-Z / 0-9 only; 13 contain the digit 0, 17 the digit 1, none the letters O, I or L.
-- Codes printed on slips / sent on WhatsApp get typed as "O" for 0 and "I" / "l" for 1 — and the lookup was an
-- exact match on upper(trim(code)).
--
-- Now every lookup normalises both sides the same way:
--   drop everything that isn't a letter or digit (spaces, dashes), upper-case, then O → 0, I → 1, L → 1.
-- Safe: folding the 43 live codes keeps them all distinct, and a match must still resolve to exactly ONE active
-- student (the 05 rule), so a fold that ever made two codes collide finds nobody instead of the wrong student.
-- The 8-character codes from generate_student_access_codes (07) never contain 0/O/1/I, so they can't collide.
--
-- Changes: a4_access_code_key() (new), a4_student_id_from_code (05), a4_code_gate (18), verify_access_code (18)
-- (last_used_at now updates for a normalised code too) + an index on the folded code.
-- Requires 18. Safe to re-run. After running:  notify pgrst, 'reload schema';

begin;

-- The one normalisation every access-code lookup uses.
create or replace function public.a4_access_code_key(p_code text)
returns text language sql immutable as $$
  select translate(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'OIL', '011')
$$;
revoke execute on function public.a4_access_code_key(text) from public, anon;
grant execute on function public.a4_access_code_key(text) to authenticated;   -- index expression on teacher inserts

create index if not exists student_access_codes_key_idx
  on public.student_access_codes (public.a4_access_code_key(access_code)) where is_active;

-- 05 body, exact match → normalised match
create or replace function public.a4_student_id_from_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select min(sac.student_id::text)::uuid
    from student_access_codes sac
    join students st on st.id = sac.student_id
   where public.a4_access_code_key(sac.access_code) = public.a4_access_code_key(p_code)
     and sac.is_active = true
     and coalesce(st.is_active, true)
  having count(distinct sac.student_id) = 1;
$$;
revoke execute on function public.a4_student_id_from_code(text) from public, anon, authenticated;

-- 18 body; only v_code / v_code_hash change (normalised, so "o12abc" and "012ABC" count as the same try)
create or replace function public.a4_code_gate(p_code text, p_ip_hash text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c_ip_max      constant int := 20;
  c_code_max    constant int := 10;
  c_window      constant interval := interval '10 minutes';
  c_lock        constant interval := interval '15 minutes';
  v_ip          text := public.a4_request_ip_hash(p_ip_hash);
  v_code        text := public.a4_access_code_key(p_code);
  v_code_hash   text := encode(sha256(convert_to('a4code:' || public.a4_access_code_key(p_code), 'UTF8')), 'hex');
  v_until       timestamptz;
  v_id          uuid;
begin
  -- one decision per IP and per code at a time (parallel tries can't all slip under the limit); IP before code
  perform pg_advisory_xact_lock(hashtext('a4code-ip:' || v_ip));
  perform pg_advisory_xact_lock(hashtext('a4code-code:' || v_code_hash));

  -- a wrong try that was the 20th (IP) / 10th (code) within 10 minutes locks for 15 minutes after it
  select max(f.ts) + c_lock into v_until
    from access_code_attempts f
   where f.ip_hash = v_ip and f.ts > now() - c_lock
     and (select count(*) from access_code_attempts g
           where g.ip_hash = v_ip and g.ts > f.ts - c_window and g.ts <= f.ts) >= c_ip_max;
  if v_until > now() then
    return jsonb_build_object('state', 'locked', 'scope', 'ip',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_until - now())))::int));
  end if;

  select max(f.ts) + c_lock into v_until
    from access_code_attempts f
   where f.code_hash = v_code_hash and f.ts > now() - c_lock
     and (select count(*) from access_code_attempts g
           where g.code_hash = v_code_hash and g.ts > f.ts - c_window and g.ts <= f.ts) >= c_code_max;
  if v_until > now() then
    return jsonb_build_object('state', 'locked', 'scope', 'code',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_until - now())))::int));
  end if;

  if v_code ~ '^[A-Z0-9]{4,16}$' then
    v_id := public.a4_student_id_from_code(v_code);
  end if;
  if v_id is not null then
    return jsonb_build_object('state', 'ok', 'student_id', v_id);
  end if;

  insert into access_code_attempts (ip_hash, code_hash) values (v_ip, v_code_hash);
  if random() < 0.01 then
    delete from access_code_attempts where ts < now() - interval '1 day';
  end if;
  return jsonb_build_object('state', 'invalid_code');
end $$;

-- 18 body; last_used_at matches the normalised code
create or replace function public.verify_access_code(p_code text, p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g jsonb := public.a4_code_gate(p_code, p_ip_hash);
  v jsonb;
begin
  if g ->> 'state' <> 'ok' then
    return g;
  end if;
  update student_access_codes set last_used_at = now()
   where student_id = (g ->> 'student_id')::uuid and is_active
     and public.a4_access_code_key(access_code) = public.a4_access_code_key(p_code);
  select jsonb_build_object(
           'name',           st.name,
           'roll_no',        st.roll_no,
           'class_level',    coalesce(st.class_level, b.class_level),
           'section_name',   s.name,
           'batch_name',     b.name,
           'lab_batch_name', lb.name,
           'institute_name', i.name,
           'email_masked',   case when st.email like '%_@_%'
                                  then left(split_part(st.email, '@', 1), 1) || '***@' || split_part(st.email, '@', 2) end)
    into v
    from students st
    join institutes i       on i.id = st.institute_id
    left join sections s    on s.id = st.section_id
    left join batches b     on b.id = st.batch_id
    left join batches lb    on lb.id = st.lab_batch_id
   where st.id = (g ->> 'student_id')::uuid;
  return jsonb_build_object('state', 'ok', 'student', v);
end $$;

revoke execute on function public.a4_code_gate(text, text) from public, anon, authenticated;
revoke execute on function public.verify_access_code(text, text) from public;
grant execute on function public.verify_access_code(text, text) to anon, authenticated;

commit;

-- After running (PostgREST picks up the new function bodies):
--   notify pgrst, 'reload schema';
--
-- VERIFY (read-only; both rows true). Never select the codes themselves.
-- select 'every active code still resolves', not exists (select 1 from student_access_codes
--          where is_active and public.a4_student_id_from_code(access_code) is null)
-- union all select 'folded codes stay unique', (select count(*) = count(distinct public.a4_access_code_key(access_code))
--          from student_access_codes where is_active);
