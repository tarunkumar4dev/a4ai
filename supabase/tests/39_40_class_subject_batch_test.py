"""Local check for 39_class_subject_batch.sql + 40_teaching_assignment_integrity.sql (+ rollbacks) on a throw-away
Postgres 16 (pgserver, never live).

    python supabase/tests/39_40_class_subject_batch_test.py

Baseline = 33's + 34's baseline (the same local copy of live) + the live teaching_assignments / subjects shape
(NOT NULL subject_id, unique keys, RLS policies ta_*/hod_*, is_institute_admin / is_dept_hod) read-only from live on 22 Nov 2026.
34 is applied first, so the attendance RPCs under test are the real ones. Checked as real roles (SET ROLE + jwt claim).
"""
import importlib.util
import json
import pathlib
import sys
import tempfile

import pgserver
import psycopg

HERE = pathlib.Path(__file__).resolve().parent


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


t33 = _load("t33", "33_student_batches_test.py")
t34 = _load("t34", "34_roster_test.py")
report, as_user, superuser, one, error_of, apply = t33.report, t33.as_user, t33.superuser, t33.one, t33.error_of, t33.apply
I1, I2, D10, D11 = t33.I1, t33.I2, t33.D10, t33.D11
ADMIN, ADMIN2, HOD = t33.ADMIN, t33.ADMIN2, t33.HOD
B_ECO, B_MATHS, B_NULL, B_OTHER, B_OLD = t33.B_ECO, t33.B_MATHS, t33.B_NULL, t33.B_OTHER, t33.B_OLD

T_ECO, T_ACC, T_BOTH, GHOST, T_SOLO = (f"{i}{i}{i}{i}{i}{i}{i}{i}-0000-4000-8000-00000000000{i}" for i in (6, 7, 8, 9, 0))
SUB_ECO, SUB_ACC, SUB_MATH, SUB_OTHER = (f"5b000000-0000-4000-8000-00000000010{i}" for i in (1, 2, 3, 4))
B_ACC = "b1000000-0000-4000-8000-000000000001"     # a second batch of Accounts (many batches per subject)
B_NOSUB = "b1000000-0000-4000-8000-000000000002"   # legacy: no subject
STU = "51000000-0000-4000-8000-0000000000a1"

EXTRA = f"""
-- live teaching_assignments / subjects shape (22 Nov 2026)
delete from public.teaching_assignments where subject_id is null;   -- 33's seed row has no subject (live: NOT NULL)
alter table public.teaching_assignments alter column institute_id set not null;
alter table public.teaching_assignments alter column subject_id set not null;
alter table public.teaching_assignments add constraint ta_subject_fk foreign key (subject_id) references public.subjects(id) on delete cascade;
alter table public.teaching_assignments add constraint ta_uniq unique (batch_id, subject_id, teacher_id);
alter table public.subjects add constraint subj_uniq unique (institute_id, code);
alter table public.institute_members add column if not exists user_name text;
alter table public.batches add column if not exists subject text;   -- live: free-text label

create function public.is_institute_admin(inst_id uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from institute_members where institute_id = inst_id and user_id = auth.uid() and role = 'admin' and status = 'active'); $$;
create function public.is_institute_member(inst_id uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from institute_members where institute_id = inst_id and user_id = auth.uid() and status = 'active'); $$;
create function public.is_dept_hod(p_dept uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from institute_members where user_id = auth.uid() and role = 'hod' and status = 'active' and department_id = p_dept); $$;

alter table public.teaching_assignments enable row level security;
create policy ta_insert on public.teaching_assignments for insert to public with check (is_institute_admin(institute_id));
create policy hod_insert on public.teaching_assignments for insert to public
  with check (exists (select 1 from batches b where b.id = teaching_assignments.batch_id and is_dept_hod(b.department_id)));
create policy ta_update on public.teaching_assignments for update to public using (is_institute_admin(institute_id));
create policy ta_delete on public.teaching_assignments for delete to public using (is_institute_admin(institute_id));
create policy ta_select_scoped on public.teaching_assignments for select to authenticated
  using (teacher_id = auth.uid() or batch_id in (select a4_my_visible_batch_ids()));
create policy ta_hod_delete on public.teaching_assignments for delete to public
  using (exists (select 1 from batches b where b.id = teaching_assignments.batch_id and is_dept_hod(b.department_id)));

alter table public.subjects enable row level security;
create policy subj_all on public.subjects for all to authenticated using (true) with check (is_institute_admin(institute_id));

grant all on all tables in schema public to anon, authenticated, service_role;
"""

