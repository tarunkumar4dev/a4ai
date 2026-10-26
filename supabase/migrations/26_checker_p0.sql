-- 26_checker_p0.sql — checker P0 fixes that don't need teacher marks (backend branch fix/checker-p0,
-- docs/audit/inventory.md). Additive; rollback = 26_checker_p0_rollback.sql. Needs 25_review_reason_fallback.sql.
--
--  1. AI failures are never final by themselves: a check job whose own retries ran out on a Gemini problem
--     (429 / 5xx / timeout / GEMINI_CONFIG = bad key or model) goes to state failed_retryable; the sweep queues it
--     again after 30 min with fresh retries, up to 24 rounds (~12 h), then failed. Students keep seeing "queued".
--     (23–24 Oct: copies failed in minutes and waited ~20 h for a human Retry.)
--  2. Flagged copies stay hidden: publish_results (Publish / Publish all) skips needs_review copies the teacher
--     hasn't approved or edited (check_sheets.review_approved_at); approve_review() = approve + publish one copy
--     from the review drawer; override_marks stamps the approval. Already-published copies are not touched.
--  3. checker_job_health: unfinished jobs with age, runs, rounds, last error. The sweep raises a WARNING per job
--     older than 15 min; the backend worker logs the same at ERROR.
--  4. check_shadow_results: re-grades made by scripts/shadow_regrade.py, invisible to teachers and students.
--
-- Every function changed here is the live body (pg_get_functiondef, 26 Oct 2026) with the lines marked NEW (26).

-- ── 1. columns and constraints ──
alter table public.check_jobs add column if not exists retry_rounds int not null default 0;

alter table public.check_jobs drop constraint if exists check_jobs_state_check;
alter table public.check_jobs add constraint check_jobs_state_check
  check (state in ('queued', 'running', 'done', 'failed', 'blocked_quota', 'cancelled', 'paused', 'failed_retryable'));

alter table public.check_jobs drop constraint if exists check_jobs_last_error_code_check;
alter table public.check_jobs add constraint check_jobs_last_error_code_check
  check (last_error_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'BAD_FILE', 'QUOTA', 'BUDGET', 'SCHEMA', 'CALL_CAP',
                             'PAUSED', 'FILES_EXPIRED', 'KEY_MISSING', 'UNKNOWN', 'GEMINI_CONFIG'));

create index if not exists check_jobs_retryable_idx on public.check_jobs (next_run_at) where state = 'failed_retryable';

alter table public.check_sheets add column if not exists review_approved_at timestamptz;
alter table public.check_sheets add column if not exists review_approved_by uuid references auth.users(id) on delete set null;

-- ── 2. retry rounds (one place for the numbers) + health view ──
create or replace function public.a4_retry_round_wait()
returns interval language sql immutable as $$ select interval '30 minutes' $$;

create or replace function public.a4_retry_rounds_max()
returns int language sql immutable as $$ select 24 $$;

create or replace view public.checker_job_health with (security_invoker = true) as
select j.id                                                           as job_id,
       case when j.checkpoint ->> 'stage' = 'rubric' then 'rubric'
            when j.checkpoint ? 'parent' then 'chunk'
            when j.submission_id is not null then 'copy'
            else j.kind end                                           as job_type,
       j.state,
       coalesce(ss.assignment_id, nullif(j.checkpoint ->> 'assignment_id', '')::uuid) as assignment_id,
       j.submission_id,
       j.teacher_id,
       (extract(epoch from now() - j.created_at) / 60)::int           as age_min,
       j.retries,
       j.retry_rounds,
       j.last_error_code,
       j.error                                                        as last_error,
       j.next_run_at,
       j.locked_at,
       j.created_at
  from public.check_jobs j
  left join public.check_sessions ss on ss.id = j.session_id
 where j.state in ('queued', 'running', 'failed_retryable', 'paused', 'blocked_quota');

comment on view public.checker_job_health is
  'Unfinished checker jobs (26_checker_p0). RLS of check_jobs applies (security_invoker): teachers see their own.';

-- ── 3. queue functions (live bodies of 26 Oct + the lines marked NEW (26)) ──

