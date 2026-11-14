"""Local check for 33_question_bank.sql on a throw-away Postgres 16 (never the live DB).

    pip install pgserver "psycopg[binary]"      (in a venv outside the repo)
    python supabase/tests/33_question_bank_test.py

What it proves, as real roles (SET ROLE authenticated / anon + the jwt sub, exactly how PostgREST runs a request):
  * a teacher's INSERT of a bank and its questions really persists (read back as the table owner, RLS bypassed)
  * nobody can insert a bank or a question as / for somebody else
  * another teacher and anon can read, change and delete nothing
  * an institute member reads a bank that has institute_id set, and can change nothing in it
  * the unique (bank_id, content_hash) rule, the answer/answer_source rule, cascade delete
  * the migration runs twice, and the rollback removes everything
"""
import pathlib
import sys
import tempfile

import pgserver
import psycopg

MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"

T = "11111111-1111-4111-8111-111111111111"    # teacher, owner of the bank
T2 = "22222222-2222-4222-8222-222222222222"   # another teacher, same institute (active member)
X = "33333333-3333-4333-8333-333333333333"    # outsider
EX = "44444444-4444-4444-8444-444444444444"   # removed member of the institute (status != active)
INST = "aaaaaaaa-0000-4000-8000-000000000001"
INST2 = "aaaaaaaa-0000-4000-8000-000000000002"   # T is not a member

BASELINE = f"""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.institutes (id uuid primary key, owner_id uuid, name text);
create table public.institute_members (
  id uuid primary key default gen_random_uuid(), institute_id uuid references public.institutes(id),
  user_id uuid, role text, status text default 'active');
-- like live: RLS on, and a member cannot read other members' rows (so the policies must not depend on it)
alter table public.institute_members enable row level security;

insert into auth.users values ('{T}'), ('{T2}'), ('{X}'), ('{EX}');
insert into public.institutes values ('{INST}', null, 'Sunrise'), ('{INST2}', null, 'Other');
insert into public.institute_members (institute_id, user_id, role, status) values
  ('{INST}', '{T}', 'teacher', 'active'), ('{INST}', '{T2}', 'teacher', 'active'),
  ('{INST}', '{EX}', 'teacher', 'removed');
"""

failures = 0
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def report(name, ok, detail=""):
    global failures
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + str(detail)) if detail and not ok else ''}")


def as_role(conn, role, uid, sql, params=None, commit=True):
    """Run sql as role (+ jwt sub) in its own transaction. → (ok, rows or error text, rowcount)."""
    try:
        with conn.transaction(force_rollback=not commit), conn.cursor() as cur:
            cur.execute(f"set local role {role}")
            cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid or "",))
            cur.execute(sql, params)
            return True, (cur.fetchall() if cur.description else None), cur.rowcount
    except psycopg.Error as e:
        return False, str(e).splitlines()[0], 0


def admin(conn, sql, params=None):
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() if cur.description else None


