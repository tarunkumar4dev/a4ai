-- 23_open_link.sql — "Open link": anyone with the link can submit, no access code (23 Oct 2026).
-- Contract: docs/upload-flow-api.md §8. Requires 18 + 19 (+ 21 / 22 on production). Safe to re-run. One transaction.
--
-- The access-code flow is unchanged: get_assignment_link only gains `identity_mode` (+ the question paper for open
-- links), and the shared helpers below only gain a branch for guest rows (student_id null).
--
--   1. assignments.link_identity_mode  'access_code' (default) | 'open'
--   2. open_submitters                  one row per device / person on an open link. key = submitter_key (uuid,
--                                       made by the server). Private table: only the RPCs below read it.
--   3. submissions                      student_id nullable for guest rows; guest_name (2-60, trimmed), guest_roll,
--                                       guest_class, submitter_key. Attempts are numbered per submitter.
--   4. open_link_events                 rate limits per IP per link (private)
--   5. RPCs (anon)                      open_start → submitter_key + upload folder (the Storage path contains the
--                                       key, so the key exists before the first page is uploaded);
--                                       open_create_submission (spec signature; submitter_key must come from
--                                       open_start); open_my_submissions.
--      RPC (teacher)                    delete_guest_submissions (spam). publish / unpublish / override / retry /
--                                       history work on guest rows as they are (keyed by submission id).
--   6. Shared helpers                   a4_enqueue_submission (sheet name/roll from the guest fields),
--                                       a4_valid_submission_path (+ guest folder), a4_can_read_submission_object
--                                       (+ 5-part paths), a4_orphan_submission_files (+ guest uploads).
--   Storage path for guests: {institute}/{assignment}/guest/{submitter_key}/{uuid}.{ext}
--
-- Limits: open_create_submission 60 per IP per link per hour (a whole class behind one school Wi-Fi IP shares
-- these 60); open_start 100 new submitters per IP per link per hour; 3 submits / minute / submitter (as 18).
-- After running:  notify pgrst, 'reload schema';

begin;

do $$
begin
  if to_regprocedure('public.create_submission(text,uuid,text,jsonb,text)') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'assignments' and column_name = 'upload_link_enabled') then
    raise exception '23_open_link needs 18_upload_flow and 19_upload_link_portal applied first';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 1. Link mode
-- ════════════════════════════════════════════════════════════════════
alter table public.assignments
  add column if not exists link_identity_mode text not null default 'access_code';
alter table public.assignments drop constraint if exists assignments_link_identity_mode_check;
alter table public.assignments add constraint assignments_link_identity_mode_check
  check (link_identity_mode in ('access_code', 'open'));

