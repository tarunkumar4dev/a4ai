# Teacher dashboard — landing-parity audit (28 Oct 2026)

Branch `perf/teacher-dashboard`. Labels: `VERIFIED` · `MEASURED` · `IMPLEMENTED, NOT VERIFIED` · `NOT TESTED` · `BLOCKED`.

## 1. Git baseline

- Branch: `perf/teacher-dashboard`. Last commit `069665e` (local only, **not pushed**: GitHub sign-in needed on this machine).
- Uncommitted before this turn (from the previous session):
  `src/pages/TeacherDashboardPage.tsx`, `src/components/institute/InstituteTeacherPanel.tsx`, `src/components/teacher/TeacherAnalyticsTab.tsx`,
  `supabase/.temp/cli-latest` (written by the Supabase CLI, not by product work — left alone), and untracked `docs/TEACHER_DASHBOARD_*.md`,
  `docs/screenshots/teacher-dashboard/{before,after}/`, `scripts/dashboard-shots.mjs`.
- Repo stashes `stash@{0..2}` belong to the user (made on `main`). Untouched. Each temporary stash in this turn was popped and verified byte-identical with `cmp`.

## 2. Previously reported work — verified status

| Claim from previous report | Status | Evidence |
|---|---|---|
| Blur layers and `backdrop-filter` removed | `VERIFIED` | `grep backdrop-filter src/pages/TeacherDashboardPage.tsx` → none in card/sidebar CSS; blurred orbs gone (screenshots). |
| Gradient buttons → neutral system | `VERIFIED` | `.btn-glossy-theme` / `.btn-startups` now white with `#E5E7EB` border. |
| Sidebar active state improved | `VERIFIED` | Coral tint `#FFF1EC` / `#D93F4D`, `aria-current`. |
| Attendance→score analytics claim removed | `VERIFIED` (and **still had a sibling**, see §4 A1) | Banner removed from `TeacherAnalyticsTab.tsx`. |
| Emoji removed from buttons | `REGRESSION / PARTIAL` | Institute card emoji removed. Test History row buttons still use emoji (👁️ 📄 🔑). Reported as remaining. |
| Before/after screenshots exist | `VERIFIED` (existed, but the "tests/analytics/assignments" *before* shots from the first pass were actually the home tab, because `?tab=` is not supported). Re-captured properly this turn. |
| Production build passes | `VERIFIED` | `npm run build` → built (1m 6s–2m). |
| 136 tests pass | `VERIFIED` | `npm test` → 15 files, 136 tests. |
| 40 TypeScript errors pre-existing | `VERIFIED` | `npx tsc --noEmit -p tsconfig.app.json` → 40, none in changed files. |

## 3. Route inventory (sidebar, `src/pages/TeacherDashboardPage.tsx`)

All sidebar items are tabs of `/dashboard` (state-driven; only `assignments` and `modules` have URL deep links).

| Sidebar item | Renders | Primary workflow | Data source (main) |
|---|---|---|---|
| Dashboard | home (`activeTab === "dashboard"`) | create test, what's new, institute card | `tests`, `batches`, `get_my_access`, plan RPCs |
| Calendar | `TeacherCalendarTab` (lazy) | view/add events | calendar tables (scoped) |
| Assignments | `TeacherAssignmentsTab` / `WorksheetGenerator` (lazy) | create assignment, upload link | `assignments`, `batches` |
| Attendance | `AttendancePage` (lazy) | mark class attendance | `class_sessions`, RPCs |
| Students | `TeacherStudentsTab` (lazy) | view/add students | `students`, `batches` |
| My Section | `ProctorSectionView` (proctors only) | section attendance | RPCs |
| Modules | `ModulesPage` (lazy) | generate AI module, test from module | backend `/modules/*` |
| Test History | `TestHistory` (in-file) | preview, download, check copies | `tests`, `test_links` |
| Analytics | `TeacherAnalyticsTab` (lazy) | marks + attendance analytics | `tests`, scope |
| AI Tools | in-file cards | links to checker / generator / quiz | none (static links) |

Plus `/dashboard/test-generator`, `/dashboard/analytics`, `/contests`, `/join-institute`, `/settings` (linked from tiles; separate pages, **not** redesigned here).

## 4. Existing visual defects (reproduced)