def main() -> int:
    srv = pgserver.get_server(tempfile.mkdtemp(prefix="a4pg_qb_"), cleanup_mode="stop")
    try:
        conn = psycopg.connect(srv.get_uri(), autocommit=True)
        conn.execute(BASELINE)
        sql = (MIG / "33_question_bank.sql").read_text(encoding="utf-8")
        conn.execute(sql)
        conn.execute(sql)
        report("migration runs twice", True)

        pol = admin(conn, "select tablename, cmd, count(*) from pg_policies "
                          "where tablename in ('question_banks','bank_questions') group by 1, 2 order by 1, 2")
        report("4 policies per table, one per command",
               [(r[0], r[1], r[2]) for r in pol] == [(t, c, 1) for t in ("bank_questions", "question_banks")
                                                     for c in ("DELETE", "INSERT", "SELECT", "UPDATE")], pol)
        rls = admin(conn, "select count(*) from pg_class where relname in ('question_banks','bank_questions') "
                          "and relrowsecurity")
        report("RLS enabled on both tables", rls[0][0] == 2)

        # ── a real authenticated insert persists ────────────────────────────
        ok, rows, _ = as_role(conn, "authenticated", T,
                              "insert into question_banks (owner_id, name) values (%s, 'Eco bank') returning id", (T,))
        report("teacher inserts a bank", ok, rows)
        bank = rows[0][0] if ok else None
        report("…and the row is really in the table (read back without RLS)",
               admin(conn, "select owner_id::text, name, status from question_banks where id = %s", (bank,))
               == [(T, "Eco bank", "ready")])
        ok, rows, n = as_role(conn, "authenticated", T, """
            insert into bank_questions (bank_id, position, qtype, question_text, options, answer, answer_source,
                                        marks, content_hash)
            values (%s, 1, 'mcq', 'Q one', '[{"label":"A","text":"x"},{"label":"B","text":"y"}]', 'B', 'key', 1, 'h1'),
                   (%s, 2, 'long', 'Q two', '[]', null, null, 5, 'h2') returning id""", (bank, bank))
        report("teacher inserts questions", ok and n == 2, rows)
        q1 = rows[0][0] if ok else None
        report("…and both rows are really in the table",
               admin(conn, "select count(*) from bank_questions where bank_id = %s", (bank,))[0][0] == 2)
        ok, rows, _ = as_role(conn, "authenticated", T, "insert into question_banks (name) values ('default owner') returning owner_id::text")
        report("owner_id defaults to the caller", ok and rows == [(T,)], rows)

        # ── nobody writes as / for somebody else ────────────────────────────
        ok, err, _ = as_role(conn, "authenticated", X, "insert into question_banks (owner_id, name) values (%s, 'forged')", (T,))
        report("outsider cannot insert a bank owned by the teacher", not ok and "row-level security" in err, err)
        ok, err, _ = as_role(conn, "authenticated", X, """insert into bank_questions (bank_id, position, qtype,
            question_text, content_hash) values (%s, 9, 'short', 'injected', 'hx')""", (bank,))
        report("outsider cannot insert a question into the teacher's bank", not ok and "row-level security" in err, err)
        ok, err, _ = as_role(conn, "authenticated", T, "insert into question_banks (owner_id, name, institute_id) values (%s, 'x', %s)", (T, INST2))
        report("teacher cannot attach a bank to an institute they are not in", not ok and "row-level security" in err, err)
        ok, err, _ = as_role(conn, "anon", None, "insert into question_banks (owner_id, name) values (%s, 'anon')", (T,))
        report("anon cannot insert", not ok, err)

        # ── others read / change / delete nothing ───────────────────────────
        for who, role, uid in (("outsider", "authenticated", X), ("same-institute teacher (bank has no institute)", "authenticated", T2)):
            ok, rows, _ = as_role(conn, role, uid, "select id from question_banks where id = %s", (bank,))
            report(f"{who} cannot see the bank", ok and rows == [], rows)
            ok, rows, _ = as_role(conn, role, uid, "select id from bank_questions where bank_id = %s", (bank,))
            report(f"{who} cannot see its questions", ok and rows == [], rows)
            ok, _, n = as_role(conn, role, uid, "update bank_questions set answer = 'A', answer_source = 'teacher' where bank_id = %s", (bank,))
            report(f"{who} cannot change a question", ok and n == 0, n)
            ok, _, n = as_role(conn, role, uid, "delete from bank_questions where bank_id = %s", (bank,))
            report(f"{who} cannot delete a question", ok and n == 0, n)
            ok, _, n = as_role(conn, role, uid, "delete from question_banks where id = %s", (bank,))
            report(f"{who} cannot delete the bank", ok and n == 0, n)
        ok, err, _ = as_role(conn, "anon", None, "select * from bank_questions")
        report("anon cannot read questions", not ok and "permission denied" in err, err)
        report("…nothing was changed by any of that",
               admin(conn, "select answer, answer_source from bank_questions where id = %s", (q1,)) == [("B", "key")])

        # ── owner updates / steals ──────────────────────────────────────────
        ok, _, n = as_role(conn, "authenticated", T, "update bank_questions set answer = 'A', answer_source = 'teacher', excluded = true where id = %s", (q1,))
        report("owner updates a question", ok and n == 1)
        report("…and the change persisted",
               admin(conn, "select answer, answer_source, excluded from bank_questions where id = %s", (q1,)) == [("A", "teacher", True)])
        ok, err, _ = as_role(conn, "authenticated", T, "update question_banks set owner_id = %s where id = %s", (X, bank))
        report("owner cannot give the bank to someone else", not ok and "row-level security" in err, err)

        # ── institute members: read only, only when institute_id is set ─────
        ok, _, n = as_role(conn, "authenticated", T, "update question_banks set institute_id = %s where id = %s", (INST, bank))
        report("owner shares the bank with their institute", ok and n == 1)
        ok, rows, _ = as_role(conn, "authenticated", T2, "select name from question_banks where id = %s", (bank,))
        report("member now reads the bank", ok and rows == [("Eco bank",)], rows)
        ok, rows, _ = as_role(conn, "authenticated", T2, "select count(*) from bank_questions where bank_id = %s", (bank,))
        report("member reads its questions", ok and rows == [(2,)], rows)
        ok, _, n = as_role(conn, "authenticated", T2, "update bank_questions set question_text = 'hacked' where bank_id = %s", (bank,))
        report("member cannot change a question", ok and n == 0, n)
        ok, err, _ = as_role(conn, "authenticated", T2, """insert into bank_questions (bank_id, position, qtype,
            question_text, content_hash) values (%s, 9, 'short', 'injected', 'hm')""", (bank,))
        report("member cannot add a question", not ok and "row-level security" in err, err)
        ok, _, n = as_role(conn, "authenticated", T2, "delete from question_banks where id = %s", (bank,))
        report("member cannot delete the bank", ok and n == 0, n)
        for who, uid in (("removed member", EX), ("outsider", X)):
            ok, rows, _ = as_role(conn, "authenticated", uid, "select id from question_banks where id = %s", (bank,))
            report(f"{who} still cannot see the shared bank", ok and rows == [], rows)

        # ── constraints ─────────────────────────────────────────────────────
        ok, err, _ = as_role(conn, "authenticated", T, """insert into bank_questions (bank_id, position, qtype,
            question_text, content_hash) values (%s, 3, 'short', 'dup', 'h1')""", (bank,))
        report("duplicate content_hash in one bank is rejected", not ok and "bank_questions_bank_hash" in err, err)
        ok, err, _ = as_role(conn, "authenticated", T, """insert into bank_questions (bank_id, position, qtype,
            question_text, answer, content_hash) values (%s, 3, 'short', 'no source', 'x', 'h3')""", (bank,))
        report("an answer without a source is rejected", not ok and "bank_questions_answer_has_source" in err, err)
        ok, err, _ = as_role(conn, "authenticated", T, """insert into bank_questions (bank_id, position, qtype,
            question_text, answer, answer_source, content_hash) values (%s, 3, 'short', 'ai', 'x', 'ai', 'h4')""", (bank,))
        report("answer_source 'ai' is rejected", not ok and "answer_source" in err, err)

        # ── owner deletes; cascade ──────────────────────────────────────────
        ok, _, n = as_role(conn, "authenticated", T, "delete from bank_questions where id = %s", (q1,))
        report("owner deletes a question", ok and n == 1)
        ok, _, n = as_role(conn, "authenticated", T, "delete from question_banks where id = %s", (bank,))
        report("owner deletes the bank", ok and n == 1)
        report("…and its questions are gone", admin(conn, "select count(*) from bank_questions where bank_id = %s", (bank,))[0][0] == 0)

        conn.execute((MIG / "33_question_bank_rollback.sql").read_text(encoding="utf-8"))
        left = admin(conn, "select count(*) from pg_class where relname in ('question_banks','bank_questions')")[0][0]
        fn = admin(conn, "select count(*) from pg_proc where proname = 'a4_qb_my_institute_ids'")[0][0]
        report("rollback removes the tables and the function", left == 0 and fn == 0)
        conn.execute(sql)
        report("migration runs again after the rollback", True)
        conn.close()
    finally:
        srv.cleanup()
    print(f"\n{'ALL PASS' if not failures else f'{failures} FAILED'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
