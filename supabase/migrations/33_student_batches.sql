-- 33_student_batches.sql — a student can be in several batches (e.g. "Science" + "Maths 10").
-- Written 20 Nov 2026 from a READ-ONLY check of live (supabase db query --remote --read-only):
--   * no junction table existed; students had only batch_id + lab_batch_id (55 with batch_id, 40 with lab_batch_id)
--   * students policies: stu_select/insert/update/delete (authenticated) + agent_ro_read (agent_ro, USING true).
--     agent_ro has NO select grant on students, so that policy is inert today. Mirrored here the same way (policy, no grant).
--
-- WHAT THIS DOES
--   A. public.student_batches (student_id, batch_id, assigned_at, assigned_by), PK (student_id, batch_id), FKs cascade.
--   B. Guard trigger: student and batch must be in the SAME institute; assigned_by / assigned_at are set by the server
--      (a client can't claim someone else assigned it).
--   C. Sync trigger: students.batch_id / lab_batch_id stay the "main" + "lab" batch (attendance, rosters and every
--      existing RLS rule still read them) and are ALWAYS mirrored into student_batches. Nothing is dropped.
--      Changing students.batch_id A → B removes the A row and adds B (so an explicit extra assignment to A is lost
--      in that one case — re-add it in the UI).
--   D. Backfill: every existing batch_id / lab_batch_id → student_batches.
--   E. RLS: SELECT = own (student login) · batch I can see · student I can already see (same scope as stu_select).
--      INSERT/UPDATE/DELETE = institute admin of the batch only.
--   F. Additive policy stu_select_batch_member: a teacher/proctor/HOD of an EXTRA batch can see that student row.
--      stu_select itself is NOT changed. a4_can_view_student (StudentProfilePage) gets the same extra rule.
--   G. RPC bulk_add_students(institute, rows jsonb) — SECURITY INVOKER (RLS applies to every insert),
--      admin only, ≤ 500 rows, one sub-transaction per row: student + all its batches, or nothing for that row.
--      Light flood limit: one upload per institute at a time (advisory lock) and ≤ 2500 students / institute / minute.
--   H. RPC set_student_batches(students[], add[], remove[]) — manual assign / unassign, one transaction,
--      SECURITY INVOKER, admin only. Keeps students.batch_id / lab_batch_id filled from the memberships.
--
-- NOT CHANGED: get_class_roster / save_class_attendance / attendance RPCs still use students.batch_id + lab_batch_id.
--   A student in an EXTRA batch does NOT appear on that batch's attendance roster yet (separate step).
--
-- HOW TO RUN
--   1) Run this whole file in the Supabase SQL editor (one transaction: if anything fails, nothing changes).
--   2) Run the VERIFY block at the bottom (commented out).
--   3) `notify pgrst, 'reload schema';` is at the end so the REST API sees the new table + RPC.
--   Rollback: 33_student_batches_rollback.sql

begin;

-- ════════════════════════════════════════════════════════════════════
-- A. Table
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.student_batches (
  student_id  uuid not null references public.students(id) on delete cascade,
  batch_id    uuid not null references public.batches(id)  on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (student_id, batch_id)
);
create index if not exists student_batches_batch_id_idx on public.student_batches (batch_id);

