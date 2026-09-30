-- 05_student_portal.sql — Step 5: student portal via access-code RPCs (fixes finding 11 + B2 on the DB side).
-- Status: reviewed + applied 30 Sep (live DB). This file = the applied version.
-- Requires 01 + 02 (already applied). One transaction: if anything fails, nothing changes.
--
-- WHAT THIS DOES
--   1. batches.is_lab, students.lab_batch_id (+ backfill is_lab for "<section> A/B/C" batches)
--   2. SECURITY DEFINER RPCs keyed by the student's access code — the portal (anon) uses ONLY these:
--        get_student_by_code(code)                      → own profile + names
--        get_student_feed(code)                         → own batch + lab batch assignments / announcements / events + own submissions
--        submit_assignment(code, assignment, file/text) → only for assignments of own batch / lab batch
--      No RPC ever returns another student's row.
--   3. Does NOT drop the anon table policies — that is 05b_drop_anon_policies.sql, run AFTER the new portal is tested.
--
-- ORDER: run this BEFORE deploying the Step 5 frontend (HOD "New section" writes is_lab, bulk upload writes lab_batch_id).

begin;

-- ════════════════════════════════════════════════════════════════════
-- 1. Columns
-- ════════════════════════════════════════════════════════════════════
alter table public.batches  add column if not exists is_lab boolean not null default false;
alter table public.students add column if not exists lab_batch_id uuid references public.batches(id) on delete set null;
create index if not exists students_lab_batch_id_idx on public.students(lab_batch_id);

-- Backfill: batches inside a section whose name ends in " A" / " B" / " C" are lab batches ("ECE-2 A").
update public.batches
   set is_lab = true
 where section_id is not null
   and name ~ ' [ABC]$'
   and is_lab = false;

-- ════════════════════════════════════════════════════════════════════
-- 2. Private helper: access code → student id
--    NULL unless exactly one active code matches an active student (a duplicated code must never
--    resolve to someone else's data).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_student_id_from_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select min(sac.student_id::text)::uuid
    from student_access_codes sac
    join students st on st.id = sac.student_id
   where sac.access_code = upper(trim(p_code))
     and sac.is_active = true
     and coalesce(st.is_active, true)
  having count(distinct sac.student_id) = 1;
$$;
-- Functions are executable by PUBLIC by default and Supabase also grants anon/authenticated → revoke explicitly.
revoke execute on function public.a4_student_id_from_code(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 3. get_student_by_code — own profile. VOLATILE (updates last_used_at).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.get_student_by_code(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid := public.a4_student_id_from_code(p_code);
  v_out jsonb;
begin
  if v_id is null then
    return null;
  end if;

  update student_access_codes
     set last_used_at = now()
   where student_id = v_id and access_code = upper(trim(p_code));

  select jsonb_build_object(
           'id',              st.id,
           'name',            st.name,
           'roll_no',         st.roll_no,
           'class_level',     coalesce(st.class_level, b.class_level),
           'institute_id',    st.institute_id,
           'batch_id',        st.batch_id,
           'lab_batch_id',    st.lab_batch_id,
           'institute_name',  i.name,
           'department_name', d.name,
           'section_name',    s.name,
           'batch_name',      b.name,
           'lab_batch_name',  lb.name)
    into v_out
    from students st
    join institutes i       on i.id  = st.institute_id
    left join departments d on d.id  = st.department_id
    left join sections s    on s.id  = st.section_id
    left join batches b     on b.id  = st.batch_id
    left join batches lb    on lb.id = st.lab_batch_id
   where st.id = v_id;

  return v_out;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4. get_student_feed — everything the portal shows, for this student only.
--    batch scope = students.batch_id + students.lab_batch_id.
--    Announcements + events also include institute-wide rows (batch_id is null, same institute).
-- ════════════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════════════
-- 5. submit_assignment — only for an active assignment of the student's batch / lab batch.
--    File URL must be in this project's storage AND the student's own folder of the "submissions" bucket:
--      https://dcmnzvjftmdbywrjkust.supabase.co/storage/v1/object/…/submissions/<institute_id>/<assignment_id>/<student_id>_…
--    Text answer max 20000 characters.
--    Graded submissions can't be overwritten.
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

  -- File must live in THIS project's storage (no external/phishing links) AND in the student's own folder.
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

grant execute on function
  public.get_student_by_code(text),
  public.get_student_feed(text),
  public.submit_assignment(text, uuid, text, text, text)
to anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════
-- TEST (SQL editor, after running). Replace 123456 with a real code:
--   select public.get_student_by_code('123456');   -- own profile, lab_batch_name filled after upload
--   select public.get_student_feed('123456');       -- only own batch + lab batch items
--   select public.get_student_by_code('000000');   -- null
--   select public.a4_student_id_from_code('123456');  -- works as postgres; as anon → "permission denied"
--   select name, is_lab from batches where section_id is not null order by name;   -- A/B/C = true
-- ════════════════════════════════════════════════════════════════════
