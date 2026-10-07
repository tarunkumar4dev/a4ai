-- 07_security_hardening.sql — Step 7: close the leaks found in the 7 Oct review.
-- ONE transaction. Human runs it in the SQL editor. Nothing here deletes data.
--
-- ⚠ ORDER: deploy the Step 7 frontend FIRST (student portal uploads with upsert:false), THEN run this file.
--   This file removes the public SELECT policy on the "submissions" bucket; an upsert upload needs SELECT.
--
-- WHAT IT FIXES (all verified against live definitions on 7 Oct, read-only):
--   A. Functions that anyone (even anon) could call without a permission check:
--        get_monthly_attendance       → any batch's student names + attendance          → now a4_can_view_batch()
--        get_proctor_section_status   → any batch's classes + teacher names              → now a4_can_view_batch()
--        get_hod_department_overview  → any department's batches / proctors / attendance → now a4_can_manage_dept()
--        generate_student_access_codes → anyone could mint codes for any institute       → admin/HOD only, 8-char crypto-random codes
--   B. Functions with missing cross-checks:
--        assign_proctor        → an HOD could take over another department's section → section ∈ dept ∈ institute, teacher ∈ institute
--        create_timetable_slot → an owner could write slots into another institute's batch → institute taken from the batch
--        join_institute_by_code → case-sensitive (frontend lower-cased the code), no dept teacher_code, no sign-in check
--        create_institute       → no sign-in check / search_path
--        get_member_directory   → any member got every member's email → only members the caller may see
--   C. Anon could execute legacy write functions: migrate_legacy_attendance, list_legacy_attendance_batches,
--      mark_attendance, edit_attendance, join_institute → revoked.
--   D. Policies:
--        institutes: "Public read institutes" (anon read join_code + owner_id) and anyone_creates_institute
--                    (anyone could create an institute with someone else's owner_id) → dropped.
--        institute_members: any member saw the whole institute → own row + a4_my_visible_member_ids() (+ admins).
--        subjects: any member saw every subject → own scope; hod_insert also checks the dept's institute.
--   E. Storage:
--        submissions: public listing + anyone uploads anywhere → no listing; upload only to a valid
--                     <institute>/<assignment>/<student>_<ts>.pdf path; bucket = PDF only, max 10 MB.
--        assignments: public listing + any user uploads anywhere → no listing; upload only into own institute/uid folder.
--        institute-assets: any logged-in user could replace/delete any institute's logo → only that institute's admins.
--        question-images: any user could delete anyone's images (the "own" policy never matched the path) → no deletes.
--   New: search_institute_teachers(institute, query) — admin/HOD teacher search for the HOD dashboard (replaces a
--        direct institute_members read).
--
-- Rollback: everything is CREATE OR REPLACE / policy swaps. Old definitions are in the 7 Oct read-only dump
-- (Claude session scratchpad) and supabase/audit_2026-09-29.csv.

begin;

-- ════════════════════════════════════════════════════════════════════
-- 0. Helpers
-- ════════════════════════════════════════════════════════════════════

-- Members (institute_members.id) the caller may see: HOD → own dept + anyone teaching / proctoring there;
-- teacher/proctor → colleagues in their sections + those sections' HOD. Admins are handled by the policy.
create or replace function public.a4_my_visible_member_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  with vs as (select public.a4_my_visible_section_ids() as id),
       hd as (select public.a4_my_hod_dept_ids() as id),
       vb as (select b.id from batches b
               where b.section_id in (select id from vs) or b.department_id in (select id from hd))
  select m.id from institute_members m
   where m.status = 'active' and (
        m.department_id in (select id from hd)
     or m.user_id in (select ta.teacher_id from teaching_assignments ta
                       where ta.batch_id in (select id from vb) and coalesce(ta.is_active, true))
     or m.user_id in (select ts.teacher_id from timetable_slots ts
                       where ts.batch_id in (select id from vb) and coalesce(ts.is_active, true))
     or m.id in (select pa.teacher_id from proctor_assignments pa
                  where pa.section_id in (select id from vs) and coalesce(pa.is_active, true))
     or (m.role = 'hod' and m.department_id in (select s.department_id from sections s where s.id in (select id from vs)))
   );
$$;
revoke execute on function public.a4_my_visible_member_ids() from public, anon;
grant  execute on function public.a4_my_visible_member_ids() to authenticated, service_role;

-- Storage path check for student submissions: "<institute>/<assignment>/<student>_<ms>.pdf",
-- assignment active, student active and in the assignment's batch or lab batch.
create or replace function public.a4_valid_submission_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
  v_inst uuid; v_asg uuid; v_student uuid;
begin
  if coalesce(array_length(v_parts, 1), 0) <> 3 then return false; end if;
  if v_parts[3] !~ '^[0-9a-fA-F-]{36}_[0-9]{10,16}\.pdf$' then return false; end if;
  begin
    v_inst := v_parts[1]::uuid;
    v_asg := v_parts[2]::uuid;
    v_student := split_part(v_parts[3], '_', 1)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from assignments a join students st on st.id = v_student
     where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
       and st.institute_id = v_inst and coalesce(st.is_active, true)
       and a.batch_id in (st.batch_id, st.lab_batch_id));
