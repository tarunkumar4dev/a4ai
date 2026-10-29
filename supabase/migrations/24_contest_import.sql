-- 24_contest_import.sql — "PDF → contest questions" import jobs (24 Oct 2026).
-- Backend: POST /api/v1/contests/import-pdf {path} → 202 {job_id}; GET /api/v1/contests/import-pdf/{job_id}.
-- Safe to re-run. One transaction. Touches nothing else (check_jobs and its worker are unchanged).
--
--   contest_import_jobs   one row per uploaded paper. The backend writes it with the service key (insert at POST,
--                         progress / result from the background task in the same Vercel invocation); the owner can
--                         only read their own rows. A row stuck in 'processing' for > 6 min is reported as failed
--                         (retryable) by the GET endpoint — the invocation was killed, nothing will finish it.
--   Storage               the PDF goes to the existing private 'answer-keys' bucket (20 MB, application/pdf allowed,
--                         live policies "answer_keys own insert/read/delete" = first folder is auth.uid(), any
--                         subpath) at {uid}/contest-imports/{uuid}.pdf. The backend deletes it when the job ends.
-- After running:  notify pgrst, 'reload schema';

begin;

create table if not exists public.contest_import_jobs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  path        text not null,
  status      text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  progress    int  not null default 0 check (progress between 0 and 100),
  error       text,
  retryable   boolean not null default false,
  result      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- one job per uploaded file: a re-submitted path gets the existing job back (the API answers its job_id)
create unique index if not exists contest_import_jobs_owner_path on public.contest_import_jobs (owner, path);
-- the daily limit counts a user's jobs since IST midnight
create index if not exists contest_import_jobs_owner_created on public.contest_import_jobs (owner, created_at desc);

alter table public.contest_import_jobs enable row level security;

drop policy if exists "contest_import_jobs own read" on public.contest_import_jobs;
create policy "contest_import_jobs own read" on public.contest_import_jobs
  for select to authenticated using (owner = auth.uid());
-- no insert / update / delete policies: only the backend (service role) writes

revoke all on public.contest_import_jobs from anon;
grant select on public.contest_import_jobs to authenticated;

create or replace function public.a4_touch_contest_import_job()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists contest_import_jobs_touch on public.contest_import_jobs;
create trigger contest_import_jobs_touch before update on public.contest_import_jobs
  for each row execute function public.a4_touch_contest_import_job();

commit;

-- Checks (run by hand):
--   select relrowsecurity from pg_class where oid = 'public.contest_import_jobs'::regclass;           → true
--   select count(*) from pg_policies where tablename = 'contest_import_jobs';                         → 1
--   select indexname from pg_indexes where tablename = 'contest_import_jobs' order by 1;
--     → contest_import_jobs_owner_created, contest_import_jobs_owner_path, contest_import_jobs_pkey
