# Teacher dashboard — landing-parity report (28 Oct 2026)

Companion to `TEACHER_DASHBOARD_LANDING_PARITY_AUDIT.md` and `TEACHER_DASHBOARD_LANDING_PARITY_CHECKLIST.md`.
Branch `perf/teacher-dashboard`. **Not pushed, not deployed, migration 27 not executed.**

## 1. What was already implemented before this turn
See the audit §2. Blur/backdrop removal, flat action tiles, sidebar active state, removal of the fabricated analytics claim, the institute-card emoji fix. All verified in source.

## 2. What changed in this turn (files)

| File | Change |
|---|---|
| `src/pages/TeacherDashboardPage.tsx` | Test History row: always a column layout; title wraps (`break-words`, `min-w-0`, full title in `title=`); action buttons on their own wrapped line with a top divider. Orange gradient classes → landing coral (`bg-[#F95D6A]`) or tint (`bg-[#FFF1EC]`) in 6 places. |
| `src/pages/ModulesPage.tsx` | Header icon and two buttons: orange gradients → coral. (Topic-accent palette `TOPIC_COLORS` left as is, see §5.) |
| `src/components/teacher/TeacherStudentsTab.tsx` | Two avatar/tile gradients → tint. |
| `src/components/chat/StaticSarthi.tsx` | Help bubble `w-12 h-12` on phones (48 px, still a touch target), `sm:w-14 sm:h-14` above. |
| `src/components/teacher/TeacherAnalyticsTab.tsx` | (previous turn) fabricated "19.2% higher" banner removed. |
| `scripts/dashboard-repro.mjs` | New: reproduces D1 (title width) and D2 (bubble vs actions), writes before/after shots. `label` argument selects `before` or `after` filenames. |
| `scripts/dashboard-shots.mjs` | Now covers all 9 sidebar items (`WIDTHS` env selects widths). |
| `docs/screenshots/teacher-dashboard/landing-parity/` | `before-all/` (27 PNG), `after-all/` (27 PNG), `test-history-{desktop,mobile}-{before,after}.png`. |

## 3. Visual changes, route by route

- **Dashboard (home):** the earlier pass applies. Black primary "Create Test" and "Join Institute"; orange removed.
- **Test History:** rows no longer squeeze the title. Desktop 1440: title width 76 px → 715 px (full). Actions sit on their own line.
- **Calendar, Assignments, Attendance, Students, Modules, Analytics, AI Tools:** shell and card changes only. Modules header now coral. Attendance selected-day and Students avatars now coral/tint.
- **Help bubble (all tabs):** 48 px on phones.

Not redesigned (explicitly): the internal layouts of Calendar, Assignments, Attendance, Students, Analytics, AI Tools, and the Test Generator / Analytics pages linked from the dashboard. These need a page-by-page pass; the screenshot set is in place to review them.

## 4. Design-system parity matrix (summary; full table in the audit §5)

| Attribute | Landing | Dashboard now |
|---|---|---|
| Font | Plus Jakarta Sans | Plus Jakarta Sans (unchanged) |
| Primary CTA | black, white text | black (home CTAs) |
| Accent | coral `#F95D6A` | coral for sidebar active + icon chips + solid header/avatar accents |
| Card | white, hairline, soft shadow | white, hairline, soft shadow (`glass-panel`) |
| Heading | eyebrow + H2 + sub (marketing) | H1 + sub (task pages, intentionally not marketing) |

## 5. Screenshot index

| Set | Path | Count | Notes |
|---|---|---|---|
| Before (last commit `069665e`, with the previous UI pass stashed) | `docs/screenshots/teacher-dashboard/landing-parity/before-all/` | 9 tabs × 3 widths = 27 | `{tab}-{1440|768|390}.png` |
| After (current working tree) | `…/landing-parity/after-all/` | 27 | same names |
| Test History desktop | `…/landing-parity/test-history-desktop-{before,after}.png` | 2 | 1440 px |
| Test History mobile | `…/landing-parity/test-history-mobile-{before,after}.png` | 2 | 390 px, bubble state at page top |

