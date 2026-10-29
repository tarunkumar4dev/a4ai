"""Build docs/G6_FIXTURES.json: real production rows (Class 10 Mathematics, visible on 28 Oct 2026) with the reviewer's
expected outcome for a near-duplicate policy. Read-only: reads the SQL dump, writes one JSON file."""
import json
import sys

src, out = sys.argv[1], sys.argv[2]
rows = {r["id"]: r for r in json.load(open(src, encoding="utf-8"))["rows"]}


def row(i):
    r = rows[i]
    f = r["quality_flags"] or {}
    return {
        "id": r["id"], "chapter": r["chapter"], "question_number": r["question_number"], "question_type": r["question_type"],
        "question_text": r["question_text"], "has_answer": r["has_answer"], "has_image": r["has_image"],
        "quality_status": r["quality_status"], "flags": f.get("flags"), "near_duplicate_of": f.get("near_duplicate_of"),
        "garble": f.get("garble"), "source_chunk_id": r["source_chunk_id"], "created_at": r["created_at"],
    }


# expected_visible: ids a correct policy must leave visible. "either_of": exactly one of the ids.
GROUPS = [
    ("F1_same_question_5_extraction_runs", "OCR / formatting variants of ONE question (Statistics Example 2, table text)", [2988, 4423, 7678, 16457, 25137],
     {"visible_count": 1, "prefer": 7678, "why": "7678 is the only row with status clean"}),
    ("F2_same_question_figure_reference", "Same question; one copy keeps '(see Fig. 10.1)'", [1493, 46223],
     {"visible_count": 1}),
    ("F3_label_noise_same_question", "Same question, labels 'Q.11' / 'Exercise 5.3 Q11'; n^2 vs n2 vs n²", [6397, 47100, 1469],
     {"visible_count": 1, "needs": "label normalisation (Q.11 == Exercise 5.3 Q11)"}),
    ("F4_template_cluster_different_subparts", "Coordinate Geometry Exercise 7.1 Q1: (i) twice, (ii) different points", [2006, 45618, 45619],
     {"visible_count": 2, "must_keep": [45619], "either_of": [2006, 45618], "why": "45619 is Q1(ii) with different points; a naive 'hide near_duplicate copies' removes it"}),
    ("F5_different_subparts_short_fragments", "Arithmetic Progressions Example 14 (i) / (ii): different sub-questions", [25756, 25757],
     {"visible_count": 2, "must_keep": [25756, 25757]}),
    ("F6_same_template_different_values", "Areas Related to Circles, labels '6' and '7': r=15 cm / 60 deg vs r=12 cm / 120 deg", [1349, 1350],
     {"visible_count": 2, "must_keep": [1349, 1350]}),
    ("F7_canonical_lost_the_blank", "Triangles 1.(iii): the stored canonical lost the blank, the copy keeps it", [4585, 7866],
     {"visible_count": 1, "prefer": 7866, "why": "'All triangles are similar. (isosceles, equilateral)' has no blank; 7866 has '________'"}),
    ("F8_solution_text_not_a_duplicate", "Circles Example 1: second row is the worked solution ('We are given two concentric circles ...')", [1491, 12735],
     {"visible_count": 2, "note": "not a duplicate; a separate fragment/solution rule would handle 12735"}),
    ("F9_fragment_not_a_duplicate", "Probability Example 1: second row is the fragment '(Why ?)'", [2762, 22102],
     {"visible_count": 2, "note": "not a duplicate; short_text rule, out of scope for dedupe"}),
    ("F10_whole_vs_stem_only", "Arithmetic Progressions Example 14: whole question vs stem-only 'Find the sum of :'", [1456, 25755],
     {"visible_count": 2, "note": "granularity (rule 6) is undecided; dedupe must not decide it"}),
    ("F11_same_question_variants_sub_part", "Quadratic Equations Example 1 (i): three variants of one sub-part", [4264, 24894, 45873],
     {"visible_count": 1}),
    ("F12_uncertain_short_intext", "Coordinate Geometry in-text prompts 'Can we/you find the distance between them'", [16421, 16422],
     {"visible_count": 2, "note": "short_text, may be two prompts in the book; never auto-hide short_text pairs"}),
    ("F13_exact_text_still_visible", "Polynomials Exercise 2.2 Q1: byte-identical text, different hash (garbled math guard)", [2759, 4180],
     {"visible_count": 1}),
]
groups = []
for name, desc, ids, expect in GROUPS:
    groups.append({"name": name, "description": desc, "expected": expect, "rows": [row(i) for i in ids]})
doc = {
    "about": "Real rows from public.ncert_questions (Class 10 Mathematics, quality_status in clean/fixed/needs_review), read 28 Oct 2026. "
             "'expected' is the reviewer's judgement from reading the question text, not a model output. Source: NCERT textbook text already stored in the repo's fixtures.",
    "groups": groups,
}
json.dump(doc, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("groups:", len(groups), "rows:", sum(len(g["rows"]) for g in groups))