CREATE OR REPLACE FUNCTION public.a4_finish_check_job(p_job_id uuid, p_ok boolean, p_error_code text DEFAULT NULL::text, p_error text DEFAULT NULL::text, p_usage jsonb DEFAULT NULL::jsonb)
 RETURNS check_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  j      check_jobs%rowtype;
  v_code text := case when p_ok then null
                      when p_error_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'BAD_FILE', 'QUOTA', 'BUDGET',
                                            'SCHEMA', 'CALL_CAP', 'PAUSED', 'FILES_EXPIRED', 'KEY_MISSING', 'GEMINI_CONFIG')
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
  elsif v_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'GEMINI_CONFIG', 'UNKNOWN') and j.retries < j.max_retries then
    update check_jobs set state = 'queued', locked_at = null, next_run_at = now() + public.a4_job_backoff(j.retries),
                          last_error_code = v_code, error = left(p_error, 300), usage = coalesce(p_usage, usage),
                          updated_at = now()
     where id = j.id returning * into j;
  elsif v_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'GEMINI_CONFIG') and j.retry_rounds < public.a4_retry_rounds_max() then
    -- NEW (26): the AI side failed and the job's own retries are used up → not failed for a human Retry: the sweep
    -- queues it again after a4_retry_round_wait() with a fresh set of retries, for up to a4_retry_rounds_max() rounds
    update check_jobs set state = 'failed_retryable', locked_at = null,
                          next_run_at = now() + public.a4_retry_round_wait(),
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
end $function$;

CREATE OR REPLACE FUNCTION public.a4_checker_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_requeued int;
  v_failed   int;
  v_unblocked int;
  v_due      int;
  v_retried  int;
  v_stale    int := 0;
  h          record;
begin
  update check_jobs
     set state = 'queued', locked_at = null, next_run_at = now() + public.a4_job_backoff(retries),
         last_error_code = 'TIMEOUT', error = 'Checking took too long; retrying.', updated_at = now()
   where state = 'running' and locked_at < now() - interval '6 minutes' and retries < max_retries;
  get diagnostics v_requeued = row_count;

  -- NEW (26): out of retries → failed_retryable (another round later) while rounds are left, else failed
  update check_jobs
     set state = 'failed_retryable', locked_at = null, next_run_at = now() + public.a4_retry_round_wait(),
         last_error_code = 'TIMEOUT', error = 'Checking took too long; it will be tried again automatically.',
         updated_at = now()
   where state = 'running' and locked_at < now() - interval '6 minutes' and retries >= max_retries
     and retry_rounds < public.a4_retry_rounds_max();

  update check_jobs
     set state = 'failed', finished_at = now(), locked_at = null, last_error_code = 'TIMEOUT',
         error = 'Checking took too long. Please retry.', updated_at = now()
   where state = 'running' and locked_at < now() - interval '6 minutes' and retries >= max_retries;
  get diagnostics v_failed = row_count;

  -- NEW (26): next round for jobs the AI side failed (fresh retries, round counted)
  update check_jobs
     set state = 'queued', retries = 0, retry_rounds = retry_rounds + 1, next_run_at = now(), locked_at = null,
         updated_at = now()
   where state = 'failed_retryable' and next_run_at <= now();
  get diagnostics v_retried = row_count;

  update check_jobs set state = 'queued', updated_at = now()
   where state = 'blocked_quota' and next_run_at <= now();
  get diagnostics v_unblocked = row_count;

  -- NEW (26): alert on anything unfinished 15+ min after it was created (Supabase Postgres logs; the backend
  -- worker logs the same at ERROR in Vercel). WARNING = the highest level that doesn't abort the sweep.
  for h in select * from public.checker_job_health
            where age_min >= 15 and state <> 'blocked_quota' order by age_min desc limit 20 loop
    v_stale := v_stale + 1;
    raise warning 'a4 checker ALERT: job % (%) assignment % not finished after % min (state %, runs %, rounds %, last error %)',
      h.job_id, h.job_type, h.assignment_id, h.age_min, h.state, h.retries, h.retry_rounds, h.last_error_code;
  end loop;

  select count(*) into v_due from check_jobs where state = 'queued' and next_run_at <= now();
  if v_due > 0 then
    perform public.a4_checker_kick();
  end if;
  return jsonb_build_object('requeued', v_requeued, 'failed', v_failed, 'unblocked', v_unblocked, 'due', v_due,
                            'retried', v_retried, 'stale', v_stale);
end $function$;