SEED = f"""
insert into auth.users (id) values ('{T_ECO}'), ('{T_ACC}'), ('{T_BOTH}'), ('{GHOST}'), ('{T_SOLO}');
insert into public.institute_members (institute_id, user_id, role, status) values
  ('{I1}', '{ADMIN}', 'admin', 'active'), ('{I2}', '{ADMIN2}', 'admin', 'active'),
  ('{I1}', '{T_ECO}', 'teacher', 'active'), ('{I1}', '{T_ACC}', 'teacher', 'active'),
  ('{I1}', '{T_BOTH}', 'teacher', 'active'), ('{I2}', '{T_BOTH}', 'teacher', 'active'),   -- teaches in two institutes
  ('{I1}', '{GHOST}', 'teacher', 'inactive'),
  ('{I2}', '{T_SOLO}', 'teacher', 'active');
insert into public.subjects (id, institute_id, department_id, name, code) values
  ('{SUB_ECO}', '{I1}', '{D11}', 'Economics', 'ECO'), ('{SUB_ACC}', '{I1}', '{D11}', 'Accounts', 'ACC'),
  ('{SUB_MATH}', '{I1}', '{D10}', 'Maths', 'MTH'), ('{SUB_OTHER}', '{I2}', null, 'Other inst subject', 'OTH');
insert into public.batches (id, institute_id, name, department_id, subject) values
  ('{B_ACC}', '{I1}', 'Accounts Batch B', null, 'Acc text'), ('{B_NOSUB}', '{I1}', 'Legacy no subject', '{D10}', 'Physics');
insert into public.students (id, institute_id, name, roll_no, department_id, batch_id) values ('{STU}', '{I1}', 'Stu', '1', '{D11}', '{B_ECO}');
-- legacy rows written BEFORE 40: a normal one, a ghost (teacher is not a member), one on a subject-less batch
insert into public.teaching_assignments (institute_id, teacher_id, batch_id, subject_id) values
  ('{I1}', '{T_ACC}', '{B_NOSUB}', '{SUB_MATH}'),
  ('{I1}', '{GHOST}', '{B_MATHS}', '{SUB_MATH}');
"""

check = report
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def ta_insert(cur, teacher, batch, subject=None, inst=I1):
    """What a client does: insert (institute, teacher, batch[, subject]). Returns the sqlstate or None."""
    if subject:
        return error_of(cur, "insert into public.teaching_assignments (institute_id, teacher_id, batch_id, subject_id) values (%s,%s,%s,%s)",
                        (inst, teacher, batch, subject))
    return error_of(cur, "insert into public.teaching_assignments (institute_id, teacher_id, batch_id) values (%s,%s,%s)",
                    (inst, teacher, batch))


def ta_subject(cur, teacher, batch):
    cur.execute("select subject_id::text from public.teaching_assignments where teacher_id = %s and batch_id = %s", (teacher, batch))
    return sorted(r[0] for r in cur.fetchall())


