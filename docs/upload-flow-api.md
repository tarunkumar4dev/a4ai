# Upload flow: API contract

Migration: `supabase/migrations/18_upload_flow.sql`. Spec: [upload-flow-spec.md](upload-flow-spec.md). Recon: [upload-flow-recon.md](upload-flow-recon.md).
Tests: `supabase/tests/upload_flow/` (run with `run_local.py`; never on live).

**Rules**
- The upload link is an `assignments` row. Its URL carries `assignments.link_token`.
- Students never call the backend. They use the 4 RPCs below plus a direct upload to Storage, through `supabasePortalClient` (anon, no session).
- Student identity always comes from the access code (8 chars; old 6-digit codes still work). No RPC accepts a `student_id` from the client.
- One checker for everything. Each attempt becomes a `check_sheets` row with `source_bucket = 'submissions'` plus a `check_jobs` row, and the v4 worker grades it.
- All RPCs return `jsonb` with a `state`. Expected failures (wrong code, closed link, bad file) come back as a `state` and never throw.

---

## 1. Status of an attempt (`submissions.status`)

| status | meaning | student sees |
|---|---|---|
| `uploaded` | row created, about to be queued (only inside `create_submission`) | — |
| `waiting_key` | the teacher has not attached an answer key yet; it is queued automatically when the key is added | "Teacher ki answer key ka wait hai" |
| `queued` | job waiting for the worker (also while waiting for a retry after Gemini 429/5xx) | "Checking jaldi shuru hogi" |
| `checking` | worker is running | "Check ho raha hai" |
| `waiting_quota` | the teacher's daily AI limit was hit; the job runs on the next IST day | "Checking kal tak" |
| `checked` | AI result ready and clean, not yet published | "Checked — result teacher publish karenge" |
| `needs_review` | AI result has review reasons; never auto-published | same as checked |
| `published` | marks visible to the student | marks |
| `failed` | worker gave up after max retries (TIMEOUT/5xx/…) | "Dobara upload karo ya teacher se baat karo" |
| `rejected` | file unreadable (BAD_FILE: password PDF, corrupt, all blank…), reason in `reject_reasons`; **does not use up an attempt** | the reason |
| `submitted`, `graded` | legacy portal v1 rows (`submit_assignment`) | as before |

```
create_submission → uploaded ─┬─ (no key) → waiting_key ── key added ──┐
                              └─ queued ◄─────────────────────────────┘
queued → checking → checked ──────────────┬── publish_results → published ── unpublish_results → checked/needs_review
                  → needs_review ─────────┘   (auto_publish: checked only)
checking → queued (retry, backoff 30 s · 60 s · 120 s … max 10 min) → … → failed (after max_retries = 3)
checking → rejected (BAD_FILE) · waiting_key (KEY_MISSING) · waiting_quota (QUOTA)
```

`check_sheets.needs_review_reasons` (enum `a4_review_reason`): `empty_answer`, `illegible`, `low_confidence`, `key_missing`, `blank_pages`, `bad_scan`.

---

## 2. Student RPCs (anon)

Call them with `supabasePortal.rpc(name, args)`. Pass `p_ip_hash` only from tests. In production the IP comes from the request headers (`cf-connecting-ip` / `x-real-ip` / `x-forwarded-for`).

**Shared code states** (`a4_code_gate`):
- `invalid_code`: the code is wrong.
- `locked`: comes with `scope` (`ip` or `code`) and `retry_after_sec`.

**Only wrong codes count.** A correct code is never logged or limited, so a whole class on one school-WiFi IP can open the link at the same time.

| limit | trigger | effect |
|---|---|---|
| per IP | 20 wrong codes within 10 min | that IP is `locked` for 15 min after the 20th, so the 21st try is refused |
| per code | the same wrong code 10 times within 10 min, from any IPs | that code value is `locked` for 15 min |

- While an IP is locked, **a correct code from that IP is refused too.** If it weren't, the answer would still tell a guesser which code is right.
- Tries made while locked are not logged, so a lock can't extend itself.
- `access_code_attempts` stores `(ip_hash, code_hash, ts)` for wrong tries only, as SHA-256 values. Rows are deleted after a day.
- The per-code lock adds little protection on its own: a wrong code stays wrong whether it is locked or not. It mainly stops one script or person from hammering the same value. The real protection is the code space (8 chars from a 32-letter alphabet, about 10¹² values) together with the per-IP lock.

