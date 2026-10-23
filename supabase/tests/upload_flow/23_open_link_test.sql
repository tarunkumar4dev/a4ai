-- Tests for 23_open_link.sql (run_local.py, after 22; reuses 18's fixtures + helpers). NEVER on live.
\set ON_ERROR_STOP 1

-- open link O1 (…d023) by T1 in B1, key attached; access-code link A1 (…d001) stays as it is
insert into public.assignments (id, institute_id, batch_id, created_by, title, description, deadline, status, max_marks,
                                max_attempts, late_policy, max_mb, upload_link_enabled, link_identity_mode, link_token)
values ('00000000-0000-0000-0000-00000000d023', '00000000-0000-0000-0000-000000001001',
        '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-0000000000a2', 'O1 open link',
        'Upload all pages', now() + interval '1 day', 'active', 10, 2, 'accept_flag', 10, true, 'open', 'opentoken23abcdef');
insert into public.assignment_ai_keys (assignment_id, answer_key_path, updated_by)
values ('00000000-0000-0000-0000-00000000d023', '00000000-0000-0000-0000-0000000000a2/key.pdf', '00000000-0000-0000-0000-0000000000a2');

-- guest upload files under guest/<key>/ (like tst.files)
create or replace function tst.gfiles(p_key uuid, p_n int) returns jsonb language plpgsql security definer as $$
declare v_out jsonb := '[]'::jsonb; v_path text;
begin
  for i in 1..p_n loop
    v_path := '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d023/guest/' || p_key || '/'
              || gen_random_uuid() || '.jpg';
    insert into storage.objects (bucket_id, name, metadata)
    values ('submissions', v_path, jsonb_build_object('size', 1000, 'mimetype', 'image/jpeg'));
    v_out := v_out || jsonb_build_array(jsonb_build_object('storage_path', v_path, 'mime', 'image/jpeg', 'size', 1000,
      'sha256', encode(sha256(convert_to(v_path, 'UTF8')), 'hex'), 'page_order', i));
  end loop;
  return v_out;
end $$;
grant execute on function tst.gfiles(uuid, int) to anon, authenticated, service_role;

do $$
declare r jsonb; r2 jsonb; k uuid; k2 uuid; v_sub uuid; v_files jsonb;
begin
  -- link page tells the mode; the access-code link is unchanged
  perform tst.as_anon('10.0.23.1');
  r := public.get_assignment_link('opentoken23abcdef');
  r2 := public.get_assignment_link('00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(r -> 'assignment' ->> 'identity_mode' = 'open', 'get_assignment_link: identity_mode open', r);
  perform tst.ok(r2 -> 'assignment' ->> 'identity_mode' = 'access_code', 'access-code link reports access_code', r2);

  -- name rules
  perform tst.as_anon('10.0.23.1');
  r := public.open_start('opentoken23abcdef', ' A ');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_name', 'name of 1 character refused', r);
  perform tst.as_anon('10.0.23.1');
  r := public.open_start('opentoken23abcdef', repeat('x', 61));
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_name', 'name of 61 characters refused', r);

  -- an access-code link is not an open link
  perform tst.as_anon('10.0.23.1');
  r := public.open_start((select link_token from public.assignments where id = '00000000-0000-0000-0000-00000000d001'), 'Ravi Kumar');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'not_found', 'open_start on an access-code link: not_found', r);

  -- start: server makes the key, trims the name
  perform tst.as_anon('10.0.23.1');
  r := public.open_start('opentoken23abcdef', '  Ravi   Kumar ', ' 17 ', null);
  perform tst.as_admin();
  k := (r ->> 'submitter_key')::uuid;
  perform tst.ok(r ->> 'state' = 'ok' and k is not null
                 and r ->> 'upload_prefix' = '00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d023/guest/' || k || '/'
                 and (select guest_name = 'Ravi Kumar' and guest_roll = '17' from public.open_submitters where key = k),
                 'open_start: key + upload folder, name cleaned', r);

  -- storage policy: own guest folder yes, made-up key no
  perform tst.ok(public.a4_valid_submission_path(r ->> 'upload_prefix' || gen_random_uuid() || '.jpg'),
                 'storage: upload into the guest folder allowed', null);
  perform tst.ok(not public.a4_valid_submission_path('00000000-0000-0000-0000-000000001001/00000000-0000-0000-0000-00000000d023/guest/'
                                                     || gen_random_uuid() || '/' || gen_random_uuid() || '.jpg'),
                 'storage: unknown submitter folder refused', null);

  -- create without a key / with a foreign key
  perform tst.as_anon('10.0.23.1');
  r := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', null, null, tst.key(), '[]'::jsonb);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_submitter', 'create without submitter_key: invalid_submitter', r);

  -- happy path
  v_files := tst.gfiles(k, 2);
  perform tst.as_anon('10.0.23.1');
  r := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', '12-B', k, 'guestkey0000000001', v_files);
  r2 := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', '12-B', k, 'guestkey0000000001', v_files);
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  perform tst.ok(r ->> 'state' = 'created' and r -> 'submission' ->> 'label' = 'Upload-1' and (r ->> 'attempts_left')::int = 1,
                 'open_create_submission: created, Upload-1', r);
  perform tst.ok(r2 ->> 'state' = 'replayed' and r2 -> 'submission' ->> 'id' = v_sub::text, 'same key again: replayed', r2);
  perform tst.ok((select student_id is null and guest_name = 'Ravi Kumar' and guest_class = '12-B' and submitter_key = k
                    and status = 'queued' from public.submissions where id = v_sub), 'guest row stored + queued', null);
  perform tst.ok((select student_name = 'Ravi Kumar' and roll_no = '17' and student_id is null
                    from public.check_sheets where submission_id = v_sub), 'check sheet carries the guest name + roll', null);

  -- files of someone else's folder are refused
  perform tst.as_anon('10.0.23.1');
  r := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', null, k, tst.key(),
                                     tst.files('00000000-0000-0000-0000-00000000d023', '00000000-0000-0000-0000-00000000c001', 1));
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_files' and r -> 'errors' -> 0 ->> 'code' = 'bad_path', 'student folder path refused for a guest', r);

  -- history for this device only
  perform tst.as_anon('10.0.23.2');
  r := public.open_start('opentoken23abcdef', 'Meera Das');
  k2 := (r ->> 'submitter_key')::uuid;
  r := public.open_my_submissions('opentoken23abcdef', k);
  r2 := public.open_my_submissions('opentoken23abcdef', k2);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok' and jsonb_array_length(r -> 'attempts') = 1 and r -> 'guest' ->> 'name' = 'Ravi Kumar',
                 'open_my_submissions: own attempts', r);
  perform tst.ok(r2 ->> 'state' = 'ok' and jsonb_array_length(r2 -> 'attempts') = 0, 'another submitter sees nothing', r2);
  perform tst.as_anon('10.0.23.2');
  r := public.open_my_submissions('opentoken23abcdef', gen_random_uuid());
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_submitter', 'unknown key: invalid_submitter', r);

  -- max_attempts per submitter (2)
  perform tst.as_anon('10.0.23.1');
  r := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', null, k, tst.key(), tst.gfiles(k, 1));
  r2 := public.open_create_submission('opentoken23abcdef', 'Ravi Kumar', '17', null, k, tst.key(), tst.gfiles(k, 1));
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'created' and r2 ->> 'state' = 'max_attempts', 'max_attempts counted per submitter', r2);

  -- teacher: publish + override work on the guest row
  perform tst.fake_result(v_sub);
  update public.check_jobs set state = 'running' where submission_id = v_sub;
  update public.check_jobs set state = 'done' where submission_id = v_sub;
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.override_marks(v_sub, '1', 4);
  r2 := public.publish_results(null, array[v_sub]);
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok' and jsonb_array_length(r2 -> 'published') = 1, 'override + publish on a guest row', r2);
  perform tst.as_anon('10.0.23.1');
  r := public.open_my_submissions('opentoken23abcdef', k);
  perform tst.as_admin();
  perform tst.ok((select a -> 'result' ->> 'marks' from jsonb_array_elements(r -> 'attempts') a where a ->> 'id' = v_sub::text) is not null,
                 'guest sees the published result', r);
