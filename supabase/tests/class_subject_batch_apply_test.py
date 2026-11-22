"""Dry run of the ONE paste-able file supabase/apply/class_subject_batch_apply.sql on a throw-away Postgres 16 (never live).

    python supabase/tests/class_subject_batch_apply_test.py

A small Education-Beast-like institute is seeded (catch-all "ALL" batch, a batch carrying two subjects, an institute-wide subject,
a teacher whose assignment points to a deleted batch, assignments of removed teachers, and an orphan in ANOTHER institute).
The REAL script plans it (load -> plan -> CSV -> build_apply), then every block of the generated file runs in order:
backup, 39, backfill, VERIFY (every row must be ok), 40 — and finally the commented restore block, un-commented, must put
batches / subjects / teaching_assignments / student_batches back to exactly the backup.
"""
import importlib.util
import pathlib
import re
import sys
import tempfile
import uuid

import pgserver
import psycopg

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


t33 = _load("t33", HERE / "33_student_batches_test.py")
t34 = _load("t34", HERE / "34_roster_test.py")
t39 = _load("t3940", HERE / "39_40_class_subject_batch_test.py")
bf = _load("backfill", ROOT / "scripts" / "class_subject_batch_backfill.py")
report, as_user, superuser, one, error_of = t33.report, t33.as_user, t33.superuser, t33.one, t33.error_of

U = lambda n: f"{n:08x}-0000-4000-8000-{n:012x}"
I3, OWNER = "a3000000-0000-4000-8000-000000000003", t33.ADMIN
C6, C10, C11 = U(0x61), U(0x62), U(0x63)
RAHUL, GHOST1, GHOST2 = U(0x71), U(0x72), U(0x73)
S_ALL, S_MATHS, S_ENG, S_ECO, S_ACC = (U(0x80 + i) for i in range(5))
B_ALL, B_MATHS, B_ECON, B_ACCOUNTS_OLD, B_ACCOUNTS_LIVE, B_OTHER_INST = (U(0x90 + i) for i in range(6))
STUDENTS = [str(uuid.UUID(int=0xA0000000 + i)) for i in range(7)]

SCHEMA_EXTRA = """
alter table public.batches add column if not exists description text, add column if not exists class_level text,
  add column if not exists updated_at timestamptz default now();
alter table public.batches alter column id set default gen_random_uuid();      -- live defaults
alter table public.subjects alter column id set default gen_random_uuid();
"""

SEED = f"""
insert into auth.users (id) values ('{RAHUL}'), ('{GHOST1}'), ('{GHOST2}');
insert into public.institutes (id, name, owner_id) values ('{I3}', 'EB-like', '{OWNER}');
insert into public.departments (id, institute_id, name) values
  ('{C6}', '{I3}', '6th class'), ('{C10}', '{I3}', '10th class'), ('{C11}', '{I3}', '11th - Commerce');
insert into public.institute_members (institute_id, user_id, role, status, user_name) values ('{I3}', '{RAHUL}', 'teacher', 'active', 'Rahul V');
insert into public.subjects (id, institute_id, department_id, name, code) values
  ('{S_ALL}', '{I3}', '{C6}', 'ALL', 'ALL101'), ('{S_MATHS}', '{I3}', '{C10}', 'Maths', 'MATH101'),
  ('{S_ENG}', '{I3}', '{C10}', 'ENGLISH', 'ENGL101'), ('{S_ECO}', '{I3}', null, 'Eco', 'ECO101'), ('{S_ACC}', '{I3}', '{C11}', 'Accounts', 'ACCO101');
insert into public.batches (id, institute_id, name, department_id, class_level, subject, is_active) values
  ('{B_ALL}', '{I3}', 'ALL', '{C6}', '6', 'ALL', true),
  ('{B_MATHS}', '{I3}', 'Mathematics', '{C10}', '10', 'Maths', true),
  ('{B_ECON}', '{I3}', 'ECONOMICS BATCH 11th', null, '11', 'Eco', true),
  ('{B_ACCOUNTS_OLD}', '{I3}', 'ACCOUNTS', '{C11}', '11', 'Accounts', false),
  ('{B_ACCOUNTS_LIVE}', '{I3}', 'Accounts Rahul Sir', '{C11}', '11', 'Accounts', true);
insert into public.students (id, institute_id, name, batch_id, department_id) values
  ('{STUDENTS[0]}', '{I3}', 's0', '{B_ALL}', '{C6}'), ('{STUDENTS[1]}', '{I3}', 's1', '{B_ALL}', '{C6}'),
  ('{STUDENTS[2]}', '{I3}', 's2', '{B_MATHS}', '{C10}'), ('{STUDENTS[3]}', '{I3}', 's3', '{B_MATHS}', '{C10}'), ('{STUDENTS[4]}', '{I3}', 's4', '{B_MATHS}', '{C10}'),
  ('{STUDENTS[5]}', '{I3}', 's5', '{B_ACCOUNTS_LIVE}', '{C11}'), ('{STUDENTS[6]}', '{I3}', 's6', '{B_ACCOUNTS_LIVE}', '{C11}');
-- teaching assignments (written before 40 exists): removed teachers on the Maths batch (two subjects), Rahul on Economics + on a deleted batch
insert into public.teaching_assignments (institute_id, teacher_id, batch_id, subject_id) values
  ('{I3}', '{GHOST1}', '{B_MATHS}', '{S_MATHS}'), ('{I3}', '{GHOST1}', '{B_MATHS}', '{S_ENG}'),
  ('{I3}', '{RAHUL}', '{B_ECON}', '{S_ECO}'), ('{I3}', '{RAHUL}', '{B_ACCOUNTS_OLD}', '{S_ACC}');
-- another institute: an orphan the script must NOT touch
insert into public.teaching_assignments (institute_id, teacher_id, batch_id, subject_id) values
  ('{t33.I1}', '{GHOST2}', '{t33.B_ECO}', '{t39.SUB_ECO}');
"""

