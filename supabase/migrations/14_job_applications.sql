-- 14_job_applications.sql — /careers apply form: applicant details + resume (11 Oct 2026)
--
-- job_applications   one row per application. RLS on, NO policies → nobody reads/writes it through the
--                    API; the team reads it in the Supabase dashboard (Table Editor) or with service_role.
-- resumes            PRIVATE bucket, PDF ≤ 5 MB. Anyone may upload ONE new file to <uuid>/resume.pdf
--                    (no read, no overwrite, no delete) — download from the dashboard (Storage).
-- submit_job_application(...)  the only write path: validates fields, requires the uploaded resume to
--                    exist and be unused, max 1 application per email per job per 24 h.
-- Jobs are hard-coded in src/pages/company/CareersPage.tsx; keep the job_id list below in sync.
-- Safe to re-run.

begin;

-- ── 1. Table ─────────────────────────────────────────────────────────────────
create table if not exists public.job_applications (
  id               uuid primary key default gen_random_uuid(),
  job_id           text not null,
  full_name        text not null,
  email            text not null,
  phone            text not null,
  city             text,
  engagement       text not null,           -- internship | full-time
  work_mode        text not null,           -- remote | delhi-ncr | either
  experience       text not null,           -- student | fresher | 1-2 | 3+
  college_or_company text,
  linkedin_url     text,
  github_url       text,
  portfolio_url    text,
  skills           text,
  why_a4ai         text,
  available_from   date,
  resume_path      text not null unique,    -- object name in the 'resumes' bucket
  resume_name      text,
  status           text not null default 'new'
                   check (status in ('new','shortlisted','interview','rejected','hired')),
  notes            text,                    -- internal, set from the dashboard
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index if not exists job_applications_job_created_idx on public.job_applications (job_id, created_at desc);
create index if not exists job_applications_email_idx on public.job_applications (lower(email), job_id, created_at desc);

alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon, authenticated;

-- ── 2. Resume bucket ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Insert only, fixed path shape. No select/update/delete policy → no listing, no overwrite (upsert needs both).
drop policy if exists a4_resumes_insert on storage.objects;
create policy a4_resumes_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'resumes'
          and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/resume\.pdf$');

-- ── 3. Submit RPC ────────────────────────────────────────────────────────────
create or replace function public.submit_job_application(
  p_job_id             text,
  p_full_name          text,
  p_email              text,
  p_phone              text,
  p_engagement         text,
  p_work_mode          text,
  p_experience         text,
  p_resume_path        text,
  p_resume_name        text default null,
  p_city               text default null,
  p_college_or_company text default null,
  p_linkedin_url       text default null,
  p_github_url         text default null,
  p_portfolio_url      text default null,
  p_skills             text default null,
  p_why_a4ai           text default null,
  p_available_from     date default null,
  p_user_agent         text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_full_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_id    uuid;
  v_url   text;
begin
  if p_job_id not in ('android-developer', 'backend-engineer') then
    raise exception 'Unknown job.' using errcode = '22023';
  end if;
  if length(v_name) not between 2 and 120 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Please enter a valid email.' using errcode = '22023';
  end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 13 then
    raise exception 'Please enter a valid phone number.' using errcode = '22023';
  end if;
  if p_engagement not in ('internship', 'full-time') then
    raise exception 'Choose internship or full-time.' using errcode = '22023';
  end if;
  if p_work_mode not in ('remote', 'delhi-ncr', 'either') then
    raise exception 'Choose a work mode.' using errcode = '22023';
  end if;
  if p_experience not in ('student', 'fresher', '1-2', '3+') then
    raise exception 'Choose your experience.' using errcode = '22023';
  end if;
  foreach v_url in array array[p_linkedin_url, p_github_url, p_portfolio_url] loop
    if nullif(trim(coalesce(v_url, '')), '') is not null
       and (trim(v_url) !~* '^https?://' or length(v_url) > 300) then
      raise exception 'Links must start with http:// or https://' using errcode = '22023';
    end if;
  end loop;
  if length(coalesce(p_skills, '')) > 2000 or length(coalesce(p_why_a4ai, '')) > 3000
     or length(coalesce(p_city, '')) > 100 or length(coalesce(p_college_or_company, '')) > 200 then
    raise exception 'Some answers are too long.' using errcode = '22023';
  end if;

  -- resume must be uploaded first and not belong to another application
  if not exists (select 1 from storage.objects where bucket_id = 'resumes' and name = p_resume_path) then
    raise exception 'Resume upload not found. Please upload your resume again.' using errcode = '22023';
  end if;
  if exists (select 1 from job_applications where resume_path = p_resume_path) then
    raise exception 'This resume was already submitted.' using errcode = '22023';
  end if;

  if exists (select 1 from job_applications
              where lower(email) = v_email and job_id = p_job_id
                and created_at > now() - interval '24 hours') then
    raise exception 'You have already applied for this role. We''ll get back to you soon.' using errcode = '22023';
  end if;

  insert into job_applications (
    job_id, full_name, email, phone, city, engagement, work_mode, experience, college_or_company,
    linkedin_url, github_url, portfolio_url, skills, why_a4ai, available_from,
    resume_path, resume_name, user_agent)
  values (
    p_job_id, v_name, v_email, v_phone, nullif(trim(p_city), ''), p_engagement, p_work_mode, p_experience,
    nullif(trim(p_college_or_company), ''),
    nullif(trim(p_linkedin_url), ''), nullif(trim(p_github_url), ''), nullif(trim(p_portfolio_url), ''),
    nullif(trim(p_skills), ''), nullif(trim(p_why_a4ai), ''), p_available_from,
    p_resume_path, left(p_resume_name, 200), left(p_user_agent, 300))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.submit_job_application(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,date,text) from public;
grant  execute on function public.submit_job_application(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,date,text) to anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (read-only; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'table rls on', (select relrowsecurity from pg_class where oid = 'public.job_applications'::regclass)
-- union all select 'no table policies', not exists (select 1 from pg_policies where tablename = 'job_applications')
-- union all select 'anon cannot select table', not has_table_privilege('anon', 'public.job_applications', 'select')
-- union all select 'resumes private', not (select public from storage.buckets where id = 'resumes')
-- union all select 'anon can submit', has_function_privilege('anon', 'public.submit_job_application(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,date,text)', 'execute');
--
-- See applications (SQL editor / Table Editor):
--   select created_at, job_id, full_name, email, phone, engagement, work_mode, experience, resume_path, status
--     from public.job_applications order by created_at desc;
-- Resume: Storage → resumes → <resume_path>  (or create a signed URL there).
