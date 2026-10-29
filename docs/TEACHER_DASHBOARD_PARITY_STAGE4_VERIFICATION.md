# Teacher dashboard — Stage 4 (Attendance) verification gate, 28 Oct 2026

Final status: **PARTIALLY VERIFIED**. Every reported fix was re-tested in a production build with Supabase stubbed;
two Stage 4 claims were wrong and are now fixed (monthly %, Save reachable after scrolling). No real-account or
real-RPC run was possible (no test credentials in this environment); the live server functions were read
(read-only) to check the 2-day rule and class scope at source level.

Branch `perf/teacher-dashboard`. Not committed, not pushed. No database write, no migration, no RLS/grant change.
Migration 28: not touched.

## 0. Method labels

| Label | Meaning |
|---|---|
| **SRC** | source inspection of the frontend |
| **SRV-SRC** | read-only reading of the live database function definitions (`supabase db query --linked`, `pg_get_functiondef`); shows what the server code says, not a run |
| **MOCK-BROWSER** | production build in Chromium (Playwright), Supabase and backend stubbed with fixed responses |
| **REAL** | real account + real RPCs: **not done** (see §3) |

Builds compared: **stage4** = the Stage 4 code as reported (`dist-att`), **gate** = with the fixes in §6 (`dist-gate`).
Scripts: `scripts/stage4-attendance.mjs` (Stage 4 checks), `scripts/stage4-verify.mjs` (new gate checks).

## 1. The nine reported fixes

| # | Claim | Method | Evidence | Result |
|---|---|---|---|---|
| 1 | New class: "Not saved yet", Save enabled with everyone Present | SRC + MOCK-BROWSER | `hasSaved` from loaded records; `canSave` = `dirty \|\| !hasSaved`. Browser 390/1440: text "Not saved yet…", Save enabled (stage4 and gate) | **PASS (mock)** |
| 2 | Saved marks fail to load → sheet does not open with fabricated Present | SRC + MOCK-BROWSER | `attendance_records` error is thrown → `sheetError`. Stub returns 500: 0 students rendered, "Couldn't load this class… Try again" | **PASS (mock)** |
| 3 | Failed save stays visible until a later save works | SRC + MOCK-BROWSER | `saveError` cleared only at the next save start. After 5 s the line still reads "Not saved: …"; retry saves 43 records with the marked student absent, then "Saved at hh:mm". Also: a server rejection text (edit window) is shown verbatim and stays | **PASS (mock)** |
| 4 | Class-list load failure shows an error + working retry | SRC + MOCK-BROWSER | `get_my_teaching_targets` 500 → "Couldn't load your classes…", 1 "Try again" button; "No classes assigned" not shown | **PASS (mock)**; the retry click itself re-calls `load` (SRC), not clicked in the browser |
| 5 | No institute → correct explanation + Join link | SRC + MOCK-BROWSER | "You're not part of an institute yet" + `a[href="/join-institute"]` (1) | **PASS (mock)** |
| 6 | Monthly % only for valid server values | SRV-SRC + MOCK-BROWSER | Live `get_monthly_attendance` returns `percentage = 0.00` when `total_held = 0`. **stage4 build showed "0% this month" for that case and for a non-numeric value (3 of 4 rows)**. Fixed: shown only when `total_held > 0` and the % is finite. gate: 1 of 4 rows ("75% this month") | **FAIL in Stage 4 → PASS (mock) after fix** |
| 7 | Esc on the "Leave without saving?" dialog doesn't reopen it | SRC + MOCK-BROWSER | Window handler skips `e.defaultPrevented`. Dialog opens, focus inside, Esc closes, still on the sheet | **PASS (mock)** |
| 8 | P/A/L selected state exposed to assistive tech | MOCK-BROWSER (accessibility tree via Playwright role queries) | 43 groups named "Attendance for <name>"; 43 `Present` buttons with `pressed=true`; after marking one absent: 42 / 1. One `role=status` region | **PASS (accessibility tree)**; no screen-reader software (NVDA/TalkBack) run |
| 9 | Help bubble doesn't block Leave on the sheet | MOCK-BROWSER | Bubble hidden while the sheet is open (`body:has(.att-sheet) .a4-help`), visible again on the class list and after Save → Back. Needs `:has()` (Chrome/WebView 105+, Safari 15.4+); older WebViews keep the bubble | **PASS (mock)** |

