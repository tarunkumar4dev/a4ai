"""Local check for 33_student_batches.sql (+ rollback) on a throw-away Postgres 16 (never live).

    <pgtest venv>/Scripts/python supabase/tests/33_student_batches_test.py

Baseline = live on 20 Nov 2026 (read-only check): helper functions (a4_my_admin_inst_ids, a4_my_visible_*,
a4_can_view_*), students policies stu_select/insert/update/delete (authenticated) + agent_ro_read (agent_ro, true),
students.batch_id / lab_batch_id with ON DELETE SET NULL, no student_batches table.
Checked as real roles (SET ROLE + jwt claim). 33 is applied twice (re-runnable), then rolled back, then applied again.
"""
import json
import pathlib
import sys
import tempfile

import pgserver
import psycopg

MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"

ADMIN, ADMIN2, HOD, TEACHER, PROCTOR = (f"{i}{i}{i}{i}{i}{i}{i}{i}-0000-4000-8000-00000000000{i}" for i in range(1, 6))
I1, I2 = "a1000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000002"
D10, D11 = "d1000000-0000-4000-8000-000000000010", "d1000000-0000-4000-8000-000000000011"
SCI = "5c000000-0000-4000-8000-000000000001"
B_MAIN, B_LAB, B_MATHS, B_ECO, B_NULL, B_OTHER, B_OLD = (
    f"b0000000-0000-4000-8000-00000000000{i}" for i in range(1, 8))
ST1, ST_STRAY = "51000000-0000-4000-8000-000000000001", "51000000-0000-4000-8000-000000000002"
M_PROCTOR = "70000000-0000-4000-8000-000000000005"

