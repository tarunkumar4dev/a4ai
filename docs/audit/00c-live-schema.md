# 00c — Live schema inventory (PARTIAL: DB part NOT collected)

Date: 2026-10-29. Findings only. No queries were run against any database; no file other than this one was written.

## 0. Status — why the database sections are empty

I stopped before touching the DB, as your rules require.

- No read-only DB credential is available to me: no `DATABASE_URL` / `PG*` / `SUPABASE*` variable exists in this shell (I listed variable *names* only).
- The only route is the Supabase CLI (v2.39.2, linked to project `dcmnzvjftmdbywrjkust` via `supabase/.temp`). Earlier sessions used `supabase db query --linked`. That authenticates with your CLI login and runs SQL as a **privileged** role through the management API; it has no read-only mode. This CLI version also does not list a `db query` command (it is not in `supabase db --help`), so it may need a newer CLI.
- `supabase db dump` / `pull` would also need privileged access and would copy data, so I did not try them.

**What I need from you (pick one):**
1. A read-only Postgres role (SELECT on `public`, `information_schema`, `pg_catalog`, `supabase_migrations`) with its connection string in an env var that I never print, or
2. Your explicit OK to run catalog-only `SELECT` statements through the privileged CLI session (I will wrap each in `BEGIN READ ONLY` and list every statement before running it), or
3. You run the SQL pack I write (catalog + count queries only) in the Supabase SQL editor and paste back the output.

Sections 1-6 below are therefore **not collected**. Section 7 onward (code-only) is complete.

## 1. Column inventory — NOT COLLECTED
Tables requested: `questions`, `tests`, `ncert_chunks`, `ncert_questions`, `quizzes`, usage/quota tables. Nothing to report. For orientation only, what the code expects (not evidence of the live schema): see `00-verification.md` rows C4a-C4e.

## 2-6. Constraints/indexes, row counts, function bodies, migration history, drift, RLS, corpus stats, sizes — NOT COLLECTED

Repo-side facts that the DB queries must be compared against (from files, not the DB):
- Migration files that mention these tables: `supabase/migrations/20240101000000_enhanced_questions.sql` (defines `enhanced_questions`, `enhanced_test_generations`, `question_buckets`, `enhanced_analytics`, **not** `questions`/`tests`), `20261004120000_questions_rich_fields.sql` (adds 6 columns to `questions`), `27_public_write_lockdown.sql` (policies on `ncert_questions`, `ncert_chunks`).
- No repo file creates `public.tests`, `public.questions`, `public.ncert_chunks`, `public.ncert_questions` or `public.quizzes` except the backend's `test-generator-backend/supabase_migration.sql` (`tests` L49, `questions` L66, `quizzes` L99), which lacks the `/save` columns. `ncert_chunks` / `ncert_questions` have no DDL anywhere in either repo.
- `check_usage` / `record_usage` are called as RPCs (`BE:app/api/v1/endpoints/test_generator.py` L52, L118); their bodies are not in any repo file. Atomicity: **unknown**. The Python side is two separate calls around the whole generation (not atomic regardless of the SQL).
- `supabase/` contains `audit_2026-09-29.csv` (a Sept schema audit, 306 rows). It is a possible baseline for drift, but it predates the `questions` rich-fields migration (4 Oct) and I did not use it as live truth.

## 3. The four-column hypothesis — NOT SETTLED
`section`, `is_manual`, `image_url`, `answer_table` on `questions`: whether each exists live is **unknown**. Code facts only:
- `/save` writes all four (`BE:test_generator.py` L1298-1301); the fallback (L1318-1324) strips only `question_table, is_or, sub_parts, marking_scheme, model_answer, common_mistakes`.
- `add_manual_question` (L1349+) inserts a row too; I did not check which columns it sets.
- Consequence if any is missing live: the first insert fails, the fallback strips six other columns, the retry fails again, and `/save` returns 500 "Failed to save questions" (L~1330).
- Query that settles it (catalog-only): `select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='questions'`, then `min(created_at)` of rows with non-null values in whichever of the four exist.

## 4. Vercel plan and the generation timeout (code/docs evidence)
- **Plan: Hobby**, project `rag-backend`, Fluid compute **on**, default timeout **300 s** (Hobby max), 2 GB / 1 vCPU, region `bom1` since 21 Oct. Source: `RAG-BACKEND-local/docs/checker-v4-design.md` L13-14 (recorded from `vercel api /v9/projects/rag-backend` on 21 Oct). `vercel.json` sets no `functions`/`maxDuration`, so the 300 s default applies. I did not re-query Vercel today; this is a 21 Oct snapshot.
- Same doc, L347: for 1-21 Oct, **0 timeouts, 0 throttles**, 1,785 invocations ok, 7 errors.
- Risk assessment from evidence: a 30-90 s (UI text in the old code) or 60-120 s CBSE paper is well inside 300 s. I found no measured generation times: `PAPER STATS` log lines (`test_generator_service.py` L2198) exist, but I did not have logs. So "silent timeout on larger papers" is **not supported by evidence**; it is also not disproved (no per-paper duration data, no max-question test). Upstream limits can bite first: the DeepSeek client timeout is 180 s per call (`DEEPSEEK_TIMEOUT_SECONDS`), Gemini calls have no timeout, and the browser `fetch` has none, so a hung call would run to 300 s, then 504.
- Hobby terms/caps are called out as an open risk in the same doc (L36-37), not verified by me.

## 5. `getAuthHeaders` in TestBuilderPage — callers
Helper: `FE:src/pages/TestBuilderPage.tsx:199`, reads `localStorage["sb-dcmnzvjftmdbywrjkust-auth-token"]`; the app stores the session under `a4ai.auth.token` (`src/lib/supabaseClient.ts:28`), so it returns no token.

