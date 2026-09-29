# a4ai — Hierarchy & Access Control (MSIT build)

Ye file repo root me rakho. Claude Code har session me ise padhta hai — yahi "god-level context" hai.
Frontend → Supabase directly (no backend API for institute ops). **Authorization = Supabase RLS + SECURITY DEFINER RPCs. UI filtering is NOT security.**

## Hierarchy

```
Institute (owner / admin)
 └─ Department (ECE)            ← HOD (institute_members.role='hod', department_id)
     └─ Section (ECE-2, year)   ← Proctor / class teacher (proctor_assignments, 1 per section)
         ├─ main batch "ECE-2"  ← normal attendance + subject teachers (teaching_assignments)
         └─ lab batches "ECE-2 A/B/C"  ← lab attendance only
              └─ Students (students.section_id, batch_id = main batch; lab_batch_id = A/B/C — step 5)
```

## Access matrix (target)

| Who | Sees | Can change |
|---|---|---|
| Owner/Admin | whole institute, every dept | everything; assigns HODs, departments; unlimited attendance edits |
| HOD | ONLY own department: its sections, teachers teaching there, students, attendance (read) | create/delete sections, assign proctor + subject teachers, timetable, lab batches |
| Proctor | ONLY own section(s): students, all subjects + their teachers, all attendance of the section | correct marks ≤ 7 days (reason required, logged), mark on behalf of a teacher |
| Subject teacher | ONLY sections/batches they teach (teaching_assignments / timetable_slots) + those students | mark own classes (≤ 2 days), assignments/announcements/events only to own batches |
| Student (access code, no auth) | own profile, own section's + own lab batch's assignments/announcements/events — i.e. only from teachers assigned to them | submit assignments |

A teacher can be several at once (HOD + subject teacher, proctor + subject teacher). Role = union of scopes.

