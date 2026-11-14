-- 30_practice_coins_lockdown_rollback.sql — back to the state found on live on 1 Nov 2026 (coins and practice
-- tables writable from the app). Emergency only; fix forward instead.
begin;

drop trigger if exists a4_guard_profile_coins on public.profiles;
drop function if exists public.a4_guard_profile_coins();

drop policy if exists "insert own transactions" on public.coin_transactions;
create policy "insert own transactions" on public.coin_transactions for insert with check (user_id = auth.uid());
grant insert, update, delete, truncate, references, trigger on public.coin_transactions to anon, authenticated;

grant insert, update, delete, truncate, references, trigger
  on public.practice_questions, public.practice_attempts, public.practice_profiles to anon, authenticated;
alter table public.practice_questions disable row level security;
alter table public.practice_attempts  disable row level security;
alter table public.practice_profiles  disable row level security;

commit;
