-- 39_class_subject_batch_rollback.sql — undo 39. Drops batches.subject_id (and with it any backfilled subject links)
-- and institutes.hierarchy_mode. Roll back 40 first if it was applied (its trigger reads batches.subject_id).
-- batches.department_id / batches.subject keep whatever the sync trigger wrote.

begin;

drop trigger if exists a4_subject_sync_batches on public.subjects;
drop trigger if exists a4_batch_sync_subject on public.batches;
drop function if exists public.a4_subject_sync_batches();
drop function if exists public.a4_batch_sync_subject();

drop index if exists public.batches_subject_id_idx;
alter table public.batches drop column if exists subject_id;

alter table public.institutes drop constraint if exists institutes_hierarchy_mode_check;
alter table public.institutes drop column if exists hierarchy_mode;

commit;
-- notify pgrst, 'reload schema';
