-- 19_upload_link_portal.sql — what the upload-link UI (portal + teacher "Copy Submissions") needs on top of 18
-- (23 Oct 2026). Contract: docs/upload-flow-api.md. Requires 18. Safe to re-run. One transaction.
--
-- 1. assignments.upload_link_enabled — the teacher switches the upload link on. Every assignment got a
--    link_token in 18, so without a flag the portal can't tell a link assignment (new RPCs) from an old one
--    (submit_assignment). Default false = every existing assignment keeps the old flow.
-- 2. get_student_feed — 05 body + `upload_link_token` (only when the link is on) so the portal sends the
--    student to /s/<token> instead of the old PDF upload.
-- 3. retry_checks — teacher re-queues attempts whose check `failed` (same key version; /internal/regrade
--    only handles a NEW key version).
-- 4. submission_mark_history — the audit rows (smart_assignment_checks: owner-only RLS) for everyone who may
--    grade the assignment, e.g. the HOD / proctor of the class.

begin;

do $$
begin
  if to_regprocedure('public.create_submission(text,uuid,text,jsonb,text)') is null
     or to_regprocedure('public.a4_enqueue_submission(uuid)') is null then
    raise exception '19_upload_link_portal needs 18_upload_flow applied first';
  end if;
end $$;

-- ── 1 ─────────────────────────────────────────────────────────────────
alter table public.assignments add column if not exists upload_link_enabled boolean not null default false;

-- ── 2 ─────────────────────────────────────────────────────────────────
create or replace function public.get_student_feed(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid := public.a4_student_id_from_code(p_code);
  st record;
begin
  if v_id is null then
    return null;
  end if;
  select id, institute_id, batch_id, lab_batch_id into st from students where id = v_id;

  return jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'batch_id', a.batch_id, 'batch_name', b.name,
               'title', a.title, 'description', a.description, 'deadline', a.deadline,
               'file_url', a.file_url, 'file_name', a.file_name, 'status', a.status,
               'max_marks', a.max_marks, 'created_at', a.created_at,
               'upload_link_token', case when a.upload_link_enabled then a.link_token end,   -- NEW (19)
               'submission', (
                 select jsonb_build_object(
                          'id', sub.id, 'assignment_id', sub.assignment_id, 'student_id', sub.student_id,
                          'file_url', sub.file_url, 'file_name', sub.file_name, 'text_answer', sub.text_answer,
                          'submitted_at', sub.submitted_at, 'grade', sub.grade, 'feedback', sub.feedback,
                          'graded_at', sub.graded_at, 'status', sub.status)
                   from submissions sub
                  where sub.assignment_id = a.id and sub.student_id = st.id   -- own submission only
                  order by sub.submitted_at desc nulls last
                  limit 1))
             order by a.created_at desc)
        from assignments a
        left join batches b on b.id = a.batch_id
       where a.batch_id in (st.batch_id, st.lab_batch_id)
         and a.status = 'active'), '[]'::jsonb),

    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', an.id, 'batch_id', an.batch_id, 'batch_name', b.name,
               'title', an.title, 'content', an.content, 'file_url', an.file_url,
               'is_pinned', an.is_pinned, 'created_at', an.created_at)
             order by coalesce(an.is_pinned, false) desc, an.created_at desc)
        from announcements an
        left join batches b on b.id = an.batch_id
       where an.batch_id in (st.batch_id, st.lab_batch_id)
          or (an.batch_id is null and an.institute_id = st.institute_id)), '[]'::jsonb),

    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'batch_id', e.batch_id, 'title', e.title, 'description', e.description,
               'event_type', e.event_type, 'start_time', e.start_time, 'end_time', e.end_time,
               'all_day', e.all_day, 'meeting_link', e.meeting_link, 'color', e.color)
             order by e.start_time)
        from calendar_events e
       where e.institute_id = st.institute_id
         and (e.batch_id in (st.batch_id, st.lab_batch_id) or e.batch_id is null)), '[]'::jsonb)
  );
