-- Tests for 18_upload_flow.sql. Test harness only (run_local.py) — NEVER run on live: it inserts fixtures.
-- Style = the VERIFY blocks in 13: every check raises 'FAIL <name>: <detail>' or prints NOTICE 'PASS <name>'.
-- Each DO block is its own transaction. Roles are switched with set_config('role', …) like PostgREST does;
-- every block uses its own client IP so the per-IP limits of one test don't leak into another.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ════════════════════════════════════════════════════════════════════
-- Helpers (schema tst)
-- ════════════════════════════════════════════════════════════════════
create schema if not exists tst;
grant usage on schema tst to anon, authenticated, service_role;

create or replace function tst.ok(p_cond boolean, p_name text, p_detail jsonb default null) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'FAIL %: %', p_name, coalesce(p_detail::text, '-');
  end if;
  raise notice 'PASS %', p_name;
end $$;

-- PostgREST-like request context
create or replace function tst.as_anon(p_ip text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', json_build_object('cf-connecting-ip', p_ip)::text, true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tst.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '{}', true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tst.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;

create or replace function tst.as_admin() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

create or replace function tst.ip_hash(p_ip text) returns text language sql immutable as $$
  select encode(sha256(convert_to('a4ip:' || p_ip, 'UTF8')), 'hex')
$$;

-- n uploaded page files of a student for an assignment (Storage row exists; metadata like Storage writes it)
create or replace function tst.files(p_asg uuid, p_student uuid, p_n int, p_ext text default 'jpg',
                                     p_mime text default 'image/jpeg', p_size bigint default 200000)
returns jsonb language plpgsql security definer as $$   -- definer: may be called while acting as anon
declare
  v_inst uuid;
  v_out  jsonb := '[]'::jsonb;
  v_path text;
begin
  select institute_id into v_inst from public.assignments where id = p_asg;
  for i in 1..p_n loop
    v_path := v_inst || '/' || p_asg || '/' || p_student || '/' || gen_random_uuid() || '.' || p_ext;
    insert into storage.objects (bucket_id, name, metadata)
    values ('submissions', v_path, jsonb_build_object('size', p_size, 'mimetype', p_mime));
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'storage_path', v_path, 'mime', p_mime, 'size', p_size,
      'sha256', encode(sha256(convert_to(v_path, 'UTF8')), 'hex'), 'page_order', i));
  end loop;
  return v_out;
end $$;

create or replace function tst.key() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '')
$$;

-- claim exactly this submission's job (other queued jobs pushed aside for the call)
create or replace function tst.claim_for(p_sub uuid) returns public.check_jobs language plpgsql as $$
declare
  j public.check_jobs;
begin
  update public.check_jobs set next_run_at = next_run_at + interval '100 days'
   where state = 'queued' and submission_id is distinct from p_sub;
  perform tst.as_service();
  select * into j from public.a4_claim_check_job(10);
  perform tst.as_admin();
  update public.check_jobs set next_run_at = next_run_at - interval '100 days'
   where state = 'queued' and next_run_at > now() + interval '50 days';
  return j;
end $$;

-- what the worker writes for a checked copy (v1 graded_questions shape)
create or replace function tst.fake_result(p_sub uuid, p_reasons public.a4_review_reason[] default '{}') returns void
language plpgsql as $$
begin
  update public.check_sheets set
    status = 'checked', ai_marks = 7, max_marks = 10, checked_at = now(), model_version = 'gemini-test',
    confidence = 0.9, needs_review_reasons = p_reasons,
    ai_result = jsonb_build_object('max_marks', 10, 'total_marks_awarded', 7, 'overall_remarks', 'Good work',
      'graded_questions', jsonb_build_array(
        jsonb_build_object('q_no', '1', 'max_marks', 4, 'marks_awarded', 3, 'feedback', 'ok', 'confidence', 'high'),
        jsonb_build_object('q_no', '2a', 'max_marks', 6, 'marks_awarded', 4, 'or_group', 'g2', 'feedback', 'a', 'confidence', 'low'),
        jsonb_build_object('q_no', '2b', 'max_marks', 6, 'marks_awarded', 2, 'or_group', 'g2', 'feedback', 'b', 'confidence', 'low')))
  where submission_id = p_sub;
end $$;

grant execute on all functions in schema tst to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- Fixtures: institute I1 (teacher T1 teaches batch B1: students S1, S2) · institute I2 (owner T2, batch B2: S3)
-- ════════════════════════════════════════════════════════════════════
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner1@test'),
  ('00000000-0000-0000-0000-0000000000a2', 't1@test'),
  ('00000000-0000-0000-0000-0000000000b2', 't2@test');
insert into public.institutes (id, name, owner_id) values
  ('00000000-0000-0000-0000-000000001001', 'Inst One', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000002001', 'Inst Two', '00000000-0000-0000-0000-0000000000b2');
insert into public.departments (id, institute_id, name) values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001001', 'ECE');
insert into public.sections (id, department_id, name, year) values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001101', 'ECE-2', 2025);
insert into public.batches (id, institute_id, name, department_id, section_id, class_level) values
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', 'ECE-2',
   '00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001201', '12'),
  ('00000000-0000-0000-0000-000000002301', '00000000-0000-0000-0000-000000002001', 'X-A', null, null, '10');
insert into public.institute_members (institute_id, user_id, role, status) values
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-0000000000a2', 'teacher', 'active');
insert into public.subjects (id, institute_id, name, code) values
  ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001001', 'Physics', 'PHY');
insert into public.teaching_assignments (institute_id, teacher_id, batch_id, subject_id) values
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001401');
insert into public.students (id, institute_id, batch_id, name, roll_no, email, is_active, department_id, section_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001301',
   'Asha Verma', '1', 'asha.verma@gmail.com', true, '00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001201'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001301',
   'Bilal Khan', '2', null, true, '00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001201'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002301',
   'Chitra Rao', '3', 'c@x.in', true, null, null);
