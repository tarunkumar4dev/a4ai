-- 18_upload_flow.sql — students upload answer copies through an assignment link → one checker (v4) → publish
-- (22 Oct 2026). Spec: docs/upload-flow-spec.md · recon: docs/upload-flow-recon.md · API: docs/upload-flow-api.md
--
-- Project rules this follows (they win over the spec):
--   * the spec's "test link" IS `assignments`; no test_links / results / result_history / submission_files tables.
--     Extended instead: assignments, submissions, assignment_ai_keys, check_sessions, check_sheets.
--   * students never call the backend: every student action is a SECURITY DEFINER RPC below + direct Storage upload.
--   * one checker: a portal attempt becomes a check_sheets row (source_bucket 'submissions') + a check_jobs row;
--     the v4 worker (backend) grades it like any Check Copies sheet. The v2 grade_sheet path is not used here.
--   * access codes are the 8-char codes from 07 (6-digit legacy codes also still resolve).
--
-- What it adds
--   1. assignments: link settings (opens_at, max_attempts, allowed_mimes, max_mb, max_pages, late_policy,
--      count_policy, auto_publish, link_token). REUSED: deadline = closes_at, status = 'active' = is_active.
--   2. submissions: attempt_no, idempotency_key, is_late, answer_key_version, reject_reasons, files, created_at,
--      status values. Unique (assignment_id, student_id, attempt_no).
--   3. files: submissions.files jsonb [{storage_path, mime, size, sha256, page_order}] (+ check_sheets.pages mirror).
--   4. results: check_sheets.per_question / confidence / needs_review_reasons / model_version / reviewed_by /
--      published / published_at. Audit = existing smart_assignment_checks (no marks_history table).
--   5. check_jobs queue (checker-v4 G2) + claim / finish / sweep functions.
--   6. access_code_attempts (wrong codes only): 20 wrong / 10 min / IP or 10 wrong / 10 min / code → 15 min lockout.
--   7. RPCs: get_assignment_link, verify_access_code, create_submission, my_submissions,
--      publish_results, unpublish_results, override_marks.
--   8. pg_net kick on new jobs + pg_cron sweep every minute — ONLY if those extensions are already enabled.
--      This file never enables an extension.
--   9. RLS / grants / storage path {institute_id}/{assignment_id}/{student_id}/{uuid}.{ext}.
--
-- Requires 10, 11, 12, 17 (checked below). Safe to re-run. One transaction.
-- Run on staging first; then the VERIFY block at the end.

begin;

do $$
begin
  if to_regclass('public.check_sheets') is null or to_regclass('public.assignment_ai_keys') is null
     or to_regprocedure('public.a4_check_sheet_student_guard()') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'smart_assignment_checks' and column_name = 'submission_id') then
    raise exception '18_upload_flow needs 10, 11, 12 and 17 applied first';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 0. Types
-- ════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_type where typname = 'a4_review_reason' and typnamespace = 'public'::regnamespace) then
    create type public.a4_review_reason as enum
      ('empty_answer', 'illegible', 'low_confidence', 'key_missing', 'blank_pages', 'bad_scan');
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 1. assignments = the upload link
-- ════════════════════════════════════════════════════════════════════
alter table public.assignments
  add column if not exists opens_at      timestamptz,
  add column if not exists max_attempts  int     not null default 3,
  add column if not exists allowed_mimes text[]  not null default array['application/pdf','image/jpeg','image/png','image/webp'],
  add column if not exists max_mb        int     not null default 10,
  add column if not exists max_pages     int     not null default 30,
  add column if not exists late_policy   text    not null default 'accept_flag',
  add column if not exists count_policy  text    not null default 'latest',
  add column if not exists auto_publish  boolean not null default false,
  -- volatile default → every existing row gets its own token
  add column if not exists link_token    text    not null default replace(gen_random_uuid()::text, '-', '');

alter table public.assignments drop constraint if exists assignments_link_rules_check;
alter table public.assignments add constraint assignments_link_rules_check check (
      max_attempts between 1 and 20
  and max_mb between 1 and 10                     -- = bucket file_size_limit
  and max_pages between 1 and 30
  and late_policy in ('accept_flag', 'reject')
  and count_policy in ('latest', 'best')
  and cardinality(allowed_mimes) > 0
  and allowed_mimes <@ array['application/pdf','image/jpeg','image/png','image/webp','image/heic']::text[]
  and link_token ~ '^[A-Za-z0-9_-]{16,64}$'
  and (opens_at is null or deadline is null or opens_at < deadline));

create unique index if not exists assignments_link_token_uq on public.assignments (link_token);

-- ════════════════════════════════════════════════════════════════════
-- 2. submissions = one row per attempt
-- ════════════════════════════════════════════════════════════════════
alter table public.submissions
  add column if not exists attempt_no         int,
  add column if not exists idempotency_key    text,
  add column if not exists is_late            boolean not null default false,
  add column if not exists answer_key_version int,
  add column if not exists reject_reasons     jsonb   not null default '[]'::jsonb,
  add column if not exists files              jsonb   not null default '[]'::jsonb,
  add column if not exists created_at         timestamptz not null default now();

-- created_at for old rows = when they were submitted (no-op on re-run)
update public.submissions set created_at = submitted_at
 where submitted_at is not null and created_at > submitted_at;

-- Old rows: 1, 2, … per (assignment, student) in submit order (old anon_submit allowed duplicates)
with n as (
  select id, row_number() over (partition by assignment_id, student_id
                                order by submitted_at nulls first, id) as rn
    from public.submissions where attempt_no is null)
update public.submissions s set attempt_no = n.rn from n where s.id = n.id;
alter table public.submissions alter column attempt_no set default 1;
alter table public.submissions alter column attempt_no set not null;

-- Legacy values 'submitted' / 'graded' stay valid (portal v1 + TeacherAssignmentsTab). NOT VALID = existing rows
-- are not re-checked (live may hold other legacy values); every new or updated row is.
alter table public.submissions drop constraint if exists submissions_status_v2_check;
alter table public.submissions add constraint submissions_status_v2_check check (
  status is null or status in ('uploaded','queued','checking','checked','needs_review','published',
                               'failed','rejected','waiting_key','waiting_quota',
                               'submitted','graded')) not valid;

alter table public.submissions drop constraint if exists submissions_upload_shape_check;
alter table public.submissions add constraint submissions_upload_shape_check check (
      attempt_no between 1 and 1000
  and jsonb_typeof(files) = 'array'
  and jsonb_typeof(reject_reasons) = 'array'
  and (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'));

create unique index if not exists submissions_idempotency_key_uq on public.submissions (idempotency_key);
-- also serves every (assignment_id, student_id) lookup (leftmost prefix), so no separate 2-column index
create unique index if not exists submissions_attempt_uq on public.submissions (assignment_id, student_id, attempt_no);

-- ════════════════════════════════════════════════════════════════════
-- 3. Answer key version (edit = new version; submissions pin the version they were checked with)
-- ════════════════════════════════════════════════════════════════════
alter table public.assignment_ai_keys add column if not exists version int not null default 1;

-- ════════════════════════════════════════════════════════════════════
-- 4. check_sessions / check_sheets: portal attempts live here too
-- ════════════════════════════════════════════════════════════════════
alter table public.check_sessions
  add column if not exists assignment_id uuid references public.assignments(id) on delete cascade;
create unique index if not exists check_sessions_assignment_uq
  on public.check_sessions (assignment_id) where assignment_id is not null;
alter table public.check_sessions drop constraint if exists check_sessions_source_check;
alter table public.check_sessions add constraint check_sessions_source_check check (
     (source in ('test', 'upload') and assignment_id is null)
  or (source = 'assignment' and assignment_id is not null));

alter table public.check_sheets
  add column if not exists submission_id        uuid references public.submissions(id) on delete cascade,
  add column if not exists source_bucket        text not null default 'answer-sheets',
  add column if not exists per_question         jsonb,
  add column if not exists confidence           numeric(4,3),
  add column if not exists needs_review_reasons public.a4_review_reason[] not null default '{}',
  add column if not exists model_version        text,
  add column if not exists reviewed_by          uuid references auth.users(id) on delete set null,
  add column if not exists published            boolean not null default false,
  add column if not exists published_at         timestamptz;

alter table public.check_sheets drop constraint if exists check_sheets_portal_check;
alter table public.check_sheets add constraint check_sheets_portal_check check (
      source_bucket in ('answer-sheets', 'submissions')
  and (submission_id is null) = (source_bucket = 'answer-sheets')
  and (confidence is null or confidence between 0 and 1)
  and (published = false or published_at is not null));

create unique index if not exists check_sheets_submission_uq
  on public.check_sheets (submission_id) where submission_id is not null;

-- One row per student per check stays the rule for teacher checks; a portal student has one sheet per attempt.
-- (12 and 17 both created this index under two names.)
drop index if exists public.check_sheets_session_student_uq;
drop index if exists public.check_sheets_session_student_uniq;
create unique index check_sheets_session_student_uniq
  on public.check_sheets (session_id, student_id) where student_id is not null and submission_id is null;

-- Portal rows are written only by the functions below. They set a transaction-local flag; the 17 guards skip
-- their batch/student check for them and refuse anyone else who tries to set assignment_id / submission_id.
create or replace function public.a4_system_write() returns boolean language sql stable as $$
  select coalesce(current_setting('a4.system_write', true), '') = 'on'
$$;

create or replace function public.a4_check_sheet_student_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if public.a4_system_write() then
    return new;
  end if;
  if auth.uid() is not null
     and new.submission_id is distinct from (case when tg_op = 'UPDATE' then old.submission_id end) then
    raise exception 'Portal copies are created by the system.' using errcode = '42501';
  end if;
  -- service role / maintenance (no JWT) is not restricted; the app always writes with the teacher's JWT
  if auth.uid() is null or new.student_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.student_id is distinct from old.student_id)
     and not public.a4_can_view_student(new.student_id) then
    raise exception 'You can only add students from your own classes.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists check_sheets_student_guard on public.check_sheets;
create trigger check_sheets_student_guard
  before insert or update of student_id, submission_id on public.check_sheets
  for each row execute function public.a4_check_sheet_student_guard();

create or replace function public.a4_check_session_batch_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if public.a4_system_write() then
    return new;
  end if;
  if auth.uid() is not null
     and new.assignment_id is distinct from (case when tg_op = 'UPDATE' then old.assignment_id end) then
    raise exception 'Assignment checks are created by the system.' using errcode = '42501';
  end if;
  if auth.uid() is null or new.batch_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.batch_id is distinct from old.batch_id)
     and not public.a4_can_view_batch(new.batch_id) then
    raise exception 'You can only check copies for your own classes.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists check_sessions_batch_guard on public.check_sessions;
