# /contests — architecture, scaling and resilience (1 Nov 2026)

Scope: the contest home page (`/contests`), its data (migration 29), the contest-table lockdown found while
inspecting it (migration 28). The contest attempt flow (`/contest/:code`, FastAPI backend) and the per-contest
leaderboard page are unchanged; the leaderboard is assessed in §4.

## 1. What changed, and why

| # | Problem (evidence) | Change | Files | Risk |
|---|---|---|---|---|
| 1 | Page was hard-coded: sample contests, "Top 20% / 1420 / 162 solved / 7 day streak", name fallback "Tarun", fake calendar + daily challenge. Only real query: `mega_contests` — **that table does not exist on live** → "Failed to load contests" toast. | Real data from one RPC; fake widgets removed. | `src/pages/ContestLandingPage.tsx`, `src/components/contests/*` | Students with no contests see an empty state + "Join with a code" (honest). |
| 2 | There was no listing API at all (backend has create / info / start / submit / leaderboard / my). | `get_my_contests` = contests you own + registered + attempted, one call per page (items, tab counts, subject facets, banner contest, schedule dates, `server_now`). | `supabase/migrations/29_contest_feed.sql`, `src/lib/contestFeed.ts` | Page shows "Contest list isn't switched on yet" until 29 runs; codes still open `/contest/:code`. |
| 3 | No registration concept → nothing "upcoming" for a student. | `contest_registrations` (PK contest_id+student_id), `register_for_contest(code)` idempotent. | 29, `JoinCodeCard.tsx` | none (new table). |
| 4 | **Live security hole**: RLS disabled on `contests` / `contest_questions` / `contest_attempts`, anon + authenticated had full table rights → anyone with the public anon key could read every answer key, every attempt (names, emails, scores) and rewrite scores / `results_published_at`. Policies existed but never applied; two of them were unsafe anyway. | RLS on, writes revoked, answer-key policy dropped, student policy SELECT-only. Backend uses `get_supabase_admin()` (service role) → unaffected. | `28_contest_tables_lockdown.sql` (+ rollback) | `ContestLivePage` gate still reads active contests (kept). A paused contest now reads as "not found" in that legacy gate. |
| 5 | One `setInterval` per card would drift and use the phone clock. | One shared clock (`useSyncExternalStore`), server-corrected, paused while hidden; rows re-render only on a phase flip. | `src/lib/serverClock.ts` | — |
| 6 | Rules for "what can I do" were scattered. | `contestLifecycle.ts`: typed `MyState × Phase → ContestAction`, exhaustive (`assertNever`), the only place. | `src/lib/contestLifecycle.ts` | — |
| 7 | Login sent self-signed-up students to the teacher dashboard (`home_route` is `/dashboard` for everyone without an institute; RoleRoute treated `none` as teacher). | `resolveHomeRoute(access, signupRole)` used by login, Google callback, reset password, RoleRoute. | `src/lib/homeRoute.ts` | — |

## 2. What the current architecture can and cannot carry

Current: React SPA (Vite) on Vercel → Supabase PostgREST RPCs (this page) and FastAPI on Vercel (attempts).
No Redis, no WebSockets, no server rendering — none was added.

**Safe now (measured or by construction)**
- Page data = 1 RPC per page view, index-driven per user, ≤ 50 items per call, keyset pages.
- No polling. Refetch only when stale (30 s) and the tab regains focus / the network returns, plus once per
  countdown boundary per user (throttled 5 s, jittered 0–3 s).
- Registration correctness does not depend on the browser (PK + `ON CONFLICT DO NOTHING`).

**Needs backend / infrastructure work before large events**
- Contest start spike: N students pressing Start at a scheduled minute all hit FastAPI `/start` (insert attempt
  + load questions). Not touched here; needs its own load test.
- Leaderboard for big contests (§4).
- Supabase compute tier and PostgREST pool size are unknown from the repo — capacity depends on them.

## 3. Three different "10,000"s

Measured with `supabase/tests/29_contest_feed_bench.py` on a local Postgres 16 (laptop, no network, no
PostgREST, median of 7 warm runs). These are **not** production numbers; live today has 39 contests / 82 attempts.

| Call | Synthetic data | Before restructure | After |
|---|---|---|---|
| `get_my_contests` heavy student (300 registrations + 200 attempts), page 1 | 10,000 contests | 175 ms | **49 ms** |
| same, teacher owning 2,000 contests, page 1 / page 5 (keyset) / search | | 497 ms | **91 / 93 / 134 ms** |
| `get_contest_card` (contest with 10,000 attempts) | | 21 ms | **9 ms** |
| `register_for_contest` | | 110 ms | **10 ms** |

