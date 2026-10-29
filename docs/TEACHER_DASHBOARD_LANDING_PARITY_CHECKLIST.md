# Teacher dashboard — landing-parity checklist (28 Oct 2026)

States: `PASS — VERIFIED` · `FAIL` · `NOT TESTED` · `BLOCKED`.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Git state inspected; prior uncommitted work preserved | PASS — VERIFIED | `git status` in audit §1; stashes `cmp`-verified; no reset/clean used. |
| 2 | Previously reported work verified (not assumed) | PASS — VERIFIED | Audit §2 table, each claim with file/grep/command. One claim (emoji removed) is partial → listed. |
| 3 | Actual route inventory of sidebar items | PASS — VERIFIED | Audit §3 (9 sidebar tabs + My Section); source file per tab. |
| 4 | Landing design system extracted with real values | PASS — VERIFIED | Audit §5; values from `LandingHero.tsx`, `PageShell.tsx`. |
| 5 | Visual-parity matrix filled with real values | PASS — VERIFIED | Audit §5 table. |
| 6 | Test History desktop title truncation reproduced, fixed | PASS — VERIFIED | `dashboard-repro.mjs`: 76 px → 715 px (= scroll width). Screenshots `test-history-desktop-{before,after}.png`. |
| 7 | Test History mobile bubble overlap reproduced | PASS — VERIFIED | Mid-scroll overlap reproduced by design; end-of-list overlap: none before/after. |
| 8 | Test History mobile bubble overlap fixed | FAIL | Bubble is smaller (48 px) but a fixed bubble still covers content mid-scroll. Partial. |
| 9 | Home page redesigned around real workflows | FAIL (this turn) | Home changes from the earlier pass only; no new workflow sections added this turn. |
| 10 | Every sidebar sub-route redesigned | FAIL | Shell and cards applied to all; internal layouts of Calendar, Assignments, Attendance, Students, Analytics, AI Tools not redesigned. |
| 11 | Shared primitives reused / extracted safely | PASS — VERIFIED (partial) | Tokens shared by value; marketing `SectionHeading`/`PageShell` deliberately not imported into the dashboard (reason in audit §5). |
| 12 | Orange gradient leftovers removed | PASS — VERIFIED (partial) | 14 found → 10 replaced (`grep` after). Remaining: decorative white overlay (ok) and Modules topic palette (D7, decision open). |
| 13 | Before/after screenshots for every sidebar item at 1440 / 768 / 390 | PASS — VERIFIED | 27 before + 27 after under `landing-parity/`. |
| 14 | Landing header next to dashboard header captured | NOT TESTED | Not captured. |
| 15 | No horizontal overflow at 1440 / 768 / 390 (all sidebar tabs) | PASS — VERIFIED | `dashboard-shots.mjs`: 27/27 `0px` after; 27/27 before. |
| 16 | 320 / 360 / 430 / 1024 / 1920 px checked | NOT TESTED | Not captured this turn. |
| 17 | Performance: initial JS measured with stated method | PASS — VERIFIED | 22 files, 210 KB gzip (`jsbudget` script, local production build). |
| 18 | Performance: JS budget (120 KB) met | FAIL | 210 KB. Gap is the shared app shell, not this dashboard. |
| 19 | Performance: CSS budget (20 KB) met | FAIL | 41 KB. Shared CSS file. |
| 20 | Performance: LCP / CLS / TBT (Lighthouse) | NOT TESTED | Lighthouse not run. |
| 21 | Performance: field INP / LCP | BLOCKED | No RUM data for the authenticated dashboard. |
| 22 | Performance improvement claimed for this turn | NOT TESTED | No runtime optimisation this turn; none claimed. |
| 23 | Caching: static assets immutable, private data not shared-cacheable | PASS — VERIFIED | Earlier `curl -I` checks (report §8); unchanged this turn. |
| 24 | Caching: header check repeated this turn | NOT TESTED | Not repeated. |
| 25 | Security: no new issue introduced by this turn's changes | PASS — VERIFIED (code review) | Changes are presentational (class names, Test History layout, bubble size). |
| 26 | Security: migration 27 | BLOCKED (by instruction) | Reviewed; not executed. Owner runs it on staging first. |
| 27 | Security: coin balances client-writable | FAIL | Open; needs a server-side ledger. |
| 28 | Fabricated analytics claim removed | PASS — VERIFIED | Earlier turn: banner removed; grep for "19.2%" → 0. |
| 29 | Other static analytics copy reviewed | NOT TESTED | Not reviewed. |
| 30 | Build passes | PASS — VERIFIED | `npm run build`. |
| 31 | Unit tests pass (136) | PASS — VERIFIED | `npm test`. |
| 32 | Typecheck: no new errors | PASS — VERIFIED | 40 errors, same as baseline; none in changed files. |
| 33 | Lint on changed files | PASS — VERIFIED | 0 errors. |
| 34 | Browser e2e for create / download / check copies / join | NOT TESTED | — |
| 35 | Accessibility scan (axe / Lighthouse a11y) | NOT TESTED | — |
| 36 | Dark mode after changes | NOT TESTED | — |
| 37 | Emoji removed from Test History buttons (D6) | FAIL | Still present. |
| 38 | `ModuleCreator` orange icon (D5) | FAIL | Still orange. |
| 39 | No git push / deploy / production SQL performed | PASS — VERIFIED | None performed. Commit `069665e` local only. |
| 40 | Working tree scope: intended files only | PASS — VERIFIED | `git status`: dashboard files, `scripts/dashboard-*.mjs`, `docs/`, `docs/screenshots/`. `supabase/.temp/cli-latest` pre-existing (CLI-written). |
