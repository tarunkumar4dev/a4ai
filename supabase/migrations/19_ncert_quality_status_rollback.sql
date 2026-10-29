-- 19_ncert_quality_status_rollback.sql — undo 19_ncert_quality_status.sql (drops the quality columns and the
-- fix log; question text is NOT restored here — run the RESTORE line in 19_ncert_backup_20261022.sql first
-- if the quality pass already changed rows). Safe to re-run.

begin;

drop table if exists public.ncert_question_fixes;

drop index if exists public.ncert_questions_visible_idx;
drop index if exists public.ncert_questions_content_hash_idx;
drop index if exists public.ncert_questions_duplicate_of_idx;

alter table public.ncert_questions
  drop constraint if exists ncert_questions_duplicate_of_check,
  drop constraint if exists ncert_questions_duplicate_of_fkey,
  drop constraint if exists ncert_questions_quality_status_check;

alter table public.ncert_questions
  drop column if exists quality_rank,  -- generated from quality_status: drop it first
  drop column if exists hash_version,
  drop column if exists content_hash,
  drop column if exists quality_flags,
  drop column if exists duplicate_of,
  drop column if exists quality_status;

commit;

-- VERIFY (expect 0 rows)
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'ncert_questions'
--   and column_name in ('quality_status', 'duplicate_of', 'quality_flags', 'content_hash', 'hash_version', 'quality_rank');
