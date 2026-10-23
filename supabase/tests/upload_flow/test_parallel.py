"""
create_submission under real concurrency: two connections, one student, one assignment (runs after the SQL tests,
reuses their fixtures: student Bilal = code BBBB3333, assignments A7 (max_attempts 1) and A8).

  1. same idempotency_key twice at the same time → exactly one row; one 'created', one 'replayed', same id
  2. two different keys at once on a max_attempts = 1 link → one 'created', one 'max_attempts'
  3. first call keeps its transaction open 1 s → second call waits on the advisory lock, then replays
"""

import json
import threading
import time

import psycopg

A7 = "00000000-0000-0000-0000-00000000d007"
A8 = "00000000-0000-0000-0000-00000000d008"
STUDENT = "00000000-0000-0000-0000-00000000c002"
CODE = "BBBB3333"


def _files(conn, asg: str, n: int) -> str:
    return conn.execute("select tst.files(%s, %s, %s)::text", (asg, STUDENT, n)).fetchone()[0]


def _call(uri: str, ip: str, asg: str, key: str, files: str, out: list, i: int,
          barrier: threading.Barrier | None = None, hold_s: float = 0.0, start_delay: float = 0.0):
    with psycopg.connect(uri) as conn:
        conn.execute("select tst.as_anon(%s)", (ip,))   # transaction-local: same transaction as the call below
        if start_delay:
            time.sleep(start_delay)
        if barrier:
            barrier.wait()
        r = conn.execute("select public.create_submission(%s, %s, %s, %s::jsonb)", (CODE, asg, key, files)).fetchone()[0]
        if hold_s:
            time.sleep(hold_s)
        conn.commit()
        out[i] = r


def _run_pair(uri, calls):
    out = [None] * len(calls)
    threads = [threading.Thread(target=_call, args=(uri, *c[:4], out, i), kwargs=c[4]) for i, c in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(30)
    return out


def check(name: str, cond: bool, detail) -> None:
    if not cond:
        raise SystemExit(f"FAIL {name}: {json.dumps(detail, default=str)}")
    print(f"PASS {name}")


def run(uri: str) -> None:
    print("-- test_parallel.py")
    with psycopg.connect(uri, autocommit=True) as admin:
        # 1. same key, simultaneous
        files = _files(admin, A8, 2)
        b = threading.Barrier(2)
        out = _run_pair(uri, [("10.9.0.1", A8, "parallel-same-key-0001", files, {"barrier": b}),
                              ("10.9.0.2", A8, "parallel-same-key-0001", files, {"barrier": b})])
        states = sorted(o["state"] for o in out)
        ids = {o["submission"]["id"] for o in out}
        n = admin.execute("select count(*) from submissions where idempotency_key = 'parallel-same-key-0001'").fetchone()[0]
        check("2 parallel create_submission, same key: 1 row, created + replayed, same id",
              states == ["created", "replayed"] and len(ids) == 1 and n == 1, out)

        # 2. different keys, max_attempts 1, simultaneous
        f1, f2 = _files(admin, A7, 1), _files(admin, A7, 1)
        b = threading.Barrier(2)
        out = _run_pair(uri, [("10.9.0.3", A7, "parallel-max1-key-aaaa", f1, {"barrier": b}),
                              ("10.9.0.4", A7, "parallel-max1-key-bbbb", f2, {"barrier": b})])
        states = sorted(o["state"] for o in out)
        n = admin.execute("select count(*) from submissions where assignment_id = %s and student_id = %s",
                          (A7, STUDENT)).fetchone()[0]
        check("2 parallel attempts on a max_attempts=1 link: one created, one max_attempts, 1 row",
              states == ["created", "max_attempts"] and n == 1, out)

        # 3. first transaction stays open → the second waits for the lock and replays
        files = _files(admin, A8, 1)
        t0 = time.time()
        out = _run_pair(uri, [("10.9.0.5", A8, "parallel-held-key-0001", files, {"hold_s": 1.0}),
                              ("10.9.0.6", A8, "parallel-held-key-0001", files, {"start_delay": 0.3})])
        waited = time.time() - t0
        check("second call waits on the advisory lock, then replays the first",
              out[0]["state"] == "created" and out[1]["state"] == "replayed"
              and out[0]["submission"]["id"] == out[1]["submission"]["id"] and waited >= 1.0, out)
