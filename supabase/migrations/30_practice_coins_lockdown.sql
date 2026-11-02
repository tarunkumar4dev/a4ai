-- 30_practice_coins_lockdown.sql — coins and the legacy practice tables could be written by any signed-in user.
--
-- Found 1 Nov 2026 (read-only check of live):
--   * profiles: "update own profile" policies + a table-level UPDATE grant → a student could set their own
--     profiles.coins / total_coins_earned (and insert a missing profile row with any coin value);
--   * coin_transactions: "insert own transactions" → a student could write their own coin history;
--   * practice_questions / practice_attempts / practice_profiles: RLS DISABLED, anon + authenticated may
--     INSERT / UPDATE / DELETE (practice_profiles.total_coins was credited from the browser).
--   * nothing on the server awards coins (backend and migrations checked) — every coin so far came from the app.
--
-- After this: coins change only through the service role (backend / SQL editor). The app keeps working:
--   * profile name / email / school updates are unaffected (the guard only looks at the two coin columns);
--   * the redesigned student pages never write coins or the practice_* tables (old pages redirect away).
-- ORDER: deploy the frontend first (the current production build still has the old practice pages that write
-- practice_attempts / practice_profiles), then run this. Re-runnable. Rollback: 30_practice_coins_lockdown_rollback.sql.

begin;

-- ── profiles: coins only from the service role ─────────────────────────────────────────────────────
create or replace function public.a4_guard_profile_coins()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;                          -- service role / SQL editor / definer functions owned by postgres
  end if;
  if tg_op = 'INSERT' then
    new.coins := 0;                      -- a self-inserted profile starts at the column default
    new.total_coins_earned := 0;
    return new;
  end if;
  if new.coins is distinct from old.coins or new.total_coins_earned is distinct from old.total_coins_earned then
    raise exception 'coins cannot be changed from the app' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a4_guard_profile_coins on public.profiles;
create trigger a4_guard_profile_coins before insert or update on public.profiles
  for each row execute function public.a4_guard_profile_coins();

-- ── coin_transactions: read own only ───────────────────────────────────────────────────────────────
drop policy if exists "insert own transactions" on public.coin_transactions;
revoke insert, update, delete, truncate, references, trigger on public.coin_transactions from anon, authenticated;

-- ── legacy practice tables: closed to clients (no page reads or writes them after the redesign) ────
alter table public.practice_questions enable row level security;
alter table public.practice_attempts  enable row level security;
alter table public.practice_profiles  enable row level security;
revoke insert, update, delete, truncate, references, trigger
  on public.practice_questions, public.practice_attempts, public.practice_profiles from anon, authenticated;
-- (no policies → clients read nothing; the service role still sees everything)

commit;

-- ─── VERIFY (run after) ─────────────────────────────────────────────────────────────────────────────
-- select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'a4_guard_profile_coins'; -- 1 row
-- select policyname from pg_policies where tablename = 'coin_transactions';            -- only "read own transactions"
-- select relname, relrowsecurity from pg_class
--  where relname in ('practice_questions','practice_attempts','practice_profiles');     -- all true
-- select table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
--  where table_schema = 'public' and grantee = 'authenticated'
--    and table_name in ('coin_transactions','practice_questions','practice_attempts','practice_profiles')
--  group by 1;                                                                          -- SELECT only
-- Then, signed in as a student in the app: change your name in Settings → works; the Rewards page shows your balance.