### 2.1 `get_assignment_link(p_ref text, p_code text = null, p_ip_hash text = null)`
`p_ref` is the link token or the assignment id. This RPC never returns the answer key or the rubric.

```json
// rpc('get_assignment_link', { p_ref: '3f9c1e…' })
{ "state": "open",                       // not_found | inactive | not_open | closed | open | open_late
  "server_time": "2026-10-22T09:30:00Z",
  "assignment": { "id": "…", "title": "Physics Unit Test 2", "instructions": "Upload all pages in order",
    "batch_name": "ECE-2", "opens_at": null, "closes_at": "2026-10-23T12:30:00Z", "grace_minutes": 2,
    "late_policy": "accept_flag", "count_policy": "latest", "max_attempts": 2,
    "allowed_mimes": ["application/pdf","image/jpeg","image/png","image/webp"], "max_mb": 10, "max_pages": 30,
    "max_marks": 40 } }

// with p_code: + student (+ question_paper only for a student of the class)
{ "state": "open", "assignment": { … },
  "student": { "state": "ok", "name": "Asha Verma", "attempts_used": 1, "attempts_left": 1 },
  "question_paper": { "file_url": "https://…/assignments/…", "file_name": "paper.pdf" } }
// student.state: ok | not_in_class | invalid_code | locked
```
- `inactive` returns only `{state, title}`. `not_found` returns only `{state}`.
- `open_late` means the deadline plus 2 min of grace has passed and `late_policy = 'accept_flag'`, so uploads are allowed but marked late.
- Show times in IST. All windows are checked against the server clock only.

### 2.2 `verify_access_code(p_code text, p_ip_hash text = null)`
This is the "Ye aap hi ho?" step.
```json
{ "state": "ok", "student": { "name": "Asha Verma", "roll_no": "1", "class_level": "12", "section_name": "ECE-2",
  "batch_name": "ECE-2", "lab_batch_name": null, "institute_name": "MSIT", "email_masked": "a***@gmail.com" } }
```

### 2.3 Upload, then `create_submission(p_code, p_assignment_id, p_idempotency_key, p_files, p_ip_hash = null)`

**Client steps**
1. Create `idempotency_key` once per attempt, e.g. `crypto.randomUUID().replace(/-/g,'')` (16–128 chars, `[A-Za-z0-9_-]`). Save it in localStorage under the assignment id. **Do not regenerate it on retry.** Clear it only after a `created` or `replayed` response.
2. For each page:
   - Convert HEIC to JPEG in the browser (heic2any or canvas). Compress to about 1600 px JPEG. The bucket accepts `image/heic`, but the checker (`preprocess.py`) can't read it yet; a HEIC page ends up `rejected` (BAD_FILE). Don't add `image/heic` to a link's `allowed_mimes` until the backend converts HEIC.
   - Compute `sha256` with `crypto.subtle.digest` on the bytes you upload. The value is hex.
   - Upload to bucket **`submissions`** at `<institute_id>/<assignment_id>/<student_id>/<uuid>.<jpg|jpeg|png|webp|pdf>` with `upsert: false`. The ids come from `get_student_by_code` and the link.
   - A failed upload can be retried with a new uuid. The old object is never referenced.
