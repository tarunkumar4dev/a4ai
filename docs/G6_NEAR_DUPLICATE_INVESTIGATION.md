# G6 — NCERT builder: near-duplicate investigation and safe fix plan

Date: 28 Oct 2026 · Model: Sonnet 5.5 · Status: **investigation only. Nothing was changed, deployed, migrated, committed or pushed.**
Data: production `public.ncert_questions` / `ncert_chunks`, read with `SELECT` only (`supabase db query --linked`).
Code read: `fix/ncert-builder-quality` (frontend `4c6dc21`, backend `2b4522c`), read-only.
`Cache-Control: private, no-store` was **not touched** and stays as is pending a separate caching decision.

**Recommendation (details in §9): gather more data, do not implement broad filtering yet.** Fix the header label first
(small, UI-only). A narrow, reversible near-duplicate rule is feasible, but its precision is measured on 55 hand-read
pairs only, and a naive "hide every `near_duplicate` copy" rule would remove real questions.

---

## 0. Concurrency check (done first)

| Check (read-only, 28 Oct 15:27) | Result |
|---|---|
| Listeners | 5173 → pid 13632 (vite, started 14:34, from `fe-ncert-builder-quality`); 8010 → pid 15672 (uvicorn, 14:28, from `be-ncert-builder-quality`); 8765 → pid 20448 (uvicorn, owner unknown) |
| Owner | pid 15672 (8010) descends from the Claude session `claude.exe` 22880 (started 12:59, scratchpad `526e3d25…`); pid 13632 (5173) was started by a python script from that same scratchpad. The session's last file write was 14:41, about 46 minutes before this check: idle, not editing |
| Worktrees | `fe-ncert-builder-quality` @ `4c6dc21` (13:54), `be-ncert-builder-quality` @ `2b4522c` (13:27), `RAG-BACKEND` main @ `dbac670`: all **0 changed files** |
| What I did | No edit in any of those worktrees, no server started or stopped, no process touched. Data came from read-only SQL, so no second builder ran against the same tree. My earlier G5 stack (8011 / 5174) was already stopped |
| Files I created (this repo, `perf/teacher-dashboard`, all untracked) | `docs/G6_NEAR_DUPLICATE_INVESTIGATION.md`, `docs/G6_FIXTURES.json`, `scripts/g6/*.py` (+ the G5 scripts from before). Move them to the NCERT branch when it is decided where they belong |

Ownership of 8765 is unclear; it was left alone.

---

## 1. Verified findings (re-checked against current data, not taken from the brief)

| # | Claim in the brief | Verified? | Evidence |
|---|---|---|---|
| 1 | Class 10 Maths shows 1,657 questions | **Yes** | 1,657 visible rows = clean 470 + fixed 93 + needs_review 1,094. 9,136 hidden (`duplicate`), 0 `junk`. 10,793 rows audited |
| 2 | 917 `needs_review` rows stay visible for near-duplicate | **Yes, and the split is now known** | 917 = **290 canonical rows + 627 copies**. Every canonical is visible (0 missing). `near_duplicate` is one of the stored reasons on all 917 (the other needs_review reasons: short_text 135, garbled_math 148, mcq_no_answer 70, skeleton_operator_conflict 35, diagram_type_no_image 20, raw_latex 3, mcq_type_no_options 1). The UI never shows "needs review" |
| 3 | Statistics Example 2 ×5, Intro Trig Example 11 ×3 | **Yes** | ids `2988, 4423, 7678, 16457, 25137` and `2577, 3547, 5468` (§3) |
| 4 | Repeated labels mean duplicate questions | **Mostly, but not always** | Of 40 repeated Example labels (read one by one): 33 are the same question stored more than once, 7 are *not* duplicates (4 whole-question vs stem-only row, 1 solution text, 2 fragments). **0 groups** where two different textbook questions share one Example label |
| 5 | "Near duplicate" means redundant | **No** | `near_duplicate` = rapidfuzz ratio > 90 inside a chapter, transitive, **no check on question number, sub-part or numbers**. 50 of 290 clusters contain a different question (§4) |
| 6 | Builder header says "1,00,000+ Questions" | **Yes, and it is wrong** | Literal text, `TestBuilderPage.tsx:1625` (`:1489` in this repo). Table has **91,906** rows; **82,770** visible (§7) |
| 7 | Backup had 91,906 rows | **Yes** | `count(*)` = `count(distinct id)` = 91,906 today |