create trigger check_sessions_batch_guard
  before insert or update of batch_id, assignment_id on public.check_sessions
  for each row execute function public.a4_check_session_batch_guard();

-- per_question = what a student may see per question, derived from ai_result (v1 graded_questions shape:
-- marks_awarded / teacher_marks / counted / feedback / confidence). Teacher notes are NOT copied.
create or replace function public.a4_project_per_question(p_result jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'q_no',          g ->> 'q_no',
           'max_marks',     (g ->> 'max_marks')::numeric,
           'marks',         coalesce((g ->> 'teacher_marks')::numeric, (g ->> 'marks_awarded')::numeric, 0),
           'counted',       coalesce((g ->> 'counted')::boolean, true),
           'not_attempted', coalesce((g ->> 'not_attempted')::boolean, false),
           'feedback',      g ->> 'feedback',
           'confidence',    g ->> 'confidence') order by o), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_result -> 'graded_questions', '[]'::jsonb)) with ordinality as t(g, o)
$$;

create or replace function public.a4_check_sheet_derive()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.ai_result is not null and jsonb_typeof(new.ai_result -> 'graded_questions') = 'array' then
    new.per_question := public.a4_project_per_question(new.ai_result);
  end if;
  return new;
end;
$$;
drop trigger if exists check_sheets_derive on public.check_sheets;
create trigger check_sheets_derive
  before insert or update of ai_result on public.check_sheets
  for each row execute function public.a4_check_sheet_derive();

-- ════════════════════════════════════════════════════════════════════
-- 5. check_jobs (checker-v4 G2 queue; docs: checker-v4-design.md §3, columns renamed per this flow's spec:
--    status → state, attempts → retries, run_after → next_run_at, last_error → error)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.check_jobs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'check' check (kind in ('check', 'export_zip', 'retention')),
  teacher_id      uuid references auth.users(id) on delete cascade,            -- null only for retention
  institute_id    uuid references public.institutes(id) on delete set null,
  session_id      uuid references public.check_sessions(id) on delete cascade,
  sheet_id        uuid references public.check_sheets(id) on delete cascade,
  submission_id   uuid references public.submissions(id) on delete cascade,   -- portal attempts only
  state           text not null default 'queued'
                  check (state in ('queued', 'running', 'done', 'failed', 'blocked_quota', 'cancelled', 'paused')),
  retries         int  not null default 0,          -- runs started so far (claim adds 1)
  max_retries     int  not null default 3 check (max_retries between 1 and 10),
  next_run_at     timestamptz not null default now(),
  locked_at       timestamptz,
  finished_at     timestamptz,
  stage           text check (stage in ('A', 'B', 'C', 'D', 'E')),
  checkpoint      jsonb,
  idempotency_key text unique,
  last_error_code text check (last_error_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'BAD_FILE', 'QUOTA',
                  'BUDGET', 'SCHEMA', 'CALL_CAP', 'PAUSED', 'FILES_EXPIRED', 'KEY_MISSING', 'UNKNOWN')),
  error           text,                             -- teacher-safe message only
  usage           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint check_jobs_kind_refs check (
       (kind = 'check'      and teacher_id is not null and session_id is not null and sheet_id is not null)
    or (kind = 'export_zip' and teacher_id is not null and session_id is not null)
    or (kind = 'retention'  and teacher_id is null and session_id is null and sheet_id is null and submission_id is null))
);
create index if not exists check_jobs_state_next_idx  on public.check_jobs (state, next_run_at);
create index if not exists check_jobs_running_idx     on public.check_jobs (locked_at) where state = 'running';
create index if not exists check_jobs_sheet_idx       on public.check_jobs (sheet_id);
create index if not exists check_jobs_submission_idx  on public.check_jobs (submission_id);

alter table public.check_jobs enable row level security;
drop policy if exists check_jobs_staff_read on public.check_jobs;
create policy check_jobs_staff_read on public.check_jobs for select to authenticated
  using (teacher_id = auth.uid()
      or institute_id in (select public.a4_my_admin_inst_ids())
      or exists (select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id
                  where s.id = check_jobs.submission_id
                    and a.batch_id in (select public.a4_my_visible_batch_ids())));
revoke all on public.check_jobs from anon, authenticated;
grant select on public.check_jobs to authenticated;
grant all on public.check_jobs to service_role;

-- ════════════════════════════════════════════════════════════════════
-- 6. Wrong access-code attempts (service side only). Correct codes are never logged. The code itself is never
--    stored, only its SHA-256.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.access_code_attempts (
  id        bigserial primary key,
  ip_hash   text        not null,
  code_hash text        not null,
  ts        timestamptz not null default now()
);
create index if not exists access_code_attempts_ip_ts_idx   on public.access_code_attempts (ip_hash, ts desc);
create index if not exists access_code_attempts_code_ts_idx on public.access_code_attempts (code_hash, ts desc);
alter table public.access_code_attempts enable row level security;   -- no policies
revoke all on public.access_code_attempts from anon, authenticated;
revoke all on sequence public.access_code_attempts_id_seq from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 7. Internal helpers (not callable by anon / authenticated)
-- ════════════════════════════════════════════════════════════════════