| # | Defect | Reproduced how | Status before this turn |
|---|---|---|---|
| D1 | Test History desktop: title squeezed to 76 px (`Chapt…`) | `scripts/dashboard-repro.mjs`, 1440 px: title `clientWidth 76`, `scrollWidth 715` | `VERIFIED` (reproduced) |
| D2 | Test History mobile: help bubble covers actions mid-scroll | phone 390 px: bubble `56×56` fixed bottom-right; at the end of the list there is no overlap (`overlappingActions: 0`, because `main` has `pb-24`). Mid-scroll overlap is inherent to a fixed bubble. | `PARTIAL — reproduced mid-scroll only` |
| D3 | Orange gradient leftovers (`from-orange-500 to-amber-500`, etc.) on Modules header, Attendance day, Students avatar | grep count: 14 occurrences in 3 files | `VERIFIED` |
| D4 | Students tab shows only the "Not part of an institute" banner for a teacher without an institute (no explanation of what to do beyond the button) | `students-1440.png` | observed, not changed |
| D5 | "Create AI Module" card icon is still orange (in `src/components/ModuleCreator.tsx`, separate file) | `modules-390.png` | observed, not changed |
| D6 | Emoji in Test History action buttons (👁️ 📄 🔑) | source | observed, not changed |
| D7 | `ModulesPage` `TOPIC_COLORS` palette uses orange/purple/blue gradients per topic | source line 83 | observed, not changed (data-coded accents) |

## 5. Design system — landing vs dashboard (actual values)

Landing (`src/components/LandingHero.tsx`, `src/pages/LandingPage.tsx`, `src/components/site/PageShell.tsx`):

| Attribute | Landing | Dashboard before this turn | Dashboard now |
|---|---|---|---|
| Font | Plus Jakarta Sans (self-hosted, `public/fonts/PlusJakartaSans-latin*.woff2`); `font-halenoir` → Jakarta | Plus Jakarta Sans (`customStyles` `font-family`) — same family, but dashboard also uses `font-black` everywhere | same as before (weights not changed) |
| Primary CTA | black `#111111`, white text, `rounded-xl`, 48 px | orange gradient `btn-startups` | black `#111111` (hero "Create Test", "Join Institute") |
| Secondary CTA | white, `border-2 #F95D6A`, coral text | white glossy tiles | white tiles, `#E5E7EB` border |
| Accent | `#F95D6A` coral, deep `#D93F4D` text | `var(--theme-start)` per theme (orange) | coral in sidebar active / icon chips; orange gradients removed from buttons and headers |
| Card | `rounded-[24px]`, `#E5E7EB` border, `shadow 0 8px 30px rgba(17,17,17,.05)` | `glass-panel` (rgba white, `backdrop-filter`) | solid white, hairline border, soft shadow |
| Section heading | eyebrow (coral caps) + H2 + sub (`SectionHeading`) | bold H1 + muted line | unchanged (not forced; dashboard pages are task pages) |
| Focus ring | `ring-2 #F95D6A` / `#111111` offset 2 | default | `focus-visible:ring-2 #111111` on sidebar items |

Not reused directly: `SectionHeading`, `Container` and `PageShell` are marketing-layout components (1200 px container, full page chrome). The dashboard has its own shell. Extracting them would import marketing layout into the app shell, which the brief warns against. The tokens (colour, border, shadow, button) are shared by value, not by component.

## 6. Performance baseline (this turn)

| Metric | Value | Status |
|---|---|---|
| Dashboard first-load JS (gzip, 22 files) | 210 KB | `MEASURED` (same as before this turn) |
| Dashboard first-load CSS (gzip) | 41 KB | `MEASURED` |
| LCP / CLS / TBT (Lighthouse) | — | `NOT TESTED` (Lighthouse not run) |
| Runtime paint cost of removed blur | — | `NOT TESTED` |
| Field INP/LCP | — | `BLOCKED` (no RUM data for the authenticated dashboard) |

Largest chunks on the dashboard load (from earlier measurement): `main` 97 KB gz, vendor/`chunkReload` 46 KB, shared CSS 41 KB, `TeacherDashboardPage` 22 KB, `input-otp` 11 KB. No new dependency added this turn.

## 7. Caching and security (scope check)

- Caching: unchanged this turn. Policy in `docs/TEACHER_DASHBOARD_IMPLEMENTATION_REPORT.md` §5 (immutable hashed assets, 7 days for fonts, HTML must-revalidate, per-user data not shared-cacheable). `VERIFIED` earlier with `curl -I`.
- Security: unchanged this turn. Open items: migration 27 (not run), coin balances client-writable (open). See the implementation report.
