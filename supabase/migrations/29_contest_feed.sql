-- 29_contest_feed.sql — data for the /contests page (LeetCode-style list) + "register by code".
--
-- Until now the page showed hard-coded contests: there is no listing API (contests are private, shared by link,
-- created through the FastAPI backend). A user's contests = the ones they own (contests.teacher_id) + the ones
-- they registered for (new: contest_registrations) + the ones they attempted (contest_attempts.student_id).
--
--   get_my_contests(view, search, subject, limit, cursor)  one call for the whole page: a page of items
--        (keyset, ≤ 50), tab counts, subject facets, the "next" contest for the banner, schedule dates, server_now
--   get_contest_card(code)       preview a code / pasted link before registering
--   register_for_contest(code)   idempotent: PRIMARY KEY (contest_id, student_id) + ON CONFLICT DO NOTHING →
--        a double click, a retry or two tabs end in ONE row; every repeat gets the same contest back
--        with state 'already_registered'
--
-- Score rule copied from the backend (contest_service._results_pending): answer_mode 'teacher_release' and
-- results_published_at IS NULL → no score for the student. Never returns questions, answers or logo_base64.
-- Independent of 28 (the RPCs are SECURITY DEFINER), but run 28 first: it closes the open contest tables.
-- Re-runnable.

begin;

