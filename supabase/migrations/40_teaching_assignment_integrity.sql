-- 40_teaching_assignment_integrity.sql — Class → Subject → Batch model, part 2 (enforcement). Needs 39.
-- Applies to EVERY institute (no opt-in switch). APPLY ONLY AFTER THE BACKFILL: from here on a teaching_assignments row can
-- only be created on a batch that has a subject (batches.subject_id). The app no longer has any screen that sends a subject
-- for a teacher (Classes screen / Teachers tab / BatchManagementPanel / HOD page all send teacher + batch only).
--
--  1. BEFORE INSERT/UPDATE trigger on teaching_assignments
--       - batch must exist and belong to ta.institute_id
--       - teacher must be an active member (or the owner) of that institute
--       - subject_id := batch.subject_id (the client never chooses it); subject must be in the same institute
--       - batch without a subject: INSERT rejected; UPDATE rejected only if batch_id / subject_id changed (legacy rows exempt)
--  2. Audit gap: ta_insert / hod_insert / ta_update now also require teacher + batch + subject in the SAME institute
--     (before: only is_institute_admin(institute_id) / is_dept_hod(batch.department_id))
--  3. No orphan rows: removing a member (DELETE) or setting an active member to 'inactive' deletes that member's
--     teaching_assignments rows of that institute. A re-join therefore starts empty (before: old rows came back to life).
--  Attendance RPCs (a4_batch_student_ids, get_class_roster, save_class_attendance, get_my_teaching_targets) are NOT touched:
--  they keep reading teaching_assignments(batch_id, subject_id, teacher_id), which is now filled by the trigger.
--
-- Not touched on purpose: timetable_slots (same teacher_id shape, left for a later step), existing orphan rows
-- (listed + removed by the backfill script, not by this file).
-- Rollback: 40_teaching_assignment_integrity_rollback.sql.

begin;

-- 1. link check (used by the policies and the trigger) ------------------------------------------------------------
create or replace function public.a4_ta_links_ok(p_inst uuid, p_teacher uuid, p_batch uuid, p_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from batches b where b.id = p_batch and b.institute_id = p_inst)
     and (p_subject is null
          or exists (select 1 from subjects s where s.id = p_subject and s.institute_id = p_inst))
     and (exists (select 1 from institute_members m
                   where m.user_id = p_teacher and m.institute_id = p_inst and m.status = 'active')
          or exists (select 1 from institutes i where i.id = p_inst and i.owner_id = p_teacher));
$$;

revoke all on function public.a4_ta_links_ok(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.a4_ta_links_ok(uuid, uuid, uuid, uuid) to authenticated, service_role;

-- 2. derive the subject from the batch ----------------------------------------------------------------------------
create or replace function public.a4_ta_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select bt.institute_id, bt.subject_id into b from batches bt where bt.id = new.batch_id;
  if not found then
    raise exception 'Batch not found' using errcode = '23503';
  end if;
  if new.institute_id is null then new.institute_id := b.institute_id; end if;
  if b.institute_id <> new.institute_id then
    raise exception 'Batch belongs to a different institute' using errcode = '23514';
  end if;

  if not (exists (select 1 from institute_members m
                   where m.user_id = new.teacher_id and m.institute_id = new.institute_id and m.status = 'active')
          or exists (select 1 from institutes i where i.id = new.institute_id and i.owner_id = new.teacher_id)) then
    raise exception 'Teacher is not an active member of this institute' using errcode = '23514';
  end if;

  if b.subject_id is not null then
    new.subject_id := b.subject_id;                       -- the UI never writes the subject
  elsif tg_op = 'INSERT'
        or new.batch_id is distinct from old.batch_id
        or new.subject_id is distinct from old.subject_id then
    raise exception 'This batch has no subject yet. Set the batch''s subject first.' using errcode = '23514';
  end if;                                                 -- else: legacy row, only is_active/teacher/institute touched

  if new.subject_id is null
     or not exists (select 1 from subjects s where s.id = new.subject_id and s.institute_id = new.institute_id) then
    raise exception 'Subject belongs to a different institute' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists a4_ta_before_write on public.teaching_assignments;
create trigger a4_ta_before_write
  before insert or update of institute_id, teacher_id, batch_id, subject_id on public.teaching_assignments
  for each row execute function public.a4_ta_before_write();

revoke all on function public.a4_ta_before_write() from public, anon, authenticated;

-- 3. policies: same institute for teacher + batch + subject -------------------------------------------------------
drop policy if exists ta_insert on public.teaching_assignments;
create policy ta_insert on public.teaching_assignments for insert to authenticated
  with check (is_institute_admin(institute_id)
              and a4_ta_links_ok(institute_id, teacher_id, batch_id, subject_id));

drop policy if exists hod_insert on public.teaching_assignments;
create policy hod_insert on public.teaching_assignments for insert to authenticated
  with check (exists (select 1 from batches b
                       where b.id = teaching_assignments.batch_id
                         and b.institute_id = teaching_assignments.institute_id
                         and is_dept_hod(b.department_id))
              and a4_ta_links_ok(institute_id, teacher_id, batch_id, subject_id));

drop policy if exists ta_update on public.teaching_assignments;
create policy ta_update on public.teaching_assignments for update to authenticated
  using (is_institute_admin(institute_id))
  with check (is_institute_admin(institute_id)
              and a4_ta_links_ok(institute_id, teacher_id, batch_id, subject_id));

-- 4. no orphan rows ------------------------------------------------------------------------------------------------
create or replace function public.a4_member_cleanup_ta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from teaching_assignments where institute_id = old.institute_id and teacher_id = old.user_id;
    return old;
  end if;
  if old.status = 'active' and new.status is distinct from 'active' then
    delete from teaching_assignments where institute_id = new.institute_id and teacher_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists a4_member_cleanup_ta on public.institute_members;
create trigger a4_member_cleanup_ta
  after delete or update of status on public.institute_members
  for each row execute function public.a4_member_cleanup_ta();

revoke all on function public.a4_member_cleanup_ta() from public, anon, authenticated;

commit;

-- VERIFY (expect: trigger + 3 policies + helper present; orphan count = number of rows the backfill has not yet removed)
-- select tgname from pg_trigger where tgname in ('a4_ta_before_write','a4_member_cleanup_ta') and not tgisinternal;
-- select policyname, cmd from pg_policies where tablename='teaching_assignments' and policyname in ('ta_insert','hod_insert','ta_update');
-- select count(*) as orphan_ta from public.teaching_assignments t where not exists (select 1 from public.institute_members m
--   where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active')
--   and not exists (select 1 from public.institutes i where i.id = t.institute_id and i.owner_id = t.teacher_id);
-- notify pgrst, 'reload schema';
