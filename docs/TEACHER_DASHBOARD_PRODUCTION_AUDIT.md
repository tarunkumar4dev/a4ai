# Teacher dashboard — production audit (27 Oct 2026)

Scope: the teacher dashboard (`/dashboard`, `src/pages/TeacherDashboardPage.tsx` and what it loads), the data it
reads, and the database objects it depends on. Branch `perf/teacher-dashboard`. Contests, payments, load testing
and the student portal were **not** in scope (see §8).

Labels: **MEASURED** = observed under the stated conditions · **ESTIMATED** = calculated from stated assumptions ·
**NOT TESTED** · **VERIFIED FIX** = reproduced, fixed, retested · **UNRESOLVED**.

## 1. How the dashboard loads (actual architecture)

Browser SPA (React 18 + Vite, hosted on Vercel) talks to **Supabase directly** (PostgREST + RPC, user JWT, RLS).
AI work (test generation, copy checking) goes to the FastAPI backend (`getBackendApiBase()`), not on first load.

First open of `/dashboard`, in order:

| Who | Request | Why |
|---|---|---|
| AuthProvider | `teacher_profiles?select=id` | make sure the teacher profile row exists |
| AccessProvider | `rpc/get_my_access` | role, institute, scope ids (RLS helpers) |
| CoinProvider (app-wide) | `profiles?select=coins,…` + `coin_transactions` (20) | coin balance |
| Dashboard | `tests` (own, newest 50) | recent tests, monthly count |
| useSubscription | `plans` + `rpc/get_user_plan_status` + `HEAD tests` (count this month) | plan widget |
| useMyScope | `batches` (institute, `id ∈ teaching ids OR section ∈ proctor sections`) | my classes |
| InstituteTeacherPanel | `institute_members` (own rows) ‖ `institutes` (name) → `departments` (if any) → `students` (batch ids, for counts) | institute card |
| useProctorCheck | `institute_members` / `institutes` (owner) | proctor tab |

Every tab (attendance, students, calendar, assignments, analytics, …) is a separate lazy chunk fetched when opened.

## 2. Measurements

All MEASURED on a local production build (`vite preview`), Chromium (Playwright), fake teacher session with
Supabase responses stubbed (no real data). n = 3 where a range is given.

| Metric | Before | After |
|---|---|---|
| Data requests on first load | 19 (4 duplicates: coins ×3, coin_transactions ×3) | 15 → 13* (0 duplicates) |
| Institute card visible, 400 ms per request (simulated 3G round trip) | 4.3 / 4.9 / 5.8 s | 3.6 / 3.6 / 4.3 s |
| JS files on first load | 68 | 21 |
| JS on first load (gzip) | 267 KB | 210 KB |
| CSS on first load (gzip) | 41 KB | 41 KB |
| Main dashboard chunk (gzip) — from the earlier round | 83 KB | 22 KB |

\* 15 with an institute (logo GET included), 13 without.

Live headers (MEASURED, `curl -I`, 27 Oct): HTML `public, max-age=0, must-revalidate`; `/assets/*`
`public, max-age=31536000, immutable` (Vercel HIT); `/fonts/*` `max-age=604800`; Storage logo
`private, no-cache` (Cloudflare DYNAMIC); `a4ai.in` → `www.a4ai.in` is a **307**.

Budgets: dashboard JS ≤ 120 KB gzip and CSS ≤ 20 KB gzip are **not met** (210 KB / 41 KB). The rest is the shared app
shell: `main` 97 KB + vendor 46 KB + one Tailwind CSS file for the whole app. LCP / INP for real users: NOT TESTED
(no RUM data; Vercel Speed Insights is installed and is the place to read p75).

## 3. Changes in this round

| # | Change | File | Status |
|---|---|---|---|
| P1 | Coins loaded once per user, not 3× (effect keyed on `user.id`; explicit columns) | `src/context/CoinContext.tsx` | VERIFIED FIX (19→15 requests) |
| P2 | Institute card: membership + institute queries in parallel; logo without the HEAD round trip and without the `?t=` cache-buster | `src/components/institute/InstituteTeacherPanel.tsx` | VERIFIED FIX (time above) |
| P3 | Test history keyed on `user.id`, cancelled on unmount, errors shown instead of an empty list | `src/pages/TeacherDashboardPage.tsx` | VERIFIED (build, lint, unit) |
| P4 | Idle prefetch of Landing + Login only on `/`, only Login, never on Data Saver / 2G (dashboards downloaded ~26 KB gzip for nothing) | `src/App.tsx` | VERIFIED FIX (68→21 files) |
| C1 | Logo/banner uploads set `cacheControl: 86400` (Storage served `no-cache`) | `src/pages/institute/InstituteDashboardPage.tsx` | applies to new uploads; NOT TESTED live |
| S1 | Migration 27: no public / signed-in writes to the question bank and RAG chunks; no anon read on `attendance_legacy` | `supabase/migrations/27_public_write_lockdown.sql` (+ rollback, + test) | VERIFIED locally (44/44); **not run on live** |

## 4. Security findings

Found with READ-ONLY queries on the live DB (`pg_policy`, `has_table_privilege`, `has_column_privilege`). Nothing was
written to production; no exploit was attempted against it.