end $$;
revoke execute on function public.a4_valid_submission_path(text) from public;
grant  execute on function public.a4_valid_submission_path(text) to anon, authenticated, service_role;

-- HOD dashboard: find a teacher from another department to assign (admin/HOD of that institute only).
create or replace function public.search_institute_teachers(p_institute_id uuid, p_query text)
returns table(id uuid, user_id uuid, user_name text, user_email text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_q text := trim(regexp_replace(coalesce(p_query, ''), '[%_\\]', '', 'g'));
begin
  if coalesce(att_caller_role(p_institute_id), '') not in ('admin', 'hod') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if length(v_q) < 3 then return; end if;
  return query
  select m.id, m.user_id, m.user_name::text, m.user_email::text
    from institute_members m
   where m.institute_id = p_institute_id and m.status = 'active' and m.role in ('teacher', 'hod')
     and (m.user_name ilike '%' || v_q || '%' or m.user_email ilike '%' || v_q || '%')
   order by m.user_name
   limit 10;
end $$;
revoke execute on function public.search_institute_teachers(uuid, text) from public, anon;
grant  execute on function public.search_institute_teachers(uuid, text) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- A. Read functions that had no permission check
-- ════════════════════════════════════════════════════════════════════

create or replace function public.get_monthly_attendance(p_batch_id uuid, p_month integer, p_year integer, p_subject_id uuid default null::uuid)
returns table(student_id uuid, student_name text, roll_no text, subject_name text, subject_code text, total_held bigint, total_present bigint, total_absent bigint, total_late bigint, total_leave bigint, percentage numeric)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.a4_can_view_batch(p_batch_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  return query
  select
    s.id as student_id,
    s.name as student_name,
    s.roll_no,
    sub.name as subject_name,
    sub.code as subject_code,
    count(ar.id) as total_held,
    count(ar.id) filter (where ar.status = 'present') as total_present,
    count(ar.id) filter (where ar.status = 'absent') as total_absent,
    count(ar.id) filter (where ar.status = 'late') as total_late,
    count(ar.id) filter (where ar.status = 'leave') as total_leave,
    case
      when count(ar.id) = 0 then 0.00
      else round(
        count(ar.id) filter (where ar.status in ('present', 'late'))::numeric
        / count(ar.id)::numeric * 100,
        2
      )
    end as percentage
  from students s
  cross join subjects sub
  left join class_sessions cs on cs.batch_id = p_batch_id
    and cs.subject_id = sub.id
    and cs.status = 'conducted'
    and extract(month from cs.session_date) = p_month
    and extract(year from cs.session_date) = p_year
  left join attendance_records ar on ar.session_id = cs.id
    and ar.student_id = s.id
  where s.batch_id = p_batch_id
    and s.is_active = true
    and sub.id = coalesce(p_subject_id, sub.id)
    and sub.department_id = (select department_id from batches where id = p_batch_id)
  group by s.id, s.name, s.roll_no, sub.name, sub.code
  order by s.roll_no, sub.code;
end;
$function$;

create or replace function public.get_proctor_section_status(p_batch_id uuid, p_date date default current_date)
returns table(session_id uuid, subject_name text, subject_code text, teacher_name text, start_time time without time zone, status text, is_marked boolean, present_count bigint, absent_count bigint, total_students bigint)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.a4_can_view_batch(p_batch_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  return query
  select
    cs.id as session_id,
    sub.name as subject_name,
    sub.code as subject_code,
    coalesce(
      (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = cs.teacher_id),
      (select split_part(email, '@', 1) from auth.users where id = cs.teacher_id),
      'Unknown'
    ) as teacher_name,
    ts.start_time,
    cs.status,
    (cs.marked_at is not null) as is_marked,
    (select count(*) from attendance_records ar
     where ar.session_id = cs.id and ar.status in ('present', 'late')) as present_count,
    (select count(*) from attendance_records ar
     where ar.session_id = cs.id and ar.status = 'absent') as absent_count,
    (select count(*) from students st
     where st.batch_id = p_batch_id and st.is_active = true) as total_students
  from class_sessions cs
  join subjects sub on sub.id = cs.subject_id
  left join timetable_slots ts on ts.id = cs.timetable_slot_id
  where cs.batch_id = p_batch_id
    and cs.session_date = p_date
  order by ts.start_time nulls last;
end;
$function$;

create or replace function public.get_hod_department_overview(p_department_id uuid, p_date date default current_date)
returns table(batch_id uuid, batch_name text, proctor_name text, total_sessions bigint, marked_sessions bigint, pending_sessions bigint, avg_attendance numeric)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.a4_can_manage_dept(p_department_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  return query
  select
    b.id as batch_id,
    b.name as batch_name,
    coalesce(
      (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = b.proctor_id),
      (select split_part(email, '@', 1) from auth.users where id = b.proctor_id),
      'Not assigned'
    ) as proctor_name,
    count(cs.id) as total_sessions,
    count(cs.id) filter (where cs.marked_at is not null) as marked_sessions,
    count(cs.id) filter (where cs.marked_at is null and cs.status = 'scheduled') as pending_sessions,
    case
      when count(ar_sub.id) = 0 then 0.00
      else round(
        count(ar_sub.id) filter (where ar_sub.status in ('present', 'late'))::numeric
        / nullif(count(ar_sub.id), 0)::numeric * 100,
        2
      )
    end as avg_attendance
  from batches b
  left join class_sessions cs on cs.batch_id = b.id and cs.session_date = p_date
  left join attendance_records ar_sub on ar_sub.session_id = cs.id
  where b.department_id = p_department_id
    and b.is_active = true
  group by b.id, b.name, b.proctor_id
  order by b.name;
end;
$function$;

-- Members see names/emails only of members they may see (was: every member of the institute).
create or replace function public.get_member_directory(p_institute_id uuid)
returns table(user_id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = public as $function$
begin
  if att_caller_role(p_institute_id) is null then raise exception 'Permission denied'; end if;
  return query
  select u.id,
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''))::text,
         u.email::text
    from institute_members im
    join auth.users u on u.id = im.user_id
   where im.institute_id = p_institute_id and im.status = 'active'
     and (public.a4_is_inst_admin(p_institute_id)
          or im.user_id = auth.uid()
          or im.id in (select public.a4_my_visible_member_ids()));
end;
$function$;

-- Admin / HOD only; 8-char codes from crypto-random bytes (alphabet without 0/O/1/I). Existing codes keep working.
create or replace function public.generate_student_access_codes(p_institute_id uuid)
returns integer language plpgsql security definer set search_path = public as $function$
declare
  v_count   integer := 0;
  v_student record;
  v_code    varchar(8);
  v_bytes   bytea;
  c_alpha   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 chars → byte % 32 is uniform
begin
  if coalesce(att_caller_role(p_institute_id), '') not in ('admin', 'hod') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  for v_student in
    select s.id, s.batch_id
      from students s
      left join student_access_codes sac on sac.student_id = s.id and sac.is_active = true
     where s.institute_id = p_institute_id
       and s.is_active = true
       and sac.id is null
  loop
    loop
      v_bytes := extensions.gen_random_bytes(8);
      v_code := '';
      for i in 0..7 loop
        v_code := v_code || substr(c_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
      end loop;
      exit when not exists (select 1 from student_access_codes where access_code = v_code);
    end loop;

    insert into student_access_codes (student_id, access_code, batch_id, institute_id)
    values (v_student.id, v_code, v_student.batch_id, p_institute_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

-- ════════════════════════════════════════════════════════════════════
-- B. Write functions with missing cross-checks
-- ════════════════════════════════════════════════════════════════════

create or replace function public.assign_proctor(p_institute_id uuid, p_department_id uuid, p_section_id uuid, p_teacher_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'Permission denied' using errcode = '42501'; end if;

  -- The section must belong to this department and the department to this institute
  -- (before: an HOD could pass their own dept id with another department's section).
  if not exists (select 1 from sections s join departments d on d.id = s.department_id
                  where s.id = p_section_id and s.department_id = p_department_id and d.institute_id = p_institute_id) then
    raise exception 'Section does not belong to this department' using errcode = '42501';
  end if;

  -- The new proctor (institute_members.id) must be an active member of the same institute.
  if not exists (select 1 from institute_members m
                  where m.id = p_teacher_id and m.institute_id = p_institute_id and m.status = 'active') then
    raise exception 'Teacher is not an active member of this institute' using errcode = '42501';
  end if;

  if not (
       exists (select 1 from institutes where id = p_institute_id and owner_id = v_caller)
    or exists (select 1 from institute_members where user_id = v_caller and institute_id = p_institute_id
                 and role = 'admin' and status = 'active')
    or exists (select 1 from institute_members where user_id = v_caller and institute_id = p_institute_id
                 and department_id = p_department_id and role = 'hod' and status = 'active')
  ) then
    raise exception 'Permission denied: not owner, admin, or HOD';
  end if;

  delete from proctor_assignments where section_id = p_section_id;
  insert into proctor_assignments (institute_id, department_id, section_id, teacher_id, is_active, assigned_at)
  values (p_institute_id, p_department_id, p_section_id, p_teacher_id, true, now());
end;
$function$;

create or replace function public.create_timetable_slot(p_institute_id uuid, p_batch_id uuid, p_subject_id uuid, p_teacher_id uuid, p_day_of_week smallint, p_start_time time without time zone, p_end_time time without time zone, p_room text default null::text)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_caller uuid := auth.uid();
  v_inst uuid;
  v_dept uuid;
  v_slot_id uuid;
begin
  if v_caller is null then raise exception 'Permission denied' using errcode = '42501'; end if;

  -- Institute comes from the batch (before: the caller's p_institute_id was trusted).
  select b.institute_id, coalesce(b.department_id, s.department_id) into v_inst, v_dept
    from batches b left join sections s on s.id = b.section_id
   where b.id = p_batch_id;
  if v_inst is null then raise exception 'Batch not found'; end if;
  if v_inst <> p_institute_id then
    raise exception 'Batch does not belong to this institute' using errcode = '42501';
  end if;
  if not exists (select 1 from subjects where id = p_subject_id and institute_id = v_inst) then
    raise exception 'Subject does not belong to this institute' using errcode = '42501';
  end if;
  if not exists (select 1 from institute_members where user_id = p_teacher_id and institute_id = v_inst and status = 'active') then
    raise exception 'Teacher is not an active member of this institute' using errcode = '42501';
  end if;
  if p_day_of_week not between 0 and 6 then raise exception 'Invalid day of week'; end if;
  if p_end_time <= p_start_time then raise exception 'End time must be after start time'; end if;

  if not (
       exists (select 1 from institutes where id = v_inst and owner_id = v_caller)
    or exists (select 1 from institute_members where user_id = v_caller and institute_id = v_inst
                 and role = 'admin' and status = 'active')
    or exists (select 1 from institute_members where user_id = v_caller and institute_id = v_inst
                 and department_id = v_dept and role = 'hod' and status = 'active')
  ) then
    raise exception 'Permission denied: not owner, admin, or HOD';
  end if;

  insert into timetable_slots (institute_id, batch_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, is_active)
  values (v_inst, p_batch_id, p_subject_id, p_teacher_id, p_day_of_week, p_start_time, p_end_time, p_room, true)
  returning id into v_slot_id;

  return v_slot_id;
end;
$function$;

-- Case-insensitive; accepts the institute join_code OR a department teacher_code (sets department_id).
create or replace function public.join_institute_by_code(p_join_code text)
returns json language plpgsql security definer set search_path = public as $function$
declare
  v_code text := upper(trim(coalesce(p_join_code, '')));
  v_inst uuid;
  v_name text;
  v_dept uuid;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Please sign in first');
  end if;
  if v_code = '' then
    return json_build_object('success', false, 'error', 'Invalid join code');
  end if;

  select i.id, i.name into v_inst, v_name
    from institutes i
   where upper(i.join_code) = v_code and coalesce(i.is_active, true)
   limit 1;

  if v_inst is null then
    select d.institute_id, i.name, d.id into v_inst, v_name, v_dept
      from departments d join institutes i on i.id = d.institute_id
     where upper(d.teacher_code) = v_code and coalesce(d.is_active, true) and coalesce(i.is_active, true)
     limit 1;
  end if;

  if v_inst is null then
    return json_build_object('success', false, 'error', 'Invalid join code');
  end if;

  if exists (select 1 from institute_members where institute_id = v_inst and user_id = auth.uid()) then
    return json_build_object('success', false, 'error', 'Already a member',
                             'institute_id', v_inst, 'institute_name', v_name);
  end if;

  insert into institute_members (institute_id, user_id, role, status, joined_at, department_id)
  values (v_inst, auth.uid(), 'teacher', 'active', now(), v_dept);

  return json_build_object('success', true, 'institute_id', v_inst, 'institute_name', v_name,
                           'department_id', v_dept);
end;
$function$;

create or replace function public.create_institute(p_name text, p_slug text default null::text)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_institute_id uuid;
  v_slug text;
begin
  if auth.uid() is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Institute name is required'; end if;

  v_slug := coalesce(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]', '-', 'g')));

  insert into institutes (name, slug, owner_id)
  values (trim(p_name), v_slug, auth.uid())
  returning id into v_institute_id;

  insert into institute_members (institute_id, user_id, role, status, joined_at)
  values (v_institute_id, auth.uid(), 'admin', 'active', now());

  return v_institute_id;
end;
$function$;

-- ════════════════════════════════════════════════════════════════════
-- C. Who may execute what
--    (revoke from PUBLIC too: functions are PUBLIC-executable by default; re-grant authenticated explicitly)
-- ════════════════════════════════════════════════════════════════════
do $$
declare f text;
begin
  -- signed-in users only
  foreach f in array array[
    'public.get_monthly_attendance(uuid, integer, integer, uuid)',
    'public.get_proctor_section_status(uuid, date)',
    'public.get_hod_department_overview(uuid, date)',
    'public.get_member_directory(uuid)',
    'public.generate_student_access_codes(uuid)',
    'public.assign_proctor(uuid, uuid, uuid, uuid)',
    'public.create_timetable_slot(uuid, uuid, uuid, uuid, smallint, time without time zone, time without time zone, text)',
    'public.delete_timetable_slot(uuid)',
    'public.join_institute_by_code(text)',
    'public.create_institute(text, text)',
    'public.generate_daily_sessions(uuid, date)',
    'public.mark_attendance(uuid, uuid, uuid, date, uuid, text, jsonb)',
    'public.edit_attendance(uuid, uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;

  -- legacy one-off tools / broken join path: nobody from the browser
  foreach f in array array[
    'public.migrate_legacy_attendance(uuid, uuid, boolean)',
    'public.list_legacy_attendance_batches(uuid)',
    'public.join_institute(text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- D. Table policies
-- ════════════════════════════════════════════════════════════════════

-- institutes: no anonymous reads (join_code, owner_id), no direct inserts (create_institute RPC is used)
drop policy if exists "Public read institutes" on public.institutes;
drop policy if exists anyone_creates_institute on public.institutes;

-- institute_members: own rows + members in my scope + everything for admins (writes unchanged: admin only)
drop policy if exists institute_members_select on public.institute_members;
drop policy if exists institute_members_select_scoped on public.institute_members;
create policy institute_members_select_scoped on public.institute_members for select to authenticated
  using (user_id = auth.uid()
      or institute_id in (select public.a4_my_admin_inst_ids())
      or id in (select public.a4_my_visible_member_ids()));

-- subjects: admin → all; common subjects (no dept) → any member; else subjects of departments I can see or teach
drop policy if exists subj_select on public.subjects;
drop policy if exists subj_select_scoped on public.subjects;
create policy subj_select_scoped on public.subjects for select to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or (department_id is null and public.is_institute_member(institute_id))
      or department_id in (select public.a4_my_visible_dept_ids())
      or id in (select ta.subject_id from public.teaching_assignments ta where ta.teacher_id = auth.uid())
      or id in (select ts.subject_id from public.timetable_slots ts where ts.teacher_id = auth.uid()));

drop policy if exists hod_insert on public.subjects;
create policy hod_insert on public.subjects for insert to authenticated
  with check (public.is_dept_hod(department_id)
          and exists (select 1 from public.departments d
                       where d.id = department_id and d.institute_id = subjects.institute_id));

-- ════════════════════════════════════════════════════════════════════
-- E. Storage
--    Public buckets still serve saved public URLs (/object/public/...) without a SELECT policy;
--    dropping SELECT only stops listing / API downloads of the whole bucket.
-- ════════════════════════════════════════════════════════════════════

-- submissions (student PDFs)
drop policy if exists "Public read submissions" on storage.objects;
drop policy if exists "Auth upload submissions" on storage.objects;
drop policy if exists a4_submissions_insert on storage.objects;
create policy a4_submissions_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'submissions' and public.a4_valid_submission_path(name));
update storage.buckets
   set allowed_mime_types = array['application/pdf'], file_size_limit = 10485760   -- 10 MB
 where id = 'submissions';

-- assignments (teacher attachments): path is "<institute_id or user_id>/<ts>_<file>"
drop policy if exists "Public read assignments" on storage.objects;
drop policy if exists "Auth upload assignments" on storage.objects;
drop policy if exists a4_assignments_insert on storage.objects;
create policy a4_assignments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'assignments'
          and ((storage.foldername(name))[1] = auth.uid()::text
            or (storage.foldername(name))[1] in (select i::text from public.my_institute_ids() as i)));

-- institute-assets (logo / banner at "<institute_id>/logo|banner"): only that institute's admins write
drop policy if exists auth_upload_institute_assets on storage.objects;
drop policy if exists auth_update_institute_assets on storage.objects;
drop policy if exists auth_delete_institute_assets on storage.objects;
drop policy if exists a4_inst_assets_insert on storage.objects;
drop policy if exists a4_inst_assets_update on storage.objects;
drop policy if exists a4_inst_assets_delete on storage.objects;
create policy a4_inst_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'institute-assets'
          and (storage.foldername(name))[1] in (select i::text from public.a4_my_admin_inst_ids() as i));
create policy a4_inst_assets_update on storage.objects for update to authenticated
  using      (bucket_id = 'institute-assets'
          and (storage.foldername(name))[1] in (select i::text from public.a4_my_admin_inst_ids() as i))
  with check (bucket_id = 'institute-assets'
          and (storage.foldername(name))[1] in (select i::text from public.a4_my_admin_inst_ids() as i));
create policy a4_inst_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'institute-assets'
     and (storage.foldername(name))[1] in (select i::text from public.a4_my_admin_inst_ids() as i));

-- question-images: nothing in the app deletes them; the "own" policy never matched the upload path
drop policy if exists "Authenticated users can delete question images" on storage.objects;
drop policy if exists "Users can delete own question images" on storage.objects;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (run after; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'anon cannot get_monthly_attendance', not has_function_privilege('anon', 'public.get_monthly_attendance(uuid,integer,integer,uuid)', 'execute')
-- union all select 'anon cannot migrate_legacy_attendance', not has_function_privilege('anon', 'public.migrate_legacy_attendance(uuid,uuid,boolean)', 'execute')
-- union all select 'anon cannot generate codes', not has_function_privilege('anon', 'public.generate_student_access_codes(uuid)', 'execute')
-- union all select 'authenticated can create_timetable_slot', has_function_privilege('authenticated', 'public.create_timetable_slot(uuid,uuid,uuid,uuid,smallint,time,time,text)', 'execute')
-- union all select 'no public institutes read', not exists (select 1 from pg_policies where tablename = 'institutes' and policyname = 'Public read institutes')
-- union all select 'no public submissions read', not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Public read submissions')
-- union all select 'portal RPCs still anon', has_function_privilege('anon', 'public.get_student_feed(text)', 'execute');
