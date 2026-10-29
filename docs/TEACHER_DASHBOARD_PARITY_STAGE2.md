# Teacher dashboard — Stage 2 (shell + home) and migration 27 verification (28 Oct 2026)

Status labels: `PASS` (measured or verified, with evidence) · `FAIL` · `NOT MEASURED` (not performed; reason given).
Branch `perf/teacher-dashboard`. Not committed, not pushed. No schema changed by this stage.

## A. Migration 27 — read-only verification

Method: `npx supabase db query --linked` with `SELECT` only against `pg_policy`, `has_table_privilege`, `supabase_migrations.schema_migrations`.
Nothing was executed against the database. Migration 27 was **not** rerun.

| Check | Result | Status |
|---|---|---|
| `ncert_questions`: public insert policy `ncert_questions_insert_service` removed | policies now: `ncert_questions_select_all` (SELECT only) | PASS |
| `ncert_questions`: anon / authenticated INSERT, UPDATE, DELETE | all `false` | PASS |
| `ncert_questions`: anon SELECT still allowed (question bank must stay readable) | `true` | PASS |
| `ncert_questions`: service role can still insert (ingestion scripts) | `true` | PASS |
| `ncert_chunks`: authenticated insert/update/delete policies removed | policies now: `Allow public read access` (SELECT) only | PASS |
| `ncert_chunks`: anon / authenticated INSERT, UPDATE, DELETE | all `false` | PASS |
| `ncert_chunks`: anon SELECT still allowed | `true` | PASS |
| `attendance_legacy`: anon SELECT removed | `false` | PASS |
| `attendance_legacy`: anon INSERT grant removed | **still `true`** | **FAIL** (see A.1) |
| `attendance_legacy`: authenticated writes | policy `Members manage attendance` (USING: own institute membership, no WITH CHECK). Anon has no `auth.uid()` so RLS blocks anon writes today. | PASS for RLS, but see A.1 |
| Migration recorded in `supabase_migrations.schema_migrations` | table exists; **no rows for versions 26 or 27** | NOT VERIFIABLE — the history table is not used for these files. Needs manual confirmation (see A.2). |
| Question loading still works for teachers (browser) | not run | NOT MEASURED |

### A.1 Remaining gap (proposed, NOT executed)
Migration 27 revoked anon SELECT on `attendance_legacy` but not anon INSERT/UPDATE/DELETE. The existing `Members manage` policy stops anon writes today, so this is defence-in-depth, not an open hole. Proposed follow-up `28_attendance_legacy_anon_writes.sql`:
```sql
begin;
revoke insert, update, delete on public.attendance_legacy from anon;
commit;
```
Needs your approval. Not created as a migration file in this stage (you asked for no further DB changes without a specific issue; this is a specific issue, so the decision is yours).

### A.2 Manual confirmation needed
Supabase SQL editor history for the project (or the owner) should show migration 27 executed. The checks above prove the **effect**; they cannot prove who ran it or when.

## B. Stage 2 — shell + home

### B.1 Changes (file: `src/pages/TeacherDashboardPage.tsx`, only)

| Change | Before (measured) | After (measured) | Landing reference |
|---|---|---|---|
| Shell heading (`<h1>`, both breakpoints) weight | 900 | **700** | 700 |
| Shell heading colour | `rgb(15,23,42)` | **`rgb(27,27,27)`** | `rgb(27,27,27)` |
| Hero "Create Test" height (desktop 1440 / 768 / 390 / 320) | 68 / 68 / 64 / 64 px | **50 px** | 50 px |
| Hero "Create Test" radius | 22 px | **12 px** | 12 px |
| Hero "Create Test" background / text | `#111111` / white | unchanged | `#111111` / white |
| Dashboard root text colour (`.dashboard-root`) | `rgb(17,24,39)` | **`rgb(27,27,27)`** | `rgb(27,27,27)` body |
| Dashboard root background | `#F8F9FA` | **`#F7F8FA`** | `#F7F8FA` |

