-- 05b_drop_anon_policies.sql — Step 5, part 2. Run ONLY AFTER the new student portal (05 RPCs) is tested.
-- Removes the temporary anon table policies that 02_rls_policies.sql kept for the old portal.
-- After this, anon can't read any of these tables directly; the portal only uses the 05 RPCs.
--
-- Checked before writing (30 Sep): the only code that reads these tables WITHOUT login was
-- StudentPortalPage + StudentCalendar (both moved to RPCs in Step 5). JoinInstitutePage is behind
-- PrivateRoute; debug-dashboard.tsx is not routed; no student self-signup uses departments.student_code.
--
-- Rollback: re-run section C of 02_rls_policies.sql.

begin;

drop policy if exists anon_read on public.departments;
drop policy if exists anon_read on public.batches;
drop policy if exists anon_read on public.students;
drop policy if exists anon_read on public.assignments;
drop policy if exists anon_read on public.announcements;
drop policy if exists anon_read on public.calendar_events;
drop policy if exists anon_read on public.teacher_batches;
drop policy if exists anon_read on public.submissions;
drop policy if exists anon_submit on public.submissions;
drop policy if exists anon_verify_code on public.student_access_codes;

-- NOT dropped on purpose — "Public read institutes" (USING true, roles=public):
--   anon can read institutes.join_code / owner_id. Needs a get_institute_public() RPC (name/logo only)
--   and a check of landing/join/signup pages first. See CLAUDE.md "Known after Step 5".
-- drop policy if exists "Public read institutes" on public.institutes;

commit;

-- TEST (after running), in an incognito window at /student:
--   login with a code → profile, assignments, announcements, calendar load; submit a PDF works.
-- And from the browser console of that page (anon):
--   supabase.from('students').select('*')   → [] (no rows)