-- Client IP from the headers PostgREST passes on (request.headers), hashed. p_fallback (a 64-hex hash) is used
-- only when there is no header at all (SQL editor, tests).
create or replace function public.a4_request_ip_hash(p_fallback text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  h  jsonb;
  ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    h := null;
  end;
  ip := coalesce(nullif(trim(h ->> 'cf-connecting-ip'), ''),
                 nullif(trim(h ->> 'x-real-ip'), ''),
                 nullif(trim(split_part(h ->> 'x-forwarded-for', ',', 1)), ''));
  if ip is not null then
    return encode(sha256(convert_to('a4ip:' || ip, 'UTF8')), 'hex');
  end if;
  if p_fallback ~ '^[0-9a-f]{64}$' then
    return p_fallback;
  end if;
  return 'no-ip';
end $$;

-- Access-code gate shared by every student RPC. Only WRONG codes count (a whole class behind one school-WiFi IP
-- typing correct codes is never limited):
--   per IP:   20 wrong within 10 min → that IP is locked for 15 min after the 20th
--   per code: the same wrong code 10 times within 10 min (any IPs) → that code is locked for 15 min
-- While locked, nothing from that IP / for that code is checked — a correct code is refused too, otherwise the
-- answer would still tell a guesser which code is right.
-- Returns {state: ok, student_id} | {state: invalid_code} | {state: locked, scope: ip|code, retry_after_sec}
create or replace function public.a4_code_gate(p_code text, p_ip_hash text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c_ip_max      constant int := 20;
  c_code_max    constant int := 10;
  c_window      constant interval := interval '10 minutes';
  c_lock        constant interval := interval '15 minutes';
  v_ip          text := public.a4_request_ip_hash(p_ip_hash);
  v_code        text := upper(trim(coalesce(p_code, '')));
  v_code_hash   text := encode(sha256(convert_to('a4code:' || upper(trim(coalesce(p_code, ''))), 'UTF8')), 'hex');
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

-- Same audience as the submissions sub_grade policy (02): institute admin, or staff who see the batch.
create or replace function public.a4_can_grade_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from assignments a
     where a.id = p_assignment_id
       and (a.institute_id in (select public.a4_my_admin_inst_ids())
            or a.batch_id in (select public.a4_my_visible_batch_ids())))
$$;

-- Retry delay after the n-th run: 30 s, 60 s, 120 s, … max 10 min
create or replace function public.a4_job_backoff(p_retries int)
returns interval language sql immutable as $$
  select make_interval(secs => least(30 * power(2, greatest(coalesce(p_retries, 1), 1) - 1), 600))
$$;

-- Audit row in smart_assignment_checks (the existing checker history; backend override rows use the same table).
-- result_json.type: 'teacher_override' | 'publish' | 'auto_publish' | 'unpublish'
create or replace function public.a4_mark_event(p_sheet_id uuid, p_by uuid, p_type text, p_total numeric,
                                                p_remarks text, p_details jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  sh  check_sheets%rowtype;
  ss  check_sessions%rowtype;
  v_max numeric;
begin
  select * into sh from check_sheets where id = p_sheet_id;
  select * into ss from check_sessions where id = sh.session_id;
  v_max := coalesce(sh.max_marks, 0);
  insert into smart_assignment_checks (
    id, teacher_id, check_sheet_id, assignment_id, submission_id, student_name, student_roll, student_class,
    class_grade, subject, is_valid, total_obtained, max_marks, percentage, needs_review_count, strictness,
    overall_remarks, result_json)
  values (
    gen_random_uuid(), coalesce(p_by, sh.teacher_id), sh.id, ss.assignment_id, sh.submission_id,
    sh.student_name, sh.roll_no, ss.class_grade, ss.class_grade, left(coalesce(ss.subject, ss.title), 100),
    true, coalesce(p_total, 0), v_max,
    case when v_max > 0 then round(coalesce(p_total, 0) / v_max * 100, 1) else 0 end,
    coalesce((sh.ai_result ->> 'needs_review_count')::int, 0), coalesce(ss.strictness, 'medium'),
    left(p_remarks, 500),
    jsonb_build_object('type', p_type, 'by', p_by) || coalesce(p_details, '{}'::jsonb));
end $$;

-- Re-decides which OR-alternatives count and the total with teacher overrides. Same rule as the backend's
-- copy_checker_router._apply_overrides: per or_group keep the best `attempt_count` (rubric, default 1) by
-- effective marks (teacher's if set, else AI's), ties by position; total capped at max_marks.
create or replace function public.a4_apply_overrides(p_result jsonb, p_rubric jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v_graded jsonb;
  v_total  numeric;
  v_max    numeric := coalesce((p_result ->> 'max_marks')::numeric, 0);
  v_over   int;
begin
  with q as (
    select g, o,
           coalesce((g ->> 'teacher_marks')::numeric, (g ->> 'marks_awarded')::numeric, 0) as eff,
           nullif(g ->> 'or_group', '') as grp
      from jsonb_array_elements(coalesce(p_result -> 'graded_questions', '[]'::jsonb)) with ordinality as t(g, o)),
  att as (
    select distinct on (x ->> 'q_no') x ->> 'q_no' as q_no,
           coalesce(nullif(x ->> 'attempt_count', '')::numeric::int, 0) as n
      from jsonb_array_elements(coalesce(p_rubric -> 'questions', '[]'::jsonb)) as x
     order by x ->> 'q_no'),
  grp as (
    select distinct on (q.grp) q.grp, coalesce(nullif(att.n, 0), 1) as need
      from q left join att on att.q_no = q.g ->> 'q_no'
     where q.grp is not null
     order by q.grp, q.o),
  ranked as (
    select q.g, q.o, q.eff,
           q.grp is null
           or row_number() over (partition by q.grp order by q.eff desc, q.o) <= (select need from grp where grp.grp = q.grp)
             as counted
      from q)
  select coalesce(jsonb_agg(g || jsonb_build_object('counted', counted) order by o), '[]'::jsonb),
         coalesce(sum(eff) filter (where counted), 0),
         count(*) filter (where g ->> 'teacher_marks' is not null)
    into v_graded, v_total, v_over
    from ranked;

  v_total := round(case when v_max > 0 then least(v_total, v_max) else v_total end, 2);
  return p_result || jsonb_build_object('graded_questions', v_graded, 'teacher_total', v_total,
                                        'overridden_questions', v_over);
end $$;

-- What a student (p_with_result) or the RPC caller sees of one attempt.
create or replace function public.a4_submission_json(p_submission_id uuid, p_with_result boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s  submissions%rowtype;
  sh check_sheets%rowtype;
  v_result jsonb;
begin
  select * into s from submissions where id = p_submission_id;
  if not found then
    return null;
  end if;
  if p_with_result and s.status = 'published' then
    select * into sh from check_sheets where submission_id = s.id and published;
    if found then
      v_result := jsonb_build_object(
        'marks',        sh.final_marks,
        'max_marks',    sh.max_marks,
        'percentage',   case when coalesce(sh.max_marks, 0) > 0 then round(sh.final_marks / sh.max_marks * 100, 1) end,
        'per_question', coalesce(sh.per_question, '[]'::jsonb),
        'feedback',     s.feedback,
        'published_at', sh.published_at);
    end if;
  end if;
  return jsonb_build_object(
    'id',             s.id,
    'attempt_no',     s.attempt_no,
    'label',          'Upload-' || s.attempt_no,
    'status',         s.status,
    'is_late',        s.is_late,
    'submitted_at',   s.submitted_at,
    'files',          coalesce((select jsonb_agg(jsonb_build_object('page_order', f -> 'page_order', 'mime', f -> 'mime',
                                                                     'size', f -> 'size')
                                                 order by (f ->> 'page_order')::int)
                                  from jsonb_array_elements(s.files) f), '[]'::jsonb),
    'reject_reasons', s.reject_reasons,
    'result',         v_result);
end $$;

-- Kick the backend worker (pg_net + vault). Silently a no-op when pg_net / vault / the secrets are missing:
-- the cron sweep (if enabled) or the next kick picks the job up.
create or replace function public.a4_checker_kick()
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute $q$select (select decrypted_secret from vault.decrypted_secrets where name = 'checker_job_run_url'),
                    (select decrypted_secret from vault.decrypted_secrets where name = 'checker_job_secret')$q$
     into v_url, v_secret;
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 2000)'
    using v_url, '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'X-Job-Secret', v_secret);
end $$;

-- Attempt → check_sheets row (+ per-assignment check_sessions row) → check_jobs row.
-- No answer key yet → submission waits (status waiting_key); the key trigger below calls this again.
create or replace function public.a4_enqueue_submission(p_submission_id uuid)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  s        submissions%rowtype;
  a        assignments%rowtype;
  st       students%rowtype;
  v_key    int;
  v_class  text;
  v_session uuid;
  v_sheet  uuid;
  v_job    uuid;
  v_state  text;
begin
  select * into s from submissions where id = p_submission_id for update;
  select * into a from assignments where id = s.assignment_id;
  select * into st from students where id = s.student_id;
  select version into v_key from assignment_ai_keys where assignment_id = a.id;

  if v_key is null then
    update submissions set status = 'waiting_key', answer_key_version = null where id = s.id;
    return null;
  end if;

  perform set_config('a4.system_write', 'on', true);

  select id into v_session from check_sessions where assignment_id = a.id;
  if v_session is null then
    select class_level into v_class from batches where id = a.batch_id;
    insert into check_sessions (teacher_id, title, source, batch_id, class_grade, assignment_id)
    values (a.created_by, left(coalesce(nullif(trim(a.title), ''), 'Assignment'), 200), 'assignment',
            a.batch_id, v_class, a.id)
    on conflict (assignment_id) where assignment_id is not null do nothing
    returning id into v_session;
    if v_session is null then
      select id into v_session from check_sessions where assignment_id = a.id;
    end if;
  end if;

  insert into check_sheets (session_id, teacher_id, student_id, student_name, roll_no, pages, status,
                            submission_id, source_bucket)
  values (v_session, a.created_by, st.id, left(coalesce(nullif(trim(st.name), ''), 'Student'), 120), st.roll_no,
          array(select f ->> 'storage_path' from jsonb_array_elements(s.files) f
                 order by (f ->> 'page_order')::int),
          'uploaded', s.id, 'submissions')
  on conflict (submission_id) where submission_id is not null
  do update set pages = excluded.pages, updated_at = now()
  returning id into v_sheet;

  insert into check_jobs (kind, teacher_id, institute_id, session_id, sheet_id, submission_id, idempotency_key)
  values ('check', a.created_by, a.institute_id, v_session, v_sheet, s.id, 'check:' || v_sheet || ':k' || v_key)
  on conflict (idempotency_key) do update
     set state = 'queued', retries = 0, next_run_at = now(), locked_at = null, finished_at = null,
         last_error_code = null, error = null, updated_at = now()
   where check_jobs.state in ('failed', 'cancelled');

  select id, state into v_job, v_state from check_jobs where idempotency_key = 'check:' || v_sheet || ':k' || v_key;
  update submissions
     set answer_key_version = v_key,
         status = case v_state when 'queued' then 'queued' when 'running' then 'checking'
                               when 'blocked_quota' then 'waiting_quota' else status end
   where id = s.id;

  perform set_config('a4.system_write', 'off', true);
  return v_job;
end $$;

-- Publish one attempt (caller has already checked rights and status).
create or replace function public.a4_publish_submission(p_submission_id uuid, p_by uuid, p_auto boolean)
returns numeric language plpgsql volatile security definer set search_path = public as $$
declare
  sh      check_sheets%rowtype;
  v_total numeric;
begin
  select * into sh from check_sheets where submission_id = p_submission_id for update;
  v_total := coalesce((sh.ai_result ->> 'teacher_total')::numeric, sh.ai_marks, 0);
  update check_sheets
     set published = true, published_at = now(), reviewed_by = p_by, status = 'approved',
         approved_at = now(), final_marks = v_total, updated_at = now()
   where id = sh.id;
  update submissions
     set status = 'published', grade = v_total, graded_at = now(), graded_by = p_by,
         feedback = coalesce(feedback, left(sh.ai_result ->> 'overall_remarks', 2000))
   where id = p_submission_id;
  perform public.a4_mark_event(sh.id, p_by, case when p_auto then 'auto_publish' else 'publish' end, v_total,
                               case when p_auto then 'Published automatically' else 'Published' end, '{}'::jsonb);
  return v_total;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 8. Triggers: key changes, job state → submission status, kick
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_answer_key_version_bump()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.answer_key_path is distinct from old.answer_key_path then
    new.version := old.version + 1;
  else
    new.version := old.version;   -- never set by hand
  end if;
  return new;
end $$;
drop trigger if exists assignment_ai_keys_version on public.assignment_ai_keys;
create trigger assignment_ai_keys_version
  before update on public.assignment_ai_keys
  for each row execute function public.a4_answer_key_version_bump();

-- New key / new key version: attempts that have not been checked yet use it; waiting attempts are queued.
-- Already checked attempts keep their version until the teacher re-grades (spec 8A).
create or replace function public.a4_answer_key_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if tg_op = 'UPDATE' and new.version = old.version then
    return null;
  end if;
  update submissions set answer_key_version = new.version
   where assignment_id = new.assignment_id and status in ('uploaded', 'queued', 'waiting_quota');
  for r in select id from submissions
            where assignment_id = new.assignment_id and status = 'waiting_key' order by created_at loop
    perform public.a4_enqueue_submission(r.id);
  end loop;
  return null;
end $$;
drop trigger if exists assignment_ai_keys_changed on public.assignment_ai_keys;
create trigger assignment_ai_keys_changed
  after insert or update on public.assignment_ai_keys
  for each row execute function public.a4_answer_key_changed();

create or replace function public.a4_check_job_state_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status  text;
  v_reasons public.a4_review_reason[];
  v_auto    boolean;
begin
  if new.kind <> 'check' or new.submission_id is null or new.state is not distinct from old.state then
    return null;
  end if;
  select status into v_status from submissions where id = new.submission_id for update;
  if v_status = 'published' then
    return null;
  end if;

  if new.state = 'running' then
    update submissions set status = 'checking' where id = new.submission_id;
  elsif new.state in ('queued', 'paused') then
    update submissions set status = 'queued' where id = new.submission_id;
  elsif new.state = 'blocked_quota' then
    update submissions set status = 'waiting_quota' where id = new.submission_id;
  elsif new.state = 'failed' and new.last_error_code = 'BAD_FILE' then
    update submissions
       set status = 'rejected',
           reject_reasons = reject_reasons || jsonb_build_array(jsonb_build_object(
             'code', 'bad_file', 'message', coalesce(new.error, 'File could not be read.'), 'at', now()))
     where id = new.submission_id;
  elsif new.state = 'failed' and new.last_error_code = 'KEY_MISSING' then
    update submissions set status = 'waiting_key' where id = new.submission_id;
  elsif new.state in ('failed', 'cancelled') then
    update submissions set status = 'failed' where id = new.submission_id;
  elsif new.state = 'done' then
    select sh.needs_review_reasons into v_reasons from check_sheets sh where sh.id = new.sheet_id;
    if cardinality(coalesce(v_reasons, '{}')) > 0 then
      update submissions set status = 'needs_review' where id = new.submission_id;
    else
      update submissions set status = 'checked' where id = new.submission_id;
      select a.auto_publish into v_auto
        from submissions s join assignments a on a.id = s.assignment_id where s.id = new.submission_id;
      if v_auto then
        perform public.a4_publish_submission(new.submission_id, null, true);
      end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists check_jobs_state_sync on public.check_jobs;
create trigger check_jobs_state_sync
  after update of state on public.check_jobs
  for each row execute function public.a4_check_job_state_sync();

-- One kick per INSERT statement (a whole class enqueued at once = 1 HTTP call), per design D5.
create or replace function public.a4_check_jobs_kick_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.a4_checker_kick();
  return null;
end $$;
drop trigger if exists check_jobs_kick on public.check_jobs;
create trigger check_jobs_kick
  after insert on public.check_jobs
  for each statement execute function public.a4_check_jobs_kick_trg();

-- ════════════════════════════════════════════════════════════════════
-- 9. Worker functions (service_role only; contract in docs/upload-flow-api.md)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_claim_check_job(p_max_running int default 10)
returns setof public.check_jobs language plpgsql volatile security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('a4_claim_check_job'));
  if (select count(*) from check_jobs where state = 'running') >= p_max_running then
    return;
  end if;
  return query
  update check_jobs
     set state = 'running', locked_at = now(), retries = retries + 1, updated_at = now()
   where id = (select id from check_jobs
                where state = 'queued' and next_run_at <= now()
                order by next_run_at, created_at
                for update skip locked
                limit 1)
  returning *;
end $$;

-- p_ok = true after the sheet's result is saved. Error codes decide retry / quota wait / final failure.
create or replace function public.a4_finish_check_job(p_job_id uuid, p_ok boolean, p_error_code text default null,
                                                      p_error text default null, p_usage jsonb default null)
returns public.check_jobs language plpgsql volatile security definer set search_path = public as $$
declare
  j      check_jobs%rowtype;
  v_code text := case when p_ok then null
                      when p_error_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'BAD_FILE', 'QUOTA', 'BUDGET',
                                            'SCHEMA', 'CALL_CAP', 'PAUSED', 'FILES_EXPIRED', 'KEY_MISSING')
                           then p_error_code
                      else 'UNKNOWN' end;
begin
  select * into j from check_jobs where id = p_job_id for update;
  if not found or j.state <> 'running' then
    raise exception 'check job % is not running', p_job_id using errcode = '55000';
  end if;

  if p_ok then
    update check_jobs set state = 'done', finished_at = now(), locked_at = null, last_error_code = null,
                          error = null, usage = coalesce(p_usage, usage), updated_at = now()
     where id = j.id returning * into j;
  elsif v_code = 'QUOTA' then          -- not the copy's fault: wait for the next IST day, doesn't use a retry
    update check_jobs set state = 'blocked_quota', locked_at = null, retries = greatest(retries - 1, 0),
                          next_run_at = ((now() at time zone 'Asia/Kolkata')::date + 1)::timestamp at time zone 'Asia/Kolkata',
                          last_error_code = v_code, error = left(p_error, 300), updated_at = now()
     where id = j.id returning * into j;
  elsif v_code in ('PAUSED', 'BUDGET') then
    update check_jobs set state = 'paused', locked_at = null, retries = greatest(retries - 1, 0),
                          last_error_code = v_code, error = left(p_error, 300), updated_at = now()
     where id = j.id returning * into j;
  elsif v_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'UNKNOWN') and j.retries < j.max_retries then
    update check_jobs set state = 'queued', locked_at = null, next_run_at = now() + public.a4_job_backoff(j.retries),
                          last_error_code = v_code, error = left(p_error, 300), usage = coalesce(p_usage, usage),
                          updated_at = now()
     where id = j.id returning * into j;
  else
    update check_jobs set state = 'failed', finished_at = now(), locked_at = null,
                          last_error_code = v_code, error = left(p_error, 300), usage = coalesce(p_usage, usage),
                          updated_at = now()
     where id = j.id returning * into j;
  end if;
  return j;