Dark mode: `.dark .dashboard-root` now sets `color: #F5F5F5` so inherited text stays legible on `#0A0A0A` (the light text colour would otherwise have been dark-on-dark). Dark mode was not screenshot-tested — see B.4.

Primary styling only applies to the `primary` variant of `GlossyButton`. The `small` primary (Test History header "Create Test") keeps its size; it inherits only the 12 px radius.

### B.2 Shared-file and consumer check
- `.dashboard-root` CSS lives in the `customStyles` string inside `TeacherDashboardPage.tsx`. It is injected by that component only and unmounts with it. HOD and institute dashboards use their own `customStyles` (`src/pages/institute/dashboardTheme.tsx`); not touched.
- `GlossyButton` is local to this file (9 uses, all in this file).
- No change to `index.css`, `tailwind.config.ts`, `PageShell.tsx` or any landing component.

### B.3 Verification

| Check | Method | Result | Status |
|---|---|---|---|
| Landing page unchanged (computed styles) | `scripts/stage2-measure.mjs` before/after, 1440 + 390 | H1, CTA, body colour, overflow identical | PASS |
| Landing page unchanged (pixels, 1440×900) | PIL diff of `landing-before-1440.png` vs `landing-after-1440.png` | **0** pixels differ by more than 8 levels | PASS |
| Build | `npm run build` | built | PASS |
| Unit tests | `npm test` | 15 files, 136 tests | PASS |
| TypeScript | `tsc --noEmit -p tsconfig.app.json` | 40 errors, all pre-existing (baseline 40) | PASS (no new errors) |
| Lint (`TeacherDashboardPage.tsx`) | `eslint` | 0 errors | PASS |
| Horizontal overflow, home, 320 / 390 / 768 / 1440 | `document.documentElement.scrollWidth - clientWidth` | 0 px at all four | PASS |
| Mobile CTA visible without scrolling (390) | bounding box | CTA bottom 704 px of 844 px viewport | PASS |
| Mobile CTA visible without scrolling (320) | bounding box | CTA bottom 724 px of 844 px viewport (320 uses same viewport height) | PASS |
| Navigation: sidebar item count | `aside button` count | 12 at every width (unchanged) | PASS (count only) |
| Navigation: clicking sidebar items works | not run this stage | — | NOT MEASURED (ran in the previous round: 27/27 tab switches) |
| Marketing page at 320 / 768 | — | landing not captured at these widths | NOT MEASURED |

### B.4 Not measured in this stage (explicit)
- Lighthouse LCP / CLS / TBT for `/dashboard` (not installed).
- Real 200% zoom and OS text-size test.
- Keyboard focus order and visible focus ring (computed `outline` not recorded).
- Dark mode screenshots and contrast.
- Screen reader check.
- Drawer open/close on phone (the sidebar drawer was exercised in earlier rounds, not re-run here).

## C. Screenshots (Stage 2)

Folder: `docs/screenshots/teacher-dashboard/stage2/`

| File | Content |
|---|---|
| `before-320.png`, `before-390.png`, `before-768.png`, `before-1440.png` | dashboard home before this stage |
| `after-320.png`, `after-390.png`, `after-768.png`, `after-1440.png` | dashboard home after this stage |
| `landing-before-1440.png`, `landing-after-1440.png` | landing page regression reference |
| `before-measure.json`, `after-measure.json` | raw computed-style measurements |

Visual check (inspected): `after-1440.png` and `after-390.png` — black 50 px CTA, heading at 700, no clipping, sidebar and cards unchanged.

## D. Remaining issues on the home page
- "What's New" tiles still use a coral icon chip and a black "Join Institute" tile; that is intentional (action tiles), but it is not yet confirmed against the landing's card style (landing has no equivalent tile).
- Mobile help bubble still overlaps content mid-scroll (A7 in the audit).
- The hero card has a large empty area above the heading on desktop.
- Two `<h1>` elements exist (one per breakpoint, one hidden). Valid HTML requires one visible `<h1>`; hidden duplicates are not announced. Not changed in this stage.

## E. Next route (agreed order)
Stage 3 — Test Generator (`/dashboard/test-generator`), not started in this stage.
