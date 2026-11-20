"""Local check for 34_roster_from_student_batches.sql (+ rollback) on a throw-away Postgres 16 (never live).

    <pgtest venv>/Scripts/python supabase/tests/34_roster_test.py

Baseline = 33's baseline (33_student_batches_test.py) + attendance tables and att_* helpers copied from live
(20 Nov 2026, read-only dump). The PRE-34 function bodies come from 34's rollback file (= live verbatim), so the
"before" checks reproduce the live bug, then 34 is applied, then rolled back, then applied again.
"""
import importlib.util
import json
import pathlib
import sys
import tempfile

import pgserver
import psycopg

HERE = pathlib.Path(__file__).resolve().parent
MIG = HERE.parent / "migrations"
_spec = importlib.util.spec_from_file_location("t33", HERE / "33_student_batches_test.py")
t33 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(t33)

I1, D10, SCI = t33.I1, t33.D10, t33.SCI
ADMIN, TEACHER33, PROCTOR = t33.ADMIN, t33.TEACHER, t33.PROCTOR
B_SCI, B_LAB, B_MATHS = t33.B_MAIN, t33.B_LAB, t33.B_MATHS   # "science" (section SCI), "science A" lab, "maths 10"
ST_OLD = t33.ST1                                               # main science + lab science A
T_SCI, T_MATH, GHOST = (f"{i}{i}{i}{i}{i}{i}{i}{i}-0000-4000-8000-00000000000{i}" for i in (6, 7, 8))
SUB_SCI, SUB_MATH = "5b000000-0000-4000-8000-000000000001", "5b000000-0000-4000-8000-000000000002"
AMAN, PRIYA, RAVI = (f"5a000000-0000-4000-8000-00000000000{i}" for i in (1, 2, 3))

