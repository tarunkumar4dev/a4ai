-- 02_rls_policies.sql — Step 2: hierarchy-scoped RLS for staff (authenticated users).
-- Written from supabase/audit_2026-09-29.csv (29 Sep 2026). Requires 01_access_helpers.sql (already applied).
--
-- WHAT THIS DOES
--   * Staff (role = authenticated) only see rows in their scope:
--       admin/owner → whole institute · HOD → own dept · proctor → own section(s) · teacher → sections they teach
--   * The old "Public read … USING true" policies are kept, but ONLY for role `anon` (student portal, until Step 5).
--     Before this, they applied to logged-in staff too, and that is why HOD/teachers saw everything.
--   * Attendance write policies, subject policies and all SECURITY DEFINER RPCs are NOT touched.
--
-- HOW TO RUN
--   1) Run the PRE-FLIGHT query at the bottom first (it's commented out). Read its output.
--   2) Run this whole file in the Supabase SQL editor. It is one transaction: if anything fails, nothing changes.
--   3) If something breaks in the app → run 02_rls_rollback.sql (restores the exact old policies).

begin;

-- ════════════════════════════════════════════════════════════════════
-- A. Set-returning scope helpers (SECURITY DEFINER → no RLS recursion).
--    Policies use `col in (select fn())`, which Postgres evaluates ONCE per query, not per row.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.a4_my_admin_inst_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select i.id from institutes i where i.owner_id = auth.uid()
  union
  select m.institute_id from institute_members m
  where m.user_id = auth.uid() and m.status = 'active' and m.role in ('admin','institute');
$$;

create or replace function public.a4_my_visible_section_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from sections s join departments d on d.id = s.department_id
  where d.institute_id in (select public.a4_my_admin_inst_ids())
     or s.department_id in (select public.a4_my_hod_dept_ids())
     or s.id in (select public.a4_my_proctor_section_ids())
     or s.id in (select b.section_id from batches b
                 where b.id in (select public.a4_my_teaching_batch_ids()) and b.section_id is not null);
$$;

-- Teaching one batch of a section (e.g. main "ECE-2") makes the whole section visible,
-- including its lab batches A/B/C — same rule as a4_can_view_batch in 01.
create or replace function public.a4_my_visible_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select b.id from batches b
  where b.institute_id in (select public.a4_my_admin_inst_ids())
     or b.section_id  in (select public.a4_my_visible_section_ids())
     or b.department_id in (select public.a4_my_hod_dept_ids())
     or b.id in (select public.a4_my_teaching_batch_ids());
$$;

create or replace function public.a4_my_visible_dept_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select d.id from departments d where d.institute_id in (select public.a4_my_admin_inst_ids())
  union select public.a4_my_hod_dept_ids()
  union select s.department_id from sections s where s.id in (select public.a4_my_visible_section_ids())
  union select b.department_id from batches b
        where b.id in (select public.a4_my_teaching_batch_ids()) and b.department_id is not null;
$$;

-- Logged-in students (students.user_id) — keeps their existing access to their own batch.
create or replace function public.a4_my_student_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select st.batch_id from students st where st.user_id = auth.uid() and st.batch_id is not null;
$$;

create or replace function public.a4_my_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st where st.user_id = auth.uid();
$$;

