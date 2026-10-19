-- 20261019160000_rls_phase1_lock_internal_tables.sql — RLS Phase 1
--
-- Six tables that no browser code reads were open to anyone holding the public anon key:
--   contest_questions (incl. correct_answer), contest_attempts (scores), training_data,
--   student_invitations / teacher_invitations (emails, names), attendance_legacy (student attendance).
-- After this file: only service_role (the FastAPI backend, get_supabase_admin) and the SQL editor can use them.
--
-- Checked read-only on 19 Oct 2026 before writing this:
--   * frontend src/ + supabase/functions on main: no .from() on these tables (one old unmerged branch,
--     feat/institute-dashboard, reads them in ContestLivePage — it would need the backend instead);
--   * backend app/: contest_service.py and validation_service.py use get_supabase_admin() (service_role,
--     bypasses RLS); nothing uses the anon client on them;
--   * no function (SECURITY DEFINER or not), view or trigger in public references these tables; no FKs point at them.
--
-- Why policies are DROPPED, not just RLS turned on: contest_questions / contest_attempts already have policies that
-- sleep while RLS is off. Turning RLS on would wake them, and they are not safe for direct client access:
--   "Read questions of active contests" (SELECT, anyone)  → returns correct_answer (RLS is per row, not per column)
--   "Students manage own attempts"      (ALL, own rows)   → a student could rewrite their own score
-- attendance_legacy: "Public read attendance" is USING (true); "Members manage attendance" lets any member of the
-- institute edit legacy rows. The full definitions are in the rollback file.

begin;

alter table public.contest_questions   enable row level security;
alter table public.contest_attempts    enable row level security;
alter table public.training_data       enable row level security;
alter table public.student_invitations enable row level security;
alter table public.teacher_invitations enable row level security;
alter table public.attendance_legacy   enable row level security;  -- already on; kept so the file is self-contained

drop policy if exists "Read questions of active contests"      on public.contest_questions;
drop policy if exists "Teachers manage own contest questions"  on public.contest_questions;
drop policy if exists "Students manage own attempts"           on public.contest_attempts;
drop policy if exists "Teachers view attempts on their contests" on public.contest_attempts;
drop policy if exists "Public read attendance"                 on public.attendance_legacy;
drop policy if exists "Members manage attendance"              on public.attendance_legacy;

-- Belt and braces: no table privileges for the browser roles either (service_role keeps its own grants).
revoke all on public.contest_questions, public.contest_attempts, public.training_data,
              public.student_invitations, public.teacher_invitations, public.attendance_legacy
  from anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY (SQL editor). Expect: 6 × rls_on = true, policies = 0, anon/authenticated = false,
-- and each "as anon" select fails with "permission denied" (the block rolls back, nothing changes).
-- ════════════════════════════════════════════════════════════════════════════
-- select c.relname, c.relrowsecurity as rls_on,
--        (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
--        has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
--        has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
--        has_table_privilege('service_role', c.oid, 'SELECT') as service_role_select
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and c.relname in ('contest_questions','contest_attempts','training_data','student_invitations','teacher_invitations','attendance_legacy')
--  order by 1;
--
-- begin; set local role anon; select count(*) from public.contest_questions; rollback;   -- → ERROR: permission denied
--
-- After deploy, check in the app: create a contest, take it, see the score (backend uses service_role → unaffected).
