-- 33_student_batches_rollback.sql — undo 33_student_batches.sql.
-- students.batch_id / lab_batch_id were never changed by 33, so the old behaviour comes back as is.
-- EXTRA batch memberships (rows in student_batches that are not the student's batch_id / lab_batch_id) are LOST.
-- Keep them first if needed:  create table a4_backup_<date>.student_batches as select * from public.student_batches;

begin;

drop function if exists public.bulk_add_students(uuid, jsonb);
drop function if exists public.set_student_batches(uuid[], uuid[], uuid[]);

drop policy if exists stu_select_batch_member on public.students;

-- a4_can_view_student back to the live definition of 20 Nov 2026 (before 33)
create or replace function public.a4_can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students st
    where st.id = p_student_id and (
         public.a4_is_inst_admin(st.institute_id)
      or (st.batch_id   is not null and public.a4_can_view_batch(st.batch_id))
      or (st.section_id is not null and public.a4_can_view_section(st.section_id))
      or (st.section_id is null and st.batch_id is null
          and st.department_id in (select public.a4_my_hod_dept_ids()))
    ));
$$;

drop trigger if exists a4_sync_student_batches on public.students;
drop function if exists public.a4_sync_student_batches();

drop table if exists public.student_batches;   -- drops its policies, guard trigger and index
drop function if exists public.a4_student_batches_guard();
drop function if exists public.a4_my_batch_member_student_ids();
drop function if exists public.a4_my_scoped_student_ids();
drop function if exists public.a4_batch_institute(uuid);

commit;

notify pgrst, 'reload schema';
