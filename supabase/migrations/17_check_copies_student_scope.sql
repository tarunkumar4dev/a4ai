-- 17_check_copies_student_scope.sql — "Check Copies": students only from the teacher's own classes (16 Oct 2026)
--
-- check_sheets.student_id and check_sessions.batch_id already exist (12_copy_checker.sql), but RLS only checked
-- teacher_id, so any student / batch id could be written. This adds:
--   1. a guard on check_sheets: a student_id that is set or changed must be a student the caller may see
--      (public.a4_can_view_student — the same rule as the students RLS: admin / HOD / proctor / teaching batch)
--   2. a guard on check_sessions: same for batch_id (public.a4_can_view_batch)
--   3. one row per student per check (partial unique index — manual rows without student_id are unaffected)
-- Guards are triggers, not RLS WITH CHECK, so a teacher who later loses a class can still approve / edit the
-- copies already in their checks (the check only runs when the id is set or changed).
-- Requires 01_access_helpers.sql + 12_copy_checker.sql. Safe to re-run. Rollback: 17_check_copies_student_scope_rollback.sql

begin;

create or replace function public.a4_check_sheet_student_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- service role / maintenance (no JWT) is not restricted; the app always writes with the teacher's JWT
  if auth.uid() is null or new.student_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.student_id is distinct from old.student_id)
     and not public.a4_can_view_student(new.student_id) then
    raise exception 'You can only add students from your own classes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists check_sheets_student_guard on public.check_sheets;
create trigger check_sheets_student_guard
  before insert or update of student_id on public.check_sheets
  for each row execute function public.a4_check_sheet_student_guard();

create or replace function public.a4_check_session_batch_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or new.batch_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.batch_id is distinct from old.batch_id)
     and not public.a4_can_view_batch(new.batch_id) then
    raise exception 'You can only check copies for your own classes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists check_sessions_batch_guard on public.check_sessions;
create trigger check_sessions_batch_guard
  before insert or update of batch_id on public.check_sessions
  for each row execute function public.a4_check_session_batch_guard();

-- Live data on 16 Oct 2026: 0 sheets with student_id, 0 duplicates → safe to create.
create unique index if not exists check_sheets_session_student_uniq
  on public.check_sheets (session_id, student_id) where student_id is not null;

commit;

-- Verify:
--   select tgname from pg_trigger where tgname in ('check_sheets_student_guard','check_sessions_batch_guard');  → 2 rows
--   select indexname from pg_indexes where indexname = 'check_sheets_session_student_uniq';                     → 1 row
--   As a teacher (app): adding a student of another section to a check fails with
--   "You can only add students from your own classes."