Counts that differ from G5: G5 counted 163 Example rows with the strict pattern `Example N`. This investigation counts every
visible row whose label starts with "Example" (also `Example 1 (i)`): **194 rows, 134 distinct labels, 40 repeated
labels covering 100 rows (60 surplus)**.

---

## 2. How a question gets to a card (traced)

1. **Source.** `ncert_chunks` (12,448 text chunks, with chapter) → an extractor writes `ncert_questions` rows with `source_chunk_id`,
   `question_number` (free text), `question_type`, `question_text`, `options`, `answer`, `figure_ref`, `image_url`, `created_at`.
2. **Quality pass** (`scripts/ncert_quality_pass.py`, applied to **Class 10 Maths only**, G4.5). Rules, in order:
   `junk` (label only) → `duplicate` (same chapter and same `content_hash` **or** same skeleton = text without math symbols,
   ≥ 20 chars, same operator sequence; canonical = most math symbols > has answer > figure OK > lowest id) →
   `near_duplicate` (rapidfuzz `fuzz.ratio` > 90 on normalised text, same chapter, union-find, **both** canonical and copies are
   marked) → other review reasons → `fixed` / `clean`. Copies get `quality_flags.near_duplicate_of = <canonical id>`.
3. **API.** `/ncert-questions` filters `quality_status IS NULL OR NOT IN ('duplicate','junk')` (`_NCERT_VISIBLE_OR`), orders
   by `quality_rank, section, question_number, id`, strips `quality_*` fields. needs_review is visible **by design** (dry-run note 5, G4.6).
4. **Frontend.** Cards show `QuestionLabel` = `<chapter> · <question_number>`. No grouping, no dedupe, no "needs review" badge.

Nothing in 3–4 knows that two visible rows are the same question.

---

## 3. Representative evidence (real rows)

All rows are in `docs/G6_FIXTURES.json` (13 groups, 32 rows). "Chunk" = `source_chunk_id`; "day" = `created_at` day (an extraction run).