create or replace function public.a4_section_dept(p_section_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.department_id from sections s where s.id = p_section_id;
$$;

-- Admin of the dept's institute, or HOD of that dept.
create or replace function public.a4_can_manage_dept(p_dept_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from departments d where d.id = p_dept_id and (
           d.institute_id in (select public.a4_my_admin_inst_ids())
        or d.id in (select public.a4_my_hod_dept_ids())));
$$;

grant execute on function
  public.a4_my_admin_inst_ids(), public.a4_my_visible_section_ids(), public.a4_my_visible_batch_ids(),
  public.a4_my_visible_dept_ids(), public.a4_my_student_batch_ids(), public.a4_my_student_ids(),
  public.a4_section_dept(uuid), public.a4_can_manage_dept(uuid)
to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- B. Tables rewritten completely: drop every existing policy on them.
--    (Many had 3–5 duplicate policies; one broad one was enough to leak.)
-- ════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename = any (array[
             'departments','sections','batches','students','calendar_events','assignments',
             'announcements','submissions','teacher_batches','student_access_codes'])
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Tables where only the leaky SELECT policy is replaced (writes are already scoped / go through RPCs).
drop policy if exists cs_select   on public.class_sessions;
drop policy if exists ar_select   on public.attendance_records;
drop policy if exists ael_select  on public.attendance_edit_log;
drop policy if exists ta_select   on public.teaching_assignments;
drop policy if exists tt_select   on public.timetable_slots;
drop policy if exists member_read on public.proctor_assignments;

-- ════════════════════════════════════════════════════════════════════
-- C. Student portal (anon) — same as before, but anon ONLY. Removed in Step 5.
-- ════════════════════════════════════════════════════════════════════
create policy anon_read on public.departments          for select to anon using (true);
create policy anon_read on public.batches              for select to anon using (true);
create policy anon_read on public.students             for select to anon using (true);
create policy anon_read on public.assignments          for select to anon using (true);
create policy anon_read on public.announcements        for select to anon using (true);
create policy anon_read on public.calendar_events      for select to anon using (true);
create policy anon_read on public.teacher_batches      for select to anon using (true);
create policy anon_read on public.submissions          for select to anon using (true);
create policy anon_submit on public.submissions        for insert to anon with check (true);
create policy anon_verify_code on public.student_access_codes for select to anon using (is_active = true);

-- ════════════════════════════════════════════════════════════════════
-- D. Staff policies (authenticated)
-- ════════════════════════════════════════════════════════════════════

-- departments ───────────────────────────────────────────────────────
-- NOTE (B1 fix): every *_select below also has a column-based OR. INSERT … RETURNING (.insert().select())
-- checks the NEW row against the SELECT policy, and the set-returning helpers can't see a row inserted in
-- the same statement. The column check (institute_id / department_id) can.
create policy dept_select on public.departments for select to authenticated
  using (id in (select public.a4_my_visible_dept_ids())
      or institute_id in (select public.a4_my_admin_inst_ids()));
create policy dept_insert on public.departments for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids()));
create policy dept_update on public.departments for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()))
  with check (institute_id in (select public.a4_my_admin_inst_ids()));
create policy dept_delete on public.departments for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()));

-- sections ──────────────────────────────────────────────────────────
create policy sec_select on public.sections for select to authenticated
  using (id in (select public.a4_my_visible_section_ids())
      or public.a4_can_manage_dept(department_id));
create policy sec_insert on public.sections for insert to authenticated
  with check (public.a4_can_manage_dept(department_id));
create policy sec_update on public.sections for update to authenticated
  using (public.a4_can_manage_dept(department_id))
  with check (public.a4_can_manage_dept(department_id));
create policy sec_delete on public.sections for delete to authenticated
  using (public.a4_can_manage_dept(department_id));

-- batches ───────────────────────────────────────────────────────────
create policy batch_select on public.batches for select to authenticated
  using (id in (select public.a4_my_visible_batch_ids())
      or id in (select public.a4_my_student_batch_ids())
      or institute_id in (select public.a4_my_admin_inst_ids())
      or section_id in (select public.a4_my_visible_section_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))));
create policy batch_insert on public.batches for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))));
create policy batch_update on public.batches for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))));
create policy batch_delete on public.batches for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))));

-- students ──────────────────────────────────────────────────────────
create policy stu_select on public.students for select to authenticated
  using (user_id = auth.uid()
      or institute_id  in (select public.a4_my_admin_inst_ids())
      or batch_id      in (select public.a4_my_visible_batch_ids())
      or section_id    in (select public.a4_my_visible_section_ids())
      or department_id in (select public.a4_my_hod_dept_ids()));
-- Add/edit students: admin, HOD of the student's dept. Proctor can also edit (not add) own-section students.
create policy stu_insert on public.students for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id))));
create policy stu_update on public.students for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id)))
      or section_id in (select public.a4_my_proctor_section_ids()))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_manage_dept(coalesce(department_id, public.a4_section_dept(section_id)))
      or section_id in (select public.a4_my_proctor_section_ids()));
create policy stu_delete on public.students for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()));

-- teaching_assignments / timetable_slots / proctor_assignments: SELECT only (writes unchanged) ─
create policy ta_select_scoped on public.teaching_assignments for select to authenticated
  using (teacher_id = auth.uid() or batch_id in (select public.a4_my_visible_batch_ids()));
create policy tt_select_scoped on public.timetable_slots for select to authenticated
  using (teacher_id = auth.uid() or batch_id in (select public.a4_my_visible_batch_ids()));
create policy pa_select_scoped on public.proctor_assignments for select to authenticated
  using (section_id in (select public.a4_my_visible_section_ids()));

-- attendance: SELECT only (insert/update/delete policies unchanged) ─
create policy cs_select_scoped on public.class_sessions for select to authenticated
  using (batch_id in (select public.a4_my_visible_batch_ids()));
create policy ar_select_scoped on public.attendance_records for select to authenticated
  using (student_id in (select public.a4_my_student_ids())
      or session_id in (select cs.id from public.class_sessions cs
                        where cs.batch_id in (select public.a4_my_visible_batch_ids())));
