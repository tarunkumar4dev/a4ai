# Teacher dashboard — parity audit (Stage 1, 28 Oct 2026)

Scope of this file: the audit the brief requires before editing. No application code was changed in this stage.
Labels: `VERIFIED` (checked in browser or source) · `MEASURED` · `NOT TESTED` · `BLOCKED`.

## 1. Git baseline (VERIFIED)

- Branch `perf/teacher-dashboard`. Last commit `069665e` (local, not pushed).
- Uncommitted, all from previous sessions, all preserved:
  - `src/pages/TeacherDashboardPage.tsx`, `src/pages/ModulesPage.tsx`, `src/components/chat/StaticSarthi.tsx`,
    `src/components/institute/InstituteTeacherPanel.tsx`, `src/components/teacher/TeacherAnalyticsTab.tsx`,
    `src/components/teacher/TeacherStudentsTab.tsx`
  - untracked: `docs/TEACHER_DASHBOARD_*.md` (6 files incl. the previous round's three + landing-parity set), `docs/screenshots/`,
    `scripts/dashboard-shots.mjs`, `scripts/dashboard-repro.mjs`
  - `supabase/.temp/cli-latest` (written by the Supabase CLI; not product work)
- Repo stashes `stash@{0..2}` are the user's; untouched.

## 2. Previous reports — what is actually true (VERIFIED)

| Claim | Verified |
|---|---|
| Blur/backdrop removed from cards and sidebar | yes (source + screenshots) |
| Gradient action tiles → flat | yes |
| Fabricated "19.2% higher" analytics banner removed | yes (`grep 19.2%` → 0) |
| Test History title truncation fixed | yes: 1440px title width 76 px → 715 px (`scripts/dashboard-repro.mjs`) |
| Mobile bubble overlap fixed | **partial**: bubble is 48 px now; a fixed bubble still covers rows mid-scroll. End-of-list overlap was 0 before and after. |
| Orange gradients removed everywhere | **no**: 3 remain (see §5) |
| 136 tests / 40 TS errors baseline | yes (`npm test`, `tsc --noEmit`), none in changed files |

## 3. Design-system comparison — computed styles in the browser (VERIFIED)

Measured with `getComputedStyle` on the production build (1440 px).

| Property | Landing | Dashboard | Action |
|---|---|---|---|
| Font family | `Plus Jakarta Sans` | `Plus Jakarta Sans` (on `.dashboard-root`) | match (already) |
| Body font (`<body>`) | — | `-apple-system…` (dashboard root sets Jakarta, body does not) | low risk; leave |
| H1 weight | **700** | **900** (`font-black`) | change to 700 |
| H1 size | 60 px (clamp, marketing) | 36 px | keep dashboard scale; use 700 |
| H1 colour | `rgb(27,27,27)` `#1B1B1B` | `rgb(15,23,42)` `#0F172A` (slate-900) | align to `#1B1B1B` |
| Primary CTA background | `rgb(17,17,17)` `#111111` | `rgb(17,17,17)` `#111111` | match (already) |
| Primary CTA text | white | white | match |
| Primary CTA height | **50 px** | **68 px** ("Create Test" hero) | change to 48–50 px |
| Primary CTA radius | **12 px** | **22 px** | change to 12 px |
| Body background | `#FFFFFF` / `#F7F8FA` alt | `rgb(249,248,252)` (`#F9F8FC`) | align to `#F7F8FA` |
| Body text colour | `#1B1B1B` | `rgb(2,8,23)` `#020817` | align to `#1B1B1B` |

Not yet measured (NOT TESTED): card radius/shadow on each landing component, pastel surfaces, focus ring computed values, input styles.

## 4. Route inventory (sidebar + nested)

Verified by opening `/dashboard` and clicking each sidebar item (screenshots in `docs/screenshots/teacher-dashboard/landing-parity/after-all/`).

| Route / tab | Component (source) | Current state | Main gap | Status |
|---|---|---|---|---|
| Dashboard (home) | `TeacherDashboardPage.tsx` | shell + hero + What's New | hero card has large empty area; CTA 68 px / radius 22 | PARTIAL |
| Calendar | `components/teacher/TeacherCalendarTab.tsx` | month grid + today card | no visible redesign yet | NOT STARTED |
| Assignments | `components/teacher/TeacherAssignmentsTab.tsx` | (not re-verified this stage) | — | NOT STARTED |
| Attendance | `components/attendance/AttendancePage.tsx` + `TeacherAttendanceView.tsx` | redesigned; save state, load errors, no-institute state fixed (Stage 4) | real account not tested; My Section / HOD not redone | DONE (stubbed data; see STAGE4) |
| Students | `components/teacher/TeacherStudentsTab.tsx` | one banner "Not part of an institute" | no explanation of next step; no empty state | NOT STARTED |
| Modules | `pages/ModulesPage.tsx` + `components/ModuleCreator.tsx` | header + creator card | creator icon still orange; topic palette orange/purple/blue | PARTIAL |
| Test History | `TestHistory` (in `TeacherDashboardPage.tsx`) | list of rows | emoji in buttons (👁️📄🔑); ⋯ menu; title fixed | PARTIAL |
| Analytics | `components/teacher/TeacherAnalyticsTab.tsx` | KPI cards + charts | not reviewed for metric integrity (zero-denominator, "trend" text) | NOT STARTED |
| AI Tools | in-file cards | feature cards | not re-verified | NOT STARTED |
| My Section (proctors only) | `components/attendance/ProctorSectionView.tsx` | not verified (no proctor test account) | — | BLOCKED (no account) |
| `/dashboard/test-generator` | `TestGeneratorPage.tsx` (AI tab) | Stage 3 + 3b | Builder / Check / Contest tabs: shell only; teacher DOCX backend bug | DONE for AI tab; other tabs NOT STARTED |
| `/dashboard/analytics` | separate page | not opened this stage | — | NOT STARTED |
| `/settings`, `/contests`, `/join-institute` | separate pages | not opened this stage | — | NOT STARTED |

Note: `?tab=` URL parameters work only for `assignments` and `modules`; other tabs are state-only.

## 5. Remaining orange / non-system accents (VERIFIED by grep)

- `src/pages/ModulesPage.tsx:83` topic palette `from-orange-600 to-amber-600` (data-coded accent).
- `src/components/ModuleCreator.tsx` creator icon orange gradient (separate file; not yet changed).
- `src/pages/TeacherDashboardPage.tsx:1700` decorative `from-white/30` overlay (acceptable).

## 6. Component inventory (counted by grep, teacher + attendance + modules + chat)

| Concern | Count / evidence | Reuse note |
|---|---|---|
| Action tile | `GlossyButton` in 1 file (dashboard), flat style | dashboard-only |
| Sidebar item | `SidebarButton` in 1 file | dashboard-only |
| Tables (`<table>`) | 4 files | not yet unified; Test History uses divs, not a table |
| Dialogs | 1 file uses `role="dialog"` / `<Dialog` | modal styling not consistent across pages |
| Toasts | `toast.` in 10 files (`sonner`) | one toaster; fine |
| Spinners | `animate-spin` in 9 files | several hand-written; candidate for one primitive |
| Images | `<img>` in 3 files | low |
| Marketing `SectionHeading`, `PageShell`, `Container` | `components/site/PageShell.tsx` | deliberately not imported into the dashboard (layout) |

## 7. Data volume, offline and drafts (VERIFIED by source)

- **Test History:** loads newest 50 tests (`.limit(50)`); no pagination UI. A teacher with more than 50 tests cannot see older ones — **a real data-volume gap**.
- **Students / attendance / analytics:** data path not re-verified this stage.
- **Offline support:** no service worker in `public/`; no offline write queue. Only `localStorage` usage is for flags and draft-like items in unrelated features. Draft persistence for the Test Generator was **not verified** this stage.
- **Retries:** the test list uses a single request with no retry; a failure now shows a toast (added previous round). Attendance save path not audited this stage.

## 8. Performance baseline (MEASURED, earlier this week, same build family)

| Measure | Value | Status |
|---|---|---|
| Dashboard first-load JS (gzip, 22 files) | 210 KB | MEASURED |
| Dashboard first-load CSS (gzip) | 41 KB | MEASURED |
| Largest chunks | `main` 97 KB gz, vendor/chunkReload 46 KB, `TeacherDashboardPage` 22 KB | MEASURED |
| Target ≤ 120 KB JS | not met | FAIL (gap is the shared shell) |
| Lighthouse mobile LCP / CLS / TBT | — | NOT TESTED (Lighthouse not run) |

## 9. Top 10 findings (ranked by teacher impact)

1. **Primary CTA is 68 px tall with 22 px radius on the dashboard**, while the landing CTA is 50 px / 12 px. Most visible parity gap on the home page.
2. **Home H1 is weight 900 and `#0F172A`**; landing H1 is 700 and `#1B1B1B`.
3. **Test History shows only the newest 50 tests** with no pagination — teachers with more tests lose access to older papers.
4. **Students page is a single banner** when the teacher has no institute; no explanation, no next step.
5. **Mobile help bubble still covers rows mid-scroll** (fixed element; reduced to 48 px only).
6. **Attendance page shows "0 assigned classes"** for a teacher with no institute — the page is effectively empty; no guidance.
7. **Three orange/amber accents remain** (Modules topic palette, ModuleCreator icon).
8. **No offline or draft recovery** exists for any workflow (no service worker, no write queue, no draft store verified for the Test Generator).
9. **Analytics metric integrity not yet reviewed** (zero denominators, "trend" text) — the earlier fabricated claim was removed, but the rest of the page is unaudited.
10. **Dialog/table/spinner implementations are not unified**; several hand-written spinners and no shared dialog pattern.

## 10. Next steps (proposed stage order, unchanged from the brief)

- Stage 2: shared shell + Home — fix the 4 verified token gaps in §3 (H1 weight/colour, CTA height/radius, body bg/text), then re-measure the same computed values.
- Stage 3: Test Generator (not yet opened this stage).
- Stage 5: Test History — pagination for >50 tests (needs an API/offset decision; do not fake it in the UI).
- Stage 4, 6–10: per the brief.

Blocked items: My Section (proctor test account), offline/draft recovery design (needs a backend idempotency review before any write queue), Lighthouse (tool not installed).


## 11. Stage 2 status (added 28 Oct, after the audit)

- Shell + Home: **PASS — VERIFIED** for the four measured token gaps (H1 weight/colour, CTA height/radius, root colour/background). Evidence: `docs/TEACHER_DASHBOARD_PARITY_STAGE2.md`.
- Landing page: **PASS** (computed styles identical; pixel diff 0 at 1440).
- Migration 27: effect **PASS** for public writes on `ncert_questions`/`ncert_chunks` and anon read on `attendance_legacy`; **FAIL** for leftover anon INSERT/UPDATE/DELETE grant on `attendance_legacy` (proposed follow-up 28, not executed); history record **NOT VERIFIABLE**.
- Not measured in Stage 2: Lighthouse, 200% zoom, focus ring, dark mode, drawer, marketing page at 320/768.


## 12. Stage 3b + 4 status (added 28 Oct)

- Test Generator AI tab: draft, row editor and export re-verified; see `TEACHER_DASHBOARD_PARITY_STAGE3.md` §K.
- Attendance: DONE with stubbed data; see `TEACHER_DASHBOARD_PARITY_STAGE4.md`.
- Component inventory: `TEACHER_DASHBOARD_COMPONENT_INVENTORY.md`.
- Next: Test History (Stage 5), then Students.
