# Teacher dashboard — implementation report (28 Oct 2026)

Companion to `TEACHER_DASHBOARD_AUDIT.md` and `TEACHER_DASHBOARD_ACCEPTANCE_CHECKLIST.md`.
Branch `perf/teacher-dashboard`. **Nothing pushed.** Migration 27 **not run**.

## 1. Files changed this round (uncommitted)

| File | Change | Why |
|---|---|---|
| `src/pages/TeacherDashboardPage.tsx` | Solid `glass-panel` / `glass-overlay` (no `backdrop-filter`); flat `btn-glossy-theme` / `btn-startups` (white tiles, dark text, hover = colour only); removed three blurred orbs; solid sidebar and mobile overlay; `SidebarButton` one neutral icon colour, landing coral active state, `aria-current`, 44 px targets; `GlossyButton` flat icon chips, no lift/scale, new `primary` variant (black, used for the hero "Create Test"); "NEW" badges and the plan "Upgrade" pill restyled. | Audit items A2–A4 |
| `src/components/institute/InstituteTeacherPanel.tsx` | Emoji replaced with `Building2` icon (coral chip); "Join Institute →" black, 44 px tall. | A4, A5 |
| `src/components/teacher/TeacherAnalyticsTab.tsx` | Removed the static "Classroom Correlation Insight … 19.2% higher" banner. | A1 (fabricated metric) |
| `scripts/dashboard-shots.mjs` | New: stubbed-session screenshot script (12 shots: 4 tabs × 3 widths), clicks sidebar items, waits for loading to finish, reports horizontal overflow. | Evidence |
| `docs/screenshots/teacher-dashboard/before/` · `after/` | 12 PNG each. | Evidence |
| `docs/TEACHER_DASHBOARD_AUDIT.md`, `…_IMPLEMENTATION_REPORT.md`, `…_ACCEPTANCE_CHECKLIST.md` | New. | Deliverables |

Committed earlier on this branch (not in this round): `069665e` — coins loaded once, institute card parallel + no logo HEAD,
test history keyed on user id, idle prefetch only on `/`, logo cache 1 day, migration `27_public_write_lockdown.sql` + rollback + local test.

`supabase/.temp/cli-latest` shows as modified: written by the Supabase CLI, not by this work. Left alone.

## 2. UI changes, route by route

**Dashboard shell (all tabs)**
- Sidebar: one neutral icon colour; active item uses the landing navbar's coral tint (`#FFF1EC` / `#D93F4D`); 44 px rows; `aria-current` on the active item.
- Background: solid `#F8F9FA`, no blurred orbs.
- Cards: white, `#E5E7EB` hairline, soft shadow. Dark mode: `#121212`, no shadow.

**Home (`dashboard` tab)**
- Hero "Create Test" is now the black primary button (was an orange gradient).
- "What's New" tiles: white, coral icon chip, dark title, grey sub-line, "NEW" pill in coral. "Join Institute" stays black.
- "Not part of an institute" banner: black button, icon chip instead of emoji.
- Plan widget: "Upgrade" is a white outline button with dark text.

**Analytics**
- Removed the invented "19.2% higher" insight. Nothing replaces it, because no computed value exists for it yet.

**Test History / Assignments / Calendar / Students / Attendance / AI tools**
- Inherit the shell and card changes only. Their internal layouts were **not** redesigned in this round.

## 3. Design-system reuse

- Colours and type from the landing page: `#1B1B1B` ink, `#5D6570` muted, `#F95D6A` / `#D93F4D` coral, `#FFF1EC` tint, `#111111` primary, `#E5E7EB` border, Plus Jakarta Sans.
- No new component library, animation library or chart library added.
- `GlossyButton` kept as the dashboard's action tile (same name, same props) with new `primary` prop; old `isStartupsStyle` still accepted.

## 4. Performance

| Measure | Before | After | Status |
|---|---|---|---|
| Dashboard first-load JS (gzip) | 210 KB | 210 KB | MEASURED — unchanged this round (style-only change) |
| Dashboard first-load CSS (gzip) | 41 KB | 41 KB | MEASURED — unchanged |
| Blurred full-screen layers | 3 | 0 | code change (verified by DOM/screenshot) |
| `backdrop-filter` uses on dashboard surfaces | glass-panel (all cards), sidebar, overlay | 0 | code change |
| Paint/frame time, LCP, CLS, TBT, INP | — | — | **NOT MEASURED** |

The removed blur and backdrop-filter should reduce paint cost on low-end devices, but I did not measure it.
Do not report a percentage improvement from this round.

## 5. Caching

No caching change this round. Current policy (from earlier work, see `docs/CACHE_POLICY.md` if present and `vercel.json`):

- `/assets/*` (content-hashed): `public, max-age=31536000, immutable`. Measured via `curl -I` (Vercel HIT).
- `/fonts/*`: `public, max-age=604800`.
- `index.html`: `max-age=0, must-revalidate`.
- Supabase REST/RPC (tests, members, coins): not shared-cacheable; per-user RLS.
- Institute logo / banner (Storage, public bucket): `cacheControl` 1 day for new uploads. Storage default served `private, no-cache` for existing objects.

Nothing in this policy caches teacher data publicly. No client query cache was added this round.

## 6. Security

- **Fixed this round:** A1, a fabricated metric shown to teachers (client-side only, not a data leak).
- **Open, high:** migration 27 (public writes to the question bank and RAG chunks) — **not executed on live**. Local pgserver test 44/44 PASS (`supabase/tests/27_public_write_lockdown_test.py`).
- **Open, high:** coin balances are client-writable; vouchers redeem client-side. Needs a server-side ledger before any voucher is fulfilled.
- Not reviewed this round: backend endpoint auth, payment webhooks, Storage policies beyond the logo bucket, dependency CVEs (`npm audit` not run).

## 7. Verification

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | PASS (built 1m 28s, 28 Oct) |
| Unit tests | `npm test` | PASS — 15 files, 136 tests |
| Lint (changed files) | `npx eslint <changed files>` | 0 errors |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | 40 errors in the project, **all pre-existing**: 6 in `TeacherDashboardPage.tsx` (icon `className` props), 1 in `CoinContext.tsx`, the rest elsewhere. None introduced by this round. |
| Horizontal overflow | `scripts/dashboard-shots.mjs` | 0 px at 1440 / 768 / 390 on home, Test History, Analytics, Assignments (12 of 12) |
| Browser workflow tests (create test, download, check copies, join institute) | — | **NOT RUN** this round |
| Lighthouse | — | **NOT RUN** |
| Accessibility scan (axe) | — | **NOT RUN** |

Screenshots (stubbed teacher session, no real data): `docs/screenshots/teacher-dashboard/before/` and `after/`.
Before captures were taken with the earlier code stashed; the stash was restored byte-identical (verified with `cmp`).

## 8. Git state

- Branch: `perf/teacher-dashboard`, ahead of `origin` by 1 commit (`069665e`) — **not pushed** (GitHub sign-in needed on this machine).
- Uncommitted: the five files in §1.
- Other stashes in the repo (`stash@{0}`, `stash@{1}`, both made on `main` before this session) are untouched.

## 9. Known limitations

- Visual work covered the home tab and the sidebar. Other tabs inherit the shell but their internal layouts are unchanged.
- Screenshots use a stubbed session with one sample test, so empty, loading and error states with real data were not captured.
- Dark mode not checked after the change.
- The chat-bubble overlap on phones (A7) and the Test History title truncation (A6) remain.
