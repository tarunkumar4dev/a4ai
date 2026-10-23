-- Tests for 19_upload_link_portal.sql (run_local.py, after 18_upload_flow_test.sql — reuses its fixtures).
-- NEVER on live.

\set ON_ERROR_STOP 1

do $$
declare f jsonb; tok text;
begin
  perform tst.as_anon('10.0.9.1');
  f := public.get_student_feed('AAAA2222');
  perform tst.as_admin();
  perform tst.ok((select bool_and(a ->> 'upload_link_token' is null) from jsonb_array_elements(f -> 'assignments') a),
                 'feed: no upload link while the link is off', f -> 'assignments' -> 0);

  update public.assignments set upload_link_enabled = true where id = '00000000-0000-0000-0000-00000000d001'
  returning link_token into tok;
  perform tst.as_anon('10.0.9.1');
  f := public.get_student_feed('AAAA2222');
  perform tst.as_admin();
  perform tst.ok((select a ->> 'upload_link_token' = tok from jsonb_array_elements(f -> 'assignments') a
                   where a ->> 'id' = '00000000-0000-0000-0000-00000000d001'),
                 'feed: link token once the teacher switches the link on', null);
end $$;

do $$
declare
  r jsonb; v_sub uuid; j public.check_jobs; h jsonb; r_other jsonb; r_anon text;
begin
  -- an attempt whose check failed for good
  perform tst.as_anon('10.0.9.2');
  r := public.create_submission('BBBB3333', '00000000-0000-0000-0000-00000000d012', tst.key(),
         tst.files('00000000-0000-0000-0000-00000000d012', '00000000-0000-0000-0000-00000000c002', 1));
  perform tst.as_admin();
  v_sub := (r -> 'submission' ->> 'id')::uuid;
  j := tst.claim_for(v_sub);
  update public.check_jobs set retries = max_retries where id = j.id;
  perform tst.as_service();
  perform public.a4_finish_check_job(j.id, false, 'GEMINI_5XX', 'AI down');
  perform tst.as_admin();
  perform tst.ok((select status from public.submissions where id = v_sub) = 'failed', 'setup: attempt failed', null);

  perform tst.as_user('00000000-0000-0000-0000-0000000000b2');           -- other institute
  r_other := public.retry_checks(array[v_sub]);
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');           -- class teacher
  r := public.retry_checks(array[v_sub, (select id from tst.ids where name = 's1_a1_1')]);
  perform tst.as_admin();
  perform tst.ok(r_other -> 'skipped' -> 0 ->> 'reason' = 'forbidden' and jsonb_array_length(r_other -> 'queued') = 0,
                 'retry_checks: other institute forbidden', r_other);
  perform tst.ok(r -> 'queued' = jsonb_build_array(v_sub) and r -> 'skipped' -> 0 ->> 'reason' = 'not_failed'
                 and (select status from public.submissions where id = v_sub) = 'queued'
                 and (select state = 'queued' and retries = 0 from public.check_jobs where id = j.id),
                 'retry_checks: failed attempt re-queued (same job, retries reset); others skipped', r);

  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  h := public.submission_mark_history((select id from tst.ids where name = 's1_a1_1'));
  perform tst.as_user('00000000-0000-0000-0000-0000000000b2');
  r_other := public.submission_mark_history((select id from tst.ids where name = 's1_a1_1'));
  perform tst.as_admin();
  perform tst.ok(h ->> 'state' = 'ok'
                 and (select array_agg(e ->> 'type' order by o) from jsonb_array_elements(h -> 'events') with ordinality t(e, o))
                     @> array['unpublish', 'teacher_override', 'publish'],
                 'submission_mark_history: publish / override / unpublish for the class teacher', h);
  perform tst.ok(r_other = '{"state": "forbidden"}'::jsonb, 'submission_mark_history: other institute forbidden', r_other);

  begin
    perform tst.as_anon('10.0.9.3');
    perform public.retry_checks(array[v_sub]);
    raise exception 'FAIL anon may call retry_checks';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS anon denied: retry_checks';
  end;
end $$;

select '19 TESTS DONE' as result;
