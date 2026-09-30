-- 02_rls_rollback.sql — restores the EXACT policies from audit_2026-09-29.csv on every table 02 touched.
-- Use only if 02_rls_policies.sql breaks something. Helper functions from 02 are left in place (harmless).
begin;
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename = any (array[
    'departments','sections','batches','students','calendar_events','assignments','announcements','submissions','teacher_batches','student_access_codes','class_sessions','attendance_records','attendance_edit_log','teaching_assignments','timetable_slots','proctor_assignments'])
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy "Members manage announcements" on public.announcements for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Public read announcements" on public.announcements for select to public
  using (true);
create policy "Members manage assignments" on public.assignments for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Public read assignments" on public.assignments for select to public
  using (true);
create policy "ael_insert" on public.attendance_edit_log for insert to public
  with check (is_institute_member(institute_id));
create policy "ael_select" on public.attendance_edit_log for select to public
  using (is_institute_member(institute_id));
create policy "ar_delete" on public.attendance_records for delete to public
  using (is_institute_admin(institute_id));
create policy "ar_insert_admin" on public.attendance_records for insert to public
  with check (is_institute_admin(institute_id));
create policy "ar_insert_teacher" on public.attendance_records for insert to public
  with check ((is_institute_member(institute_id) AND (is_session_teacher(session_id) OR (EXISTS ( SELECT 1
   FROM (class_sessions cs
     JOIN batches b ON ((b.id = cs.batch_id)))
  WHERE ((cs.id = attendance_records.session_id) AND (b.proctor_id = auth.uid()) AND (cs.session_date >= (CURRENT_DATE - '2 days'::interval)))))) AND (EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = attendance_records.session_id) AND (cs.session_date = CURRENT_DATE))))));
create policy "ar_select" on public.attendance_records for select to public
  using (is_institute_member(institute_id));
create policy "ar_update_proctor" on public.attendance_records for update to public
  using ((is_institute_member(institute_id) AND ((EXISTS ( SELECT 1
   FROM (class_sessions cs
     JOIN batches b ON ((b.id = cs.batch_id)))
  WHERE ((cs.id = attendance_records.session_id) AND (b.proctor_id = auth.uid()) AND (cs.session_date >= (CURRENT_DATE - '2 days'::interval))))) OR is_institute_admin(institute_id))));
create policy "Admin can create batches" on public.batches for insert to public
  with check (is_institute_admin(institute_id));
create policy "Admin can delete batches" on public.batches for delete to public
  using (is_institute_admin(institute_id));
create policy "Admin can update batches" on public.batches for update to public
  using (is_institute_admin(institute_id));
create policy "Members can view batches" on public.batches for select to public
  using (is_institute_member(institute_id));
create policy "Public read batches" on public.batches for select to public
  using (true);
create policy "batches_admin_delete" on public.batches for delete to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "batches_admin_insert" on public.batches for insert to public
  with check ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "batches_admin_update" on public.batches for update to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "batches_institute_select" on public.batches for select to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "hod_insert" on public.batches for insert to public
  with check (is_dept_hod(department_id));
create policy "hod_update" on public.batches for update to public
  using (is_dept_hod(department_id));
create policy "Members manage calendar" on public.calendar_events for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Public read calendar" on public.calendar_events for select to public
  using (true);
create policy "cs_insert_admin" on public.class_sessions for insert to public
  with check (is_institute_admin(institute_id));
create policy "cs_insert_teacher" on public.class_sessions for insert to public
  with check ((is_institute_member(institute_id) AND (teacher_id = auth.uid())));
create policy "cs_select" on public.class_sessions for select to public
  using (is_institute_member(institute_id));
create policy "cs_update_admin" on public.class_sessions for update to public
  using (is_institute_admin(institute_id));
create policy "cs_update_teacher" on public.class_sessions for update to public
  using ((is_institute_member(institute_id) AND (teacher_id = auth.uid()) AND (session_date = CURRENT_DATE)));
create policy "Public read departments" on public.departments for select to public
  using (true);
create policy "admin_all" on public.departments for all to public
  using ((institute_id IN ( SELECT institutes.id
   FROM institutes
  WHERE (institutes.owner_id = auth.uid())
UNION
 SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text)))));
