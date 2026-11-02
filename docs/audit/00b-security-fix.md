# Security hotfix — 00b

Date: 2026-10-29. Scope: three fixes only. No change to generation, retrieval, prompts or schema.
Nothing is committed or deployed. I did not read, print or log any `.env` or secret value (the config tests neutralise `load_dotenv`).

Two repos changed (uncommitted): backend `Desktop\RAG-BACKEND-local\test-generator-backend\` and this frontend repo.

## 1. What changed

| File | Change |
|---|---|
| `BE:app/core/config.py` | `ENVIRONMENT` unset / empty / unknown → production. Only `development`, `dev`, `local`, `test` are dev. Dev mode now logs one `WARNING` line per bypass. New `ENVIRONMENT_EXPLICIT` flag |
| `BE:app/main.py` | One startup line after logging is configured: `Resolved ENVIRONMENT='…' (from env \| DEFAULT, ENVIRONMENT is not set), production=…` |
| `BE:app/api/v1/endpoints/test_generator.py` | `/export` and `/export-answer-key` take `Depends(require_user)`. `record_usage` moved after the `tests` insert and runs only if the insert returned a row |
| `BE:tests/conftest.py` | `ENVIRONMENT=development` via `setdefault` (the suite needs it now that the default is production) |
| `BE:tests/unit/test_security_hotfix.py` | New, 15 tests |
| `FE:src/lib/api.ts` | New `authJsonHeaders()` (Bearer token from the app session); `api.exportTest` / `api.exportAnswerKey` use it |
| `FE:src/components/GeneratedTestView.tsx` | `downloadFile` sends the token |
| `FE:src/pages/TestBuilderPage.tsx` | Both export calls send the token (see finding F-1) |
| `FE:src/utils/testPdfExporter.ts` | `backendExportBlob` sends the token (Checking Link / PDF export) |
| `FE:src/lib/__tests__/apiAuthHeaders.test.ts` | New, 2 tests |

`git diff --stat` (backend): 4 files, +32 / -14, plus the new test file. Frontend: 4 files modified, plus the new test file.

## 2. Fix 1 — every code path that branches on ENVIRONMENT

All in the backend `app/` (the legacy root `RAG-BACKEND-local/config.py` has its own ENVIRONMENT logic, but `api/index.py` imports `app.main`, so it is not on the deployed path).

| Where | Before (unset = development) | After (unset = production) |
|---|---|---|
| `config.py` `IS_PRODUCTION` / `DEBUG` | prod only for `production`/`prod` | dev only for `development`/`dev`/`local`/`test` |
| `config.py` `CORS_ORIGINS` default | `localhost` list when env var not set | **empty** → startup error (next line) |
| `config.py` `_validate()` | production-only checks were skipped | **raises `RuntimeError` at import** if: `SUPABASE_SERVICE_KEY` missing; `CORS_ORIGINS` empty, contains `*`, or any `http://localhost…`. (`RAZORPAY_KEY_SECRET` missing is only a warning) |
| `main.py` `docs_url` / `redoc_url` / `openapi_url` | public | `None` (404) |
| `test_generator.py` `check_usage` / `record_usage` zero-UUID bypass | active | off |

Correction to my earlier report: the zero-UUID bypass is **not reachable through the routes today**. `/generate-frontend`, `/generate` and `/save` set the user id from the JWT (`require_user`), so `check_usage` never sees an empty or zero id. The real exposure from the old default was the public `/docs` + OpenAPI schema and the relaxed config validation, not free generation.

### What breaks if production currently has ENVIRONMENT unset

I cannot see Vercel's environment, so this is conditional. Today the unset deploy runs as development. After the flip it is validated as production, and the process **fails to import (every request errors, full outage)** if any of these is true on the live project:

1. `SUPABASE_SERVICE_KEY` is not set. (Config accepts any value, but note `CLAUDE.md` records that the *local* key equals the anon key; check Vercel has the real service-role key.)
2. `CORS_ORIGINS` is not set. In dev mode an unset value falls back to localhost origins, which would already block `a4ai.in`, so it is most likely set. But:
3. `CORS_ORIGINS` contains `*` or any `http://localhost…` entry. In dev mode that was tolerated; in production it is fatal.

Also changes silently: `/docs`, `/redoc`, `/openapi.json` return 404 (anything bookmarked or scripted against them breaks). A value like `ENVIRONMENT=staging` used to be dev and is now production.