-- ════════════════════════════════════════════════════════════════════
-- 2. Submitters of open links (private)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.open_submitters (
  key           uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  guest_name    text not null check (char_length(guest_name) between 2 and 60),
  guest_roll    text check (char_length(guest_roll) between 1 and 30),
  guest_class   text check (char_length(guest_class) between 1 and 60),
  ip_hash       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists open_submitters_assignment_idx on public.open_submitters (assignment_id);
alter table public.open_submitters enable row level security;   -- no policies
revoke all on public.open_submitters from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 3. Guest attempts
-- ════════════════════════════════════════════════════════════════════
alter table public.submissions alter column student_id drop not null;
alter table public.submissions
  add column if not exists guest_name    text,
  add column if not exists guest_roll    text,
  add column if not exists guest_class   text,
  add column if not exists submitter_key uuid references public.open_submitters(key) on delete cascade;

-- a row is either a student's (as before) or a guest's — never both, never neither
alter table public.submissions drop constraint if exists submissions_identity_check;
alter table public.submissions add constraint submissions_identity_check check (
     (student_id is not null and submitter_key is null and guest_name is null and guest_roll is null and guest_class is null)
  or (student_id is null and submitter_key is not null
      and guest_name is not null and char_length(guest_name) between 2 and 60 and guest_name = btrim(guest_name)
      and (guest_roll is null or char_length(guest_roll) between 1 and 30)
      and (guest_class is null or char_length(guest_class) between 1 and 60)));

-- 18's (assignment_id, student_id, attempt_no) index never clashes on null student_id: guests get their own
create unique index if not exists submissions_guest_attempt_uq
  on public.submissions (assignment_id, submitter_key, attempt_no) where submitter_key is not null;

-- ════════════════════════════════════════════════════════════════════
-- 4. Rate-limit log (private)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.open_link_events (
  id            bigserial primary key,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  ip_hash       text not null,
  kind          text not null check (kind in ('start', 'submit')),
  ts            timestamptz not null default now()
);
create index if not exists open_link_events_lookup_idx on public.open_link_events (assignment_id, ip_hash, kind, ts desc);
alter table public.open_link_events enable row level security;   -- no policies
revoke all on public.open_link_events from anon, authenticated;
revoke all on sequence public.open_link_events_id_seq from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 5. Helpers
-- ════════════════════════════════════════════════════════════════════
-- Typed text → one line: control characters dropped, runs of spaces collapsed, trimmed; '' → null.
create or replace function public.a4_clean_guest_text(p text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

-- Validates the three fields. Returns null when fine, else {state: invalid_name | invalid_request, field}.
create or replace function public.a4_guest_fields_error(p_name text, p_roll text, p_class text)
returns jsonb language sql immutable as $$
  select case
    when p_name is null or char_length(p_name) not between 2 and 60
      then jsonb_build_object('state', 'invalid_name', 'field', 'guest_name')
    when p_roll is not null and char_length(p_roll) > 30
      then jsonb_build_object('state', 'invalid_request', 'field', 'guest_roll')
    when p_class is not null and char_length(p_class) > 60
      then jsonb_build_object('state', 'invalid_request', 'field', 'guest_class')
  end
$$;

-- The open link a guest RPC works on: by token only, upload link on, mode open.
create or replace function public.a4_open_link(p_token text)
returns public.assignments language sql stable security definer set search_path = public as $$
  select a.* from assignments a
   where p_token is not null and length(p_token) <= 80 and a.link_token = p_token
     and a.upload_link_enabled and a.link_identity_mode = 'open'
   limit 1
$$;

-- ════════════════════════════════════════════════════════════════════
-- 6. get_assignment_link — 18's body + `identity_mode`; an open link also returns the question paper
--    (anyone with the link may see it — that is what an open link is). Marked NEW.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.get_assignment_link(p_ref text, p_code text default null, p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_id    uuid := case when p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_ref::uuid end;
  a       assignments%rowtype;
  v_batch text;
  v_state text;
  v_out   jsonb;
  g       jsonb;
  st      students%rowtype;
  v_used  int;
begin
  if p_ref is null or length(p_ref) > 80 then
    return jsonb_build_object('state', 'not_found');
  end if;
  select * into a from assignments where link_token = p_ref or id = v_id limit 1;
  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;
  select name into v_batch from batches where id = a.batch_id;

  v_state := case
    when a.status is distinct from 'active' then 'inactive'
    when a.opens_at is not null and now() < a.opens_at then 'not_open'
    when a.deadline is not null and now() > a.deadline + interval '2 minutes'
      then case when a.late_policy = 'reject' then 'closed' else 'open_late' end
    else 'open' end;

  if v_state = 'inactive' then
    return jsonb_build_object('state', v_state, 'title', a.title);
  end if;

  v_out := jsonb_build_object(
    'state', v_state,
    'server_time', now(),
    'assignment', jsonb_build_object(
      'id', a.id, 'title', a.title, 'instructions', a.description, 'batch_name', v_batch,
      'opens_at', a.opens_at, 'closes_at', a.deadline, 'grace_minutes', 2,
      'late_policy', a.late_policy, 'count_policy', a.count_policy, 'max_attempts', a.max_attempts,
      'allowed_mimes', to_jsonb(a.allowed_mimes), 'max_mb', a.max_mb, 'max_pages', a.max_pages,
      'max_marks', a.max_marks,
      -- NEW (23): an open link only counts as open while the upload link is on
      'identity_mode', case when a.link_identity_mode = 'open' and a.upload_link_enabled then 'open' else 'access_code' end));

  -- NEW (23)
  if a.link_identity_mode = 'open' and a.upload_link_enabled and p_code is null then
    return v_out || jsonb_build_object('question_paper', case when a.file_url is not null
                                         then jsonb_build_object('file_url', a.file_url, 'file_name', a.file_name) end);
  end if;

  if p_code is null then
    return v_out;
  end if;

  g := public.a4_code_gate(p_code, p_ip_hash);
  if g ->> 'state' <> 'ok' then
    return v_out || jsonb_build_object('student', g);
  end if;
  select * into st from students where id = (g ->> 'student_id')::uuid;
  if st.institute_id <> a.institute_id
     or not coalesce(a.batch_id = st.batch_id or a.batch_id = st.lab_batch_id, false) then
    return v_out || jsonb_build_object('student', jsonb_build_object('state', 'not_in_class'));
  end if;
  select count(*) filter (where coalesce(status, '') <> 'rejected') into v_used
    from submissions where assignment_id = a.id and student_id = st.id;
  return v_out || jsonb_build_object(
    'student', jsonb_build_object('state', 'ok', 'name', st.name, 'attempts_used', v_used,
                                  'attempts_left', greatest(a.max_attempts - v_used, 0)),
    'question_paper', case when a.file_url is not null
                           then jsonb_build_object('file_url', a.file_url, 'file_name', a.file_name) end);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 7. open_start — "Continue" on the name form. Same key again (this device) → details updated, same key back.
--    {state: ok, submitter_key, upload_prefix, attempts_used, attempts_left}
--    | not_found | inactive | invalid_name | invalid_request | too_many_requests (retry_after_sec)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.open_start(p_token text, p_guest_name text, p_guest_roll text default null,
                                             p_guest_class text default null, p_submitter_key uuid default null,
                                             p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c_max_starts constant int := 100;
  a        assignments%rowtype;
  v_ip     text := public.a4_request_ip_hash(p_ip_hash);
  v_name   text := public.a4_clean_guest_text(p_guest_name);
  v_roll   text := public.a4_clean_guest_text(p_guest_roll);
  v_class  text := public.a4_clean_guest_text(p_guest_class);
  v_err    jsonb := public.a4_guest_fields_error(v_name, v_roll, v_class);
  v_key    uuid;
  v_n      int;
  v_oldest timestamptz;
  v_used   int := 0;
begin
  a := public.a4_open_link(p_token);
  if a.id is null then
    return jsonb_build_object('state', 'not_found');
  end if;
  if a.status is distinct from 'active' then
    return jsonb_build_object('state', 'inactive');
  end if;
  if v_err is not null then
    return v_err;
  end if;

  if p_submitter_key is not null then
    update open_submitters set guest_name = v_name, guest_roll = v_roll, guest_class = v_class, updated_at = now()
     where key = p_submitter_key and assignment_id = a.id
    returning key into v_key;
  end if;

  if v_key is null then
    perform pg_advisory_xact_lock(hashtext('a4open-start:' || a.id || ':' || v_ip));
    select count(*), min(ts) into v_n, v_oldest from open_link_events
     where assignment_id = a.id and ip_hash = v_ip and kind = 'start' and ts > now() - interval '1 hour';
    if v_n >= c_max_starts then
      return jsonb_build_object('state', 'too_many_requests',
        'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::int));
    end if;
    insert into open_submitters (assignment_id, guest_name, guest_roll, guest_class, ip_hash)
    values (a.id, v_name, v_roll, v_class, v_ip)
    returning key into v_key;
    insert into open_link_events (assignment_id, ip_hash, kind) values (a.id, v_ip, 'start');
  else
    select count(*) filter (where coalesce(status, '') <> 'rejected') into v_used
      from submissions where assignment_id = a.id and submitter_key = v_key;
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'submitter_key', v_key,
    'upload_prefix', a.institute_id || '/' || a.id || '/guest/' || v_key || '/',
    'attempts_used', v_used,
    'attempts_left', greatest(a.max_attempts - v_used, 0));
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 8. open_create_submission — one attempt on an open link. Same rules and answers as 18's create_submission
--    (window, 3 / min, attempts, file checks, idempotency) with the submitter in place of the student, plus
--    60 submissions per IP per link per hour. Extra states: invalid_submitter (unknown key → start again),
--    invalid_name, invalid_request.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.open_create_submission(p_token text, p_guest_name text, p_guest_roll text,
                                                         p_guest_class text, p_submitter_key uuid,
                                                         p_idempotency_key text, p_files jsonb,
                                                         p_ip_hash text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c_ip_max   constant int := 60;
  a          assignments%rowtype;
  v_ip       text := public.a4_request_ip_hash(p_ip_hash);
  v_name     text := public.a4_clean_guest_text(p_guest_name);
  v_roll     text := public.a4_clean_guest_text(p_guest_roll);
  v_class    text := public.a4_clean_guest_text(p_guest_class);
  v_err      jsonb;
  v_sub      submissions%rowtype;
  v_late     boolean := false;
  v_recent   int;
  v_oldest   timestamptz;
  v_used     int;
  v_last     int;
  v_prefix   text;
  v_max_b    bigint;
  v_n        int;
  f          jsonb;
  i          int := 0;
  v_path     text;
  v_mime     text;
  v_size     bigint;
  v_sha      text;
  v_order    int;
  v_meta     jsonb;
  v_exp_ext  text;
  v_paths    text[] := '{}';
  v_orders   int[] := '{}';
  v_errors   jsonb := '[]'::jsonb;
  v_files    jsonb := '[]'::jsonb;
  v_warn     jsonb := '[]'::jsonb;
  v_dup_att  int;
  v_dup_other boolean;
  v_constraint text;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    return jsonb_build_object('state', 'invalid_request',
                              'message', 'idempotency_key: 16-128 characters, A-Z a-z 0-9 _ -');
  end if;
  a := public.a4_open_link(p_token);
  if a.id is null then
    return jsonb_build_object('state', 'not_found');
  end if;
  if p_submitter_key is null
     or not exists (select 1 from open_submitters where key = p_submitter_key and assignment_id = a.id) then
    return jsonb_build_object('state', 'invalid_submitter');
  end if;
  v_err := public.a4_guest_fields_error(v_name, v_roll, v_class);
  if v_err is not null then
    return v_err;
  end if;

  -- per IP per link first (a class on one Wi-Fi), then one submitter at a time
  perform pg_advisory_xact_lock(hashtext('a4open-ip:' || a.id || ':' || v_ip));
  perform pg_advisory_xact_lock(hashtext(a.id::text || p_submitter_key::text));

  select * into v_sub from submissions where idempotency_key = p_idempotency_key;
  if found then
    if v_sub.submitter_key = p_submitter_key and v_sub.assignment_id = a.id then
      return jsonb_build_object('state', 'replayed', 'submission', public.a4_submission_json(v_sub.id, false));
    end if;
    return jsonb_build_object('state', 'invalid_request', 'message', 'idempotency_key already used');
  end if;

  if a.status is distinct from 'active' then
    return jsonb_build_object('state', 'inactive');
  end if;
  if a.opens_at is not null and now() < a.opens_at then
    return jsonb_build_object('state', 'not_open', 'opens_at', a.opens_at);
  end if;
  if a.deadline is not null and now() > a.deadline + interval '2 minutes' then
    if a.late_policy = 'reject' then
      return jsonb_build_object('state', 'closed', 'closes_at', a.deadline);
    end if;
    v_late := true;
  end if;

  select count(*), min(created_at) into v_recent, v_oldest
    from submissions
   where assignment_id = a.id and submitter_key = p_submitter_key and created_at > now() - interval '60 seconds';
  if v_recent >= 3 then
    return jsonb_build_object('state', 'too_many_requests',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '60 seconds' - now())))::int));
  end if;

  select count(*), min(ts) into v_recent, v_oldest from open_link_events
   where assignment_id = a.id and ip_hash = v_ip and kind = 'submit' and ts > now() - interval '1 hour';
  if v_recent >= c_ip_max then
    return jsonb_build_object('state', 'too_many_requests', 'scope', 'ip',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::int));
  end if;

  select count(*) filter (where coalesce(status, '') <> 'rejected'), coalesce(max(attempt_no), 0)
    into v_used, v_last
    from submissions where assignment_id = a.id and submitter_key = p_submitter_key;
  if v_used >= a.max_attempts then
    return jsonb_build_object('state', 'max_attempts', 'max_attempts', a.max_attempts, 'attempts_used', v_used);
  end if;

  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then
    return jsonb_build_object('state', 'invalid_files', 'errors', jsonb_build_array(jsonb_build_object(
      'code', 'no_files', 'message', 'Add at least one file.')));
  end if;
  v_n := jsonb_array_length(p_files);
  if v_n > a.max_pages then
    return jsonb_build_object('state', 'invalid_files', 'errors', jsonb_build_array(jsonb_build_object(
      'code', 'too_many_files', 'message', format('At most %s files, %s sent.', a.max_pages, v_n))));
  end if;

  v_prefix := a.institute_id || '/' || a.id || '/guest/' || p_submitter_key || '/';
  v_max_b := a.max_mb::bigint * 1048576;

  for f in select value from jsonb_array_elements(p_files) loop
    i := i + 1;
    if jsonb_typeof(f) <> 'object' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_entry', 'message', format('File %s: bad entry.', i));
      continue;
    end if;
    v_path := f ->> 'storage_path';
    v_mime := lower(f ->> 'mime');
    v_sha  := lower(f ->> 'sha256');
    begin
      v_size  := (f ->> 'size')::bigint;
      v_order := (f ->> 'page_order')::int;
    exception when others then
      v_size := null; v_order := null;
    end;

    if v_path is null or left(v_path, length(v_prefix)) <> v_prefix
       or substr(v_path, length(v_prefix) + 1) !~ '^[0-9a-fA-F-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_path',
        'message', format('File %s was uploaded to the wrong place.', i));
      continue;
    end if;
    if v_path = any(v_paths) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'duplicate_file',
        'message', format('File %s is in the list twice.', i));
      continue;
    end if;
    v_paths := v_paths || v_path;
    if v_order is null or v_order < 1 or v_order > v_n or v_order = any(v_orders) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_page_order',
        'message', format('File %s: page numbers must be 1 to %s, each once.', i, v_n));
      continue;
    end if;
    v_orders := v_orders || v_order;

    v_exp_ext := case v_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpe?g'
                             when 'image/png' then 'png' when 'image/webp' then 'webp'
                             when 'image/heic' then 'heic' end;
    if v_mime is null or not (v_mime = any(a.allowed_mimes)) or v_exp_ext is null
       or v_path !~* ('\.' || v_exp_ext || '$') then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_format',
        'message', format('Page %s: format %s is not allowed.', v_order, coalesce(v_mime, '?')));
      continue;
    end if;
    if v_sha is null or v_sha !~ '^[0-9a-f]{64}$' then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_sha256',
        'message', format('Page %s: checksum missing.', v_order));
      continue;
    end if;

    select o.metadata into v_meta from storage.objects o where o.bucket_id = 'submissions' and o.name = v_path;
    if not found then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'not_uploaded',
        'message', format('Page %s is not uploaded yet.', v_order));
      continue;
    end if;
    v_size := coalesce((v_meta ->> 'size')::bigint, v_size);
    if v_meta ->> 'mimetype' is not null and lower(v_meta ->> 'mimetype') <> v_mime then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'bad_format',
        'message', format('Page %s: the format does not match the file.', v_order));
      continue;
    end if;
    if v_size is null or v_size <= 0 then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'empty_file',
        'message', format('Page %s is empty.', v_order));
      continue;
    end if;
    if v_size > v_max_b then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'too_large',
        'message', format('Page %s is too large (%s MB). Max %s MB.', v_order, round(v_size / 1048576.0, 1), a.max_mb));
      continue;
    end if;
    if exists (select 1 from submissions s
                where s.assignment_id = a.id and s.submitter_key = p_submitter_key
                  and s.files @> jsonb_build_array(jsonb_build_object('storage_path', v_path))) then
      v_errors := v_errors || jsonb_build_object('index', i, 'code', 'file_reused',
        'message', format('Page %s was already sent in an earlier upload.', v_order));
      continue;
    end if;

    select min(s.attempt_no) into v_dup_att
      from submissions s, jsonb_array_elements(s.files) e
     where s.assignment_id = a.id and s.submitter_key = p_submitter_key and e ->> 'sha256' = v_sha;
    if v_dup_att is not null then
      v_warn := v_warn || jsonb_build_object('code', 'same_as_earlier_upload', 'page_order', v_order,
        'message', format('Page %s is the same file as in Upload-%s.', v_order, v_dup_att));
    end if;
    -- anyone else on this assignment: a student or another guest
    v_dup_other := exists (select 1 from submissions s, jsonb_array_elements(s.files) e
                            where s.assignment_id = a.id and s.submitter_key is distinct from p_submitter_key
                              and e ->> 'sha256' = v_sha);

    v_files := v_files || jsonb_build_array(jsonb_build_object(
      'storage_path', v_path, 'mime', v_mime, 'size', v_size, 'sha256', v_sha, 'page_order', v_order)
      || case when v_dup_other then jsonb_build_object('dup_other_student', true) else '{}'::jsonb end);
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('state', 'invalid_files', 'errors', v_errors);
  end if;
  select jsonb_agg(x order by (x ->> 'page_order')::int) into v_files from jsonb_array_elements(v_files) x;

  for k in 1..2 loop
    begin
      insert into submissions (assignment_id, student_id, submitter_key, guest_name, guest_roll, guest_class,
                               attempt_no, idempotency_key, status, is_late, files, file_name, submitted_at, created_at)
      values (a.id, null, p_submitter_key, v_name, v_roll, v_class,
              v_last + 1, p_idempotency_key, 'uploaded', v_late, v_files, 'Upload-' || (v_last + 1), now(), now())
      returning * into v_sub;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'submissions_guest_attempt_uq' and k = 1 then
        select coalesce(max(attempt_no), 0) into v_last
          from submissions where assignment_id = a.id and submitter_key = p_submitter_key;
        continue;
      end if;
      select * into v_sub from submissions where idempotency_key = p_idempotency_key;
      if found and v_sub.submitter_key = p_submitter_key and v_sub.assignment_id = a.id then
        return jsonb_build_object('state', 'replayed', 'submission', public.a4_submission_json(v_sub.id, false));
      end if;
      return jsonb_build_object('state', 'conflict', 'message', 'Try again.');
    end;
  end loop;

  update open_submitters set guest_name = v_name, guest_roll = v_roll, guest_class = v_class, updated_at = now()
   where key = p_submitter_key;
  insert into open_link_events (assignment_id, ip_hash, kind) values (a.id, v_ip, 'submit');
  if random() < 0.01 then
    delete from open_link_events where ts < now() - interval '1 day';
  end if;

  perform public.a4_enqueue_submission(v_sub.id);

  return jsonb_build_object(
    'state', 'created',
    'submission', public.a4_submission_json(v_sub.id, false),
    'warnings', v_warn,
    'attempts_left', greatest(a.max_attempts - v_used - 1, 0));
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 9. open_my_submissions — 18's my_submissions for one submitter. Works after the link closes (results stay
--    visible on that device). {state: ok, guest, assignment, attempts_used, attempts_left, attempts}
--    | not_found | invalid_submitter
-- ════════════════════════════════════════════════════════════════════
create or replace function public.open_my_submissions(p_token text, p_submitter_key uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a         assignments%rowtype;
  o         open_submitters%rowtype;
  v_used    int;
  v_counted uuid;
  v_list    jsonb;
begin
  if p_token is null or length(p_token) > 80 then
    return jsonb_build_object('state', 'not_found');
  end if;
  select * into a from assignments where link_token = p_token;
  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;
  select * into o from open_submitters where key = p_submitter_key and assignment_id = a.id;
  if not found then
    return jsonb_build_object('state', 'invalid_submitter');
  end if;

  select count(*) filter (where coalesce(status, '') <> 'rejected') into v_used
    from submissions where assignment_id = a.id and submitter_key = o.key;

  if a.count_policy = 'best' then
    select s.id into v_counted
      from submissions s join check_sheets sh on sh.submission_id = s.id and sh.published
     where s.assignment_id = a.id and s.submitter_key = o.key and s.status = 'published'
     order by sh.final_marks desc nulls last, s.attempt_no desc limit 1;
  end if;
  if v_counted is null then
    select id into v_counted from submissions
     where assignment_id = a.id and submitter_key = o.key and coalesce(status, '') <> 'rejected'
     order by attempt_no desc limit 1;
  end if;

  select coalesce(jsonb_agg(public.a4_submission_json(s.id, true) || jsonb_build_object('counts', s.id = v_counted)
                            order by s.attempt_no desc), '[]'::jsonb)
    into v_list
    from submissions s where s.assignment_id = a.id and s.submitter_key = o.key;

  return jsonb_build_object(
    'state', 'ok',
    'guest', jsonb_build_object('name', o.guest_name, 'roll', o.guest_roll, 'class', o.guest_class),
    'assignment', jsonb_build_object('id', a.id, 'title', a.title, 'max_attempts', a.max_attempts,
                                     'count_policy', a.count_policy),
    'attempts_used', v_used,
    'attempts_left', greatest(a.max_attempts - v_used, 0),
    'attempts', v_list);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 10. delete_guest_submissions — teacher removes spam. Guest rows only; the check sheet + job go with the row
--     (FK cascade), the audit rows keep their history (submission_id set null), the files become unattached
--     uploads and the hourly cleanup deletes them after 24 h. {state: ok, deleted[], skipped[{id, reason}]}
-- ════════════════════════════════════════════════════════════════════
create or replace function public.delete_guest_submissions(p_submission_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r       record;
  v_done  jsonb := '[]'::jsonb;
  v_skip  jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthorized');
  end if;
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 or cardinality(p_submission_ids) > 500 then
    return jsonb_build_object('state', 'invalid_request', 'message', 'Pass 1-500 p_submission_ids');
  end if;
  for r in select s.id, s.assignment_id, s.student_id from submissions s
            where s.id = any(p_submission_ids) order by s.id for update of s loop
    if not public.a4_can_grade_assignment(r.assignment_id) then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'reason', 'forbidden');
    elsif r.student_id is not null then
      v_skip := v_skip || jsonb_build_object('id', r.id, 'reason', 'not_guest');
    else
      delete from submissions where id = r.id;
      v_done := v_done || to_jsonb(r.id);
    end if;
  end loop;
  select v_skip || coalesce(jsonb_agg(jsonb_build_object('id', x, 'reason', 'forbidden')), '[]'::jsonb)
    into v_skip
    from unnest(p_submission_ids) x where not exists (select 1 from submissions s where s.id = x)
                                      and not (to_jsonb(x) <@ v_done);
  return jsonb_build_object('state', 'ok', 'deleted', v_done, 'skipped', v_skip);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 11. a4_enqueue_submission — 18's body; the sheet's name / roll come from the guest fields when there is no
--     student (the only change, marked NEW).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_enqueue_submission(p_submission_id uuid)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  s        submissions%rowtype;
  a        assignments%rowtype;
  st       students%rowtype;
  v_key    int;
  v_class  text;
  v_session uuid;
  v_sheet  uuid;
  v_job    uuid;
  v_state  text;
begin
  select * into s from submissions where id = p_submission_id for update;
  select * into a from assignments where id = s.assignment_id;
  select * into st from students where id = s.student_id;
  select version into v_key from assignment_ai_keys where assignment_id = a.id;

  if v_key is null then
    update submissions set status = 'waiting_key', answer_key_version = null where id = s.id;
    return null;
  end if;

  perform set_config('a4.system_write', 'on', true);

  select id into v_session from check_sessions where assignment_id = a.id;
  if v_session is null then
    select class_level into v_class from batches where id = a.batch_id;
    insert into check_sessions (teacher_id, title, source, batch_id, class_grade, assignment_id)
    values (a.created_by, left(coalesce(nullif(trim(a.title), ''), 'Assignment'), 200), 'assignment',
            a.batch_id, v_class, a.id)
    on conflict (assignment_id) where assignment_id is not null do nothing
    returning id into v_session;
    if v_session is null then
      select id into v_session from check_sessions where assignment_id = a.id;
    end if;
  end if;

  insert into check_sheets (session_id, teacher_id, student_id, student_name, roll_no, pages, status,
                            submission_id, source_bucket)
  values (v_session, a.created_by, st.id,
          left(coalesce(nullif(trim(st.name), ''), nullif(s.guest_name, ''), 'Student'), 120),   -- NEW: guest name
          coalesce(st.roll_no, s.guest_roll),                                                     -- NEW: guest roll
          array(select f ->> 'storage_path' from jsonb_array_elements(s.files) f
                 order by (f ->> 'page_order')::int),
          'uploaded', s.id, 'submissions')
  on conflict (submission_id) where submission_id is not null
  do update set pages = excluded.pages, updated_at = now()
  returning id into v_sheet;

  insert into check_jobs (kind, teacher_id, institute_id, session_id, sheet_id, submission_id, idempotency_key)
  values ('check', a.created_by, a.institute_id, v_session, v_sheet, s.id, 'check:' || v_sheet || ':k' || v_key)
  on conflict (idempotency_key) do update
     set state = 'queued', retries = 0, next_run_at = now(), locked_at = null, finished_at = null,
         last_error_code = null, error = null, updated_at = now()
   where check_jobs.state in ('failed', 'cancelled');

  select id, state into v_job, v_state from check_jobs where idempotency_key = 'check:' || v_sheet || ':k' || v_key;
  update submissions
     set answer_key_version = v_key,
         status = case v_state when 'queued' then 'queued' when 'running' then 'checking'
                               when 'blocked_quota' then 'waiting_quota' else status end
   where id = s.id;

  perform set_config('a4.system_write', 'off', true);
  return v_job;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 12. Storage — 18's functions + the guest folder (5 parts). Marked NEW.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_valid_submission_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts   text[] := string_to_array(coalesce(p_name, ''), '/');
  v_n       int := coalesce(array_length(string_to_array(coalesce(p_name, ''), '/'), 1), 0);
  v_inst    uuid;
  v_asg     uuid;
  v_student uuid;
  v_mime    text;
begin
  if v_n = 3 then                                                   -- portal v1
    if v_parts[3] !~ '^[0-9a-fA-F-]{36}_[0-9]{10,16}\.pdf$' then return false; end if;
    begin
      v_inst := v_parts[1]::uuid; v_asg := v_parts[2]::uuid; v_student := split_part(v_parts[3], '_', 1)::uuid;
    exception when others then
      return false;
    end;
    return exists (
      select 1 from assignments a join students st on st.id = v_student
       where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
         and st.institute_id = v_inst and coalesce(st.is_active, true)
         and a.batch_id in (st.batch_id, st.lab_batch_id));
  end if;

  -- NEW (23): {institute}/{assignment}/guest/{submitter_key}/{uuid}.{ext} — a submitter of this open link
  if v_n = 5 then
    if v_parts[3] <> 'guest' or v_parts[5] !~* '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$' then
      return false;
    end if;
    begin
      v_inst := v_parts[1]::uuid; v_asg := v_parts[2]::uuid; v_student := v_parts[4]::uuid;
    exception when others then
      return false;
    end;
    v_mime := case lower(substring(v_parts[5] from '\.([a-zA-Z]+)$'))
                when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
                when 'png' then 'image/png' when 'webp' then 'image/webp' when 'heic' then 'image/heic' end;
    return exists (
      select 1 from assignments a join open_submitters o on o.assignment_id = a.id and o.key = v_student
       where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
         and a.upload_link_enabled and a.link_identity_mode = 'open'
         and v_mime = any(a.allowed_mimes)
         and (a.opens_at is null or now() >= a.opens_at)
         and (a.deadline is null or a.late_policy = 'accept_flag' or now() <= a.deadline + interval '2 minutes'));
  end if;

  if v_n <> 4 or v_parts[4] !~* '^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$' then
    return false;
  end if;
  begin
    v_inst := v_parts[1]::uuid; v_asg := v_parts[2]::uuid; v_student := v_parts[3]::uuid;
  exception when others then
    return false;
  end;
  v_mime := case lower(substring(v_parts[4] from '\.([a-zA-Z]+)$'))
              when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
              when 'png' then 'image/png' when 'webp' then 'image/webp' when 'heic' then 'image/heic' end;
  return exists (
    select 1 from assignments a join students st on st.id = v_student
     where a.id = v_asg and a.institute_id = v_inst and a.status = 'active'
       and v_mime = any(a.allowed_mimes)
       and (a.opens_at is null or now() >= a.opens_at)
       and (a.deadline is null or a.late_policy = 'accept_flag' or now() <= a.deadline + interval '2 minutes')
       and st.institute_id = v_inst and coalesce(st.is_active, true)
       and a.batch_id in (st.batch_id, st.lab_batch_id));
end $$;

create or replace function public.a4_can_read_submission_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
  v_inst uuid; v_asg uuid;
begin
  if coalesce(array_length(v_parts, 1), 0) not in (3, 4, 5) then return false; end if;   -- NEW: 5 = guest
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

-- Unattached uploads > 24 h: student folders (as 18) and, NEW, guest folders (incl. files of deleted guest rows).
create or replace function public.a4_orphan_submission_files(p_limit int default 500)
returns setof text language sql stable security definer set search_path = public as $$
  with o as (
    select name, created_at,
           name ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){3}[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$'
             as is_student,
           name ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){2}guest/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$'
             as is_guest
      from storage.objects
     where bucket_id = 'submissions' and created_at < now() - interval '24 hours')
  select o.name from o
   where (o.is_student or o.is_guest)
     and not exists (
       select 1 from submissions s
        where s.assignment_id = (case when o.is_student or o.is_guest then split_part(o.name, '/', 2)::uuid end)
          and (case when o.is_student then s.student_id = split_part(o.name, '/', 3)::uuid
                    else s.submitter_key = split_part(o.name, '/', 4)::uuid end)
          and s.files @> jsonb_build_array(jsonb_build_object('storage_path', o.name)))
   order by o.created_at
   limit greatest(1, least(coalesce(p_limit, 500), 1000))