BASELINE = f"""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role agent_ro nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role, agent_ro;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.profiles (id uuid primary key references auth.users(id));
create table public.institutes (id uuid primary key, name text, owner_id uuid);
create table public.institute_members (id uuid primary key default gen_random_uuid(), institute_id uuid, user_id uuid,
  role text, status text default 'active', department_id uuid);
create table public.departments (id uuid primary key, institute_id uuid not null references public.institutes(id), name text not null);
create table public.sections (id uuid primary key, department_id uuid not null references public.departments(id), name text not null, year int);
create table public.batches (id uuid primary key, institute_id uuid not null references public.institutes(id), name text not null,
  department_id uuid, section_id uuid, is_active boolean default true, is_lab boolean not null default false, proctor_id uuid);
create table public.students (id uuid primary key default gen_random_uuid(), institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null, name text not null, roll_no text, class_level text,
  parent_name text, parent_phone text, email text, is_active boolean default true, created_at timestamptz default now(),
  updated_at timestamptz default now(), department_id uuid references public.departments(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null, user_id uuid references public.profiles(id) on delete set null,
  lab_batch_id uuid references public.batches(id) on delete set null, phone text, gender text);
create table public.proctor_assignments (id uuid primary key default gen_random_uuid(), section_id uuid, teacher_id uuid, is_active boolean default true);
create table public.teaching_assignments (id uuid primary key default gen_random_uuid(), teacher_id uuid, batch_id uuid, is_active boolean default true);
create table public.timetable_slots (id uuid primary key default gen_random_uuid(), teacher_id uuid, batch_id uuid, is_active boolean default true);

-- live helper definitions (20 Nov 2026)
create function public.a4_my_admin_inst_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select i.id from institutes i where i.owner_id = auth.uid()
  union
  select m.institute_id from institute_members m
  where m.user_id = auth.uid() and m.status = 'active' and m.role in ('admin','institute'); $$;
create function public.a4_is_inst_admin(p_institute_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from institutes i where i.id = p_institute_id and i.owner_id = auth.uid())
      or exists (select 1 from institute_members m where m.institute_id = p_institute_id and m.user_id = auth.uid()
                   and m.status = 'active' and m.role in ('admin','institute')); $$;
create function public.a4_my_hod_dept_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select m.department_id from institute_members m
  where m.user_id = auth.uid() and m.status = 'active' and m.role = 'hod' and m.department_id is not null; $$;
create function public.a4_my_proctor_section_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select pa.section_id from proctor_assignments pa join institute_members m on m.id = pa.teacher_id
  where m.user_id = auth.uid() and m.status = 'active' and coalesce(pa.is_active, true); $$;
create function public.a4_my_teaching_batch_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select ta.batch_id from teaching_assignments ta where ta.teacher_id = auth.uid() and coalesce(ta.is_active, true)
  union
  select ts.batch_id from timetable_slots ts where ts.teacher_id = auth.uid() and coalesce(ts.is_active, true); $$;
create function public.a4_my_visible_section_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from sections s join departments d on d.id = s.department_id
  where d.institute_id in (select public.a4_my_admin_inst_ids())
     or s.department_id in (select public.a4_my_hod_dept_ids())
     or s.id in (select public.a4_my_proctor_section_ids())
     or s.id in (select b.section_id from batches b
                 where b.id in (select public.a4_my_teaching_batch_ids()) and b.section_id is not null); $$;
create function public.a4_my_visible_batch_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select b.id from batches b
  where b.institute_id in (select public.a4_my_admin_inst_ids())
     or b.section_id  in (select public.a4_my_visible_section_ids())
     or b.department_id in (select public.a4_my_hod_dept_ids())
     or b.id in (select public.a4_my_teaching_batch_ids()); $$;
create function public.a4_my_student_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st where st.user_id = auth.uid(); $$;
create function public.a4_section_dept(p_section_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select s.department_id from sections s where s.id = p_section_id; $$;
create function public.a4_can_manage_dept(p_dept_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from departments d where d.id = p_dept_id and (
           d.institute_id in (select public.a4_my_admin_inst_ids()) or d.id in (select public.a4_my_hod_dept_ids()))); $$;
create function public.a4_can_view_section(p_section_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sections s join departments d on d.id = s.department_id
    where s.id = p_section_id and (public.a4_is_inst_admin(d.institute_id)
      or s.department_id in (select public.a4_my_hod_dept_ids())
      or s.id in (select public.a4_my_proctor_section_ids())
      or exists (select 1 from batches b where b.section_id = s.id and b.id in (select public.a4_my_teaching_batch_ids())))); $$;
create function public.a4_can_view_batch(p_batch_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from batches b left join sections s on s.id = b.section_id
    where b.id = p_batch_id and (public.a4_is_inst_admin(b.institute_id)
      or coalesce(s.department_id, b.department_id) in (select public.a4_my_hod_dept_ids())
      or b.section_id in (select public.a4_my_proctor_section_ids())
      or b.id in (select public.a4_my_teaching_batch_ids())
      or (b.section_id is not null and exists (select 1 from batches b2 where b2.section_id = b.section_id
              and b2.id in (select public.a4_my_teaching_batch_ids()))))); $$;
create function public.a4_can_view_student(p_student_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from students st where st.id = p_student_id and (
         public.a4_is_inst_admin(st.institute_id)
      or (st.batch_id is not null and public.a4_can_view_batch(st.batch_id))
      or (st.section_id is not null and public.a4_can_view_section(st.section_id))
      or (st.section_id is null and st.batch_id is null and st.department_id in (select public.a4_my_hod_dept_ids())))); $$;

-- live students policies
alter table public.students enable row level security;
create policy agent_ro_read on public.students for select to agent_ro using (true);
create policy stu_delete on public.students for delete to authenticated using (institute_id in (select a4_my_admin_inst_ids()));
create policy stu_insert on public.students for insert to authenticated with check ((institute_id in (select a4_my_admin_inst_ids()))
  or a4_can_manage_dept(coalesce(department_id, a4_section_dept(section_id))));
create policy stu_select on public.students for select to authenticated using ((user_id = auth.uid())
  or (institute_id in (select a4_my_admin_inst_ids())) or (batch_id in (select a4_my_visible_batch_ids()))
  or (section_id in (select a4_my_visible_section_ids())) or (department_id in (select a4_my_hod_dept_ids())));
create policy stu_update on public.students for update to authenticated
  using ((institute_id in (select a4_my_admin_inst_ids())) or a4_can_manage_dept(coalesce(department_id, a4_section_dept(section_id)))
         or (section_id in (select a4_my_proctor_section_ids())))
  with check ((institute_id in (select a4_my_admin_inst_ids())) or a4_can_manage_dept(coalesce(department_id, a4_section_dept(section_id)))
         or (section_id in (select a4_my_proctor_section_ids())));
-- departments / sections / batches readable for the checks inside bulk_add_students (live has scoped policies; admin sees own)
alter table public.departments enable row level security;
create policy d_sel on public.departments for select to authenticated using (institute_id in (select a4_my_admin_inst_ids()) or id in (select a4_my_hod_dept_ids()));
alter table public.sections enable row level security;
create policy s_sel on public.sections for select to authenticated using (id in (select a4_my_visible_section_ids()));
alter table public.batches enable row level security;
create policy b_sel on public.batches for select to authenticated using (id in (select a4_my_visible_batch_ids()));

grant all on all tables in schema public to anon, authenticated, service_role;

insert into auth.users values ('{ADMIN}'), ('{ADMIN2}'), ('{HOD}'), ('{TEACHER}'), ('{PROCTOR}');
insert into public.institutes values ('{I1}', 'Education Beast', '{ADMIN}'), ('{I2}', 'Other', '{ADMIN2}');
insert into public.departments values ('{D10}', '{I1}', '10th class'), ('{D11}', '{I1}', 'XI - Commerce');
insert into public.sections values ('{SCI}', '{D10}', 'science', 2026);
insert into public.batches (id, institute_id, name, department_id, section_id, is_lab) values
  ('{B_MAIN}', '{I1}', 'science', '{D10}', '{SCI}', false),
  ('{B_LAB}', '{I1}', 'science A', '{D10}', '{SCI}', true),
  ('{B_MATHS}', '{I1}', 'maths 10', '{D10}', null, false),
  ('{B_ECO}', '{I1}', 'ECONOMICS BATCH 11th', '{D11}', null, false),
  ('{B_NULL}', '{I1}', 'olympiad', null, null, false),
  ('{B_OTHER}', '{I2}', 'other inst batch', null, null, false);
insert into public.batches (id, institute_id, name, is_active) values ('{B_OLD}', '{I1}', 'old', false);
insert into public.institute_members (id, institute_id, user_id, role, department_id) values
  ('{M_PROCTOR}', '{I1}', '{PROCTOR}', 'teacher', '{D10}');
insert into public.institute_members (institute_id, user_id, role, department_id) values
  ('{I1}', '{HOD}', 'hod', '{D11}'), ('{I1}', '{TEACHER}', 'teacher', '{D11}');
insert into public.proctor_assignments (section_id, teacher_id) values ('{SCI}', '{M_PROCTOR}');
insert into public.teaching_assignments (teacher_id, batch_id) values ('{TEACHER}', '{B_ECO}');
-- pre-existing students: one normal (main + lab), one with a stray cross-institute batch_id
insert into public.students (id, institute_id, name, batch_id, lab_batch_id, department_id, section_id) values
  ('{ST1}', '{I1}', 'Old student', '{B_MAIN}', '{B_LAB}', '{D10}', '{SCI}'),
  ('{ST_STRAY}', '{I1}', 'Stray', '{B_OTHER}', null, null, null);
"""