**Env var that must be set first:** `ENVIRONMENT=production` on the backend Vercel project (Production scope). Before the redeploy, confirm in the Vercel dashboard (names only, do not paste values): `SUPABASE_SERVICE_KEY` is set, `CORS_ORIGINS` is set and has no `*` and no `localhost`.

## 3. Fix 2 — export auth

- Both endpoints now return 401 without a valid Bearer token.
- **Ownership check: not implemented, deliberately.** These endpoints are stateless renderers: the body carries the full question list, there is no test id and no DB read (`test_generator.py` `export_test` / `export_answer_key`). "Fetch an answer key by id" does not exist here, so there is nothing to check ownership against. Adding it needs a design change (render from `questions` by `test_id`, which also breaks the NCERT Test Builder and Checking Link flows that export papers with no `tests` row). Left for your decision; not improvised.
- What the change does fix: anonymous callers can no longer use the PDF/DOCX renderer (CPU, watermark logo up to 2 MB, answer-key output) for free. The global rate limiter in `app/core/rate_limit.py` still applies per user.
- Routes in this router still without `require_user` (a test now pins this list, so a new unauthenticated route fails the suite):
  - `GET /test-generator/templates`, `GET /chapters`, `GET /ncert-questions`, `GET /ncert-question-stats` — read-only NCERT data
  - `POST /test-generator/quiz/create` — **writes a row to `quizzes` with no auth** (`test_generator.py` ~L1418). Reported, not fixed (outside the three fixes)
  - Everything else (`/generate-frontend`, `/generate`, `/verify-answers`, `/feedback`, `/save`, `/tests/{id}/add-manual-question`, `/test/{id}`) already has it.

### F-1 (found while fixing): TestBuilderPage never sent a token
`TestBuilderPage.getAuthHeaders()` reads `localStorage["sb-dcmnzvjftmdbywrjkust-auth-token"]`, but the app stores its session under `a4ai.auth.token` (`src/lib/supabaseClient.ts:28`). So that helper always returned no token. I changed only the two export calls to use the real session; the helper's other callers (ncert-questions reads, lines ~179 and ~1010) are untouched and still need no auth.

## 4. Fix 3 — charge ordering

Order is now: generate → `tests` insert → `record_usage` (only if the insert returned a row). If the insert raises or returns no row, the paper is still returned, usage is **not** charged, and an `ERROR` line says so.

Limits that remain (a transaction would be needed to remove them; not building a ledger here):
- If `record_usage` fails after a successful insert, the user keeps a free paper (this was already "non-fatal" before).
- If the DB is down, users get free papers until it recovers (the opposite of the old bug: charged-but-unrecorded).
- `check_usage` → generation → `record_usage` is still not atomic, so parallel requests can exceed the monthly limit.
- A paper that was not stored is later re-created by `/save` as "Untitled Test (recovered)" (class 10 / CBSE hard-coded); unchanged.

## 5. Test results

| Suite | Result |
|---|---|
| New `tests/unit/test_security_hotfix.py` (15) on the fixed code | 15 passed |
| Same file against the **original** `app/` + conftest (stashed, then restored) | 12 failed, 3 passed (the 3 are the "not blocked with a user" and "charged after a good insert" checks that old code also satisfies) |
| Full `tests/unit` on the fixed code | 67 passed, 1 failed: `test_cors_attempt_header::test_contest_submit_preflight_allows_attempt_id` |
| That CORS test on the **original** code (`test_ai_busy_routes` + `test_cors_attempt_header`) | fails identically, so pre-existing: an earlier test imports `app.main` first and the CORS env var in the second test file is ignored (order-dependent). Not touched |
| Frontend `vitest` `apiAuthHeaders.test.ts` | 2 passed (token added; none when signed out) |
| `tsc --noEmit -p tsconfig.app.json`, filtered to the 4 changed files + new test | no errors reported |
| Not run | `npm run build`, `npm run e2e`, any live or staging call |

A third frontend test ("does not throw when the session lookup fails") was dropped: it passed the assertion but vitest 2.1.9 marked the test failed because of the mocked rejection itself. The `catch` is trivial; flagging that it has no test.

## 6. Deploy order

