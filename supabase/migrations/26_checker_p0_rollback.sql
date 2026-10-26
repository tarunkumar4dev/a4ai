-- 26_checker_p0_rollback.sql — undoes 26_checker_p0.sql. Run BEFORE rolling the backend back past fix/checker-p0
-- (the old backend never writes failed_retryable / GEMINI_CONFIG, but the new one does).
--
-- Data: failed_retryable jobs become failed (teacher Retry works on them as before); GEMINI_CONFIG errors become
-- UNKNOWN; shadow re-grades and review approvals are dropped. 25's enum value 'fallback_model' stays (harmless).

update public.check_jobs set state = 'failed', finished_at = coalesce(finished_at, now()), locked_at = null, updated_at = now()
 where state = 'failed_retryable';
update public.check_jobs set last_error_code = 'UNKNOWN' where last_error_code = 'GEMINI_CONFIG';

-- functions exactly as they were on live before 26 (pg_get_functiondef, 26 Oct 2026)

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
end $function$;

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
end $function$;

drop function if exists public.approve_review(uuid);
drop view if exists public.checker_job_health;
drop table if exists public.check_shadow_results;
drop function if exists public.a4_retry_round_wait();
drop function if exists public.a4_retry_rounds_max();
drop index if exists public.check_jobs_retryable_idx;

alter table public.check_jobs drop constraint if exists check_jobs_state_check;
alter table public.check_jobs add constraint check_jobs_state_check
  check (state in ('queued', 'running', 'done', 'failed', 'blocked_quota', 'cancelled', 'paused'));
alter table public.check_jobs drop constraint if exists check_jobs_last_error_code_check;
alter table public.check_jobs add constraint check_jobs_last_error_code_check
  check (last_error_code in ('GEMINI_429', 'GEMINI_5XX', 'TIMEOUT', 'BAD_FILE', 'QUOTA', 'BUDGET', 'SCHEMA', 'CALL_CAP',
                             'PAUSED', 'FILES_EXPIRED', 'KEY_MISSING', 'UNKNOWN'));
alter table public.check_jobs drop column if exists retry_rounds;
alter table public.check_sheets drop column if exists review_approved_by;
alter table public.check_sheets drop column if exists review_approved_at;