3. Call the RPC:
```json
// p_files (page_order 1..n, unique; ≤ max_pages entries)
[ { "storage_path": "<inst>/<asg>/<student>/9b2d….jpg", "mime": "image/jpeg", "size": 412233,
    "sha256": "e3b0c442…", "page_order": 1 } ]
```
Responses:
```json
{ "state": "created",
  "submission": { "id": "…", "attempt_no": 1, "label": "Upload-1", "status": "queued", "is_late": false,
                  "submitted_at": "…", "files": [ { "page_order": 1, "mime": "image/jpeg", "size": 412233 } ],
                  "reject_reasons": [], "result": null },
  "warnings": [ { "code": "same_as_earlier_upload", "page_order": 1, "message": "Page 1 wahi file hai jo Upload-1 me bheji thi." } ],
  "attempts_left": 1 }
{ "state": "replayed", "submission": { … } }          // same key again: the same attempt, no new row
{ "state": "invalid_files", "errors": [ { "index": 2, "code": "too_large", "message": "Page 2 bahut badi hai (12.4 MB). Max 10 MB." } ] }
```
Other states:
- `invalid_code`, `locked`
- `not_found`: wrong assignment, or the student is not in its class
- `inactive`
- `not_open` (comes with `opens_at`)
- `closed` (comes with `closes_at`)
- `too_many_requests`: 3 submits per minute per student per assignment; comes with `retry_after_sec`
- `max_attempts` (comes with `max_attempts` and `attempts_used`)
- `invalid_request`: bad key, or a key used by someone else
- `conflict`: retry it

File error codes:
- `no_files`, `too_many_files`, `bad_entry`
- `bad_path`: not this student's folder
- `duplicate_file`, `bad_page_order`
- `bad_format`: mime not allowed, or the mime and the extension don't match
- `bad_sha256`
- `not_uploaded`: no Storage object at that path
- `empty_file`
- `too_large`: checked against Storage's own `metadata.size`
- `file_reused`: the file was already used by an earlier attempt

Server guarantees:
- All attempts of one student on one assignment run one at a time, under `pg_advisory_xact_lock(hashtext(assignment_id || student_id))`.
- `attempt_no = max + 1` is assigned on the server.
- The unique index `(assignment_id, student_id, attempt_no)` is the safety net. One retry happens on a clash.
- `rejected` attempts don't count toward `max_attempts`.
- Same bytes as another student's upload sets `dup_other_student: true` on that file. Only teachers see it.

**Storage rules** (bucket `submissions`, private). These hold even for files that never become an attempt:

| rule | where |
|---|---|
| max 10 MB per file | bucket `file_size_limit`. A link's `max_mb` is 1–10, and a constraint keeps it ≤ the bucket limit. |
| `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf` | bucket `allowed_mime_types` |
| path `<inst>/<asg>/<student>/<uuid>.<jpg\|jpeg\|png\|webp\|heic\|pdf>` | insert policy `a4_valid_submission_path`: student of the link's class, link open (or `accept_flag` late), extension in the link's `allowed_mimes` |
| no overwrite, no listing | `upsert: false`; anon has no SELECT/UPDATE on objects |

**Unattached uploads are cleaned up.** These are files older than 24 h on the upload-link path that are not in any attempt's `files`, e.g. the student closed the tab, or an upload was retried with a new uuid.
- Every hour (`17 * * * *`), pg_cron job `a4-orphan-upload-cleanup` runs `a4_enqueue_orphan_cleanup()`. That inserts one `check_jobs` row of kind `retention`, with key `retention:orphan-uploads:<UTC hour>`, but only if there is something to delete.
- The worker deletes the files (§4.2).
- Old portal v1 files (`<inst>/<asg>/<student>_<ms>.pdf`) are never touched.
- The cleanup can't be pure SQL. Deleting `storage.objects` rows in SQL leaves the file bytes in Storage, so files must be removed through the Storage API.

### 2.4 `my_submissions(p_code, p_assignment_id, p_ip_hash = null)`
This is the history list for the link page. Marks appear only after the teacher publishes.
```json
{ "state": "ok",
  "assignment": { "id": "…", "title": "…", "max_attempts": 2, "count_policy": "latest" },
  "attempts_used": 2, "attempts_left": 0,
  "attempts": [
    { "id": "…", "attempt_no": 2, "label": "Upload-2", "status": "checking", "is_late": false, "counts": true,
      "files": [ … ], "reject_reasons": [], "result": null },
    { "id": "…", "attempt_no": 1, "label": "Upload-1", "status": "published", "counts": false,
      "result": { "marks": 8, "max_marks": 10, "percentage": 80, "feedback": "Good work", "published_at": "…",
                  "per_question": [ { "q_no": "1", "max_marks": 4, "marks": 3, "counted": true,
                                      "not_attempted": false, "feedback": "ok", "confidence": "high" } ] } } ] }
```
`counts` marks the attempt that counts:
- `latest`: the newest attempt that was not rejected.
- `best`: the published attempt with the highest marks. If none is published yet, it falls back to latest.