## 2. New findings in this gate

| Finding | stage4 | gate |
|---|---|---|
| **Save not reachable after scrolling.** Stage 4 said the header keeps Save in reach. Below 1024 px the dashboard's own header is sticky (`top-0`, ~130–150 px) and the sheet header slid behind it; from 640 px up the sheet header wasn't sticky at all. Click at Save's centre after scrolling 1500 px: | not Save at 320 / 390 / 768 / 720 (200 % zoom) / 1440 | Save at all five |
| Monthly % for no-class months (above, #6) | "0% this month" | hidden |
| Error line "…(proctor).. Try Save again." (double full stop) | yes | fixed |
| Double-click Save + Ctrl+S on a slow server | 1 request | 1 request (no change needed) |

## 3. Real account / real RPC

**BLOCKED for a run.** No test-account credentials in this environment (`.env.local` holds only public `VITE_*` keys;
no E2E variables). The MSIT demo class was reset to 0 students (CLAUDE.md, 10 Oct), and a save writes
`class_sessions` / `attendance_records` / `attendance_edit_log` on the live project, so it was not attempted.

What the live server code says (SRV-SRC, `save_class_attendance`, `att_edit_window_days`, `att_today_ist`,
`get_my_teaching_targets`, `get_teacher_day_sessions`, class_sessions indexes):

- Scope: save allowed for admin, the section's proctor, the department's HOD, or a teacher with an active
  `teaching_assignments` / `timetable_slots` row for that batch + subject; otherwise `You are not assigned to this class`.
  Class lists are built from `auth.uid()` server-side.
- Dates: future dates rejected; window = teacher **2 days**, proctor 7, HOD/admin unlimited, "today" in Asia/Kolkata.
  The UI does not pre-warn; the server message ("Edit window closed (2 days). Ask your class teacher (proctor).") is
  shown and kept (MOCK-BROWSER).
- Repeat saves find the same session (slot + date, then batch + subject + date); unique indexes
  `(timetable_slot_id, session_date)` and `(batch_id, subject_id, teacher_id, session_date) where slot is null` block
  duplicate sessions.
- Records: only students of that batch and only present / absent / leave are accepted; changes go to
  `attendance_edit_log`.

Manual test (needs an authorised teacher account and a **test class with dummy students**, never a real class):
1. Log in as the subject teacher → Attendance: the class list shows only that teacher's classes; today's slot is listed.
2. Open the class: "Not saved yet". Mark 2 absent, Save → "Saved at …". Reload the page, open the class again → the
   2 absences are shown, status "Saved earlier".
3. Pick a date 3 days ago, open the class, Save → "Not saved: Edit window closed (2 days)…" stays on screen.
4. Pick tomorrow: the status says "Future date: view only", Save disabled.
5. In the browser console as the same teacher: `supabase.rpc('save_class_attendance', {...})` for a batch the teacher
   doesn't teach → error "You are not assigned to this class".
6. Turn the network off, Save → "Not saved: …"; turn it on, Save → saved once (check one `class_sessions` row).
Rollback: the test class's `attendance_records` / `class_sessions` / `attendance_edit_log` rows, removed by the
owner in SQL (by session id). Nothing in this gate did this.

## 4. Visual verification (MOCK-BROWSER, real app build)

| Check | Result | Evidence (`docs/screenshots/teacher-dashboard/stage4/`) |
|---|---|---|
| Before/after comparison | available: the Stage 4 run captured the pre-Stage-4 build | `before-*.png` vs `after-*.png` |
| First class visible promptly | 123–147 px from the tab top (was 509–581 px) | `after-landing-*.png` |
| Sheet compact | 43 students: 3095 px at 390 (was 6193 px) | `after-sheet-390.png` |
| Header buttons fit | 390: Undo, All present, Save at 114 px each; 320: all inside the viewport (widths not recorded); 768 / 720 / 1440: one row with the counts | `verify/gate-sheet-*.png` |
| Horizontal overflow | 0 on list and sheet at 320, 390, 768, 720 (200 % zoom of 1440), 1440 | `verify/gate-*.png` |
| Save after scrolling | clickable at all five (gate) | `verify/gate-sheet-scrolled-*.png` |
| Keyboard | class list: Previous day → date input (browser's 3 date segments + picker) → Next day → class row → Class select; sheet: Back → Undo → All present → Save → Search → 4 filters → P/A/L per row. Focus ring on every stop except the native date-picker icon | `stage4-verify.mjs` output |
| Dark mode (dashboard `dark` class) | text contrast 12.4–20.2 : 1 (titles, names, status line) | `verify/gate-dark-*.png` |
| 200 % zoom | emulated as a 720 px CSS viewport (1440 px window); no overflow, Save clickable | `verify/gate-*-zoom200.png` |

Not covered: real phones, a real screen reader, OS text-size scaling, Lighthouse.

## 5. Build, tests, lint, TypeScript

| Check | Result |
|---|---|
| `vite build` (gate code) | PASS |
| `npm test` | 144 / 144 PASS (16 files) |
| eslint, changed attendance + StaticSarthi files | 0 errors, 0 warnings |
| `tsc --noEmit -p tsconfig.app.json` | 40 errors = documented baseline; 0 in attendance / StaticSarthi files. tsc does not pass overall (pre-existing) |
| Home (`stage2-measure.mjs`) | H1 700 / `#1B1B1B`, CTA `#111111` 50 px / 12 px, background `#F7F8FA`, overflow 0 (same as Stage 2). The two "Welcome" H1s are the known duplicate (pre-existing) |
| Test Generator (`stage3-flow.mjs`, `stage3-draft.mjs`) | validation, 500 + retry, no % in loading, success, draft restore incl. chapter, broken draft, sign-out cleanup, named row controls: all PASS |
| Stage 4 checks (`stage4-attendance.mjs`) on the gate build | all as in the Stage 4 report (no regression) |

## 6. Code changes made in this gate

`src/components/attendance/TeacherAttendanceView.tsx` only:
1. Monthly %: shown only when `total_held > 0` and the percentage is a finite number (live RPC sends 0.00 for no classes).
2. Sheet header sticky at every width, offset by the dashboard header's height while that header is sticky
   (`useStickyOffset`: finds `<main> header`, ResizeObserver; 0 when not sticky / not found).
3. Save error line: no double full stop.

New: `scripts/stage4-verify.mjs`. Not changed: RPC calls, save payload, defaults, server code.

## 7. Open risks

- No real-account run (above).
- Students added after a class was marked show Present (unsaved) inside a "Saved earlier" sheet; not singled out.
- No pre-warning before a save outside the 2-day window (the UI doesn't know the caller's role per class); the server
  error is shown.
- `useStickyOffset` relies on the dashboard keeping one `<header>` inside `<main>`; if that changes, the offset falls back to 0.
- Below 1024 px the dashboard header is 95 % opaque, so rows show faintly behind it (shell, pre-existing).
- Help-bubble hiding needs CSS `:has()`.
- My Section (proctor) and HOD attendance not reviewed.

## 8. Scores (out of 10)

| Area | Score | Why |
|---|---|---|
| Data integrity | 7 | All four state bugs fixed and checked against stubbed failures and the live server code; no real save/reload run |
| Visual quality | 7 | Compact, consistent with the landing tokens, no overflow at 5 widths; date input shows the date twice on phones |
| Accessibility | 7 | Named controls, pressed states, focus rings, managed dialog; no real screen-reader or phone test; native picker icon without ring |
| Regression safety | 8 | Stage 3/4 scripts, Home measure, unit tests, build, lint, tsc baseline |
| Verification confidence | 5 | Mock + read-only server code only; real backend behaviour unverified |

**Status: PARTIALLY VERIFIED.** Stage 5 not started.
