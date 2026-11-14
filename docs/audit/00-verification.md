# Test Generator — Verification Pass (read-only)

Date: 2026-10-29. Method: code and migration files only. No DB query, no migration, no code change.
Backend = `Desktop\RAG-BACKEND-local\test-generator-backend\` (written `BE:` below, paths relative to it).
Frontend = this repo (`FE:`). Findings only; no fixes proposed.

## 1. Findings table

| ID | Claim (prior audit / assumption) | Status | Evidence (file:line) | Impact |
|---|---|---|---|---|
| A2 | A row exists before generation finishes | **REFUTED** | `BE:app/api/v1/endpoints/test_generator.py:612` `supabase.table("tests").insert(tests_row)` runs after `generate_test` (L582) and `record_usage` (L589) | Failed or abandoned generation leaves no `tests` row; nothing to resume |
| A3 | Paper lives somewhere between generate and /save | **VERIFIED (client state)** | `FE:src/hooks/useTestGenerator.ts:139` `setResult(response)`; `FE:src/components/GeneratedTestView.tsx` holds `questions` in `useState`; `tests` row (status `draft`) exists but has no `questions` rows until `/save` (BE L1224+) | Refresh loses the paper. Guest path only: `saveTestDataForRestore` (GeneratedTestView.tsx:1008) |
| B1 | Embedding/vector search disabled | **VERIFIED** | `BE:app/services/rag_service.py:177-184` `def get_embedding(...): """Disabled — vector search skipped on Vercel."""; return []` and `def vector_search(...): """Disabled for Vercel."""; return []` | Retrieval is ILIKE / stride-sample only |
| B2 | 8 chunks × 750 chars per batch | **VERIFIED** | `BE:app/core/config.py:100-101` `CONTEXT_CHARS_PER_CHUNK=750`, `MAX_CONTEXT_CHUNKS=8` (env-overridable); used `BE:app/services/test_generator_service.py:1108,1111` | Max 6,000 chars (~6 KB ASCII, up to ~12 KB if all non-ASCII) + `[i] ` prefixes per batch |
| B3 | Subtopic never reaches the prompt | **VERIFIED (partial leak into RAG only)** | See section 3. Dropped at `BE:app/services/test_generator_service.py:1102-1215`: `_build_chapter_prompt` never reads `chapter.topic` / `chapter.subtopics` | User-chosen subtopic only affects chunk selection, never the instruction |
| B4 | Unmatched chapter falls through silently | **VERIFIED** | `BE:app/services/rag_service.py:118` `"No chapters found in DB. Returning requested as-is."`; L174 `return matched if matched else requested_chapters` | A chapter name with no DB match still goes to retrieval; result may be empty or wrong chapter via word-overlap |
| C1 | QuestionFormat members | **VERIFIED** | `BE:app/models/test_generator.py` (class `QuestionFormat`): mcq, short_answer, long_answer, assertion_reason, case_based, journal_entry, ledger, trial_balance, image, manual (10) | Enum already has AR and case_based |
| C2 | case_based mapped to MCQ | **VERIFIED** | `BE:app/api/v1/endpoints/test_generator.py:348` `"case_based":     QuestionFormat.MCQ,` | Only bites if a client sends `case_based`. UI cannot (see C3). CBSE-pattern Section E builds case_based internally (`BE:app/services/test_generator_service.py:840`), bypassing this map |
| C3 | UI can only send MCQ/Short/Long/Essay (+ accountancy) | **VERIFIED** | `FE:src/components/TestRowEditor.tsx:539-544` `QUESTION_FORMATS`; L1206-1214 `FORMAT_MAP` (MCQ, Short, Long, Essay, JournalEntry, Ledger, TrialBalance) | No AR or Case Study selectable in Simple mode |
| C4a | `questions` table has no `sub_parts` column | **REFUTED** | `FE:supabase/migrations/20261004120000_questions_rich_fields.sql` adds `question_table, is_or, sub_parts, marking_scheme, model_answer, common_mistakes` | Prior audit read only the old `BE:supabase_migration.sql`. Whether it ran live is unverifiable here |
| C4b | `questions` columns written by /save all exist in DDL | **PARTIAL / GAP** | `/save` writes `section, is_manual, image_url, answer_table` (BE L1298-1301). None are in `BE:supabase_migration.sql:66` nor the rich-fields migration | Either added live by an unseen migration, or the insert fails. See Surprises S1 |
| C4c | `tests` columns | **PARTIAL** | `BE:supabase_migration.sql:49` defines id, teacher_id, exam_title, board, class_grade, subject, iteration, status, request_payload, total_questions, total_marks, created_at, updated_at. Endpoint inserts also `paper_date`, `cbse_pattern` (L598-611); no DDL for those in repo | Same: live schema unknown |
| C4d | `ncert_chunks` columns | **UNVERIFIABLE (no DDL in repo)** | Only inferred from queries: `id, subject, class_grade, chapter, book, chapter_type, chapter_order, content` (`BE:app/api/v1/endpoints/test_generator.py:882`, `rag_service.py`). `match_ncert_chunks` in `BE:supabase_migration.sql:7` implies an embedding column | No subtopic column appears in any query |
| C4e | `ncert_questions` columns | **UNVERIFIABLE (no DDL in repo)** | Inferred from insert: class_grade, subject, chapter, section, question_number, question_text, question_type, answer, options, marks, difficulty, source_chunk_id, question_table, figure_ref (`BE:02_extract_ncert_questions.py:1227-1250`) | `question_type` is a free string, not an enum |
| C5 | /save persists sub_parts | **VERIFIED** (prior suspicion REFUTED) | `BE:.../test_generator.py:1305` `"sub_parts": q.get("subParts") or q.get("sub_parts"),`; L1322 fallback strips it if columns missing | Persisted only if the migration was applied; else silently dropped |
| D1 | Regenerate loses format, difficulty, subtopic | **VERIFIED** | `FE:src/components/GeneratedTestView.tsx:1143-1154` sends `difficulty: "Medium"`, `format: "PDF"`, `topic: ch`, no subtopic/marks; backend `FORMAT_MAP.get(row.format, QuestionFormat.MCQ)` (BE L396) | Every regenerated question comes back as MCQ/Medium; calls full `/generate-frontend` |
| D2 | check/record usage atomic | **REFUTED (not atomic)** | `BE:.../test_generator.py:553` `check_usage` and L589 `record_usage` are two separate RPC calls around the whole generation | Parallel requests can all pass the check. RPC bodies unverifiable |
| D3 | Failed generation refunds quota | **N/A, never charged** | `record_usage` runs only after successful generation (L589); any exception earlier skips it | No refund needed; but see S3 (charged even if `tests` insert fails) |
| E1 | vercel.json maxDuration/memory | **REFUTED (absent)** | `BE:../vercel.json` is `{"version":2,"regions":["bom1"],"builds":[{"src":"api/index.py","use":"@vercel/python"}],"routes":[{"src":"/(.*)","dest":"api/index.py"}]}`. No `functions`, `maxDuration`, `memory` | Platform defaults apply; a 60-120 s paper depends on the Vercel plan limit, which is not in the repo |
| E2 | LLM_PROVIDER value | **PARTIAL** | Default `"gemini"`: `BE:app/core/config.py:68`; read at `BE:app/services/test_generator_service.py:2265` and L2198. `.env.example` has no entry. I did not open any `.env` | Live value unknown (see unverifiable list) |
| E3 | Timeout/AbortController on generation | **VERIFIED absent (client); partial (server)** | FE: no `AbortController`/`signal` in `FE:src/lib/api.ts` or `useTestGenerator.ts` (grep empty). BE: only `DEEPSEEK_TIMEOUT_SECONDS = 180` (`test_generator_service.py`, near L2207); no timeout on the Gemini call | A hung Gemini call blocks until platform kill |
| E4 | Merge-conflict markers in 02_extract script | **VERIFIED still present** | `BE:02_extract_ncert_questions.py` markers at lines 49/52/55, 183/225/260, 270/273/305, 1145/1184/1223, 1230/1238/1249, 1421/1468/1502 | File is not valid Python; the ncert_questions loader cannot run |
| F1 | Dedup exists | **VERIFIED, weak** | `BE:app/services/test_generator_service.py:1819-1828` `_dedupe_questions`: key = `_norm_text(q.text)[:160]` | Exact-prefix match only, within one generation. No cross-paper or semantic check |
| F2 | Existing job/queue/background | **PARTIAL** | Only `BackgroundTasks` in `BE:app/api/v1/endpoints/whatsapp.py:142,277`; `ThreadPoolExecutor` inside generation; copy-checker has a DB job queue (`check_jobs`, per CLAUDE.md, `copy_checker_router.py`) | No queue for the test generator |
| F3 | Telemetry / structured logging | **PARTIAL** | `_with_paper_stats` decorator logs one `PAPER STATS` line per paper (`test_generator_service.py:2179-2205`), `_PaperStats` (L2133) tracks calls/tokens/drops. Plain-text `logging.basicConfig` (`BE:app/main.py:26`) | Text logs only, not structured, nothing persisted |
| F4 | Row counts for ncert tables | **UNVERIFIABLE from code** | `BE:extraction_log.txt` has paged GETs only; `_resolve_chapters` caps at `.limit(1000)` (rag_service.py:~62) | Need live count |

## 2. A1 — Call chain (form submit → PDF)

Frontend
1. `FE:src/components/TestGeneratorForm.tsx:287` `onSubmit` → `generate(data)` (L226 from `useTestGenerator`).
2. `FE:src/hooks/useTestGenerator.ts:64` builds `payload` (rows map `simpleData`, each with `topic` (= chapter), `subtopic`, `quantity`, `marks`, `difficulty`, `format` via `FORMAT_MAP`, L~80-100).
3. `FE:src/hooks/useTestGenerator.ts:133` `api.generateTest(payload)` → `FE:src/lib/api.ts:206` `apiFetch("/api/v1/test-generator/generate-frontend")` → `fetch` at L158 with Bearer token (L142-152).

Backend
4. `BE:app/api/v1/endpoints/test_generator.py:546-547` `generate_from_frontend` (`require_user`; `req.userId = user.id`).
5. L553 `check_usage` (RPC `check_usage`, L52).
6. L555 `_transform_frontend_to_backend` (L387): `chapter=row.topic`, `topic=row.subtopic`, `subtopics=[row.subtopic]` (L399-402); `FORMAT_MAP`/`DIFFICULTY_MAP` lookups L395-396.
7. L563-569 `retrieve_context(real_chapters, topics, subject, class_grade)` → `BE:app/services/rag_service.py:307`: `_resolve_chapters` (L55) → `keyword_search` (L187), `max_chunks=20`.
8. L582 `generate_test(...)` = `generate_questions` (`BE:app/services/test_generator_service.py:2694`; CBSE pattern routes to `generate_cbse_paper`, L2426).
9. `_generate_for_chapter` (L2321) → `run_batch` → `_build_chapter_prompt` (L1102) (or accountancy/statistics/english builders).
10. `_call_gemini` (L2255, semaphore `_LLM_SLOTS` L2124) → `_call_llm` (L2262: DeepSeek if configured, else) → `_call_gemini_model` (L2273, `client.models.generate_content`, JSON mime type).
11. `_parse_batch` (L1831): `_extract_json` (L1833/1456), `_quality_issue` (L1903), `_validate_batch_quality` (L2117).
12. `_dedupe_questions` (L2395), top-up loop (L2398-2400), trim to target.
13. L584 `_transform_backend_to_frontend` (L464).
14. L589 `record_usage` (RPC `record_usage`, L118).
15. L598-612 INSERT into `tests` (failure only logged, L616).
16. Response returns; `FE:useTestGenerator.ts:139` `setResult`.

Save and export
17. `FE:src/components/GeneratedTestView.tsx:1053` `api.saveTest` → `FE:src/lib/api.ts:270` → `BE:.../test_generator.py:1224` `/save`: update `tests.status`, delete then insert `questions` (L1296-1324).
18. Export: `FE:GeneratedTestView.tsx:817-830` plain `fetch` (no Authorization header) → `BE:.../test_generator.py:667` `/export` (no `require_user`) → `export_service.py` render PDF/DOCX → blob download.

## 3. B3 — Subtopic trace (exact drop point)

1. UI field: `simpleData.${index}.subtopic` (`FE:src/components/TestRowEditor.tsx:705`), options from `subtopicsMap[chapter] || COMMON_SUBTOPICS[chapter]` (L636).
2. Payload: `subtopic: row.subtopic || undefined` (`FE:useTestGenerator.ts` ~L96).
3. Backend model: `ChapterSection.topic = row.subtopic`, `subtopics = [row.subtopic]` (`BE:test_generator.py:399-402`).
4. Into RAG: `topics = [ch.topic ...]` (L563) → `retrieve_context` (rag_service.py:307). Dropped from keywords if equal to chapter (L323). Used as `ILIKE %kw%` only if `len(kw.split()) <= 4` (L249); longer subtopics are skipped silently. Comma parts split first (L~326).
5. Into prompt: `_build_chapter_prompt` (test_generator_service.py:1102-1215) uses `chapter.chapter`, `chapter.difficulty`, `chapter.format`, `marks_per_question`, `count`. It never references `chapter.topic` or `chapter.subtopics`. The only subtopic-like input is `_get_subtopic_context(chapter.chapter)` (L1175), keyed by chapter name against the 2-entry `CBSE_HISTORY_SUBTOPICS`.
6. Exceptions that do read `topic`: `_build_statistics_prompt` (L761), English writing prompt (L343-362).

Drop point = `_build_chapter_prompt`, L1102-1215 (no read of the field).

## 4. UNVERIFIABLE WITHOUT LIVE DB (read-only queries needed)

1. `information_schema.columns` for `public.questions`, `public.tests`, `public.ncert_chunks`, `public.ncert_questions`. Does `20261004120000_questions_rich_fields.sql` exist live? Do `section, is_manual, image_url, answer_table` (questions) and `paper_date, cbse_pattern` (tests) exist? Is there an embedding column on `ncert_chunks`?
2. Row counts: `ncert_chunks` per subject/class/chapter; `ncert_questions` per subject/class/chapter/question_type. Distinct `ncert_questions.question_type` and `difficulty` values.
3. Is there a `subtopic`/`topic` column or any content tagging on `ncert_chunks`? Chunk size distribution (`length(content)`).
4. `pg_get_functiondef` for `check_usage` and `record_usage` (atomicity, whether `check_usage` writes, plan limits).
5. Whether `public.questions` has the `sub_parts` column populated for saved case-study papers.
6. Vercel project settings (Function max duration, memory, plan) and live env values for `LLM_PROVIDER`, `GEMINI_GEN_MODEL`, `MAX_CONTEXT_CHUNKS`, `CONTEXT_CHARS_PER_CHUNK`, `BATCH_SIZE`, `ENVIRONMENT`. These are not in the repo and I did not open any `.env`.
7. `match_ncert_chunks` still exists live and the `ncert_chunks` embedding column is populated.

## 5. SURPRISES (not in the earlier report)

- **S1. /save writes columns no DDL in either repo defines** (`section, is_manual, image_url, answer_table`, BE L1298-1301). The fallback (L1318-1324) only strips the six rich-field columns, so if the live table lacks one of the other four, the retry fails too and the paper does not save. Live schema decides it.
- **S2. Earlier claim "questions has no sub_parts" was wrong.** The migration exists (04 Oct 2026). My earlier report read only `supabase_migration.sql`.
- **S3. Charged but possibly untracked paper.** `record_usage` (L589) runs before the `tests` INSERT (L612); an INSERT failure is only logged (L616). The user gets a paper and is charged, but `/save` then takes the "recovery" branch (L1243-1262) which creates `"Untitled Test (recovered)"` with `class_grade "10"`, `board "CBSE"` hard-coded and `subject` = the first question's *chapter* name.
- **S4. `/export` and `/export-answer-key` have no auth** (`BE:test_generator.py:667, 758`, no `Depends(require_user)`), and the frontend fetch (`GeneratedTestView.tsx:830`) sends no token. Any caller with a payload can render PDFs on your compute.
- **S5. Regenerate calls the quota-metered endpoint** (D1), so each rejected-question refill costs a full paper credit, and writes another `tests` row.
- **S6. Subtopics longer than 4 words are dropped from retrieval** (`rag_service.py:249`), and a failed keyword search silently falls back to the whole chapter (L~278-292). A very specific subtopic can yield zero targeting.
- **S7. `broad` fallback ignores the chapter filter** (rag_service.py, `query_broad`): when a keyword finds nothing inside the selected chapters, it searches the whole subject/class. Chunks from other chapters can enter the context.
- **S8. Dev bypass of auth/usage** (`test_generator.py:54, 120`): `check_usage` and `record_usage` skip for the zero UUID when `ENVIRONMENT` is not `production`/`prod`. Default `ENVIRONMENT` is `"development"` (config.py:41), so a deployment missing that variable runs with `DEBUG = True` (config.py:43; OpenAPI docs exposed, main.py:46) and relaxed usage rules. Live value unverified.
- **S9. Auth is a network call** (`BE:app/core/auth.py` header: `auth.get_user`, cached 60 s) on every request, including each follow-up call in a generation session.
- **S10. In-memory chapter cache** `_CHAPTERS_CACHE` (rag_service.py, TTL 3600 s) is per serverless instance, so stale or inconsistent chapter resolution across instances is possible.
- **S11. Two parallel format-maps exist** (`BE:app/models/test_generator.py` `FORMAT_MAP` incl. "Assertion-Reason" and "PDF"; `BE:.../test_generator.py:338` own `FORMAT_MAP`, which is the one actually used). They disagree (models' map has no "Short"/"Long"/"Essay"; endpoint's has "case_based"→MCQ).
- **S12. `handle_feedback` is a no-op** (`test_generator_service.py:2759`) and `/feedback` (BE L1208) has a response model of `TestGenerationResponse`; rejection reasons never influence generation.