create policy ael_select_scoped on public.attendance_edit_log for select to authenticated
  using (session_id in (select cs.id from public.class_sessions cs
                        where cs.batch_id in (select public.a4_my_visible_batch_ids())));

-- assignments / announcements / calendar_events ─────────────────────
-- See: own scope (+ logged-in student's own batch; + institute-wide events for all staff).
-- Post/edit: admin anywhere; others only as themselves, only into batches in their scope.
create policy asg_select on public.assignments for select to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or batch_id in (select public.a4_my_visible_batch_ids())
      or batch_id in (select public.a4_my_student_batch_ids()));
create policy asg_insert on public.assignments for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy asg_update on public.assignments for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy asg_delete on public.assignments for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()) or created_by = auth.uid());

create policy ann_select on public.announcements for select to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or batch_id in (select public.a4_my_visible_batch_ids())
      or batch_id in (select public.a4_my_student_batch_ids()));
create policy ann_insert on public.announcements for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy ann_update on public.announcements for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy ann_delete on public.announcements for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()) or created_by = auth.uid());

create policy cal_select on public.calendar_events for select to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or batch_id in (select public.a4_my_visible_batch_ids())
      or batch_id in (select public.a4_my_student_batch_ids())
      or (batch_id is null and public.is_institute_member(institute_id)));
create policy cal_insert on public.calendar_events for insert to authenticated
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy cal_update on public.calendar_events for update to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or (created_by = auth.uid() and batch_id in (select public.a4_my_visible_batch_ids())));
create policy cal_delete on public.calendar_events for delete to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()) or created_by = auth.uid());

-- submissions ───────────────────────────────────────────────────────
create policy sub_select on public.submissions for select to authenticated
  using (student_id in (select public.a4_my_student_ids())
      or assignment_id in (select a.id from public.assignments a
                           where a.institute_id in (select public.a4_my_admin_inst_ids())
                              or a.batch_id in (select public.a4_my_visible_batch_ids())));
create policy sub_insert_own on public.submissions for insert to authenticated
  with check (student_id in (select public.a4_my_student_ids()));
create policy sub_grade on public.submissions for update to authenticated
  using (assignment_id in (select a.id from public.assignments a
                           where a.institute_id in (select public.a4_my_admin_inst_ids())
                              or a.batch_id in (select public.a4_my_visible_batch_ids())));

-- teacher_batches (LEGACY) — own rows + admin only; nobody else writes to it any more ─
create policy tb_select on public.teacher_batches for select to authenticated
  using (teacher_id = auth.uid() or institute_id in (select public.a4_my_admin_inst_ids()));
create policy tb_admin_write on public.teacher_batches for all to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids()))
  with check (institute_id in (select public.a4_my_admin_inst_ids()));

-- student_access_codes — earlier ANY member could read/edit ALL codes (= log in as any student) ─
create policy sac_select on public.student_access_codes for select to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or public.a4_can_view_student(student_id));
create policy sac_write on public.student_access_codes for all to authenticated
  using (institute_id in (select public.a4_my_admin_inst_ids())
      or exists (select 1 from public.students st where st.id = student_id
                 and public.a4_can_manage_dept(coalesce(st.department_id, public.a4_section_dept(st.section_id)))))
  with check (institute_id in (select public.a4_my_admin_inst_ids())
      or exists (select 1 from public.students st where st.id = student_id
                 and public.a4_can_manage_dept(coalesce(st.department_id, public.a4_section_dept(st.section_id)))));

commit;

-- ════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT (run BEFORE the file above, separately). Lists teachers who today see batches ONLY via
-- legacy teacher_batches. After Step 2 they will see nothing until the HOD assigns them
-- (teaching_assignments / timetable). If the list is long, tell Claude before applying.
-- ════════════════════════════════════════════════════════════════════
-- select m.user_name, m.user_email, count(distinct tb.batch_id) as legacy_batches
-- from teacher_batches tb
-- join institute_members m on m.user_id = tb.teacher_id and m.institute_id = tb.institute_id
-- where not exists (select 1 from teaching_assignments ta where ta.teacher_id = tb.teacher_id)
--   and not exists (select 1 from timetable_slots ts where ts.teacher_id = tb.teacher_id)
-- group by 1, 2 order by 3 desc;

-- ════════════════════════════════════════════════════════════════════
-- TEST (after applying). SQL editor → "Role" dropdown (top of results) → impersonate a user → run:
--   select count(*) from students;          -- HOD: only own dept · teacher: only own sections
--   select name from departments;           -- HOD: only own dept
--   select name from batches order by 1;
-- ════════════════════════════════════════════════════════════════════