1. **Backend env first.** In the backend Vercel project set `ENVIRONMENT=production`. Check (names only) that `SUPABASE_SERVICE_KEY` is set and `CORS_ORIGINS` has no `*` / `localhost`.
2. **Redeploy the current (old) backend commit** and check `/health` and one generation. This proves the production validation passes with the live env *before* any code change. If it crashes, fix the env and stop here.
3. **Deploy the frontend** (sends the token on exports). Safe while the backend still accepts unauthenticated exports.
4. **Deploy the backend commit** (Fix 1 default, Fix 2 auth, Fix 3 ordering).
5. Smoke test, signed in: generate a paper, download PDF + answer key, Test Builder export, Checking Link PDF. Signed out: export returns 401. Look for the startup log line `Resolved ENVIRONMENT='production' (from env)`.

Deploying the backend (step 4) before the frontend (step 3) breaks every export for signed-in users until the frontend lands (401). The Checking Link falls back to the client-side jsPDF PDF in that window; the others show "Export failed".

## 7. Rollback

- **Backend code:** in Vercel, promote the previous deployment (instant) or revert the backend commit. Fixes 2 and 3 are independent of Fix 1.
- **Env var:** leave `ENVIRONMENT=production`. Do not unset it as a rollback: with the old code an unset value means development (docs public, relaxed checks); with the new code it means production. To run dev mode deliberately, set `ENVIRONMENT=development` explicitly.
- **Frontend:** the token header is harmless if the backend is rolled back; no frontend rollback needed.
- **Config crash after step 2 or 4:** the fastest fix is correcting the named variable (`SUPABASE_SERVICE_KEY`, `CORS_ORIGINS`); the error message in the Vercel function log names it.

---

# Addendum — auth coverage patch (2026-10-29)

Extends 00b. No schema change, no change to generation, retrieval or prompts. Backend repo + this repo, uncommitted.

## A. Route auth changes

| Route | Before | After |
|---|---|---|
| `/modules/{create,process,list,{id},{id}/generate-test,{id}/generate-worksheet,{id}/download-worksheet}` and `/worksheet/{generate-direct,download}`, **both mounts** (`/api/v1/...` and the unprefixed copy; same functions, one change covers both) | none | `require_user` |
| `GET /modules/list`, `GET` and `DELETE /modules/{id}` | `teacher_id` from the query, required | teacher = token user. `teacher_id` is optional; a different value gives **403** |
| `POST /modules/create`, `/generate-test`, `/generate-worksheet`, `/download-worksheet`, `/worksheet/generate-direct` | `teacher_id` from the body | same rule: token user; foreign `teacher_id` gives 403 |
| `POST /modules/process` | no owner check at all (any `module_id`) | 404 unless the module belongs to the token user |
| `storage_path` on `/modules/create` and `/worksheet/generate-direct` | any path; the second one downloaded it with the service client | must start with `<token user id>/` else 403 (the frontend already uploads there); `..` or a leading `/` gives 400 |
| `POST /test-generator/quiz/create` | none | `require_user`; `teacher_id` must equal the token user (403); stored owner = token user |
| `POST /test-checker/extract-key` | none | `require_user` |
| `POST /contests` (create) | token optional, `teacher_id` NULL when anonymous | token required (401) |
| Community quizzes | create, delete, preview, list and teacher leaderboard already need a token; delete and leaderboard already check `teacher_id == caller` (403) | unchanged; tests added |

Left public on purpose (student play / public reads): contest `info`, `start`, `submit`, `leaderboard`; community-quiz `q/{slug}` + start, submit, leaderboard; NCERT reads, templates, chapters, `payment/plans`; payment + WhatsApp webhooks (signature or secret checks, not re-reviewed here).

## B. Frontend call sites (ship BEFORE the backend)

All now send the Bearer token (`authJsonHeaders()` from `src/lib/api.ts`):
- `src/pages/ModulesPage.tsx`: list, get, delete, generate-test (none sent a token before)
- `src/components/WorksheetModal.tsx`: generate-worksheet, download-worksheet
- `src/components/teacher/WorksheetGenerator.tsx`: worksheet/generate-direct, worksheet/download
- `src/components/ModuleCreator.tsx`: already sent the token on create + process; unchanged
- `contestApi.createContest` already sends the token; unchanged

No frontend caller exists for `quiz/create` or `test-checker/extract-key` (grep of `src/`), so those two cannot break the app. External callers (scripts, other apps) are unknown.

**TestBuilderPage `getAuthHeaders`:** left as is. Its only two callers are `ncert-questions` and `ncert-question-stats`, which this patch did not touch (still public NCERT reads). Fix its key only if those two ever get `require_user`.