failures = 0
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def report(name, ok, detail=""):
    global failures
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + str(detail)) if detail and not ok else ''}")


def as_user(cur, uid, role="authenticated"):
    cur.execute("reset role")
    cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid or "",))
    cur.execute(f"set role {role}")


def superuser(cur):
    cur.execute("reset role")
    cur.execute("select set_config('request.jwt.claim.sub', '', false)")


def one(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()[0]


def error_of(cur, sql, args=()):
    try:  # autocommit: a failed statement rolls back only itself
        cur.execute(sql, args)
        return None
    except psycopg.Error as e:
        return e.sqlstate


def apply(cur, name):
    superuser(cur)
    cur.execute((MIG / name).read_text(encoding="utf-8"))


def memberships(cur, student):
    return sorted(r[0] for r in (cur.execute("select batch_id::text from student_batches where student_id = %s", (student,)).fetchall()))


def main():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        srv = pgserver.get_server(tmp, cleanup_mode="stop")
        with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
            cur = conn.cursor()
            cur.execute(BASELINE)

            print("33 apply (twice) + backfill")
            apply(cur, "33_student_batches.sql")
            apply(cur, "33_student_batches.sql")
            superuser(cur)
            report("backfill: main + lab of existing student", memberships(cur, ST1) == sorted([B_MAIN, B_LAB]), memberships(cur, ST1))
            report("backfill: cross-institute batch_id skipped", memberships(cur, ST_STRAY) == [])
            report("agent_ro_read policy on student_batches",
                   one(cur, "select count(*) from pg_policies where tablename = 'student_batches' and policyname = 'agent_ro_read' and roles::text = '{agent_ro}'") == 1)
            report("anon: no table privilege", not one(cur, "select has_table_privilege('anon', 'public.student_batches', 'select')"))
            report("anon: no bulk_add_students", not one(cur, "select has_function_privilege('anon', 'public.bulk_add_students(uuid, jsonb)', 'execute')"))
            report("stu_select unchanged", one(cur, "select count(*) from pg_policies where tablename = 'students' and policyname = 'stu_select'") == 1)

            print("bulk_add_students as admin")
            rows = [
                {"row": 2, "name": "Aman", "department_id": D10, "section_id": SCI, "batch_id": B_MAIN, "lab_batch_id": B_LAB,
                 "batch_ids": [B_MAIN, B_MATHS], "email": "aman@example.com"},
                {"row": 3, "name": "   "},
                {"row": 4, "name": "Wrong dept", "department_id": D10, "batch_id": B_ECO, "batch_ids": [B_ECO]},
                {"row": 5, "name": "Other inst", "batch_id": B_OTHER, "batch_ids": [B_OTHER]},
                {"row": 6, "name": "Bad email", "email": "nope"},
                {"row": 7, "name": "Bad id", "batch_ids": ["not-a-uuid"]},
                {"row": 8, "name": "Inactive", "batch_ids": [B_OLD]},
                {"row": 9, "name": "No-dept batch", "department_id": D11, "batch_ids": [B_NULL]},
                {"row": 10, "name": "Robert'); drop table students;--", "department_id": D11},
            ]
            as_user(cur, ADMIN)
            res = one(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps(rows)))
            by_row = {r["row"]: r for r in res["results"]}
            report("created 3 / failed 6", (res["created"], res["failed"]) == (3, 6), res)
            report("row 3: name required", "name is required" in by_row[3].get("error", ""), by_row[3])
            report("row 4: batch of another department", "another department" in by_row[4].get("error", ""), by_row[4])
            report("row 5: batch of another institute", "not found" in by_row[5].get("error", ""), by_row[5])
            report("row 6: invalid email", "not valid" in by_row[6].get("error", ""), by_row[6])
            report("row 7: invalid uuid", by_row[7].get("error") == "Invalid id in the row", by_row[7])
            report("row 8: inactive batch refused", "inactive" in by_row[8].get("error", ""), by_row[8])
            report("row 9: batch without department allowed", by_row[9]["ok"], by_row[9])
            superuser(cur)
            report("SQL-looking name stored as text", one(cur, "select count(*) from students where name like 'Robert%%'") == 1)
            report("failed rows left nothing behind",
                   one(cur, "select count(*) from students where name in ('Wrong dept','Other inst','Bad email','Bad id','Inactive')") == 0)
            aman = by_row[2]["student_id"]
            report("Aman: main + lab + extra batch", memberships(cur, aman) == sorted([B_MAIN, B_LAB, B_MATHS]), memberships(cur, aman))
            report("assigned_by = admin", one(cur, "select bool_and(assigned_by = %s) from student_batches where student_id = %s", (ADMIN, aman)))

            print("bulk_add_students refusals")
            as_user(cur, ADMIN2)
            report("admin of another institute refused", error_of(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps(rows[:1]))) == "42501")
            as_user(cur, TEACHER)
            report("teacher refused", error_of(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps(rows[:1]))) == "42501")
            as_user(cur, HOD)
            report("HOD refused (admin only)", error_of(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps(rows[:1]))) == "42501")
            as_user(cur, ADMIN)
            report("501 rows refused", error_of(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps([{"name": "x"}] * 501))) == "22023")
            report("not an array refused", error_of(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, '{"name":"x"}')) == "22023")

            print("RLS on student_batches + extra-batch visibility")
            as_user(cur, TEACHER)
            report("teacher of ECO can't see Aman yet", one(cur, "select count(*) from students where id = %s", (aman,)) == 0)
            as_user(cur, ADMIN)
            cur.execute("insert into student_batches (student_id, batch_id, assigned_by) values (%s, %s, %s)", (aman, B_ECO, TEACHER))
            report("assigned_by can't be spoofed", one(cur, "select assigned_by::text from student_batches where student_id = %s and batch_id = %s", (aman, B_ECO)) == ADMIN)
            as_user(cur, TEACHER)
            report("teacher of extra batch sees Aman", one(cur, "select count(*) from students where id = %s", (aman,)) == 1)
            report("a4_can_view_student true for extra batch", one(cur, "select public.a4_can_view_student(%s)", (aman,)))
            report("teacher sees only the ECO membership row (batch scope)",
                   [r[0] for r in cur.execute("select batch_id::text from student_batches where student_id = %s", (aman,)).fetchall()] == [B_ECO])
            report("teacher can't insert", error_of(cur, "insert into student_batches (student_id, batch_id) values (%s, %s)", (aman, B_NULL)) == "42501")
            cur.execute("delete from student_batches where student_id = %s", (aman,))
            report("teacher delete affects 0 rows", cur.rowcount == 0)
            as_user(cur, PROCTOR)
            report("proctor of section sees all of Aman's memberships", len(memberships(cur, aman)) == 4, memberships(cur, aman))
            report("proctor can't delete", (cur.execute("delete from student_batches where student_id = %s", (aman,)), cur.rowcount)[1] == 0)
            as_user(cur, HOD)
            report("HOD (D11) sees the ECO membership", B_ECO in memberships(cur, aman))
            report("HOD can't insert", error_of(cur, "insert into student_batches (student_id, batch_id) values (%s, %s)", (aman, B_ECO)) is not None)
            as_user(cur, ADMIN2)
            report("other institute admin sees nothing", one(cur, "select count(*) from student_batches") == 0)
            report("cross-institute link refused by guard",
                   error_of(cur, "insert into student_batches (student_id, batch_id) values (%s, %s)", (aman, B_OTHER)) == "23514")
            as_user(cur, None, "anon")
            report("anon select denied", error_of(cur, "select * from student_batches") == "42501")

            print("sync trigger")
            as_user(cur, ADMIN)
            cur.execute("update students set batch_id = %s where id = %s", (B_MATHS, aman))
            report("main batch moved: old main row removed", memberships(cur, aman) == sorted([B_LAB, B_MATHS, B_ECO]), memberships(cur, aman))
            cur.execute("update students set lab_batch_id = null where id = %s", (aman,))
            report("lab cleared: lab row removed", memberships(cur, aman) == sorted([B_MATHS, B_ECO]), memberships(cur, aman))
            cur.execute("update students set name = 'Aman K' where id = %s", (aman,))
            report("unrelated update keeps rows", memberships(cur, aman) == sorted([B_MATHS, B_ECO]))
            hod_student = one(cur, "insert into students (institute_id, name, department_id) values (%s, 'Dept11 kid', %s) returning id::text", (I1, D11))
            as_user(cur, HOD)
            cur.execute("update students set batch_id = %s where id = %s", (B_ECO, hod_student))
            report("HOD sets batch_id → mirrored (no direct write right needed)", memberships(cur, hod_student) == [B_ECO])
            superuser(cur)
            cur.execute("update students set name = 'Stray 2' where id = %s", (ST_STRAY,))
            report("stray cross-institute student still updatable", memberships(cur, ST_STRAY) == [])
            cur.execute("delete from students where id = %s", (aman,))
            report("student delete cascades", one(cur, "select count(*) from student_batches where student_id = %s", (aman,)) == 0)

            print("set_student_batches")
            as_user(cur, ADMIN)
            res = one(cur, "select public.bulk_add_students(%s, %s::jsonb)", (I1, json.dumps([
                {"row": 2, "name": "Manual", "department_id": D10, "section_id": SCI, "batch_id": B_MAIN,
                 "lab_batch_id": B_LAB, "batch_ids": [B_MAIN, B_MATHS]}])))
            m = res["results"][0]["student_id"]
            call = "select public.set_student_batches(%s::uuid[], %s::uuid[], %s::uuid[])"
            as_user(cur, TEACHER)
            report("teacher refused", error_of(cur, call, ([m], [B_NULL], [])) == "42501")
            as_user(cur, ADMIN2)
            report("other institute admin refused", error_of(cur, call, ([m], [B_NULL], [])) == "42501")
            as_user(cur, ADMIN)
            out = one(cur, call, ([m], [B_NULL], [B_MAIN]))
            report("add olympiad + remove main", memberships(cur, m) == sorted([B_LAB, B_MATHS, B_NULL]), (out, memberships(cur, m)))
            report("main batch moved to the oldest remaining (maths 10)", one(cur, "select batch_id::text from students where id = %s", (m,)) == B_MATHS)
            one(cur, call, ([m], [], [B_LAB]))
            report("lab removed → lab_batch_id cleared",
                   one(cur, "select lab_batch_id is null from students where id = %s", (m,)) and B_LAB not in memberships(cur, m))
            one(cur, call, ([m], [B_LAB], []))
            report("lab added back → lab_batch_id set", one(cur, "select lab_batch_id::text from students where id = %s", (m,)) == B_LAB)
            one(cur, call, ([m], [], [B_MATHS, B_NULL]))
            report("all main batches removed → batch_id null, student kept",
                   one(cur, "select batch_id is null from students where id = %s", (m,)) and memberships(cur, m) == [B_LAB])
            report("same batch added and removed refused", error_of(cur, call, ([m], [B_NULL], [B_NULL])) == "22023")
            report("other institute batch refused", error_of(cur, call, ([m], [B_OTHER], [])) == "22023")
            report("inactive batch refused", error_of(cur, call, ([m], [B_OLD], [])) == "22023")
            report("nothing to do refused", error_of(cur, call, ([m], [], [])) == "22023")
            superuser(cur)
            i2_student = one(cur, "insert into students (institute_id, name) values (%s, 'I2 kid') returning id::text", (I2,))
            as_user(cur, ADMIN)
            report("students of two institutes refused", error_of(cur, call, ([m, i2_student], [B_NULL], [])) == "42501")
            report("unknown student refused", error_of(cur, call, ([m, "99999999-0000-4000-8000-000000000000"], [B_NULL], [])) == "42501")
            out = one(cur, call, ([m, ST1], [B_NULL], []))
            report("many students at once", out["added"] == 2 and B_NULL in memberships(cur, ST1), out)

            print("rollback, then 33 again")
            apply(cur, "33_student_batches_rollback.sql")
            report("table gone", one(cur, "select to_regclass('public.student_batches') is null"))
            report("extra policy gone", one(cur, "select count(*) from pg_policies where policyname = 'stu_select_batch_member'") == 0)
            report("bulk_add_students gone", one(cur, "select count(*) from pg_proc where proname = 'bulk_add_students'") == 0)
            report("students.batch_id untouched", one(cur, "select batch_id::text from students where id = %s", (ST1,)) == B_MAIN)
            apply(cur, "33_student_batches.sql")
            report("re-apply backfills again", memberships(cur, ST1) == sorted([B_MAIN, B_LAB]))

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