BAK = "20261122"


def main():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        srv = pgserver.get_server(tmp, cleanup_mode="stop")
        with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
            cur = conn.cursor()
            cur.execute(t33.BASELINE)
            cur.execute(t34.ATTENDANCE)
            t33.apply(cur, "33_student_batches.sql")
            t33.apply(cur, "34_roster_from_student_batches.sql")
            superuser(cur)
            cur.execute(t39.EXTRA)
            cur.execute(SCHEMA_EXTRA)
            cur.execute(f"insert into public.subjects (id, institute_id, department_id, name, code) values ('{t39.SUB_ECO}', '{t33.I1}', '{t33.D11}', 'Economics', 'ECOI1')")
            cur.execute(SEED)

            # ── plan with the REAL script, reading the local database instead of the linked project
            def pg_query(sql):
                cur.execute(sql)
                cols = [c.name for c in cur.description]
                return [dict(zip(cols, r)) for r in cur.fetchall()]
            bf.query = pg_query
            d = bf.load(I3)
            rows, ta_rows = bf.plan(d)
            csvdir = pathlib.Path(tmp) / "csv"
            csvdir.mkdir()
            bf.write_csv(csvdir / "map.csv", rows)
            bf.write_csv(csvdir / "ta.csv", ta_rows)
            rows, ta_rows = bf.read_csv(csvdir / "map.csv"), bf.read_csv(csvdir / "ta.csv")      # what a human-edited CSV looks like

            print("plan")
            by = {r["batch_name"]: r for r in rows}
            report("ALL batch -> new subject 'All Subjects' in its class", by["ALL"]["action"] == "CREATE" and by["ALL"]["subject_name"] == "All Subjects", by["ALL"])
            report("Mathematics batch is split into Maths + English", by["Mathematics"]["split_batch_names"] == "Mathematics - English", by["Mathematics"]["split_batch_names"])
            report("institute-wide subject Eco moves into the batch's inferred class", by["ECONOMICS BATCH 11th"]["action"] == "ADOPT" and by["ECONOMICS BATCH 11th"]["class_proposed"] == "11th - Commerce")
            tas = {t["batch"]: t for t in ta_rows}
            report("removed teachers' rows -> DELETE (2), only for this institute", sorted(t["proposed_action"] for t in ta_rows).count("DELETE") == 2, ta_rows)
            report("Rahul's row on the deleted batch -> REPOINT to the live batch",
                   tas["ACCOUNTS"]["decision"] == f"REPOINT:{B_ACCOUNTS_LIVE}", tas["ACCOUNTS"]["decision"])
            report("other institute's orphan counted, not deleted", d["orphans_other"] == 1 and all(t["ta_id"] != "" for t in ta_rows))

            text = bf.build_apply(I3, d, rows, ta_rows, ROOT / "supabase" / "migrations", BAK)
            marks = list(re.finditer(r"^-- ═+ \(([a-g])\)", text, re.M))
            report("file has blocks a..g in order", [m.group(1) for m in marks] == list("abcdefg"), [m.group(1) for m in marks])
            part = {m.group(1): text[m.start(): (marks[i + 1].start() if i + 1 < len(marks) else len(text))] for i, m in enumerate(marks)}
            report("every block is commented", all(re.search(r"^-- ═", p, re.M) for p in part.values()))
            report("restore block is fully commented out", all(l.startswith("--") for l in part["g"].splitlines() if l.strip()))
            report("backup goes to a private schema, not public", f"create schema a4_backup_{BAK}" in part["a"] and "revoke all on schema" in part["a"])

            print("run a..d")
            superuser(cur)
            cur.execute(part["a"])
            bak = f"a4_backup_{BAK}"
            report("backup tables copied", one(cur, f"select count(*) from {bak}.batches") == one(cur, "select count(*) from public.batches")
                   and one(cur, f"select count(*) from {bak}.teaching_assignments") == 5)
            refused = error_of(cur, part["a"]) is not None
            cur.execute("rollback")          # the failed block leaves its transaction open (the SQL editor ends the session instead)
            report("a second run of (a) is refused (never overwrites a backup)", refused)
            cur.execute(part["b"])
            cur.execute(part["c"])
            cur.execute(part["d"])

            print("VERIFY (e)")
            vsql = re.search(r"^select name, actual, expected.*?\) as t\(name, actual, expected\);", part["e"], re.S | re.M).group(0)
            cur.execute(vsql)
            for name, actual, expected, ok in cur.fetchall():
                report(f"verify: {name} = {expected}", ok is True, f"actual={actual} expected={expected}")

            print("results of the backfill")
            cur.execute(f"select b.name, s.name, d.name from batches b join subjects s on s.id=b.subject_id join departments d on d.id=s.department_id where b.institute_id='{I3}' and b.is_active order by 1")
            got = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
            report("ALL -> All Subjects (6th class)", got["ALL"] == ("All Subjects", "6th class"), got.get("ALL"))
            report("Maths + English batches under 10th class", got["Mathematics"] == ("Maths", "10th class") and got["Mathematics - English"] == ("ENGLISH", "10th class"), got)
            mem = lambda b: sorted(r[0] for r in cur.execute("select student_id::text from student_batches where batch_id = (select id from batches where name = %s and institute_id = %s and is_active)", (b, I3)).fetchall())
            report("same 3 students in both", mem("Mathematics") == mem("Mathematics - English") == sorted(STUDENTS[2:5]), (mem("Mathematics"), mem("Mathematics - English")))
            report("Eco batch now in 11th - Commerce", got["ECONOMICS BATCH 11th"] == ("Eco", "11th - Commerce"), got["ECONOMICS BATCH 11th"])
            cur.execute(f"select b.name, t.teacher_id::text, s.name from teaching_assignments t join batches b on b.id=t.batch_id join subjects s on s.id=t.subject_id where t.institute_id='{I3}' order by 1")
            report("Rahul teaches Economics batch and 'Accounts Rahul Sir'; removed teachers' rows gone",
                   cur.fetchall() == [("Accounts Rahul Sir", RAHUL, "Accounts"), ("ECONOMICS BATCH 11th", RAHUL, "Eco")])
            report("other institute's orphan row is still there", one(cur, f"select count(*) from teaching_assignments where institute_id = '{t33.I1}'") == 1)

            print("run f (migration 40)")
            cur.execute(part["f"])
            as_user(cur, OWNER)
            superuser(cur)
            cur.execute(f"insert into institute_members (institute_id, user_id, role, status) values ('{I3}', '{OWNER}', 'admin', 'active')")
            as_user(cur, OWNER)
            report("after 40: teacher + batch only; subject filled from the batch",
                   error_of(cur, "insert into teaching_assignments (institute_id, teacher_id, batch_id) select %s, %s, id from batches where name = 'ALL' and institute_id = %s", (I3, RAHUL, I3)) is None
                   and one(cur, "select s.name from teaching_assignments t join subjects s on s.id=t.subject_id join batches b on b.id=t.batch_id where b.name='ALL' and b.institute_id=%s", (I3,)) == "All Subjects")
            superuser(cur)

            print("restore (g), un-commented")
            lines = part["g"].splitlines()
            a0 = lines.index("-- begin;")
            a1 = lines.index("-- commit;", a0)
            restore = "\n".join(re.sub(r"^-- ?", "", l) for l in lines[a0:a1 + 1])
            cur.execute(restore)
            for t in ("batches", "subjects", "teaching_assignments", "student_batches"):
                a = one(cur, f"select count(*) from (select * from {bak}.{t} except select * from public.{t}) x")
                b = one(cur, f"select count(*) from (select * from public.{t} except select * from {bak}.{t}) x")
                report(f"restore: {t} identical to the backup", a == 0 and b == 0, (a, b))
            report("restore: migrations removed (no subject_id, no triggers)",
                   one(cur, "select count(*) from information_schema.columns where table_name='batches' and column_name='subject_id'") == 0
                   and one(cur, "select count(*) from pg_trigger where tgname in ('a4_ta_before_write','a4_member_cleanup_ta','a4_batch_sync_subject')") == 0)

    print(f"\n{'ALL PASS' if t33.failures == 0 else f'{t33.failures} FAILED'}")
    sys.exit(1 if t33.failures else 0)


if __name__ == "__main__":
    main()
