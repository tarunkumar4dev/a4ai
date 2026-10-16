-- 16_rejoin_inactive_member.sql — join code re-activates an inactive / invited membership (12 Oct 2026)
-- Bug: join_institute_by_code returned "Already a member" for status='inactive' rows (14 MSIT members after
-- 09_msit_video_reset) → the app showed "already a member", get_my_access (status='active' only) said "none".
-- Admin "Remove teacher" DELETEs the row, so 'inactive' only comes from resets: re-activating on a valid code
-- opens no new door (anyone with the code can join anyway). An inactive member comes back as a plain teacher
-- (HOD/admin are never restored by a code); an 'invited' member keeps the role the admin chose.
-- Applied on live DB 12 Oct 2026 (by human). Safe to re-run.

begin;

create or replace function public.join_institute_by_code(p_join_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := upper(trim(coalesce(p_join_code, '')));
  v_inst   uuid;
  v_name   text;
  v_dept   uuid;
  v_member uuid;
  v_status text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Please sign in first');
  end if;
  if v_code = '' then
    return json_build_object('success', false, 'error', 'Invalid join code');
  end if;

  select i.id, i.name into v_inst, v_name
    from institutes i
   where upper(i.join_code) = v_code and coalesce(i.is_active, true)
   limit 1;

  if v_inst is null then
    select d.institute_id, i.name, d.id into v_inst, v_name, v_dept
      from departments d join institutes i on i.id = d.institute_id
     where upper(d.teacher_code) = v_code and coalesce(d.is_active, true) and coalesce(i.is_active, true)
     limit 1;
  end if;

  if v_inst is null then
    return json_build_object('success', false, 'error', 'Invalid join code');
  end if;

  select m.id, m.status into v_member, v_status
    from institute_members m
   where m.institute_id = v_inst and m.user_id = auth.uid();

  if v_member is not null and v_status = 'active' then
    return json_build_object('success', false, 'error', 'Already a member',
                             'institute_id', v_inst, 'institute_name', v_name);
  end if;

  if v_member is not null then
    -- inactive → plain teacher again; invited → keep the role/department the admin set
    update institute_members
       set status        = 'active',
           role          = case when v_status = 'invited' then role else 'teacher' end,
           department_id = case when v_status = 'invited' then coalesce(department_id, v_dept) else v_dept end,
           section_id    = case when v_status = 'invited' then section_id else null end,
           joined_at     = now()
     where id = v_member;
    return json_build_object('success', true, 'institute_id', v_inst, 'institute_name', v_name,
                             'department_id', v_dept, 'rejoined', true);
  end if;

  insert into institute_members (institute_id, user_id, role, status, joined_at, department_id)
  values (v_inst, auth.uid(), 'teacher', 'active', now(), v_dept);

  return json_build_object('success', true, 'institute_id', v_inst, 'institute_name', v_name,
                           'department_id', v_dept);
end;
$$;

-- create or replace keeps grants; restate them so the file is self-contained
revoke execute on function public.join_institute_by_code(text) from public, anon;
grant  execute on function public.join_institute_by_code(text) to authenticated;

commit;

-- VERIFY (read-only):
-- select 'secdef', prosecdef::text from pg_proc where proname = 'join_institute_by_code'
-- union all select 'anon cannot join', (not has_function_privilege('anon', 'public.join_institute_by_code(text)', 'execute'))::text
-- union all select 'handles inactive', (pg_get_functiondef('public.join_institute_by_code'::regproc) ilike '%v_status = ''active''%')::text;
