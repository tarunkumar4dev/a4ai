# Teacher dashboard — Stage 4: Attendance (dashboard → Attendance tab), 28 Oct 2026

> **Corrected by the verification gate** (`TEACHER_DASHBOARD_PARITY_STAGE4_VERIFICATION.md`): the monthly-% fix was
> incomplete (the live RPC sends 0.00 when no class was held; it still showed "0% this month"), and the sticky header
> did not keep Save reachable (behind the dashboard header below 1024 px, not sticky above 640 px). Both fixed there.

Status: `PASS` (measured or tested, with evidence) · `FAIL` · `NOT MEASURED` · `BLOCKED`.
Branch `perf/teacher-dashboard`. Not committed, not pushed. No database, schema, RLS, grant, RPC or migration change.
Migration 27: not rerun. Migration 28: not created, not run.

## A. Scope and route trace

Dashboard sidebar "Attendance" → `src/components/attendance/AttendancePage.tsx` (lazy) → proctor banner +
`TeacherAttendanceView.tsx` (class list → attendance sheet). Data: `institute_members` / `institutes` (which institute),
RPCs `get_teacher_day_sessions`, `get_my_teaching_targets`, `get_my_class_teachers`, `get_monthly_attendance`,
`save_class_attendance` (all server-scoped); tables `students`, `class_sessions`, `attendance_records` (RLS).

Not in this stage: "My Section" (`ProctorSectionView.tsx`, proctors), `HODAttendanceDashboard.tsx` (HOD route `/hod`).

## B. Defects found (before), all confirmed in the browser

| # | Defect | Impact |
|---|---|---|
| 1 | A class with no saved marks opened with everyone on Present, status **"Saved"**, Save **disabled** | Teacher believes attendance is recorded; nothing is on the server. A fully present class could not be saved without pressing "All P" |
| 2 | If saved marks failed to load, the error was ignored: the sheet showed **all 43 Present** | Any save would overwrite the real absences |
| 3 | A failed class-list load showed "No classes assigned to you yet" | Wrong reason; no retry |
| 4 | A teacher with no institute was told "Ask your HOD" | Wrong reason; no way forward |
| 5 | A failed save was a 3.5 s toast only | Gone before the teacher looks; status line did not say "not saved" |
| 6 | Every student showed "0% this month" in red when the month had no data | Fabricated-looking figure |
| 7 | Layout: name card, full month calendar, then classes (first class 509 px down on a phone); 120 px student cards; stats shown twice; gradients | Slow to scan and mark |
| 8 | P/A/L state only by colour (no `aria-pressed`); 2 unnamed controls; custom toast + modal without focus handling | Accessibility |
| 9 | (found while testing the fix) Esc on the "Leave without saving?" dialog closed it and the page's own Esc handler reopened it at once | Dialog could not be dismissed with Esc |

## C. Changes

| File | Change |
|---|---|
| `src/components/attendance/TeacherAttendanceView.tsx` | Rewritten view, same data calls and save RPC. Save state: `hasSaved` from the server; "Not saved yet…" + Save enabled for a never-saved class; failed saves stay inline (`role="status"`) until a save works; leaving an unsaved sheet asks first. Load errors: class list / sheet show `role="alert"` + Try again; saved-marks load failure stops the sheet from opening. No institute → "Join an institute" (`/join-institute`). % shown only when the server returned one. Layout: compact date bar (prev / native date / next / Today) instead of the month grid; the day's classes as a list; class + subject pickers with labels; sheet = sticky header (counts, Undo / All present / Save in one row) + search + filter + 56 px rows with a P/A/L segmented control (`aria-pressed`, full names on ≥640 px). Sonner toasts, `ui/alert-dialog` confirm. Esc ignored when already handled (`defaultPrevented`) |
| `src/components/attendance/AttendancePage.tsx` | Proctor banner: neutral card, 44 px secondary button (was teal fill) |
| `src/components/chat/StaticSarthi.tsx` | Wrapper class `a4-help` (no behaviour change) |
| `src/index.css` | `body:has(.att-sheet) .a4-help { display: none; }`: the help bubble covered the rightmost P/A/L button while scrolling (seen at 390 and 1440). Hidden only while a sheet is open |
| `scripts/stage4-attendance.mjs` | New: stubbed-Supabase browser checks (below) |
| `docs/TEACHER_DASHBOARD_COMPONENT_INVENTORY.md` | New |

