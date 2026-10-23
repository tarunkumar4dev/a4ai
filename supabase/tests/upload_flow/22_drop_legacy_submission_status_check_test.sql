-- Tests for 22_drop_legacy_submission_status_check.sql (run_local.py, after 21; reuses 18's fixtures). NEVER on live.
-- The baseline carries production's pre-18 submissions_status_check; without 22, 18_upload_flow_test fails on the
-- first create_submission ('uploaded' → 23514). Here: every status 18 knows must be storable.
\set ON_ERROR_STOP 1

do $$
declare v_sub uuid; v_status text; v_err text;
begin
  perform tst.ok(not exists (select 1 from pg_constraint where conrelid = 'public.submissions'::regclass
                                                            and conname = 'submissions_status_check'),
                 'legacy submissions_status_check is gone', null);

  select id into v_sub from public.submissions where attempt_no >= 1 order by submitted_at limit 1;
  foreach v_status in array array['uploaded', 'queued', 'checking', 'checked', 'needs_review', 'published', 'failed',
                                  'rejected', 'waiting_key', 'waiting_quota', 'submitted', 'graded'] loop
    v_err := null;
    begin
      update public.submissions set status = v_status where id = v_sub;
      raise exception using errcode = 'P0001', message = 'a4_rollback';
    exception
      when check_violation then v_err := sqlerrm;
      when raise_exception then if sqlerrm <> 'a4_rollback' then v_err := sqlerrm; end if;
    end;
    perform tst.ok(v_err is null, format('submissions.status %L passes every check constraint', v_status),
                   jsonb_build_object('error', v_err));
  end loop;

  -- the teacher "Link active" switch writes active / archived (assignments_status_check allows only active/archived/draft)
  begin
    update public.assignments set status = 'archived' where id = '00000000-0000-0000-0000-00000000d001';
    raise exception using errcode = 'P0001', message = 'a4_rollback';
  exception
    when check_violation then v_err := sqlerrm;
    when raise_exception then v_err := null;
  end;
  perform tst.ok(v_err is null, 'assignments.status archived (link switched off) is allowed', jsonb_build_object('error', v_err));
end $$;