end $$;

-- ── 3 ─────────────────────────────────────────────────────────────────
-- Only `failed` attempts. a4_enqueue_submission re-opens the failed job of the current key version
-- (on conflict … where state in ('failed','cancelled')), which also kicks the worker.
-- Returns {state:"ok", queued:[id], skipped:[{id,status,reason}]}
create or replace function public.retry_checks(p_submission_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r        record;
  v_status text;
  v_queued jsonb := '[]'::jsonb;
  v_skip   jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 or cardinality(p_submission_ids) > 500 then
    return jsonb_build_object('state', 'invalid_request', 'message', 'Pass 1-500 p_submission_ids');
  end if;

  for r in select s.id, s.status, s.assignment_id from submissions s
            where s.id = any(p_submission_ids) order by s.id for update of s loop
    if not public.a4_can_grade_assignment(r.assignment_id) then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'status', null, 'reason', 'forbidden');
    elsif r.status is distinct from 'failed' then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'not_failed');
    else
      perform public.a4_enqueue_submission(r.id);
      select status into v_status from submissions where id = r.id;
      if v_status in ('queued', 'checking', 'waiting_key') then
        v_queued := v_queued || to_jsonb(r.id);
      else
        v_skip := v_skip || jsonb_build_object('id', r.id, 'status', v_status, 'reason', 'not_requeued');
      end if;
    end if;
  end loop;

  -- ids the caller can't see are reported like forbidden ones (no existence leak)
  select v_skip || coalesce(jsonb_agg(jsonb_build_object('id', x, 'status', null, 'reason', 'forbidden')), '[]'::jsonb)
    into v_skip
    from unnest(p_submission_ids) x where not exists (select 1 from submissions s where s.id = x);

  return jsonb_build_object('state', 'ok', 'queued', v_queued, 'skipped', v_skip);
end $$;

-- ── 4 ─────────────────────────────────────────────────────────────────
-- Newest first. {state:"ok", events:[{at, type, by, by_me, total, remarks, details}]} | {state:"forbidden"}
create or replace function public.submission_mark_history(p_submission_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_asg uuid;
begin
  select assignment_id into v_asg from submissions where id = p_submission_id;
  if v_asg is null or not public.a4_can_grade_assignment(v_asg) then
    return jsonb_build_object('state', 'forbidden');
  end if;
  return jsonb_build_object('state', 'ok', 'events', coalesce((
    select jsonb_agg(jsonb_build_object(
             'at', h.created_at, 'type', coalesce(h.result_json ->> 'type', 'ai_check'),
             'by', h.teacher_id, 'by_me', h.teacher_id = auth.uid(),
             'total', h.total_obtained, 'remarks', h.overall_remarks,
             'details', h.result_json - 'graded_questions' - 'questions')
           order by h.created_at desc)
      from (select * from smart_assignment_checks
             where submission_id = p_submission_id
             order by created_at desc limit 200) h), '[]'::jsonb));
end $$;

revoke execute on function public.retry_checks(uuid[]), public.submission_mark_history(uuid)
  from public, anon, authenticated;
grant execute on function public.retry_checks(uuid[]), public.submission_mark_history(uuid) to authenticated;
grant execute on function public.get_student_feed(text) to anon, authenticated;

commit;

-- VERIFY (read-only; every row true)
-- select 'flag column', exists (select 1 from information_schema.columns where table_name = 'assignments' and column_name = 'upload_link_enabled')
-- union all select 'no link on by default', not exists (select 1 from assignments where upload_link_enabled)
-- union all select 'anon cannot retry', not has_function_privilege('anon', 'public.retry_checks(uuid[])', 'execute')
-- union all select 'teacher can retry', has_function_privilege('authenticated', 'public.retry_checks(uuid[])', 'execute');
