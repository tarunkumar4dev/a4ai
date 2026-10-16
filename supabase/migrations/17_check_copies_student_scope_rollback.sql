-- 17_check_copies_student_scope_rollback.sql — undoes 17_check_copies_student_scope.sql.
-- Data is untouched (student_id / batch_id values stay); only the guards and the unique index go.
-- After this, the app still works: the picker only lists the teacher's students (students RLS), but the
-- database no longer refuses other ids, and duplicates of a student in one check become possible again.

begin;

drop trigger if exists check_sheets_student_guard on public.check_sheets;
drop trigger if exists check_sessions_batch_guard on public.check_sessions;
drop function if exists public.a4_check_sheet_student_guard();
drop function if exists public.a4_check_session_batch_guard();
drop index if exists public.check_sheets_session_student_uniq;

commit;

-- Verify:
--   select tgname from pg_trigger where tgname like 'check_s%_guard';               → 0 rows
--   select indexname from pg_indexes where indexname = 'check_sheets_session_student_uniq';  → 0 rows
