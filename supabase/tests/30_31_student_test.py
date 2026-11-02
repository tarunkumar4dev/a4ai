"""Local check for 30_practice_coins_lockdown.sql + 31_practice_progress.sql on a throw-away Postgres 16 (never live).

    <pgtest venv>/Scripts/python supabase/tests/30_31_student_test.py

Baseline = live on 1 Nov 2026 (read-only audit): profiles with "update/insert own" policies and full table grants,
coin_transactions with "insert own", practice_* tables with RLS DISABLED and full grants.
30: checked as real roles (SET ROLE + jwt claims), then rollback → open again, then 30 again (re-runnable).
31 (applied twice): privileges, idempotent marks, hidden questions refused, parallel marks, summary, RLS.
"""
import pathlib
import sys
import tempfile
import threading
import time

import pgserver
import psycopg

MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"
A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
NEW = "33333333-3333-4333-8333-333333333333"

BASELINE = f"""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.profiles (id uuid primary key references auth.users(id), full_name text, email text, role text,
  coins integer default 0, total_coins_earned integer default 0, school_name text, updated_at timestamptz);
alter table public.profiles enable row level security;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "read own profile" on public.profiles for select using (id = auth.uid());

create table public.coin_transactions (id uuid primary key default gen_random_uuid(), user_id uuid, type text,
  amount integer, description text, contest_id text, created_at timestamptz default now());
alter table public.coin_transactions enable row level security;
create policy "insert own transactions" on public.coin_transactions for insert with check (user_id = auth.uid());
create policy "read own transactions" on public.coin_transactions for select using (user_id = auth.uid());

create table public.practice_questions (id uuid primary key default gen_random_uuid(), question_text text, is_active boolean default true);
create table public.practice_attempts (id uuid primary key default gen_random_uuid(), user_id uuid, coins_earned integer);
create table public.practice_profiles (id uuid primary key, total_coins integer);

create table public.ncert_questions (id bigserial primary key, class_grade text, subject text, chapter text,
  question_text text, quality_status text);

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

insert into auth.users values ('{A}'), ('{B}'), ('{NEW}');
insert into public.profiles (id, full_name, coins, total_coins_earned) values ('{A}', 'Asha', 40, 40), ('{B}', 'Ravi', 10, 10);
insert into public.coin_transactions (user_id, type, amount, description) values ('{A}', 'earn', 40, 'seed');
insert into public.practice_questions (question_text) values ('q1');
insert into public.practice_profiles values ('{A}', 5);
insert into public.ncert_questions (class_grade, subject, chapter, question_text, quality_status) values
  ('10', 'Mathematics', 'Real Numbers', 'Prove that root 2 is irrational', null),
  ('10', 'Mathematics', 'Real Numbers', 'HCF of 6 and 20', 'clean'),
  ('10', 'Science', 'Light', 'Define focus', null),
  ('10', 'Science', 'Light', 'copy', 'duplicate');
"""

failures = 0
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def report(name, ok, detail=""):
    global failures
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail and not ok else ''}")


def as_role(conn, role, uid, sql, params=None, commit=False):
    try:
        with conn.transaction(force_rollback=not commit), conn.cursor() as cur:
            cur.execute(f"set local role {role}")
            cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid or "",))
            cur.execute("select set_config('request.jwt.claim.role', %s, true)", (role if role != "service_role" else "service_role",))
            cur.execute(sql, params)
            return True, (cur.fetchall() if cur.description else None), cur.rowcount
    except psycopg.Error as e:
        return False, str(e).splitlines()[0], 0


def allowed(conn, role, uid, sql):
    ok, rows, n = as_role(conn, role, uid, sql)
    return ok and (bool(rows) if rows is not None else n > 0)


def check_30(conn, label, open_state):
    cases = [
        ("student renames self", "authenticated", A, "update profiles set full_name = 'Asha V' where id = auth.uid()", True),
        ("student sets own coins", "authenticated", A, "update profiles set coins = 99999 where id = auth.uid()", open_state),
        ("student sets own total earned", "authenticated", A, "update profiles set total_coins_earned = 99999 where id = auth.uid()", open_state),
        ("student writes coin history", "authenticated", A, f"insert into coin_transactions (user_id, type, amount) values ('{A}', 'earn', 500)", open_state),
        ("student reads own coin history", "authenticated", A, "select * from coin_transactions", True),
        ("student sets practice coins", "authenticated", A, "update practice_profiles set total_coins = 99999", open_state),
        ("anon edits practice questions", "anon", None, "update practice_questions set question_text = 'x'", open_state),
        ("student reads practice questions", "authenticated", A, "select * from practice_questions", open_state),
        ("service role adds coins", "service_role", None, f"update profiles set coins = coins + 5 where id = '{A}'", True),
    ]
    for name, role, uid, sql, want in cases:
        got = allowed(conn, role, uid, sql)
        report(f"[{label}] {name}: {'allowed' if got else 'blocked'}", got == want, f"want {'allowed' if want else 'blocked'}")
    ok, rows, _ = as_role(conn, "authenticated", NEW,
                          f"insert into profiles (id, full_name, coins, total_coins_earned) values ('{NEW}', 'New', 1000000, 1000000) returning coins, total_coins_earned")
    want = (1000000, 1000000) if open_state else (0, 0)
    report(f"[{label}] self-inserted profile keeps coins {want}", ok and rows and tuple(rows[0]) == want, str(rows))


