-- 12_copy_checker.sql — "Check Copies": teacher photographs students' answer sheets (11 Oct 2026)
--
-- check_sessions  one exam being checked: source = a saved test (Test History) or an uploaded
--                 question paper (+ optional answer key); cached marking rubric; strictness.
-- check_sheets    one student's copy in a session: page photos, AI result, teacher-approved marks.
-- answer-sheets   PRIVATE bucket (minors' handwriting): <teacher uid>/<session>/... only the teacher.
-- Owner-only RLS (teacher_id = auth.uid()); the backend acts with the teacher's JWT and downloads
-- files with the service key only after loading the row through RLS.
-- Safe to re-run.

begin;

create table if not exists public.check_sessions (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  source        text not null check (source in ('test','upload')),
  test_id       uuid references public.tests(id) on delete set null,
  batch_id      uuid references public.batches(id) on delete set null,
  subject       text,
  class_grade   text,
  strictness    text not null default 'medium' check (strictness in ('easy','medium','hard','extreme')),
  qp_paths      text[] not null default '{}',     -- answer-sheets bucket paths (upload source)
  key_paths     text[] not null default '{}',     -- empty = no answer key (AI writes one, flagged)
  rubric        jsonb,
  rubric_status text not null default 'pending' check (rubric_status in ('pending','building','ready','failed')),
  rubric_error  text,
  total_marks   numeric(6,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists check_sessions_teacher_idx on public.check_sessions (teacher_id, created_at desc);

create table if not exists public.check_sheets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.check_sessions(id) on delete cascade,
  teacher_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id   uuid references public.students(id) on delete set null,
  student_name text not null check (length(student_name) between 1 and 120),
  roll_no      text,
  pages        text[] not null default '{}',      -- answer-sheets bucket paths, in page order
  status       text not null default 'pending'
               check (status in ('pending','uploaded','checking','checked','failed','approved')),
  ai_result    jsonb,
  ai_marks     numeric(6,2),
  max_marks    numeric(6,2),
  final_marks  numeric(6,2),
  feedback     text,
  error        text,
  checked_at   timestamptz,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists check_sheets_session_idx on public.check_sheets (session_id, created_at);
create unique index if not exists check_sheets_session_student_uq
  on public.check_sheets (session_id, student_id) where student_id is not null;

alter table public.check_sessions enable row level security;
alter table public.check_sheets  enable row level security;

drop policy if exists "own sessions" on public.check_sessions;
create policy "own sessions" on public.check_sessions
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "own sheets" on public.check_sheets;
create policy "own sheets" on public.check_sheets
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid()
              and session_id in (select id from public.check_sessions where teacher_id = auth.uid()));

revoke all on public.check_sessions, public.check_sheets from anon;
grant select, insert, update, delete on public.check_sessions, public.check_sheets to authenticated;

-- Private bucket for page photos / question papers / keys
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('answer-sheets', 'answer-sheets', false, 15728640,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "answer_sheets own insert" on storage.objects;
create policy "answer_sheets own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "answer_sheets own read" on storage.objects;
create policy "answer_sheets own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "answer_sheets own delete" on storage.objects;
create policy "answer_sheets own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

-- History rows can point at a copy-check sheet too (daily limit counts every AI check)
alter table public.smart_assignment_checks
  add column if not exists check_sheet_id uuid references public.check_sheets(id) on delete set null;

commit;

-- Verify:
--   select public from storage.buckets where id = 'answer-sheets';                       → false
--   select tablename, policyname from pg_policies where tablename like 'check_s%';        → 2 rows
