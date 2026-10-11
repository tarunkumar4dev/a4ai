-- 12_role_hardening.sql — self-assigned roles, notes ownership, private submissions (11 Oct 2026)
--
-- Written from a READ-ONLY check of the live DB (11 Oct):
--   * no RLS policy reads auth user_metadata; handle_new_user copies metadata->>'role' into profiles.role
--   * every user can UPDATE their own profiles row incl. `role` (several "update own profile" policies +
--     table-level UPDATE grant → a column-level revoke would not help)
--   * the only policies that trust profiles.role are notes_insert/delete_teachers_admin, and the delete
--     policy has NO owner check → any "teacher" (or a student who sets role = 'teacher') deletes every note
--   * storage bucket `submissions` is public → anyone with the URL reads student PDFs
--
-- 1. handle_new_user   role from signup metadata only if student / teacher / institute (else teacher)
-- 2. profiles.role     trigger: app users (anon / authenticated JWT) may set it once (NULL → student /
--                      teacher / institute) and never change it; service_role, SQL editor, auth triggers can.
-- 3. notes             insert = own row (uploader_id = auth.uid()) + teacher/admin; delete = own row only.
--                      No UPDATE policy (none existed; the app never updates notes) → updates stay denied.
-- 4. submissions       bucket private. Staff who can see the assignment's batch can read (signed URLs);
--                      backend AI check downloads with the service key (unchanged). file_url keeps the
--                      .../object/public/submissions/<path> format: submit_assignment + backend parse it.
-- Run after 10 and 11. Safe to re-run.

begin;

-- ── 1. Signup role: never trust anything but the three self-service roles ────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'role' IN ('student', 'teacher', 'institute')
         THEN NEW.raw_user_meta_data->>'role' ELSE 'teacher' END,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- If a pre-existing student record matches this email, claim it now.
  UPDATE public.students s
  SET user_id = NEW.id
  WHERE s.user_id IS NULL
    AND LOWER(s.email) = LOWER(NEW.email)
    AND (SELECT COUNT(*) FROM public.students s2
         WHERE LOWER(s2.email) = LOWER(NEW.email)) = 1;

  RETURN NEW;
END;
$function$;

-- ── 2. profiles.role guard ───────────────────────────────────────────────────
-- Enforced only for requests that carry an app JWT (anon / authenticated). service_role (backend),
-- the SQL editor and auth.users triggers have no such role and pass through.
create or replace function public.a4_guard_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role is not null and new.role not in ('student', 'teacher', 'institute') then
      raise exception 'profiles.role % cannot be self-assigned', new.role using errcode = '42501';
    end if;
    return new;
  end if;
  if new.role is distinct from old.role then
    -- one-time choice for a profile that has no role yet (DashboardPage fills a missing role)
    if old.role is null and new.role in ('student', 'teacher', 'institute') then
      return new;
    end if;
    raise exception 'profiles.role cannot be changed from the app' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a4_guard_profile_role on public.profiles;
create trigger a4_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.a4_guard_profile_role();

-- ── 3. notes: owner-only writes ──────────────────────────────────────────────
drop policy if exists notes_insert_teachers_admin on public.notes;
drop policy if exists notes_delete_teachers_admin on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

create policy notes_insert_own on public.notes for insert to authenticated
  with check (uploader_id = auth.uid()
          and exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.role in ('teacher', 'admin')));
create policy notes_delete_own on public.notes for delete to authenticated
  using (uploader_id = auth.uid());

-- ── 4. submissions bucket: private + scoped staff read ──────────────────────
-- Path: <institute>/<assignment>/<student>_<ts>.pdf (a4_valid_submission_path, 07).
create or replace function public.a4_can_read_submission_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
  v_inst uuid; v_asg uuid;
begin
  if coalesce(array_length(v_parts, 1), 0) <> 3 then return false; end if;
  begin
    v_inst := v_parts[1]::uuid;
    v_asg  := v_parts[2]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from assignments a
     where a.id = v_asg and a.institute_id = v_inst
       and (a.institute_id in (select public.a4_my_admin_inst_ids())
            or a.batch_id in (select public.a4_my_visible_batch_ids())));
end $$;
revoke execute on function public.a4_can_read_submission_object(text) from public, anon;
grant  execute on function public.a4_can_read_submission_object(text) to authenticated, service_role;

update storage.buckets set public = false where id = 'submissions';

drop policy if exists a4_submissions_staff_read on storage.objects;
create policy a4_submissions_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and public.a4_can_read_submission_object(name));

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY 1 (read-only; all rows should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'no policy trusts user_metadata', not exists (select 1 from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ilike any (array['%user_metadata%','%raw_user_meta%']))
-- union all select 'role guard trigger', exists (select 1 from pg_trigger where tgname = 'a4_guard_profile_role' and tgrelid = 'public.profiles'::regclass)
-- union all select 'old notes policies gone', not exists (select 1 from pg_policies where tablename = 'notes' and policyname like 'notes_%_teachers_admin')
-- union all select 'no notes UPDATE policy', not exists (select 1 from pg_policies where tablename = 'notes' and cmd in ('UPDATE','ALL'))
-- union all select 'submissions private', not (select public from storage.buckets where id = 'submissions')
-- union all select 'submissions staff read', exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'a4_submissions_staff_read')
-- union all select 'no admin profiles', not exists (select 1 from public.profiles where role not in ('student','teacher','institute'));
--
-- ════════════════════════════════════════════════════════════════════
-- VERIFY 2 (behaviour, as real users). Net change = zero: it inserts one test note as teacher A and
-- deletes it again; the role update is rolled back by its exception. Raises 'FAIL …' on any problem,
-- otherwise prints NOTICE 'PASS …'.
-- ════════════════════════════════════════════════════════════════════
-- do $$
-- declare a uuid; b uuid; nid uuid; n int;
-- begin
--   select id into a from public.profiles where role = 'teacher' order by created_at limit 1;
--   select id into b from public.profiles where role = 'teacher' and id <> a order by created_at limit 1;
--   if a is null or b is null then raise exception 'need two teacher profiles'; end if;
--
--   -- teacher A creates a note
--   perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
--   execute 'set local role authenticated';
--   insert into public.notes (class, subject, file_name, file_path, file_url)
--   values ('verify12', 'verify12', 'verify12.pdf', 'verify12', 'verify12') returning id into nid;
--
--   -- teacher B tries to delete it → 0 rows
--   perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
--   delete from public.notes where id = nid;
--   get diagnostics n = row_count;
--   if n <> 0 then raise exception 'FAIL: teacher B deleted teacher A''s note'; end if;
--
--   -- B tries to make themself admin → 42501
--   begin
--     update public.profiles set role = 'admin' where id = b;
--     raise exception 'FAIL: role change allowed';
--   exception when insufficient_privilege then null;
--   end;
--
--   -- A deletes own note → 1 row (cleanup)
--   perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
--   delete from public.notes where id = nid;
--   get diagnostics n = row_count;
--   if n <> 1 then raise exception 'FAIL: owner could not delete own note'; end if;
--
--   execute 'reset role';
--   raise notice 'PASS: other teacher cannot delete a note, owner can, role cannot be changed';
-- end $$;