| # | Chapter · label | IDs (canonical first) | Provenance | Stems | Options / diagram / sub-parts | Status (reason) | Case | Recommended action · confidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Statistics · Example 2 | 2988, 4423, 7678, 16457, 25137 | one chunk (5302); 5 creation times on 3 days (27 Aug ×2, 31 Aug, 18 Sep ×2) | same table question, table layout differs | none | 4 needs_review (near_duplicate), **7678 clean** | **2** formatting / OCR variants | Keep one, prefer the clean row 7678 · high |
| 2 | Circles · Example 3 | 1493, 46223 | same chunk 5187; 26 Aug vs 19 Sep | identical except "(see Fig. 10.1)" | figure reference only | both needs_review | **2** | Keep one · high |
| 3 | Arithmetic Progressions · Q.11 / Exercise 5.3 Q11 | 6397, 47100, 1469 | 3 different chunks (5179, 5170, 7579), 3 days (30 Aug, 19 Sep, 26 Aug) | same text; `n^2` / `n²` / `n2`, leading "11." | none | needs_review | **2** + label noise | Keep one; labels must be normalised first · high |
| 4 | Pair of Linear Equations · Example 1, 2, 4, 5, 9 | e.g. 2648, 46237 | chunks 5229/5237; 27 Aug, 19 Sep (3 runs) | same; equation tags "(1)" "(2)" present or absent | none | needs_review | **2** | Keep one · high (these look "numerically different" to a naive check; they are not) |
| 5 | Coordinate Geometry · Exercise 7.1 Q1 (i) / (ii) | 2006, 45618 = (i); **45619 = (ii)** | one cluster of 9 rows; same chunk 5198, two runs (26 Aug, 19 Sep) | (i) points (2,3),(4,1); (ii) points (–5,7),(–1,3) | different values | needs_review | **3** different questions in one near-dup cluster | **Keep both (i) and (ii)**; hide one of 2006/45618 · high |
| 6 | Arithmetic Progressions · Example 14 (i) / (ii) | 25756, 25757 | chunk 5170, one run (18 Sep) | "the first 1000 positive integers" vs "the first n positive integers" | sub-parts without a stem | both needs_review (near_duplicate) | **3 / 4** | **Keep both** · high |
| 7 | Areas Related to Circles · labels 6 / 7 | 1349, 1350 | same chunk 5158, same run (26 Aug) | r = 15 cm, 60° vs r = 12 cm, 120° | different values | needs_review | **3** | **Keep both** · high |
| 8 | Triangles · 1.(iii) | 4585 (canonical), 7866 | chunks 5348 / 7736; 28 Aug / 31 Aug | "All triangles are similar" vs "All ________ triangles are similar" | the canonical **lost the blank**; the question is unanswerable as stored | both needs_review (mcq_no_answer, near_duplicate) | **2** with a **worse canonical** | Keep 7866, not 4585 · high |
| 9 | Circles · Example 1 | 1491, 12735 | chunks 5187 / 7593; 26 Aug / 2 Sep | question vs "We are given two concentric circles … chord AB…" (the **worked solution**) | – | both clean | **4/5** different content, same label | **Not a duplicate.** Leave both; a separate "solution text" rule is a different task · medium |
| 10 | Probability · Example 1 / 13 | 2762 + 22102; 2776 + 22122 | chunk 5255 (2776: 5262); 27 Aug vs 18 Sep | question vs "(Why ?)" / "Note that the pair (1, 4) is different from (4, 1). (Why?)" | fragments | 22102 needs_review (short_text), 22122 clean | **4/5** | **Not duplicates.** Out of scope for dedupe · medium |
| 11 | Arithmetic Progressions · Example 14 | 1456 (whole), 25755 ("Find the sum of :") | chunks 7579 / 5170; 26 Aug / 18 Sep | whole question vs stem-only row | sub-parts in one row vs split | 1456 clean; 25755 needs_review (short_text) | **3** granularity (rule 6, undecided) | **Do not decide here** · high that it is not a plain duplicate |
| 12 | Introduction to Trigonometry · Example 12 | 2578, 3548, 4052 (garbled) + 12869, 16127 (clean) | 5 rows, chunks 5218 / 7617 / 5210, 3 days (27 Aug, 2 Sep, 18 Sep) | same identity; garbled math vs clean math | the 3 garbled rows carry skeleton_operator_conflict | all needs_review | **2** but in **two clusters** (ratio < 90 across them) | Prefer the clean cluster; garbled rows are hidden only by a garble-aware rule · medium |
| 13 | Polynomials · Exercise 2.2 Q1 | 2759, 4180 | same chunk 7647 | byte-identical text (whitespace-insensitive) | garbled_math | needs_review | **1** exact | Hide the copy · high. **3 such pairs remain visible** (6 rows, 0.4 % of visible): different `content_hash`, blocked by the garble / operator / short_text guards |

The five requested cases:

1. **Exact duplicates:** 9,136 are already hidden (3,972 `exact_hash`, 5,164 `same_skeleton`). In the visible set 3 pairs of identical text remain (row 13, an operator-conflict pair in Trigonometry Q7, a short in-text pair in Trigonometry).
2. **Same question, formatting/OCR differences:** the large majority (rows 1–4, 12).
3. **Similar, meaningfully different:** rows 5–7 (different values or sub-parts). Real, and exactly what `near_duplicate` merges wrongly.
4. **Different questions sharing an Example label:** none among the 40 repeated Example labels. Rows 9–10 share a label but are not another *question* (solution text / fragments).
5. **Wrong or missing provenance:** `source_chunk_id` is present on all 194 Example rows and the chunk's chapter equals the row's chapter in 194 / 194. What is inconsistent is `question_number`: `Q.11`, `Exercise 5.3 Q11`, `11.`, `Ex 5.3 Q11`, `EXERCISE 10.2, 7`, `Exercise Question`, empty.

### All 40 repeated Example labels, read one by one