end $$;

-- Every minute (pg_cron): stuck runs (> 6 min, e.g. the 300 s function limit) → retry or fail; quota-blocked
-- jobs whose day has come → queued; anything due → one kick.
create or replace function public.a4_checker_sweep()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_requeued int;
  v_failed   int;
  v_unblocked int;
  v_due      int;
begin
  update check_jobs
     set state = 'queued', locked_at = null, next_run_at = now() + public.a4_job_backoff(retries),
         last_error_code = 'TIMEOUT', error = 'Checking took too long; retrying.', updated_at = now()
   where state = 'running' and locked_at < now() - interval '6 minutes' and retries < max_retries;
  get diagnostics v_requeued = row_count;

  update check_jobs
     set state = 'failed', finished_at = now(), locked_at = null, last_error_code = 'TIMEOUT',
         error = 'Checking took too long. Please retry.', updated_at = now()
   where state = 'running' and locked_at < now() - interval '6 minutes' and retries >= max_retries;
  get diagnostics v_failed = row_count;

  update check_jobs set state = 'queued', updated_at = now()
   where state = 'blocked_quota' and next_run_at <= now();
  get diagnostics v_unblocked = row_count;

  select count(*) into v_due from check_jobs where state = 'queued' and next_run_at <= now();
  if v_due > 0 then
    perform public.a4_checker_kick();
  end if;
  return jsonb_build_object('requeued', v_requeued, 'failed', v_failed, 'unblocked', v_unblocked, 'due', v_due);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 10. Student RPCs (anon; identity = access code, never a student_id from the client)
-- ════════════════════════════════════════════════════════════════════

