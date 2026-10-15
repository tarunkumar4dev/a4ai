-- 20_close_self_grant.sql — users can no longer grant themselves a plan (15 Oct 2026)
--
-- Written from a READ-ONLY check of the live DB (15 Oct):
--   * subscriptions had "Users can insert own subscriptions" + "Users can update own subscriptions" (no WITH
--     CHECK) and authenticated had table-level INSERT/UPDATE → any signed-in user could set their own
--     subscription to Pro until 2099 from the browser console. a4_effective_plan / check_usage /
--     a4_is_paid_user read subscriptions, so that was a real paid plan (and paid chat for every member of
--     an owner's institute).
--   * payments had "Users can insert own payments" → fake 'paid' rows in a user's own billing history.
--   * institutes "owner_all" (ALL, owner_id = auth.uid(), no WITH CHECK) let any user INSERT an institute
--     with themselves as owner, bypassing create_institute; "institutes_admin_update" (no WITH CHECK) let a
--     non-owner admin set owner_id to themselves. Owners/admins could also edit plan_id / max_* columns.
--   * teacher_profiles / profiles: own row UPDATE incl. plan_id (nothing reads it for access today; closed
--     so nothing ever can).
--   * Every writer of subscriptions / payments is SECURITY DEFINER (capture_payment, activate_subscription)
--     or the backend service_role → unaffected. The only app write (AuthProvider subscriptions upsert)
--     already failed (column ends_at does not exist) and is removed in the same commit.
--   * Check run before this migration: all 3 paid subscriptions have a matching 'paid' payments row with
--     the same razorpay_order_id → no sign the hole was used.
--
-- 1. subscriptions / payments: no app-side INSERT/UPDATE/DELETE (policies + grants). SELECT own stays.
-- 2. plans / usage_records: read-only for app roles.
-- 3. institutes: no direct INSERT (create_institute RPC only); owner_id, plan_id, max_teachers,
--    max_students, monthly_test_limit cannot be changed with an app JWT.
-- 4. teacher_profiles / profiles: plan_id cannot be set or changed with an app JWT.
-- Safe to re-run.

begin;

-- ── 1. subscriptions / payments ──────────────────────────────────────────────
drop policy if exists "Users can insert own subscriptions" on public.subscriptions;
drop policy if exists "Users can update own subscriptions" on public.subscriptions;
drop policy if exists "Users can insert own payments"      on public.payments;

revoke insert, update, delete, truncate, references, trigger
  on public.subscriptions, public.payments from anon, authenticated;
revoke select on public.subscriptions, public.payments from anon;

-- ── 2. plans / usage_records ─────────────────────────────────────────────────
-- plans SELECT stays for anon (pricing page). usage_records: own SELECT for signed-in users only.
revoke insert, update, delete, truncate, references, trigger
  on public.plans, public.usage_records from anon, authenticated;
revoke select on public.usage_records from anon;

-- ── 3. institutes ────────────────────────────────────────────────────────────
-- owner_all only added INSERT on top of owner_reads / owner_updates / owner_deletes_institute.
drop policy if exists owner_all on public.institutes;

create or replace function public.a4_guard_institute_columns()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  -- service_role (backend) and the SQL editor pass. auth.role() comes from the JWT, so a SECURITY DEFINER
  -- RPC called by a user does NOT pass — none updates these columns today (checked 15 Oct).
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.owner_id           is distinct from old.owner_id
  or new.plan_id            is distinct from old.plan_id
  or new.max_teachers       is distinct from old.max_teachers
  or new.max_students       is distinct from old.max_students
  or new.monthly_test_limit is distinct from old.monthly_test_limit then
    raise exception 'institute owner and plan fields cannot be changed from the app' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a4_guard_institute_columns on public.institutes;
create trigger a4_guard_institute_columns
  before update on public.institutes
  for each row execute function public.a4_guard_institute_columns();

-- ── 4. teacher_profiles / profiles: plan_id ──────────────────────────────────
create or replace function public.a4_guard_plan_id()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- teacher_profiles: assign_free_plan fills NULL with Free afterwards (it runs later: trigger names sort)
    new.plan_id := null;
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id then
    raise exception 'plan cannot be changed from the app' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a4_guard_plan_id on public.teacher_profiles;
create trigger a4_guard_plan_id
  before insert or update on public.teacher_profiles
  for each row execute function public.a4_guard_plan_id();

drop trigger if exists a4_guard_plan_id on public.profiles;
create trigger a4_guard_plan_id
  before insert or update on public.profiles
  for each row execute function public.a4_guard_plan_id();

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY (every row should say true)
-- ════════════════════════════════════════════════════════════════════════════
-- select 'no app write policy on subscriptions' as check, not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and cmd <> 'SELECT') as ok
-- union all select 'no app write policy on payments', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and cmd <> 'SELECT')
-- union all select 'authenticated cannot update subscriptions', not has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE')
-- union all select 'authenticated cannot insert subscriptions', not has_table_privilege('authenticated', 'public.subscriptions', 'INSERT')
-- union all select 'authenticated cannot insert payments', not has_table_privilege('authenticated', 'public.payments', 'INSERT')
-- union all select 'authenticated can read own subscriptions', has_table_privilege('authenticated', 'public.subscriptions', 'SELECT')
-- union all select 'anon can read plans', has_table_privilege('anon', 'public.plans', 'SELECT')
-- union all select 'authenticated cannot update plans', not has_table_privilege('authenticated', 'public.plans', 'UPDATE')
-- union all select 'owner_all gone', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'institutes' and policyname = 'owner_all')
-- union all select 'no INSERT policy on institutes', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'institutes' and cmd in ('INSERT', 'ALL'))
-- union all select 'institutes guard trigger', exists (select 1 from pg_trigger where tgname = 'a4_guard_institute_columns')
-- union all select 'plan_id guard on teacher_profiles', exists (select 1 from pg_trigger where tgname = 'a4_guard_plan_id' and tgrelid = 'public.teacher_profiles'::regclass)
-- union all select 'plan_id guard on profiles', exists (select 1 from pg_trigger where tgname = 'a4_guard_plan_id' and tgrelid = 'public.profiles'::regclass)
-- union all select 'service_role still writes subscriptions', has_table_privilege('service_role', 'public.subscriptions', 'UPDATE');

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (only if something legitimate breaks; re-opens the hole)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop trigger if exists a4_guard_plan_id on public.profiles;
-- drop trigger if exists a4_guard_plan_id on public.teacher_profiles;
-- drop trigger if exists a4_guard_institute_columns on public.institutes;
-- create policy owner_all on public.institutes for all using (owner_id = auth.uid());
-- grant select, insert, update, delete, truncate, references, trigger on public.subscriptions, public.payments, public.plans, public.usage_records to anon, authenticated;
-- create policy "Users can insert own subscriptions" on public.subscriptions for insert with check (auth.uid() = user_id);
-- create policy "Users can update own subscriptions" on public.subscriptions for update using (auth.uid() = user_id);
-- create policy "Users can insert own payments" on public.payments for insert with check (auth.uid() = user_id);
-- commit;
