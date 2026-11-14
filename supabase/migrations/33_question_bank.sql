-- 33_question_bank.sql — "Question Bank → Paper Builder" (14 Nov 2026).
-- Backend: /api/v1/question-banks (app/routers/question_bank_router.py). Safe to re-run. One transaction.
-- Touches nothing that exists: two new tables, one helper function, their policies.
--
--   question_banks   one row per saved bank (questions a teacher reviewed in "Contest from PDF").
--   bank_questions   the questions. answer is NULL unless it came from the PDF's answer key ('key') or the teacher
--                    set / confirmed it ('teacher') — an AI guess is never stored as an answer.
--
-- The backend reads and writes both tables WITH THE TEACHER'S OWN JWT (not the service key), so these policies are
-- what protects the data. Owner: full CRUD on own banks and their questions. Active members (and the owner) of the
-- bank's institute: read only, and only when institute_id is set (nothing sets it in the MVP).
-- After running:  notify pgrst, 'reload schema';

begin;

create table if not exists public.question_banks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  institute_id    uuid references public.institutes(id) on delete set null,
  name            text not null check (char_length(name) between 1 and 120),
  source_filename text,
  page_count      int,
  status          text not null default 'ready' check (status in ('processing', 'ready', 'partial', 'failed')),
  warnings        jsonb not null default '[]'::jsonb,
  -- header of the papers built from this bank (as read from the PDF, editable by the teacher)
  subject         text,
  class_grade     text,
  board           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.bank_questions (
  id            uuid primary key default gen_random_uuid(),
  bank_id       uuid not null references public.question_banks(id) on delete cascade,
  position      int  not null,
  qtype         text not null check (qtype in ('mcq', 'true_false', 'short', 'long')),
  question_text text not null check (char_length(question_text) between 1 and 6000),
  options       jsonb not null default '[]'::jsonb,          -- [{"label": "A", "text": "…"}]
  answer        text,
  answer_source text check (answer_source in ('key', 'teacher')),
  marks         numeric check (marks is null or (marks > 0 and marks <= 100)),
  exam_year     int check (exam_year is null or exam_year between 1950 and 2100),
  source_tag    text,
  needs_review  boolean not null default false,
  excluded      boolean not null default false,              -- teacher's "leave this out of papers" checkbox
  content_hash  text not null,
  created_at    timestamptz not null default now(),
  constraint bank_questions_answer_has_source check ((answer is null) = (answer_source is null)),
  constraint bank_questions_bank_hash unique (bank_id, content_hash)
);

create index if not exists question_banks_owner_created on public.question_banks (owner_id, created_at desc);
create index if not exists question_banks_institute on public.question_banks (institute_id) where institute_id is not null;
create index if not exists bank_questions_bank on public.bank_questions (bank_id);
create index if not exists bank_questions_bank_qtype on public.bank_questions (bank_id, qtype);

-- Institutes the caller belongs to (active member of any role, or the institute's owner).
-- SECURITY DEFINER so the policies below do not depend on (or recurse into) institute_members' own RLS.
create or replace function public.a4_qb_my_institute_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.institute_id from institute_members m where m.user_id = auth.uid() and m.status = 'active'
  union
  select i.id from institutes i where i.owner_id = auth.uid();
$$;
revoke all on function public.a4_qb_my_institute_ids() from public, anon;
grant execute on function public.a4_qb_my_institute_ids() to authenticated, service_role;

alter table public.question_banks enable row level security;
alter table public.bank_questions enable row level security;

-- ── question_banks ──────────────────────────────────────────────────────────
drop policy if exists "question_banks read" on public.question_banks;
create policy "question_banks read" on public.question_banks
  for select to authenticated
  using (owner_id = auth.uid()
         or (institute_id is not null and institute_id in (select public.a4_qb_my_institute_ids())));

-- a bank can only be created as yourself, and only attached to an institute you belong to
drop policy if exists "question_banks own insert" on public.question_banks;
create policy "question_banks own insert" on public.question_banks
  for insert to authenticated
  with check (owner_id = auth.uid()
              and (institute_id is null or institute_id in (select public.a4_qb_my_institute_ids())));

drop policy if exists "question_banks own update" on public.question_banks;
create policy "question_banks own update" on public.question_banks
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
              and (institute_id is null or institute_id in (select public.a4_qb_my_institute_ids())));

drop policy if exists "question_banks own delete" on public.question_banks;
create policy "question_banks own delete" on public.question_banks
  for delete to authenticated using (owner_id = auth.uid());

-- ── bank_questions (access follows the bank) ────────────────────────────────
-- read: any bank the caller may read (the subquery runs under question_banks' own select policy)
drop policy if exists "bank_questions read" on public.bank_questions;
create policy "bank_questions read" on public.bank_questions
  for select to authenticated
  using (exists (select 1 from public.question_banks b where b.id = bank_questions.bank_id));

drop policy if exists "bank_questions own insert" on public.bank_questions;
create policy "bank_questions own insert" on public.bank_questions
  for insert to authenticated
  with check (exists (select 1 from public.question_banks b
                      where b.id = bank_questions.bank_id and b.owner_id = auth.uid()));

drop policy if exists "bank_questions own update" on public.bank_questions;
create policy "bank_questions own update" on public.bank_questions
  for update to authenticated
  using (exists (select 1 from public.question_banks b
                 where b.id = bank_questions.bank_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.question_banks b
                      where b.id = bank_questions.bank_id and b.owner_id = auth.uid()));

drop policy if exists "bank_questions own delete" on public.bank_questions;
create policy "bank_questions own delete" on public.bank_questions
  for delete to authenticated
  using (exists (select 1 from public.question_banks b
                 where b.id = bank_questions.bank_id and b.owner_id = auth.uid()));

revoke all on public.question_banks, public.bank_questions from anon;
grant select, insert, update, delete on public.question_banks, public.bank_questions to authenticated;
grant all on public.question_banks, public.bank_questions to service_role;

commit;

-- Checks (run by hand):
--   select relname, relrowsecurity from pg_class where relname in ('question_banks', 'bank_questions');   → true, true
--   select tablename, cmd, count(*) from pg_policies where tablename in ('question_banks', 'bank_questions')
--     group by 1, 2 order by 1, 2;                              → 4 rows per table: DELETE, INSERT, SELECT, UPDATE = 1 each
--   select indexname from pg_indexes where tablename in ('question_banks', 'bank_questions') order by 1;
--     → bank_questions_bank, bank_questions_bank_hash, bank_questions_bank_qtype, bank_questions_pkey,
--       question_banks_institute, question_banks_owner_created, question_banks_pkey
-- Local test (throw-away Postgres, never the live DB):  python supabase/tests/33_question_bank_test.py