-- Link page. p_ref = link_token (or the assignment id). Never returns the answer key.
-- state: not_found | inactive | not_open | closed | open | open_late. With p_code also `student`.
create or replace function public.get_assignment_link(p_ref text, p_code text default null, p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_id    uuid := case when p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_ref::uuid end;
  a       assignments%rowtype;
  v_batch text;
  v_state text;
  v_out   jsonb;
  g       jsonb;
  st      students%rowtype;
  v_used  int;
begin
  if p_ref is null or length(p_ref) > 80 then
    return jsonb_build_object('state', 'not_found');
  end if;
  select * into a from assignments where link_token = p_ref or id = v_id limit 1;
  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;
  select name into v_batch from batches where id = a.batch_id;

  v_state := case
    when a.status is distinct from 'active' then 'inactive'
    when a.opens_at is not null and now() < a.opens_at then 'not_open'
    when a.deadline is not null and now() > a.deadline + interval '2 minutes'
      then case when a.late_policy = 'reject' then 'closed' else 'open_late' end
    else 'open' end;

  if v_state = 'inactive' then
    return jsonb_build_object('state', v_state, 'title', a.title);
  end if;

  v_out := jsonb_build_object(
    'state', v_state,
    'server_time', now(),
    'assignment', jsonb_build_object(
      'id', a.id, 'title', a.title, 'instructions', a.description, 'batch_name', v_batch,
      'opens_at', a.opens_at, 'closes_at', a.deadline, 'grace_minutes', 2,
      'late_policy', a.late_policy, 'count_policy', a.count_policy, 'max_attempts', a.max_attempts,
      'allowed_mimes', to_jsonb(a.allowed_mimes), 'max_mb', a.max_mb, 'max_pages', a.max_pages,
      'max_marks', a.max_marks));

  if p_code is null then
    return v_out;
  end if;

  g := public.a4_code_gate(p_code, p_ip_hash);
  if g ->> 'state' <> 'ok' then
    return v_out || jsonb_build_object('student', g);
  end if;
  select * into st from students where id = (g ->> 'student_id')::uuid;
  if st.institute_id <> a.institute_id
     or not coalesce(a.batch_id = st.batch_id or a.batch_id = st.lab_batch_id, false) then
    return v_out || jsonb_build_object('student', jsonb_build_object('state', 'not_in_class'));
  end if;
  select count(*) filter (where coalesce(status, '') <> 'rejected') into v_used
    from submissions where assignment_id = a.id and student_id = st.id;
  return v_out || jsonb_build_object(
    'student', jsonb_build_object('state', 'ok', 'name', st.name, 'attempts_used', v_used,
                                  'attempts_left', greatest(a.max_attempts - v_used, 0)),
    'question_paper', case when a.file_url is not null
                           then jsonb_build_object('file_url', a.file_url, 'file_name', a.file_name) end);
end $$;

-- "Ye aap hi ho?" step: name / class / masked email for a code. A wrong code counts toward the lockout.
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
   where student_id = (g ->> 'student_id')::uuid and access_code = upper(trim(p_code));
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

-- One upload attempt. Files are already in Storage (bucket "submissions", path
-- <institute>/<assignment>/<student>/<uuid>.<ext>); p_files = [{storage_path, mime, size, sha256, page_order}].
-- Same p_idempotency_key again → the same attempt (state 'replayed'), never a second row.
create or replace function public.create_submission(p_code text, p_assignment_id uuid, p_idempotency_key text,
                                                    p_files jsonb, p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g          jsonb;
  v_student  uuid;
  a          assignments%rowtype;
  st         students%rowtype;
  v_sub      submissions%rowtype;
  v_late     boolean := false;
  v_recent   int;
  v_oldest   timestamptz;
  v_used     int;
  v_last     int;
  v_prefix   text;
  v_max_b    bigint;
  v_n        int;
  f          jsonb;
  i          int := 0;
  v_path     text;
  v_mime     text;
  v_size     bigint;
  v_sha      text;
  v_order    int;
  v_meta     jsonb;
  v_exp_ext  text;
  v_paths    text[] := '{}';
  v_orders   int[] := '{}';
  v_errors   jsonb := '[]'::jsonb;
  v_files    jsonb := '[]'::jsonb;
  v_warn     jsonb := '[]'::jsonb;
  v_dup_att  int;
  v_dup_other boolean;
  v_constraint text;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    return jsonb_build_object('state', 'invalid_request',
                              'message', 'idempotency_key: 16-128 characters, A-Z a-z 0-9 _ -');
  end if;

  g := public.a4_code_gate(p_code, p_ip_hash);
  if g ->> 'state' <> 'ok' then
    return g;
  end if;
  v_student := (g ->> 'student_id')::uuid;

  -- all attempts of one student on one assignment go one at a time (first attempt has no row to lock)
  perform pg_advisory_xact_lock(hashtext(p_assignment_id::text || v_student::text));

  select * into v_sub from submissions where idempotency_key = p_idempotency_key;
  if found then
    if v_sub.student_id = v_student and v_sub.assignment_id = p_assignment_id then
      return jsonb_build_object('state', 'replayed', 'submission', public.a4_submission_json(v_sub.id, false));
    end if;
    return jsonb_build_object('state', 'invalid_request', 'message', 'idempotency_key already used');
  end if;

  select * into st from students where id = v_student;
  select * into a from assignments where id = p_assignment_id;
  if not found or a.institute_id <> st.institute_id
     or not coalesce(a.batch_id = st.batch_id or a.batch_id = st.lab_batch_id, false) then
    return jsonb_build_object('state', 'not_found');
  end if;

  -- window: server clock only, 2 minutes grace
  if a.status is distinct from 'active' then
    return jsonb_build_object('state', 'inactive');
  end if;
  if a.opens_at is not null and now() < a.opens_at then
    return jsonb_build_object('state', 'not_open', 'opens_at', a.opens_at);
  end if;
  if a.deadline is not null and now() > a.deadline + interval '2 minutes' then
    if a.late_policy = 'reject' then
      return jsonb_build_object('state', 'closed', 'closes_at', a.deadline);
    end if;
    v_late := true;
  end if;

  -- 3 submits / minute / student / assignment
  select count(*), min(created_at) into v_recent, v_oldest
    from submissions
   where assignment_id = a.id and student_id = v_student and created_at > now() - interval '60 seconds';
  if v_recent >= 3 then
    return jsonb_build_object('state', 'too_many_requests',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '60 seconds' - now())))::int));
  end if;

  -- attempts: a rejected upload (unreadable file) does not use up an attempt
  select count(*) filter (where coalesce(status, '') <> 'rejected'), coalesce(max(attempt_no), 0)
    into v_used, v_last
    from submissions where assignment_id = a.id and student_id = v_student;
  if v_used >= a.max_attempts then
    return jsonb_build_object('state', 'max_attempts', 'max_attempts', a.max_attempts, 'attempts_used', v_used);
  end if;

  -- files
  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then
    return jsonb_build_object('state', 'invalid_files', 'errors', jsonb_build_array(jsonb_build_object(
      'code', 'no_files', 'message', 'Kam se kam ek file upload karo.')));
  end if;
  v_n := jsonb_array_length(p_files);
  if v_n > a.max_pages then
    return jsonb_build_object('state', 'invalid_files', 'errors', jsonb_build_array(jsonb_build_object(
      'code', 'too_many_files',
      'message', format('Is test me max %s pages/files allowed hain, aapne %s bheje.', a.max_pages, v_n))));
  end if;

  v_prefix := a.institute_id || '/' || a.id || '/' || v_student || '/';
  v_max_b := a.max_mb::bigint * 1048576;

  for f in select value from jsonb_array_elements(p_files) loop
    i := i + 1;
    if jsonb_typeof(f) <> 'object' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_entry', 'message', format('File %s: galat data.', i));
      continue;
    end if;
    v_path := f ->> 'storage_path';
    v_mime := lower(f ->> 'mime');
    v_sha  := lower(f ->> 'sha256');
    begin
      v_size  := (f ->> 'size')::bigint;
      v_order := (f ->> 'page_order')::int;
    exception when others then
      v_size := null; v_order := null;
    end;

    if v_path is null or left(v_path, length(v_prefix)) <> v_prefix
       or substr(v_path, length(v_prefix) + 1) !~ '^[0-9a-fA-F-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_path',
        'message', format('File %s galat jagah upload hui. Page reload karke dobara upload karo.', i));
      continue;
    end if;
    if v_path = any(v_paths) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'duplicate_file',
        'message', format('File %s list me do baar hai.', i));
      continue;
    end if;
    v_paths := v_paths || v_path;
    if v_order is null or v_order < 1 or v_order > v_n or v_order = any(v_orders) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_page_order',
        'message', format('File %s: page number 1 se %s ke beech, har page ka alag hona chahiye.', i, v_n));
      continue;
    end if;
    v_orders := v_orders || v_order;

    v_exp_ext := case v_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpe?g'
                             when 'image/png' then 'png' when 'image/webp' then 'webp'
                             when 'image/heic' then 'heic' end;
    if v_mime is null or not (v_mime = any(a.allowed_mimes)) or v_exp_ext is null
       or v_path !~* ('\.' || v_exp_ext || '$') then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_format',
        'message', format('Page %s ka format (%s) allowed nahi hai. Allowed: %s.', v_order, coalesce(v_mime, '?'),
                          array_to_string(a.allowed_mimes, ', ')));
      continue;
    end if;
    if v_sha is null or v_sha !~ '^[0-9a-f]{64}$' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_sha256',
        'message', format('Page %s: checksum missing. Page reload karke dobara try karo.', v_order));
      continue;
    end if;

    select o.metadata into v_meta from storage.objects o where o.bucket_id = 'submissions' and o.name = v_path;
    if not found then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'not_uploaded',
        'message', format('Page %s abhi upload nahi hua. Dobara upload karo.', v_order));
      continue;
    end if;
    -- Storage's own record wins over what the browser says
    v_size := coalesce((v_meta ->> 'size')::bigint, v_size);
    if v_meta ->> 'mimetype' is not null and lower(v_meta ->> 'mimetype') <> v_mime then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_format',
        'message', format('Page %s ka format file se match nahi karta.', v_order));
      continue;
    end if;
    if v_size is null or v_size <= 0 then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'empty_file',
        'message', format('Page %s ki file khaali hai.', v_order));
      continue;
    end if;
    if v_size > v_max_b then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'too_large',
        'message', format('Page %s bahut badi hai (%s MB). Max %s MB.', v_order, round(v_size / 1048576.0, 1), a.max_mb));
      continue;
    end if;
    if exists (select 1 from submissions s
                where s.assignment_id = a.id and s.student_id = v_student
                  and s.files @> jsonb_build_array(jsonb_build_object('storage_path', v_path))) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'file_reused',
        'message', format('Page %s pichle upload me already bheja gaya tha. Nayi file upload karo.', v_order));
      continue;
    end if;

    -- same bytes as before: warn the student about their own earlier upload; flag (teacher-only) another student's
    select min(s.attempt_no) into v_dup_att
      from submissions s, jsonb_array_elements(s.files) e
     where s.assignment_id = a.id and s.student_id = v_student and e ->> 'sha256' = v_sha;
    if v_dup_att is not null then
      v_warn := v_warn || jsonb_build_object('code', 'same_as_earlier_upload', 'page_order', v_order,
        'message', format('Page %s wahi file hai jo Upload-%s me bheji thi.', v_order, v_dup_att));
    end if;
    v_dup_other := exists (select 1 from submissions s, jsonb_array_elements(s.files) e
                            where s.assignment_id = a.id and s.student_id <> v_student and e ->> 'sha256' = v_sha);

    v_files := v_files || jsonb_build_array(jsonb_build_object(
      'storage_path', v_path, 'mime', v_mime, 'size', v_size, 'sha256', v_sha, 'page_order', v_order)
      || case when v_dup_other then jsonb_build_object('dup_other_student', true) else '{}'::jsonb end);
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('state', 'invalid_files', 'errors', v_errors);
  end if;
  select jsonb_agg(x order by (x ->> 'page_order')::int) into v_files from jsonb_array_elements(v_files) x;

  -- attempt_no assigned here, under the lock. The unique index is the last safety net: on a clash retry once.
  for k in 1..2 loop
    begin
      insert into submissions (assignment_id, student_id, attempt_no, idempotency_key, status, is_late, files,
                               file_name, submitted_at, created_at)
      values (a.id, v_student, v_last + 1, p_idempotency_key, 'uploaded', v_late, v_files,
              'Upload-' || (v_last + 1), now(), now())
      returning * into v_sub;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'submissions_attempt_uq' and k = 1 then
        select coalesce(max(attempt_no), 0) into v_last
          from submissions where assignment_id = a.id and student_id = v_student;
        continue;
      end if;
      select * into v_sub from submissions where idempotency_key = p_idempotency_key;
      if found and v_sub.student_id = v_student and v_sub.assignment_id = a.id then
        return jsonb_build_object('state', 'replayed', 'submission', public.a4_submission_json(v_sub.id, false));
      end if;
      return jsonb_build_object('state', 'conflict', 'message', 'Dobara try karo.');
    end;
  end loop;

  perform public.a4_enqueue_submission(v_sub.id);

  return jsonb_build_object(
    'state', 'created',
    'submission', public.a4_submission_json(v_sub.id, false),
    'warnings', v_warn,
    'attempts_left', greatest(a.max_attempts - v_used - 1, 0));