-- ════════════════════════════════════════════════════════════════════
-- B. Helpers (SECURITY DEFINER → no RLS recursion between students ⇄ student_batches)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_batch_institute(p_batch_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select b.institute_id from batches b where b.id = p_batch_id;
$$;

-- Students that are members (via student_batches) of a batch I can see.
create or replace function public.a4_my_batch_member_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select sb.student_id from student_batches sb
  where sb.batch_id in (select public.a4_my_visible_batch_ids());
$$;

-- Students I can see through the existing stu_select rules (without user_id = me and without student_batches).
create or replace function public.a4_my_scoped_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st
  where st.institute_id in (select public.a4_my_admin_inst_ids())
     or st.batch_id     in (select public.a4_my_visible_batch_ids())
     or st.section_id   in (select public.a4_my_visible_section_ids())
     or st.department_id in (select public.a4_my_hod_dept_ids());
$$;

revoke execute on function public.a4_batch_institute(uuid)            from public, anon;
revoke execute on function public.a4_my_batch_member_student_ids()    from public, anon;
revoke execute on function public.a4_my_scoped_student_ids()          from public, anon;
grant  execute on function public.a4_batch_institute(uuid)            to authenticated;
grant  execute on function public.a4_my_batch_member_student_ids()    to authenticated;
grant  execute on function public.a4_my_scoped_student_ids()          to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- C. Guard trigger on student_batches
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_student_batches_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student_inst uuid;
  v_batch_inst   uuid;
begin
  select st.institute_id into v_student_inst from students st where st.id = new.student_id;
  select b.institute_id  into v_batch_inst   from batches  b  where b.id  = new.batch_id;
  if v_student_inst is null or v_batch_inst is null or v_student_inst <> v_batch_inst then
    raise exception 'Student and batch must belong to the same institute' using errcode = '23514';
  end if;
  -- Server-owned audit fields
  new.assigned_by := auth.uid();
  new.assigned_at := now();
  return new;
end $$;

drop trigger if exists a4_student_batches_guard on public.student_batches;
create trigger a4_student_batches_guard
  before insert or update on public.student_batches
  for each row execute function public.a4_student_batches_guard();

-- ════════════════════════════════════════════════════════════════════
-- D. Sync trigger: students.batch_id / lab_batch_id → student_batches
--    SECURITY DEFINER on purpose: a HOD/proctor who may change students.batch_id (stu_update) must not fail
--    because they can't write student_batches directly. It only ever mirrors the student's own columns.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.a4_sync_student_batches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.batch_id is not null and old.batch_id is distinct from new.batch_id
       and old.batch_id is distinct from new.lab_batch_id then
      delete from student_batches where student_id = new.id and batch_id = old.batch_id;
    end if;
    if old.lab_batch_id is not null and old.lab_batch_id is distinct from new.lab_batch_id
       and old.lab_batch_id is distinct from new.batch_id then
      delete from student_batches where student_id = new.id and batch_id = old.lab_batch_id;
    end if;
  end if;

  -- Only batches of the student's own institute (a stray cross-institute batch_id is skipped, not an error,
  -- so an unrelated student update never fails because of old data).
  insert into student_batches (student_id, batch_id)
  select new.id, b.id from batches b
  where b.id in (new.batch_id, new.lab_batch_id) and b.institute_id = new.institute_id
  on conflict (student_id, batch_id) do nothing;
  return null;
end $$;

drop trigger if exists a4_sync_student_batches on public.students;
create trigger a4_sync_student_batches
  after insert or update of batch_id, lab_batch_id on public.students
  for each row execute function public.a4_sync_student_batches();

revoke execute on function public.a4_student_batches_guard() from public, anon, authenticated;
revoke execute on function public.a4_sync_student_batches()  from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- E. Backfill existing main + lab batches (same institute only)
-- ════════════════════════════════════════════════════════════════════
insert into public.student_batches (student_id, batch_id)
select st.id, b.id
from public.students st
join public.batches b on b.id in (st.batch_id, st.lab_batch_id) and b.institute_id = st.institute_id
on conflict (student_id, batch_id) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- F. RLS + grants
-- ════════════════════════════════════════════════════════════════════
alter table public.student_batches enable row level security;

revoke all on public.student_batches from public, anon, authenticated;
grant select, insert, update, delete on public.student_batches to authenticated;
grant all on public.student_batches to service_role;

drop policy if exists sb_select on public.student_batches;
create policy sb_select on public.student_batches for select to authenticated using (
     student_id in (select public.a4_my_student_ids())          -- a logged-in student: own memberships
  or batch_id   in (select public.a4_my_visible_batch_ids())    -- admin / HOD / proctor / teacher of that batch
  or student_id in (select public.a4_my_scoped_student_ids())   -- a student I can already see (stu_select scope)
);

drop policy if exists sb_insert on public.student_batches;
create policy sb_insert on public.student_batches for insert to authenticated
  with check (public.a4_batch_institute(batch_id) in (select public.a4_my_admin_inst_ids()));

drop policy if exists sb_update on public.student_batches;
create policy sb_update on public.student_batches for update to authenticated
  using      (public.a4_batch_institute(batch_id) in (select public.a4_my_admin_inst_ids()))
  with check (public.a4_batch_institute(batch_id) in (select public.a4_my_admin_inst_ids()));

