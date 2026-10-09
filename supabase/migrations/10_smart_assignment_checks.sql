-- 10_smart_assignment_checks.sql — history for the Smart Assignment Checker (10 Oct 2026)
--
-- The backend (service key) inserts one row per checked sheet; owner = the JWT user (teacher_id).
-- Browsers may only READ their own rows. No insert/update/delete policies → only the backend writes.
-- Safe to re-run.

create table if not exists public.smart_assignment_checks (
  id                 uuid primary key,
  teacher_id         uuid not null references auth.users(id) on delete cascade,
  student_name       text,
  student_class      text,
  student_roll       text,
  subject            text,
  class_grade        text,
  qp_filename        text,
  ss_filename        text,
  is_valid           boolean not null default false,
  total_obtained     numeric(6,2) not null default 0,
  max_marks          numeric(6,2) not null default 0,
  percentage         numeric(5,1) not null default 0,
  needs_review_count integer not null default 0,
  strictness         text not null default 'medium',
  overall_remarks    text,
  result_json        jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists smart_assignment_checks_teacher_created_idx
  on public.smart_assignment_checks (teacher_id, created_at desc);

alter table public.smart_assignment_checks enable row level security;

drop policy if exists "own checks read" on public.smart_assignment_checks;
create policy "own checks read" on public.smart_assignment_checks
  for select to authenticated using (teacher_id = auth.uid());

revoke all on public.smart_assignment_checks from anon;
revoke insert, update, delete on public.smart_assignment_checks from authenticated;
grant select on public.smart_assignment_checks to authenticated;

-- Verify:
--   select relrowsecurity from pg_class where relname = 'smart_assignment_checks';   → true
--   select policyname, cmd from pg_policies where tablename = 'smart_assignment_checks';  → 1 row, SELECT
