-- 06_reset_msit.sql — Step 6: clean reset of MSIT academic data (institute 6563b6a1-6062-4e00-a9fe-3cf7ae77a885).
-- ONE transaction. Run in the Supabase SQL editor (as postgres, bypasses RLS). Human runs it — never automatic.
--
-- ⚠ Backup schema a4_backup_20260930 me students ka PII hai — fresh run verify hone ke 7 din baad
--   `drop schema a4_backup_20260930 cascade;`
--
-- WHAT IT DOES
--   0. Guard: aborts if any table OUTSIDE this script references the tables being emptied (audit only covered 21 tables).
--   1. Backup: schema a4_backup_20260930 with MSIT rows of every table below (+ members' department_id/section_id).
--      No "if not exists" on purpose → re-running fails instead of overwriting the backup.
--   2. Delete MSIT rows, children first (order from audit FKs):
--        attendance_edit_log → attendance_records → class_sessions → timetable_slots → teaching_assignments →
--        proctor_assignments → submissions → assignments → announcements → calendar_events (batch ones only) →
--        student_access_codes → students → teacher_batches → subjects → batches → sections → departments
--   3. NOT touched: institutes, institute_members rows/roles, auth users, institute-wide calendar events (batch_id null).
--      Members get department_id = NULL, section_id = NULL (their department is deleted). The HOD
--      (teacher@msit.a4ai.in) keeps role 'hod' but must be re-assigned to the new ECE department.
--   4. Verify: MSIT counts (all must be 0) + backup counts, as one result set.
--
-- UNDO right after running: 06_restore_msit.sql (from the backup schema).

begin;

-- ════════════════════════════════════════════════════════════════════
-- 0. Guard — every FK pointing at a table we empty must come from a table this script handles.
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  v_handled text[] := array[
    'attendance_edit_log','attendance_records','class_sessions','timetable_slots','teaching_assignments',
    'proctor_assignments','submissions','assignments','announcements','calendar_events','student_access_codes',
    'students','teacher_batches','subjects','batches','sections','departments','institute_members',
    -- found by this guard on the live DB (not in the audit):
    'batch_teachers','attendance_legacy','attendance_sessions'];
  v_bad text;
begin
  select string_agg(format('%s.%s → %s', src.relname, c.conname, tgt.relname), ', ')
    into v_bad
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_class tgt on tgt.oid = c.confrelid
    join pg_namespace n on n.oid = tgt.relnamespace
   where c.contype = 'f'
     and n.nspname = 'public'
     and tgt.relname = any (v_handled)
     and tgt.relname <> 'institute_members'          -- we only UPDATE members, never delete them
     and not (src.relname = any (v_handled));
  if v_bad is not null then
    raise exception 'Reset aborted — unhandled foreign keys reference MSIT tables: %. Add those tables to 06 first.', v_bad;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 1. Backup (MSIT rows only)
-- ════════════════════════════════════════════════════════════════════
create schema a4_backup_20260930;
-- PII inside: never reachable through the API roles.
revoke all on schema a4_backup_20260930 from public, anon, authenticated;

-- Review 30 Sep: child tables are ALSO backed up by parent link (batch/section/session/student), not only by
-- institute_id. Otherwise a row with NULL/mismatched institute_id would be removed by ON DELETE CASCADE
-- when its MSIT batch/student is deleted — without a backup copy, so 06_restore could not bring it back.

create table a4_backup_20260930.departments          as select * from public.departments          where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20260930.sections             as select * from public.sections             where department_id in (select id from a4_backup_20260930.departments);
create table a4_backup_20260930.batches              as select * from public.batches              where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or section_id in (select id from a4_backup_20260930.sections);
create table a4_backup_20260930.subjects             as select * from public.subjects             where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';
create table a4_backup_20260930.teacher_batches      as select * from public.teacher_batches      where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.students             as select * from public.students             where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches) or section_id in (select id from a4_backup_20260930.sections);
create table a4_backup_20260930.student_access_codes as select * from public.student_access_codes where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or student_id in (select id from a4_backup_20260930.students);
create table a4_backup_20260930.calendar_events      as select * from public.calendar_events      where batch_id is not null
     and (institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885' or batch_id in (select id from a4_backup_20260930.batches));
create table a4_backup_20260930.announcements        as select * from public.announcements        where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.assignments          as select * from public.assignments          where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.submissions          as select * from public.submissions
  where assignment_id in (select id from a4_backup_20260930.assignments)
     or student_id    in (select id from a4_backup_20260930.students);
create table a4_backup_20260930.proctor_assignments  as select * from public.proctor_assignments  where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or section_id in (select id from a4_backup_20260930.sections);
create table a4_backup_20260930.teaching_assignments as select * from public.teaching_assignments where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.timetable_slots      as select * from public.timetable_slots      where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.class_sessions       as select * from public.class_sessions       where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.attendance_records   as select * from public.attendance_records   where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or session_id in (select id from a4_backup_20260930.class_sessions) or student_id in (select id from a4_backup_20260930.students);
create table a4_backup_20260930.attendance_edit_log  as select * from public.attendance_edit_log  where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
     or session_id in (select id from a4_backup_20260930.class_sessions);
-- Legacy tables found by the guard (30 Sep) — backed up by their FK columns to MSIT parents.
create table a4_backup_20260930.batch_teachers      as select * from public.batch_teachers
  where batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.attendance_legacy   as select * from public.attendance_legacy
  where batch_id in (select id from a4_backup_20260930.batches);
create table a4_backup_20260930.attendance_sessions as select * from public.attendance_sessions
  where batch_id      in (select id from a4_backup_20260930.batches)
     or subject_id    in (select id from a4_backup_20260930.subjects)
     or department_id in (select id from a4_backup_20260930.departments)
     or section_id    in (select id from a4_backup_20260930.sections);
-- members: only what this script changes
create table a4_backup_20260930.institute_members_links as
  select id, department_id, section_id from public.institute_members
   where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';

-- ════════════════════════════════════════════════════════════════════
-- 2. Delete — children first (audit FKs). Each step deletes exactly the backed-up rows.
-- ════════════════════════════════════════════════════════════════════
delete from public.attendance_legacy    where id in (select id from a4_backup_20260930.attendance_legacy);
delete from public.batch_teachers       where id in (select id from a4_backup_20260930.batch_teachers);
delete from public.attendance_sessions  where id in (select id from a4_backup_20260930.attendance_sessions);
delete from public.attendance_edit_log  where id in (select id from a4_backup_20260930.attendance_edit_log);
delete from public.attendance_records   where id in (select id from a4_backup_20260930.attendance_records);
delete from public.class_sessions       where id in (select id from a4_backup_20260930.class_sessions);
delete from public.timetable_slots      where id in (select id from a4_backup_20260930.timetable_slots);
delete from public.teaching_assignments where id in (select id from a4_backup_20260930.teaching_assignments);
delete from public.proctor_assignments  where id in (select id from a4_backup_20260930.proctor_assignments);
delete from public.submissions          where id in (select id from a4_backup_20260930.submissions);
delete from public.assignments          where id in (select id from a4_backup_20260930.assignments);
delete from public.announcements        where id in (select id from a4_backup_20260930.announcements);
delete from public.calendar_events      where id in (select id from a4_backup_20260930.calendar_events);
delete from public.student_access_codes where id in (select id from a4_backup_20260930.student_access_codes);
delete from public.students             where id in (select id from a4_backup_20260930.students);
delete from public.teacher_batches      where id in (select id from a4_backup_20260930.teacher_batches);
delete from public.subjects             where id in (select id from a4_backup_20260930.subjects);
delete from public.batches              where id in (select id from a4_backup_20260930.batches);

-- 3. Members stay; unlink them from the departments/sections that are about to go
update public.institute_members
   set department_id = null, section_id = null
 where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'
   and (department_id is not null or section_id is not null);

delete from public.sections             where id in (select id from a4_backup_20260930.sections);
delete from public.departments          where id in (select id from a4_backup_20260930.departments);

commit;

-- ════════════════════════════════════════════════════════════════════
-- 4. Verify — "msit_now" must be 0 everywhere; "backup" = rows saved.
-- ════════════════════════════════════════════════════════════════════
with inst as (select '6563b6a1-6062-4e00-a9fe-3cf7ae77a885'::uuid as id)
select t.tbl, t.msit_now, t.backup from (
  select 'batch_teachers (legacy)' as tbl, (select count(*) from public.batch_teachers x where x.id in (select id from a4_backup_20260930.batch_teachers)) as msit_now, (select count(*) from a4_backup_20260930.batch_teachers) as backup, 0 as ord
  union all select 'attendance_legacy', (select count(*) from public.attendance_legacy x where x.id in (select id from a4_backup_20260930.attendance_legacy)), (select count(*) from a4_backup_20260930.attendance_legacy), 0
  union all select 'attendance_sessions (legacy)', (select count(*) from public.attendance_sessions x where x.id in (select id from a4_backup_20260930.attendance_sessions)), (select count(*) from a4_backup_20260930.attendance_sessions), 0
  union all
  select 'attendance_edit_log', (select count(*) from public.attendance_edit_log  where institute_id = (select id from inst)) as msit_now, (select count(*) from a4_backup_20260930.attendance_edit_log), 1
  union all select 'attendance_records',   (select count(*) from public.attendance_records   where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.attendance_records),   2
  union all select 'class_sessions',       (select count(*) from public.class_sessions       where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.class_sessions),       3
  union all select 'timetable_slots',      (select count(*) from public.timetable_slots      where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.timetable_slots),      4
  union all select 'teaching_assignments', (select count(*) from public.teaching_assignments where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.teaching_assignments), 5
  union all select 'proctor_assignments',  (select count(*) from public.proctor_assignments  where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.proctor_assignments),  6
  union all select 'submissions',          (select count(*) from public.submissions s where s.assignment_id in (select id from a4_backup_20260930.assignments) or s.student_id in (select id from a4_backup_20260930.students)), (select count(*) from a4_backup_20260930.submissions), 7
  union all select 'assignments',          (select count(*) from public.assignments          where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.assignments),          8
  union all select 'announcements',        (select count(*) from public.announcements        where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.announcements),        9
  union all select 'calendar_events (batch)', (select count(*) from public.calendar_events   where institute_id = (select id from inst) and batch_id is not null), (select count(*) from a4_backup_20260930.calendar_events), 10
  union all select 'student_access_codes', (select count(*) from public.student_access_codes where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.student_access_codes), 11
  union all select 'students',             (select count(*) from public.students             where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.students),             12
  union all select 'teacher_batches',      (select count(*) from public.teacher_batches      where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.teacher_batches),      13
  union all select 'subjects',             (select count(*) from public.subjects             where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.subjects),             14
  union all select 'batches',              (select count(*) from public.batches              where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.batches),              15
  union all select 'sections',             (select count(*) from public.sections s join public.departments d on d.id = s.department_id where d.institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.sections), 16
  union all select 'departments',          (select count(*) from public.departments          where institute_id = (select id from inst)), (select count(*) from a4_backup_20260930.departments),          17
  union all select 'members with dept/section', (select count(*) from public.institute_members where institute_id = (select id from inst) and (department_id is not null or section_id is not null)), (select count(*) from a4_backup_20260930.institute_members_links where department_id is not null or section_id is not null), 18
) t
order by t.ord;