Poll this every 60 s and on window focus. Anon users can't subscribe to Realtime.

---

## 3. Teacher RPCs (authenticated)

Who can call them: institute admins, plus staff who can see the assignment's batch. This is the same audience as the `sub_grade` policy.

| RPC | Returns |
|---|---|
| `publish_results(p_assignment_id uuid = null, p_submission_ids uuid[] = null)`. Pass exactly one. | `{state:"ok", published:[id], blocked:[{id,status}], skipped:[{id,status,reason}]}` |
| `unpublish_results(p_submission_ids uuid[], p_reason text)`. Reason must be 3–500 chars. | `{state:"ok", unpublished:[id], skipped:[{id,reason}]}` |
| `override_marks(p_submission_id, p_q_no text, p_marks numeric, p_note text = null)` | `{state:"ok", total, published, question:{…, teacher_marks, counted}}` |

`publish_results`:
- **blocks** attempts in `uploaded`, `queued`, `checking`, `waiting_key` or `waiting_quota`
- **publishes** attempts in `checked` or `needs_review`
- **skips** everything else (`already_published`, `not_checked`, `forbidden`)

Publishing does three things:
- sets `check_sheets.published = true`, `published_at`, `reviewed_by`, `status = 'approved'`, and `final_marks = teacher_total ?? ai_marks`
- sets `submissions.status = 'published'`, `grade` and `graded_by`
- writes an audit row

`unpublish_results`:
- sets the attempt back to `checked` (or `needs_review` if it has review reasons)
- sets `grade = null`, so the old portal feed hides it too
- writes an audit row that includes the reason

`override_marks`:
- uses the same rule as the backend's `PATCH /copy-checker/sheets/{id}/questions/{q}/marks`. OR groups are decided again: the best `attempt_count` alternatives count, and the total is capped at the max.
- keeps the AI's marks in `marks_awarded`.
- If the attempt is already published, `grade` and `final_marks` follow the override straight away.

