-- 06_restore_msit.sql — UNDO for 06_reset_msit.sql. Puts MSIT rows back from schema a4_backup_20260930.
-- ONE transaction, parents first (reverse of the delete order). Human runs it.
--
-- Use it right after the reset (before the fresh run). After a fresh run it would bring the OLD
-- departments/sections back next to the new ones (duplicate names like two "ECE").
-- Assumes the table columns haven't changed since the backup (insert … select *).
-- `on conflict (id) do nothing` → rows that still exist are skipped, so it is safe to re-run.

begin;

insert into public.departments          select * from a4_backup_20260930.departments          on conflict (id) do nothing;
insert into public.sections             select * from a4_backup_20260930.sections             on conflict (id) do nothing;
insert into public.batches              select * from a4_backup_20260930.batches              on conflict (id) do nothing;
insert into public.subjects             select * from a4_backup_20260930.subjects             on conflict (id) do nothing;
insert into public.teacher_batches      select * from a4_backup_20260930.teacher_batches      on conflict (id) do nothing;
insert into public.students             select * from a4_backup_20260930.students             on conflict (id) do nothing;
insert into public.student_access_codes select * from a4_backup_20260930.student_access_codes on conflict (id) do nothing;
insert into public.calendar_events      select * from a4_backup_20260930.calendar_events      on conflict (id) do nothing;
insert into public.announcements        select * from a4_backup_20260930.announcements        on conflict (id) do nothing;
insert into public.assignments          select * from a4_backup_20260930.assignments          on conflict (id) do nothing;
insert into public.submissions          select * from a4_backup_20260930.submissions          on conflict (id) do nothing;
insert into public.proctor_assignments  select * from a4_backup_20260930.proctor_assignments  on conflict (id) do nothing;
insert into public.teaching_assignments select * from a4_backup_20260930.teaching_assignments on conflict (id) do nothing;
insert into public.timetable_slots      select * from a4_backup_20260930.timetable_slots      on conflict (id) do nothing;
insert into public.class_sessions       select * from a4_backup_20260930.class_sessions       on conflict (id) do nothing;
insert into public.attendance_records   select * from a4_backup_20260930.attendance_records   on conflict (id) do nothing;
insert into public.attendance_edit_log  select * from a4_backup_20260930.attendance_edit_log  on conflict (id) do nothing;
-- legacy tables (added 30 Sep after the guard found them)
insert into public.attendance_sessions  select * from a4_backup_20260930.attendance_sessions  on conflict (id) do nothing;
insert into public.batch_teachers       select * from a4_backup_20260930.batch_teachers       on conflict (id) do nothing;
insert into public.attendance_legacy    select * from a4_backup_20260930.attendance_legacy    on conflict (id) do nothing;

-- Re-link members to their old department / section
update public.institute_members m
   set department_id = b.department_id,
       section_id    = b.section_id
  from a4_backup_20260930.institute_members_links b
 where m.id = b.id;

commit;

-- VERIFY: counts should match the "backup" column of 06_reset_msit.sql's final query.
--   select count(*) from public.students where institute_id = '6563b6a1-6062-4e00-a9fe-3cf7ae77a885';