end $$;

-- History for the link page: every attempt ("Upload-N"), its files and status; marks only once published.
create or replace function public.my_submissions(p_code text, p_assignment_id uuid, p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g         jsonb := public.a4_code_gate(p_code, p_ip_hash);
  v_student uuid;
  a         assignments%rowtype;
  st        students%rowtype;
  v_used    int;
  v_counted uuid;
  v_list    jsonb;
begin
  if g ->> 'state' <> 'ok' then
    return g;
  end if;
  v_student := (g ->> 'student_id')::uuid;
  select * into st from students where id = v_student;
  select * into a from assignments where id = p_assignment_id;
  if not found or a.institute_id <> st.institute_id
     or not coalesce(a.batch_id = st.batch_id or a.batch_id = st.lab_batch_id, false) then
    return jsonb_build_object('state', 'not_found');
  end if;

  select count(*) filter (where coalesce(status, '') <> 'rejected') into v_used
    from submissions where assignment_id = a.id and student_id = v_student;

  -- which attempt counts: latest = newest not-rejected; best = highest published marks (else latest)
  if a.count_policy = 'best' then
    select s.id into v_counted
      from submissions s join check_sheets sh on sh.submission_id = s.id and sh.published
     where s.assignment_id = a.id and s.student_id = v_student and s.status = 'published'
     order by sh.final_marks desc nulls last, s.attempt_no desc limit 1;
  end if;
  if v_counted is null then
    select id into v_counted from submissions
     where assignment_id = a.id and student_id = v_student and coalesce(status, '') <> 'rejected'
     order by attempt_no desc limit 1;
  end if;

  select coalesce(jsonb_agg(public.a4_submission_json(s.id, true) || jsonb_build_object('counts', s.id = v_counted)
                            order by s.attempt_no desc), '[]'::jsonb)
    into v_list
    from submissions s where s.assignment_id = a.id and s.student_id = v_student;

  return jsonb_build_object(
    'state', 'ok',
    'assignment', jsonb_build_object('id', a.id, 'title', a.title, 'max_attempts', a.max_attempts,
                                     'count_policy', a.count_policy),
    'attempts_used', v_used,
    'attempts_left', greatest(a.max_attempts - v_used, 0),
    'attempts', v_list);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 11. Teacher RPCs (authenticated; same audience as submissions.sub_grade)
-- ════════════════════════════════════════════════════════════════════

-- Pass p_assignment_id (all its attempts) OR p_submission_ids. Attempts still in the pipeline are blocked,
-- the rest are published. Returns {state, published[], blocked[{id,status}], skipped[{id,status,reason}]}.
create or replace function public.publish_results(p_assignment_id uuid default null, p_submission_ids uuid[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r           record;
  v_published jsonb := '[]'::jsonb;
  v_blocked   jsonb := '[]'::jsonb;
  v_skipped   jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  if (p_assignment_id is null) = (p_submission_ids is null) then
    return jsonb_build_object('state', 'invalid_request', 'message', 'Pass p_assignment_id or p_submission_ids');
  end if;
  if p_assignment_id is not null and not public.a4_can_grade_assignment(p_assignment_id) then
    return jsonb_build_object('state', 'forbidden');
  end if;

  for r in select s.id, s.status, s.assignment_id from submissions s
            where (p_assignment_id is not null and s.assignment_id = p_assignment_id)
               or (p_submission_ids is not null and s.id = any(p_submission_ids))
            order by s.id
            for update of s loop
    if not public.a4_can_grade_assignment(r.assignment_id) then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', null, 'reason', 'forbidden');
    elsif r.status in ('uploaded', 'queued', 'checking', 'waiting_key', 'waiting_quota') then
      v_blocked := v_blocked || jsonb_build_object('id', r.id, 'status', r.status);
    elsif r.status in ('checked', 'needs_review')
          and exists (select 1 from check_sheets where submission_id = r.id) then
      perform public.a4_publish_submission(r.id, auth.uid(), false);
      v_published := v_published || to_jsonb(r.id);
    else
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', r.status,
        'reason', case when r.status = 'published' then 'already_published' else 'not_checked' end);
    end if;
  end loop;

  -- ids the caller can't see are reported like forbidden ones (no existence leak)
  if p_submission_ids is not null then
    select v_skipped || coalesce(jsonb_agg(jsonb_build_object('id', x, 'status', null, 'reason', 'forbidden')), '[]'::jsonb)
      into v_skipped
      from unnest(p_submission_ids) x where not exists (select 1 from submissions s where s.id = x);
  end if;

  return jsonb_build_object('state', 'ok', 'published', v_published, 'blocked', v_blocked, 'skipped', v_skipped);
end $$;

create or replace function public.unpublish_results(p_submission_ids uuid[], p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r       record;
  sh      check_sheets%rowtype;
  v_done  jsonb := '[]'::jsonb;
  v_skip  jsonb := '[]'::jsonb;
  v_reason text := nullif(trim(p_reason), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    return jsonb_build_object('state', 'invalid_request', 'message', 'Reason required (3-500 characters)');
  end if;
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 then
    return jsonb_build_object('state', 'invalid_request', 'message', 'Pass p_submission_ids');
  end if;

  for r in select s.id, s.status, s.assignment_id, s.grade from submissions s
            where s.id = any(p_submission_ids) order by s.id for update of s loop
    if not public.a4_can_grade_assignment(r.assignment_id) then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'reason', 'forbidden');
      continue;
    end if;
    select * into sh from check_sheets where submission_id = r.id for update;
    if not found or coalesce(r.status, '') <> 'published' or not sh.published then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'reason', 'not_published');
      continue;
    end if;
    update check_sheets set published = false, published_at = null, status = 'checked', approved_at = null,
                            updated_at = now()
     where id = sh.id;
    update submissions
       set status = case when cardinality(sh.needs_review_reasons) > 0 then 'needs_review' else 'checked' end,
           grade = null, graded_at = null, graded_by = null
     where id = r.id;
    perform public.a4_mark_event(sh.id, auth.uid(), 'unpublish', r.grade, 'Unpublished: ' || v_reason,
                                 jsonb_build_object('reason', v_reason, 'previous_marks', r.grade));
    v_done := v_done || to_jsonb(r.id);
  end loop;
  return jsonb_build_object('state', 'ok', 'unpublished', v_done, 'skipped', v_skip);
end $$;

-- One question's marks. The AI's marks stay in ai_result (marks_awarded); the change + before/after go to
-- smart_assignment_checks (type teacher_override, same shape as the backend's PATCH …/questions/{q}/marks).
-- Published attempt → the student sees the new total at once.
create or replace function public.override_marks(p_submission_id uuid, p_q_no text, p_marks numeric,
                                                 p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s          submissions%rowtype;
  sh         check_sheets%rowtype;
  v_rubric   jsonb;
  v_q        jsonb;
  v_idx      int;
  v_max_q    numeric;
  v_new      numeric;
  v_note     text := nullif(trim(p_note), '');
  v_before_q numeric;
  v_before_t numeric;
  v_result   jsonb;
  v_total    numeric;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  select * into s from submissions where id = p_submission_id for update;
  if not found or not public.a4_can_grade_assignment(s.assignment_id) then
    return jsonb_build_object('state', 'forbidden');
  end if;
  select * into sh from check_sheets where submission_id = s.id for update;
  if not found or sh.status not in ('checked', 'approved')
     or jsonb_typeof(sh.ai_result -> 'graded_questions') <> 'array' then
    return jsonb_build_object('state', 'not_checked', 'message', 'This copy has no AI result to change yet.');
  end if;
  if p_marks is null or p_marks < 0 or p_marks > 1000 or p_q_no is null or length(p_q_no) > 20
     or length(coalesce(v_note, '')) > 500 then
    return jsonb_build_object('state', 'invalid_request');
  end if;

  select g, (o - 1)::int into v_q, v_idx
    from jsonb_array_elements(sh.ai_result -> 'graded_questions') with ordinality as t(g, o)
   where g ->> 'q_no' = p_q_no limit 1;
  if v_q is null then
    return jsonb_build_object('state', 'question_not_found', 'message', format('Question %s is not in this copy''s result.', p_q_no));
  end if;
  v_max_q := coalesce((v_q ->> 'max_marks')::numeric, 0);
  v_new := round(p_marks, 2);
  if v_new > v_max_q then
    return jsonb_build_object('state', 'invalid_request', 'message', format('Q%s is out of %s marks.', p_q_no, v_max_q));
  end if;

  select rubric into v_rubric from check_sessions where id = sh.session_id;
  v_before_q := coalesce((v_q ->> 'teacher_marks')::numeric, (v_q ->> 'marks_awarded')::numeric, 0);
  v_before_t := (public.a4_apply_overrides(sh.ai_result, v_rubric) ->> 'teacher_total')::numeric;

  if abs(v_new - coalesce((v_q ->> 'marks_awarded')::numeric, 0)) < 1e-9 and v_note is null then
    v_q := v_q - 'teacher_marks' - 'teacher_note' - 'overridden_at';          -- back to the AI's marks
  else
    v_q := v_q || jsonb_build_object('teacher_marks', v_new, 'teacher_note', v_note, 'overridden_at', now());
  end if;
  v_result := public.a4_apply_overrides(jsonb_set(sh.ai_result, array['graded_questions', v_idx::text], v_q), v_rubric);
  v_total := (v_result ->> 'teacher_total')::numeric;

  update check_sheets
     set ai_result = v_result, updated_at = now(),
         final_marks = case when status = 'approved' then v_total else final_marks end
   where id = sh.id;
  if s.status = 'published' then
    update submissions set grade = v_total, graded_at = now(), graded_by = auth.uid() where id = s.id;
  end if;

  perform public.a4_mark_event(sh.id, auth.uid(), 'teacher_override', v_total,
    format('Teacher changed Q%s: %s → %s', p_q_no, v_before_q, v_new),
    jsonb_build_object('q_no', p_q_no, 'ai_marks', v_q -> 'marks_awarded', 'previous_marks', v_before_q,
                       'new_marks', v_new, 'max_marks', v_max_q, 'teacher_note', v_note,
                       'sheet_total_before', v_before_t, 'sheet_total_after', v_total,
                       'published', s.status = 'published'));

  return jsonb_build_object('state', 'ok', 'total', v_total, 'published', s.status = 'published',
                            'question', v_q || jsonb_build_object('counted',
                              (select g -> 'counted' from jsonb_array_elements(v_result -> 'graded_questions') g
                                where g ->> 'q_no' = p_q_no limit 1)));
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 12. Old portal submit: refuse attempts made through the upload link (it would overwrite them)
--     Body = 05_student_portal.sql + the one check marked NEW.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.submit_assignment(
  p_code text,
  p_assignment_id uuid,
  p_file_url text default null,
  p_file_name text default null,
  p_text_answer text default null
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid := public.a4_student_id_from_code(p_code);
  st record;
  v_asg record;
  v_sub submissions%rowtype;
begin
  if v_id is null then
    raise exception 'Invalid access code' using errcode = '28000';
  end if;
  select id, institute_id, batch_id, lab_batch_id into st from students where id = v_id;

  select id, batch_id, institute_id into v_asg
    from assignments
   where id = p_assignment_id
     and status = 'active'
     and batch_id in (st.batch_id, st.lab_batch_id);
  if not found then
    raise exception 'This assignment is not available to you' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_file_url, '')), '') is null and nullif(trim(coalesce(p_text_answer, '')), '') is null then
    raise exception 'Attach a file or write an answer' using errcode = '22023';
  end if;

  if length(coalesce(p_text_answer, '')) > 20000 then
    raise exception 'Answer is too long (max 20000 characters)' using errcode = '22023';
  end if;

  if p_file_url is not null
     and (p_file_url not like 'https://dcmnzvjftmdbywrjkust.supabase.co/storage/v1/object/%'
          or position(('/submissions/' || v_asg.institute_id || '/' || v_asg.id || '/' || st.id || '_') in p_file_url) = 0) then
    raise exception 'File must be uploaded from the student portal' using errcode = '42501';
  end if;

  select * into v_sub
    from submissions
   where assignment_id = v_asg.id and student_id = st.id
   order by submitted_at desc nulls last
   limit 1;

  if found then
    if v_sub.status = 'graded' then
      raise exception 'Already graded — ask your teacher to reopen it' using errcode = '42501';
    end if;
    -- NEW (18): attempts made through the upload link are never overwritten
    if v_sub.idempotency_key is not null or v_sub.files <> '[]'::jsonb then
      raise exception 'Submit this one from the upload link' using errcode = '42501';
    end if;
    update submissions
       set file_url     = coalesce(p_file_url, file_url),
           file_name    = coalesce(p_file_name, file_name),
           text_answer  = coalesce(p_text_answer, text_answer),
           submitted_at = now(),
           status       = 'submitted'
     where id = v_sub.id
    returning * into v_sub;
  else
    insert into submissions (assignment_id, student_id, file_url, file_name, text_answer, submitted_at, status)
    values (v_asg.id, st.id, p_file_url, p_file_name, p_text_answer, now(), 'submitted')
    returning * into v_sub;
  end if;

  return to_jsonb(v_sub);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 13. Storage: bucket "submissions" (private since 13)
--     new path <institute>/<assignment>/<student>/<uuid>.<ext>; old <institute>/<assignment>/<student>_<ms>.pdf
--     still accepted (portal v1). Anon can't prove WHO uploads (no session in Storage), so the policy checks
--     that the path is a student of the assignment's class and the window is open; create_submission then only
--     accepts files from the access-code holder's own folder.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_valid_submission_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts   text[] := string_to_array(coalesce(p_name, ''), '/');
  v_n       int := coalesce(array_length(string_to_array(coalesce(p_name, ''), '/'), 1), 0);
  v_inst    uuid;
  v_asg     uuid;
  v_student uuid;
  v_mime    text;
begin
  if v_n = 3 then                                                   -- portal v1
    if v_parts[3] !~ '^[0-9a-fA-F-]{36}_[0-9]{10,16}\.pdf$' then return false; end if;
    begin
      v_inst := v_parts[1]::uuid; v_asg := v_parts[2]::uuid; v_student := split_part(v_parts[3], '_', 1)::uuid;
    exception when others then
      return false;
    end;
    return exists (
      select 1 from assignments a join students st on st.id = v_student
       where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
         and st.institute_id = v_inst and coalesce(st.is_active, true)
         and a.batch_id in (st.batch_id, st.lab_batch_id));
  end if;

  if v_n <> 4 or v_parts[4] !~* '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$' then
    return false;
  end if;
  begin
    v_inst := v_parts[1]::uuid; v_asg := v_parts[2]::uuid; v_student := v_parts[3]::uuid;
  exception when others then
    return false;
  end;
  v_mime := case lower(substring(v_parts[4] from '\.([a-zA-Z]+)$'))
              when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
              when 'png' then 'image/png' when 'webp' then 'image/webp' when 'heic' then 'image/heic' end;
  return exists (
    select 1 from assignments a join students st on st.id = v_student
     where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
       and v_mime = any(a.allowed_mimes)
       and (a.opens_at is null or now() >= a.opens_at)
       and (a.deadline is null or a.late_policy = 'accept_flag' or now() <= a.deadline + interval '2 minutes')
       and st.institute_id = v_inst and coalesce(st.is_active, true)
       and a.batch_id in (st.batch_id, st.lab_batch_id));
end $$;

create or replace function public.a4_can_read_submission_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
  v_inst uuid; v_asg uuid;
begin
  if coalesce(array_length(v_parts, 1), 0) not in (3, 4) then return false; end if;
  begin
    v_inst := v_parts[1]::uuid;
    v_asg  := v_parts[2]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from assignments a
     where a.id = v_asg and a.institute_id = v_inst
       and (a.institute_id in (select public.a4_my_admin_inst_ids())
            or a.batch_id in (select public.a4_my_visible_batch_ids())));
end $$;

-- Bucket-level caps hold even for an anon upload that never becomes an attempt. 10 MB = the highest max_mb a
-- link may have (assignments_link_rules_check); the link's own max_mb is checked again in create_submission.
update storage.buckets
   set public = false,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
       file_size_limit = 10485760
 where id = 'submissions';

-- Uploads nobody attached: upload-link path, older than 24 h, in no attempt's files. Portal v1 files
-- (<inst>/<asg>/<student>_<ms>.pdf, referenced by submissions.file_url) never match.
-- Storage files must be deleted through the Storage API (deleting storage.objects rows in SQL leaves the bytes
-- behind), so SQL only finds them; the worker deletes them in a 'retention' job.
create or replace function public.a4_orphan_submission_files(p_limit int default 500)
returns setof text language sql stable security definer set search_path = public as $$
  with o as (
    select name, created_at,
           case when name ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){3}[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$'
                then true else false end as is_link_upload
      from storage.objects
     where bucket_id = 'submissions' and created_at < now() - interval '24 hours')
  select o.name from o
   where o.is_link_upload
     and not exists (
       select 1 from submissions s
        where s.assignment_id = (case when o.is_link_upload then split_part(o.name, '/', 2)::uuid end)
          and s.student_id    = (case when o.is_link_upload then split_part(o.name, '/', 3)::uuid end)
          and s.files @> jsonb_build_array(jsonb_build_object('storage_path', o.name)))
   order by o.created_at
   limit greatest(1, least(coalesce(p_limit, 500), 1000))
$$;

-- pg_cron (hourly) → one 'retention' job per hour, only when there is something to delete. The insert kicks the
-- worker like any job.
create or replace function public.a4_enqueue_orphan_cleanup()
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.a4_orphan_submission_files(1)) then
    return null;
  end if;
  insert into check_jobs (kind, idempotency_key)
  values ('retention', 'retention:orphan-uploads:' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24'))
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

drop policy if exists a4_submissions_insert on storage.objects;
create policy a4_submissions_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'submissions' and public.a4_valid_submission_path(name));
drop policy if exists a4_submissions_staff_read on storage.objects;
create policy a4_submissions_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and public.a4_can_read_submission_object(name));