insert into public.student_access_codes (student_id, access_code, batch_id, institute_id, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'AAAA2222', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', true),
  ('00000000-0000-0000-0000-00000000c002', 'BBBB3333', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', true),
  ('00000000-0000-0000-0000-00000000c003', 'CCCC4444', '00000000-0000-0000-0000-000000002301', '00000000-0000-0000-0000-000000002001', true);

-- assignments (all by T1 in B1 unless noted). Short ids: …d0NN
insert into public.assignments (id, institute_id, batch_id, created_by, title, description, deadline, status,
                                max_marks, max_attempts, late_policy, opens_at, auto_publish, max_mb)
select ('00000000-0000-0000-0000-00000000d0' || lpad(n::text, 2, '0'))::uuid,
       '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001301',
       '00000000-0000-0000-0000-0000000000a2', t, 'Upload all pages in order', dl, st, 10, ma, lp, op, ap, 10
  from (values
    (1,  'A1 normal',        now() + interval '1 day',   'active', 2,  'accept_flag', null::timestamptz, false),
    (2,  'A2 closed reject', now() - interval '1 hour',  'active', 3,  'reject',      null, false),
    (3,  'A3 late accept',   now() - interval '1 hour',  'active', 3,  'accept_flag', null, false),
    (4,  'A4 no key',        null,                       'active', 3,  'accept_flag', null, false),
    (5,  'A5 rate limit',    null,                       'active', 10, 'accept_flag', null, false),
    (6,  'A6 in grace',      now() - interval '1 minute','active', 3,  'reject',      null, false),
    (7,  'A7 parallel max1', null,                       'active', 1,  'accept_flag', null, false),
    (8,  'A8 parallel key',  null,                       'active', 3,  'accept_flag', null, false),
    (9,  'A9 auto publish',  null,                       'active', 3,  'accept_flag', null, true),
    (10, 'A10 inactive',     null,                       'closed', 3,  'accept_flag', null, false),
    (11, 'A11 not open',     now() + interval '2 days',  'active', 3,  'accept_flag', now() + interval '1 day', false),
    (12, 'A12 retries',      null,                       'active', 3,  'accept_flag', null, false)
  ) v(n, t, dl, st, ma, lp, op, ap);

insert into public.assignment_ai_keys (assignment_id, answer_key_path, updated_by)
select id, '00000000-0000-0000-0000-0000000000a2/key.pdf', '00000000-0000-0000-0000-0000000000a2'
  from public.assignments where id <> '00000000-0000-0000-0000-00000000d004';

-- ════════════════════════════════════════════════════════════════════
-- verify_access_code + rate limit + lockout
-- ════════════════════════════════════════════════════════════════════
do $$
declare r jsonb;
begin
  perform tst.as_anon('10.0.0.1');
  r := public.verify_access_code('aaaa2222');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok' and r -> 'student' ->> 'name' = 'Asha Verma'
                 and r -> 'student' ->> 'email_masked' = 'a***@gmail.com'
                 and r -> 'student' ->> 'class_level' = '12'
                 and not (r::text ~ 'c001'), 'verify_access_code: name, class, masked email, no student id', r);
end $$;

do $$
declare r jsonb; n_ok int := 0;
begin
  -- school WiFi: a whole class behind one IP, all with correct codes → never limited
  perform tst.as_anon('10.0.0.2');
  for i in 1..40 loop
    r := public.verify_access_code('AAAA2222');
    if r ->> 'state' = 'ok' then n_ok := n_ok + 1; end if;
  end loop;
  perform tst.as_admin();
  perform tst.ok(n_ok = 40 and not exists (select 1 from public.access_code_attempts where ip_hash = tst.ip_hash('10.0.0.2')),
                 '40 correct verifies from one IP: all ok, nothing logged', to_jsonb(n_ok));
end $$;

do $$
declare r jsonb; v_states text[] := '{}';
begin
  perform tst.as_anon('10.0.0.3');
  for i in 1..21 loop
    r := public.verify_access_code('WRNG' || lpad(i::text, 4, '0'));   -- 21 different wrong codes
    v_states := v_states || (r ->> 'state');
  end loop;
  perform tst.as_admin();
  perform tst.ok(v_states[1:20] = array_fill('invalid_code'::text, array[20]) and v_states[21] = 'locked'
                 and r ->> 'scope' = 'ip' and (r ->> 'retry_after_sec')::int between 840 and 900,
                 '20 wrong codes from one IP: invalid_code; the 21st try: locked (ip, ~15 min)', to_jsonb(v_states));
  perform tst.as_anon('10.0.0.3');
  r := public.verify_access_code('AAAA2222');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'locked', 'locked IP: a correct code is refused too (no oracle)', r);
  perform tst.ok((select count(*) from public.access_code_attempts where ip_hash = tst.ip_hash('10.0.0.3')) = 20,
                 'tries while locked are not logged (lock does not extend itself)', null);
  perform tst.ok(not exists (select 1 from public.access_code_attempts where code_hash !~ '^[0-9a-f]{64}$'),
                 'access_code_attempts stores only hashes', null);
  -- 16 minutes later the lock is over
  update public.access_code_attempts set ts = ts - interval '16 minutes' where ip_hash = tst.ip_hash('10.0.0.3');
  perform tst.as_anon('10.0.0.3');
  r := public.verify_access_code('AAAA2222');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok', 'IP lockout ends 15 min after the 20th wrong code', r);
end $$;

