-- 09_msit_video_reset.sql — clean MSIT for the screen-recorded demo (10 Oct 2026)
--
-- Keeps:   institute, ECE → ECE-2 (2025) → batches ECE-2 / A / B / C, owner (institutes.owner_id).
-- Removes: all 43 students (+ access codes, submissions, attendance via ON DELETE CASCADE),
--          subjects, teaching/proctor assignments, timetable, class sessions, posts, calendar events,
--          legacy batches.proctor_id / teacher_batches.
-- Members: every old MSIT member → status 'inactive', role 'teacher', dept/section NULL (reversible from backup).
--          4 new demo accounts (created in Auth dashboard) → active members, names set.
--          HOD and proctor are NOT set here — they are assigned in the video (admin → HOD, HOD → proctor).
--
-- Backup:  schema a4_backup_20261010 (contains student PII → drop it after the demo is verified).
-- Run AFTER 07_security_hardening.sql. Run the whole file at once in the SQL editor.
-- Any failed check rolls everything back.

begin;

do $$
declare
  v_inst uuid := '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
  v_missing text;
begin
  -- Guard: all 4 demo accounts must exist in auth.users
  select string_agg(e, ', ') into v_missing
  from unnest(array['admin.demo@msit.a4ai.in','hod.ece@msit.a4ai.in',
                    'proctor.ece2@msit.a4ai.in','teacher.ece2@msit.a4ai.in']) e
  where not exists (select 1 from auth.users u where lower(u.email) = e);
  if v_missing is not null then
    raise exception 'Create these users in Auth first: %', v_missing;
  end if;

  -- Guard: structure we keep must be there
  if not exists (select 1 from sections s join departments d on d.id = s.department_id
                 where d.institute_id = v_inst and d.name = 'ECE' and s.name = 'ECE-2') then
    raise exception 'ECE / ECE-2 not found — stop';
  end if;
end $$;

-- ── 1. Backup ────────────────────────────────────────────────────────────────
create schema if not exists a4_backup_20261010;
create table a4_backup_20261010.students as
  select * from students where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20261010.student_access_codes as
  select c.* from student_access_codes c join students s on s.id = c.student_id
  where s.institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20261010.institute_members as
  select * from institute_members where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20261010.batches as
  select * from batches where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20261010.calendar_events as
  select * from calendar_events where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';

-- ── 2. Data under the kept batches ───────────────────────────────────────────
delete from timetable_slots      where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
delete from teaching_assignments where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
delete from proctor_assignments  where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
delete from class_sessions  where batch_id in (select id from batches where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885');
delete from assignments     where batch_id in (select id from batches where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885');
delete from announcements   where batch_id in (select id from batches where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885');
delete from teacher_batches where batch_id in (select id from batches where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885');
delete from calendar_events where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
delete from subjects        where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
update batches set proctor_id = null where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';

-- ── 3. Students (cascades: student_access_codes, submissions, attendance_records, attendance_edit_log)
delete from students where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';

-- ── 4. Old members out (soft) ────────────────────────────────────────────────
update institute_members
set status = 'inactive', role = 'teacher', department_id = null, section_id = null
where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
  and user_id not in (select id from auth.users where lower(email) in
      ('admin.demo@msit.a4ai.in','hod.ece@msit.a4ai.in','proctor.ece2@msit.a4ai.in','teacher.ece2@msit.a4ai.in'));

-- ── 5. Demo members in ───────────────────────────────────────────────────────
update profiles pr set full_name = d.full_name
from (values
  ('admin.demo@msit.a4ai.in',   'MSIT Admin'),
  ('hod.ece@msit.a4ai.in',      'Dr. Rajesh Kumar'),
  ('proctor.ece2@msit.a4ai.in', 'Prof. Neha Sharma'),
  ('teacher.ece2@msit.a4ai.in', 'Prof. Vikram Singh')
) d(email, full_name)
join auth.users au on lower(au.email) = d.email
where pr.id = au.id;

insert into institute_members (institute_id, user_id, role, status, joined_at, department_id, user_email, user_name)
select '6563b6a1-6062-4e00-a9fe-3cf7ae77a885', au.id, d.role, 'active', now(),
       case when d.in_dept then (select id from departments
                                 where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885' and name = 'ECE') end,
       d.email, d.full_name
from (values
  ('admin.demo@msit.a4ai.in',   'MSIT Admin',         'admin',   false),
  ('hod.ece@msit.a4ai.in',      'Dr. Rajesh Kumar',   'teacher', true),
  ('proctor.ece2@msit.a4ai.in', 'Prof. Neha Sharma',  'teacher', true),
  ('teacher.ece2@msit.a4ai.in', 'Prof. Vikram Singh', 'teacher', true)
) d(email, full_name, role, in_dept)
join auth.users au on lower(au.email) = d.email
on conflict (institute_id, user_id) do update
set role = excluded.role, status = 'active', department_id = excluded.department_id,
    user_email = excluded.user_email, user_name = excluded.user_name, section_id = null;

-- ── 6. Verify (raises → whole file rolls back) ───────────────────────────────
do $$
declare v_inst uuid := '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'; n int;
begin
  select count(*) into n from students where institute_id = v_inst;
  if n <> 0 then raise exception 'students left: %', n; end if;
  select count(*) into n from institute_members where institute_id = v_inst and status = 'active';
  if n <> 4 then raise exception 'active members = %, expected 4', n; end if;
  select count(*) into n from batches where institute_id = v_inst;
  if n <> 4 then raise exception 'batches = %, expected 4', n; end if;
  raise notice 'OK: 0 students, 4 active members, 4 batches kept';
end $$;

commit;

-- Check after run (expect 4 rows):
--   select user_name, user_email, role, status, department_id from institute_members
--   where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885' and status = 'active';
--
-- Undo: restore from a4_backup_20261010 (students first, then student_access_codes,
--   then update institute_members / batches.proctor_id from the backup copies).
-- Cleanup after the demo is verified: drop schema a4_backup_20261010 cascade;
