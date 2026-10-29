-- 27_public_write_lockdown.sql — close public write access to the question bank / RAG chunks
-- and the public read on the empty legacy attendance table.
--
-- Found 27 Oct 2026 with READ-ONLY queries on the live DB (pg_policy + has_table_privilege):
--   ncert_questions  "ncert_questions_insert_service"  INSERT, roles PUBLIC, WITH CHECK true
--                    + anon/authenticated hold INSERT  → anyone with the public anon key can add
--                      questions that then appear in every teacher's test papers.
--   ncert_chunks     "Allow authenticated insert/update/delete"  → any signed-up user can change or
--                      delete the NCERT knowledge base the generator retrieves from.
--   attendance_legacy "Public read attendance" USING true  (0 rows today; legacy table).
--
-- Who legitimately writes these tables: only the offline ingestion scripts
-- (RAG-BACKEND-local/test-generator-backend/02_extract_ncert_questions.py, ncert-ingestion/*.py),
-- which use SUPABASE_SERVICE_KEY — service_role bypasses RLS, so nothing here affects them.
-- The app (browser + FastAPI backend) only READS ncert_questions / ncert_chunks; reads stay open.
--
-- Safe to re-run. Rollback: 27_public_write_lockdown_rollback.sql.

begin;

-- 1. Question bank: no writes from anon / signed-in users.
drop policy if exists "ncert_questions_insert_service" on public.ncert_questions;
revoke insert, update, delete on public.ncert_questions from anon, authenticated;

-- 2. RAG chunks: same.
drop policy if exists "Allow authenticated insert" on public.ncert_chunks;
drop policy if exists "Allow authenticated update" on public.ncert_chunks;
drop policy if exists "Allow authenticated delete" on public.ncert_chunks;
revoke insert, update, delete on public.ncert_chunks from anon, authenticated;

-- 3. Legacy attendance: members keep their policy; the anonymous read goes.
drop policy if exists "Public read attendance" on public.attendance_legacy;
revoke select on public.attendance_legacy from anon;

commit;

-- VERIFY (expected: every *_write column false, reads true, no policy rows listed)
-- select
--   has_table_privilege('anon','public.ncert_questions','INSERT')           as q_anon_write,
--   has_table_privilege('authenticated','public.ncert_questions','INSERT')  as q_auth_write,
--   has_table_privilege('authenticated','public.ncert_chunks','DELETE')     as chunks_auth_write,
--   has_table_privilege('anon','public.ncert_questions','SELECT')           as q_anon_read,
--   has_table_privilege('anon','public.ncert_chunks','SELECT')              as chunks_anon_read,
--   has_table_privilege('anon','public.attendance_legacy','SELECT')         as legacy_anon_read;
-- select c.relname, p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
--  where (c.relname, p.polname) in (('ncert_questions','ncert_questions_insert_service'),
--        ('ncert_chunks','Allow authenticated insert'), ('ncert_chunks','Allow authenticated update'),
--        ('ncert_chunks','Allow authenticated delete'), ('attendance_legacy','Public read attendance'));
-- Then open /dashboard/test-generator and build a paper: questions must still load.