CREATE OR REPLACE FUNCTION public.a4_check_job_state_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  elsif new.state in ('queued', 'paused', 'failed_retryable') then     -- 26: tried again later = still queued
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
end $function$;

-- ── 4. publishing ──

CREATE OR REPLACE FUNCTION public.publish_results(p_assignment_id uuid DEFAULT NULL::uuid, p_submission_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    elsif r.status = 'needs_review'
          and not exists (select 1 from check_sheets where submission_id = r.id and review_approved_at is not null) then
      -- NEW (26): flagged and not yet approved / edited by a teacher in the review drawer → stays hidden
      v_blocked := v_blocked || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'needs_review');
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
end $function$;

CREATE OR REPLACE FUNCTION public.override_marks(p_submission_id uuid, p_q_no text, p_marks numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         final_marks = case when status = 'approved' then v_total else final_marks end,
         -- NEW (26): an edit in the review drawer counts as the teacher's review (publishable even if flagged)
         review_approved_at = coalesce(review_approved_at, now()),
         review_approved_by = coalesce(review_approved_by, auth.uid())
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
end $function$;

-- ── 5. approve one flagged copy from the review drawer (and publish it) ──
create or replace function public.approve_review(p_submission_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       submissions%rowtype;
  sh      check_sheets%rowtype;
  v_total numeric;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  select * into s from submissions where id = p_submission_id for update;
  if not found or not public.a4_can_grade_assignment(s.assignment_id) then
    return jsonb_build_object('state', 'forbidden');
  end if;
  if s.status = 'published' then
    return jsonb_build_object('state', 'already_published');
  end if;
  if s.status not in ('checked', 'needs_review') then
    return jsonb_build_object('state', 'not_checked', 'message', 'This copy has no result to approve yet.');
  end if;
  select * into sh from check_sheets where submission_id = s.id for update;
  if not found then
    return jsonb_build_object('state', 'not_checked', 'message', 'This copy has no result to approve yet.');
  end if;
  update check_sheets set review_approved_at = now(), review_approved_by = auth.uid(), updated_at = now()
   where id = sh.id;
  v_total := public.a4_publish_submission(s.id, auth.uid(), false);      -- audited as 'publish'
  return jsonb_build_object('state', 'ok', 'total', v_total);
end $$;

-- ── 6. shadow re-grades (scripts/shadow_regrade.py, service key only) ──
create table if not exists public.check_shadow_results (
  id                   uuid primary key default gen_random_uuid(),
  run_label            text not null check (char_length(run_label) between 1 and 80),
  submission_id        uuid not null references public.submissions(id) on delete cascade,
  sheet_id             uuid references public.check_sheets(id) on delete cascade,
  assignment_id        uuid not null,
  answer_key_version   int,
  rubric_sha256        text,
  model                text,
  ai_result            jsonb not null,
  ai_marks             numeric,
  max_marks            numeric,
  needs_review_reasons text[] not null default '{}',
  usage                jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  unique (run_label, submission_id)
);
alter table public.check_shadow_results enable row level security;    -- no policies: service_role only
revoke all on public.check_shadow_results from anon, authenticated;

-- ── 7. grants (Supabase grants EXECUTE / SELECT to anon by default → revoke first) ──
revoke execute on function public.a4_retry_round_wait(), public.a4_retry_rounds_max(),
  public.approve_review(uuid) from public, anon, authenticated;
grant execute on function public.approve_review(uuid) to authenticated;
grant execute on function public.a4_retry_round_wait(), public.a4_retry_rounds_max() to service_role;
revoke all on public.checker_job_health from anon;
grant select on public.checker_job_health to authenticated, service_role;

-- ── verify (run by hand after applying) ──
-- select 'state check', pg_get_constraintdef(oid) like '%failed_retryable%' from pg_constraint where conname = 'check_jobs_state_check'
-- union all select 'review column', exists (select 1 from information_schema.columns where table_name = 'check_sheets' and column_name = 'review_approved_at')
-- union all select 'health view', exists (select 1 from pg_views where viewname = 'checker_job_health')
-- union all select 'shadow table rls', (select relrowsecurity from pg_class where relname = 'check_shadow_results')
-- union all select 'enum', 'fallback_model' = any (enum_range(null::public.a4_review_reason)::text[]);
-- select public.a4_checker_sweep();     -- returns … "retried": n, "stale": n
