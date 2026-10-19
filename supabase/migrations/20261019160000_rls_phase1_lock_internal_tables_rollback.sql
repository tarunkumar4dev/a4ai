-- 20261019160000_rls_phase1_lock_internal_tables_rollback.sql
-- Puts back the state of 19 Oct 2026 (read from live): RLS off on 5 tables, the 6 policies, full anon/authenticated
-- grants. WARNING: this re-opens the tables to anyone with the anon key. Use only if a feature broke.

begin;

alter table public.contest_questions disable row level security;
alter table public.contest_attempts disable row level security;
alter table public.training_data disable row level security;
alter table public.student_invitations disable row level security;
alter table public.teacher_invitations disable row level security;
-- attendance_legacy had RLS on already: left on.

create policy "Members manage attendance" on public.attendance_legacy as permissive for all to public
  using ((institute_id IN ( SELECT institute_members.institute_id
   FROM institute_members
  WHERE ((institute_members.user_id = auth.uid()) AND (institute_members.status = 'active'::text)))));
create policy "Public read attendance" on public.attendance_legacy as permissive for select to public
  using (true);
create policy "Students manage own attempts" on public.contest_attempts as permissive for all to public
  using ((student_id = auth.uid()));
create policy "Teachers view attempts on their contests" on public.contest_attempts as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM contests
  WHERE ((contests.id = contest_attempts.contest_id) AND (contests.teacher_id = auth.uid())))));
create policy "Read questions of active contests" on public.contest_questions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM contests
  WHERE ((contests.id = contest_questions.contest_id) AND ((contests.status)::text = 'active'::text)))));
create policy "Teachers manage own contest questions" on public.contest_questions as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM contests
  WHERE ((contests.id = contest_questions.contest_id) AND (contests.teacher_id = auth.uid())))));

grant all on public.contest_questions, public.contest_attempts, public.training_data,
              public.student_invitations, public.teacher_invitations, public.attendance_legacy
  to anon, authenticated;

commit;