drop policy if exists sb_delete on public.student_batches;
create policy sb_delete on public.student_batches for delete to authenticated
  using (public.a4_batch_institute(batch_id) in (select public.a4_my_admin_inst_ids()));

-- Same as students.agent_ro_read (policy only; agent_ro has no table grant on students either).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'agent_ro') then
    execute 'drop policy if exists agent_ro_read on public.student_batches';
    execute 'create policy agent_ro_read on public.student_batches for select to agent_ro using (true)';
  end if;
end $$;

-- Additive: a teacher of an EXTRA batch sees the student. stu_select is untouched (permissive policies are OR-ed).
drop policy if exists stu_select_batch_member on public.students;
create policy stu_select_batch_member on public.students for select to authenticated
  using (id in (select public.a4_my_batch_member_student_ids()));

-- Same rule for StudentProfilePage's check. Body = live definition (20 Nov) + the student_batches line.
create or replace function public.a4_can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students st
    where st.id = p_student_id and (
         public.a4_is_inst_admin(st.institute_id)
      or (st.batch_id   is not null and public.a4_can_view_batch(st.batch_id))
      or (st.section_id is not null and public.a4_can_view_section(st.section_id))
      or (st.section_id is null and st.batch_id is null
          and st.department_id in (select public.a4_my_hod_dept_ids()))
      or exists (select 1 from student_batches sb
                 where sb.student_id = st.id and sb.batch_id in (select public.a4_my_visible_batch_ids()))
    ));
$$;