"Before" built the page JSON for every connected contest; now classification uses scalars and JSON is built only
for the ≤ 20 returned rows (`a4_contest_items`). EXPLAIN: index scans on `contests.teacher_id`,
`contest_registrations (student_id, contest_id)`, `contest_attempts (student_id, contest_id)` (new index), ~4.5k
buffer hits for the 2,000-contest teacher.

**A. 10,000 concurrent users on /contests** — cost is per page view: `get_my_access` + `get_my_contests` +
2 coin reads. Bottleneck = Postgres CPU for `get_my_contests` (tens of ms each). Not load-tested → **no
readiness claim**. Scenarios to run (k6 or similar, against staging with production-sized data):
1. Steady browse: 10,000 virtual users, each opens /contests, idles 2–5 min, refocuses (refetch), 20 % switch tab
   or search (debounced, 1 request per settled query). Target p95 `get_my_contests` < 300 ms, 0 errors.
2. Scheduled start: 10,000 users registered for one contest, page open at T-60 s; at T the clients flip locally
   and refetch spread over 0–3 s; measure RPC p95 and DB CPU in that window. Then 50 % press Start → FastAPI
   `/start` (the real spike).
3. Register burst: 2,000 users register for the same code within 10 s, 10 % double-clicking / retrying →
   exactly one row per user, p95 < 300 ms.

**B. 10,000 contest records** — query cost follows the rows connected to the caller, not the table size (index
lookups). A single account with many thousands of own contests pays O(n) per call for counts/facets (91 ms at
2,000). If that ever happens: precomputed per-user counts. Not needed at today's scale.

**C. 10,000 leaderboard participants** — see §4.

## 4. Leaderboard (backend, assessed, not changed)

`contest_service._board()` (FastAPI, origin/main):
- selects **every** attempt of the contest including the `answers` JSON, with no `.range()` → Supabase's
  PostgREST row limit (default 1,000; check Dashboard → API settings) **silently truncates** a bigger contest,
  so ranks after 1,000 are wrong/missing;
- recomputes correct/wrong/left in Python by matching every answer of every attempt;
- returns the whole board to every viewer; cache 10 s per serverless instance.
- Measured locally for 10,000 attempts × 30 answers: the read alone is **2.2 s and ~27 MB**, before Python work.

Proposal (backend repo, needs its own review): store correct/wrong/left on the attempt when it is finalized;
rank in SQL with a partial index `(contest_id, score desc, time_taken_seconds, warning_count, id) where status <>
'in_progress'`; return keyset pages of 50 + the caller's own row (`count(*)` of better rows). Measured: a ranked
page of 50 over 10,000 attempts = **3.8 ms** (index-only scan, 53 buffers). The backend stays authoritative for
scores and tie-breaks (score ↓, time ↑, tab switches ↑). Redis / realtime: no evidence they are needed.

## 5. Behaviour under failure (all covered by tests)

| Case | Behaviour | Test |
|---|---|---|
| Slow network / no answer | 12 s timeout per request, 2 automatic retries (1 s, 2 s), then "This is taking too long" + Try again | e2e `slow network` |
| Superseded search | old request aborted (TanStack signal → `abortSignal`); key per search, so an old answer can never replace a new one | e2e `search is debounced…`, unit `contestFeed` |
| Partial body / odd rows | missing fields → defaults, rows without id/code skipped, unknown `my_state` → `none`, unknown status → paused | unit `normalizeContest`, `parseFeedPage`; e2e partial row |
| Failed image | logo hidden on error; banners use inline SVG icons only | e2e (logo request aborted) |
| Stale auth | "Your session has expired" + Sign in again | e2e |
| 29 not applied | friendly note; code / link still opens `/contest/:code` | e2e |
| Duplicate register | button locks synchronously; server PK → one row; repeat answers `already_registered` | e2e (dblclick → 1 request), SQL (two connections at once) |
| Refresh | data refetched, registration persists | e2e |
| Two tabs | BroadcastChannel tells the other tab to refetch; second register = already registered | e2e |
| Paused contest | "Paused" pill + disabled action | e2e, unit matrix |
| Results processing (`teacher_release`) | no score from the server, "Results soon" | SQL + e2e |
| Countdown hits 0 | button flips on the server clock; refetch 0–3 s later | e2e (device clock 10 min off) |
| Background tab | clock stops; jumps to the right time on return | unit `serverClock` |