create policy "departments_delete_admin" on public.departments for delete to public
  using ((EXISTS ( SELECT 1
   FROM institute_members
  WHERE ((institute_members.institute_id = departments.institute_id) AND (institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "departments_insert_admin" on public.departments for insert to public
  with check ((EXISTS ( SELECT 1
   FROM institute_members
  WHERE ((institute_members.institute_id = departments.institute_id) AND (institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "departments_select" on public.departments for select to public
  using ((EXISTS ( SELECT 1
   FROM institute_members
  WHERE ((institute_members.institute_id = departments.institute_id) AND (institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "departments_update_admin" on public.departments for update to public
  using ((EXISTS ( SELECT 1
   FROM institute_members
  WHERE ((institute_members.institute_id = departments.institute_id) AND (institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "dept_delete" on public.departments for delete to public
  using (is_institute_admin(institute_id));
create policy "dept_insert" on public.departments for insert to public
  with check (is_institute_admin(institute_id));
create policy "dept_select" on public.departments for select to public
  using (is_institute_member(institute_id));
create policy "dept_update" on public.departments for update to public
  using (is_institute_admin(institute_id));
create policy "hod_read" on public.departments for select to public
  using ((id IN ( SELECT institute_members.department_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'hod'::text) AND (institute_members.status = 'active'::text)))));
create policy "teacher_read" on public.departments for select to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "admin_all" on public.proctor_assignments for all to public
  using ((institute_id IN ( SELECT institutes.id
   FROM institutes
  WHERE (institutes.owner_id = auth.uid()))))
  with check ((institute_id IN ( SELECT institutes.id
   FROM institutes
  WHERE (institutes.owner_id = auth.uid()))));
create policy "hod_manage" on public.proctor_assignments for all to public
  using ((department_id IN ( SELECT institute_members.department_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'hod'::text) AND (institute_members.status = 'active'::text)))));
create policy "hod_manage_proctors" on public.proctor_assignments for all to public
  using ((department_id IN ( SELECT institute_members.department_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'hod'::text) AND (institute_members.status = 'active'::text)))))
  with check ((department_id IN ( SELECT institute_members.department_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'hod'::text) AND (institute_members.status = 'active'::text)))));
create policy "member_read" on public.proctor_assignments for select to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "proctor_read_own" on public.proctor_assignments for select to public
  using ((teacher_id IN ( SELECT institute_members.id
   FROM institute_members
  WHERE (institute_members.user_id = auth.uid()))));
create policy "teacher_self" on public.proctor_assignments for select to public
  using ((teacher_id IN ( SELECT institute_members.id
   FROM institute_members
  WHERE (institute_members.user_id = auth.uid()))));
create policy "sections_manage" on public.sections for all to public
  using ((EXISTS ( SELECT 1
   FROM (departments d
     JOIN institute_members im ON ((im.institute_id = d.institute_id)))
  WHERE ((d.id = sections.department_id) AND (im.user_id = auth.uid()) AND (im.status = 'active'::text) AND ((im.role = 'admin'::text) OR ((im.role = 'hod'::text) AND (im.department_id = d.id)))))));
create policy "sections_select" on public.sections for select to public
  using ((EXISTS ( SELECT 1
   FROM (departments d
     JOIN institute_members im ON ((im.institute_id = d.institute_id)))
  WHERE ((d.id = sections.department_id) AND (im.user_id = auth.uid()) AND (im.status = 'active'::text)))));
create policy "Anyone can verify access code" on public.student_access_codes for select to public
  using ((is_active = true));
create policy "Members manage access codes" on public.student_access_codes for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Admin and teachers can add students" on public.students for insert to public
  with check (is_institute_member(institute_id));
create policy "Admin and teachers can update students" on public.students for update to public
  using (is_institute_member(institute_id));
create policy "Members can view students of their institute" on public.students for select to public
  using (is_institute_member(institute_id));
create policy "Only admin can delete students" on public.students for delete to public
  using (is_institute_admin(institute_id));
create policy "Public read students" on public.students for select to public
  using (true);
create policy "students_admin_delete" on public.students for delete to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "students_admin_insert" on public.students for insert to public
  with check ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "students_admin_update" on public.students for update to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "students_institute_select" on public.students for select to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "students_select" on public.students for select to public
  using (((user_id = auth.uid()) OR (institute_id IN ( SELECT my_institute_ids() AS my_institute_ids))));
create policy "Anyone can read submissions" on public.submissions for select to public
  using (true);
create policy "Anyone can submit" on public.submissions for insert to public
  with check (true);
create policy "Members grade submissions" on public.submissions for update to public
  using ((assignment_id IN ( SELECT a.id
   FROM assignments a
  WHERE (a.institute_id IN ( SELECT institute_members.institute_id
           FROM institute_members
          WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))))));
create policy "Members manage teacher_batches" on public.teacher_batches for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Public read teacher_batches" on public.teacher_batches for select to public
  using (true);
create policy "teacher_batches_admin_delete" on public.teacher_batches for delete to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "teacher_batches_admin_insert" on public.teacher_batches for insert to public
  with check ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.role = 'admin'::text) AND (institute_members.status = 'active'::text)))));
create policy "teacher_batches_institute_select" on public.teacher_batches for select to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "hod_delete" on public.teaching_assignments for delete to public
  using ((EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = teaching_assignments.batch_id) AND is_dept_hod(b.department_id)))));
create policy "hod_insert" on public.teaching_assignments for insert to public
  with check ((EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = teaching_assignments.batch_id) AND is_dept_hod(b.department_id)))));
create policy "ta_delete" on public.teaching_assignments for delete to public
  using (is_institute_admin(institute_id));
create policy "ta_insert" on public.teaching_assignments for insert to public
  with check (is_institute_admin(institute_id));
create policy "ta_select" on public.teaching_assignments for select to public
  using (is_institute_member(institute_id));
create policy "ta_update" on public.teaching_assignments for update to public
  using (is_institute_admin(institute_id));
create policy "tt_delete" on public.timetable_slots for delete to public
  using (is_institute_admin(institute_id));
create policy "tt_insert" on public.timetable_slots for insert to public
  with check (is_institute_admin(institute_id));
create policy "tt_select" on public.timetable_slots for select to public
  using (is_institute_member(institute_id));
create policy "tt_update" on public.timetable_slots for update to public
  using (is_institute_admin(institute_id));

commit;