create table if not exists public.contest_registrations (
  contest_id uuid not null references public.contests(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint contest_registrations_pkey primary key (contest_id, student_id)
);
create index if not exists contest_registrations_student_idx on public.contest_registrations (student_id, contest_id);
alter table public.contest_registrations enable row level security;
-- no policies, no grants: only the SECURITY DEFINER functions below touch it
revoke all on public.contest_registrations from anon, authenticated;

-- "my latest attempt of this contest" (was: contest_id index + filter on student)
create index if not exists idx_contest_attempts_student_contest on public.contest_attempts (student_id, contest_id);

-- A code or a pasted link ("https://a4ai.in/contest/abcd1234?x", "/contests/live/ABCD1234/") → "abcd1234".
-- Backend codes are 8 × [a-z0-9] (contest_service._generate_short_code); column is varchar(10).
create or replace function public.a4_contest_code(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(regexp_replace(split_part(
           regexp_replace(regexp_replace(lower(btrim(coalesce(p, ''))), '[?#].*$', ''), '^.*/contests?/(live/)?', ''),
           '/', 1), '[^a-z0-9]', '', 'g'), '')
$$;

-- Every contest connected to p_uid (or only the ids in p_only), with the caller's state. Scalars only: the
-- page JSON is built by a4_contest_items for the <= 50 rows actually returned (building it for every connected
-- contest took most of the time for a teacher with 2,000 contests - supabase/tests/29_contest_feed_bench.py).
-- INTERNAL: takes a user id -> must never be callable by clients (revoked below).
drop function if exists public.a4_contest_rows(uuid, uuid);
create or replace function public.a4_contest_rows(p_uid uuid, p_only uuid[] default null)
returns table (id uuid, title text, subject text, class_grade text, short_code text, duration_minutes int,
               total_questions int, total_marks int, scheduled_at timestamptz, expires_at timestamptz, status text,
               answer_mode text, attempts int, created_at timestamptz, is_owner boolean, registered_at timestamptz,
               my_state text, pending boolean, my_score int, my_percentage numeric, my_submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  with ids as (
    select unnest(p_only) as contest_id where p_only is not null
    union select c.id from contests c where p_only is null and c.teacher_id = p_uid
    union select r.contest_id from contest_registrations r where p_only is null and r.student_id = p_uid
    union select a.contest_id from contest_attempts a where p_only is null and a.student_id = p_uid
  ),
  base as (
    select c.id, c.title, c.subject, c.class_grade, c.short_code, c.duration_minutes, c.total_questions,
           c.total_marks, c.scheduled_at, c.expires_at, c.status, c.answer_mode, c.total_attempts, c.created_at,
           coalesce(c.teacher_id = p_uid, false) as is_owner,
           r.created_at as registered_at,
           exists (select 1 from contest_attempts x
                    where x.student_id = p_uid and x.contest_id = c.id and x.status = 'in_progress') as running,
           la.status as last_status, la.score as last_score, la.percentage as last_pct, la.submitted_at as last_at,
           (c.answer_mode = 'teacher_release' and c.results_published_at is null) as pending
      from ids
      join contests c on c.id = ids.contest_id
      left join contest_registrations r on r.contest_id = c.id and r.student_id = p_uid
      left join lateral (
        select a.status, a.score, a.percentage, a.submitted_at
          from contest_attempts a
         where a.student_id = p_uid and a.contest_id = c.id and a.status <> 'in_progress'
         order by a.submitted_at desc nulls last, a.started_at desc
         limit 1) la on true
  )
  select b.id, b.title, b.subject, b.class_grade, b.short_code::text, b.duration_minutes, b.total_questions,
         b.total_marks, b.scheduled_at, b.expires_at, b.status::text, b.answer_mode::text, b.total_attempts,
         b.created_at, b.is_owner, b.registered_at,
         case when b.is_owner then 'owner'
              when b.running then 'in_progress'
              when b.last_status is not null then 'submitted'
              when b.registered_at is not null then 'registered'
              else 'none' end,
         b.pending, b.last_score, b.last_pct, b.last_at
    from base b
$$;

-- The JSON the page renders, for the given contests only. INTERNAL (revoked below).
create or replace function public.a4_contest_items(p_uid uuid, p_ids uuid[])
returns table (id uuid, item jsonb)
language sql stable security definer set search_path = public as $$
  select k.id, jsonb_build_object(
           'id', k.id, 'title', k.title, 'subject', k.subject, 'class_grade', k.class_grade,
           'short_code', k.short_code, 'duration_minutes', k.duration_minutes,
           'total_questions', k.total_questions, 'total_marks', k.total_marks,
           'scheduled_at', k.scheduled_at, 'expires_at', k.expires_at, 'status', k.status,
           'answer_mode', k.answer_mode, 'attempts', k.attempts,
           'my_state', k.my_state, 'registered_at', k.registered_at,
           'results_pending', k.pending and not k.is_owner,
           'my_score', case when k.pending then null else k.my_score end,
           'my_percentage', case when k.pending then null else k.my_percentage end,
           'my_submitted_at', k.my_submitted_at)
    from public.a4_contest_rows(p_uid, p_ids) k
   where coalesce(cardinality(p_ids), 0) > 0
$$;

-- p_view 'upcoming' = not ended, status active, not finished by the caller (sorted by start, soonest first);
--        'past'     = everything else (ended, paused, or the caller submitted), newest first.
-- Keyset cursor (sort_at, id) from next_cursor; p_cursor_at and p_cursor_id go together.
create or replace function public.get_my_contests(
  p_view text default 'upcoming', p_search text default null, p_subject text default null,
  p_limit integer default 20, p_cursor_at timestamptz default null, p_cursor_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_now   timestamptz := now();
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q     text := nullif(btrim(left(coalesce(p_search, ''), 80)), '');
  v_subj  text := nullif(btrim(left(coalesce(p_subject, ''), 80)), '');
  v_like  text;
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_view is null or p_view not in ('upcoming', 'past') then
    raise exception 'p_view must be upcoming or past' using errcode = '22023';
  end if;
  if (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception 'p_cursor_at and p_cursor_id go together' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  with mine as (
    select r.*,
           (r.expires_at is not null and r.expires_at <= v_now) as ended,
           (not (r.expires_at is not null and r.expires_at <= v_now)
             and r.status = 'active' and r.my_state <> 'submitted') as is_upcoming
      from public.a4_contest_rows(v_uid) r
  ),
  searched as (
    select * from mine m
     where v_q is null or m.title ilike v_like or coalesce(m.subject, '') ilike v_like
        or m.short_code = public.a4_contest_code(v_q)
  ),
  viewed as (
    select s.*,
           case when p_view = 'upcoming' then coalesce(s.scheduled_at, s.created_at)
                else coalesce(case when s.my_state = 'submitted' then s.my_submitted_at end,
                              case when s.ended then s.expires_at end,
                              s.created_at) end as sort_at
      from searched s
     where s.is_upcoming = (p_view = 'upcoming')
  ),
  ordered as (
    select v.*,
           row_number() over (order by case when p_view = 'upcoming' then v.sort_at end asc,
                                       case when p_view = 'past'     then v.sort_at end desc,
                                       case when p_view = 'upcoming' then v.id end asc,
                                       case when p_view = 'past'     then v.id end desc) as rn
      from viewed v
     where (v_subj is null or lower(btrim(coalesce(v.subject, ''))) = lower(v_subj))
       and (p_cursor_at is null
            or (p_view = 'upcoming' and (v.sort_at, v.id) > (p_cursor_at, p_cursor_id))
            or (p_view = 'past'     and (v.sort_at, v.id) < (p_cursor_at, p_cursor_id)))
  ),
  page as (
    select o.id, o.rn from ordered o where o.rn <= v_limit
  ),
  page_items as (
    select i.id, i.item from public.a4_contest_items(v_uid, (select array_agg(pg.id) from page pg)) i
  ),
  nxt as (
    select m.id from mine m
     where m.is_upcoming
     order by case when m.my_state = 'in_progress' then 0
                   when m.scheduled_at > v_now then 2
                   when m.expires_at is not null then 1
                   else 3 end,
              case when m.scheduled_at > v_now then m.scheduled_at else m.expires_at end asc nulls last,
              m.created_at desc
     limit 1
  )
  select jsonb_build_object(
    'server_now', v_now,
    'view', p_view,
    'items', coalesce((select jsonb_agg(pi.item order by pg.rn) from page pg join page_items pi on pi.id = pg.id),
                      '[]'::jsonb),
    'next_cursor', (select jsonb_build_object('at', o.sort_at, 'id', o.id) from ordered o
                     where o.rn = v_limit and exists (select 1 from ordered x where x.rn = v_limit + 1)),
    'counts', jsonb_build_object(
      'upcoming', (select count(*) from searched where is_upcoming),
      'past',     (select count(*) from searched where not is_upcoming),
      'live',     (select count(*) from mine where is_upcoming and coalesce(scheduled_at, '-infinity') <= v_now)),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.name, 'count', f.n) order by f.n desc, f.name)
        from (select min(btrim(subject)) as name, count(*) as n from viewed
               where nullif(btrim(coalesce(subject, '')), '') is not null
               group by lower(btrim(subject)) order by count(*) desc, 1 limit 12) f), '[]'::jsonb),
    'next', (select i.item from nxt, public.a4_contest_items(v_uid, array[nxt.id]) i),
    'scheduled', coalesce((
      select jsonb_agg(z.scheduled_at order by z.scheduled_at)
        from (select scheduled_at from mine
               where scheduled_at between v_now - interval '40 days' and v_now + interval '70 days'
               order by scheduled_at limit 100) z), '[]'::jsonb))
  into v_out;
  return v_out;
end $$;

create or replace function public.get_contest_card(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := public.a4_contest_code(p_code);
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if v_code is null or length(v_code) not between 4 and 10 then
    return jsonb_build_object('state', 'invalid_code', 'server_now', now());
  end if;
  select c.id into v_id from contests c where c.short_code = v_code;
  if v_id is null then
    return jsonb_build_object('state', 'not_found', 'server_now', now());
  end if;
  return jsonb_build_object('state', 'ok', 'server_now', now(),
                            'contest', (select i.item from public.a4_contest_items(v_uid, array[v_id]) i));
end $$;

-- states: registered | already_registered | owner (your own contest, nothing stored) | ended (nothing stored)
--         | not_found | invalid_code. 'contest' is the same JSON as one get_my_contests item.
create or replace function public.register_for_contest(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text := public.a4_contest_code(p_code);
  c       record;
  v_state text;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if v_code is null or length(v_code) not between 4 and 10 then
    return jsonb_build_object('state', 'invalid_code', 'server_now', now());
  end if;
  select x.id, x.teacher_id, x.expires_at into c from contests x where x.short_code = v_code;
  if not found then
    return jsonb_build_object('state', 'not_found', 'server_now', now());
  end if;

  if c.teacher_id = v_uid then
    v_state := 'owner';
  elsif c.expires_at is not null and c.expires_at <= now() then
    v_state := 'ended';
  else
    insert into contest_registrations (contest_id, student_id) values (c.id, v_uid)
      on conflict (contest_id, student_id) do nothing;
    v_state := case when found then 'registered' else 'already_registered' end;
  end if;

  return jsonb_build_object('state', v_state, 'server_now', now(),
                            'contest', (select i.item from public.a4_contest_items(v_uid, array[c.id]) i));
end $$;

-- Supabase gives anon + authenticated EXECUTE on new public functions by default → revoke explicitly.
revoke all on function public.a4_contest_rows(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.a4_contest_items(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.a4_contest_code(text) from public, anon, authenticated;
revoke all on function public.get_my_contests(text, text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.get_contest_card(text) from public, anon;
revoke all on function public.register_for_contest(text) from public, anon;
grant execute on function public.get_my_contests(text, text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.get_contest_card(text) to authenticated;
grant execute on function public.register_for_contest(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ─── VERIFY (run after) ─────────────────────────────────────────────────────────────────────────────
-- select proname, has_function_privilege('anon', oid, 'execute') anon,
--        has_function_privilege('authenticated', oid, 'execute') auth
--   from pg_proc where proname in ('a4_contest_rows','a4_contest_items','a4_contest_code','get_my_contests',
--                                  'get_contest_card','register_for_contest');
--   -- a4_contest_rows / a4_contest_items / a4_contest_code: false false · the three RPCs: anon false, auth true
-- select public.a4_contest_code('https://a4ai.in/contest/ABcd1234/results?x=1');   -- abcd1234
-- From the app (signed in): /contests lists your contests; "Join with code" → Register twice → one row:
-- select count(*) from contest_registrations where student_id = '<your uid>';