Overflow check from `dashboard-shots.mjs`: 0 px horizontal overflow in all 27 "after" shots and all 27 "before" shots.

Landing-page header next to the dashboard header (requested) was **not captured** — `NOT TESTED`.

## 6. Test History fixes — evidence

- **D1 desktop title:** `dashboard-repro.mjs` before: `titleWidth 76, scrollWidth 715`. After: `titleWidth 715, scrollWidth 715`. Screenshot before/after in the landing-parity folder.
- **D2 mobile bubble:** before 56 px; after 48 px. Overlap at end-of-list: 0 before, 0 after (the `pb-24` already keeps the last row clear). Mid-scroll overlap is not removed: a fixed bubble is always above the list at some scroll positions. Status `PARTIAL`.

## 7. Performance

| Measure | Before | After | Status |
|---|---|---|---|
| Dashboard first-load JS (gzip) | 210 KB | 210 KB | `MEASURED` (no JS change this turn) |
| Dashboard first-load CSS (gzip) | 41 KB | 41 KB | `MEASURED` |
| Budget (JS ≤ 120 KB, CSS ≤ 20 KB) | not met | not met | `MEASURED` — the gap is the shared app shell (`main` 97 KB, vendor 46 KB, one app-wide CSS file). Not solvable inside this dashboard change. |
| LCP / CLS / TBT (Lighthouse) | — | — | `NOT TESTED` |

No optimisation was claimed for this turn; the changes are visual.

Next performance step with evidence behind it: split the app-wide CSS and the `main` chunk. Estimated, not measured.

## 8. Caching and security

- Caching: unchanged this turn (see implementation report §5).
- Security: no new issue found in the changed code. Pre-existing open items: migration 27 (not run), coin balances client-writable (open).

## 9. Build, type-check, lint, tests

| Check | Command | Result |
|---|---|---|
| Build | `npm run build` | PASS |
| Unit tests | `npm test` | PASS — 15 files, 136 tests |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | 40 errors, same as the verified baseline (all pre-existing; none in the files changed this turn) |
| Lint (changed files) | `npx eslint …` | 0 errors |
| Browser checks | `dashboard-shots.mjs` (27 + 27) and `dashboard-repro.mjs` | run, see §5 and §6 |
| Lighthouse | — | NOT RUN |
| Accessibility scan | — | NOT RUN |
| Browser workflows (create, download, check copies, join) | — | NOT RUN |

## 10. Remaining issues

- D4 Students page is a single banner when the teacher has no institute: no explanation of what to expect after joining.
- D5 "Create AI Module" icon orange (`src/components/ModuleCreator.tsx`).
- D6 Emoji in Test History buttons.
- D7 Modules topic palette keeps orange/purple/blue per topic (data-coded; decide whether to keep).
- A7 (mid-scroll bubble overlap) — inherent to a fixed bubble; not eliminated.
- Sub-pages not redesigned: Calendar, Assignments, Attendance, Students, Analytics, AI Tools internals; Test Generator; Analytics page.
- Dark mode not checked after these changes.
- Tablet 1024 px and 320/360/430 px not captured.

## 11. Migration 27

Not executed. Re-review: the file is `supabase/migrations/27_public_write_lockdown.sql` (with rollback). It revokes public write on `ncert_questions` / `ncert_chunks` and removes anon read on `attendance_legacy`. It was tested against a local Postgres 16 copy (44/44), not against the live database. Owner runs it on staging first, then production, then the VERIFY block at the end of the file.

## 12. Recommended next steps

1. Page-by-page pass on Students (empty/no-institute state), Attendance and Calendar, using the `after-all` shots as the review list.
2. Fix D5 (`ModuleCreator`) and D6 (emoji) — small, mechanical.
3. Run Lighthouse on `/dashboard` with an authenticated profile to get the first real LCP/CLS/TBT numbers.
4. Decide on the Modules topic palette (D7).
5. Commit this round after review; push when GitHub sign-in is available.