**Prefixed vs unprefixed `/modules`:** the frontend builds `${VITE_API_URL}/modules/...` (no `/api/v1`), so the unprefixed mount is the live one if `VITE_API_URL` is the bare host. The `/api/v1/modules/*` copies have no caller in `src/`, but that depends on the Vercel value of `VITE_API_URL`, which I could not see. Nothing deleted.

## C. What becomes 401 for a currently-working flow

- Signed-out use of Modules / Worksheet: those pages need a session today (teacher id comes from it), so no real flow loses access.
- **Signed-out "Share as Contest"**: `POST /contests` used to accept no token (contest with no owner). It needs a login now. If the public test generator (`/dashboard/test-generator`, public by design) lets a signed-out visitor press "Share as Contest", that visitor now gets 401. Your call whether that is acceptable.
- Old scripts or mobile builds calling `/modules/*` or `/worksheet/*` without a token.
- A client sending a `teacher_id` that is not the logged-in user now gets 403.

## D. Needs your decision (not fixed)

1. **Unmetered LLM spend.** `/modules/{id}/generate-test`, `/generate-worksheet`, `/download-worksheet` (when no `worksheet_data`), `/worksheet/generate-direct`, `/modules/process` (Gemini summary) and `extract-key` call Gemini and none go through `check_usage` / `record_usage`. They are now authenticated and under the global per-user rate limiter, but have no monthly quota. Smallest fix: call `check_usage(user.id)` before and `record_usage(user.id, ...)` after success in those handlers, reusing the helpers in `test_generator.py` (L52 / L118). Not done: it changes what free users can do (product decision) and I cannot see how the usage tables treat a non-"test" action.
2. `/worksheet/generate-direct` passes the request's `subject`, `chapter_name`, `question_types` straight into the prompt. Only affects the caller's own output. Out of scope.
3. `contests/{id}/leaderboard` still reads the token as optional (teacher vs public view). Read-only; left public.
4. `quiz/create` does not check that `test_id` belongs to the caller (Test Builder papers have no `tests` row). Owner is correct; the referenced test is not verified.
5. `modules.py` error bodies still include `str(e)` for PDF/worksheet failures. Not touched.
6. Pre-existing, unrelated: `WorksheetGenerator.tsx:575` uses `AlertCircle` without importing it (tsc TS2304); a runtime crash if that branch renders.

## E. Tests

- `tests/unit/test_auth_coverage.py` (new): every `/modules` + `/worksheet` route on both mounts returns 401 with no token; foreign `teacher_id` gives 403 on 8 shapes x 2 mounts; the teacher id reaching `ModuleService` is the token user (list, delete); `process` ownership (404, not run); `storage_path` foreign folder 403, traversal 400; `quiz/create` 401 / 403 / owner = token user; `extract-key` 401 and not blocked; contest create 401 (service never called) and owner = token user; community-quiz delete / create / preview 401, and delete of another teacher's quiz 403; **whole-app guardrail**: every `APIRoute` must depend on `require_user` (or `require_caller`) or be listed in `PUBLIC_BY_DESIGN` / `INLINE_REQUIRED`, so a new unauthenticated route fails the suite.
- `tests/unit/test_security_hotfix.py`: `POST /test-generator/quiz/create` removed from `KNOWN_PUBLIC`.
- Frontend: header additions only. `authJsonHeaders` is covered by `apiAuthHeaders.test.ts` (2 pass). `tsc` reports no new error in the three edited files. Not run: `npm run build`, e2e, any live call.
- Not tested: the real `ModuleService` against a database (faked).

## F. Combined deploy order (00b + this patch)

1. Backend Vercel env: `ENVIRONMENT=production`; confirm (names only) `SUPABASE_SERVICE_KEY` is set and `CORS_ORIGINS` has no `*` or `localhost`.
2. Redeploy the **old** backend commit; check `/health` and one generation (proves production validation passes).
3. **Deploy the frontend** (export headers from 00b + Modules / Worksheet headers from this patch). Safe against the old backend, which ignores the header.
4. Deploy the **new backend** (00b + this patch).
5. Smoke, signed in: generate, export PDF + answer key, Checking Link, Modules list / open / delete / generate test, Worksheet generate + download (module-based and PDF-direct), create a contest. Signed out: export 401, `/modules/list` 401.
6. In the Vercel log look for `Resolved ENVIRONMENT='production' (from env)` and for 403s on `/modules` (a client sending a foreign `teacher_id`).

Rollback: promote the previous backend deployment. The frontend headers are harmless on the old backend.
