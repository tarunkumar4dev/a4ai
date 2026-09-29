-- 01_access_helpers.sql  —  NON-DESTRUCTIVE (sirf naye functions; koi policy/table touch nahi).
-- Ye hierarchy ka "single source of truth" hai. Step 2 ki RLS policies + saare dashboards inhi pe chalenge.
--
-- ID conventions (existing code se):
--   teaching_assignments.teacher_id / timetable_slots.teacher_id / teacher_batches.teacher_id = auth user_id
--   proctor_assignments.teacher_id = institute_members.id   (user_id nahi!)
--   batches.department_id + batches.section_id ; sections.department_id ; departments.institute_id
--
-- Sab SECURITY DEFINER + fixed search_path → RLS policies ke andar call karne pe recursion nahi hoga.

-- ─── 1. Institute admin (owner ya admin role) ───────────────────────────
create or replace function public.a4_is_inst_admin(p_institute_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from institutes i where i.id = p_institute_id and i.owner_id = auth.uid())
      or exists (select 1 from institute_members m
                 where m.institute_id = p_institute_id and m.user_id = auth.uid()
                   and m.status = 'active' and m.role in ('admin','institute'));
$$;

-- ─── 2. Departments jinka main HOD hoon ────────────────────────────────
create or replace function public.a4_my_hod_dept_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.department_id from institute_members m
  where m.user_id = auth.uid() and m.status = 'active' and m.role = 'hod' and m.department_id is not null;
$$;

-- ─── 3. Sections jinka proctor (class teacher) hoon ────────────────────
create or replace function public.a4_my_proctor_section_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select pa.section_id from proctor_assignments pa
  join institute_members m on m.id = pa.teacher_id
  where m.user_id = auth.uid() and m.status = 'active' and coalesce(pa.is_active, true);
$$;

-- ─── 4. Batches jahan main padhata hoon (subject teacher) ──────────────
create or replace function public.a4_my_teaching_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select ta.batch_id from teaching_assignments ta where ta.teacher_id = auth.uid() and coalesce(ta.is_active, true)
  union
  select ts.batch_id from timetable_slots ts where ts.teacher_id = auth.uid() and coalesce(ts.is_active, true);
  -- NOTE: legacy teacher_batches jaan-bujh ke include NAHI kiya — wahi "sab dikh raha hai" wala purana rasta tha.
$$;

-- ─── 5. Section dekh sakta hoon? ───────────────────────────────────────
create or replace function public.a4_can_view_section(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sections s join departments d on d.id = s.department_id
    where s.id = p_section_id and (
         public.a4_is_inst_admin(d.institute_id)
      or s.department_id in (select public.a4_my_hod_dept_ids())
      or s.id in (select public.a4_my_proctor_section_ids())
      or exists (select 1 from batches b where b.section_id = s.id
                 and b.id in (select public.a4_my_teaching_batch_ids()))
    ));
$$;

-- ─── 6. Section manage kar sakta hoon? (subjects/timetable/proctor assign) — admin + us dept ka HOD ─
create or replace function public.a4_can_manage_section(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sections s join departments d on d.id = s.department_id
    where s.id = p_section_id and (
         public.a4_is_inst_admin(d.institute_id)
      or s.department_id in (select public.a4_my_hod_dept_ids())));
$$;

-- ─── 7. Batch dekh sakta hoon? ─────────────────────────────────────────
create or replace function public.a4_can_view_batch(p_batch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from batches b
    left join sections s on s.id = b.section_id
    where b.id = p_batch_id and (
         public.a4_is_inst_admin(b.institute_id)
      or coalesce(s.department_id, b.department_id) in (select public.a4_my_hod_dept_ids())
      or b.section_id in (select public.a4_my_proctor_section_ids())
      or b.id in (select public.a4_my_teaching_batch_ids())
      -- subject teacher of the section's main batch can see its lab batches too (and vice-versa)
      or (b.section_id is not null and exists (
            select 1 from batches b2 where b2.section_id = b.section_id
              and b2.id in (select public.a4_my_teaching_batch_ids())))
    ));
$$;

-- ─── 8. Student dekh sakta hoon? ───────────────────────────────────────
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
    ));
$$;

-- ─── 9. LOGIN BARRIER: ek call → role + scope + landing route ─────────
-- Frontend login ke baad sirf ye call karega aur isi se decide hoga kaunsa dashboard khule.
create or replace function public.get_my_access()
returns table (
  institute_id uuid, institute_name text,
  primary_role text,            -- 'admin' | 'hod' | 'proctor' | 'teacher' | 'none'
  home_route text,              -- '/institute' | '/hod' | '/dashboard'
  hod_department_ids uuid[],
  proctor_section_ids uuid[],
  teaching_batch_ids uuid[]
) language plpgsql stable security definer set search_path = public as $$
declare v_inst uuid; v_name text; v_admin boolean;
begin
  select i.id, i.name into v_inst, v_name from institutes i where i.owner_id = auth.uid()
  order by i.created_at desc limit 1;
  if v_inst is null then
    select m.institute_id into v_inst from institute_members m
    where m.user_id = auth.uid() and m.status = 'active'
    order by case m.role when 'admin' then 0 when 'institute' then 0 when 'hod' then 1 else 2 end
    limit 1;
    select i.name into v_name from institutes i where i.id = v_inst;
  end if;

  if v_inst is null then
    return query select null::uuid, null::text, 'none'::text, '/dashboard'::text,
                        '{}'::uuid[], '{}'::uuid[], '{}'::uuid[];
    return;
  end if;

  v_admin := public.a4_is_inst_admin(v_inst);
  return query
  with h as (select array_agg(x) a from public.a4_my_hod_dept_ids() x),
       p as (select array_agg(x) a from public.a4_my_proctor_section_ids() x),
       tb as (select array_agg(x) a from public.a4_my_teaching_batch_ids() x)
  select v_inst, v_name,
         case when v_admin then 'admin'
              when coalesce(array_length(h.a,1),0) > 0 then 'hod'
              when coalesce(array_length(p.a,1),0) > 0 then 'proctor'
              else 'teacher' end,
         case when v_admin then '/institute'
              when coalesce(array_length(h.a,1),0) > 0 then '/hod'
              else '/dashboard' end,
         coalesce(h.a,'{}'), coalesce(p.a,'{}'), coalesce(tb.a,'{}')
  from h, p, tb;
end $$;

grant execute on function
  public.a4_is_inst_admin(uuid), public.a4_my_hod_dept_ids(), public.a4_my_proctor_section_ids(),
  public.a4_my_teaching_batch_ids(), public.a4_can_view_section(uuid), public.a4_can_manage_section(uuid),
  public.a4_can_view_batch(uuid), public.a4_can_view_student(uuid), public.get_my_access()
to authenticated;

-- Quick test (apne login ke saath app se, ya SQL editor me kisi user ko impersonate karke):
--   select * from get_my_access();
