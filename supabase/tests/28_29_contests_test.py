"""Local check for 28_contest_tables_lockdown.sql + 29_contest_feed.sql on a throw-away Postgres 16 (never the live DB).

    python -m venv <folder OUTSIDE the repo>/pgtest
    <that folder>/pgtest/Scripts/pip install pgserver "psycopg[binary]"
    <that folder>/pgtest/Scripts/python supabase/tests/28_29_contests_test.py

Baseline = the live state found on 1 Nov 2026 (read-only audit): contest tables with RLS DISABLED, anon +
authenticated holding every table privilege, the live policies, Supabase's default EXECUTE grant on new functions.
28: checked as real roles (SET ROLE + jwt sub), then rollback → open again, then 28 again (re-runnable).
29 (applied twice): privileges, code parsing, register idempotency (incl. two connections at once), feed views,
keyset pages, search / subject filter, teacher_release score hiding.
"""
import pathlib
import sys
import tempfile
import threading
import time
import uuid

import pgserver
import psycopg

MIG = pathlib.Path(__file__).resolve().parents[1] / "migrations"

T = "11111111-1111-4111-8111-111111111111"   # teacher
S = "22222222-2222-4222-8222-222222222222"   # student
S2 = "33333333-3333-4333-8333-333333333333"  # another student

BASELINE = f"""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.contests (
  id uuid primary key default gen_random_uuid(), teacher_id uuid references auth.users(id), title text not null,
  subject text not null default 'Physics', class_grade text not null default '10', board text default 'CBSE',
  logo_base64 text, short_code varchar(10) not null unique, duration_minutes int not null default 30,
  answer_mode varchar(20) not null default 'after_test', show_explanation boolean not null default true,
  enable_camera boolean not null default true, enable_tab_detection boolean not null default true,
  allow_back_navigation boolean not null default true, max_warnings int not null default 3,
  max_attempts int not null default 1, scheduled_at timestamptz, expires_at timestamptz,
  status varchar(20) not null default 'active', total_questions int not null default 0,
  total_marks int not null default 0, total_attempts int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  allow_technical_retry boolean not null default true, results_published_at timestamptz);
create table public.contest_questions (
  id uuid primary key default gen_random_uuid(), contest_id uuid references public.contests(id),
  question_number int, question_text text, correct_answer text);
create table public.contest_attempts (
  id uuid primary key default gen_random_uuid(), contest_id uuid references public.contests(id),
  student_id uuid references auth.users(id), student_name varchar(100), started_at timestamptz default now(),
  submitted_at timestamptz, status varchar(20), score int, total_marks int, percentage numeric(5,2),
  answers jsonb, created_at timestamptz default now());
grant all on all tables in schema public to anon, authenticated, service_role;
create policy "Anyone can read active contests" on public.contests for select using ((status)::text = 'active');
create policy "Teachers manage own contests" on public.contests for all using (auth.uid() = teacher_id);
create policy "Read questions of active contests" on public.contest_questions for select using (exists (
  select 1 from public.contests where contests.id = contest_questions.contest_id and contests.status::text = 'active'));
create policy "Teachers manage own contest questions" on public.contest_questions for all using (exists (
  select 1 from public.contests where contests.id = contest_questions.contest_id and contests.teacher_id = auth.uid()));
create policy "Students manage own attempts" on public.contest_attempts for all using (student_id = auth.uid());
create policy "Teachers view attempts on their contests" on public.contest_attempts for select using (exists (
  select 1 from public.contests where contests.id = contest_attempts.contest_id and contests.teacher_id = auth.uid()));

insert into auth.users values ('{T}'), ('{S}'), ('{S2}');
insert into public.contests (id, teacher_id, title, short_code, total_marks)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '{T}', 'Light & Optics', 'lockdn01', 10);
insert into public.contest_questions (contest_id, question_number, question_text, correct_answer)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 1, 'Q1', 'B');
insert into public.contest_attempts (contest_id, student_id, status, score, total_marks)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '{S}', 'submitted', 4, 10),
         ('aaaaaaaa-0000-4000-8000-000000000001', '{S2}', 'submitted', 9, 10);
"""

failures = 0
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def report(name, ok, detail=""):
    global failures
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail and not ok else ''}")


