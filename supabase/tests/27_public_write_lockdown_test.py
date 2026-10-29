"""Local check for 27_public_write_lockdown.sql on a throw-away Postgres 16 (never the live DB).

    python -m venv <folder OUTSIDE the repo>/pgtest
    <that folder>/pgtest/Scripts/pip install pgserver "psycopg[binary]"
    <that folder>/pgtest/Scripts/python supabase/tests/27_public_write_lockdown_test.py

Recreates the live policies/grants found on 27 Oct 2026 (read-only audit), applies 27, and checks
that anon / authenticated can still READ but no longer WRITE, as real roles (SET ROLE), not only by
catalog lookup. Then rollback → open again, then 27 a second time (must be re-runnable).
"""
import pathlib
import sys
import tempfile

import pgserver
import psycopg

MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"

BASELINE = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.role() returns text language sql stable
  as $$ select coalesce(current_setting('request.jwt.claim.role', true), current_user::text) $$;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table public.ncert_questions (id serial primary key, question text);
create table public.ncert_chunks (id serial primary key, content text);
create table public.attendance_legacy (id serial primary key, institute_id uuid);
create table public.institute_members (institute_id uuid, user_id uuid, status text);
alter table public.ncert_questions enable row level security;
alter table public.ncert_chunks enable row level security;
alter table public.attendance_legacy enable row level security;
grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
create policy ncert_questions_select_all on public.ncert_questions for select using (true);
create policy ncert_questions_insert_service on public.ncert_questions for insert with check (true);
create policy "Allow public read access" on public.ncert_chunks for select using (true);
create policy "Allow authenticated insert" on public.ncert_chunks for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on public.ncert_chunks for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on public.ncert_chunks for delete using (auth.role() = 'authenticated');
create policy "Public read attendance" on public.attendance_legacy for select using (true);
create policy "Members manage attendance" on public.attendance_legacy for all using (
  institute_id in (select institute_id from public.institute_members where user_id = auth.uid() and status = 'active'));
insert into public.ncert_questions (question) values ('seed');
insert into public.ncert_chunks (content) values ('seed');
"""

failures = 0


def can(conn, role, sql):
    """Run sql as role inside a savepoint; True if it succeeded and touched a row (or read)."""
    with conn.cursor() as cur:
        cur.execute("savepoint s")
        try:
            cur.execute(f"set local role {role}")
            cur.execute(sql)
            ok = cur.rowcount != 0 if not sql.lstrip().lower().startswith("select") else True
        except psycopg.Error:
            ok = False
        cur.execute("rollback to savepoint s")
        cur.execute("reset role")
        return ok


def check(conn, label, expect_writes_open):
    global failures
    cases = [
        ("anon reads questions", "anon", "select * from public.ncert_questions", True),
        ("anon reads chunks", "anon", "select * from public.ncert_chunks", True),
        ("authenticated reads questions", "authenticated", "select * from public.ncert_questions", True),
        ("anon inserts question", "anon", "insert into public.ncert_questions (question) values ('x')", expect_writes_open),
        ("authenticated inserts question", "authenticated", "insert into public.ncert_questions (question) values ('x')", expect_writes_open),
        ("authenticated inserts chunk", "authenticated", "insert into public.ncert_chunks (content) values ('x')", expect_writes_open),
        ("authenticated updates chunk", "authenticated", "update public.ncert_chunks set content = 'x'", expect_writes_open),
        ("authenticated deletes chunk", "authenticated", "delete from public.ncert_chunks", expect_writes_open),
        ("anon reads legacy attendance", "anon", "select * from public.attendance_legacy", expect_writes_open),
        ("service_role inserts question", "service_role", "insert into public.ncert_questions (question) values ('x')", True),
        ("service_role deletes chunk", "service_role", "delete from public.ncert_chunks", True),
    ]
    with conn.transaction():
        for name, role, sql, want in cases:
            got = can(conn, role, sql)
            status = "PASS" if got == want else "FAIL"
            failures += status == "FAIL"
            print(f"  {status}  [{label}] {name}: {'allowed' if got else 'blocked'} (want {'allowed' if want else 'blocked'})")


def run_file(conn, name):
    conn.execute((MIG / name).read_text(encoding="utf-8"))


with tempfile.TemporaryDirectory() as tmp:
    srv = pgserver.get_server(tmp, cleanup_mode="delete")
    with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
        conn.execute(BASELINE)
        print("baseline (live as of 27 Oct):")
        check(conn, "before", expect_writes_open=True)
        run_file(conn, "27_public_write_lockdown.sql")
        print("after 27:")
        check(conn, "after 27", expect_writes_open=False)
        run_file(conn, "27_public_write_lockdown_rollback.sql")
        print("after rollback:")
        check(conn, "rollback", expect_writes_open=True)
        run_file(conn, "27_public_write_lockdown.sql")
        print("27 again (re-run):")
        check(conn, "re-run", expect_writes_open=False)
    srv.cleanup()

print(f"\n{'ALL PASS' if not failures else f'{failures} FAILED'}")
sys.exit(1 if failures else 0)
