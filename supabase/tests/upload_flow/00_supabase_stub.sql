-- Test harness only (NOT a migration): the parts of a Supabase project that our migrations rely on,
-- on a plain Postgres 16. Mimics Supabase where it matters for security tests:
--   * roles anon / authenticated / service_role (service_role bypasses RLS)
--   * default privileges: every new table / function in public is granted to anon + authenticated
--     (so a missing REVOKE in a migration shows up here exactly like on live)
--   * auth.uid() from request.jwt.claims, request.headers like PostgREST sets them
--   * storage.buckets / storage.objects (RLS on) + storage.foldername()
-- Not stubbed on purpose: pg_net, pg_cron, vault (18 must work without them).

set check_function_bodies = off;   -- is_institute_member below refers to a baseline table created later

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Referenced by the baseline / earlier migrations but not part of this flow
create table if not exists public.profiles (id uuid primary key);
create table if not exists public.tests (id uuid primary key default gen_random_uuid(), teacher_id uuid);
create or replace function public.is_institute_member(p_institute_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from institute_members m where m.institute_id = p_institute_id
                  and m.user_id = auth.uid() and m.status = 'active')
$$;