$$;

-- ════════════════════════════════════════════════════════════════════
-- 13. Grants. New functions only — `create or replace` keeps the grants 18 gave get_assignment_link,
--     a4_enqueue_submission and the storage helpers.
-- ════════════════════════════════════════════════════════════════════
revoke execute on function
  public.a4_clean_guest_text(text), public.a4_guest_fields_error(text, text, text), public.a4_open_link(text),
  public.open_start(text, text, text, text, uuid, text),
  public.open_create_submission(text, text, text, text, uuid, text, jsonb, text),
  public.open_my_submissions(text, uuid),
  public.delete_guest_submissions(uuid[])
from public, anon, authenticated;

grant execute on function
  public.open_start(text, text, text, text, uuid, text),
  public.open_create_submission(text, text, text, text, uuid, text, jsonb, text),
  public.open_my_submissions(text, uuid)
to anon, authenticated;
grant execute on function public.delete_guest_submissions(uuid[]) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (read-only; every row should say true)
-- ════════════════════════════════════════════════════════════════════
-- select 'mode column', exists (select 1 from information_schema.columns where table_name = 'assignments' and column_name = 'link_identity_mode')
-- union all select 'every link still access_code', not exists (select 1 from assignments where link_identity_mode <> 'access_code')
-- union all select 'student_id nullable', (select is_nullable = 'YES' from information_schema.columns where table_name = 'submissions' and column_name = 'student_id')
-- union all select 'identity check', exists (select 1 from pg_constraint where conname = 'submissions_identity_check')
-- union all select 'open_submitters closed', not has_table_privilege('anon', 'public.open_submitters', 'select')
-- union all select 'events closed', not has_table_privilege('anon', 'public.open_link_events', 'select')
-- union all select 'anon can open_start', has_function_privilege('anon', 'public.open_start(text,text,text,text,uuid,text)', 'execute')
-- union all select 'anon can open_create', has_function_privilege('anon', 'public.open_create_submission(text,text,text,text,uuid,text,jsonb,text)', 'execute')
-- union all select 'anon cannot delete guests', not has_function_privilege('anon', 'public.delete_guest_submissions(uuid[])', 'execute')
-- union all select 'anon cannot enqueue', not has_function_privilege('anon', 'public.a4_enqueue_submission(uuid)', 'execute');
