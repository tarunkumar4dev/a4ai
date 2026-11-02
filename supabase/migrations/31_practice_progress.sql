-- 31_practice_progress.sql — server-side progress for NCERT practice (WRITTEN, NOT APPLIED; not used by the app yet).
--
-- Today the practice pages keep the student's marks ("I got it" / "Review later") on the device
-- (src/lib/practiceProgress.ts, labelled "on this device"). This migration is the server side for later:
--   ncert_practice_marks          one row per (student, question) — PRIMARY KEY → a double click, a retry or a
--                                 second tab can never count twice; marking again replaces the row
--   record_practice_mark(q, m)    idempotent upsert; class / subject / chapter are looked up from the bank on the
--                                 server (the client can't file a mark under another chapter); hidden rows refused
--   clear_practice_mark(q)        "Undo"
--   get_my_practice_summary(tz)   totals, today, last 7 days, per subject — days counted in the student's time zone
-- Marks are self-reported: never use them for coins or ranks. Re-runnable.

begin;

create table if not exists public.ncert_practice_marks (
  user_id     uuid   not null references auth.users(id) on delete cascade,
  question_id bigint not null references public.ncert_questions(id) on delete cascade,
  result      text   not null check (result in ('got', 'review')),
  class_grade text   not null,
  subject     text   not null,
  chapter     text   not null,
  updated_at  timestamptz not null default now(),
  constraint ncert_practice_marks_pkey primary key (user_id, question_id)
);
create index if not exists ncert_practice_marks_user_time on public.ncert_practice_marks (user_id, updated_at desc);
alter table public.ncert_practice_marks enable row level security;
revoke all on public.ncert_practice_marks from anon, authenticated;
grant select on public.ncert_practice_marks to authenticated;
drop policy if exists ncert_practice_marks_own_select on public.ncert_practice_marks;
create policy ncert_practice_marks_own_select on public.ncert_practice_marks
  for select to authenticated using (user_id = auth.uid());

create or replace function public.record_practice_mark(p_question_id bigint, p_result text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  q record;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_result is null or p_result not in ('got', 'review') then
    return jsonb_build_object('ok', false, 'code', 'invalid_result');
  end if;
  select class_grade, subject, chapter into q from ncert_questions
   where id = p_question_id and (quality_status is null or quality_status not in ('duplicate', 'junk'));
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into ncert_practice_marks as m (user_id, question_id, result, class_grade, subject, chapter, updated_at)
  values (v_uid, p_question_id, p_result, q.class_grade, q.subject, coalesce(q.chapter, ''), now())
  on conflict (user_id, question_id) do update set result = excluded.result, updated_at = now();
  return jsonb_build_object('ok', true, 'result', p_result);
end $$;

create or replace function public.clear_practice_mark(p_question_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  delete from ncert_practice_marks where user_id = auth.uid() and question_id = p_question_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.get_my_practice_summary(p_tz text default 'Asia/Kolkata')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tz  text := 'UTC';
  v_cand text;
  v_today date;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- the student's time zone if Postgres knows it, else India, else UTC — never an error
  foreach v_cand in array array[p_tz, 'Asia/Kolkata'] loop
    begin
      perform now() at time zone v_cand;
      v_tz := v_cand;
      exit;
    exception when others then
      null;
    end;
  end loop;
  v_today := (now() at time zone v_tz)::date;
  return (
    with mine as (select * from ncert_practice_marks where user_id = v_uid)
    select jsonb_build_object(
      'got',    (select count(*) from mine where result = 'got'),
      'review', (select count(*) from mine where result = 'review'),
      'today',  (select count(*) from mine where (updated_at at time zone v_tz)::date = v_today),
      'week',   (select jsonb_agg(jsonb_build_object('day', d::date, 'count',
                   (select count(*) from mine where (updated_at at time zone v_tz)::date = d::date)) order by d)
                   from generate_series(v_today - 6, v_today, interval '1 day') d),
      'by_subject', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'got', g, 'review', r) order by g + r desc)
                   from (select subject, count(*) filter (where result = 'got') g, count(*) filter (where result = 'review') r
                           from mine group by subject) s), '[]'::jsonb),
      'last_at', (select max(updated_at) from mine)));
end $$;

revoke all on function public.record_practice_mark(bigint, text) from public, anon;
revoke all on function public.clear_practice_mark(bigint) from public, anon;
revoke all on function public.get_my_practice_summary(text) from public, anon;
grant execute on function public.record_practice_mark(bigint, text) to authenticated;
grant execute on function public.clear_practice_mark(bigint) to authenticated;
grant execute on function public.get_my_practice_summary(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ─── VERIFY (run after) ─────────────────────────────────────────────────────────────────────────────
-- select proname, has_function_privilege('anon', oid, 'execute') anon, has_function_privilege('authenticated', oid, 'execute') auth
--   from pg_proc where proname in ('record_practice_mark','clear_practice_mark','get_my_practice_summary'); -- anon false, auth true
-- To use it: switch src/lib/practiceProgress.ts to call these RPCs (keep the device copy as an offline queue).
