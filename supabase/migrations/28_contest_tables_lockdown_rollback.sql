-- 28_contest_tables_lockdown_rollback.sql — back to the state found on live on 1 Nov 2026 (OPEN: anyone can
-- read answer keys and change scores). Only for an emergency if 28 breaks something; fix forward instead.
begin;

drop policy if exists contest_attempts_own_select on public.contest_attempts;
drop policy if exists "Students manage own attempts" on public.contest_attempts;
create policy "Students manage own attempts" on public.contest_attempts
  for all using (student_id = auth.uid());
drop policy if exists "Read questions of active contests" on public.contest_questions;
create policy "Read questions of active contests" on public.contest_questions
  for select using (exists (select 1 from public.contests
                            where contests.id = contest_questions.contest_id and contests.status::text = 'active'));

grant select, insert, update, delete, truncate, references, trigger
  on public.contests, public.contest_questions, public.contest_attempts to anon, authenticated;

alter table public.contests          disable row level security;
alter table public.contest_questions disable row level security;
alter table public.contest_attempts  disable row level security;

commit;
