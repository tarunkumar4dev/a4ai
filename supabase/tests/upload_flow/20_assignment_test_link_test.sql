-- Tests for 20_assignment_test_link.sql (run_local.py, after 19). NEVER on live.
\set ON_ERROR_STOP 1

do $$
declare v_test uuid := gen_random_uuid(); v_asg uuid; n int;
begin
  insert into public.tests (id, teacher_id) values (v_test, '00000000-0000-0000-0000-0000000000a2');

  -- the class teacher creates the link assignment for the test (RLS: own batch)
  perform tst.as_user('00000000-0000-0000-0000-0000000000a2');
  insert into public.assignments (institute_id, batch_id, created_by, title, status, test_id, upload_link_enabled)
  values ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001301',
          '00000000-0000-0000-0000-0000000000a2', 'From test', 'active', v_test, true)
  returning id into v_asg;
  select count(*) into n from public.assignments
   where test_id = v_test and batch_id = '00000000-0000-0000-0000-000000001301';
  perform tst.as_admin();
  perform tst.ok(n = 1, 'teacher finds the test''s assignment for the class (reuse lookup)', to_jsonb(n));

  -- another institute's admin can't see it
  perform tst.as_user('00000000-0000-0000-0000-0000000000b2');
  select count(*) into n from public.assignments where test_id = v_test;
  perform tst.as_admin();
  perform tst.ok(n = 0, 'test link assignment invisible to another institute', to_jsonb(n));

  -- deleting the test keeps the assignment (and its submissions)
  delete from public.tests where id = v_test;
  perform tst.ok((select test_id is null from public.assignments where id = v_asg), 'test deleted → assignment kept, test_id null', null);
end $$;

select '20 TESTS DONE' as result;