-- ════════════════════════════════════════════════════════════════════
-- G. bulk_add_students — SECURITY INVOKER: every insert below runs with the caller's RLS.
--    p_rows = [{ row, name, roll_no, class_level, parent_name, parent_phone, phone, email,
--                department_id, section_id, batch_id, lab_batch_id, batch_ids: [uuid, …] }, …]
--    batch_ids = ALL batches of the row (main first); batch_id = main, lab_batch_id = lab (both also mirrored).
--    Returns { created, failed, results: [{ row, ok, student_id?, error? }] }.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.bulk_add_students(p_institute_id uuid, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  r          jsonb;
  v_row      int;
  v_name     text;
  v_email    text;
  v_dept     uuid;
  v_sec      uuid;
  v_batch    uuid;
  v_lab      uuid;
  v_ids      uuid[];
  v_id       uuid;
  v_bad      text;
  v_recent   int;
  v_created  int := 0;
  v_failed   int := 0;
  v_results  jsonb := '[]'::jsonb;
  v_state    text;
  v_msg      text;
begin
  if p_institute_id is null or p_institute_id not in (select public.a4_my_admin_inst_ids()) then
    raise exception 'Only an institute admin can bulk-upload students' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Between 1 and 500 rows per upload (got %)', jsonb_array_length(p_rows) using errcode = '22023';
  end if;

  -- One upload per institute at a time; ≤ 2500 new students per institute per minute (5 full uploads).
  perform pg_advisory_xact_lock(hashtextextended('a4_bulk_add_students:' || p_institute_id::text, 0));
  select count(*) into v_recent from students
  where institute_id = p_institute_id and created_at > now() - interval '1 minute';
  if v_recent + jsonb_array_length(p_rows) > 2500 then
    raise exception 'Too many uploads in the last minute. Wait a minute and try again.' using errcode = '54000';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_row := case when coalesce(r->>'row', '') ~ '^[0-9]{1,6}$' then (r->>'row')::int else 0 end;
    begin  -- sub-transaction: this row's student + batches, or nothing
      if jsonb_typeof(r) <> 'object' then
        raise exception 'Row is not an object';
      end if;

      v_name := btrim(regexp_replace(coalesce(r->>'name', ''), '[[:cntrl:]]', '', 'g'));
      if v_name = '' then raise exception 'Student name is required'; end if;
      if length(v_name) > 120 then raise exception 'Name is longer than 120 characters'; end if;

      v_email := nullif(btrim(coalesce(r->>'email', '')), '');
      if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
        raise exception 'Email "%" is not valid', left(v_email, 60);
      end if;

      v_bad := (select string_agg(k, ', ') from unnest(array['roll_no','class_level','parent_name','parent_phone','phone']) k
                where length(coalesce(r->>k, '')) > 200);
      if v_bad is not null then raise exception 'Too long (max 200 characters): %', v_bad; end if;

      v_dept  := nullif(r->>'department_id', '')::uuid;
      v_sec   := nullif(r->>'section_id', '')::uuid;
      v_batch := nullif(r->>'batch_id', '')::uuid;
      v_lab   := nullif(r->>'lab_batch_id', '')::uuid;
      v_ids   := coalesce(array(select distinct x::uuid from jsonb_array_elements_text(
                   case when jsonb_typeof(r->'batch_ids') = 'array' then r->'batch_ids' else '[]'::jsonb end) x), '{}');
      if cardinality(v_ids) > 20 then raise exception 'At most 20 batches per student'; end if;

      if v_dept is not null and not exists (select 1 from departments d where d.id = v_dept and d.institute_id = p_institute_id) then
        raise exception 'Department not found in this institute';
      end if;
      if v_sec is not null and not exists (select 1 from sections s where s.id = v_sec
                                              and (v_dept is null or s.department_id = v_dept)
                                              and s.department_id in (select id from departments where institute_id = p_institute_id)) then
        raise exception 'Section not found in this department';
      end if;
      if exists (select 1 from unnest(v_ids || array_remove(array[v_batch, v_lab], null)) bid
                 where not exists (select 1 from batches b where b.id = bid and b.institute_id = p_institute_id and coalesce(b.is_active, true))) then
        raise exception 'A batch was not found in this institute (or is inactive)';
      end if;
      if v_dept is not null and exists (select 1 from batches b where b.id = any (v_ids || array_remove(array[v_batch, v_lab], null))
                                          and b.department_id is not null and b.department_id <> v_dept) then
        raise exception 'A batch belongs to another department';
      end if;
      if v_lab is not null and v_sec is not null and exists (select 1 from batches b where b.id = v_lab
                                                                and b.section_id is not null and b.section_id <> v_sec) then
        raise exception 'Lab batch belongs to another section';
      end if;

      insert into students (institute_id, name, roll_no, class_level, parent_name, parent_phone, phone, email,
                            department_id, section_id, batch_id, lab_batch_id, is_active)
      values (p_institute_id, v_name,
              nullif(btrim(r->>'roll_no'), ''), nullif(btrim(r->>'class_level'), ''),
              nullif(btrim(r->>'parent_name'), ''), nullif(btrim(r->>'parent_phone'), ''),
              nullif(btrim(r->>'phone'), ''), v_email,
              v_dept, v_sec, v_batch, v_lab, true)
      returning id into v_id;

      -- main + lab are mirrored by the sync trigger; add the extra batches
      insert into student_batches (student_id, batch_id)
      select v_id, bid from unnest(v_ids) bid
      on conflict (student_id, batch_id) do nothing;

      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object('row', v_row, 'ok', true, 'student_id', v_id);
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_object('row', v_row, 'ok', false, 'error',
        case
          when v_state = 'P0001' then v_msg                                   -- our own checks above
          when v_state = '22P02' then 'Invalid id in the row'
          when v_state = '23505' then 'Duplicate: this student already exists'
          when v_state = '23503' then 'A linked department/section/batch no longer exists'
          when v_state = '23514' then 'Student and batch must belong to the same institute'
          when v_state = '42501' then 'Permission denied for this department or batch'
          else 'Database error (' || v_state || ')'
        end);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'failed', v_failed, 'results', v_results);
end $$;