-- ════════════════════════════════════════════════════════════════════
-- 14. RLS for portal rows in the checker tables: staff of the assignment's class read them (the owner policy
--     from 12 still covers the assignment's creator). Writes only through the functions above.
-- ════════════════════════════════════════════════════════════════════
drop policy if exists portal_sessions_staff_read on public.check_sessions;
create policy portal_sessions_staff_read on public.check_sessions for select to authenticated
  using (assignment_id is not null and public.a4_can_grade_assignment(assignment_id));

drop policy if exists portal_sheets_staff_read on public.check_sheets;
create policy portal_sheets_staff_read on public.check_sheets for select to authenticated
  using (submission_id is not null
         and exists (select 1 from public.submissions s
                      where s.id = check_sheets.submission_id and public.a4_can_grade_assignment(s.assignment_id)));

-- ════════════════════════════════════════════════════════════════════
-- 15. Grants. Supabase grants EXECUTE on new functions to PUBLIC/anon/authenticated by default → revoke first.
-- ════════════════════════════════════════════════════════════════════
revoke execute on function
  public.a4_system_write(), public.a4_project_per_question(jsonb),
  public.a4_request_ip_hash(text), public.a4_code_gate(text, text),
  public.a4_can_grade_assignment(uuid), public.a4_job_backoff(int),
  public.a4_mark_event(uuid, uuid, text, numeric, text, jsonb), public.a4_apply_overrides(jsonb, jsonb),
  public.a4_submission_json(uuid, boolean), public.a4_checker_kick(), public.a4_enqueue_submission(uuid),
  public.a4_publish_submission(uuid, uuid, boolean), public.a4_claim_check_job(int),
  public.a4_finish_check_job(uuid, boolean, text, text, jsonb), public.a4_checker_sweep(),
  public.a4_orphan_submission_files(int), public.a4_enqueue_orphan_cleanup(),
  public.a4_check_sheet_derive(), public.a4_answer_key_version_bump(), public.a4_answer_key_changed(),
  public.a4_check_job_state_sync(), public.a4_check_jobs_kick_trg(),
  public.get_assignment_link(text, text, text), public.verify_access_code(text, text),
  public.create_submission(text, uuid, text, jsonb, text), public.my_submissions(text, uuid, text),
  public.publish_results(uuid, uuid[]), public.unpublish_results(uuid[], text),
  public.override_marks(uuid, text, numeric, text)