def main():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        srv = pgserver.get_server(tmp, cleanup_mode="stop")
        with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
            cur = conn.cursor()
            cur.execute(t33.BASELINE)
            cur.execute(t34.ATTENDANCE)
            apply(cur, "33_student_batches.sql")
            apply(cur, "34_roster_from_student_batches.sql")
            superuser(cur)
            cur.execute(EXTRA)
            cur.execute(SEED)

            print("before 39/40 (live today)")
            as_user(cur, ADMIN)
            err = ta_insert(cur, T_ECO, B_OTHER, SUB_ECO)    # admin of I1, batch of I2
            check("gap reproduced: admin of I1 can link a teacher to a batch of institute I2", err is None, err)
            superuser(cur)
            cur.execute("delete from public.teaching_assignments where batch_id = %s", (B_OTHER,))
            as_user(cur, ADMIN)
            err = ta_insert(cur, GHOST, B_ECO, SUB_ECO)
            check("gap reproduced: a non-member can be assigned", err is None, err)
            superuser(cur)
            cur.execute("delete from public.teaching_assignments where batch_id = %s and teacher_id = %s", (B_ECO, GHOST))

            print("39 apply (twice)")
            apply(cur, "39_class_subject_batch.sql")
            apply(cur, "39_class_subject_batch.sql")
            check("hierarchy_mode defaults to 'simple' for existing institutes",
                  one(cur, "select count(*) from institutes where hierarchy_mode = 'simple'") == 2)
            check("hierarchy_mode accepts only simple/full", error_of(cur, "update institutes set hierarchy_mode = 'weird'") is not None)
            check("batches.subject_id is nullable and empty (legacy rows valid)",
                  one(cur, "select count(*) from batches where subject_id is not null") == 0
                  and one(cur, "select is_nullable from information_schema.columns where table_name='batches' and column_name='subject_id'") == "YES")
            check("trigger functions are not callable by the API roles",
                  not one(cur, "select has_function_privilege('authenticated', 'public.a4_batch_sync_subject()', 'execute')"))

            print("batch ↔ subject")
            cur.execute("update batches set subject_id = %s where id = %s", (SUB_ACC, B_ACC))
            row = cur.execute("select department_id::text, subject from batches where id = %s", (B_ACC,)).fetchone()
            check("batch takes the subject's class and name", row == (D11, "Accounts"), row)
            cur.execute("update batches set department_id = %s where id = %s", (D10, B_ACC))
            check("class can't be overridden by hand while a subject is set",
                  one(cur, "select department_id::text from batches where id = %s", (B_ACC,)) == D11)
            cur.execute("update batches set subject_id = %s where id = %s", (SUB_ECO, B_ECO))
            cur.execute("insert into batches (id, institute_id, name, subject_id) values ('b1000000-0000-4000-8000-000000000003', %s, 'Eco Batch B', %s)", (I1, SUB_ECO))
            check("insert with only subject_id: class derived",
                  one(cur, "select department_id::text from batches where name = 'Eco Batch B'") == D11)
            check("2 batches under Economics", one(cur, "select count(*) from batches where subject_id = %s", (SUB_ECO,)) == 2)
            check("subject of another institute rejected on a batch",
                  error_of(cur, "update batches set subject_id = %s where id = %s", (SUB_OTHER, B_MATHS)) is not None)
            cur.execute("update subjects set name = 'Eco (renamed)' where id = %s", (SUB_ECO,))
            check("renaming a subject re-syncs its batches' text",
                  one(cur, "select count(*) from batches where subject_id = %s and subject = 'Eco (renamed)'", (SUB_ECO,)) == 2)
            cur.execute("update subjects set name = 'Economics' where id = %s", (SUB_ECO,))
            cur.execute("update subjects set department_id = %s where id = %s", (D10, SUB_ECO))
            check("moving a subject to another class moves its batches",
                  one(cur, "select count(*) from batches where subject_id = %s and department_id = %s", (SUB_ECO, D10)) == 2)
            cur.execute("update subjects set department_id = %s where id = %s", (D11, SUB_ECO))
            check("subject with batches can't be deleted",
                  error_of(cur, "delete from subjects where id = %s", (SUB_ECO,)) == "23503")
            check("batch without subject stays legal", one(cur, "select count(*) from batches where id = %s and subject_id is null", (B_NOSUB,)) == 1)
            cur.execute("update batches set name = name where id = %s", (B_NOSUB,))
            check("legacy batch update untouched (class + text kept)",
                  cur.execute("select department_id::text, subject from batches where id = %s", (B_NOSUB,)).fetchone() == (D10, "Physics"))

            print("40 before: without 40 the audit gap is still open, and the old UI path works")
            as_user(cur, ADMIN)
            check("explicit-subject insert still works (old UI) before 40", ta_insert(cur, T_ECO, B_ECO, SUB_ECO) is None)
            superuser(cur)
            cur.execute("delete from public.teaching_assignments where teacher_id = %s", (T_ECO,))

            print("40 apply (twice)")
            apply(cur, "40_teaching_assignment_integrity.sql")
            apply(cur, "40_teaching_assignment_integrity_rollback.sql")
            apply(cur, "40_teaching_assignment_integrity.sql")
            apply(cur, "40_teaching_assignment_integrity.sql")

            print("trigger derives the subject")
            as_user(cur, ADMIN)
            check("insert (teacher, batch) only → subject = batch's subject", ta_insert(cur, T_ECO, B_ECO) is None
                  and ta_subject(cur, T_ECO, B_ECO) == [SUB_ECO], ta_subject(cur, T_ECO, B_ECO))
            err = ta_insert(cur, T_ACC, B_ACC, SUB_ECO)       # client tries to pick another subject
            check("a client-supplied subject is overridden by the batch's", err is None and ta_subject(cur, T_ACC, B_ACC) == [SUB_ACC], ta_subject(cur, T_ACC, B_ACC))
            err = ta_insert(cur, T_BOTH, B_ECO)
            check("2nd teacher on the same batch allowed (co-teaching)", err is None, err)
            check("exact duplicate rejected by the unique key", ta_insert(cur, T_ECO, B_ECO) == "23505")
            superuser(cur)
            cur.execute("update batches set subject_id = null where id = %s", (B_ACC,))   # simulate a batch without a subject
            as_user(cur, ADMIN)
            check("batch without a subject: new TA rejected", ta_insert(cur, T_BOTH, B_ACC) == "23514")
            check("…also when the client passes a subject", ta_insert(cur, T_BOTH, B_NOSUB, SUB_MATH) == "23514")
            superuser(cur)
            cur.execute("update batches set subject_id = %s where id = %s", (SUB_ACC, B_ACC))
            check("legacy row (pre-40, subject-less batch) untouched", ta_subject(cur, T_ACC, B_NOSUB) == [SUB_MATH])
            as_user(cur, ADMIN)
            check("legacy row: is_active toggle still allowed",
                  error_of(cur, "update public.teaching_assignments set is_active = false where teacher_id = %s and batch_id = %s", (T_ACC, B_NOSUB)) is None)
            check("legacy row: changing its subject on a subject-less batch is rejected (new data must go through the batch)",
                  error_of(cur, "update public.teaching_assignments set subject_id = %s where teacher_id = %s and batch_id = %s", (SUB_ACC, T_ACC, B_NOSUB)) == "23514")

            print("same institute for teacher + batch + subject")
            as_user(cur, ADMIN)
            check("batch of another institute rejected", ta_insert(cur, T_ECO, B_OTHER, SUB_ECO) is not None)
            check("teacher of another institute (not a member) rejected", ta_insert(cur, T_SOLO, B_ECO) is not None)
            check("inactive member rejected", ta_insert(cur, GHOST, B_ECO) is not None)
            check("unknown teacher rejected", ta_insert(cur, "99999999-0000-4000-8000-000000000099", B_ECO) is not None)
            superuser(cur)
            check("the owner counts as a teacher of its institute (a4_ta_links_ok, no member row needed)",
                  (cur.execute("delete from institute_members where user_id = %s and institute_id = %s", (ADMIN, I1)),
                   one(cur, "select public.a4_ta_links_ok(%s, %s, %s, %s)", (I1, ADMIN, B_ACC, SUB_ACC)) is True)[-1])
            cur.execute("insert into institute_members (institute_id, user_id, role, status) values (%s, %s, 'admin', 'active')", (I1, ADMIN))
            check("a4_ta_links_ok: subject of another institute → false",
                  one(cur, "select public.a4_ta_links_ok(%s, %s, %s, %s)", (I1, T_ECO, B_ECO, SUB_OTHER)) is False)
            check("a4_ta_links_ok: same institute → true",
                  one(cur, "select public.a4_ta_links_ok(%s, %s, %s, %s)", (I1, T_ECO, B_ECO, SUB_ECO)) is True)
            as_user(cur, ADMIN2)
            check("admin of I2 can't assign in I1 (policy)", ta_insert(cur, T_BOTH, B_ECO, inst=I1) is not None)
            check("admin of I2 + I1's batch under institute I2 (cross-tenant link) rejected", ta_insert(cur, T_BOTH, B_ECO, inst=I2) is not None)
            as_user(cur, T_ECO)
            check("plain teacher can't insert", ta_insert(cur, T_ECO, B_ACC) is not None)
            as_user(cur, None, "anon")
            check("anon can't insert", ta_insert(cur, T_ECO, B_ACC) is not None)

            print("HOD path")
            superuser(cur)
            cur.execute("update batches set department_id = %s, subject_id = %s where id = %s", (D10, SUB_MATH, B_MATHS))
            as_user(cur, HOD)    # HOD of D11
            check("HOD assigns a teacher of the institute on a batch of its class", ta_insert(cur, T_ACC, B_ECO) is None)
            check("HOD can't assign on another class's batch", ta_insert(cur, T_ACC, B_MATHS) is not None)
            check("HOD can't assign a teacher of another institute", ta_insert(cur, T_SOLO, B_ECO) is not None)
            check("HOD can't create a cross-institute row (institute_id of I2 + own batch)", ta_insert(cur, T_BOTH, B_ECO, inst=I2) is not None)

            print("attendance reads the derived row (RPCs unchanged)")
            as_user(cur, T_ECO)
            cur.execute("select student_id::text from public.get_class_roster(%s, %s, current_date)", (B_ECO, SUB_ECO))
            check("teacher assigned by (teacher, batch) only gets the roster for the derived subject", [r[0] for r in cur.fetchall()] == [STU])
            cur.execute("select batch_id::text, subject_id::text from public.get_my_teaching_targets(%s)", (I1,))
            check("teaching targets list (batch, derived subject)", (B_ECO, SUB_ECO) in cur.fetchall())
            sid = one(cur, "select public.save_class_attendance(%s, %s, %s, public.att_today_ist(), null, null, %s::jsonb)",
                      (I1, B_ECO, SUB_ECO, json.dumps([{"student_id": STU, "status": "present"}])))
            check("save_class_attendance works on the derived row", sid is not None)

            print("no orphan rows")
            superuser(cur)
            cur.execute("insert into public.teaching_assignments (institute_id, teacher_id, batch_id) values (%s, %s, %s)", (I2, T_BOTH, B_OTHER)) \
                if False else None
            n_before = one(cur, "select count(*) from teaching_assignments where teacher_id = %s", (T_BOTH,))
            cur.execute("update batches set subject_id = %s where id = %s", (SUB_OTHER, B_OTHER))
            cur.execute("insert into public.teaching_assignments (institute_id, teacher_id, batch_id) values (%s, %s, %s)", (I2, T_BOTH, B_OTHER))
            check("teacher with rows in two institutes", one(cur, "select count(distinct institute_id) from teaching_assignments where teacher_id = %s", (T_BOTH,)) == 2)
            as_user(cur, ADMIN)
            cur.execute("delete from institute_members where user_id = %s and institute_id = %s", (T_BOTH, I1))
            superuser(cur)
            check("removing the member deletes that institute's rows", one(cur, "select count(*) from teaching_assignments where teacher_id = %s and institute_id = %s", (T_BOTH, I1)) == 0)
            check("…and keeps the other institute's rows", one(cur, "select count(*) from teaching_assignments where teacher_id = %s and institute_id = %s", (T_BOTH, I2)) == 1)
            check("after removal the old rows do not come back on re-join",
                  (cur.execute("insert into institute_members (institute_id, user_id, role, status) values (%s, %s, 'teacher', 'active')", (I1, T_BOTH)),
                   one(cur, "select count(*) from teaching_assignments where teacher_id = %s and institute_id = %s", (T_BOTH, I1)) == 0)[-1])
            cur.execute("update institute_members set status = 'inactive' where user_id = %s and institute_id = %s", (T_ACC, I1))
            check("setting a member inactive deletes their rows", one(cur, "select count(*) from teaching_assignments where teacher_id = %s", (T_ACC,)) == 0)
            cur.execute("update institute_members set status = 'active' where user_id = %s and institute_id = %s", (T_ACC, I1))
            check("re-activating does not resurrect anything", one(cur, "select count(*) from teaching_assignments where teacher_id = %s", (T_ACC,)) == 0)
            check("orphans left = only the legacy ghost row written before 40",
                  one(cur, """select count(*) from teaching_assignments t where not exists (select 1 from institute_members m
                              where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active')
                              and not exists (select 1 from institutes i where i.id = t.institute_id and i.owner_id = t.teacher_id)""") == 1)

            print("rollbacks")
            apply(cur, "40_teaching_assignment_integrity_rollback.sql")
            check("40 rollback: triggers + helper gone",
                  one(cur, "select count(*) from pg_trigger where tgname in ('a4_ta_before_write','a4_member_cleanup_ta')") == 0
                  and one(cur, "select count(*) from pg_proc where proname = 'a4_ta_links_ok'") == 0)
            as_user(cur, ADMIN)
            check("40 rollback: old behaviour (explicit subject) back",
                  ta_insert(cur, T_ECO, B_ACC, SUB_ACC) is None)
            superuser(cur)
            apply(cur, "39_class_subject_batch_rollback.sql")
            check("39 rollback: column + flag gone",
                  one(cur, "select count(*) from information_schema.columns where table_name='batches' and column_name='subject_id'") == 0
                  and one(cur, "select count(*) from information_schema.columns where table_name='institutes' and column_name='hierarchy_mode'") == 0)
            apply(cur, "39_class_subject_batch.sql")
            apply(cur, "40_teaching_assignment_integrity.sql")
            check("re-apply 39 + 40 after rollback", one(cur, "select count(*) from pg_trigger where tgname = 'a4_ta_before_write'") == 1)

    print(f"\n{'ALL PASS' if t33.failures == 0 else f'{t33.failures} FAILED'}")
    sys.exit(1 if t33.failures else 0)


if __name__ == "__main__":
    main()