revoke execute on function public.bulk_add_students(uuid, jsonb) from public, anon;
grant  execute on function public.bulk_add_students(uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- H. set_student_batches — manual assign / unassign for many students at once, in ONE transaction.
--    SECURITY INVOKER (RLS applies), admin of every student's institute only.
--    Removing a student's main batch (students.batch_id) or lab batch clears that column; afterwards a student
--    without a main batch gets their oldest remaining non-lab membership as main (attendance rosters read batch_id),
--    and the same for the lab batch. Students are never deleted.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.set_student_batches(p_student_ids uuid[], p_add uuid[], p_remove uuid[])
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_ids     uuid[] := coalesce(array(select distinct x from unnest(p_student_ids) x where x is not null), '{}');
  v_add     uuid[] := coalesce(array(select distinct x from unnest(p_add) x where x is not null), '{}');
  v_remove  uuid[] := coalesce(array(select distinct x from unnest(p_remove) x where x is not null), '{}');
  v_inst    uuid;
  v_added   int;
  v_removed int;
begin
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 500 then
    raise exception 'Pick between 1 and 500 students' using errcode = '22023';
  end if;
  if cardinality(v_add) + cardinality(v_remove) = 0 or cardinality(v_add) + cardinality(v_remove) > 50 then
    raise exception 'Pick between 1 and 50 batches' using errcode = '22023';
  end if;
  if v_add && v_remove then
    raise exception 'A batch can''t be added and removed at once' using errcode = '22023';
  end if;

  -- all students in ONE institute that I administer
  select min(st.institute_id::text)::uuid into v_inst from students st where st.id = any (v_ids);
  if (select count(*) from students st where st.id = any (v_ids)) <> cardinality(v_ids)
     or exists (select 1 from students st where st.id = any (v_ids) and st.institute_id <> v_inst)
     or v_inst is null or v_inst not in (select public.a4_my_admin_inst_ids()) then
    raise exception 'Only an institute admin can change these students'' batches' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(v_add || v_remove) bid
             where not exists (select 1 from batches b where b.id = bid and b.institute_id = v_inst)) then
    raise exception 'A batch was not found in this institute' using errcode = '22023';
  end if;
  if exists (select 1 from batches b where b.id = any (v_add) and not coalesce(b.is_active, true)) then
    raise exception 'An inactive batch can''t be assigned' using errcode = '22023';
  end if;

  -- remove (the sync trigger drops the mirrored row when batch_id / lab_batch_id is cleared)
  update students set batch_id = null     where id = any (v_ids) and batch_id     = any (v_remove);
  update students set lab_batch_id = null where id = any (v_ids) and lab_batch_id = any (v_remove);
  delete from student_batches where student_id = any (v_ids) and batch_id = any (v_remove);
  get diagnostics v_removed = row_count;

  insert into student_batches (student_id, batch_id)
  select s, b from unnest(v_ids) s cross join unnest(v_add) b
  on conflict (student_id, batch_id) do nothing;
  get diagnostics v_added = row_count;

  -- a main / lab batch for students that have none (oldest membership first)
  update students st set batch_id = (
    select sb.batch_id from student_batches sb join batches b on b.id = sb.batch_id
    where sb.student_id = st.id and not b.is_lab and coalesce(b.is_active, true)
    order by sb.assigned_at, sb.batch_id limit 1)
  where st.id = any (v_ids) and st.batch_id is null;
  update students st set lab_batch_id = (
    select sb.batch_id from student_batches sb join batches b on b.id = sb.batch_id
    where sb.student_id = st.id and b.is_lab and coalesce(b.is_active, true) and sb.batch_id is distinct from st.batch_id
    order by sb.assigned_at, sb.batch_id limit 1)
  where st.id = any (v_ids) and st.lab_batch_id is null;

  return jsonb_build_object('students', cardinality(v_ids), 'added', v_added, 'removed', v_removed);
end $$;

revoke execute on function public.set_student_batches(uuid[], uuid[], uuid[]) from public, anon;
grant  execute on function public.set_student_batches(uuid[], uuid[], uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════
-- VERIFY (run after; read-only)
-- ════════════════════════════════════════════════════════════════════
-- 1) every main/lab batch is mirrored (expect 0):
-- select count(*) from students st
--   join batches b on b.id in (st.batch_id, st.lab_batch_id) and b.institute_id = st.institute_id
--   where not exists (select 1 from student_batches sb where sb.student_id = st.id and sb.batch_id = b.id);
-- 2) row count (expect ≈ 55 + 40 = 95 on 20 Nov, minus any cross-institute strays):
-- select count(*) from student_batches;
-- 3) policies (expect sb_select/sb_insert/sb_update/sb_delete/agent_ro_read + stu_select_batch_member on students):
-- select tablename, policyname, cmd, roles::text from pg_policies
--   where tablename in ('student_batches', 'students') order by 1, 2;
-- 4) anon has no access (expect false, false, false):
-- select has_table_privilege('anon', 'public.student_batches', 'select'),
--        has_table_privilege('anon', 'public.student_batches', 'insert'),
--        has_function_privilege('anon', 'public.bulk_add_students(uuid, jsonb)', 'execute');