| Class | Count | Groups |
|---|---:|---|
| Same question stored more than once (variants) | **33** | AP Ex 16\*; Circles Ex 3; Trig Ex 3, 5, 11, 12; Linear Eq Ex 1, 2, 4, 5, 9; Probability Ex 9; Quadratic Ex 1(i), 1(ii), 2(i), 2(ii), 2(iii), 2(iv), 3, 4, 5, 6\*, 7, 9; Statistics Ex 1, 2, 3, 5, 7, 8; Surface Areas Ex 5; Triangles Ex 2, 8 |
| Whole question + stem-only row | 4 | AP Ex 2, AP Ex 14, Quadratic Ex 1, Quadratic Ex 2 |
| Question + its worked solution text | 1 | Circles Ex 1 |
| Question + a fragment | 2 | Probability Ex 1, Probability Ex 13 |
| Different question under the same label | **0** | |

\* ratio 77 / 63: same example, one copy is longer. AP Ex 16 was read only to the first 118 characters (§10).

---

## 4. Root cause (verified) and hypotheses (not verified)

**Verified**

- **R1: the same textbook content was extracted many times.** Class 10 Maths rows exist for 11 creation days (26 Aug – 3 Sep, 18–19 Sep).
  18 and 19 Sep alone created 1,597 + 2,339 = 3,936 rows (16 distinct chunks on each of the two days), of which 3,302 (84 %) are now hidden duplicates.
  Copies of one question carry different chunk ids and different days, and differ only by extraction formatting: equation tags
  "(1)", "(see Fig. x)", `n^2` / `n²` / `n2`, `₹` / `Rs`, a leading "8.", a missing stem, garbled math.
- **R2: the visibility policy keeps all of `needs_review`**, and `near_duplicate` marks the canonical **and** every copy as needs_review.
  So all 917 stay visible, and the UI cannot tell a copy from a canonical.
- **R3: the near-duplicate rule is text-only.** It has no guard for question number, sub-part or numeric values (the skeleton rule
  has an operator guard; the near rule does not). It is transitive: 28 of 627 copies are ≤ 90 % similar to their own canonical
  and are linked only through another copy.
- **R4: the pass has only run for Class 10 Maths.** The other 81,113 rows (42 class/subject groups) were never audited (§7).
- **R5: canonical selection can pick the worse text** (§5).

**Hypotheses (not proven)**

- H1: the repeated runs are re-ingestions with different chunking (different chunk ids, same chapter). Consistent with the data;
  the extraction logs were not available to confirm.
- H2: the other classes have the same pattern. Their exact-text repeat rate (59.5 %) says yes, but they were not read by hand.

---

## 5. Risk of the obvious fix ("hide every copy that has `near_duplicate_of`")

Measured on all 1,657 visible rows (`scripts/g6/cluster_risk.py`, `naive_hide_risk.py`):

| Measure | Value |
|---|---|
| Near-duplicate clusters / copies | 290 / 627 (sizes: 174 pairs, 48 triples, 29 of four, 18 of five, 21 of six or more) |
| Copies ≥ 95 % similar to their canonical / 90–95 % / ≤ 90 % (transitive) | 416 / 183 / 28 |
| Clusters that contain a **different question** (other sub-part or other question number) | **50 of 290 (17 %)**: 39 by sub-part, 14 by question number |
| Copies a naive hide would remove although the label says another question | **182 of 627 (29 %)** (upper bound: the label parser is a heuristic) |
| Hand check of 12 random copies out of those 182 | **11 really are different questions** (e.g. Exercise 1.1 Q1(i) `140` vs Q1(ii) `156`), 1 uncertain |
| Canonical is the worse text | lost the blank in 4 clusters, garbled while a copy is clean in 6, ≥ 25 % shorter than a copy in 3 (overlap possible; ≤ 13 clusters, ~4.5 %) |
| Copy has an answer the canonical lacks / an image the canonical lacks | 7 / 2 |

So: label equality does not prove redundancy, and **neither does `near_duplicate`**. A broad filter would silently delete about one
question in four among the copies. Nothing was changed.

