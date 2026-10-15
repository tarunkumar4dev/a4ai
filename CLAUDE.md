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
- [x] Step 5 DB (30 Sep): 05 applied (reviewed version — submit_assignment also requires the file URL to start with this project's storage host + text answer max 20000; repo file synced), RPC tests pass (code 15DEB3), 05b applied, anon count test = 0/0/0.
- Known after Step 5:
  - anon can read institutes.join_code → anyone can join MSIT as teacher → then sees institute_members (02b leak). Replace with get_institute_public() RPC (name/logo only). ("Public read institutes" kept, commented, in 05b.)
  - Storage bucket "submissions": check the anon upload policy — path-restricted (`<inst>/<assignment>/<student>_…`) or whole bucket open? submit_assignment only accepts own-path URLs, but uploads themselves are governed by storage policies.
  - Access codes are 6 digits → anon can brute-force get_student_by_code. Needs longer codes or throttling (edge function).
  - `announcements.batch_id` is NOT NULL, so institute-wide announcements can't exist yet (feed already handles batch_id null).
  - ~~BulkStudentUpload auto-maps a "phone" column to parent_phone~~ Fixed in Step 6 prep (exact-match pass first; phone → students.phone via 06a).
  - Pre-existing tsc error: StudentCalendar `color2` style prop.
- [x] Step 6 prep (30 Sep, files only): `06a_students_phone.sql` (students.phone + gender — TeacherStudentsTab "Add student" already sent both, so that insert was failing). BulkStudentUpload header mapping = exact pass first, then includes pass; one header → one field; new `phone` field; ECE-2 xlsx maps phone→phone, parent_phone→parent_phone, section→batch, year→class_level, lab_batch→lab_batch. `06_reset_msit.sql` (guard on unhandled FKs → backup schema a4_backup_20260930 → delete 17 tables child-first → members' dept/section NULL → verify counts) + `06_restore_msit.sql` (parents first, on conflict do nothing, re-link members).
- [x] Step 6 run (30 Sep): reset done (guard found legacy tables attendance_sessions / batch_teachers / attendance_legacy → added to 06 reset/restore), fresh ECE → ECE-2 (2025, labs A/B/C) → upload: 43 students with institute/department/section/batch/lab_batch set; HOD /hod shows 43; admin RLS count 43. Verified 4 Oct: ECE-2 main 43; lab A 15 / B 14 / C 14 (matches the xlsx).
- [x] Fix (30 Sep): /institute Students tab + batch cards showed 0 — `InstituteDashboardPage` students query embedded `batches(name)`, which became ambiguous once 05 added students.lab_batch_id (2nd FK to batches) → PostgREST PGRST201, error ignored (`if (d.data)`). Now `batches!batch_id(name)` + error toast.
- Known after Step 6 prep:
  - Any new `students → batches` embed must name the FK (`batches!batch_id(...)` / `batches!lab_batch_id(...)`). Unused `src/hooks/useInstituteTeacher.ts` still has the ambiguous `batches(name)` embed (another reason to delete it).
  - Backup schema a4_backup_20260930 contains students' PII — `drop schema a4_backup_20260930 cascade;` 7 days after the fresh run is verified.
- [x] Backup schema a4_backup_20260930 dropped (7 Oct, by human).
- [x] Step 7 code (7 Oct): `07_security_hardening.sql` written from a READ-ONLY dump of live function/policy definitions (`supabase db query --linked`). Fixes: get_monthly_attendance / get_proctor_section_status / get_hod_department_overview had NO permission check (anon-callable, leaked student names + attendance) → a4_can_view_batch / a4_can_manage_dept; generate_student_access_codes admin/HOD only + 8-char crypto-random codes; assign_proctor checks section ∈ dept ∈ institute (HOD could take another dept's section); create_timetable_slot takes institute from the batch (cross-institute write); join_institute_by_code case-insensitive + dept teacher_code + sign-in check; create_institute sign-in check; get_member_directory scoped; anon revoked on legacy write fns (migrate_legacy_attendance, mark/edit_attendance, join_institute…). Policies: dropped "Public read institutes" + anyone_creates_institute; institute_members SELECT = own + admin + a4_my_visible_member_ids(); subjects SELECT scoped, hod_insert checks dept's institute. Storage: no listing of submissions/assignments; submissions upload only to a valid `<inst>/<assignment>/<student>_<ts>.pdf` (a4_valid_submission_path), PDF ≤ 10 MB; assignments upload only own institute/uid folder; institute-assets writes admin-only; question-images deletes removed. New RPC search_institute_teachers (HOD picker). Frontend: portal upload upsert:false, JoinInstitutePage RPC-only + full reload after join, HOD picker uses the RPC, removed unused exec_sql debugQuery. `exec_sql` does not exist in DB. `npm run build` passes.
- [ ] Step 7 run: deploy frontend FIRST → run 07 → verify block at end of file → test: portal PDF submit, HOD assign proctor + timetable + cross-dept teacher search, admin logo upload, teacher join with code, teacher monthly attendance.
- Known after Step 7:
  - BatchManagementPanel calls `get_institute_members_info`, which doesn't exist (falls back silently).
  - handle_new_user links a student row to any new auth user with the same email (count = 1). Fine while email signups require confirmation; re-check if confirmation is ever disabled.
  - WhatsApp OTP: code + secrets ready; blocked on Meta ("WABA has no permission to create message template" even after payment method). Send SMS hook must stay OFF. Rotate the WhatsApp token + hook secret (both were pasted in chat) once it works.

- [x] Step 7 run (10 Oct): 07 applied on live DB (search_institute_teachers etc. exist, "Public read institutes" gone).
- [x] Demo reset (10 Oct): `09_msit_video_reset.sql` run — 0 students, ECE → ECE-2 + A/B/C kept, 14 old members `inactive`,
  4 demo accounts active: admin.demo / hod.ece / proctor.ece2 / teacher.ece2 @msit.a4ai.in (HOD + proctor assigned in the UI).
  Backup schema a4_backup_20261010 (student PII) → drop after the demo is verified.
- [x] Smart Assignment Checker v2 (10 Oct, Yash's v1 continued; backend `app/services/smart_assignment_service.py`):
  rubric of MARKING POINTS (paper + key, one call) → per-point verdicts with evidence → server computes marks (0.5 grid).
  JWT on all endpoints, pipeline in threadpool, Gemini files deleted, temperature 0 + seed, borderline/low-confidence → "Review".
  Eval: `python scripts/eval_smart_checker.py` (backend). Needs REAL handwritten sheets with teacher marks for a true accuracy number.
- [x] Phase 4 code (10 Oct): portal submissions. Teacher attaches a PRIVATE answer key (bucket `answer-keys`, row in
  `assignment_ai_keys` — never in `assignments`, which students can read) → Submissions → "✨ AI check" (rubric once, then
  1 request per submission, 3 parallel — serverless-safe) → review per point → "Approve & send" writes grade/feedback →
  student portal shows them (get_student_feed unchanged). Shared UI: `src/components/checker/AiGradeBreakdown.tsx`.
- [ ] Run `10_smart_assignment_checks.sql` then `11_assignment_ai_check.sql` (11 turns submissions.grade int → numeric).
- Known after Phase 4:
  - `assignments` and `submissions` storage buckets are PUBLIC — anyone with a file URL can read question papers / student
    submissions. Make `submissions` private + signed URLs (portal + teacher view) in a later step.
  - A logged-in student (a4_my_student_ids) can read their own submission row incl. `ai_*` before the teacher approves.
  - Old test checker (`test_checker_router`) also runs the Gemini pipeline on the event loop — same threadpool fix needed.

- [x] Check Copies P1 code (11 Oct): ONE checker = Test Generator page → tab "✅ Check Copies" (`?tab=check&test=<id>`).
  Old pages TestChecker.tsx + SmartAssignmentChecker.tsx deleted; /dashboard/test-checker + /dashboard/assignment-checker redirect there.
  Flow: New check (paper from Test History = rubric built from saved answers WITHOUT AI, or photos of paper + optional key)
  → class roster (batch) or quick-add → per student multi-page camera (compressed in browser, `src/lib/imageCompress.ts`)
  → "Done & next" queues the AI check (3 parallel, 1 request per copy) → review → approve. Test History rows: "Check copies".
  DB: `12_copy_checker.sql` (check_sessions, check_sheets, private bucket answer-sheets). Backend: `app/routers/copy_checker_router.py`.
- [ ] Run 10 → 11 → 12 (12 needs 10). Local backend `.env`: SUPABASE_SERVICE_KEY == anon key (backend warns) → private-bucket
  downloads and history inserts fail until the real service_role key is set (check Vercel env too).
- Next (P2): per-student PDF report + class summary, WhatsApp share (Web Share API / wa.me to parent_phone), results in portal.

- [x] Step 8 code (11 Oct): role hardening, from READ-ONLY live checks (`supabase db query --linked`). Findings: no RLS
  policy reads user_metadata (5 functions read only `full_name`); `handle_new_user` copied metadata role → profiles.role;
  every user could UPDATE own profiles.role (table-level grant); only `notes` policies trusted profiles.role and
  notes DELETE had no owner check; 10 + 11 were NOT applied on live. `13_role_hardening.sql`: handle_new_user
  role = valid metadata role, NULL if metadata has none (Google/phone), 'teacher' for junk ('admin');
  `a4_sync_profile_role` (auth.users AFTER UPDATE of metadata) copies a later choice (AuthCallback updateUser,
  RoleSelectionPage) into a NULL profile role once — without it 13 + the AuthCallback change made every Google
  signup a 'teacher' profile; trigger `a4_guard_profile_role` (app JWT may set role once NULL →
  student/teacher/institute, never change it; service_role/SQL editor pass); notes insert/delete owner-only (no
  UPDATE policy = denied); `submissions` bucket private + `a4_submissions_staff_read` (a4_can_read_submission_object).
  Frontend: RoleAuthGate lost its "admin" bypass (UX only, self-chosen role); `/admin/pyq` (localStorage mock, no DB)
  → RoleRoute admin; AuthCallback inserts role only on a new profile row, then updates name/email without role;
  teacher "View PDF" → signed URL (`src/lib/submissionFiles.ts`); portal shows "Submitted ✓" (no session to sign);
  HODAttendanceDashboard no longer reads teacher_batches; useInstituteTeacher.ts deleted. platform_admins skipped
  (nothing reads it yet). Generator backend (prod rag-backend-kappa-three.vercel.app): no-token POST → 401;
  `check_usage` RPC = monthly plan quota per JWT user + in-memory IP limit 20/min. `npm run build` passes.
- [ ] Step 8 run: 10 → 11 → 12_copy_checker → 13_role_hardening → VERIFY 1 + VERIFY 2 at end of 13 → deploy frontend → test teacher View PDF,
  portal submit, Google login of an existing user (profile name refresh, no error), Google signup from /signup as
  student → profiles.role = 'student'.
- Known after Step 8:
  - 10 profiles have metadata role ≠ profiles.role (7× meta teacher / profile student, 1× institute/student,
    1× student/teacher, 1× institute/teacher) — left as is; profiles.role only gates notes now.
  - DashboardPage (fills a NULL profile role) is not routed — dead code. 63 auth users have no profile row.
  - Students can't re-open their own submitted PDF in the portal. Needs a backend endpoint (access code → signed URL).
  - `assignments` bucket still public (question papers; TeacherAssignmentsTab stores getPublicUrl) — separate commit.
  - `notes` bucket public + "Public Access for notes" SELECT; notes row delete doesn't remove the file.
  - Generator quota: check before / record after → parallel requests can exceed the monthly limit; IP limiter is
    per serverless instance; every new free account gets a fresh quota.
  - `/dashboard/test-generator` (incl. Check Copies tab since 59d10ac) is public by design — backend enforces JWT.
  - HODAttendanceDashboard fallback C still maps teachers to dept batches with fake room/time when nothing is assigned.

- [x] Careers (11 Oct): /careers = 2 roles only (Android Developer, Backend Engineer) + apply form. `14_job_applications.sql`:
  `job_applications` (RLS on, no policies → read only in Supabase dashboard), private `resumes` bucket (anon insert-only,
  `<uuid>/resume.pdf`, PDF ≤ 5 MB), `submit_job_application` RPC (validates, resume must exist, 1 per email+job per 24 h).
  Job ids hard-coded in CareersPage + the RPC — change both when roles change.
- [x] 14 applied (11 Oct); first real application received (Android Developer, 11 Oct 23:33 IST).

- [x] Lite mode (12 Oct): app also ships as a Play Store WebView wrapper → `src/styles/lite.css` (imported in main.tsx)
  kills CSS animations/transitions/backdrop blur (spinners excepted) + `MotionConfig reducedMotion="always"` in App.tsx.
  Chatbot = `src/components/chat/StaticSarthi.tsx` (fixed answers, no AI/network; Groq/OpenRouter browser calls removed).
  HODDashboardPage lazy → main bundle 1049 KB → 462 KB. Don't add new animations; new UI must look right without them.

- [x] Help bot AI back (12 Oct): StaticSarthi answers chips / 2+-keyword matches locally; other questions → backend
  POST /api/v1/chat with JWT. `15_ai_chat_quota.sql`: ai_chat_usage + a4_is_paid_user + consume_ai_chat_quota (free 10/day,
  paid unlimited, same message again counts against the 10). RAG-BACKEND chat.py: default limit 10, sends message hash.
- [x] 15 applied + VERIFY pass (12 Oct; final version: paid hard cap 200/day, `consume_ai_chat_quota(uuid,int,text,int)`).
  RAG-BACKEND main = 37ab825 (12 Oct, fast-forward; history 8 x 2000 chars, max_tokens 600). Prod checks: /health 200,
  copy-checker / smart-assignment-checker / chat without token → 401 (were 404). Frontend merge pending.

- Backend URLs (12 Oct): every FastAPI /api/v1 call builds its URL with `src/lib/apiBase.ts` (getBackendApiBase / backendUrl).
  Works whether VITE_BACKEND_URL / VITE_API_URL end in nothing, /api or /api/v1. Live VITE_BACKEND_URL had no /api → checker
  calls were 404. Don't build backend URLs from env vars directly. (Modules/worksheet still use VITE_API_URL root + /modules.)

- [x] 16 applied on live (12 Oct, by human): `16_rejoin_inactive_member.sql` — join_institute_by_code re-activates an
  inactive member as plain teacher (invited keeps its role). Before it, inactive rows (09 reset) got "Already a member"
  and get_my_access (status=active only) said "none" → endless "not part of any institute". MSIT now 13 inactive / 5 active.
- [x] Join link (12 Oct, branch): /join?code=… → /join-institute?code=… (code pre-filled; remembered across login).
- [x] WhatsApp kill switches (12 Oct, branch, code kept): frontend `VITE_ENABLE_WHATSAPP_OTP` (default off; replaces
  VITE_PHONE_OTP_ENABLED) — Login/Signup forced to email, LoginModal OTP handlers no-op. Edge Function send-whatsapp-otp:
  `WHATSAPP_OTP_ENABLED` secret (default off → 503 before any Meta call). RAG-BACKEND whatsapp.py = the WhatsApp PAPER BOT
  (not OTP): `WHATSAPP_BOT_ENABLED` (default off → all /api/v1/whatsapp routes 404; commit 7682908, not pushed).
  No DB check requires a verified phone. whatsapp_usage has 0 rows (bot never used).
- [ ] Deploy the Edge Function (`supabase functions deploy send-whatsapp-otp`) — the kill switch is not live until then
  (Send SMS hook is OFF, so nothing is sent today). Push RAG-BACKEND 7682908 → preview → main when approved.
- [ ] Rotate leaked secrets: Groq key (revoked 12 Oct; VITE_GROQ_API_KEY was still listed in Vercel a4ai env — confirm
  removed), WhatsApp token (WHATSAPP_TOKEN on Supabase / WHATSAPP_ACCESS_TOKEN on Vercel rag-backend) and
  SEND_SMS_HOOK_SECRET (both pasted in chat earlier). Live bundle still contains the revoked gsk_ key until the frontend merge.
- Known (12 Oct): 22 auth users are phone-only (no email) → cannot sign in while OTP is off (OTP paused since 10 Oct).
  7 have signed in before (last 7 Oct); 15 never. ONE is a paying customer: c842e6bc… (****0167, starter 6 Oct–5 Nov,
  5 tests, 1 module, MSIT inactive). 1f304b41… (****2201) has 41 modules. Most have no profiles row. Needs a decision:
  add an email to these accounts (Auth admin) or ask them to sign up with email/Google and move their data.
- Prod VITE_BACKEND_URL (a4ai, Production) has no "/api" — fine after the apiBase merge, but set it to …/api anyway.

- [x] Key rotation prep (13 Oct, branches only — legacy service_role JWT leaked): `chore/supabase-new-keys` in BOTH repos.
  Product c8acff2 + d025d83: Edge Functions read the server key via `supabase/functions/_shared/supabaseKeys.ts`
  (injected SUPABASE_SECRET_KEYS, else legacy SUPABASE_SERVICE_ROLE_KEY); frontend clients read
  VITE_SUPABASE_PUBLISHABLE_KEY first; checklist `docs/supabase-key-rotation.md`. RAG-BACKEND cd6e903 (+1b4b2c5): supabase-py
  2.9.0 → 2.16.0 (2.9 rejects non-JWT keys; 2.32 broke the Vercel build via pydantic, 2.16 keeps pydantic 2.8.2), config reads SUPABASE_PUBLISHABLE_KEY /
  SUPABASE_SECRET_KEY first, startup refuses swapped keys; preview build Ready. DB holds no keys (no pg_cron, no DB
  webhooks, vault empty). Cutover is env-only, then Dashboard → API Keys → disable legacy.
- [ ] Follow docs/supabase-key-rotation.md (merge both branches → add new keys in Vercel → test → disable legacy).

- [x] Private buckets (13 Oct, branches `sec/private-buckets` in both repos): product 16f12bd — DRAFT
  `18_private_assignments_bucket.sql` (assignments bucket private, staff read policy, portal_assignment_files
  service_role only, notes owner delete, a4_storage_path); portal opens question paper + own submission via
  POST /api/v1/portal/files; notes delete = row first, then file, errors checked. RAG-BACKEND bc00662 — portal_files
  router (10-min signed URLs, 404 for wrong code or assignment, 30/min per IP). Stored file_url keeps the
  public-format reference (submit_assignment + AI check parse it) → no data conversion (live: 0 rows in
  assignments / submissions / notes; orphan objects 15 / 6 / 11).
- [ ] Run 18 → merge backend sec/private-buckets → merge product → test portal "View"/"Open" + teacher AI check.

- [x] Quota race (13 Oct, branches `fix/quota-race`): product cbcc208 — DRAFT `19_test_generation_reserve.sql`
  (reserve_test_generation: per-user advisory lock + plan limit + count in one tx; release_test_generation refunds;
  record_usage search_path pinned). RAG-BACKEND acc7464 — /generate-frontend and /generate reserve first, refund on
  failure, never refund a delivered paper; falls back to check→record if 19 isn't applied. Mocked tests pass.
- [ ] Run 19 (+ VERIFY 2) → merge backend fix/quota-race.
- Known: every new free account gets a fresh monthly quota (2 papers). Options (not built): require verified email
  before generating; one free quota per device/IP fingerprint; free tier = smaller papers; captcha on signup.

- [x] Access + billing audit (15 Oct): https://claude.ai/artifact/DoYdNbitaoFgYgTSBpoi5q. Plan: 21 account_type →
  22 member_role_audit → 23 entitlements → 24 billing_v2 (institute checkout, offline activation by platform_admins,
  value-based upgrade credit, downgrade at period end) → 25 invoices (Resend, billing@a4ai.in, receipt without GST).
  21–25 wait until the 3 backend branches (keys, quota-race, private-buckets) are merged; show each migration first.
- [x] 17 applied (15 Oct, branch fix/institute-signup): profiles_role_check allows 'institute'. Institute signup was
  broken since 13 (handle_new_user → check violation; Google path never saved the role).
- [x] 20 applied (15 Oct, branch sec/close-self-grant): any user could UPDATE own subscriptions → Pro (confirmed in a
  rolled-back test). Now: no app writes on subscriptions/payments/plans/usage_records, no direct institutes INSERT,
  owner_id/plan_id/max_* locked (trigger), plan_id locked on profiles/teacher_profiles. AuthProvider subscriptions
  upsert removed (frontend branch not merged yet; old code just gets 403). No sign the hole was used.
  Role tests: scratchpad pattern = DO block that ends with `raise exception 'RESULT %'` (always rolls back);
  run SQL with `supabase db query --linked -f file` — npx on Windows cuts multi-line arguments after line 1.
- [ ] Razorpay test-mode Starter payment after 20 → confirm payments 'paid' + subscription + teacher_profiles.plan_id.
- Pricing truth (for 23/24): Free 2/month, Pro 50/month, Institute Starter ₹999 / Plus ₹1,999 / Pro ₹2,999 (rename DB
  plans), College = manual activation only (rows in 24), drop individual_199/249 (0 references, 15 Oct).
  Pricing page copy fixed on branch fix/pricing-copy (not merged).
- Backfill decisions for 21: only institute owners → institute_owner; student profiles with teacher activity →
  individual_teacher (4b960486…, ca406b93…), a9530028… stays student; 37ecd1cb…, f047f033…, 931f4251… on HOLD for the
  human. Show preview counts before applying.
- [ ] 20b (branch fix/chat-quota, NOT applied, tested rolled back as a real free + paid user): drops the 3-arg
  consume_ai_chat_quota, creates the final 4-arg one. Until then the backend's RPC call fails (42883) and chat.py
  silently uses its in-memory fallback (10/day per serverless instance, paid users capped at 10, nothing stored).
- [x] AuthProvider ensureProfileExists removed (sec/close-self-grant, now REBASED onto feat/persistent-login 932c5f5,
  conflict resolved, build passes). No path needs a teacher_profiles row up front: backend record_usage retry,
  19 reserve_test_generation and create-order create it with the service key.
- Razorpay: prod frontend + every backend env use LIVE keys (backend KEY_ID/SECRET = Production, Preview, Development).
  Test key id set on rag-backend Preview (fix/auth-body-ids) only, 15 Oct; test SECRET is the human's to add.
  rag-backend previews return 302 (Vercel Deployment Protection) → browser calls fail until bypassed.
- Since 23 Aug every new auth user has a profile row; the 62 without one are older (not the 13 bug). Email signups
  that failed 11–15 Oct left no auth.users row → only visible in Supabase Auth logs. No signups at all since 11 Oct.

## Test matrix (after every step)
5 logins: admin · HOD ECE · proctor ECE-2 · subject teacher (ECE-2 only) · subject teacher of another dept · + 1 student access code.
Each must see only its row of the access matrix. Also try direct Supabase queries from browser console (`supabase.from('students').select('*')`) — RLS must return only scoped rows.

## Rules for Claude
- Plan first, show the diff, then edit. Never run destructive SQL on the live DB — write migration files, the human runs them.
- Hinglish replies, direct and honest.