def as_role(conn, role, uid, sql, params=None, commit=False):
    """Run sql as role (+ jwt sub) in its own transaction (rolled back unless commit). → (ok, rows or error, rowcount)."""
    try:
        with conn.transaction(force_rollback=not commit), conn.cursor() as cur:
            cur.execute(f"set local role {role}")
            cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid or "",))
            cur.execute(sql, params)
            return True, (cur.fetchall() if cur.description else None), cur.rowcount
    except psycopg.Error as e:
        return False, str(e).splitlines()[0], 0


def check_28(conn, label, open_state):
    def allowed(role, uid, sql):
        ok, rows, n = as_role(conn, role, uid, sql)
        if not ok:
            return False
        return bool(rows) if rows is not None else n > 0

    cases = [
        ("anon reads answer keys", "anon", None, "select correct_answer from contest_questions", open_state),
        ("student reads answer keys", "authenticated", S, "select correct_answer from contest_questions", open_state),
        ("teacher reads own questions", "authenticated", T, "select correct_answer from contest_questions", True),
        ("anon reads attempts", "anon", None, "select * from contest_attempts", open_state),
        ("student reads another's attempt", "authenticated", S, f"select * from contest_attempts where student_id = '{S2}'", open_state),
        ("student reads own attempt", "authenticated", S, f"select * from contest_attempts where student_id = '{S}'", True),
        ("teacher reads attempts of own contest", "authenticated", T, "select * from contest_attempts", True),
        ("student raises own score", "authenticated", S, f"update contest_attempts set score = 10 where student_id = '{S}'", open_state),
        ("anon changes a score", "anon", None, "update contest_attempts set score = 10", open_state),
        ("anon publishes results", "anon", None, "update contests set results_published_at = now()", open_state),
        ("anon deletes attempts", "anon", None, "delete from contest_attempts", open_state),
        ("anon creates a contest", "anon", None, "insert into contests (title, short_code) values ('x', 'zz999999')", open_state),
        ("anon reads active contests (ContestLivePage gate)", "anon", None, "select id, status from contests where short_code = 'lockdn01'", True),
        ("service_role updates a score", "service_role", None, "update contest_attempts set score = 5", True),
    ]
    for name, role, uid, sql, want in cases:
        got = allowed(role, uid, sql)
        report(f"[{label}] {name}: {'allowed' if got else 'blocked'}", got == want, f"want {'allowed' if want else 'blocked'}")


def run_file(conn, name):
    conn.execute((MIG / name).read_text(encoding="utf-8"))


def rpc(conn, uid, sql, params=None):
    ok, rows, _ = as_role(conn, "authenticated", uid, sql, params, commit=True)
    if not ok:
        raise AssertionError(f"{sql}: {rows}")
    return rows[0][0]


def seed_29(conn):
    conn.execute("delete from contest_attempts; delete from contest_questions; delete from contests")  # 28's rows
    conn.execute(f"""
      insert into contests (id, teacher_id, title, subject, short_code, scheduled_at, expires_at, answer_mode, created_at) values
        ('c0000000-0000-4000-8000-000000000001', '{T}', 'Live open contest', 'Physics',   'live0001', null, null, 'after_test', now() - interval '3 day'),
        ('c0000000-0000-4000-8000-000000000002', '{T}', 'Sunday mock',       'Chemistry', 'soon0002', now() + interval '2 day', now() + interval '2 day 2 hour', 'after_test', now() - interval '2 day'),
        ('c0000000-0000-4000-8000-000000000003', '{T}', 'Old contest',       'Physics',   'done0003', now() - interval '9 day', now() - interval '8 day', 'after_test', now() - interval '10 day'),
        ('c0000000-0000-4000-8000-000000000004', '{T}', 'Released later',    'Maths',     'rel00004', null, null, 'teacher_release', now() - interval '1 day'),
        ('c0000000-0000-4000-8000-000000000005', null,  '100%_sale',         'Maths',     'pct00005', null, null, 'after_test', now() - interval '1 hour');
      insert into contest_attempts (contest_id, student_id, status, score, percentage, submitted_at) values
        ('c0000000-0000-4000-8000-000000000001', '{S}', 'in_progress', null, null, null),
        ('c0000000-0000-4000-8000-000000000004', '{S}', 'submitted', 7, 70, now() - interval '20 hour');
    """)
    for i in range(7):
        conn.execute(f"""insert into contests (teacher_id, title, subject, short_code, scheduled_at)
                         values ('{T}', 'Weekly #{i}', 'Biology', 'wk{i:06d}', now() + interval '{i + 1} hour')""")