The existing hidden side is much safer: of a 400-row seeded sample of the 9,136 already-hidden duplicates, **7 (1.8 %)** have a label conflict
with their canonical, all 7 are `exact_hash` copies of identical in-text prompts with different in-text numbering; **0 of the 233 `same_skeleton`**
copies conflict; 14 read by hand were all the same question; all 400 canonicals are visible.

---

## 6. Proposed filtering policy

Principles: nothing is deleted; `quality_status` of existing rows is not rewritten; label equality is never a reason to hide;
every hide is explainable (which canonical, which rule) and reversible without a restore.

| Tier | Rule (all must hold) | Action | Measured on Class 10 Maths |
|---|---|---|---|
| **T1 exact** | same chapter and same whitespace/case-insensitive text | hide the copy | 3 pairs left (6 rows); the 9,136 already hidden stay |
| **T2 near, label-compatible** | existing flag `near_duplicate_of`; same chapter; similarity > 90; **labels compatible after normalisation** (same question number and same sub-part, or one side has no label and similarity ≥ 97); copy has no answer / image / options the canonical lacks; text is not `short_text`; question type is not `intext` | hide the copy **behind a reversible flag** | up to 445 of 627 copies = label-compatible copies (322 with the same digits + 123 whose digit signature differs, mostly notation/OCR: 7 of 8 read were the same question), **before** the short_text / in-text / answer / image conditions are applied, so an upper bound. Hiding all 445: visible 1,657 → 1,212; repeated Example labels 40 → 22 |
| **T3 keep** | label conflict, other sub-part, other question number, short or in-text pairs, garbled-vs-clean across clusters | stay visible; list in a review report | 182 label-conflict copies; the rest |
| **Fragments** (solution text, `(Why ?)`, stem-only) | not a duplicate | out of scope for this policy | rows 9–11 of §3 |

Precision of T2 on hand-read pairs: 15 / 15 strict-tier pairs same question (1 whole-vs-part); 8 numeric-mismatch pairs: 7 same, 1 whole-vs-part.
Together **21 same question, 2 whole-vs-part, 0 different** out of 23 (rule of three: with 0 failures in 23, the false-positive rate is below ~13 % at 95 % confidence).
That is encouraging, not sufficient for an automatic production hide.

**Canonical selection** (current: most math symbols > has answer > figure OK > lowest id). Proposed order:
no garble flag > complete text (not the shorter of two copies with the same prefix; keeps the blank "____") > status clean/fixed over needs_review >
has answer > figure OK > normalised math symbol count (so `^2` does not beat `²`) > lowest id. Re-selecting a canonical is a data change, so it is part of
the approved implementation step, not of this investigation.

**How to make it reversible** (needs a decision; none was done):

| Option | Data change | Reversal | Notes |
|---|---|---|---|
| A. Report only (CSV of T2 / T3 / worse-canonical clusters) | none | n/a | **do this first** |
| B. New flag in `quality_flags` (e.g. `hide_in_builder`) + API filter + `include_copies=1` kill switch | writes the jsonb flag; needs a filter on it (PostgREST jsonb filter or a generated column = migration) | clear the flag; or the query parameter, instantly | **recommended** for the real change |
| C. Set `quality_status='duplicate'`, `duplicate_of` | overwrites `needs_review`; the original status is not in the backup (the backup predates migration 19) | rerun the deterministic pass (seeded; reproduced the counts exactly in G4.4/G4.5) | works, but loses the "why" |

`/ncert-questions/by-ids` must keep resolving **hidden-copy ids** (or map them to the canonical). Today it drops hidden ids and the builder shows "N question(s) in
your saved selection is no longer available" (verified in G5); a saved paper would silently lose questions after the filter ships.

---

## 7. The "1,00,000+ Questions" label

- **Where:** a hard-coded string, `src/pages/TestBuilderPage.tsx:1625` on `fix/ncert-builder-quality` (`:1489` on `perf/teacher-dashboard`). The only commit that touches this string in this file is
  `1f546f1` (30 Sep 2026, "Accountancy tables in question preview + builder redesign", T. Pathak). No code, doc or query derives it; it is the only such claim a grep of the frontend finds.
