-- Tests for 21_access_code_normalize.sql (run_local.py, after 20; reuses 18's fixtures). NEVER on live.
\set ON_ERROR_STOP 1

-- live-like 6-character codes with the digits 0 and 1 (student Bilal) + an 8-character one with L (student Chitra)
insert into public.student_access_codes (student_id, access_code, batch_id, institute_id, is_active) values
  ('00000000-0000-0000-0000-00000000c002', '10A0B1', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', true),
  ('00000000-0000-0000-0000-00000000c003', 'KLMN2345', '00000000-0000-0000-0000-000000002301', '00000000-0000-0000-0000-000000002001', true);

do $$
declare r jsonb; v_state text;
begin
  foreach v_state in array array['10A0B1', '10a0b1', ' 10A0B1 ', '10A 0B1', '10-A0-B1', 'IOAOBI', 'loaobl', 'LOAOB1'] loop
    perform tst.as_anon('10.0.21.1');
    r := public.verify_access_code(v_state);
    perform tst.as_admin();
    perform tst.ok(r ->> 'state' = 'ok' and r -> 'student' ->> 'name' = 'Bilal Khan',
                   format('code typed as %L resolves to the right student', v_state), r);
  end loop;

  perform tst.as_anon('10.0.21.2');
  r := public.verify_access_code('klmn 2345');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok' and r -> 'student' ->> 'name' = 'Chitra Rao', '8-character code with L still works', r);

  perform tst.as_anon('10.0.21.3');
  r := public.verify_access_code('10A0B2');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_code', 'a really wrong code is still wrong', r);

  perform tst.ok((select last_used_at is not null from public.student_access_codes where access_code = '10A0B1'),
                 'last_used_at updated for a normalised code', null);

  -- the other RPCs use the same lookup
  perform tst.as_anon('10.0.21.4');
  r := public.my_submissions('ioaobi', '00000000-0000-0000-0000-00000000d001');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'ok', 'my_submissions accepts the normalised code', r);
  perform tst.as_anon('10.0.21.4');
  r := public.get_assignment_link('00000000-0000-0000-0000-00000000d001', '10a-0b1');
  perform tst.as_admin();
  perform tst.ok(r -> 'student' ->> 'state' = 'ok', 'get_assignment_link accepts the normalised code', r);
  perform tst.as_anon('10.0.21.4');
  r := public.create_submission('IOAOBI', '00000000-0000-0000-0000-00000000d001', tst.key(), '[]');
  perform tst.as_admin();
  perform tst.ok(r ->> 'state' = 'invalid_files', 'create_submission accepts the normalised code (then checks files)', r);
  perform tst.ok((select public.get_student_by_code(' ioaobi ') ->> 'name') = 'Bilal Khan', 'portal login (get_student_by_code) too', null);
end $$;

-- a fold that would make two students' codes collide finds nobody (never the wrong student)
do $$
begin
  insert into public.student_access_codes (student_id, access_code, batch_id, institute_id, is_active) values
    ('00000000-0000-0000-0000-00000000c001', 'Z0Z0Z0', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', true),
    ('00000000-0000-0000-0000-00000000c002', 'ZOZOZO', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', true);
  perform tst.ok(public.a4_student_id_from_code('Z0Z0Z0') is null, 'colliding folded codes resolve to nobody', null);
  delete from public.student_access_codes where access_code in ('Z0Z0Z0', 'ZOZOZO');
end $$;

do $$
begin
  begin
    perform tst.as_anon('10.0.21.5');
    perform public.a4_access_code_key('x');
    raise exception 'FAIL anon may call a4_access_code_key';
  exception when insufficient_privilege then
    perform tst.as_admin();
    raise notice 'PASS anon denied: a4_access_code_key';
  end;
end $$;

select '21 TESTS DONE' as result;
