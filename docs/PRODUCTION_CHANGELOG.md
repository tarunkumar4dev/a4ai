# Production changelog

Newest first. Details and evidence: the linked audit.

## 27 Oct 2026 — teacher dashboard (branch `perf/teacher-dashboard`)
Audit: `docs/TEACHER_DASHBOARD_PRODUCTION_AUDIT.md`.

- Coins load once per user instead of three times (`CoinContext`).
- Institute card: parallel queries, no logo HEAD request, cacheable logo (`InstituteTeacherPanel`).
- Test history: keyed on user id, cancellable, shows an error instead of an empty list.
- Idle prefetch limited to the login page on `/` (dashboards no longer download the landing/login code).
- Logo / banner uploads cached for 1 day.
- Migration `27_public_write_lockdown.sql` (not yet run on live): no public writes to `ncert_questions` /
  `ncert_chunks`, no anon read of `attendance_legacy`. Rollback + local test included.

Measured (local prod build): first-load data requests 19 → 13–15; JS files 68 → 21; JS 267 → 210 KB gzip;
institute card with 400 ms per request 4.9 → 3.6 s (median of 3).
