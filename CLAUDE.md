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

## Test matrix (after every step)
5 logins: admin · HOD ECE · proctor ECE-2 · subject teacher (ECE-2 only) · subject teacher of another dept · + 1 student access code.
Each must see only its row of the access matrix. Also try direct Supabase queries from browser console (`supabase.from('students').select('*')`) — RLS must return only scoped rows.

## Rules for Claude
- Plan first, show the diff, then edit. Never run destructive SQL on the live DB — write migration files, the human runs them.
- Hinglish replies, direct and honest.
