-- 39_class_subject_batch.sql — Class (departments) → Subject → Batch model, part 1 (additive, safe to run alone).
--
--   * institutes.hierarchy_mode  'simple' | 'full'  (default 'simple' = what every institute already behaves like:
--     get_my_teaching_targets reads this column through to_jsonb() and treats a missing column as 'simple')
--   * batches.subject_id → subjects(id)   nullable (legacy rows stay valid; the new UI requires it)
--   * trigger a4_batch_sync_subject: when a batch has a subject, batches.department_id := subject.department_id and
--     batches.subject (legacy text) := subject.name; the subject must belong to the batch's institute
--   * trigger a4_subject_sync_batches: a subject renamed / moved to another class re-syncs its batches
--
-- No data is changed by this file. Backfill = scripts/class_subject_batch_backfill.py (dry run first).
-- Rollback: 39_class_subject_batch_rollback.sql. Apply 40 only AFTER the backfill (see docs/design/class_subject_batch.md §7).

begin;

-- 1. hierarchy flag ---------------------------------------------------------------------------------------------
alter table public.institutes add column if not exists hierarchy_mode text not null default 'simple';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'institutes_hierarchy_mode_check'
                   and conrelid = 'public.institutes'::regclass) then
    alter table public.institutes
      add constraint institutes_hierarchy_mode_check check (hierarchy_mode in ('simple', 'full'));
  end if;
end $$;

comment on column public.institutes.hierarchy_mode is
  'simple = Class → Subject → Batch (sections hidden, a batch has one subject); full = college flow with sections.';

-- 2. batches.subject_id -----------------------------------------------------------------------------------------
-- NO ACTION (not RESTRICT): deleting a whole institute cascades batches and subjects in one statement and must not trip.
alter table public.batches add column if not exists subject_id uuid references public.subjects(id);

create index if not exists batches_subject_id_idx on public.batches (subject_id) where subject_id is not null;

-- 3. a batch with a subject takes its class and its legacy text from that subject -------------------------------
create or replace function public.a4_batch_sync_subject() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.subject_id is null then return new; end if;
  select sb.institute_id, sb.department_id, sb.name into s from subjects sb where sb.id = new.subject_id;
  if not found then
    raise exception 'Subject not found' using errcode = '23503';
  end if;
  if s.institute_id <> new.institute_id then
    raise exception 'Subject belongs to a different institute' using errcode = '23514';
  end if;
  if s.department_id is not null then
    new.department_id := s.department_id;     -- batches.department_id always equals subject.department_id
  end if;
  new.subject := s.name;                      -- keeps every reader of the old free-text column correct
  return new;
end $$;

drop trigger if exists a4_batch_sync_subject on public.batches;
create trigger a4_batch_sync_subject
  before insert or update of subject_id, institute_id, department_id on public.batches
  for each row execute function public.a4_batch_sync_subject();

-- 4. a subject renamed / moved to another class re-syncs its batches ---------------------------------------------
create or replace function public.a4_subject_sync_batches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update batches b
     set subject = new.name,
         department_id = coalesce(new.department_id, b.department_id)
   where b.subject_id = new.id
     and (b.subject is distinct from new.name
          or (new.department_id is not null and b.department_id is distinct from new.department_id));
  return new;
end $$;

drop trigger if exists a4_subject_sync_batches on public.subjects;
create trigger a4_subject_sync_batches
  after update of name, department_id on public.subjects
  for each row execute function public.a4_subject_sync_batches();

-- internal trigger functions: not callable through the API
revoke all on function public.a4_batch_sync_subject() from public, anon, authenticated;
revoke all on function public.a4_subject_sync_batches() from public, anon, authenticated;

commit;

-- VERIFY (run after applying; expect: 1 column, 0 batches with a subject, hierarchy_mode simple for every institute)
-- select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='batches' and column_name='subject_id';
-- select hierarchy_mode, count(*) from public.institutes group by 1;
-- select count(*) from public.batches where subject_id is not null;      -- 0 until the backfill
-- notify pgrst, 'reload schema';