Errors: `unauthorized`, `forbidden` (also returned for ids the caller can't see), `invalid_request`, `not_checked`, `question_not_found`.

**Audit:** every publish, auto-publish, unpublish and override goes to `smart_assignment_checks`. `result_json.type` is one of `publish | auto_publish | unpublish | teacher_override`, and the row carries `submission_id`, `assignment_id` and `check_sheet_id`. Override rows also hold `previous_marks`, `new_marks`, `sheet_total_before` and `sheet_total_after`. No separate marks_history table was added.

**Answer key versions** (`assignment_ai_keys.version`):
- Changing `answer_key_path` bumps the version. The version can't be set by hand.
- When the version changes, unchecked attempts (`uploaded`, `queued`, `waiting_quota`) are re-pinned to the new version.
- Attempts in `waiting_key` are queued as soon as a key exists.
- Checked attempts keep their old version. A re-grade RPC is **not built yet**.

---

## 4. Backend worker contract (checker-v4 G2; as built: §4.4)

### 4.1 Kick
When a job is inserted, Postgres sends one call per INSERT statement:

```
POST <vault: checker_job_run_url>          e.g. https://rag-backend…/api/v1/internal/jobs/run
X-Job-Secret: <vault: checker_job_secret>
Content-Type: application/json
{}
```
- The sweep (`a4_checker_sweep`, pg_cron every minute) sends the same call whenever a job is due.
- The endpoint must compare `X-Job-Secret` in constant time, answer `202` straight away, and do the work inside the same invocation's budget. On Vercel Hobby that is 300 s; use about 240 s for work.
- Add `/api/v1/internal/` to the rate-limit exempt list. It is already in `EXEMPT_PREFIXES`.

### 4.2 Loop (service-role client)
```
while time_left > 120 s:
    job = rpc('a4_claim_check_job', { p_max_running: MAX_RUNNING_JOBS })   # [] → stop
    if job.kind == 'retention':                       # hourly unattached-upload cleanup
        paths = rpc('a4_orphan_submission_files', { p_limit: 500 })     # re-checked at delete time, ≤ 1000
        storage.from_('submissions').remove(paths)    # Storage API, in batches of 100
        rpc('a4_finish_check_job', { p_job_id: job.id, p_ok: true, p_usage: { deleted: len(paths) } })
        continue                                      # anything left → next hour's job
    sheet = check_sheets[job.sheet_id]; sub = submissions[job.submission_id]; session = check_sessions[job.session_id]
    files: bucket = sheet.source_bucket ('submissions' for portal) ; paths = sheet.pages (page order)
    rubric: session.source == 'assignment' → assignment_ai_keys (path in private bucket 'answer-keys')
            + assignments.file_url (question paper); build once per key version, cache in session.rubric
            no assignment_ai_keys row → finish(KEY_MISSING). Unchecked attempts are always pinned to the
            current version (the key trigger re-pins them), so the current key = sub.answer_key_version
    result = grade_copy(files, rubric, strictness)
    UPDATE check_sheets SET ai_result, ai_marks, max_marks, status='checked', checked_at, error=null,
                            needs_review_reasons, confidence (0..1), model_version      # per_question is derived by a trigger
    rpc('a4_finish_check_job', { p_job_id, p_ok: true, p_usage })
  on error → rpc('a4_finish_check_job', { p_job_id, p_ok: false, p_error_code, p_error /* teacher-safe */ })
```

| `p_error_code` | job | submission |
|---|---|---|
| `GEMINI_429`, `GEMINI_5XX`, `TIMEOUT`, `UNKNOWN` | `queued`, `next_run_at` with backoff, until `retries = max_retries` (3), then `failed` | `queued`, then `failed` |
| `BAD_FILE` | `failed` | `rejected` + reason (the attempt doesn't count) |
| `KEY_MISSING` | `failed` | `waiting_key` (re-queued when a key is saved) |
| `QUOTA` | `blocked_quota` until the next IST midnight (the run is not counted) | `waiting_quota` |
| `PAUSED`, `BUDGET` | `paused` (no automatic resume) | `queued` |
| `SCHEMA`, `CALL_CAP`, `FILES_EXPIRED` | `failed` | `failed` |

- `a4_claim_check_job` takes a global advisory lock, respects `p_max_running`, uses `FOR UPDATE SKIP LOCKED`, and adds 1 to `retries`.
- A run stuck in `running` for more than 6 min is re-queued by the sweep, or failed once it is at `max_retries`.
- The job idempotency key is `check:<sheet_id>:k<key_version>`.
- **Store the marks, never recompute them.** A retry after `done` must not call Gemini again.

### 4.3 Backend changes this needs (G3)
1. `_download_own` only allows `answer-sheets/<teacher uid>/…`. For portal sheets it has to download from `submissions` instead: the path must equal one of `sheet.pages` and the sheet must be loaded with the service key from the job.
2. `_save_norm_pages` writes to `answer-sheets/<teacher>/<session>/<sheet>/norm/`. That is fine for portal sheets too, because the teacher owns the session.
3. Daily limit: `_checks_today` only excludes `type = teacher_override`. It must also exclude `publish`, `auto_publish` and `unpublish`, otherwise publishing a class uses up the teacher's 100 checks a day. The worker should count the quota per job and return `QUOTA`.
4. Map the v4 result to the new columns: `needs_review_reasons`, `confidence`, `model_version`.

---

### 4.4 As built (backend worker, 23 Oct)
Where the backend differs from 4.1–4.3 above (the owner's fixed facts win):
- **URL:** `POST /internal/jobs/run`, no `/api/v1` (that is what the vault `checker_job_run_url` holds). Header `X-Job-Secret`
  is compared with env **`JOB_SECRET`** (`hmac.compare_digest`); missing / wrong / unset → `401`. `202` + the work runs as a
  background task of the same invocation.
- **Queue SQL:** direct Postgres (`DATABASE_URL`, `app/core/db_pool.py`), always through `a4_claim_check_job` /
  `a4_finish_check_job`, so marks + audit row + checkpoint `graded` are written in one transaction (a retry finishes without Gemini).
- **Files:** only paths in both `submissions.files` and `check_sheets.pages`, inside `<inst>/<asg>/<student>/`, read with the
  service key. Checked from their bytes before any Gemini call: magic bytes vs name/mime, PDF password (`needs_pass`) and page
  count (cap = `assignments.max_pages`, hard 30), photo readable, EXIF/GPS removed (the original in Storage is overwritten
  without it), sha256 duplicates (same file twice / same as another student: teacher-only `sheet_flags`). Problems →
  `BAD_FILE`; `reject_reasons` gets one entry per file `{code, page_order, message}`; every message the worker writes (reject reasons, job errors, review notes) is short plain English.
- **HEIC:** `preprocess.py` reads HEIC/HEIF (pillow-heif), so `image/heic` may be added to a link's `allowed_mimes`. The portal
  still converts HEIC to JPEG in the browser.
- **Long copies:** > 12 pages → Stage A once, pages saved to `answer-sheets/<teacher>/<session>/<sheet>/src/`, then chunk jobs of
  10–12 pages (`kind='check'`, `submission_id` null, `checkpoint.parent` = the copy's job, so the state triggers ignore them).
  The copy's job waits as `queued` (retry given back; students see `checking`), is woken when the last chunk ends, and merges
  by question (answered in two chunks → higher marks + `low_confidence`). A chunk that failed for good fails the copy.
- **Review:** per question (counted ones only): not attempted → `empty_answer`, `legibility_issue` → `illegible`, confidence
  below `review_min_confidence` of that rubric question (default env `CHECKER_REVIEW_MIN_CONFIDENCE=medium`) → `low_confidence`,
  estimated marking split → `key_missing`; blank page → `blank_pages`; `readability_score = poor` → `bad_scan`.
  `check_sheets.confidence` = mean of high 0.95 / medium 0.75 / low 0.4.
- **Limits:** quota = teacher's `SMART_CHECKER_DAILY_LIMIT` (100) per **IST** day, counted from `smart_assignment_checks` rows
  without `result_json.type` in (`teacher_override`, `publish`, `auto_publish`, `unpublish`, `regrade`) + the teacher's other
  running copies → `QUOTA`. Daily spend cap `CHECKER_DAILY_BUDGET_INR` (sum of `check_jobs.usage.est_cost_inr` today, price env
  `CHECKER_PRICE_IN_PER_M_INR` / `CHECKER_PRICE_OUT_PER_M_INR`): over it the worker claims nothing (jobs stay `queued`) and logs
  `ALERT`; it resumes by itself on the next IST day or when the cap is raised. `BUDGET` / `PAUSED` are not used.
- **Unreadable answer key / question paper** → `KEY_MISSING` (attempt goes to `waiting_key`, re-queued when the key is saved).
- **Re-grade:** `POST /internal/regrade {assignment_id, submission_ids[]}` with the teacher's Supabase JWT (`a4_can_grade_assignment`).
  Attempts in `checked | needs_review | published | failed` whose `answer_key_version` is older than the key get a new job via
  `a4_enqueue_submission`; old marks go to `smart_assignment_checks` (`type: regrade`, previous marks / per_question / key version);
  published ones are unpublished first with the teacher's JWT (`unpublish_results`, audited). Same key version → `key_unchanged`.

## 5. Owner setup (staging first, then live)
1. Run `18_upload_flow.sql`, then the VERIFY block at the end of the file. It needs 10, 11, 12 and 17 to be applied first.
2. **pg_net and pg_cron are not enabled.** This was last checked on 21 Oct, and 18 prints a NOTICE when they are missing. Enable both in the Supabase dashboard (Database → Extensions).
3. Create the vault secrets:
   ```sql
   select vault.create_secret('https://<backend>/api/v1/internal/jobs/run', 'checker_job_run_url');
   select vault.create_secret('<random 32+ bytes>', 'checker_job_secret');
   ```
   Put the same secret in the backend env as `CHECKER_JOB_SECRET`. Set it in the terminal, never in a committed file.
4. Re-run 18. This schedules `a4-checker-sweep` (every minute) and `a4-orphan-upload-cleanup` (hourly), and running it again is safe. Without pg_cron both functions still exist; they are just not scheduled. Check with `select jobname, schedule from cron.job;`.
5. Check that real client IPs reach Postgres. Make 2 portal calls, then run `select ip_hash, count(*) from access_code_attempts group by 1`. If all rows show `no-ip`, every student shares one rate-limit bucket.

## 6. Known limits / open points
- **School WiFi:** correct codes are never limited (§2). The remaining risk: if one class makes 20 typos within 10 min on one IP, that IP is locked for 15 min, and the lock blocks correct codes too. Raise `c_ip_max` in `a4_code_gate` if this happens in real use.
- **Storage can't identify the student:** anon uploads carry no identity. Storage only checks that the path belongs to a student of the assignment's class while the link is open. Someone with the class roster could put junk files in another student's folder. They can't attach those files to that student's attempt, because `create_submission` only accepts files from the code holder's own folder. Closing this fully needs signed upload URLs from the backend, which the "no backend for students" rule doesn't allow.
- The old portal `submit_assignment` now refuses an assignment once the student has an upload-link attempt on it. Switch the portal UI to the new RPCs per assignment.
- A teacher who owns the check session can still update `check_sheets` / `submissions` directly through RLS, as today. The RPCs are the audited path.
- Not built (spec 8B / later gates): re-grade RPC, retention of checked copies (90-day policy; only the unattached-upload cleanup exists), variants, similarity, watermark, result share links (`share_links`), ZIP export.

## 8. Open link (migration 23)

`assignments.link_identity_mode` = `access_code` (default) | `open`. An open link takes uploads from anyone with the
link, no access code. `get_assignment_link` returns `assignment.identity_mode` (`open` only while the upload link is
on) and, for open links, the question paper.

Student (anon):

| RPC | Args | Returns |
|---|---|---|
| `open_start` | `p_token, p_guest_name, p_guest_roll?, p_guest_class?, p_submitter_key?` | `{state: ok, submitter_key, upload_prefix, attempts_used, attempts_left}` · `not_found` · `inactive` · `invalid_name` · `invalid_request` · `too_many_requests` |
| `open_create_submission` | `p_token, p_guest_name, p_guest_roll, p_guest_class, p_submitter_key, p_idempotency_key, p_files` | as `create_submission` + `invalid_submitter`, `invalid_name` |
| `open_my_submissions` | `p_token, p_submitter_key` | as `my_submissions` + `guest {name, roll, class}`; `invalid_submitter` |

- The submitter key is made by the server in `open_start` (the "Continue" button) — the Storage path contains it, so it
  must exist before the first page is uploaded. `open_create_submission` with no / an unknown key → `invalid_submitter`.
  Same key again in `open_start` = same device: details updated, same key back.
- Storage path: `{institute}/{assignment}/guest/{submitter_key}/{uuid}.{ext}` (storage policy checks the submitter
  belongs to this open link, link on, window open, format allowed).
- Name 2–60 characters after trimming (spaces collapsed), roll ≤ 30, class ≤ 60.
- Limits: 10 `open_create_submission` per IP per link per hour (a class on one school Wi-Fi IP shares them);
  30 new submitters per IP per link per hour; 3 submits / minute / submitter; `max_attempts` per submitter.
- The browser keeps `{key, prefix, name, roll, cls}` in localStorage `a4ai_open_<token>`; the same device sees its
  uploads and published results. Receipt shown to the student: first 8 hex of the attempt id (`XXXX-XXXX`).

Teacher: guest rows are `submissions` with `student_id` null + `guest_name/guest_roll/guest_class/submitter_key`
(readable through the usual RLS). Publish / unpublish / override / retry / history are unchanged.
`delete_guest_submissions(p_submission_ids uuid[])` removes guest rows only (`deleted[]`, `skipped[{id, reason:
forbidden | not_guest}]`); the files are cleaned up by the hourly orphan job after 24 h.

Worker: a guest attempt's files live under `guest/{submitter_key}/`, not `{student_id}/` (see the backend change below).
