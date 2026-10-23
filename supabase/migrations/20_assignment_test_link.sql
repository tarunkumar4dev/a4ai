-- 20_assignment_test_link.sql — "📸 Checking Link" from a generated / saved test (23 Oct 2026).
--
-- A test (Test History) can be handed to a class as an upload link in one step. The link is an assignment
-- (docs/upload-flow-api.md); this column remembers which test it came from, so
--   * the same test + class reuses its assignment instead of creating a second one, and
--   * the test page / Test History can show "📸 Checking Link ✓" and open the existing link.
-- Nullable: every existing assignment stays as it is. RLS unchanged (assignments policies from 02 apply).
-- Requires 18 + 19. Safe to re-run.

begin;

alter table public.assignments
  add column if not exists test_id uuid references public.tests(id) on delete set null;

create index if not exists assignments_test_batch_idx
  on public.assignments (test_id, batch_id) where test_id is not null;

commit;

-- VERIFY (read-only; both true)
-- select 'test_id column', exists (select 1 from information_schema.columns where table_name = 'assignments' and column_name = 'test_id')
-- union all select 'index', exists (select 1 from pg_indexes where indexname = 'assignments_test_batch_idx');