- **What it could mean, and the current number for each:**

| Metric | Today |
|---|---:|
| Rows in `ncert_questions` (= distinct ids) | **91,906** |
| Rows visible to the builder (not `duplicate`/`junk`) | **82,770** |
| Rows ever audited for duplicates | 10,793 (Class 10 Maths only, 11.7 %) |
| Class 10 Maths visible | 1,657 |
| Rows with distinct text inside their chapter (whitespace/case-insensitive) | **34,987** (61.9 % of rows are exact-text repeats) |
| Same, unaudited classes only | 32,842 of 81,113 (59.5 % repeats) |

- The claim is **false for rows** (91,906 < 100,000) and misleading for questions: even the visible figure is inflated by repeats that were never removed outside Class 10 Maths.
  Calibration: Class 10 Maths 10,793 rows → 2,145 exact-distinct → **1,657** after the full pass (×0.77), so exact-text counting under-states the redundancy.
  An extrapolation to ~27 k real questions would be a guess (not measured), so it is **not** proposed as a number.
- Worst unaudited groups by exact-text repeats: Class 10 History 5,620 → 268 (95 %), Class 10 Political Science 2,145 → 343 (84 %), Class 11 Chemistry 3,834 → 746 (81 %),
  **Class 10 Science 6,415 → 1,322 (79 %), which is the builder's default screen**.
- **Recommendation:** drop the hard-coded number. Show the count the page already fetches (`/ncert-question-stats` → `totalQuestions`) for the current selection,
  e.g. "1,657 questions · Class 10 Mathematics". For classes not yet de-duplicated the number includes repeats, so either word it that way or show no headline for them.
  Do not hard-code a replacement number. Which metric the owner wants shown is their call.

---

## 8. Test and regression plan

Fixtures: `docs/G6_FIXTURES.json` (real rows, expected outcome by reviewer reading). Existing G5 scripts (`scripts/g5-builder-local.mjs`, `scripts/g5-api-checks.py`) stay the browser/API regression suite.

| Area | Test | Source of truth |
|---|---|---|
| Exact duplicates | F13: two byte-identical texts → one visible | fixture |
| OCR / format-only | F1, F2, F3, F11: 5 / 2 / 3 / 3 rows → exactly 1 visible; F1 prefers the clean row | fixture |
| Same template, different questions | **F4, F5, F6 must keep every sub-part / question** (the naive rule fails these; this is the key regression test) | fixture |
| Worse canonical | F7: the row with the blank wins | fixture |
| Not duplicates | F8, F9, F10, F12: both rows stay visible (solution text, fragments, granularity, short in-text) | fixture |
| Label normalisation (table-driven) | `Q.11` = `Exercise 5.3 Q11` = `11.` = `Ex 5.3 Q11`; `1.(iii)` ≠ `1.(iv)`; `Example 14 (i)` ≠ `Example 14 (ii)`; `Q 1(i)` = `Exercise 7.1 Q1 (i)`; `EXERCISE 10.2, 7`; empty label | new unit test |
| Visibility policy | `needs_review` stays visible unless the T2 conditions hold; `short_text` / `intext` pairs never hidden | unit test on the filter function |
| Invariants (SQL, before/after) | every hidden copy's canonical is visible; no cluster loses all members; hidden set = the approved report exactly; clearing the flag restores 1,657 | SQL check |
| Stable ids / persistence | ids never change; `by-ids` still returns a hidden-copy id (or its canonical); localStorage `ncert_builder_selection_v2` restores the same paper | API test + `g5-builder-local.mjs` check 5 |
| No regression | chapter chips sum = list total = stats total; type / figure filters; search; drag overlay shows the full text; no `(A)(A)`; `Cache-Control: private, no-store` still on all three GET endpoints | `g5-builder-local.mjs`, `g5-api-checks.py` |
| Scale | run the same invariants on a non-audited class (e.g. Class 10 Science) in dry-run before any enable | report only |

Coordination: no test run starts a server on 5173 / 8010 while another session uses them; use other ports or read-only SQL (as here).

---

