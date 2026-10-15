-- 17_profiles_role_institute.sql — institute signup works again (15 Oct 2026)
--
-- Since 13_role_hardening, handle_new_user and a4_sync_profile_role write profiles.role = 'institute' for
-- an Institute signup, but profiles_role_check only allowed admin / teacher / student:
--   * email signup  → handle_new_user fails → Supabase "Database error saving new user", no account
--   * Google signup → updateUser({role: 'institute'}) fails in a4_sync_profile_role (AuthCallback ignores
--                     the error) → metadata role stays empty
-- Reproduced 15 Oct with an auth.users insert inside a rolled-back transaction (teacher: OK, institute:
-- 23514 profiles_role_check). Last successful institute signup: 21 Aug.
--
-- Fix: allow 'institute' in the check. profiles.role only gates notes uploads (notes_insert_own:
-- teacher/admin) — an institute account still can't upload notes, same as before 13.
-- Replaced by profiles.account_type in 21; this only unblocks onboarding until then. Safe to re-run.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin', 'teacher', 'student', 'institute']));

commit;

-- VERIFY (should return 1 row with role = institute, and leave nothing behind):
-- begin;
-- insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
-- values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
--         'rollback-test-institute@example.invalid', '{"full_name":"Rollback Test","role":"institute"}', '{}', now(), now());
-- select role from public.profiles where email = 'rollback-test-institute@example.invalid';
-- rollback;
