-- 11_assignment_ai_check.sql — AI checking of portal submissions (10 Oct 2026)
--
-- Flow: teacher attaches a PRIVATE answer key to an assignment → "AI check" grades each submitted
-- sheet against the assignment's question paper + key → teacher reviews and approves → grade +
-- feedback reach the student portal (get_student_feed already returns them once status = 'graded').
--
-- 1. assignment_ai_keys   answer key path + cached rubric, readable ONLY by staff who can grade
--                         (never in `assignments`, which some students can read).
-- 2. submissions          grade int → numeric (half marks), ai_* columns for the unapproved AI result.
-- 3. storage answer-keys  private bucket; teachers upload into their own <uid>/ folder.
-- 4. smart_assignment_checks.assignment_id / submission_id (history + daily limit cover portal checks).
-- Requires 10_smart_assignment_checks.sql. Safe to re-run.

begin;

-- ── 1. Answer keys + rubric cache ───────────────────────────────────────────
create table if not exists public.assignment_ai_keys (
  assignment_id   uuid primary key references public.assignments(id) on delete cascade,
  answer_key_path text not null,                -- path inside the private 'answer-keys' bucket
  answer_key_name text,
  strictness      text not null default 'medium' check (strictness in ('easy','medium','hard','extreme')),
  rubric          jsonb,                        -- built by the backend from question paper + key
  rubric_source   text,                         -- '<question paper url>|<key path>' the rubric was built from
  rubric_built_at timestamptz,
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now()
);

alter table public.assignment_ai_keys enable row level security;

-- Same audience as submissions.sub_grade: institute admins + staff who see the assignment's batch
drop policy if exists "ai_keys staff all" on public.assignment_ai_keys;
create policy "ai_keys staff all" on public.assignment_ai_keys
  for all to authenticated
  using (assignment_id in (
    select a.id from public.assignments a
    where a.institute_id in (select public.a4_my_admin_inst_ids())
       or a.batch_id in (select public.a4_my_visible_batch_ids())))
  with check (assignment_id in (
    select a.id from public.assignments a
    where a.institute_id in (select public.a4_my_admin_inst_ids())
       or a.batch_id in (select public.a4_my_visible_batch_ids())));

revoke all on public.assignment_ai_keys from anon;
grant select, insert, update, delete on public.assignment_ai_keys to authenticated;

-- ── 2. Submissions: half marks + AI result (not visible to the student portal) ─
alter table public.submissions alter column grade type numeric(6,2) using grade::numeric;
alter table public.submissions
  add column if not exists ai_status     text check (ai_status in ('checking','done','failed')),
  add column if not exists ai_marks      numeric(6,2),
  add column if not exists ai_max_marks  numeric(6,2),
  add column if not exists ai_result     jsonb,
  add column if not exists ai_error      text,
  add column if not exists ai_checked_at timestamptz;

-- ── 3. Private bucket for answer keys ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('answer-keys', 'answer-keys', false, 20971520,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "answer_keys own insert" on storage.objects;
create policy "answer_keys own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-keys' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "answer_keys own read" on storage.objects;
create policy "answer_keys own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-keys' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "answer_keys own delete" on storage.objects;
create policy "answer_keys own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-keys' and (storage.foldername(name))[1] = auth.uid()::text);
-- (The backend downloads keys with the service key after checking the caller may grade.)

-- ── 4. History links ───────────────────────────────────────────────────────
alter table public.smart_assignment_checks
  add column if not exists assignment_id uuid references public.assignments(id) on delete set null,
  add column if not exists submission_id uuid references public.submissions(id) on delete set null;

commit;

-- Verify:
--   select data_type from information_schema.columns where table_name='submissions' and column_name='grade';  → numeric
--   select public from storage.buckets where id='answer-keys';                                                 → false
--   select count(*) from pg_policies where tablename='assignment_ai_keys';                                     → 1
--   As a student-portal user nothing changes: get_student_feed returns only grade/feedback after approval.