## 9. Risk assessment and recommendation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hiding a different question (sub-part / template) | high for a naive rule (29 % of copies by label) | teachers lose questions silently | T2 label guard + review report + larger precision sample |
| Canonical is the worse text | ~4.5 % of clusters | broken question shown (missing blank, garbled math) | new canonical order (§6) |
| Saved papers lose a question | certain if hidden ids are dropped by `by-ids` | confusing "no longer available" | `by-ids` resolves hidden-copy ids |
| Label parser wrong on noisy labels | medium | wrong keep / hide | table-driven tests, conservative default (keep) |
| Unaudited classes still full of repeats (59.5 %) | certain | the largest user-facing problem, larger than the 40 labels | separate decision: run the pass per class, dry-run first |
| Header number | certain today | misleading claim | dynamic count |

**Recommendation: gather more data, then implement in small steps. Do not implement a broad filter now.**

1. **Now, separate small change (needs your approval):** replace the hard-coded "1,00,000+ Questions" with the dynamic count.
2. **Next:** a read-only dry-run report (CSV) of T2 (445), T3 (182), worse-canonical clusters (≤ 13) and the 3 exact pairs; a second reviewer labels ≥ 100 pairs;
   proceed only if precision on T2 is ≥ 98 % with the interval reported.
3. **Then:** T2 behind the reversible flag (option B) with a kill switch, Class 10 Maths only; `by-ids` fix and the new canonical order in the same change.
4. **Separately:** decide whether to run the quality pass for the other 42 class/subject groups; it matters more than these 40 labels.

Leave current behaviour unchanged for everything else, including `Cache-Control: private, no-store`.

---

## 10. Unverified assumptions and limits

- Every "same / different question" judgement is mine, by reading; there is no second reviewer. Samples are small: 16 clusters, 12 + 15 + 8 pairs, 14 of 400 hidden pairs read.
- The label parser (`scripts/g6/naive_hide_risk.py`) is a heuristic; 182 is an upper bound for "different question", supported by 11 / 12 in a hand check.
- AP Example 16 (ratio 77) and QE Example 6 (ratio 63) were judged "same example" from the first ~110 characters; the tails were not compared.
- The hidden-duplicate check (400 rows) covers label conflicts and 14 hand-read pairs, not all 9,136; `same_skeleton` (5,164) was sampled (233), not exhaustively read.
- Exact-text repeats for other classes use whitespace / case normalisation only; they say nothing about near-duplicates, chapter-name variants or whether the repeats are "the same question" in a pedagogical sense.
- Only the visible Class 10 Maths set and one hidden sample were examined; Class 10 Science etc. were measured, not read.
- Extraction logs were not available; R1's mechanism (re-ingestion) is inferred from ids and dates.
- The dumps are in the session scratchpad (`…\scratchpad\g6_*.json`), not in the repo.

---

## Appendix: how to reproduce

Read-only SQL through `npx supabase db query --linked "<sql>"`:

```sql
-- totals
select count(*), count(distinct id),
       count(*) filter (where quality_status is null or quality_status not in ('duplicate','junk')),
       count(*) filter (where quality_status is not null) from ncert_questions;
-- exact-text repeats per class / subject
select class_grade, subject, count(*) as total_rows,
       count(distinct (chapter, md5(lower(regexp_replace(question_text, '\s+', '', 'g'))))) as distinct_exact_text
from ncert_questions group by 1,2 order by 1,2;
-- visible Class 10 Maths rows with provenance
select q.id, q.chapter, q.question_number, q.question_type, q.question_text, q.answer, q.quality_status, q.quality_flags,
       q.content_hash, q.source_chunk_id, q.created_at, c.chapter as chunk_chapter
from ncert_questions q left join ncert_chunks c on c.id = q.source_chunk_id
where q.class_grade='10' and q.subject='Mathematics' and (q.quality_status is null or q.quality_status not in ('duplicate','junk'));
```

Analysis (Python, rapidfuzz): `scripts/g6/analyse_repeated_labels.py`, `cluster_risk.py`, `naive_hide_risk.py`, `hidden_duplicates_check.py`, `make_fixtures.py`.
No commit, no push, no migration, no database write, no cache-header change, no deploy.