ATTENDANCE = f"""
alter table auth.users add column email text, add column raw_user_meta_data jsonb default '{{}}'::jsonb;
alter table public.institute_members add column user_name text;
create table public.subjects (id uuid primary key, institute_id uuid not null, department_id uuid, name text not null,
  code text not null, is_active boolean default true);
alter table public.teaching_assignments add column institute_id uuid, add column subject_id uuid, add column created_at timestamptz default now();
alter table public.timetable_slots add column institute_id uuid, add column subject_id uuid, add column day_of_week smallint,
  add column start_time time, add column end_time time, add column room text;
create table public.class_sessions (id uuid primary key default gen_random_uuid(), institute_id uuid not null,
  timetable_slot_id uuid, batch_id uuid not null, subject_id uuid not null, teacher_id uuid not null, session_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled','conducted','cancelled')), topic text,
  marked_by uuid, marked_at timestamptz, created_at timestamptz default now(), unique (timetable_slot_id, session_date));
create table public.attendance_records (id uuid primary key default gen_random_uuid(), institute_id uuid not null,
  session_id uuid not null, student_id uuid not null, status text not null check (status in ('present','absent','late','leave')),
  marked_by uuid not null, marked_at timestamptz not null default now(), unique (session_id, student_id));
create table public.attendance_edit_log (id uuid primary key default gen_random_uuid(), institute_id uuid not null,
  session_id uuid not null, student_id uuid not null, old_status text not null, new_status text not null,
  edited_by uuid not null, edited_at timestamptz not null default now(), reason text);

-- live helpers (20 Nov 2026)
-- live: (now() at time zone 'Asia/Kolkata')::date — pgserver ships without tz data, so the same +05:30 offset:
create function public.att_today_ist() returns date language sql stable as $$ select (now() at time zone interval '+05:30')::date; $$;
create function public.att_edit_window_days(p_kind text) returns integer language sql immutable as $$
  select case p_kind when 'teacher' then 2 when 'proctor' then 7 else null end; $$;
create function public.att_user_name(p_uid uuid) returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce((select nullif(trim(im.user_name), '') from institute_members im where im.user_id = p_uid
    and nullif(trim(im.user_name), '') is not null limit 1),
    (select coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
       from auth.users u where u.id = p_uid), '—'); $$;
create function public.att_caller_role(p_institute_id uuid) returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from institutes where id = p_institute_id and owner_id = auth.uid()) then 'admin'
    when exists (select 1 from institute_members where institute_id = p_institute_id and user_id = auth.uid() and status = 'active' and role = 'admin') then 'admin'
    when exists (select 1 from institute_members where institute_id = p_institute_id and user_id = auth.uid() and status = 'active' and role = 'hod') then 'hod'
    when exists (select 1 from institute_members where institute_id = p_institute_id and user_id = auth.uid() and status = 'active') then 'teacher'
    else null end; $$;
create function public.att_is_section_proctor(p_section_id uuid) returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from proctor_assignments pa join institute_members im on im.id = pa.teacher_id
                  where pa.section_id = p_section_id and pa.is_active and im.user_id = auth.uid() and im.status = 'active')
      or exists (select 1 from batches b where b.section_id = p_section_id and b.proctor_id = auth.uid()); $$;
create function public.att_can_view_section(p_section_id uuid) returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_inst uuid; v_dept uuid; v_role text;
begin
  select b.institute_id, b.department_id into v_inst, v_dept from batches b where b.section_id = p_section_id limit 1;
  if v_inst is null then return false; end if;
  v_role := att_caller_role(v_inst);
  if v_role = 'admin' then return true; end if;
  if v_role = 'hod' and exists (select 1 from institute_members where user_id = auth.uid() and role = 'hod'
       and status = 'active' and department_id = v_dept) then return true; end if;
  return exists (select 1 from proctor_assignments pa join institute_members im on im.id = pa.teacher_id
      where pa.section_id = p_section_id and pa.is_active and im.user_id = auth.uid())
    or exists (select 1 from batches where section_id = p_section_id and proctor_id = auth.uid());
end $$;
create function public.generate_daily_sessions(p_institute_id uuid, p_date date default current_date) returns integer
  language sql security definer as $$ select 0 $$;   -- not under test
create function public.fn_attendance_audit() returns trigger language plpgsql security definer as $$
begin
  if old.status <> new.status then
    insert into attendance_edit_log (institute_id, session_id, student_id, old_status, new_status, edited_by, edited_at, reason)
    values (new.institute_id, new.session_id, new.student_id, old.status, new.status, auth.uid(), now(), null);
  end if;
  return new;
end $$;
create trigger trg_attendance_audit after update on public.attendance_records for each row execute function fn_attendance_audit();

grant all on all tables in schema public to anon, authenticated, service_role;
"""

SEED = f"""
insert into auth.users (id) values ('{T_SCI}'), ('{T_MATH}'), ('{GHOST}');
insert into public.institute_members (institute_id, user_id, role, user_name) values
  ('{I1}', '{T_SCI}', 'teacher', 'Tarun'), ('{I1}', '{T_MATH}', 'teacher', 'Meena');
insert into public.subjects values ('{SUB_SCI}', '{I1}', '{D10}', 'Science', 'SCI', true), ('{SUB_MATH}', '{I1}', '{D10}', 'Maths', 'MTH', true);
insert into public.teaching_assignments (teacher_id, batch_id, institute_id, subject_id) values
  ('{T_SCI}', '{B_SCI}', '{I1}', '{SUB_SCI}'), ('{T_MATH}', '{B_MATHS}', '{I1}', '{SUB_MATH}'),
  ('{GHOST}', '{B_MATHS}', '{I1}', '{SUB_MATH}');                       -- not a member (like live's 75c14404…)
insert into public.students (id, institute_id, name, roll_no, department_id, batch_id) values
  ('{AMAN}', '{I1}', 'Aman', '1', '{D10}', '{B_MATHS}'),   -- main maths, EXTRA science (student_batches)
  ('{PRIYA}', '{I1}', 'Priya', '2', '{D10}', '{B_SCI}'),
  ('{RAVI}', '{I1}', 'Ravi', '3', '{D10}', '{B_MATHS}');
insert into public.student_batches (student_id, batch_id) values ('{AMAN}', '{B_SCI}');
"""