def test_29(conn):
    print("29: privileges")
    for fn, args in (("a4_contest_rows", f"'{S}'::uuid"), ("a4_contest_code", "'abc'")):
        ok, _, _ = as_role(conn, "authenticated", S, f"select * from public.{fn}({args})")
        report(f"authenticated cannot call {fn}", not ok)
    ok, _, _ = as_role(conn, "anon", None, "select public.get_my_contests()")
    report("anon cannot call get_my_contests", not ok)
    ok, _, _ = as_role(conn, "authenticated", None, "select public.get_my_contests()")
    report("signed-out (no sub) get_my_contests → error", not ok)

    print("29: code parsing")
    for raw, want in (("ABCD1234", "abcd1234"), (" abcd-1234 ", "abcd1234"),
                      ("https://a4ai.in/contest/ABcd1234/results?x=1#y", "abcd1234"),
                      ("http://localhost:8080/contests/live/live0001/", "live0001"), ("   ", None)):
        got = conn.execute("select public.a4_contest_code(%s)", (raw,)).fetchone()[0]
        report(f"a4_contest_code({raw!r}) = {want!r}", got == want, f"got {got!r}")

    seed_29(conn)
    print("29: register_for_contest")
    r1 = rpc(conn, S, "select public.register_for_contest('SOON0002')")
    r1b = rpc(conn, S, "select public.register_for_contest('https://a4ai.in/contest/soon0002')")
    report("first call registers", r1["state"] == "registered", str(r1))
    report("repeat (pasted link) → already_registered, same contest", r1b["state"] == "already_registered"
           and r1b["contest"]["id"] == r1["contest"]["id"] and r1b["contest"]["my_state"] == "registered", str(r1b))
    n = conn.execute(f"select count(*) from contest_registrations where student_id = '{S}'").fetchone()[0]
    report("exactly one row after two calls", n == 1, f"{n} rows")
    for code, want in (("done0003", "ended"), ("nope9999", "not_found"), ("x", "invalid_code"), ("", "invalid_code")):
        st = rpc(conn, S, "select public.register_for_contest(%s)", (code,))["state"]
        report(f"register {code!r} → {want}", st == want, st)
    st = rpc(conn, T, "select public.register_for_contest('live0001')")["state"]
    report("teacher on own contest → owner (nothing stored)", st == "owner", st)
    n = conn.execute("select count(*) from contest_registrations").fetchone()[0]
    report("ended / owner / invalid stored nothing", n == 1, f"{n} rows")
    card = rpc(conn, S2, "select public.get_contest_card('LIVE0001')")
    report("card for a stranger: ok, my_state none, no logo/answers", card["state"] == "ok"
           and card["contest"]["my_state"] == "none" and "logo_base64" not in card["contest"], str(card))

    print("29: register from two connections at once")
    uri = conn.info.dsn
    c1 = psycopg.connect(uri)
    c2 = psycopg.connect(uri, autocommit=True)
    try:
        def call(c, holder):
            with c.cursor() as cur:
                cur.execute("set role authenticated")
                cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (S2,))
                cur.execute("select public.register_for_contest('soon0002')")
                holder.append(cur.fetchone()[0]["state"])
        first, second = [], []
        call(c1, first)                      # tx 1 inserted, not committed yet
        t = threading.Thread(target=call, args=(c2, second))
        t.start()
        time.sleep(0.5)
        report("second call waits on the first (row lock)", t.is_alive() and not second)
        c1.commit()
        t.join(10)
        report("parallel: one registered, one already_registered", sorted(first + second) == ["already_registered", "registered"],
               str(first + second))
        n = conn.execute(f"select count(*) from contest_registrations where student_id = '{S2}'").fetchone()[0]
        report("parallel: exactly one row", n == 1, f"{n} rows")
    finally:
        c1.close()
        c2.close()

    print("29: get_my_contests (student)")
    up = rpc(conn, S, "select public.get_my_contests('upcoming')")
    ids = [i["short_code"] for i in up["items"]]
    report("upcoming = in-progress live + registered (soonest first)", ids == ["live0001", "soon0002"], str(ids))
    report("in-progress attempt → my_state in_progress", up["items"][0]["my_state"] == "in_progress")
    report("next (banner) = the attempt to resume", up["next"] and up["next"]["short_code"] == "live0001", str(up["next"]))
    report("counts", up["counts"] == {"upcoming": 2, "past": 1, "live": 1}, str(up["counts"]))
    report("server_now present", bool(up["server_now"]))
    past = rpc(conn, S, "select public.get_my_contests('past')")
    rel = past["items"][0]
    report("past = submitted teacher_release contest", [i["short_code"] for i in past["items"]] == ["rel00004"])
    report("teacher_release unpublished → no score, results_pending", rel["my_score"] is None and rel["my_percentage"] is None
           and rel["results_pending"] is True and rel["my_state"] == "submitted", str(rel))
    conn.execute("update contests set results_published_at = now() where short_code = 'rel00004'")
    rel = rpc(conn, S, "select public.get_my_contests('past')")["items"][0]
    report("after publish → score 7", rel["my_score"] == 7 and rel["results_pending"] is False, str(rel))

    print("29: get_my_contests (teacher, keyset pages, search, subject)")
    seen, cursor, pages = [], None, 0
    while True:
        args = ("upcoming", None, None, 3) + ((cursor["at"], cursor["id"]) if cursor else (None, None))
        page = rpc(conn, T, "select public.get_my_contests(%s, %s, %s, %s, %s::timestamptz, %s::uuid)", args)
        pages += 1
        seen += [i["short_code"] for i in page["items"]]
        cursor = page["next_cursor"]
        if not cursor or pages > 10:
            break
    report("teacher upcoming: 10 items as 3 + 3 + 3 + 1 over 4 pages, no duplicates",
           pages == 4 and len(seen) == 10 and len(set(seen)) == 10, f"{pages} pages {seen}")
    report("owner rows say my_state owner", all(i["my_state"] == "owner" for i in page["items"]))
    report("sorted by start (open contest first, then by schedule)", seen[:2] == ["live0001", "rel00004"] and seen[-1] == "soon0002", str(seen))
    tp = rpc(conn, T, "select public.get_my_contests('past')")
    report("teacher past = the expired one", [i["short_code"] for i in tp["items"]] == ["done0003"])
    sr = rpc(conn, T, "select public.get_my_contests('upcoming', 'CHEM')")
    report("search matches subject (case-insensitive)", [i["short_code"] for i in sr["items"]] == ["soon0002"])
    sr = rpc(conn, T, "select public.get_my_contests('upcoming', 'https://a4ai.in/contest/WK000003')")
    report("search by pasted link → code", [i["short_code"] for i in sr["items"]] == ["wk000003"])
    sr = rpc(conn, T, "select public.get_my_contests('upcoming', '%')")
    report("'%' is literal (no match-all)", sr["items"] == [] and sr["counts"]["upcoming"] == 0, str(sr["counts"]))
    sb = rpc(conn, T, "select public.get_my_contests('upcoming', null, 'biology')")
    report("subject filter", len(sb["items"]) == 7 and all(i["subject"] == "Biology" for i in sb["items"]))
    facets = {f["name"]: f["count"] for f in sb["subjects"]}
    report("subject facets over the view", facets == {"Biology": 7, "Physics": 1, "Maths": 1, "Chemistry": 1}, str(facets))
    stranger = rpc(conn, S2, "select public.get_my_contests('past')")
    report("another student never sees S's attempts", stranger["items"] == [], str(stranger["items"]))
    ok, err, _ = as_role(conn, "authenticated", S, "select public.get_my_contests('everything')")
    report("bad view → error", not ok)
    ok, err, _ = as_role(conn, "authenticated", S, "select public.get_my_contests('past', null, null, 5, now(), null)")
    report("half a cursor → error", not ok)


with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    srv = pgserver.get_server(tmp, cleanup_mode="delete")
    with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
        conn.execute(BASELINE)
        print("baseline (live as of 1 Nov):")
        check_28(conn, "before", open_state=True)
        run_file(conn, "28_contest_tables_lockdown.sql")
        print("after 28:")
        check_28(conn, "after 28", open_state=False)
        run_file(conn, "28_contest_tables_lockdown_rollback.sql")
        print("after rollback:")
        check_28(conn, "rollback", open_state=True)
        run_file(conn, "28_contest_tables_lockdown.sql")
        print("28 again (re-run):")
        check_28(conn, "re-run", open_state=False)
        run_file(conn, "29_contest_feed.sql")
        run_file(conn, "29_contest_feed.sql")   # re-runnable
        test_29(conn)
    srv.cleanup()

print(f"\n{'ALL PASS' if not failures else f'{failures} FAILED'}")
sys.exit(1 if failures else 0)