| ID | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| SEC-1 | **High** | `ncert_questions`: INSERT policy `WITH CHECK true` for PUBLIC + INSERT grant to `anon` → anyone with the public anon key can add questions that appear in every teacher's papers | policy `ncert_questions_insert_service`; `has_table_privilege('anon',…,'INSERT') = true`; reproduced on a local copy | Fix written (27), VERIFIED locally, **UNRESOLVED on live until 27 runs** |
| SEC-2 | **High** | `ncert_chunks`: any signed-in user may INSERT / UPDATE / DELETE the NCERT knowledge base the generator retrieves from | policies "Allow authenticated insert/update/delete" (`auth.role() = 'authenticated'`) | same as SEC-1 |
| SEC-3 | **High** | Coins: users can UPDATE their own `profiles.coins` / `total_coins_earned` and INSERT their own `coin_transactions`; coins are redeemed client-side for ₹100–250 shopping vouchers | `has_column_privilege('authenticated','profiles','coins','UPDATE') = true`; policy "insert own transactions"; `CoinContext.redeemVoucher` | **UNRESOLVED** — needs a server-side coin ledger (SECURITY DEFINER RPCs for earn/spend, revoke the column UPDATE). Product decision on earning rules first. Until then, don't fulfil vouchers from client-recorded balances. |
| SEC-4 | Low | `attendance_legacy` readable by anyone (PUBLIC `USING true`); table has 0 rows | policy "Public read attendance"; `count(*) = 0` | Fix in 27; UNRESOLVED on live |
| SEC-5 | Medium (known) | `notes` readable by anon (`notes_read_anyone`) | policy list | UNRESOLVED (already in CLAUDE.md "Known after Step 8") |
| OK | — | `tests`: own-row policies; `service_role_full_access` is limited to `service_role` | `polroles = {service_role}` | no issue |
| OK | — | `coin_transactions` / `profiles` / `teacher_profiles` reads are own-row only | policies | no issue |

Not reviewed this round (NOT TESTED): the FastAPI backend's own auth on every endpoint, payment webhooks, Storage
bucket policies beyond the logo, dependency CVEs (`npm audit` not run).

## 5. Cache policy (dashboard-relevant)

| Resource | Policy | Why |
|---|---|---|
| `index.html` | `max-age=0, must-revalidate` (Vercel default) | new deploys show up at once; chunk 404s after a deploy are handled by `src/lib/chunkReload.ts` |
| `/assets/*` (hashed JS/CSS/images) | 1 year, immutable (`vercel.json`) | file name changes when content changes |
| `/fonts/*` | 7 days (`vercel.json`) | not hashed; changed only by renaming |
| Supabase REST / RPC (tests, scope, members, coins) | not cached (per-user, RLS) | private data; never shared-cached |
| Institute logo / banner (Storage, public bucket) | 1 day from now on (C1) | same URL reused on change; 7 days would show an old logo for a week |
| Plans (`plans`) | not cached today | candidate for a 1-day client cache — tiny table, public |

No server-side or shared cache was added: the dashboard has no shared hot read that would justify one (ESTIMATED).

## 6. Capacity (ESTIMATED, NOT TESTED)

Assumption: one dashboard open = 13–15 Supabase requests, all small indexed reads by `user_id` / `institute_id`.
Example burst: 2,000 teachers open the dashboard within 5 minutes at 9 am → 2,000 × 15 / 300 s ≈ **100 requests/s**
to PostgREST for 5 minutes. With ~50 ms per request (assumed), Little's Law gives ~5 requests in flight on average.
That is well inside a single Supabase project's PostgREST capacity on paid tiers, but the connection-pool size,
plan limits and the real p95 latency were **not measured** — no staging environment was available and load tests
against production are not allowed.

First likely bottleneck when classes grow: `InstituteTeacherPanel` downloads one `students.batch_id` row per student
to count them (O(students) rows per open). Replace with a counting RPC when an institute passes a few thousand students.

## 7. Deploy and rollback

1. Frontend: merge the branch → Vercel deploys. Rollback = redeploy the previous deployment in Vercel. No API
   contract changed.
2. Database (owner runs it in the SQL editor): `supabase/migrations/27_public_write_lockdown.sql`, then its VERIFY
   block, then build a paper in the test generator (questions must still load). Rollback:
   `27_public_write_lockdown_rollback.sql`. Local test: `supabase/tests/27_public_write_lockdown_test.py`
   (pgserver venv, see the file header).
3. Vercel domain settings: make `a4ai.in` → `www.a4ai.in` a permanent (308) redirect.

## 8. Not done in this round (and why)

- Contest reliability, payment webhooks, capacity for 10k req/min or 1M participants, load testing: outside the
  teacher-dashboard scope; load tests also need an authorised staging project.
- Shared JS shell (143 KB gzip) and the single 41 KB CSS file: splitting them is an app-wide change.
- Tabs refetch when you switch back to them (they unmount). Moving tab data to React Query (already installed)
  would cache it per session.

## 9. Top 3 next tasks

1. Run migration 27 on live (SEC-1, SEC-2).
2. Server-side coin ledger before any voucher is fulfilled (SEC-3).
3. Student-count RPC for the institute card + React Query for tab data (fewer, smaller requests per open).