end $$;

-- 10 submissions per IP per link per hour (many submitters behind one IP)
do $$
declare r jsonb; k uuid; n_ok int := 0;
begin
  for i in 1..11 loop
    perform tst.as_anon('10.0.23.9');
    r := public.open_start('opentoken23abcdef', 'Guest ' || i);
    k := (r ->> 'submitter_key')::uuid;
    perform tst.as_admin();
    perform tst.as_anon('10.0.23.9');
    r := public.open_create_submission('opentoken23abcdef', 'Guest ' || i, null, null, k, tst.key(), tst.gfiles(k, 1));
    perform tst.as_admin();
    if r ->> 'state' = 'created' then n_ok := n_ok + 1; end if;
  end loop;
  perform tst.ok(n_ok = 10 and r ->> 'state' = 'too_many_requests' and (r ->> 'retry_after_sec')::int > 0,
                 'IP limit: 10 per link per hour, the 11th waits', r);
end $$;

-- teacher deletes a guest row; a student row is refused; anon can't call it
do $$
declare r jsonb; v_guest uuid; v_student uuid;
begin
  select id into v_guest from public.submissions where assignment_id = '00000000-0000-0000-0000-00000000d023'
                                                   and guest_name = 'Guest 1';
  select id into v_student from public.submissions where student_id is not null limit 1;
  perform tst.as_user('00000000-0000-0000-0000-0000000000b2');
  r := public.delete_guest_submissions(array[v_guest]);
  perform tst.as_admin();
  perform tst.ok(jsonb_array_length(r -> 'deleted') = 0 and r -> 'skipped' -> 0 ->> 'reason' = 'forbidden',
                 'delete_guest_submissions: other institute forbidden', r);
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.delete_guest_submissions(array[v_guest, v_student]);
  perform tst.as_admin();
  perform tst.ok(r -> 'deleted' ->> 0 = v_guest::text and not exists (select 1 from public.submissions where id = v_guest)
                 and not exists (select 1 from public.check_sheets where submission_id = v_guest)
                 and exists (select 1 from public.submissions where id = v_student),
                 'guest row deleted (+ sheet), student row kept', r);
  perform tst.ok(not has_function_privilege('anon', 'public.delete_guest_submissions(uuid[])', 'execute')
                 and not has_table_privilege('anon', 'public.open_submitters', 'select'),
                 'anon: no delete, no submitters table', null);
end $$;

-- the identity check: a row is a student's or a guest's
do $$
declare v_err text;
begin
  begin
    insert into public.submissions (assignment_id, student_id, attempt_no, files) values ('00000000-0000-0000-0000-00000000d023', null, 99, '[]');
  exception when check_violation then v_err := sqlerrm;
  end;
  perform tst.ok(v_err is not null, 'row without student and without guest refused', null);
end $$;

select '23 TESTS DONE';