do $$
declare r jsonb; v_states text[] := '{}';
begin
  -- the same wrong code from 10 different IPs (none of them near its own IP limit)
  for i in 1..11 loop
    perform tst.as_anon('10.0.10.' || i);
    r := public.verify_access_code('QQQQ7777');
    v_states := v_states || (r ->> 'state');
  end loop;
  perform tst.as_admin();
  perform tst.ok(v_states[1:10] = array_fill('invalid_code'::text, array[10]) and v_states[11] = 'locked'
                 and r ->> 'scope' = 'code',
                 'same wrong code 10x (any IPs): the 11th try on that code is locked (code)', to_jsonb(v_states));
  perform tst.as_anon('10.0.10.11');
  r := public.verify_access_code('AAAA2222');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok', 'code lock does not block other codes from the same IP', r);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- get_assignment_link
-- ════════════════════════════════════════════════════════════════════
do $$
declare r jsonb; tok text;
begin
  select link_token into tok from public.assignments where id = '00000000-0000-0000-0000-00000000d001';
  perform tst.as_anon('10.0.1.1');
  r := public.get_assignment_link(tok);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'open' and r -> 'assignment' ->> 'title' = 'A1 normal'
                 and (r -> 'assignment' ->> 'max_pages')::int = 30 and r -> 'assignment' ->> 'grace_minutes' = '2'
                 and r ? 'server_time' and not (r ? 'student'),
                 'get_assignment_link by token: open + rules', r);
  perform tst.ok(r::text !~* 'answer_key|rubric|key\.pdf', 'get_assignment_link never returns the answer key', r);

  perform tst.as_anon('10.0.1.1');
  r := public.get_assignment_link('nope-not-a-token');
  perform tst.as_admin();
  perform tst.ok(r = '{"state": "not_found"}'::jsonb, 'unknown token: {state: not_found}, no error', r);
end $$;

do $$
declare r2 jsonb; r3 jsonb; r10 jsonb; r11 jsonb; r6 jsonb;
begin
  perform tst.as_anon('10.0.1.2');
  r2  := public.get_assignment_link('00000000-0000-0000-0000-00000000d002');
  r3  := public.get_assignment_link('00000000-0000-0000-0000-00000000d003');
  r6  := public.get_assignment_link('00000000-0000-0000-0000-00000000d006');
  r10 := public.get_assignment_link('00000000-0000-0000-0000-00000000d010');
  r11 := public.get_assignment_link('00000000-0000-0000-0000-00000000d011');
  perform tst.as_admin();
  perform tst.ok(r2 ->> 'state' = 'closed', 'past deadline + reject: closed', r2);
  perform tst.ok(r3 ->> 'state' = 'open_late', 'past deadline + accept_flag: open_late', r3);
  perform tst.ok(r6 ->> 'state' = 'open', 'deadline 1 min ago is inside the 2 min grace: open', r6);
  perform tst.ok(r10 ->> 'state' = 'inactive' and not (r10 ? 'assignment'), 'inactive: state only', r10);
  perform tst.ok(r11 ->> 'state' = 'not_open', 'opens_at in the future: not_open', r11);
end $$;

do $$
declare r1 jsonb; r3 jsonb;
begin
  perform tst.as_anon('10.0.1.3');
  r1 := public.get_assignment_link('00000000-0000-0000-0000-00000000d001', 'AAAA2222');
  r3 := public.get_assignment_link('00000000-0000-0000-0000-00000000d001', 'CCCC4444');
  perform tst.as_admin();
  perform tst.ok(r1 -> 'student' ->> 'state' = 'ok' and (r1 -> 'student' ->> 'attempts_left')::int = 2,
                 'link + own code: attempts left', r1);
  perform tst.ok(r3 -> 'student' ->> 'state' = 'not_in_class' and not (r3 ? 'question_paper'),
                 'link + code of another institute: not_in_class, no question paper', r3);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- create_submission: happy path, replay, attempts, late, rate limit, files
-- ════════════════════════════════════════════════════════════════════
create table tst.ids (name text primary key, id uuid);
grant all on tst.ids to anon, authenticated, service_role;

