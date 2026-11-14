-- 28_contest_tables_lockdown.sql — contests / contest_questions / contest_attempts were wide open.
--
-- Found 1 Nov 2026 (read-only check of live, `supabase db query --linked`):
--   * RLS was DISABLED on all three tables, so their policies never applied;
--   * anon AND authenticated had SELECT, INSERT, UPDATE, DELETE, TRUNCATE on them.
--   → anyone with the public anon key could read every contest's correct_answer (cheat in any contest),
--     read every attempt (student names, emails, answers, scores) and change scores / results_published_at.
-- Just enabling RLS is not enough: "Read questions of active contests" would still hand out the answer key
-- of every active contest, and "Students manage own attempts" (ALL, no with check) would let a student
-- UPDATE their own score.
--
-- Who uses these tables:
--   * the FastAPI backend — get_supabase_admin() (service_role, bypasses RLS) for every contest route;
--   * the browser — ONLY ContestLivePage's gate: `contests` by short_code (id, title, status, schedule,
--     duration, answer_mode, max_warnings; no answers). Kept working by the existing
--     "Anyone can read active contests" policy.
--   * contest_questions / contest_attempts: never read or written by the browser (grep src, 1 Nov).
--
-- Re-runnable. Rollback: 28_contest_tables_lockdown_rollback.sql (restores the open state exactly).

begin;

alter table public.contests          enable row level security;
alter table public.contest_questions enable row level security;
alter table public.contest_attempts  enable row level security;

-- Writes only through the backend (service_role) from now on.
revoke insert, update, delete, truncate, references, trigger
  on public.contests, public.contest_questions, public.contest_attempts from anon, authenticated;
-- anon never needs questions or attempts
revoke select on public.contest_questions, public.contest_attempts from anon;

-- The answer key of every active contest — gone. Questions reach students only via POST /contests/{code}/start
-- (no correct_answer); the teacher keeps "Teachers manage own contest questions" (read-only now: no write grant).
drop policy if exists "Read questions of active contests" on public.contest_questions;

-- Was ALL (a student could update their own score). Students may only read their own rows.
drop policy if exists "Students manage own attempts" on public.contest_attempts;
drop policy if exists contest_attempts_own_select on public.contest_attempts;
create policy contest_attempts_own_select on public.contest_attempts
  for select to authenticated using (student_id = auth.uid());

-- Unchanged on purpose:
--   contests          "Anyone can read active contests"      (ContestLivePage gate; see Known issues)
--   contests          "Teachers manage own contests"         (read own; writes revoked above)
--   contest_questions "Teachers manage own contest questions" (read own; writes revoked above)
--   contest_attempts  "Teachers view attempts on their contests"

commit;

-- Known issues (not fixed here):
--   * "Anyone can read active contests" lets anyone list every active contest + short_code (= join any contest).
--     Fix: switch ContestLivePage's gate to get_contest_card() (29) or GET /contests/{code}/info, then drop it.

-- ─── VERIFY (run after; expected values in comments) ────────────────────────────────────────────────
-- select relname, relrowsecurity from pg_class
--  where relname in ('contests','contest_questions','contest_attempts');              -- all true
-- select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--  where table_schema = 'public' and grantee in ('anon','authenticated')
--    and table_name in ('contests','contest_questions','contest_attempts') group by 1, 2 order by 1, 2;
--   -- contest_attempts authenticated SELECT · contest_questions authenticated SELECT · contests anon SELECT,
--   -- contests authenticated SELECT  (nothing else; no anon row for questions/attempts)
-- select tablename, policyname, cmd from pg_policies
--  where tablename in ('contests','contest_questions','contest_attempts') order by 1, 2;
--   -- 5 rows: contest_attempts_own_select (SELECT), "Teachers view attempts on their contests",
--   -- "Teachers manage own contest questions", "Anyone can read active contests", "Teachers manage own contests"
-- Then: open a contest link as a student, start, answer, submit → result + leaderboard still work (backend).