## ID conventions (do not break)
- `teaching_assignments.teacher_id`, `timetable_slots.teacher_id`, `teacher_batches.teacher_id`, `batches.proctor_id` = **auth user_id**
- `proctor_assignments.teacher_id` = **institute_members.id** (FK), UNIQUE(section_id)
- `teacher_batches` is LEGACY — do not use it for access (it's why teachers saw everything). Stop writing to it.
- MSIT institute_id `6563b6a1-6062-4e00-a9fe-3cf7ae77a885`

## Access helpers (supabase/migrations/01_access_helpers.sql)
`a4_is_inst_admin(inst)`, `a4_my_hod_dept_ids()`, `a4_my_proctor_section_ids()`, `a4_my_teaching_batch_ids()`,
`a4_can_view_section(id)`, `a4_can_manage_section(id)`, `a4_can_view_batch(id)`, `a4_can_view_student(id)`,
`get_my_access()` → `{institute_id, primary_role, home_route, hod_department_ids[], proctor_section_ids[], teaching_batch_ids[]}`.
All RLS policies and all dashboards must use these — never re-implement role logic in a component.

Existing attendance RPCs (keep, already scoped server-side): get_my_proctor_sections, get_section_context, get_proctor_section_day/monthly, get_section_edit_log, get_class_roster, save_class_attendance, get_teacher_day_sessions, get_my_teaching_targets, get_my_class_teachers, get_monthly_attendance, assign_proctor, create/delete_timetable_slot, get_member_directory.

## Audit findings (component by component, 29 Sep 2026)
1. **InstituteDashboardPage.fetchData** — any member (teacher/HOD) falls into the member branch and loads the WHOLE institute (batches, students, depts, sections). ← main reason HOD sees everything. Member lookup also has no `status='active'` filter. Must be admin-only; others redirect to their home_route.
2. **AdminDashboardPage (HOD)** — UI scoped to own dept, but loads all institute students/members. Route is `/admin`; move to `/hod`. Needs institute-dashboard look (step 3).
3. **HODAttendanceDashboard** — dept filter defaults to HOD dept but "All" is selectable; queries whole institute.
4. **TeacherStudentsTab** (~L242) — fallback to ALL institute batches when teacher has none (`allInstBatches.length > 0` is always true) → every teacher sees every student.
5. **TeacherAssignmentsTab** — batch list = all institute batches; assignment list = all institute assignments → teacher can post to any batch.
6. **TeacherCalendarTab** — all institute batches/events; `.single()` on members breaks for multi-row.
7. **TeacherAnalyticsTab** — mixes teaching_assignments + teacher_batches; verify it uses only teaching scope.
8. **InstituteTeacherPanel** — "My Batches" from legacy teacher_batches or whole department. Use `get_my_teaching_targets`.
9. **AssignTeacherModal** — writes legacy teacher_batches. Replace with HOD subject-assign flow or delete.
10. **InstituteAttendanceView** — 100% demo data (DEMO_TEACHERS). Delete or replace.
11. **StudentPortalPage** — anon client; assignments/announcements filtered by `batch_id` only. Anyone with anon key can read any batch. Lab-batch posts invisible to students. Needs access-code RPCs.
12. **StudentProfilePage** — reads legacy `attendance` JSONB table → always 0% under v2. Use attendance_records. Must be guarded by `a4_can_view_student`.
13. **PrivateRoute** — only checks session, no role. Add RoleRoute on `get_my_access()`.
14. **AttendancePage / TeacherAttendanceView / ProctorSectionView** — already server-scoped via RPCs. Keep.

## Steps (one per Claude Code session, one git commit each)
- **0. Audit** — run `00_audit_schema.sql`, save output to `supabase/audit_2026-09-29.csv`. Use it before writing any policy.
- **1. Login barrier** — apply 01_access_helpers.sql. `AccessProvider` (context) calls `get_my_access()` once after login; `RoleRoute allow={["admin"]}` etc.; `/institute` admin-only, `/hod` HOD (+admin preview), `/dashboard` teachers; login redirects to `home_route`.
- **2. RLS** — replace SELECT/INSERT/UPDATE/DELETE policies on departments, sections, batches, students, subjects, teaching_assignments, proctor_assignments, timetable_slots, class_sessions, attendance_records, calendar_events, assignments, announcements (staff side) using the helpers. Do NOT break anon student-portal reads until step 5. Write as a migration file; human runs it.
- **3. HOD dashboard UI** — same shell as InstituteDashboardPage (sidebar, stat cards, header, buttons) with tabs: Overview · Sections · Teachers · Students · Attendance · Timetable. Dept-scoped data only.
- **4. Proctor & teacher scoping** — fix findings 3–10.
- **5. Student portal** — `students.lab_batch_id`, `batches.is_lab`; SECURITY DEFINER RPCs keyed by access code (`get_student_feed(code)`, `submit_assignment(code, …)`); then remove anon table policies.
- **6. Clean reset + fresh run** — delete MSIT depts/sections/batches/students/attendance (script generated from audit FKs), re-create ECE → ECE-2 (2025) → upload `ECE-2_2025_students_upload.xlsx`.

## Progress log (update after every step)
- [x] Step 0: `00_audit_schema.sql` run on live DB (29 Sep). Full CSV → save as `supabase/audit_2026-09-29.csv` (306 rows).
- [x] `01_access_helpers.sql` applied on live DB (29 Sep, "Success"). All 9 functions exist.
- [x] Step 1 (first pass, committed): `src/context/AccessProvider.tsx`, `src/components/routing/RoleRoute.tsx`, App.tsx routes wrapped (`/institute` admin, `/hod` admin+hod, `/dashboard` all staff), AccessProvider wrapped in main.tsx, login redirects to `home_route`.
  These were written in chat WITHOUT seeing the repo — import paths (`./AuthContext`, `../lib/supabase`) may be wrong. Verify against real files.
- [x] Step 1 fix (committed): AccessProvider exposes `{ access, loading }`, RoleRoute shows "Loading…", `/admin` → `/hod` redirect. `npm run build` passes.
- [ ] Step 1 test: admin→/institute, HOD→/hod (typing /institute bounces back), teacher→/dashboard, F5 keeps session.
- [x] Step 2 written: `02_rls_policies.sql` + `02_rls_rollback.sql`. Pre-flight: only 3 test teachers on legacy teacher_batches (Aakash, Nitin, proctor@msit) — accepted.
- [x] Step 2 code cross-check (29 Sep). B1 (INSERT…RETURNING fails SELECT policy for new section) → FIXED in 02 with column-based OR on dept/sec/batch SELECT.
- [x] Step 2 applied on live DB + tested. HOD test pass (29 Sep): teacher@msit.a4ai.in promoted to hod ECE for testing; sees only ECE (7 batches, 45 students).
- Known after Step 2 (accepted, fix later):
  - ~~B2~~ (fixed in Step 5 code — portal uses supabasePortalClient): StudentPortalPage uses the shared persisted client → if staff is logged in in the same browser, portal requests carry staff JWT and anon policies don't apply. Test portal in incognito. Fix in Step 5 (separate non-persisted client or access-code RPCs).
  - B3: teachers only on legacy teacher_batches see empty dashboards until HOD assigns them via teaching_assignments.
  - HOD still sees ALL institute `institute_members` and `subjects` (AdminDashboardPage.tsx:275-277) — needs policies in a separate migration (02b), after checking every component that reads institute_members.
  - ~~UI still shows actions RLS now blocks: teacher "Add student" (TeacherStudentsTab:405), teacher "All batches" calendar event (TeacherCalendarTab:245). Access-code insert at TeacherStudentsTab:422 ignores errors.~~ Fixed in Step 4.
  - JoinInstitutePage fallback (:143-186) is broken (upsert ignores errors, shows "Joined!"). Main path is join_institute_by_code RPC.
  - ~~HODDashboardPage.tsx is dead code; /hod renders AdminDashboardPage.~~ Fixed in Step 3.
  - Unverified: whether join_institute_by_code / create_timetable_slot / assign_proctor / get_member_directory check the caller's role (definitions not in repo).
  - BulkStudentUpload: ALWAYS pick dept + section in the dropdown, else department_id/section_id go null and only admin sees those students.
- [x] Step 3 (29 Sep): `/hod` = `src/pages/hod/HODDashboardPage.tsx` (AdminDashboardPage deleted). Shell/classes shared via `src/pages/institute/dashboardTheme.tsx` (customStyles + Icons, moved verbatim from InstituteDashboardPage). Tabs Overview · Sections · Teachers · Students · Attendance · Timetable. Dept from `useAccess()` (HOD: hod_department_ids; admin preview: dept picker, no "All"); every query filters by department. New section = main batch + optional labs A/B/C (institute_id, department_id, section_id always set). Section delete only if 0 students + 0 class_sessions (batch delete cascades). Subject assign → teaching_assignments only, per batch (main/lab). Timetable via create/delete_timetable_slot with explicit batch. `HODAttendanceDashboard` got `lockDeptId` (no dept dropdown, no institute-wide fallback, sessions filtered by the dept's batches). `npm run build` passes.
- [x] Step 3 test (30 Sep, browser): HOD login → /hod shows only ECE; section create → 4 batches with institute_id/department_id/section_id set; subject assign on main batch only; section delete — all pass.
- Known after Step 3:
  - `get_proctor_section_day` / `get_proctor_section_monthly` definitions not in repo — may reject a non-proctor HOD. UI hides Overview "Today" strip + Attendance section cards on error (console.warn). Verify/fix HOD access in a 03 migration.
  - Cross-dept teacher search in HOD TeacherPicker reads `institute_members` directly (active, teacher/hod, max 10, only id/user_id/name/email) — `// TODO 02b` in code; replace with a scoped RPC once institute_members RLS lands.
  - HOD page still calls `get_member_directory(institute)` to fill missing names (only used for its own scoped member list) — include in the 02b review.
  - Pre-existing tsc errors (Vite build unaffected): App.tsx `<Toaster position>`, InstituteDashboardPage overview search `activeTab !== "students"` narrowing.
- [x] Step 4 (30 Sep): `src/hooks/useMyScope.ts` = the only source of teacher-side scope (useAccess: teaching_batch_ids + all batches of proctor_section_ids; admin = all institute batches; `canManageStudents`/`manageableBatches` = admin/HOD only). Never teacher_batches. Findings fixed:
  4 TeacherStudentsTab — no fallbacks; empty state "Aapko abhi koi batch assign nahi hua — HOD se contact karein"; Add student only admin/HOD, into manageableBatches, payload sets department_id + section_id; access-code insert error → toast.warning.
  5 TeacherAssignmentsTab — batch dropdown + assignment list = scope batches only (legacy teachers lose sight of old posts outside scope — accepted).
  6 TeacherCalendarTab — scoped batches/events/deadlines (+ institute-wide events); "All Batches (Public)" admin-only; no institute_members `.single()`.
  7 TeacherAnalyticsTab — scope from hook; teacher_batches + batches.proctor_id queries removed.
  8 InstituteTeacherPanel — My Batches from hook; own member row read multi-row safe; email auto-link update removed.
  9 AssignTeacherModal deleted (it wrote to non-existent `batch_teachers`). Admin "📚 Batches" modal/teacher card now read + write `teaching_assignments` (assign = batch + subject; remove = delete TA rows). No `.insert/.update/.upsert` on teacher_batches left in src (only the legacy cleanup delete in removeTeacher).
  10 InstituteAttendanceView deleted (was lazy-imported, never rendered).
  12 StudentProfilePage — `a4_can_view_student` RPC first ("Access nahi hai" on false/error); attendance from attendance_records + class_sessions.session_date (% = present / all marked, leave in total); route wrapped in RoleRoute (all staff).
  Realtime callbacks in Assignments/Calendar call the latest loadData via ref (else they reload with an empty scope). `npm run build` passes. No 03 migration needed.
- [x] Step 4 test (30 Sep, browser): proctor.ece (only CSE-1 DSA), nitin.test (empty state), proctor@msit (ECE-1 + lab A) — pass.
- Known after Step 4:
  - TeacherStudentsTab attendance % still reads legacy `attendance` JSONB table (shows 0% under v2) — switch to attendance_records like StudentProfilePage.
  - HODAttendanceDashboard still READS teacher_batches (display mapping only, not scope). Remove when convenient.
  - `src/hooks/useInstituteTeacher.ts` is unused and reads non-existent `batch_teachers` — delete later.
  - "My Section" (get_my_proctor_sections) also shows a legacy section via batches.proctor_id — re-check after the Step 6 reset.
- [x] Step 5 code (30 Sep): `05_student_portal.sql` (batches.is_lab + backfill " A/B/C", students.lab_batch_id; private `a4_student_id_from_code` with explicit REVOKE; RPCs `get_student_by_code` (volatile, updates last_used_at), `get_student_feed` (own batch + lab batch; announcements/events also institute-wide), `submit_assignment` (own batch/lab only, file path must be `<inst>/<assignment>/<student>_…`, graded = locked); grant to anon+authenticated). `05b_drop_anon_policies.sql` drops anon_read/anon_submit/anon_verify_code ("Public read institutes" kept, commented). Frontend: `src/lib/supabasePortalClient.ts` (persistSession/autoRefresh off, own storageKey) → StudentPortalPage uses only the 3 RPCs + storage upload (no `.from()` on tables; chat is localStorage-only since `batch_messages` doesn't exist); feed polls every 60 s + on focus; StudentCalendar has no DB access (events via props). HOD new section/lab batch sets is_lab. BulkStudentUpload: `lab_batch` column → lab_batch_id (same section; "ECE-2 A" or "A"), section/department fall back to the matched batch, exact batch-name match first (was able to pick "ECE-2 A" for "ECE-2"). Teacher side: labs in scope for proctors / teachers assigned to a lab; no teacher UI posts announcements. Anon-read grep: only StudentPortalPage + StudentCalendar read tables without login (JoinInstitutePage is PrivateRoute; debug-dashboard.tsx not routed). `npm run build` passes.
- [ ] Step 5 DB: run `05_student_portal.sql` → deploy frontend → test portal in incognito (login, feed incl. lab batch items, PDF submit) → then run `05b_drop_anon_policies.sql` → re-test portal + `supabase.from('students').select('*')` as anon returns [].
- Known after Step 5:
  - anon can read institutes.join_code → anyone can join MSIT as teacher → then sees institute_members (02b leak). Replace with get_institute_public() RPC (name/logo only). ("Public read institutes" kept, commented, in 05b.)
  - Storage bucket "submissions": check the anon upload policy — path-restricted (`<inst>/<assignment>/<student>_…`) or whole bucket open? submit_assignment only accepts own-path URLs, but uploads themselves are governed by storage policies.
  - Access codes are 6 digits → anon can brute-force get_student_by_code. Needs longer codes or throttling (edge function).
  - `announcements.batch_id` is NOT NULL, so institute-wide announcements can't exist yet (feed already handles batch_id null).
  - BulkStudentUpload auto-maps a "phone" column (student's phone) to parent_phone (alias list); students has no phone column. Check mapping in preview.
  - Pre-existing tsc error: StudentCalendar `color2` style prop.

## Test matrix (after every step)
5 logins: admin · HOD ECE · proctor ECE-2 · subject teacher (ECE-2 only) · subject teacher of another dept · + 1 student access code.
Each must see only its row of the access matrix. Also try direct Supabase queries from browser console (`supabase.from('students').select('*')`) — RLS must return only scoped rows.

## Rules for Claude
- Plan first, show the diff, then edit. Never run destructive SQL on the live DB — write migration files, the human runs them.
- Hinglish replies, direct and honest.
