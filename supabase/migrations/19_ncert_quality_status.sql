-- 19_ncert_quality_status.sql — quality columns for public.ncert_questions (G4.3, 22 Oct 2026)
--
-- Replaces the never-applied 18_ncert_question_quality.sql (feat/ncert-quality branch): leave 18 unapplied.
-- Only ADDS columns, constraints, indexes and a fix log. No row is changed here; the statuses are written by
-- RAG-BACKEND test-generator-backend/scripts/ncert_quality_pass.py (dry run first, then --apply).
--
--   quality_status  NULL = not audited yet (visible) | clean | fixed (deterministic fix applied, originals in
--                   a4_backup_20261022) | needs_review (visible, flagged) | duplicate | junk (both hidden)
--   duplicate_of    the canonical row of a duplicate (set exactly when quality_status = 'duplicate')
--   quality_flags   {"flags": [...], "garble": [...], "fixes": [...], "near_duplicate_of": id, ...}
--   content_hash    SHA-256 of normalize(question_text) — app/services/ncert_text_hash.py
--   hash_version    'v2' today; a new normalize() bumps it
--   quality_rank    generated: 1 for needs_review, else 0 — the builder lists clean/fixed first
--   ncert_question_fixes  one row per changed field (question id, field, old, new, rule) — every
--                   deterministic fix is logged here; not exposed to the API
--
-- Backup first: 19_ncert_backup_20261022.sql. Undo: 19_ncert_quality_status_rollback.sql. Safe to re-run.

begin;

alter table public.ncert_questions
  add column if not exists quality_status text,
  add column if not exists duplicate_of bigint,
  add column if not exists quality_flags jsonb not null default '{}'::jsonb,
  add column if not exists content_hash text,
  add column if not exists hash_version text;

-- sort key for the builder: clean / fixed / not audited (NULL) = 0, needs_review = 1. PostgREST cannot order by an
-- expression; with every row 0 (all classes still NULL) the list order stays exactly as before.
-- Stored generated column = one table rewrite (~92k rows, a few seconds under an exclusive lock).
alter table public.ncert_questions
  add column if not exists quality_rank smallint
    generated always as (case when quality_status = 'needs_review' then 1 else 0 end) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ncert_questions_quality_status_check'
                 and conrelid = 'public.ncert_questions'::regclass) then
    alter table public.ncert_questions add constraint ncert_questions_quality_status_check
      check (quality_status in ('clean', 'fixed', 'needs_review', 'duplicate', 'junk'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ncert_questions_duplicate_of_fkey'
                 and conrelid = 'public.ncert_questions'::regclass) then
    alter table public.ncert_questions add constraint ncert_questions_duplicate_of_fkey
      foreign key (duplicate_of) references public.ncert_questions (id) on delete set null;
  end if;
  -- duplicate_of is set exactly for duplicates, and never points at itself. Null-safe on purpose: a plain
  -- "quality_status = 'duplicate'" is NULL for unaudited rows, and a NULL check passes.
  if not exists (select 1 from pg_constraint where conname = 'ncert_questions_duplicate_of_check'
                 and conrelid = 'public.ncert_questions'::regclass) then
    alter table public.ncert_questions add constraint ncert_questions_duplicate_of_check
      check (case when duplicate_of is null then quality_status is distinct from 'duplicate'
                  else quality_status is not distinct from 'duplicate' and duplicate_of <> id end);
  end if;
end $$;

-- the builder's list: class + subject + chapter, visible rows only
create index if not exists ncert_questions_visible_idx
  on public.ncert_questions (class_grade, subject, chapter)
  where quality_status is null or quality_status not in ('duplicate', 'junk');
create index if not exists ncert_questions_content_hash_idx
  on public.ncert_questions (class_grade, subject, chapter, content_hash);
-- on delete set null of the self-FK needs this
create index if not exists ncert_questions_duplicate_of_idx
  on public.ncert_questions (duplicate_of) where duplicate_of is not null;

create table if not exists public.ncert_question_fixes (
  id bigserial primary key,
  question_id bigint not null references public.ncert_questions (id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  rule text not null,
  created_at timestamptz not null default now()
);
create index if not exists ncert_question_fixes_question_idx on public.ncert_question_fixes (question_id);
-- audit log for the service role / SQL editor only: RLS on, no policies, no API grants
alter table public.ncert_question_fixes enable row level security;
revoke all on table public.ncert_question_fixes from anon, authenticated;
revoke all on sequence public.ncert_question_fixes_id_seq from anon, authenticated;

commit;

-- VERIFY (expect 6 columns, 3 constraints, 3 indexes, fixes table with RLS on)
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'ncert_questions'
--   and column_name in ('quality_status', 'duplicate_of', 'quality_flags', 'content_hash', 'hash_version', 'quality_rank');
-- select conname from pg_constraint where conrelid = 'public.ncert_questions'::regclass and conname like 'ncert_questions_%';
-- select indexname from pg_indexes where tablename = 'ncert_questions' and indexname like 'ncert_questions_%_idx';
-- select relrowsecurity from pg_class where oid = 'public.ncert_question_fixes'::regclass;