do $$
declare r jsonb; f jsonb; k text := tst.key(); r2 jsonb; v_sub uuid;
begin
  f := tst.files('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 3);
  perform tst.as_anon('10.0.2.1');
  r := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d001', k, f);
  r2 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d001', k, f);
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  insert into tst.ids values ('s1_a1_1', v_sub);
  perform tst.ok(r ->> 'state' = 'created' and r -> 'submission' ->> 'label' = 'Upload-1'
                 and r -> 'submission' ->> 'status' = 'queued' and (r ->> 'attempts_left')::int = 1,
                 'create_submission: created, Upload-1, queued', r);
  perform tst.ok(r2 ->> 'state' = 'replayed' and (r2 -> 'submission' ->> 'id')::uuid = v_sub,
                 'same idempotency_key again: same submission (replayed)', r2);
  perform tst.ok((select count(*) from public.submissions where idempotency_key = k) = 1, 'replay made no 2nd row', null);
  perform tst.ok(exists (select 1 from public.check_sheets sh where sh.submission_id = v_sub and sh.source_bucket = 'submissions'
                          and cardinality(sh.pages) = 3 and sh.status = 'uploaded'
                          and sh.pages[1] = f -> 0 ->> 'storage_path'),
                 'check_sheets row for the attempt (pages in order, bucket submissions)', null);
  perform tst.ok(exists (select 1 from public.check_jobs j where j.submission_id = v_sub and j.state = 'queued'
                          and j.kind = 'check' and j.institute_id = '00000000-0000-0000-0000-000000001001'),
                 'check_jobs row queued', null);
  perform tst.ok((select answer_key_version from public.submissions where id = v_sub) = 1, 'answer key version pinned', null);
  perform tst.ok((select count(*) from public.check_sessions where assignment_id = '00000000-0000-0000-0000-00000000d001') = 1,
                 'one check_sessions row per assignment', null);
end $$;

do $$
declare r2 jsonb; r3 jsonb;
begin
  perform tst.as_anon('10.0.2.2');
  r2 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d001', tst.key(),
          tst.files('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 1));
  r3 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d001', tst.key(),
          tst.files('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 1));
  perform tst.as_admin();
  insert into tst.ids values ('s1_a1_2', (r2 -> 'submission' ->> 'id')::uuid);
  perform tst.ok(r2 ->> 'state' = 'created' and (r2 -> 'submission' ->> 'attempt_no')::int = 2, 'attempt 2 of 2 created', r2);
  perform tst.ok(r3 ->> 'state' = 'max_attempts' and (r3 ->> 'attempts_used')::int = 2,
                 'max_attempts crossed: 3rd attempt refused', r3);
end $$;

do $$
declare
  r2 jsonb; r3 jsonb; r6 jsonb; r10 jsonb; r11 jsonb;
  -- files are created as admin: Storage itself refuses uploads to a closed / inactive / not-open link
  f2 jsonb := tst.files('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c001', 1);
  f3 jsonb := tst.files('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000c001', 1);
  f6 jsonb := tst.files('00000000-0000-0000-0000-00000000d006', '00000000-0000-0000-0000-00000000c001', 1);
  f10 jsonb := tst.files('00000000-0000-0000-0000-00000000d010', '00000000-0000-0000-0000-00000000c001', 1);
  f11 jsonb := tst.files('00000000-0000-0000-0000-00000000d011', '00000000-0000-0000-0000-00000000c001', 1);
begin
  perform tst.as_anon('10.0.2.3');
  r2 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d002', tst.key(), f2);
  r3 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d003', tst.key(), f3);
  r6 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d006', tst.key(), f6);
  r10 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d010', tst.key(), f10);
  r11 := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d011', tst.key(), f11);
  perform tst.as_admin();
  perform tst.ok(r2 ->> 'state' = 'closed', 'late + late_policy reject: closed', r2);
  perform tst.ok(r3 ->> 'state' = 'created' and (r3 -> 'submission' ->> 'is_late')::boolean,
                 'late + accept_flag: created with is_late = true', r3);
  perform tst.ok(r6 ->> 'state' = 'created' and not (r6 -> 'submission' ->> 'is_late')::boolean,
                 '1 min after deadline (2 min grace): on time', r6);
  perform tst.ok(r10 ->> 'state' = 'inactive', 'inactive assignment: refused', r10);
  perform tst.ok(r11 ->> 'state' = 'not_open', 'before opens_at: refused', r11);
end $$;

do $$
declare r jsonb; v_states text[] := '{}';
begin
  for i in 1..4 loop
    perform tst.as_admin();
    perform set_config('tst.f', tst.files('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-00000000c002', 1)::text, true);
    perform tst.as_anon('10.0.2.4');
    r := public.create_submission('BBBB3333', '00000000-0000-0000-0000-00000000d005', tst.key(),
                                  current_setting('tst.f')::jsonb);
    v_states := v_states || (r ->> 'state');
  end loop;
  perform tst.as_admin();
  perform tst.ok(v_states = array['created','created','created','too_many_requests'],
                 '4 submits in a minute: 4th too_many_requests (3/min/student/assignment)', to_jsonb(v_states));
end $$;

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000d012';
  s1 uuid := '00000000-0000-0000-0000-00000000c001';
  s2 uuid := '00000000-0000-0000-0000-00000000c002';
  f_other jsonb; f_missing jsonb; f_gif jsonb; f_big jsonb; f_old jsonb; f_mime jsonb; f_many jsonb;
  r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb; r6 jsonb; r7 jsonb;
begin
  f_other := tst.files(a, s2, 1);                                     -- Bilal's folder, sent by Asha
  f_missing := jsonb_build_array(jsonb_build_object('storage_path',
                 '00000000-0000-0000-0000-000000001001/' || a || '/' || s1 || '/' || gen_random_uuid() || '.jpg',
                 'mime', 'image/jpeg', 'size', 1000, 'sha256', repeat('a', 64), 'page_order', 1));
  f_gif := tst.files(a, s1, 1, 'jpg', 'image/gif');
  f_mime := tst.files(a, s1, 1, 'pdf', 'image/jpeg');                 -- .pdf name, jpeg mime
  f_big := tst.files(a, s1, 1, 'jpg', 'image/jpeg', 11 * 1048576);   -- max_mb 10
  f_many := tst.files(a, s1, 31);
  perform tst.as_anon('10.0.2.5');
  r1 := public.create_submission('AAAA2222', a, tst.key(), f_other);
  r2 := public.create_submission('AAAA2222', a, tst.key(), f_missing);
  r3 := public.create_submission('AAAA2222', a, tst.key(), f_gif);
  r4 := public.create_submission('AAAA2222', a, tst.key(), f_big);
  r5 := public.create_submission('AAAA2222', a, tst.key(), f_many);
  r7 := public.create_submission('AAAA2222', a, tst.key(), f_mime);
  perform tst.as_admin();
  perform tst.ok(r1 ->> 'state' = 'invalid_files' and r1 -> 'errors' -> 0 ->> 'code' = 'bad_path',
                 'file from another student''s folder: bad_path', r1);
  perform tst.ok(r2 -> 'errors' -> 0 ->> 'code' = 'not_uploaded', 'file not in Storage: not_uploaded', r2);
  perform tst.ok(r3 -> 'errors' -> 0 ->> 'code' = 'bad_format', 'gif: bad_format', r3);
  perform tst.ok(r4 -> 'errors' -> 0 ->> 'code' = 'too_large' and r4 -> 'errors' -> 0 ->> 'message' ~ 'Max 10 MB',
                 '11 MB on a 10 MB link: too_large (Hinglish message)', r4);
  perform tst.ok(r5 -> 'errors' -> 0 ->> 'code' = 'too_many_files', '31 pages: too_many_files', r5);
  perform tst.ok(r7 -> 'errors' -> 0 ->> 'code' = 'bad_format', 'extension and mime disagree: bad_format', r7);
  perform tst.ok(not exists (select 1 from public.submissions where assignment_id = a), 'invalid files create nothing', null);

  -- file reuse + same-bytes warning
  f_old := tst.files(a, s1, 1);
  perform tst.as_anon('10.0.2.5');
  r6 := public.create_submission('AAAA2222', a, tst.key(), f_old);
  r7 := public.create_submission('AAAA2222', a, tst.key(), f_old);
  perform tst.as_admin();
  perform tst.ok(r6 ->> 'state' = 'created' and r7 -> 'errors' -> 0 ->> 'code' = 'file_reused',
                 'the same uploaded file in a 2nd attempt: file_reused', r7);
  insert into tst.ids values ('s1_a12_1', (r6 -> 'submission' ->> 'id')::uuid);
end $$;

do $$
declare r jsonb; f jsonb; v_sha text;
begin
  -- new upload with the same bytes (sha256) as attempt 1 → warning, still created
  select e ->> 'sha256' into v_sha from public.submissions s, jsonb_array_elements(s.files) e
   where s.id = (select id from tst.ids where name = 's1_a12_1');
  f := tst.files('00000000-0000-0000-0000-00000000d012', '00000000-0000-0000-0000-00000000c001', 1);
  f := jsonb_set(f, '{0,sha256}', to_jsonb(v_sha));
  perform tst.as_anon('10.0.2.6');
  r := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d012', tst.key(), f);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'created' and r -> 'warnings' -> 0 ->> 'code' = 'same_as_earlier_upload',
                 'same sha256 as an earlier upload: warning, not an error', r);
  insert into tst.ids values ('s1_a12_2', (r -> 'submission' ->> 'id')::uuid);
end $$;

do $$
declare r jsonb;
begin
  perform tst.as_anon('10.0.2.7');
  r := public.create_submission('ZZZZ9999', '00000000-0000-0000-0000-00000000d001', tst.key(), '[]');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_code', 'create_submission with a wrong code: invalid_code', r);
  perform tst.as_anon('10.0.2.7');
  r := public.create_submission('CCCC4444', '00000000-0000-0000-0000-00000000d001', tst.key(), '[]');
  perform tst.as_admin();
  perform tst.ok(r = '{"state": "not_found"}'::jsonb, 'student of another institute: not_found', r);
  perform tst.as_anon('10.0.2.7');
  r := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d001', 'short', '[]');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_request', 'bad idempotency key: invalid_request', r);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- answer key missing → waiting_key → key added → queued; key edit → new version
-- ════════════════════════════════════════════════════════════════════
do $$
declare r jsonb; v_sub uuid;
begin
  perform tst.as_anon('10.0.3.1');
  r := public.create_submission('BBBB3333', '00000000-0000-0000-0000-00000000d004', tst.key(),
         tst.files('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-00000000c002', 2));
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  perform tst.ok(r -> 'submission' ->> 'status' = 'waiting_key'
                 and not exists (select 1 from public.check_jobs where submission_id = v_sub),
                 'no answer key: waiting_key, no job', r);
  -- teacher attaches the key (as the teacher, through RLS)
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  insert into public.assignment_ai_keys (assignment_id, answer_key_path, updated_by)
  values ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-0000000000a2/k4.pdf', auth.uid());
  perform tst.as_admin();
  perform tst.ok((select status from public.submissions where id = v_sub) = 'queued'
                 and exists (select 1 from public.check_jobs where submission_id = v_sub and state = 'queued')
                 and (select answer_key_version from public.submissions where id = v_sub) = 1,
                 'key added: waiting attempt queued with key version 1', null);
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  update public.assignment_ai_keys set answer_key_path = '00000000-0000-0000-0000-0000000000a2/k4-v2.pdf', version = 99
   where assignment_id = '00000000-0000-0000-0000-00000000d004';
  perform tst.as_admin();
  perform tst.ok((select version from public.assignment_ai_keys where assignment_id = '00000000-0000-0000-0000-00000000d004') = 2
                 and (select answer_key_version from public.submissions where id = v_sub) = 2,
                 'key edit: version 2 (manual value ignored), unchecked attempt re-pinned', null);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Job lifecycle (worker = service_role) → status sync → publish rules
-- ════════════════════════════════════════════════════════════════════
do $$
declare j public.check_jobs; v_sub uuid := (select id from tst.ids where name = 's1_a1_1'); r jsonb;
begin
  j := tst.claim_for(v_sub);
  perform tst.ok(j.submission_id = v_sub and j.state = 'running' and j.retries = 1, 'claim: running, retries 1', to_jsonb(j));
  perform tst.ok((select status from public.submissions where id = v_sub) = 'checking', 'running job → submission checking', null);

  -- publish while checking → blocked
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.publish_results(p_submission_ids => array[v_sub]);
  perform tst.as_admin();
  perform tst.ok(r -> 'blocked' -> 0 ->> 'status' = 'checking' and jsonb_array_length(r -> 'published') = 0,
                 'publish during checking: blocked', r);

  perform tst.fake_result(v_sub);
  perform tst.as_service();
  perform public.a4_finish_check_job(j.id, true, null, null, '{"gemini_calls": 1}');
  perform tst.as_admin();
  perform tst.ok((select status from public.submissions where id = v_sub) = 'checked', 'job done → submission checked', null);
  perform tst.ok((select per_question -> 1 ->> 'q_no' = '2a' and (per_question -> 0 ->> 'marks')::numeric = 3
                    and not (per_question::text ~ 'teacher_note')
                    from public.check_sheets where submission_id = v_sub), 'per_question derived from ai_result', null);
end $$;

do $$
declare v_sub uuid := (select id from tst.ids where name = 's1_a1_1'); r jsonb; m jsonb; m2 jsonb;
begin
  -- before publish the student sees no marks
  perform tst.as_anon('10.0.4.1');
  m := public.my_submissions('AAAA2222', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(m ->> 'state' = 'ok' and jsonb_array_length(m -> 'attempts') = 2
                 and m -> 'attempts' -> 1 ->> 'label' = 'Upload-1' and m -> 'attempts' -> 1 -> 'result' = 'null'::jsonb
                 and (m -> 'attempts' -> 0 ->> 'counts')::boolean,
                 'my_submissions: 2 attempts, newest first counts (latest), no marks before publish', m);

  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.publish_results('00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(r -> 'published' = jsonb_build_array(v_sub) and jsonb_array_length(r -> 'blocked') = 1,
                 'publish by assignment: checked attempt published, queued attempt blocked', r);
  perform tst.ok((select status = 'published' and grade = 7 from public.submissions where id = v_sub)
                 and (select published and final_marks = 7 and reviewed_by = '00000000-0000-0000-0000-0000000000a2'
                        from public.check_sheets where submission_id = v_sub),
                 'published: grade 7, sheet published + reviewed_by', null);

  perform tst.as_anon('10.0.4.1');
  m := public.my_submissions('AAAA2222', '00000000-0000-0000-0000-00000000d001');
  m2 := public.my_submissions('BBBB3333', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok((m -> 'attempts' -> 1 -> 'result' ->> 'marks')::numeric = 7
                 and (m -> 'attempts' -> 1 -> 'result' ->> 'percentage')::numeric = 70
                 and jsonb_array_length(m -> 'attempts' -> 1 -> 'result' -> 'per_question') = 3,
                 'after publish: student sees marks + per question', m);
  perform tst.ok(m2 ->> 'state' = 'ok' and jsonb_array_length(m2 -> 'attempts') = 0,
                 'another student of the class sees none of these attempts', m2);
end $$;

do $$
declare v_sub uuid := (select id from tst.ids where name = 's1_a1_1'); r jsonb; m jsonb; r_bad jsonb;
begin
  -- 2a was counted (4 > 2). Teacher raises 2b to 5 → 2b counts instead: 3 + 5 = 8
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.override_marks(v_sub, '2b', 5, 'Step marks');
  r_bad := public.override_marks(v_sub, '1', 9);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok' and (r ->> 'total')::numeric = 8 and (r -> 'question' ->> 'counted')::boolean,
                 'override after publish: OR group re-decided, total 8', r);
  perform tst.ok(r_bad ->> 'state' = 'invalid_request', 'override above the question max: refused', r_bad);
  perform tst.ok((select grade from public.submissions where id = v_sub) = 8
                 and (select final_marks from public.check_sheets where submission_id = v_sub) = 8,
                 'published marks follow the override', null);
  perform tst.ok(exists (select 1 from public.smart_assignment_checks where submission_id = v_sub
                          and result_json ->> 'type' = 'teacher_override'
                          and (result_json ->> 'previous_marks')::numeric = 2
                          and (result_json ->> 'sheet_total_before')::numeric = 7
                          and (result_json ->> 'sheet_total_after')::numeric = 8),
                 'override history row with before/after', null);
  perform tst.ok((select (ai_result -> 'graded_questions' -> 2 ->> 'marks_awarded')::numeric = 2
                    from public.check_sheets where submission_id = v_sub), 'AI marks kept next to the teacher''s', null);
  perform tst.as_anon('10.0.4.2');
  m := public.my_submissions('AAAA2222', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok((m -> 'attempts' -> 1 -> 'result' ->> 'marks')::numeric = 8, 'student sees the updated marks', m);
end $$;

do $$
declare v_sub uuid := (select id from tst.ids where name = 's1_a1_1'); r jsonb; r0 jsonb; m jsonb;
begin
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r0 := public.unpublish_results(array[v_sub], '');
  r := public.unpublish_results(array[v_sub], 'Wrong key used');
  perform tst.as_admin();
  perform tst.ok(r0 ->> 'state' = 'invalid_request', 'unpublish needs a reason', r0);
  perform tst.ok(r -> 'unpublished' = jsonb_build_array(v_sub)
                 and (select status = 'checked' and grade is null from public.submissions where id = v_sub)
                 and exists (select 1 from public.smart_assignment_checks where submission_id = v_sub
                              and result_json ->> 'type' = 'unpublish' and result_json ->> 'reason' = 'Wrong key used'),
                 'unpublish: back to checked, grade hidden, audit row', r);
  perform tst.as_anon('10.0.4.3');
  m := public.my_submissions('AAAA2222', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(m -> 'attempts' -> 1 -> 'result' = 'null'::jsonb, 'student no longer sees marks', m);
  perform tst.ok((select count(*) from public.smart_assignment_checks where submission_id = v_sub
                   and result_json ->> 'type' = 'publish') = 1, 'publish audit row', null);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Worker errors: retry with backoff, BAD_FILE → rejected (attempt not used up), stuck → sweep
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  v1 uuid := (select id from tst.ids where name = 's1_a12_1');
  v2 uuid := (select id from tst.ids where name = 's1_a12_2');
  j public.check_jobs; m jsonb;
begin
  j := tst.claim_for(v1);
  perform tst.as_service();
  j := public.a4_finish_check_job(j.id, false, 'GEMINI_429', 'AI busy');
  perform tst.as_admin();
  perform tst.ok(j.state = 'queued' and j.next_run_at > now() + interval '20 seconds'
                 and (select status from public.submissions where id = v1) = 'queued',
                 'Gemini 429: re-queued with backoff, student still sees queued', to_jsonb(j));

  j := tst.claim_for(v2);
  perform tst.as_service();
  j := public.a4_finish_check_job(j.id, false, 'BAD_FILE', 'Page 1 is password-protected.');
  perform tst.as_admin();
  perform tst.ok((select status = 'rejected' and reject_reasons -> 0 ->> 'code' = 'bad_file'
                    from public.submissions where id = v2), 'BAD_FILE: rejected with a reason', null);
  perform tst.as_anon('10.0.5.1');
  m := public.my_submissions('AAAA2222', '00000000-0000-0000-0000-00000000d012');
  perform tst.as_admin();
  perform tst.ok((m ->> 'attempts_used')::int = 1, 'a rejected upload does not use up an attempt', m);

  -- stuck run: locked 10 min ago → sweep re-queues; at max retries → failed
  update public.check_jobs set next_run_at = now() where submission_id = v1;
  j := tst.claim_for(v1);
  update public.check_jobs set locked_at = now() - interval '10 minutes' where id = j.id;
  perform tst.as_service();
  m := public.a4_checker_sweep();
  perform tst.as_admin();
  perform tst.ok((m ->> 'requeued')::int = 1 and (select state from public.check_jobs where id = j.id) = 'queued',
                 'sweep: stuck job re-queued', m);
  update public.check_jobs set state = 'running', locked_at = now() - interval '10 minutes', retries = max_retries
   where id = j.id;
  perform tst.as_service();
  m := public.a4_checker_sweep();
  perform tst.as_admin();
  perform tst.ok((select state from public.check_jobs where id = j.id) = 'failed'
                 and (select status from public.submissions where id = v1) = 'failed',
                 'sweep: stuck job at max retries → failed, submission failed', m);
end $$;

do $$
declare r jsonb; v_sub uuid; j public.check_jobs;
begin
  perform tst.as_anon('10.0.5.2');
  r := public.create_submission('BBBB3333', '00000000-0000-0000-0000-00000000d009', tst.key(),
         tst.files('00000000-0000-0000-0000-00000000d009', '00000000-0000-0000-0000-00000000c002', 1));
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  j := tst.claim_for(v_sub);
  perform tst.fake_result(v_sub);
  perform tst.as_service();
  perform public.a4_finish_check_job(j.id, true);
  perform tst.as_admin();
  perform tst.ok((select status = 'published' and grade = 7 from public.submissions where id = v_sub),
                 'auto_publish: clean result published without the teacher', null);

  -- low confidence on an auto-publish link → needs_review, NOT published
  perform tst.as_anon('10.0.5.3');
  r := public.create_submission('BBBB3333', '00000000-0000-0000-0000-00000000d009', tst.key(),
         tst.files('00000000-0000-0000-0000-00000000d009', '00000000-0000-0000-0000-00000000c002', 1));
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  j := tst.claim_for(v_sub);
  perform tst.fake_result(v_sub, '{low_confidence}');
  perform tst.as_service();
  perform public.a4_finish_check_job(j.id, true);
  perform tst.as_admin();
  perform tst.ok((select status = 'needs_review' and grade is null from public.submissions where id = v_sub),
                 'auto_publish never publishes a needs_review copy', null);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- RLS / grants: another institute's teacher, anon, students
-- ════════════════════════════════════════════════════════════════════
do $$
declare v_sub uuid := (select id from tst.ids where name = 's1_a1_1'); n1 int; n2 int; n3 int; n4 int; r jsonb; r2 jsonb;
begin
  perform tst.as_user('00000000-0000-0000-0000-0000000000b2');           -- admin of institute 2
  select count(*) into n1 from public.submissions where assignment_id = '00000000-0000-0000-0000-00000000d001';
  select count(*) into n2 from public.check_sheets where submission_id = v_sub;
  select count(*) into n3 from public.check_jobs where submission_id = v_sub;
  select count(*) into n4 from public.check_sessions where assignment_id = '00000000-0000-0000-0000-00000000d001';
  r := public.publish_results('00000000-0000-0000-0000-00000000d001');
  r2 := public.override_marks(v_sub, '1', 0);
  perform tst.as_admin();
  perform tst.ok(n1 = 0 and n2 = 0 and n3 = 0 and n4 = 0,
                 'teacher of another institute: 0 submissions / sheets / jobs / sessions via RLS',
                 jsonb_build_array(n1, n2, n3, n4));
  perform tst.ok(r ->> 'state' = 'forbidden' and r2 ->> 'state' = 'forbidden',
                 'teacher of another institute: publish + override forbidden', jsonb_build_array(r, r2));

  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');           -- the class teacher sees them
  select count(*) into n2 from public.check_sheets where submission_id = v_sub;
  select count(*) into n3 from public.check_jobs where submission_id = v_sub;
  perform tst.as_admin();
  perform tst.ok(n2 = 1 and n3 = 1, 'class teacher sees the sheet + job', jsonb_build_array(n2, n3));
end $$;

do $$
declare n int; v_err text;
begin
  perform tst.as_anon('10.0.6.1');
  select count(*) into n from public.submissions;
  perform tst.as_admin();
  perform tst.ok(n = 0, 'anon reads 0 submissions rows (RLS)', to_jsonb(n));

  foreach v_err in array array[
    'select count(*) from public.access_code_attempts',
    'select count(*) from public.check_jobs',
    'select public.a4_claim_check_job(10)',
    'select public.a4_enqueue_submission(gen_random_uuid())',
    'select public.publish_results(gen_random_uuid())',
    'select public.override_marks(gen_random_uuid(), ''1'', 1)',
    'select public.a4_code_gate(''AAAA2222'', null)'] loop
    begin
      perform tst.as_anon('10.0.6.1');
      execute v_err;
      perform tst.as_admin();
      raise exception 'FAIL anon may run: %', v_err;
    exception when insufficient_privilege then
      perform tst.as_admin();
      raise notice 'PASS anon denied: %', v_err;
    end;
  end loop;

  begin
    perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
    perform public.a4_claim_check_job(10);
    raise exception 'FAIL teacher may claim jobs';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS teacher denied: a4_claim_check_job';
  end;
end $$;

do $$
declare r jsonb;
begin
  perform tst.as_anon('10.0.6.2');
  r := public.my_submissions('CCCC4444', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(r = '{"state": "not_found"}'::jsonb, 'student of another class: my_submissions not_found', r);
end $$;

-- teacher can't attach a portal sheet / session by hand (guards)
do $$
begin
  begin
    perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
    insert into public.check_sessions (title, source, assignment_id)
    values ('x', 'assignment', '00000000-0000-0000-0000-00000000d001');
    raise exception 'FAIL teacher created an assignment session by hand';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS teacher cannot create assignment sessions by hand';
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Storage policy (bucket submissions) as anon
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  ok_path  text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c001/' || gen_random_uuid() || '.jpg';
  bad_stu  text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c003/' || gen_random_uuid() || '.jpg';
  bad_ext  text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c001/' || gen_random_uuid() || '.gif';
  closed_p text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d002/00000000-0000-0000-0000-00000000c001/' || gen_random_uuid() || '.jpg';
  v_path text;
begin
  perform tst.as_anon('10.0.7.1');
  insert into storage.objects (bucket_id, name) values ('submissions', ok_path);
  perform tst.as_admin();
  raise notice 'PASS storage: anon uploads to <inst>/<asg>/<student>/<uuid>.jpg of an open link';
  foreach v_path in array array[bad_stu, bad_ext, closed_p] loop
    begin
      perform tst.as_anon('10.0.7.1');
      insert into storage.objects (bucket_id, name) values ('submissions', v_path);
      perform tst.as_admin();
      raise exception 'FAIL storage accepted %', v_path;
    exception when insufficient_privilege then
      perform tst.as_admin();
      raise notice 'PASS storage refused %', split_part(v_path, '/', 3) || '/' || split_part(v_path, '/', 4);
    end;
  end loop;
end $$;

-- bucket caps, max_mb upper bound, HEIC only where the link allows it
do $$
declare r jsonb; f jsonb;
begin
  perform tst.ok((select file_size_limit = 10485760
                         and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
                         and cardinality(allowed_mime_types) = 5 and not public
                    from storage.buckets where id = 'submissions'),
                 'bucket submissions: private, 10 MB, jpeg/png/webp/heic/pdf', null);
  begin
    update public.assignments set max_mb = 11 where id = '00000000-0000-0000-0000-00000000d005';
    raise exception 'FAIL max_mb 11 accepted';
  exception when check_violation then
    raise notice 'PASS max_mb above 10 (bucket limit) refused';
  end;
  f := tst.files('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-00000000c001', 1, 'heic', 'image/heic');
  perform tst.as_anon('10.0.7.2');
  r := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d005', tst.key(), f);
  perform tst.as_admin();
  perform tst.ok(r -> 'errors' -> 0 ->> 'code' = 'bad_format', 'HEIC on a link without image/heic: bad_format', r);
  update public.assignments set allowed_mimes = allowed_mimes || array['image/heic']
   where id = '00000000-0000-0000-0000-00000000d005';
  f := tst.files('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-00000000c001', 1, 'heic', 'image/heic');
  perform tst.as_anon('10.0.7.2');
  r := public.create_submission('AAAA2222', '00000000-0000-0000-0000-00000000d005', tst.key(), f);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'created', 'HEIC on a link that allows it: created', r);
end $$;

-- uploads nobody attached → listed after 24 h → hourly retention job
do $$
declare
  v_linked text := (select e ->> 'storage_path' from public.submissions s, jsonb_array_elements(s.files) e
                     where s.id = (select id from tst.ids where name = 's1_a1_1') limit 1);
  v_orphan text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c001/' || gen_random_uuid() || '.jpg';
  v_fresh  text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c001/' || gen_random_uuid() || '.jpg';
  v_legacy text := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d001/00000000-0000-0000-0000-00000000c001_1761000000000.pdf';
  v_junk   text := 'not-a-uuid/x/y/z.jpg';
  v_list text[];
  j1 uuid; j2 uuid;
begin
  insert into storage.objects (bucket_id, name, created_at) values
    ('submissions', v_orphan, now() - interval '25 hours'),
    ('submissions', v_fresh,  now() - interval '2 hours'),
    ('submissions', v_legacy, now() - interval '40 hours'),
    ('submissions', v_junk,   now() - interval '40 hours');
  update storage.objects set created_at = now() - interval '25 hours' where bucket_id = 'submissions' and name = v_linked;

  perform tst.as_service();
  select array_agg(x) into v_list from public.a4_orphan_submission_files(100) x;
  j1 := public.a4_enqueue_orphan_cleanup();
  j2 := public.a4_enqueue_orphan_cleanup();
  perform tst.as_admin();
  perform tst.ok(v_orphan = any(v_list) and not (v_linked = any(v_list)) and not (v_fresh = any(v_list))
                 and not (v_legacy = any(v_list)) and not (v_junk = any(v_list)),
                 'orphans: only unattached upload-link files older than 24 h', to_jsonb(v_list));
  perform tst.ok(j1 is not null and j2 is null
                 and (select count(*) from public.check_jobs where kind = 'retention' and state = 'queued') = 1,
                 'orphan cleanup: one retention job per hour', jsonb_build_array(j1, j2));
  begin
    perform tst.as_anon('10.0.7.3');
    perform public.a4_orphan_submission_files(10);
    raise exception 'FAIL anon may list orphan files';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS anon denied: a4_orphan_submission_files';
  end;
end $$;

-- old portal submit can't overwrite an upload-link attempt
do $$
begin
  begin
    perform tst.as_anon('10.0.8.1');
    perform public.submit_assignment('AAAA2222', '00000000-0000-0000-0000-00000000d001', null, null, 'text answer');
    raise exception 'FAIL submit_assignment overwrote an upload-link attempt';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS submit_assignment refuses upload-link attempts';
  end;
end $$;

select 'SQL TESTS DONE' as result;
