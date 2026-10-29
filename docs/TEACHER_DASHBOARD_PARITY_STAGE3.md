# Teacher dashboard — Stage 3: Test Generator (`/dashboard/test-generator`), 28 Oct 2026

Status: `PASS` (measured or tested, with evidence) · `FAIL` · `NOT MEASURED` (not performed; reason given).
Branch `perf/teacher-dashboard`. Not committed, not pushed. No database, schema, RLS, grant or migration change.
Migration 27: not rerun. Migration 28: not created, not run.

## A. Route trace

`/dashboard/test-generator` → `src/pages/TestGeneratorPage.tsx` (lazy). Full-screen overlay (`fixed inset-0`), own header, own background.
Tabs (`?tab=`): `builder` (NCERT Test Builder, `TestBuilderPage.tsx`, 2181 lines), `check` (`CopyChecker`), `ai` (AI Generator, default, `TestGeneratorForm.tsx`), `contest-pdf` (`ImportContestFromPdf.tsx`).

AI Generator (this stage's functional scope):
- Form: `react-hook-form` + zod (`src/lib/schema.ts`). Row editor: `TestRowEditor.tsx` (rendered twice, desktop + mobile layouts; see §E).
- Generate: `useTestGenerator` (`src/hooks/useTestGenerator.ts`) → `api.generateTest` → `POST /api/v1/test-generator/generate-frontend`. Single response when finished (no streaming).
- Chapters: `GET /api/v1/test-generator/chapters?subject=&class_grade=`.
- Result view: `GeneratedTestView.tsx` (PDF/DOCX download and preview modal live here).

## B. Changes (files)

| File | Change |
|---|---|
| `src/pages/TestGeneratorPage.tsx` | Page font → Plus Jakarta Sans (`font-halenoir`; was system font). Text `#1B1B1B`, background `#F7F8FA` (landing tokens). Blurred background orbs removed (2 layers). Title gradient text → solid. Avatar gradient → solid `#111111`. Active tab `#111111`, tabs `min-h-[44px]`. Removed the hard-coded **"Pro Plan"** header label (not tied to the user's plan). Guest banner: emoji removed. |
| `src/components/TestGeneratorForm.tsx` | Fake progress engine removed: the full-screen blurred overlay with a time-based percentage and invented status text. Replaced by an inline `GenerationStatus` (elapsed seconds; no percentage; says partial progress is not available). Removed the hard-coded "Est: 30–90s" estimate and the "60–120 seconds" note. Generate button: gray gradient → solid `#111111`. Validation summary (`role="alert"`) after a failed submit: previously validation failed **silently**. "Try again with the same settings" button on the error box. Draft: non-sensitive settings saved to `localStorage` under `a4ai.testgen.draft.v1.<user id>` and restored on mount (never the logo, the paper date, or student data). |
| `src/hooks/useTestGenerator.ts` | One string: the 500 message no longer promises "try again in 30 seconds" (an invented wait time). Behaviour and status mapping unchanged. |
| `scripts/stage3-measure.mjs`, `scripts/stage3-flow.mjs` | New: computed-style measurement and a stubbed-backend functional flow test. |
| `docs/screenshots/teacher-dashboard/stage3/` | Before/after screenshots, measurements, flow report. |

Not changed: `TestBuilderPage.tsx`, `CopyChecker`, `ImportContestFromPdf`, the API contract, the question-selection logic, the generation pipeline, the export code.

## C. Computed design values (measured in the browser; `stage3/before-measure.json`, `after-measure.json`)

| Property | Before | After | Landing |
|---|---|---|---|
| Page H1 font | `-apple-system` (system) | **Plus Jakarta Sans** | Plus Jakarta Sans |
| Page H1 weight | 700 | 700 | 700 |
| Page H1 colour | `rgb(17,24,39)` | **`rgb(27,27,27)`** | `rgb(27,27,27)` |
| Page background | `rgb(249,250,251)` | **`rgb(247,248,250)`** | `#F7F8FA` |
| Blurred background layers | 2 | **0** | 0 |
| Primary Generate button bg | gray gradient | **`rgb(17,17,17)`** | `rgb(17,17,17)` |
| Primary button radius | 12 px | 12 px | 12 px |
| Primary button height | 46 px (320–390), 50 px (768+) | same | 50 px (landing hero) |
| Tab height (all four) | 45 px | 44 px (min-h-44) | — (44 px touch target) |
| Horizontal overflow, 320 / 390 / 768 / 1440 | 0 px | 0 px | 0 px |

Primary button height on phones is 46 px, not the landing's 50 px. That is because the sticky bar is a compact control; not changed to avoid crowding the bar. Recorded, not treated as a failure.

## D. Functional tests (`scripts/stage3-flow.mjs`, backend stubbed, 1440 px)

Backend stub: `generate-frontend` (first call 500, second call success after 2.5 s), `chapters` (fixed list). Real AI service: **not called**. No quota used.

| Check | Result | Status |
|---|---|---|
| Empty submit shows a validation summary | "Fill in these fields to generate the paper: Exam title is required · Topic is required" | PASS |
| Empty submit makes no API call | `callsSoFar: 0` | PASS |
| Failed generation shows the error with a retry action | "Generation Failed … Try again with the same settings" | PASS |
| Retry keeps the entered exam title | title `Unit Test: Polynomials` preserved | PASS (title only — board, class, subject, rows were not individually asserted after retry) |
| Loading state shows elapsed time and no percentage | "Elapsed 0s … no partial progress to show" · `percentShown: false` | PASS |
| Success path sends the typed title and renders a result | payload title matches; result view rendered; error cleared | PASS |
| Draft: a reloaded page restores the exam title | `Draft check title` restored | PASS for the title only. **Corrected in §K:** the row's chapter was lost on restore (FAIL, now fixed) |
| No uncaught page errors during the flow | `pageErrors: []` | PASS |

Screenshots: `flow-error-retry-1440.png`, `flow-loading-1440.png`, `flow-result-1440.png`.

## E. Known issues found in this stage (not fixed)

1. **Duplicate form controls.** FIXED in §K. (Correction: the hidden copy used `display:none`, so it was not focusable or announced; the real problems were the doubled DOM and that no select had an accessible name.)
2. **Draft is not cleared on logout.** FIXED in §K.
3. **"CBSE Standard Pattern" chip shows "5 Sec".** The source of that figure was not checked. Treat as unverified.
4. **Logo upload box** takes about a third of the phone screen above the fold.
5. **`TestBuilderPage` (builder tab, 2181 lines)**, **Check Answer Sheets**, **Contest from PDF**: only the page shell was changed. Their internal layouts were not reviewed in this stage.

## F. Not measured / not tested (explicit)

| Item | Status | Reason |
|---|---|---|
| Real AI generation end-to-end | NOT MEASURED | Backend stubbed; no real account used; real generation not run in this stage |
| PDF / DOCX export opens correctly | MEASURED in §K.3 (backend render functions run locally) | — |
| Answer key correctness | MEASURED in §K.3 for a fixed sample paper; marking-scheme quality of real AI output NOT MEASURED | — |
| Network failure / offline behaviour | NOT MEASURED | Only HTTP 500 was simulated; no offline test |
| Low-end device / throttled network | NOT MEASURED | No device lab; no throttled run for this route |
| Lighthouse LCP / CLS / TBT | NOT MEASURED | Lighthouse not installed |
| Keyboard focus ring, 200% zoom, dark mode | NOT MEASURED | Not run this stage |
| Real account | NOT MEASURED | No test account provided |
| Marketing page regression | NOT MEASURED | Landing page not touched in this stage; no shared style changed |

## G. Build, test, lint, TypeScript

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npm test` | not rerun in this stage; last full run 136/136 PASS (Stage 2) |
| `eslint` on changed files | 0 errors |
| `tsc --noEmit -p tsconfig.app.json` | 40 errors, same count as the baseline. Two are in `useTestGenerator.ts` (lines 150, 157, `detail.message` on `{}`) — they predate this stage (the diff there is one string). No new errors. |

## H. Screenshots (`docs/screenshots/teacher-dashboard/stage3/`)

| Set | Files |
|---|---|
| Before (AI Generator, default tab) | `before-ai-320.png`, `before-ai-390.png`, `before-ai-768.png`, `before-ai-1440.png` |
| After | `after-ai-320.png`, `after-ai-390.png`, `after-ai-768.png`, `after-ai-1440.png` |
| Flow | `flow-error-retry-1440.png`, `flow-loading-1440.png`, `flow-result-1440.png` |

Note: the timing of `flow-*` screenshots relative to the "Pro Plan" label removal was not recorded. Use the `after-ai-*` set as the current state.

## I. Three things to inspect first
1. `after-ai-390.png` — sticky bar, black Generate button, no "Est" text.
2. `flow-error-retry-1440.png` — validation/error block and the retry button.
3. `flow-loading-1440.png` — loading status text, no percentage.

## J. Stage 3 status
- Shell tokens, fake progress, fake estimate, fake plan label, silent validation, retry, draft: **PASS** (evidence above).
- Export, real generation, offline, device, Lighthouse, real account: **NOT MEASURED**.
- Duplicate row controls, draft-on-logout, builder/check/contest tabs internals: **open** (§E).


## K. Stage 3b — re-verification and fixes (28 Oct, second pass)

Stage 3 was re-checked from the code, not from this report. Every row below was run against two production builds of
the same branch: **before** = the Stage 3 code as found, **after** = with the fixes below. Supabase and the generator
backend are stubbed; no real AI call, no production request.

### K.1 Fixes

| File | Change | Why |
|---|---|---|
| `src/lib/testGenDraft.ts` (new) + `testGenDraft.test.ts` (8 tests) | Draft key, read, write, per-field validation (zod; a bad field is dropped and its default stays), 30-day expiry, `clearAllDrafts()` | The Stage 3 restore copied stored values into the form unchecked |
| `src/components/TestGeneratorForm.tsx` | Form waits for auth, then mounts with `key={user.id}` and the draft as its **first** values (was: `reset()` after mount). A draft class the form doesn't offer is dropped | Restoring after mount made the row editor see a class/subject change and clear every chapter. The key also clears one account's in-memory form when another signs in |
| `src/providers/AuthProvider.tsx` | `SIGNED_OUT` → `clearAllDrafts()` | 7 call sites sign out (most call `supabase.auth.signOut()` directly); the auth listener is the one place that sees all of them |
| `src/components/TestRowEditor.tsx` | One layout in the DOM (`useIsWide`, same 640 px switch, read on first render so phones don't flash the table). Mobile labels tied to their selects (`htmlFor` + `useId`); desktop selects named "Section N chapter / quantity / ..."; delete buttons "Remove section N"; question-type buttons `aria-pressed` (the active type was shown by colour only) | Both layouts rendered (one `display:none`), doubling every row's chapter list; no select had an accessible name |

### K.2 Results (`scripts/stage3-draft.mjs`, `stage3-keyboard.mjs`, `stage3-flow.mjs`, `stage3-measure.mjs`)

| Check | Before | After | Status |
|---|---|---|---|
| Draft restore: title / class / subject | restored | restored | PASS |
| Draft restore: row chapter (`Polynomials`, Class 9 Maths) | **empty** | `Polynomials`, also after reload | FAIL → PASS |
| Broken draft (`simpleData: "garbage"`, `classGrade: 42`) | class empty, **0 rows rendered** | Class 10 default, 1 row, 0 page errors | FAIL → PASS |
| Sign-out (dashboard → Logout) removes drafts | 1 → **1** | 1 → 0, lands on `/login` | FAIL → PASS |
| Selects in the DOM, 3 rows (390 and 1440) | 30 | 15 | PASS |
| `<option>` nodes in the document, 3 rows | 211 | 115 | PASS |
| Visible selects without an accessible name | 15 | 0 | PASS |
| Visible icon-only buttons without a name | 3 | 0 | PASS |
| Duplicate `id`s | 0 | 0 | PASS |
| Keyboard: Tab through row 1 (390, 1440) | — | every stop visible and named; type buttons report `aria-pressed` | PASS |
| Stage 3 flow (validation, 500 + retry, elapsed status, success, draft) | — | same results as §D, `pageErrors: []` | PASS (no regression) |
| H1 / submit colour, overflow at 320 / 390 / 768 / 1440 | — | `#1B1B1B` / `#111111`, overflow 0 | PASS (no regression) |

Screenshots (`stage3/`): `before-draft-restore-1440.png`, `after-draft-restore-1440.png`, `before-rows-*.png`,
`after-rows-*.png`, `after3b-editor-390.png`, `after3b-editor-1440.png`, `after3b-ai-*.png`, `3b/flow-*.png`.
Note: `*-rows-*.png` are viewport shots of a scrolling container (the rows are below the fold); the editor itself is in
`after3b-editor-*.png`.

### K.3 Export (`scripts/stage3-export-check.py`)

The export is rendered by the backend (`POST /api/v1/test-generator/export`, `/export-answer-key`), not the browser.
The script calls the same backend render functions (`RAG-BACKEND-local/test-generator-backend`,
`app/services/export_service.py`) locally with a 5-question paper shaped like the frontend payload (3 MCQ, 1 short,
1 long; 10 marks), then opens each file (PyMuPDF / python-docx) and looks for every question, option, written answer,
explanation and the total.

| Output | Result | Status |
|---|---|---|
| PDF student, templates modern / teal / colorful | valid PDF, 5/5 questions, options, title, total 10; no answers, no explanations | PASS |
| PDF answers / teacher (modern) | answers 2/2; teacher explanations 5/5 | PASS |
| DOCX student (modern) | valid, 5/5 questions, no answers | PASS |
| DOCX answers, all 8 templates | answers 2/2 | PASS |
| DOCX teacher (answers + explanations), classic / compact / colorful | answers 2/2, explanations 5/5 | PASS |
| **DOCX teacher, modern (the default) / teal / navy / dark_green / orange** | **0 answers, 0 explanations**; the file equals the student copy | **FAIL** |
| Answer key PDF and DOCX (standalone) | answers 2/2, explanations 5/5 | PASS |

Cause of the FAIL (backend, not changed here): these 5 templates use `_generate_docx_cbse_exam`, which adds the
answer section only when `include_answers and not include_explanations` (`export_service.py:5166`). The frontend's
"Teacher" DOCX sends both true, so nothing is added. The PDF version of the same layout does include them.
Also seen: in the "answers" mode those 5 layouts print MCQ explanations although `includeExplanations` is false.

Not covered: real AI-generated papers (answer correctness, marking-scheme quality), images in questions,
Accountancy tables, logo / watermark, page breaks on long papers, fonts on other machines.

### K.4 Still open

- Teacher DOCX on 5 templates (above): backend fix in `RAG-BACKEND-local`, needs its own change and deploy.
- `/export` and `/export-answer-key` take no auth (by design, rate limit 30 in `app/core/rate_limit.py`); anyone can
  use the render service. Recorded only.
- `test-progress-<testId>` (GeneratedTestView's edit progress) is not cleared on sign-out; it holds paper content, not
  student data, and the test id belongs to one account.
- A failed token refresh also fires `SIGNED_OUT`, so that case drops the draft too.
- Real generation with a real account, offline, Lighthouse, low-end device, 200% zoom, dark mode: NOT MEASURED.
- Builder / Check Copies / Contest-from-PDF internals: not reviewed (shell only).

### K.5 Build / tests

`vite build` PASS (before and after builds, in the scratchpad) · `npm test` 144/144 (136 + 8 new) · eslint on changed
files 0 errors (2 pre-existing warnings) · `tsc` 40 errors = baseline (2 new ones from this pass were fixed).
No commit, no push, no migration, no database change.