from public, anon, authenticated;

-- used inside RLS policies / invoker triggers evaluated as the caller (the backend writes ai_result with the
-- teacher's JWT → check_sheets_derive → a4_project_per_question)
grant execute on function public.a4_can_grade_assignment(uuid), public.a4_system_write(),
  public.a4_project_per_question(jsonb) to authenticated;

grant execute on function
  public.get_assignment_link(text, text, text), public.verify_access_code(text, text),
  public.create_submission(text, uuid, text, jsonb, text), public.my_submissions(text, uuid, text)
to anon, authenticated;

grant execute on function
  public.publish_results(uuid, uuid[]), public.unpublish_results(uuid[], text),
  public.override_marks(uuid, text, numeric, text)
to authenticated;

grant execute on function
  public.a4_claim_check_job(int), public.a4_finish_check_job(uuid, boolean, text, text, jsonb),
  public.a4_checker_sweep(), public.a4_enqueue_submission(uuid),
  public.a4_orphan_submission_files(int), public.a4_enqueue_orphan_cleanup()
to service_role;

grant execute on function public.submit_assignment(text, uuid, text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 16. Scheduler (only if the owner already enabled the extensions — never enabled here)
-- ════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('a4-checker-sweep', '* * * * *', 'select public.a4_checker_sweep()');
    perform cron.schedule('a4-orphan-upload-cleanup', '17 * * * *', 'select public.a4_enqueue_orphan_cleanup()');
  else
    raise notice '18_upload_flow: pg_cron is NOT enabled → the sweep and the hourly orphan-upload cleanup are not scheduled. Enable pg_cron, then re-run this file.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice '18_upload_flow: pg_net is NOT enabled → new jobs do not wake the backend. Enable pg_net and add vault secrets checker_job_run_url + checker_job_secret.';
  end if;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (read-only; every row should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'assignments link cols', count(*) = 9 from information_schema.columns where table_name = 'assignments'
--        and column_name in ('opens_at','max_attempts','allowed_mimes','max_mb','max_pages','late_policy','count_policy','auto_publish','link_token')
-- union all select 'every assignment has a token', not exists (select 1 from assignments where link_token is null)
-- union all select 'attempt unique', exists (select 1 from pg_indexes where indexname = 'submissions_attempt_uq')
-- union all select 'check_jobs RLS on', (select relrowsecurity from pg_class where oid = 'public.check_jobs'::regclass)
-- union all select 'access_code_attempts closed', not has_table_privilege('anon', 'public.access_code_attempts', 'select')
-- union all select 'anon cannot claim jobs', not has_function_privilege('anon', 'public.a4_claim_check_job(int)', 'execute')
-- union all select 'anon cannot publish', not has_function_privilege('anon', 'public.publish_results(uuid,uuid[])', 'execute')
-- union all select 'anon can upload-link', has_function_privilege('anon', 'public.create_submission(text,uuid,text,jsonb,text)', 'execute')
-- union all select 'submissions private', not (select public from storage.buckets where id = 'submissions')
-- union all select 'submissions 10 MB + 5 types', (select file_size_limit = 10485760 and cardinality(allowed_mime_types) = 5
--                                                   from storage.buckets where id = 'submissions')
-- union all select 'orphan cleanup scheduled (needs pg_cron)', exists (select 1 from pg_extension where extname = 'pg_cron')
--                  and exists (select 1 from cron.job where jobname = 'a4-orphan-upload-cleanup')
-- union all select 'cron scheduled (needs pg_cron)', exists (select 1 from pg_extension where extname = 'pg_cron')
-- union all select 'pg_net enabled', exists (select 1 from pg_extension where extname = 'pg_net');
--
-- Headers check (PostgREST, as anon from the browser console):
--   supabasePortal.rpc('verify_access_code', { p_code: 'XXXXXXXX' }) twice, then in SQL:
--   select ip_hash, count(*) from access_code_attempts group by 1;   → one real hash, NOT 'no-ip'
