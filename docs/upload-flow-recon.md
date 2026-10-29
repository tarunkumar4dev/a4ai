# Upload flow — recon + gap report (22 Oct 2026)

Spec: `docs/upload-flow-spec.md`. Repos: frontend `product` (FE), backend `../RAG-BACKEND-local` (BE, FastAPI → Vercel `rag-backend`).
Recon = code + migrations + `RAG-BACKEND-local/docs/checker-v4-design.md` (live facts checked 21 Oct). Live DB not queried
this time (local Supabase CLI has no `db query`), so "applied on live?" is from CLAUDE.md / the design doc.

**TL;DR**
- Spec ka ~60% flow already hai, sirf naam alag hai: **assignment = "test link"**, `submissions` = submissions + results,
  student portal (access code) = identity + upload + history + marks, "✨ AI check" + "Approve & send" = check + publish.
- Spec jo "existing" maanta hai, uska bada hissa **abhi bana hi nahi**: koi job queue nahi (`check_jobs` sirf design doc mein),
  PyMuPDF red-pen nahi (abhi browser canvas + jsPDF stopgap), ZIP nahi, checker se WhatsApp share nahi.
- Do alag checker pipelines hain: portal submissions → v2 `grade_sheet` (1 PDF), Check Copies → v4 `grade_copy`
  (Stage A, multi-page, red pen). Is flow ko v4 pe le jaana hai.
- feat/checker-v4 dono repos mein **main mein merged nahi**.

---

## 1. Already kya bana hai

