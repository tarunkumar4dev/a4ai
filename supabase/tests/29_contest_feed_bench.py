"""Scale check for 29_contest_feed.sql + the backend leaderboard query, on a throw-away Postgres 16 (never the live DB).

    <pgtest venv>/Scripts/python supabase/tests/29_contest_feed_bench.py

Synthetic data far above today's live numbers (1 Nov 2026: 39 contests, 82 attempts):
  10,000 contests · one teacher owning 2,000 · one contest with 10,000 finished attempts (30 answers each) ·
  one student with 300 registrations + 200 attempts · ~20,000 attempts in all.
Measures (median of 7 warm runs, laptop, local socket — NOT production numbers, no network, no PostgREST):
  get_my_contests for the heavy student / heavy teacher (first page, page 5, search), get_contest_card,
  the backend's _board() read (every attempt + answers of one contest) and a SQL-ranked keyset page alternative.
"""
import pathlib
import statistics
import sys
import tempfile
import time

import pgserver
import psycopg

HERE = pathlib.Path(__file__).resolve().parent
MIG = HERE.parent / "migrations"

# reuse the live-like baseline from the correctness test without running it
src = (HERE / "28_29_contests_test.py").read_text(encoding="utf-8")
BASELINE = src.split('BASELINE = f"""', 1)[1].split('"""', 1)[0]
T = "11111111-1111-4111-8111-111111111111"
S = "22222222-2222-4222-8222-222222222222"
BASELINE = BASELINE.replace("{T}", T).replace("{S}", S).replace("{S2}", "33333333-3333-4333-8333-333333333333")

DATA = f"""
delete from contest_attempts; delete from contest_questions; delete from contests;
alter table contest_attempts add column if not exists time_taken_seconds int;
insert into auth.users select gen_random_uuid() from generate_series(1, 10500);
create temp table tchr as select id, row_number() over () n from auth.users where id not in ('{T}','{S}') limit 500;
create temp table stud as select id, row_number() over () n from auth.users where id not in ('{T}','{S}') and id not in (select id from tchr) limit 10000;
-- 10,000 contests: 2,000 by T, the rest spread over 500 teachers; a quarter scheduled ahead, a third already expired
insert into contests (teacher_id, title, subject, short_code, scheduled_at, expires_at, created_at, total_marks, answer_mode)
select case when g <= 2000 then '{T}'::uuid else (select id from tchr where n = 1 + g % 500) end,
       'Contest ' || g, (array['Physics','Chemistry','Maths','Biology','English'])[1 + g % 5], 'b' || lpad(g::text, 7, '0'),
       case when g % 4 = 0 then now() + (g % 72) * interval '1 hour' end,
       case when g % 3 = 0 then now() - (g % 30) * interval '1 day' end,
       now() - (g % 365) * interval '1 day', 30, case when g % 10 = 0 then 'teacher_release' else 'after_test' end
  from generate_series(1, 10000) g;
-- the big contest: 10,000 finished attempts with 30 answers each
insert into contest_attempts (contest_id, student_id, status, score, total_marks, percentage, submitted_at, answers)
select (select id from contests where short_code = 'b0000001'), s.id, 'submitted', (s.n * 7) % 31, 30, ((s.n * 7) % 31) * 100.0 / 30,
       now() - (s.n % 600) * interval '1 second',
       (select jsonb_agg(jsonb_build_object('questionId', gen_random_uuid(), 'selected', 'B', 'timeSpent', 20)) from generate_series(1, 30))
  from stud s;
-- background noise: 40,000 attempts on other contests
insert into contest_attempts (contest_id, student_id, status, score, total_marks, submitted_at)
select c.id, s.id, 'submitted', 10, 30, now() - interval '2 day'
  from (select id, row_number() over () n from contests where short_code <> 'b0000001' limit 4000) c
  join stud s on s.n % 4000 = c.n % 4000 and s.n <= 10000
 limit 40000;
-- the heavy student: 300 registrations + 200 attempts
insert into contest_registrations (contest_id, student_id)
select id, '{S}' from contests where short_code between 'b0002001' and 'b0002300';
insert into contest_attempts (contest_id, student_id, status, score, total_marks, percentage, submitted_at)
select id, '{S}', 'submitted', 20, 30, 66.7, now() - interval '3 day' from contests where short_code between 'b0002201' and 'b0002400';
analyze;
"""


def timed(conn, uid, sql, params=None, runs=7):
    out = []
    for _ in range(runs):
        with conn.transaction(force_rollback=True), conn.cursor() as cur:
            cur.execute("set local role authenticated")
            cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
            t = time.perf_counter()
            cur.execute(sql, params)
            row = cur.fetchone()
            out.append((time.perf_counter() - t) * 1000)
    return statistics.median(out), row


