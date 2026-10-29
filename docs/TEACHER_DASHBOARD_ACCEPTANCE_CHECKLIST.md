# Teacher dashboard — acceptance checklist (28 Oct 2026)

Status values: `PASS — VERIFIED` · `FAIL` · `NOT TESTED` · `BLOCKED`.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Visible UI improvement aligned with the landing page | PASS — VERIFIED | `docs/screenshots/teacher-dashboard/before/` vs `after/` (home, tests, analytics, assignments at 1440/768/390). Sidebar, tiles and buttons changed; black primary, coral active state. |
| 2 | Representative sub-routes redesigned | FAIL | Only the shell and the home tab were restyled. Test History, Assignments, Calendar, Students, Attendance, Analytics internals unchanged. Test History still has the desktop title truncation (A6). |
| 3 | Responsive: no horizontal overflow at 1440 / 768 / 390 | PASS — VERIFIED | `scripts/dashboard-shots.mjs` output: 0 px for all 12 captures. |
| 4 | 320 / 360 / 1024 / 1920 px checked | NOT TESTED | Only the three widths above were captured. |
| 5 | Touch targets ≥ 44 px on the sidebar | PASS — VERIFIED (code) | `SidebarButton` `min-h-[44px]`. Not measured in a browser. |
| 6 | Keyboard focus visible on sidebar and tiles | PASS — VERIFIED (code) | `focus-visible:ring-2` on sidebar items; `.btn-glossy-theme:focus-visible` outline. Not tab-tested in a browser. |
| 7 | Reduced motion respected | PASS — VERIFIED (code) | Hover lift/scale removed from action tiles and sidebar; the remaining transitions are colour-only. |
| 8 | No fabricated metrics / placeholder functionality | FAIL → PASS — VERIFIED (partial) | Removed the hard-coded "19.2% higher" claim (A1). Other static copy in the Analytics tab (A9) not reviewed. |
| 9 | Existing workflows and permissions intact | NOT TESTED | Unit tests pass (136/136). No browser run of create test, download, check copies, join institute, or role boundaries. |
| 10 | Empty / loading / error / permission-denied states | NOT TESTED | Stubbed session has one test; no real empty or error captures. |
| 11 | Performance: JS and CSS budgets reported | PASS — VERIFIED (measured, not improved this round) | Dashboard first load: 22 JS files, 210 KB gzip; CSS 41 KB gzip (local production build). Budget (120 KB JS, 20 KB CSS) **not met**. |
| 12 | Performance: LCP / CLS / TBT / INP measured | NOT TESTED | Lighthouse not installed; no RUM data. |
| 13 | Blur and backdrop-filter costs removed | PASS — VERIFIED (code) | Zero `backdrop-filter` / `blur-[100px]` on dashboard surfaces (DOM/source check). Paint time not measured. |
| 14 | Cache rules separate static assets from private data | PASS — VERIFIED | `curl -I` on `/assets/*` (`immutable`, Vercel HIT), `/fonts/*`, HTML `must-revalidate`. Supabase data is per-user RLS, not shared-cacheable. |
| 15 | Confirmed security issues fixed or documented | FAIL | Migration 27 (public writes to question bank / RAG chunks) written and locally tested, **not applied on live**. Coins client-writable: **open**, needs a server-side ledger. |
| 16 | Migration 27 reviewed, not executed in production | PASS — VERIFIED | `supabase/migrations/27_public_write_lockdown.sql` + rollback; local pgserver test 44/44 PASS. Not run on live (by instruction). |
| 17 | Build passes | PASS — VERIFIED | `npm run build` (28 Oct). |
| 18 | Unit tests pass | PASS — VERIFIED | `npm test`: 15 files, 136 tests. |
| 19 | Typecheck: no new errors | PASS — VERIFIED | 40 errors project-wide, all pre-existing; none in files changed this round. |
| 20 | Lint: no new errors | PASS — VERIFIED | `eslint` on changed files: 0 errors. |
| 21 | Browser / e2e tests of primary workflows | NOT TESTED | — |
| 22 | Accessibility scan (axe / Lighthouse a11y) | NOT TESTED | — |
| 23 | Git scope limited; unrelated work preserved | PASS — VERIFIED | Pre-existing stashes untouched; `cmp` confirmed byte-identical restore after a temporary stash; `supabase/.temp/cli-latest` left as is. |
| 24 | Changes pushed | BLOCKED | GitHub sign-in needed on this machine. Commit `069665e` is local only. |
| 25 | Migration applied to live DB | BLOCKED (by instruction) | Owner to run after review; staging-first plan in `TEACHER_DASHBOARD_IMPLEMENTATION_REPORT.md` §6 and the migration header. |
| 26 | Known broken UI: chat bubble over actions on phones (A7) | FAIL | Not fixed this round. |
| 27 | Known broken UI: Test History desktop title truncation (A6) | FAIL | Not fixed this round. |