| Area | Status | Where |
|---|---|---|
| Test + answer key generation | ✅ | FE `src/pages/TestBuilderPage.tsx:1177` → `tests` (teacher_id, exam_title, total_marks, status) + `questions` (correct_answer, explanation, marks, format, position). History `src/lib/history.ts`. BE `app/api/v1/endpoints/test_generator.py`, `export-answer-key` |
| Answer key versioning | ❌ | Key = `questions.correct_answer` (test source) ya `assignment_ai_keys.answer_key_path` (1 file, overwrite). Sirf rubric cache key hai: `assignment_ai_keys.rubric_source` / `check_sessions.rubric` (`force` rebuild). No version, no pin |
| Test link / WhatsApp share | ⚠️ sirf online contests | BE `app/services/contest_service.py:202` short_code → `a4ai.in/contest/{code}`; FE `src/components/contest/CreateContestModal.tsx:162` `wa.me/?text=`. Copy-upload ke liye koi link/token nahi. Assignments portal feed mein dikhte hain (link nahi, access code) |
| Student access-code portal | ✅ | `supabase/migrations/05_student_portal.sql` RPCs `get_student_by_code` (name, roll, class_level, batch, institute — **email nahi**), `get_student_feed`, `submit_assignment`; FE `src/pages/StudentPortalPage.tsx` + `src/lib/supabasePortalClient.ts` (non-persisted). Codes: `07_security_hardening.sql:260` = **8-char crypto-random** (purane 6-digit bhi ho sakte hain) |
| Portal upload | ⚠️ | Direct-to-Storage (anon), bucket `submissions`, path `<inst>/<assignment>/<student>_<ts>.pdf`, **PDF only, ≤10 MB, 1 file** (`07` `a4_valid_submission_path` + storage policy; FE `StudentPortalPage.tsx:503,825`). Re-submit = same row overwrite (no attempts) |
| Portal AI check (teacher) | ✅ (v2 pipeline) | BE `app/routers/smart_assignment_router.py:402,491` (rubric from assignment paper + private key; `grade_sheet` on the 1 PDF). DB `11_assignment_ai_check.sql`: `submissions.ai_*`, `assignment_ai_keys`, bucket `answer-keys`. FE `src/components/teacher/TeacherAssignmentsTab.tsx` (AI check 3 parallel → review → Approve & send writes grade/feedback) + `src/components/checker/AiGradeBreakdown.tsx` |
| Copy checker v4 — Stage A | ✅ G1 | BE `app/services/answer_checker/preprocess.py` (PDF/photo → upright JPEG, password PDF reject, blank-page detect, rotation + page order from the grade call, `MAX_PAGES` 30, `sha256_files`), `copy_check.py` (`fit_pages` 18 MB inline budget, 2000→1600→1280 px) |
| Copy checker v4 — Gemini check | ✅ G1 | `app/services/smart_assignment_service.py` (`build_rubric`, `rubric_from_test_fast`, `usage_meter`, call cap 12/sheet, 90 s timeout, temp 0 + seed) ; router `app/routers/copy_checker_router.py` (rubric, check, per-question override) |
| Job queue | ❌ designed only | `checker-v4-design.md` §3 (`18_checker_v4.sql`: `check_jobs`, claim RPC, pg_net kick, pg_cron sweeper). Not written. Today: **teacher's browser** queues, 3 parallel synchronous requests (`src/components/checker/CheckSessionView.tsx:26,132`), "checking" > 6 min → failed + Retry (`:41`) |
| Red-pen render | ⚠️ stopgap | FE `src/components/checker/markedCopyExport.ts` (Canvas + jsPDF on backend norm pages, stored in `answer-sheets/.../rendered/`, 10-min signed URL). PyMuPDF renderer = checker-v4 G4, not built (font spike only, `scripts/spikes/font_spike.py`) |
| ZIP export | ❌ | Only `.xlsx` (`src/components/checker/checkerExport.ts`). ZIP = `check_jobs.kind='export_zip'` (designed) |
| Checker WhatsApp share / result link | ❌ | `share_links` table + `/r/{token}` designed (§3, rate-limit table "G6, not built yet") |
| Results / marks | ✅ (no separate table) | `submissions.grade numeric(6,2)`, `feedback`, `graded_at`, `graded_by`, `status`, `ai_*`; copy checker: `check_sheets.ai_result/ai_marks/final_marks/status='approved'` |
| Audit / history | ⚠️ partial | `smart_assignment_checks` (`10_*.sql`): one row per AI check + `result_json.type='teacher_override'` rows (copy checker override, `copy_checker_router.py:364`). `check_overrides` designed. Portal grade edits / unpublish: no audit |
| Storage buckets | — | `answer-sheets` private (verified live 21 Oct, owner-folder RLS) · `answer-keys` private (11) · `submissions` private per `13_role_hardening.sql` (13 run status unconfirmed) · `resumes` private (14) · `assignments` **public** (question papers) · `notes` **public** · `institute-assets` public read, admin write |
| RLS | ✅ | Institute scope via helpers (`01`, `02`, `07`): `assignments`/`submissions` `asg_*`/`sub_*` in `02_rls_policies.sql:222-277`. Checker tables owner-only (`teacher_id = auth.uid()`, `12`), roster guard `17`. Anon has no table policies (05b) |
| Rate limiter | ✅ backend only | `app/core/rate_limit.py` (route template + JWT sub / X-Attempt-Id / IP, in-memory per instance), limits `docs/checker-v4/g1-route-limits.md`. Daily cap `SMART_CHECKER_DAILY_LIMIT` 100/teacher (`smart_assignment_router.py:42`). Portal RPCs (`get_student_by_code`) = **no limit** (CLAUDE.md known issue) |
| Gemini retry/backoff | ⚠️ | 429 → 1 retry after Retry-After (≤30 s), then 503 `AI_BUSY` (design §8.1, `app/core/api_errors.py`). No re-queue/backoff (that's G2). Monthly budget breaker designed (§7.5), not built |
| HEIC / client compress | ⚠️ | `src/lib/imageCompress.ts` (canvas JPEG) used by Check Copies only; no HEIC handling; portal doesn't compress (PDF only) |

## 2. Spec §3 tables → existing schema

| Spec | Verdict | Map / what's missing |
|---|---|---|
| `test_links` | **missing → extend `assignments`** (no new table) | `assignments` already = test for a batch (institute_id, batch_id, title, deadline, max_marks, status, file_url = question paper). Add: `test_id` (→ tests, optional), `opens_at`, `closes_at` (or reuse `deadline`), `grace_min`, `late_policy` ('accept_flag'/'reject'), `max_attempts`, `count_policy` ('latest'/'best'), `max_mb`, `max_pages`, `allowed_kinds`, `link_token` (unique, unguessable), `auto_publish`. `is_active` = `status='active'` |
| `submissions` | **partial** | Has id, assignment_id (= link_id), student_id, status, submitted_at. Missing: `attempt_no`, `idempotency_key` unique, `is_late`, `answer_key_version`, `needs_review_reasons text[]`, `model_version`. Today 1 row per (assignment, student) and re-submit overwrites → need unique `(assignment_id, student_id, attempt_no)` + change `submit_assignment` |
| `submission_files` | **missing → prefer column** | Today single `file_url`. Option A (consistent with `check_sheets.pages text[]`): `submissions.files jsonb` `[{path, mime, size, sha256, order}]`. Option B: new table. Recommend A unless per-file queries needed |
| `check_jobs` | **missing** (designed in checker-v4 §3) | Build it in checker-v4 G2 and add `kind='portal_check'` + `submission_id` (or make portal submissions create a `check_sheets` row and reuse `kind='check'`). Don't build a second queue |
| `results` | **exists inside `submissions`** | grade/feedback/graded_by/graded_at + `ai_result/ai_marks/ai_status`. Missing: `published bool`, `published_at`, `reviewed_by` (≈ graded_by), per-question confidence lives in `ai_result`. Today "publish" = writing `grade` (feed shows `grade` whenever non-null) |
| `result_history` | **partial** | `smart_assignment_checks` stores every AI check + override rows. Missing for portal: snapshot on re-grade / teacher edit / unpublish, `answer_key_version`, `changed_by`. Extend `smart_assignment_checks` (`result_json.type` = 'regrade'/'override'/'unpublish') or `check_overrides` (designed) — don't add a 3rd |
| `answer_keys` | **missing (versioning)** | Extend `assignment_ai_keys` with `version int` (+ keep old paths/rubric in a small `assignment_ai_key_versions` or jsonb history). For test-sourced keys, version = hash of `questions` answers |
| Indexes | — | `submissions(assignment_id, student_id)`: not in repo migrations (check live). `check_jobs(...)` designed. `results` n/a |

Status machine mapping: spec `uploaded/queued/checking/checked/needs_review/published/failed/rejected/waiting_key` vs today
`submissions.status` ('submitted'/'graded') + `ai_status` ('checking'/'done'/'failed'). Needs one clear status column
(or keep `status` + `ai_status` and add `published_at`).

## 3. Check job duration

- BE runs on **Vercel Hobby, Fluid compute, 300 s max**, 2 GB, region bom1 (design §1). No worker: the check runs **inside
  the HTTP request** (`run_in_threadpool`). Gemini timeout 90 s, 1 retry on 429 (≤30 s wait), call cap 12/sheet.
- 30 pages: **size-wise fits** (20 phone pages @2000 px ≈ 4.2 MB vs 18 MB budget, §8.2). **Latency for 30 pages is not
  measured** — one Gemini call with 30 images + one rubric build + downloads/uploads of 30 norm pages from Mumbai.
  Planned answer is already in the design: **G3 chunking, 10–12 pages per chunk** (§8.2), and the queue worker gets a
  240 s budget per kick, claims a job only with ≥120 s left (D8).
- Verdict: ≤ ~12 pages = OK in one request/job. 13–30 pages = needs chunking (checker-v4 G3) before student uploads
  go live, because students can't press "Retry" like a teacher.

## 4. Branch status

- FE: `feat/checker-v4` = `origin/main` (116153d) + 3 commits (3f61b96, e65c9e8, 5099062). **Not merged.** Local `main`
  (d878391) is stale vs origin/main.
- BE: `feat/checker-v4` = `origin/main` (88a428b) + 9 commits (G0 docs, G1, AI_BUSY, 30-page cap, PyMuPDF pin + bom1).
  **Not merged.**
- Recommendation: first open/merge the checker-v4 G1 PRs (both repos) to main; then branch **`feat/student-upload`**
  from main in both repos. If merge has to wait, branch from `feat/checker-v4` (this flow needs Stage A + the G2 queue),
  never from stale local main.

## 5. Gate-wise gap list

### G1 — link + validation + identity
- Link object → **reuse `assignments`** + new columns (§2), `link_token`. New: RPC `get_link_info(token)` (title, rules,
  window by `now()`, attempts left if code given; never key). New: portal route `/s/:token` in `StudentPortalPage` → asks access code if not stored.
- Identity → **reuse `get_student_by_code`**; add "ye aap hi ho?" confirm (UI). Email: `students.email` exists but RPC
  doesn't return it → add (masked). Student must belong to the assignment's batch/lab batch → **reuse** the check in `submit_assignment`.
- Friendly invalid/expired page → new (UI).
- Access-code rate limit / lockout → **new**: DB counter table keyed by IP (`request.headers` x-forwarded-for) + code prefix, checked inside `a4_student_id_from_code`. Backend limiter can't help (portal never calls the backend).
- Teacher "Share on WhatsApp" for the link → **reuse** `wa.me` pattern from `CreateContestModal.tsx:162`.

### G2 — upload + idempotent submit + history
- Direct upload → **reuse** anon storage upload to `submissions`; **change** `a4_valid_submission_path` + bucket mimes to allow `p<n>.jpg` pages (today `.pdf` only) and per-assignment `max_mb`.
  Signed upload URLs (spec) are not needed: the storage policy already restricts path/size/type.
- Client: **reuse** `src/lib/imageCompress.ts`; new HEIC→JPEG (heic2any, lazy), page reorder, per-page progress, retry.
- Submit → **change** `submit_assignment` (or new `submit_attempt`): advisory lock, `attempt_no`, `max_attempts`, `idempotency_key` replay, late flag, files jsonb, sha256 duplicate warn, 3/min rate limit.
- Server validation (magic bytes, password PDF, page count, blank) → **reuse** `preprocess.py` (runs at check time → `rejected` with reason). EXIF strip: JPEG re-encode in Stage A already drops EXIF on norm pages; originals keep it → strip client-side (canvas re-encode does it).
- History → **extend** `get_student_feed` (all attempts + files + status) — new UI list in portal.

### G3 — wire to checker queue
- **Blocked on checker-v4 G2** (queue: `18_checker_v4.sql`, pg_net + pg_cron enable by owner, worker route `/internal/jobs/kick`).
- Pipeline → **reuse v4 `grade_copy`** (multi-page, Stage A, norm pages for red pen) instead of v2 `grade_sheet`.
  Simplest: each portal attempt creates a `check_sheets` row in a per-assignment `check_sessions` (teacher_id = assignment creator) → same queue, review UI, red pen, export. Needs service-role insert (portal is anon).
- Rubric → **reuse** `assignment_ai_keys` / `rubric_from_test_fast` (when assignment has `test_id`). No key → `waiting_key`.
- Status to student → **reuse** feed polling (60 s + on focus) — no Realtime for anon.
- 13–30 pages → checker-v4 G3 chunking.

### G4 — review / override / publish / result
- Review + per-question override → **reuse** Check Copies UI + `PATCH /copy-checker/sheets/{id}/questions/{q}/marks` (if G3 goes via check_sheets); otherwise `AiGradeBreakdown` in `TeacherAssignmentsTab`.
- Publish → **reuse** "Approve & send" (`TeacherAssignmentsTab.tsx:410-515`); new: `published_at`, unpublish, block while queued/checking, `auto_publish`.
- Student result → **change** `get_student_feed` to return grade/feedback only when published.
- Audit → **extend** `smart_assignment_checks` / `check_overrides` (§2).
- Student viewing own red-pen copy → new backend endpoint (access code → 5-min signed URL); CLAUDE.md already lists this gap.

## 6. Spec assumptions that conflict with the code

1. "check_jobs (existing queue reuse)" — **no queue exists**; checks are synchronous, driven by the teacher's open tab. "Student ko wait na karna pade" needs checker-v4 G2 first.
2. "Red-pen render via PyMuPDF, ZIP, WhatsApp share" in checker-v4 — red pen is browser jsPDF (stopgap); ZIP/share = designed, unbuilt.
3. "6-char access code" — codes are **8-char** since `07`.
4. Backend API (`GET /link/{token}`, `POST /uploads/sign`, `POST /submissions`, `GET /submissions/mine`) — current rule (design §8.1, CLAUDE.md step 5): **student routes = Supabase SECURITY DEFINER RPCs + direct Storage, never the backend.** Recommend RPCs for G1/G2; backend only for the check worker and signed result URLs.
5. Separate `results` / `result_history` / `test_links` / `submission_files` tables — not needed: `submissions`, `assignments`, `smart_assignment_checks` extend cleanly.
6. "Logged-in profile" identity — students have no login in the portal (access code only); `students.user_id` exists but no student-login flow uses it.
7. Rate limit "5/min/IP" on access code — portal RPCs don't pass through the backend limiter; must be done in Postgres.
8. "Daily Gemini cost cap + circuit breaker" — today only per-teacher 100 checks/day; budget breaker designed (§7.5). Student uploads count against the **teacher's** daily cap → a class of 40 × retries can hit it.
9. `model_version` stored per result — not stored today (model from env `CHECKER_GEMINI_MODEL`); `ai_result.usage` has tokens only. Add it.
10. "Student files expiry ~5 min signed URL" — teacher View PDF uses signed URLs (`src/lib/submissionFiles.ts`, 600 s); students can't re-open own file at all today.
11. Vercel Hobby = non-commercial terms + monthly caps; 500 copies/hour likely needs Pro (design §1 consequence 1, owner decision pending).

## 7. Open questions for the owner
- Merge checker-v4 G1 to main now, before starting this?
- Portal attempts → `check_sheets` (one checker, one UI) vs keep portal on `submissions.ai_*`? Recommendation: `check_sheets`.
- Which migrations are live: 13, 14, 15? (`submissions` bucket private depends on 13.)