Unchanged on purpose: default "Present" for unmarked students (it is the existing behaviour and saves taps; it is now
labelled as a starting point, not a record), RPC parameters, 2-day / role rules (server-side), keyboard shortcuts
(Ctrl+S, Ctrl+F, Esc).

## D. Results (`node scripts/stage4-attendance.mjs <url> before|after`, Supabase stubbed: 43 students)

| Check | Before | After | Status |
|---|---|---|---|
| Never-saved class: status text | "Saved" | "Not saved yet. Everyone starts as Present…" | FAIL → PASS |
| Never-saved class: Save enabled | no | yes | FAIL → PASS |
| Failed save still visible after 5 s | no | yes ("Not saved: … Try Save again.") | FAIL → PASS |
| Retry after failure saves the right data | 43 records | 43 records, the marked student absent, "Saved at hh:mm" | PASS |
| Saved marks fail to load | sheet opened, 43 shown Present, no error | sheet not opened, error + Try again | FAIL → PASS |
| Previously marked class shows its 5 absences | 5 | 5 | PASS |
| Class list fails to load | "No classes assigned", no retry | error + Try again | FAIL → PASS |
| Teacher with no institute | "Ask your HOD", no link | "You're not part of an institute yet" + Join link | FAIL → PASS |
| Leave unsaved sheet → dialog, focus inside, Esc closes, stays on sheet | — | yes / yes / yes / yes (Esc failed before the `defaultPrevented` fix) | PASS |
| Help bubble on the sheet / on the class list | over row buttons / visible | hidden / visible | PASS |
| First class from top of the tab, 390 px | 509 px | 123 px | PASS |
| Class-list height, 390 px | 942 px | 488 px | PASS |
| Sheet height, 43 students, 390 px / 1440 px | 6193 / 6517 px | 3095 / 3016 px | PASS |
| Elements with gradients (class list) | 4 | 0 | PASS |
| Visible controls without an accessible name | 2 (list), 1 (sheet) | 0, 0 | PASS |
| Buttons exposing pressed state on the sheet | 0 | 133 (43 × P/A/L + 4 filters) | PASS |
| Horizontal overflow 320 / 390 / 768 / 1440 | 0 | 0 | PASS |
| Page errors | 0 | 0 | PASS |
| Attendance chunk (gzip) | 8.4 KB | 7.3 KB | PASS |

Screenshots (`docs/screenshots/teacher-dashboard/stage4/`): `before-|after-` × `landing-{320,390,768,1440}`,
`sheet-{390,1440}`, `save-failed-390`, `records-failed-390`, `list-failed-390`, `no-institute-390`.

## E. Build / tests

`vite build` PASS · `npm test` 144/144 · eslint on changed files 0 errors · `tsc` 40 = baseline.

## F. Not measured / open

| Item | Status | Reason |
|---|---|---|
| Real account, real RPCs (scope, 2-day rule, proctor edits) | NOT MEASURED | Stubbed Supabase; no test account in this session |
| Proctor banner and "My Section" | NOT MEASURED | No proctor stub; `ProctorSectionView` not redesigned |
| HOD attendance (`/hod`) | NOT STARTED | Separate route |
| Dark mode | NOT MEASURED | `dark:` classes kept on every surface; not screenshotted |
| 200% zoom, Lighthouse, low-end device | NOT MEASURED | — |
| Offline marking | NOT STARTED | Needs an idempotency review of `save_class_attendance` before any queue; not built |
| Students added after a class was marked | open | They show Present (not saved) inside a "Saved earlier" sheet; the status line doesn't single them out |
| Native date input | open | Shows the browser's own format next to the label (duplicate date text on phones) |