| Caller | Endpoint | Requires auth? | State |
|---|---|---|---|
| `TestBuilderPage.tsx:180` (`loadQuestionPage`) | `GET /test-generator/ncert-questions` (`BE:test_generator.py:1480`) | No | silently unauthenticated, works |
| `TestBuilderPage.tsx:1011` (`fetchStats`) | `GET /test-generator/ncert-question-stats` (`:1503`) | No | silently unauthenticated, works |

The two former export callers (L1288, L1371 before my hotfix) required auth after the hotfix and were switched to `authJsonHeaders()`. If someone later adds `require_user` to the two GET routes, these two callers would start failing with 401.

Checking Link (your earlier item 0): it exports through `FE:src/utils/testPdfExporter.ts` `backendExportBlob`, which now sends the Bearer token. Before the hotfix it sent none; against the hardened backend an unauthenticated call returns 401, `backendExportBlob` returns `null` and the code falls back to the client-side jsPDF PDF, so it degrades rather than blocks. Not tested against a live backend.

## 6. Backend routes without an auth dependency (all routers in `app.main`)
Method: imported the real FastAPI app (dev env, no network) and walked each route's dependency tree for `require_user` / `optional_user`. **"NONE" means no such dependency, not "unprotected"**: other auth mechanisms are noted per row from reading the code. File:line = endpoint function.

| Route | file:line | Other protection seen in code |
|---|---|---|
| `GET /`, `GET /health` | `app/main.py:233`, `:228` | intentionally public |
| `GET /api/v1/test-generator/templates` | `test_generator.py:856` | none (static) |
| `GET /api/v1/test-generator/chapters` | `:879` | none (NCERT chapter list) |
| `GET /api/v1/test-generator/ncert-questions` | `:1480` | none (NCERT questions, paged) |
| `GET /api/v1/test-generator/ncert-question-stats` | `:1503` | none |
| **`POST /api/v1/test-generator/quiz/create`** | `:1423` | **none; writes `quizzes` via `supabase.table("quizzes").insert` (L1428)** |
| **`POST /api/v1/test-checker/extract-key`** | `test_checker_router.py:111` | none seen |
| **`/api/v1/modules/*` and the duplicate `/modules/*`: create, list, process, get, delete, download-worksheet, generate-test, generate-worksheet** | `modules.py:85, 133, 117, 144, 153, 219, 162, 192` | **none; `teacher_id` comes from the request body/query (`create_module`, `delete_module`), the `Authorization` header parameter is unused**, so any caller can act as any teacher id |
| `POST /api/v1/worksheet/generate-direct`, `/worksheet/download` (+ unprefixed copies) | `modules.py:283, 449` | none seen |
| `POST/GET /api/v1/community-quizzes`, `preview-video`, `q/{slug}` (+ `/start`, `/submit`, `/leaderboard`), `{quiz_id}/leaderboard`, `DELETE {quiz_id}` | `community_quiz.py:203, 353, 179, 371, 397, 468, 625, 596, 674` | optional token read inline (`verify_token`, L15/L35); public-by-design for students. Whether create/delete enforce ownership: **not verified** |
| `POST /api/v1/contests`, `GET /contests/my`, `{short_code}/info`, `/start`, `{id}/submit`, `{id}/leaderboard` | `contest.py:73, 246, 107, 137, 174, 214` | optional token inline (`get_optional_user_id`, L42); contest create uses it for `teacher_id` (L83). Ownership/enforcement: **not verified** |
| `POST /copy-checker/sessions/{id}/rubric`, `sheets/{id}/check`, `PATCH …/marks` | `copy_checker_router.py:158, 263, 388` | **authenticated**: `Depends(require_caller)`, which calls `require_user` (`smart_assignment_router.py:300`) |
| `POST /smart-assignment-checker/assignments/{id}/rubric`, `…/submissions/{id}/check` | `smart_assignment_router.py:402, 491` | **authenticated** via `require_caller`, same wrapper |
| `POST/GET /whatsapp/webhook`, `POST /whatsapp/generate_worker` | `whatsapp.py:62, 42, 139` | Meta HMAC signature / verify token / shared secret (`:21-39`); not otherwise tested |
| `GET /payment/plans` | `payment.py:172` | public by design |
| `POST /payment/webhook` | `payment.py:448` | signature verification presumably; **not read** |

Routes that do require `require_user` (for completeness): `/chat`, five `payment/*` routes, three `smart-assignment-checker/*`, five `test-checker/*`, and nine `test-generator/*` including the two export routes now.

## 7. Existing constraints that would block new tables
**Cannot be determined without the DB** (name collisions, existing FKs, RLS defaults, `teacher_profiles` FK that `usage_records` depends on per `record_usage`, L124-133). Repo-side hints only:
- `usage_records.user_id` references `teacher_profiles` (comment in `BE:test_generator.py:124-127`); a new table keyed on `auth.users` would not inherit that.
- `27_public_write_lockdown.sql` revoked INSERT/UPDATE/DELETE on `ncert_questions` / `ncert_chunks` from `anon`/`authenticated`: any new table that is written by the client rather than by the backend service role needs its own policies.
- Existing tables in the repo that overlap a "question bank" idea by name: `enhanced_questions`, `question_buckets`, `enhanced_test_generations`, `enhanced_analytics` (from `20240101000000_enhanced_questions.sql`); whether they exist live or hold data is unknown.

## 8. Next step needed from you
Choose access option 1, 2 or 3 in section 0. With any of them the DB sections take one pass; I will write the exact statement list first and run nothing until you confirm.