Monitoring: errors go to the console as `[contests] <where> failed (<kind>)` and to Google Analytics as event
`contests_error {where, kind}` when gtag is loaded (no names, codes or ids). No other monitoring exists in the app.

## 6. Mobile and accessibility

- One sticky element (header, safe-area padded). No sticky filters, no bottom CTA. Banners: manual swipe row on
  phones (no autoplay), 3 columns from `md`. Rows: card layout below `xl`, table from `xl` (fixed action column).
- Filters (search + subject) in a bottom sheet on phones (Radix dialog: focus trap, Esc, labelled).
- No animations (lite mode). Countdown digits `tabular-nums`, `role="timer"` (not announced every second).
- Contrast (WCAG 2.2 AA, text ≥ 4.5:1): banner text white on #9F1239 / #065F46, #1C1917 / #44270A on #F59E0B;
  pills #166534 on #DCFCE7, #92400E on #FEF3C7, #475569 on #F1F5F9, #1E40AF on #DBEAFE; accent text #C2410C
  (not orange-500, which fails on white). Error text on amber #7F1D1D (4.6:1).
- Tabs: `role=tablist`, arrow keys; chips `aria-pressed`; calendar `aria-current="date"`.

## 6b. Visual redesign (phase 2, 1 Nov)

Why phase 1 did not look different: (1) nothing is deployed — all work is uncommitted on
`perf/institute-dashboard`, production (`main`) still serves the old page; (2) against the live DB the new page
shows its "list not switched on" state, because `get_my_contests` does not exist there yet (HTTP 404 PGRST202,
checked 1 Nov) — one generic banner over an empty list; (3) the student dashboard's main "Enter contest code" CTA
went to `/contests/join` = the old `JoinContestPage` with hard-coded sample contests; (4) phase 1 kept the old
skeleton (banner row + table-like rows + side column), so even with data it read as a restyle.

Phase 2 (same data, APIs, lifecycle, clock, cache):
- `ContestNav` — a4ai top bar: Dashboard · Contests (active, crimson underline) · Practice / My contests · Rewards,
  account dropdown (dashboard, rewards, settings, sign out), phone menu. Coins only from `useCoins().balance`
  (the real `profiles.coins`; `coins` falls back to 100 — never shown here).
- Banner row in the main column (LeetCode explore layout): crimson featured contest with a large countdown,
  royal-blue join-by-code, golden practice (students) / create (teachers). Solid colours, corner geometry only.
- Underline tabs + toolbar search, subject chips (scroll row on phones), **cards** in sections: *Live now* /
  *Starting soon* (the upcoming view is sorted by start, so all live items come before scheduled ones — the split
  follows the server's page order) and *Completed & closed*. Card = subject tile, title, status, 3-cell fact
  strip, countdown / score / participation state, one action.
- Sidebar: calendar (contest days are buttons listing that day's loaded contests, "Next scheduled" strip),
  **Latest results** (real FastAPI leaderboard of your latest finished contest — top 3 + your rank; loads only
  when the card is on screen; reuses the Past tab's cache), coins (real balance only), fair play.
- `/contests/join` redirects to `/contests?join=1` (focuses the code box).
- Not built (no data): prizes, "mega contests", achievements, a global leaderboard. The plain
  `/contests/leaderboard` page (student dashboard links to it) is still the old hard-coded leaderboard.

## 7. Run order

1. `28_contest_tables_lockdown.sql` + its VERIFY block, then one contest end to end as a student.
2. `29_contest_feed.sql` + VERIFY (it ends with `notify pgrst, 'reload schema'`).
3. Deploy the frontend (works before 29 too, with the "not switched on yet" note).

Tests: `npm test` (unit), `npx playwright test tests/e2e/contests.spec.ts`,
`<pgtest>/python supabase/tests/28_29_contests_test.py` (99 checks), `…/29_contest_feed_bench.py`.

## 8. Not done / known

- Unregister, rank in the list, per-contest leaderboard pagination (§4), "Anyone can read active contests"
  (lets anyone list active contests + codes; replace the `ContestLivePage` gate with `get_contest_card`).
- Opening a contest link does not auto-register (only "Join with a code" does; attempted contests appear anyway).
- `MegaContestLivePage` / `AdminAddQuestions` still read the non-existent `mega_contests` tables.