def test_31(conn):
    print("31: practice progress")
    ok, _, _ = as_role(conn, "anon", None, "select public.record_practice_mark(1, 'got')")
    report("anon cannot record marks", not ok)
    ok, _, _ = as_role(conn, "authenticated", None, "select public.record_practice_mark(1, 'got')")
    report("signed-out (no sub) cannot record marks", not ok)

    def rpc(uid, sql):
        ok, rows, _ = as_role(conn, "authenticated", uid, sql, commit=True)
        if not ok:
            raise AssertionError(rows)
        return rows[0][0]

    r1 = rpc(A, "select public.record_practice_mark(1, 'got')")
    r2 = rpc(A, "select public.record_practice_mark(1, 'review')")
    report("mark, then change the mark", r1["ok"] and r2["ok"], f"{r1} {r2}")
    row = conn.execute(f"select result, subject, chapter, count(*) over () from ncert_practice_marks where user_id = '{A}'").fetchone()
    report("one row per question; chapter filed from the bank", row and row[0] == "review" and row[1] == "Mathematics" and row[2] == "Real Numbers" and row[3] == 1, str(row))
    report("duplicate-marked question refused", rpc(A, "select public.record_practice_mark(4, 'got')")["code"] == "not_found")
    report("unknown question refused", rpc(A, "select public.record_practice_mark(999, 'got')")["code"] == "not_found")
    report("bad result refused", rpc(A, "select public.record_practice_mark(2, 'perfect')")["code"] == "invalid_result")

    # the same mark from two connections at once → one row
    uri = conn.info.dsn
    c1, c2 = psycopg.connect(uri), psycopg.connect(uri, autocommit=True)
    try:
        def call(c, out):
            with c.cursor() as cur:
                cur.execute("set role authenticated")
                cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (B,))
                cur.execute("select public.record_practice_mark(3, 'got')")
                out.append(cur.fetchone()[0]["ok"])
        a, b = [], []
        call(c1, a)
        t = threading.Thread(target=call, args=(c2, b))
        t.start()
        time.sleep(0.5)
        c1.commit()
        t.join(10)
        n = conn.execute(f"select count(*) from ncert_practice_marks where user_id = '{B}'").fetchone()[0]
        report("parallel marks: both ok, one row", a == [True] and b == [True] and n == 1, f"{a} {b} rows={n}")
    finally:
        c1.close(); c2.close()

    rpc(A, "select public.record_practice_mark(2, 'got')")
    rpc(A, "select public.record_practice_mark(3, 'got')")
    s = rpc(A, "select public.get_my_practice_summary('UTC')")  # the local test server has no tz files; live has Asia/Kolkata
    report("summary totals", s["got"] == 2 and s["review"] == 1 and s["today"] == 3, str(s))
    report("summary week = 7 days, today last", len(s["week"]) == 7 and s["week"][-1]["count"] == 3, str(s["week"]))
    subj = {x["subject"]: (x["got"], x["review"]) for x in s["by_subject"]}
    report("summary per subject", subj == {"Mathematics": (1, 1), "Science": (1, 0)}, str(subj))
    s2 = rpc(A, "select public.get_my_practice_summary('Not/AZone')")
    report("unknown time zone falls back (no error)", s2["got"] == 2)
    rpc(A, "select public.clear_practice_mark(1)")
    n = conn.execute(f"select count(*) from ncert_practice_marks where user_id = '{A}'").fetchone()[0]
    report("undo removes the mark", n == 2, f"{n} rows")
    ok, rows, _ = as_role(conn, "authenticated", B, f"select * from ncert_practice_marks where user_id = '{A}'")
    report("another student can't read your marks", ok and rows == [], str(rows))
    ok, _, _ = as_role(conn, "authenticated", A, f"insert into ncert_practice_marks (user_id, question_id, result, class_grade, subject, chapter) values ('{A}', 2, 'got', '10', 'x', 'y')")
    report("no direct writes (RPC only)", not ok)


with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    srv = pgserver.get_server(tmp, cleanup_mode="delete")
    with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
        conn.execute(BASELINE)
        print("baseline (live as of 1 Nov):")
        check_30(conn, "before", open_state=True)
        conn.execute((MIG / "30_practice_coins_lockdown.sql").read_text(encoding="utf-8"))
        print("after 30:")
        check_30(conn, "after 30", open_state=False)
        conn.execute((MIG / "30_practice_coins_lockdown_rollback.sql").read_text(encoding="utf-8"))
        print("after rollback:")
        check_30(conn, "rollback", open_state=True)
        conn.execute((MIG / "30_practice_coins_lockdown.sql").read_text(encoding="utf-8"))
        print("30 again (re-run):")
        check_30(conn, "re-run", open_state=False)
        for _ in range(2):
            conn.execute((MIG / "31_practice_progress.sql").read_text(encoding="utf-8"))
        test_31(conn)
    srv.cleanup()

print(f"\n{'ALL PASS' if not failures else f'{failures} FAILED'}")
sys.exit(1 if failures else 0)
