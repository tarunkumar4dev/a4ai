-- 18_ncert_question_quality.sql — hide broken / duplicate NCERT questions from the Test Builder (18 Oct 2026)
--
-- Live check (read-only, 18 Oct): ncert_questions has 91,906 rows but only ~31k distinct questions
-- (Class 11 Chemistry: 4,187 rows → 657 questions, most stored 7–8 times in slightly different
-- versions). ~280 rows lost their content in extraction ("… as a result of the following reaction?"
-- with nothing after it, "IUPAC names of the following compounds: (a) (b) (c)"), 19 are font garbage
-- ("AlCl Cl AlCl34/unif02b/unif0ae…").
--
-- This migration only ADDS a column. Nothing is deleted or rewritten. The flags are written by
-- RAG-BACKEND test-generator-backend/scripts/ncert_quality_pass.py (dry run first, --apply, --rollback):
--   'duplicate'  — another copy of the same question is kept visible
--   'incomplete' — items/reaction/structures missing and no image of the question block
--   'garbled'    — PDF font glyph names instead of characters
-- The backend /ncert-questions + /ncert-question-stats only return quality_flag IS NULL.
-- Undo everything: update public.ncert_questions set quality_flag = null where quality_flag is not null;
-- Safe to re-run.

begin;

alter table public.ncert_questions
  add column if not exists quality_flag text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ncert_questions_quality_flag_check') then
    alter table public.ncert_questions
      add constraint ncert_questions_quality_flag_check
      check (quality_flag in ('duplicate', 'incomplete', 'garbled'));
  end if;
end $$;

-- The builder always filters by class + subject (+ chapter) and only wants visible rows.
create index if not exists ncert_questions_visible_idx
  on public.ncert_questions (class_grade, subject, chapter)
  where quality_flag is null;

commit;

-- VERIFY (expect 1 row: quality_flag | text, and the index)
-- select column_name, data_type from information_schema.columns
--  where table_name = 'ncert_questions' and column_name = 'quality_flag';
-- select indexname from pg_indexes where indexname = 'ncert_questions_visible_idx';