def admin_timed(conn, sql, runs=7):
    out, rows = [], None
    for _ in range(runs):
        t = time.perf_counter()
        rows = conn.execute(sql).fetchall()
        out.append((time.perf_counter() - t) * 1000)
    return statistics.median(out), rows


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        srv = pgserver.get_server(tmp, cleanup_mode="delete")
        with psycopg.connect(srv.get_uri(), autocommit=True) as conn:
            conn.execute(BASELINE)
            for f in ("28_contest_tables_lockdown.sql", "29_contest_feed.sql"):
                conn.execute((MIG / f).read_text(encoding="utf-8"))
            t = time.perf_counter()
            conn.execute(DATA)
            print(f"data loaded in {time.perf_counter() - t:.1f}s:",
                  conn.execute("select (select count(*) from contests), (select count(*) from contest_attempts), "
                               "(select count(*) from contest_registrations)").fetchone(), "(contests, attempts, registrations)")

            print("\nA/B — get_my_contests (one call renders the page):")
            ms, row = timed(conn, S, "select public.get_my_contests('upcoming')")
            print(f"  heavy student, upcoming p1      {ms:7.1f} ms   items={len(row[0]['items'])} counts={row[0]['counts']}")
            ms, row = timed(conn, S, "select public.get_my_contests('past')")
            print(f"  heavy student, past p1          {ms:7.1f} ms   items={len(row[0]['items'])}")
            ms, row = timed(conn, T, "select public.get_my_contests('upcoming')")
            print(f"  teacher with 2,000, upcoming p1 {ms:7.1f} ms   counts={row[0]['counts']}")
            cur = None
            for _ in range(4):
                page = timed(conn, T, "select public.get_my_contests('past', null, null, 20, %s::timestamptz, %s::uuid)",
                             ((cur or {}).get("at"), (cur or {}).get("id")), runs=1)[1][0]
                cur = page["next_cursor"]
            ms, _ = timed(conn, T, "select public.get_my_contests('past', null, null, 20, %s::timestamptz, %s::uuid)",
                          (cur["at"], cur["id"]))
            print(f"  teacher with 2,000, past p5     {ms:7.1f} ms   (keyset)")
            ms, row = timed(conn, T, "select public.get_my_contests('upcoming', 'contest 19')")
            print(f"  teacher with 2,000, search      {ms:7.1f} ms   items={len(row[0]['items'])}")
            ms, row = timed(conn, S, "select public.get_contest_card('b0000001')")
            print(f"  get_contest_card (10k attempts) {ms:7.1f} ms")
            ms, row = timed(conn, S, "select public.register_for_contest('b0000002')")
            print(f"  register_for_contest            {ms:7.1f} ms")

            print("\nC — leaderboard of the 10,000-attempt contest:")
            cid = conn.execute("select id from contests where short_code = 'b0000001'").fetchone()[0]
            ms, rows = admin_timed(conn, f"""select id, student_id, student_name, status, score, total_marks, percentage,
                time_taken_seconds, submitted_at, answers from contest_attempts where contest_id = '{cid}'""")
            size = sum(len(str(r[-1])) for r in rows) / 1e6
            print(f"  backend _board() read: all rows + answers   {ms:7.1f} ms   rows={len(rows)}  answers≈{size:.1f} MB "
                  "(then Python ranks + counts answers per row; PostgREST max_rows would cut this at 1,000)")
            conn.execute("create index if not exists bench_rank on contest_attempts "
                         "(contest_id, score desc, time_taken_seconds asc nulls last, id) where status <> 'in_progress'")
            conn.execute("analyze contest_attempts")
            ms, rows = admin_timed(conn, f"""select id, student_name, score, time_taken_seconds,
                rank() over (order by score desc, time_taken_seconds asc nulls last) from contest_attempts
                where contest_id = '{cid}' and status <> 'in_progress'
                order by score desc, time_taken_seconds asc nulls last, id limit 50""")
            print(f"  SQL rank, first 50 (window over contest)  {ms:7.1f} ms")
            plan = conn.execute(f"""explain (analyze, buffers, format text) select id, score from contest_attempts
                where contest_id = '{cid}' and status <> 'in_progress'
                order by score desc, time_taken_seconds asc nulls last, id limit 50""").fetchall()
            print("  plan, keyset page without rank():")
            for (line,) in plan[:6]:
                print("    " + line)
        srv.cleanup()


if __name__ == "__main__":
    main()
