-- 19_ncert_backup_20261022.sql — full copy of public.ncert_questions before the NCERT quality pass (G4.2)
--
-- Not in public on purpose: new public tables get anon/authenticated grants (exposed through REST),
-- a separate schema with no grants is invisible to the API (same pattern as a4_backup_20260930).
-- Read-only for the live table: only creates the backup and checks it.
--
-- RESTORE (one line; puts every original column value back on rows changed since the backup, then run
-- 19_ncert_quality_status_rollback.sql to drop the quality columns):
--   update public.ncert_questions q set question_text = b.question_text, answer = b.answer, options = b.options, figure_ref = b.figure_ref, image_url = b.image_url, question_type = b.question_type, section = b.section, question_number = b.question_number, question_table = b.question_table, marks = b.marks, difficulty = b.difficulty from a4_backup_20261022.ncert_questions_backup_20261022 b where b.id = q.id;
--
-- DROP the backup (after G5 is verified): drop schema a4_backup_20261022 cascade;

begin;

create schema if not exists a4_backup_20261022;
revoke all on schema a4_backup_20261022 from public, anon, authenticated;

create table a4_backup_20261022.ncert_questions_backup_20261022 as
  select q.*, now() as backed_up_at
  from public.ncert_questions q;

alter table a4_backup_20261022.ncert_questions_backup_20261022 add primary key (id);
revoke all on table a4_backup_20261022.ncert_questions_backup_20261022 from public, anon, authenticated;

do $$
declare
  live_rows bigint;
  backup_rows bigint;
begin
  select count(*) into live_rows from public.ncert_questions;
  select count(*) into backup_rows from a4_backup_20261022.ncert_questions_backup_20261022;
  if live_rows <> backup_rows then
    raise exception 'backup has % rows, live table has %', backup_rows, live_rows;
  end if;
end $$;

commit;

-- VERIFY (expect equal counts and equal checksums; anon/authenticated must have no privilege)
-- select (select count(*) from public.ncert_questions) live, (select count(*) from a4_backup_20261022.ncert_questions_backup_20261022) backup;
-- select md5(string_agg(row(id, class_grade, subject, chapter, section, question_number, question_text, question_type, answer, options, marks, difficulty, source_chunk_id, created_at, question_table, figure_ref, image_url)::text, '|' order by id)) from public.ncert_questions;
-- select md5(string_agg(row(id, class_grade, subject, chapter, section, question_number, question_text, question_type, answer, options, marks, difficulty, source_chunk_id, created_at, question_table, figure_ref, image_url)::text, '|' order by id)) from a4_backup_20261022.ncert_questions_backup_20261022;
-- select has_schema_privilege('anon', 'a4_backup_20261022', 'USAGE'), has_schema_privilege('authenticated', 'a4_backup_20261022', 'USAGE');