failures = 0
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
report, as_user, superuser, one, error_of, apply = t33.report, t33.as_user, t33.superuser, t33.one, t33.error_of, t33.apply


def check(name, ok, detail=""):
    report(name, ok, detail)


def roster(cur, batch, subject, date="today"):
    d = one(cur, "select public.att_today_ist()::text") if date == "today" else date
    cur.execute("select student_id::text, status from public.get_class_roster(%s, %s, %s::date)", (batch, subject, d))
    return cur.fetchall()


def save(cur, batch, subject, marks, date=None):
    d = date or one(cur, "select public.att_today_ist()::text")
    return one(cur, "select public.save_class_attendance(%s, %s, %s, %s::date, null, null, %s::jsonb)",
               (I1, batch, subject, d, json.dumps([{"student_id": s, "status": st} for s, st in marks])))


def main():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        srv = pgserver.get_server(tmp, cleanup_mode="stop")
        with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
            cur = conn.cursor()
            cur.execute(t33.BASELINE)
            cur.execute(ATTENDANCE)
            apply(cur, "33_student_batches.sql")
            apply(cur, "34_roster_from_student_batches_rollback.sql")   # = live bodies before 34
            superuser(cur)
            cur.execute(SEED)

            print("before 34 (live today)")
            as_user(cur, T_SCI)
            ids = [r[0] for r in roster(cur, B_SCI, SUB_SCI)]
            check("bug reproduced: extra-batch student missing from roster", AMAN not in ids and PRIYA in ids, ids)
            as_user(cur, GHOST)
            check("bug reproduced: non-member with an old assignment sees students",
                  one(cur, "select count(*) from students where id = %s", (RAVI,)) == 1)

            print("34 apply (twice)")
            apply(cur, "34_roster_from_student_batches.sql")
            apply(cur, "34_roster_from_student_batches.sql")
            superuser(cur)
            check("helper not callable by anon / authenticated",
                  not one(cur, "select has_function_privilege('anon', 'public.a4_batch_student_ids(uuid)', 'execute')")
                  and not one(cur, "select has_function_privilege('authenticated', 'public.a4_batch_student_ids(uuid)', 'execute')"))

            print("roster")
            as_user(cur, T_SCI)
            ids = [r[0] for r in roster(cur, B_SCI, SUB_SCI)]
            check("science roster: main + extra-batch students", sorted(ids) == sorted([ST_OLD, AMAN, PRIYA]), ids)
            check("no duplicates (batch_id + student_batches)", len(ids) == len(set(ids)))
            as_user(cur, T_MATH)
            ids = [r[0] for r in roster(cur, B_MATHS, SUB_MATH)]
            check("Aman also on the maths roster", sorted(ids) == sorted([AMAN, RAVI]), ids)
            as_user(cur, ADMIN)
            check("lab batch roster from lab_batch_id", [r[0] for r in roster(cur, B_LAB, SUB_SCI)] == [ST_OLD])

            print("save + security")
            as_user(cur, T_SCI)
            sid = save(cur, B_SCI, SUB_SCI, [(AMAN, "absent"), (PRIYA, "present"), (RAVI, "present")])
            superuser(cur)
            marked = dict(cur.execute("select student_id::text, status from attendance_records where session_id = %s", (sid,)).fetchall())
            check("extra-batch student saved", marked.get(AMAN) == "absent", marked)
            check("student of another batch ignored", RAVI not in marked, marked)
            as_user(cur, T_SCI)
            save(cur, B_SCI, SUB_SCI, [(AMAN, "present")])
            superuser(cur)
            check("change is audited (trg_attendance_audit)",
                  one(cur, "select count(*) from attendance_edit_log where student_id = %s and old_status = 'absent' and new_status = 'present'", (AMAN,)) == 1)
            as_user(cur, T_SCI)
            old = one(cur, "select (public.att_today_ist() - 3)::text")
            check("teacher edit window still 2 days", error_of(cur, "select public.save_class_attendance(%s, %s, %s, %s::date, null, null, '[]'::jsonb)",
                                                                (I1, B_SCI, SUB_SCI, old)) is not None)
            as_user(cur, T_MATH)
            check("other teacher: roster denied", error_of(cur, "select * from public.get_class_roster(%s, %s, current_date)", (B_SCI, SUB_SCI)) is not None)
            check("other teacher: save denied", error_of(cur, "select public.save_class_attendance(%s, %s, %s, current_date, null, null, '[]'::jsonb)",
                                                         (I1, B_SCI, SUB_SCI)) is not None)
            check("other teacher can't read science-only student", one(cur, "select count(*) from students where id = %s", (PRIYA,)) == 0)
            as_user(cur, None, "anon")
            check("anon: roster denied", error_of(cur, "select * from public.get_class_roster(%s, %s, current_date)", (B_SCI, SUB_SCI)) is not None)
            check("anon: save denied", error_of(cur, "select public.save_class_attendance(%s, %s, %s, current_date, null, null, '[]'::jsonb)",
                                                (I1, B_SCI, SUB_SCI)) is not None)

            print("class lists + monthly")
            as_user(cur, T_SCI)
            cur.execute("select batch_id::text, student_count from public.get_my_teaching_targets(%s)", (I1,))
            counts = dict(cur.fetchall())
            check("teaching targets: science count = 3", counts.get(B_SCI) == 3, counts)
            m, y = one(cur, "select extract(month from att_today_ist())::int"), one(cur, "select extract(year from att_today_ist())::int")
            cur.execute("select student_id::text, total_present from public.get_monthly_attendance(%s, %s, %s, %s)", (B_SCI, m, y, SUB_SCI))
            monthly = dict(cur.fetchall())
            check("monthly sheet includes Aman (1 present)", monthly.get(AMAN) == 1, monthly)

            print("teaching scope only while a member")
            as_user(cur, GHOST)
            check("non-member: no teaching batches", one(cur, "select count(*) from public.a4_my_teaching_batch_ids()") == 0)
            check("non-member: students hidden", one(cur, "select count(*) from students where id = %s", (RAVI,)) == 0)
            as_user(cur, T_MATH)
            check("member keeps its batch", one(cur, "select array_agg(x)::text from public.a4_my_teaching_batch_ids() x") == "{" + B_MATHS + "}")
            superuser(cur)
            cur.execute("update institute_members set status = 'inactive' where user_id = %s", (T_MATH,))
            as_user(cur, T_MATH)
            check("removed (inactive) teacher loses the batch", one(cur, "select count(*) from public.a4_my_teaching_batch_ids()") == 0)
            superuser(cur)
            cur.execute("update institute_members set status = 'active' where user_id = %s", (T_MATH,))

            print("rollback, then 34 again")
            apply(cur, "34_roster_from_student_batches_rollback.sql")
            as_user(cur, T_SCI)
            check("rollback: roster back to batch_id only", AMAN not in [r[0] for r in roster(cur, B_SCI, SUB_SCI)])
            superuser(cur)
            check("rollback: helper dropped", one(cur, "select count(*) from pg_proc where proname = 'a4_batch_student_ids'") == 0)
            apply(cur, "34_roster_from_student_batches.sql")
            as_user(cur, T_SCI)
            check("re-apply: Aman back", AMAN in [r[0] for r in roster(cur, B_SCI, SUB_SCI)])

    print(f"\n{'ALL PASS' if t33.failures == 0 else f'{t33.failures} FAILED'}")
    sys.exit(1 if t33.failures else 0)


if __name__ == "__main__":
    main()
