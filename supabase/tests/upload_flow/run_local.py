"""
Local test run for 18_upload_flow.sql on a throw-away Postgres 16 (never the live DB).

    python -m venv <some folder OUTSIDE the repo>/pgtest
    <that folder>/pgtest/Scripts/pip install pgserver "psycopg[binary]"      # Postgres 16 binaries, no Docker
    <that folder>/pgtest/Scripts/python supabase/tests/upload_flow/run_local.py

Builds: 00_supabase_stub.sql → 01_baseline_from_audit.sql → migrations 01, 02, 05, 05b, 10, 11, 12, 17 → 18 (twice:
re-run must be safe) → 22 (the baseline has production's legacy submissions_status_check) → 18_upload_flow_test.sql (SQL assertions) → test_parallel.py (two real connections).
The cluster lives in a temp folder and is deleted at the end.
"""

import pathlib
import subprocess
import sys
import tempfile

import pgserver

HERE = pathlib.Path(__file__).resolve().parent
MIGRATIONS = HERE.parent.parent / "migrations"
PSQL = pathlib.Path(pgserver.__file__).parent / "pginstall" / "bin" / "psql"

FILES = [
    HERE / "00_supabase_stub.sql",
    HERE / "01_baseline_from_audit.sql",
    MIGRATIONS / "01_access_helpers.sql",
    MIGRATIONS / "02_rls_policies.sql",
    MIGRATIONS / "05_student_portal.sql",
    MIGRATIONS / "05b_drop_anon_policies.sql",
    MIGRATIONS / "10_smart_assignment_checks.sql",
    MIGRATIONS / "11_assignment_ai_check.sql",
    MIGRATIONS / "12_copy_checker.sql",
    MIGRATIONS / "17_check_copies_student_scope.sql",
    MIGRATIONS / "18_upload_flow.sql",
    MIGRATIONS / "18_upload_flow.sql",          # idempotency
    MIGRATIONS / "22_drop_legacy_submission_status_check.sql",   # production applied it right after 18
    MIGRATIONS / "22_drop_legacy_submission_status_check.sql",   # idempotency
    HERE / "18_upload_flow_test.sql",
    MIGRATIONS / "19_upload_link_portal.sql",
    MIGRATIONS / "19_upload_link_portal.sql",    # idempotency
    HERE / "19_upload_link_portal_test.sql",
    MIGRATIONS / "20_assignment_test_link.sql",
    MIGRATIONS / "20_assignment_test_link.sql",  # idempotency
    HERE / "20_assignment_test_link_test.sql",
    MIGRATIONS / "21_access_code_normalize.sql",
    MIGRATIONS / "21_access_code_normalize.sql",  # idempotency
    HERE / "21_access_code_normalize_test.sql",
    HERE / "22_drop_legacy_submission_status_check_test.sql",
    MIGRATIONS / "23_open_link.sql",
    MIGRATIONS / "23_open_link.sql",              # idempotency
    HERE / "23_open_link_test.sql",
]


def run_sql(uri: str, path: pathlib.Path) -> None:
    print(f"-- {path.relative_to(HERE.parent.parent.parent)}", flush=True)
    r = subprocess.run([str(PSQL), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", uri, "-f", str(path)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = "\n".join(l for l in (r.stdout + r.stderr).splitlines()
                    if l.strip() and not l.endswith(("does not exist, skipping", "already exists, skipping")))
    if out:
        print(out)
    if r.returncode != 0:
        raise SystemExit(f"FAILED in {path.name}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    with tempfile.TemporaryDirectory(prefix="a4pg_") as data:
        srv = pgserver.get_server(data, cleanup_mode="stop")
        try:
            uri = srv.get_uri()
            for f in FILES:
                run_sql(uri, f)
            sys.path.insert(0, str(HERE))
            import test_parallel
            test_parallel.run(uri)
            print("\nALL UPLOAD-FLOW TESTS PASSED")
        finally:
            srv.cleanup()


if __name__ == "__main__":
    main()
