-- 40_teaching_assignment_integrity_rollback.sql — undo 40. Policies go back to the LIVE definitions of 22 Nov 2026
-- (read-only dump: ta_insert / ta_update = is_institute_admin(institute_id); hod_insert = HOD of the batch's department).
-- This re-opens the audit gap (teacher / batch / subject of another institute are accepted again) — only roll back if needed.
-- Rows already written keep their (trigger-derived) subject_id.

begin;

drop trigger if exists a4_member_cleanup_ta on public.institute_members;
drop trigger if exists a4_ta_before_write on public.teaching_assignments;
drop function if exists public.a4_member_cleanup_ta();
drop function if exists public.a4_ta_before_write();

drop policy if exists ta_insert on public.teaching_assignments;
create policy ta_insert on public.teaching_assignments for insert to public
  with check (is_institute_admin(institute_id));

drop policy if exists hod_insert on public.teaching_assignments;
create policy hod_insert on public.teaching_assignments for insert to public
  with check (exists (select 1 from batches b where b.id = teaching_assignments.batch_id and is_dept_hod(b.department_id)));

drop policy if exists ta_update on public.teaching_assignments;
create policy ta_update on public.teaching_assignments for update to public
  using (is_institute_admin(institute_id));

drop function if exists public.a4_ta_links_ok(uuid, uuid, uuid, uuid);

commit;
-- notify pgrst, 'reload schema';
