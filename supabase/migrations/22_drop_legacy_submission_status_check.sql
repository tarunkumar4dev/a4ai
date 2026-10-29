-- 22_drop_legacy_submission_status_check.sql — let upload-link attempts be inserted (23 Oct 2026).
--
-- Bug: production still had the pre-18 check constraint submissions_status_check (old status values only) next to
-- 18's submissions_status_v2_check. Every create_submission insert with status 'uploaded' failed with 23514, so
-- students saw an error after their pages had uploaded. Dropped by hand on production (23 Oct); this file records
-- it so staging / a fresh database get the same schema.
--
-- Audit of the other tables 18-21 write to (live, read-only, 23 Oct): check_sheets, check_jobs, check_sessions,
-- assignments and smart_assignment_checks have no legacy check constraint that rejects a value 18-21 write
-- (assignments_status_check = active/archived/draft — 18-21 and the Checking Link only write 'active').
-- Safe to re-run. After running:  notify pgrst, 'reload schema';

alter table public.submissions drop constraint if exists submissions_status_check;

-- VERIFY (expect one row: submissions_status_v2_check; nothing named submissions_status_check)
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.submissions'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%';
