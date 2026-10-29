"""G6: classify every repeated 'Example N' label among the VISIBLE Class 10 Maths rows (read-only analysis of a SQL dump).
Usage: python g6_analyse.py <g6_examples.json> <out.json>
"""
import collections
import itertools
import json
import re
import sys

from rapidfuzz import fuzz

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src, encoding="utf-8"))["rows"]

MATH = set("+-−–=<>≤≥×÷^()[]{}.,;:|/\\·°")


def norm(s):  # same spirit as the quality pass: lower-case, drop whitespace and punctuation
    return re.sub(r"[^0-9a-zͰ-Ͽ∀-⋿]+", "", (s or "").lower())


def numbers(s):
    return re.findall(r"\d+(?:\.\d+)?", s or "")


def opts(r):
    o = r.get("options")
    if isinstance(o, str):
        try:
            o = json.loads(o)
        except Exception:
            return [o]
    if isinstance(o, str):
        try:
            o = json.loads(o)
        except Exception:
            return [o]
    return o if isinstance(o, list) else []


def label_key(r):
    qn = (r.get("question_number") or "").strip().lower()
    return (r["chapter"], re.sub(r"\s+", " ", qn))


def solution_like(t):
    t = (t or "").lstrip()
    return bool(re.match(r"(?i)(solution|we are given|let us|here,? )", t)) or bool(re.search(r"(?i)\bsolution\s*:", t[:80]))


groups = collections.defaultdict(list)
for r in rows:
    groups[label_key(r)].append(r)
rep = {k: v for k, v in groups.items() if len(v) > 1}

CASES = {}
details = []
for (chapter, label), grp in sorted(rep.items()):
    grp = sorted(grp, key=lambda r: r["id"])
    pair = []
    for a, b in itertools.combinations(grp, 2):
        na, nb = norm(a["question_text"]), norm(b["question_text"])
        pair.append({
            "a": a["id"], "b": b["id"],
            "ratio": round(fuzz.ratio(na, nb), 1),
            "same_hash": a["content_hash"] == b["content_hash"],
            "same_numbers": numbers(a["question_text"]) == numbers(b["question_text"]),
            "len_a": len(a["question_text"] or ""), "len_b": len(b["question_text"] or ""),
            "same_chunk": a["source_chunk_id"] == b["source_chunk_id"],
            "same_run_day": (a["created_at"] or "")[:10] == (b["created_at"] or "")[:10],
            "same_type": a["question_type"] == b["question_type"],
            "same_answer": (a["answer"] or "").strip() == (b["answer"] or "").strip(),
            "same_options": opts(a) == opts(b),
        })
    ids = [r["id"] for r in grp]
    # canonical = the row the pass chose; non-canonical members point at it through quality_flags.near_duplicate_of
    nd = {r["id"]: (r["quality_flags"] or {}).get("near_duplicate_of") for r in grp}
    flagged = [r["id"] for r in grp if nd[r["id"]]]
    hi = [p for p in pair if p["ratio"] > 90]
    mid = [p for p in pair if 60 <= p["ratio"] <= 90]
    lo = [p for p in pair if p["ratio"] < 60]
    sol = [r["id"] for r in grp if solution_like(r["question_text"])]
    types = sorted({r["question_type"] for r in grp})
    # case assignment (the strongest evidence for the whole group wins; mixed groups are listed as such)
    all_hi = len(hi) == len(pair)
    if all_hi and all(p["same_numbers"] for p in pair):
        case = "B: same question, formatting/OCR variants (stem ratio > 90, same numbers)"
    elif all_hi:
        case = "C: near-identical text but DIFFERENT numbers (possible different values)"
    elif sol and len(sol) < len(grp):
        case = "D1: question + its worked-solution text extracted as a second 'question' with the same label"
    elif all(p["ratio"] < 60 for p in pair):
        case = "D2: unrelated stems share the label (different questions or a mis-read label)"
    else:
        case = "E: mixed (some pairs near-identical, some different)"
    CASES[case] = CASES.get(case, 0) + 1
    details.append({
        "chapter": chapter, "label": label, "n": len(grp), "case": case, "ids": ids,
        "types": types, "flagged_near_dup": flagged, "canonical_guess": [i for i in ids if i not in flagged],
        "hi": len(hi), "mid": len(mid), "lo": len(lo),
        "min_ratio": min(p["ratio"] for p in pair), "max_ratio": max(p["ratio"] for p in pair),
        "pairs": pair,
        "stems": {r["id"]: (r["question_text"] or "").replace("\r", "").replace("\n", " / ")[:150] for r in grp},
        "status": {r["id"]: r["quality_status"] for r in grp},
        "chunks": {r["id"]: r["source_chunk_id"] for r in grp},
        "created": {r["id"]: (r["created_at"] or "")[:16] for r in grp},
        "n_options": {r["id"]: len(opts(r)) for r in grp},
        "has_image": {r["id"]: bool(r["image_url"]) for r in grp},
        "flags": {r["id"]: (r["quality_flags"] or {}).get("flags") for r in grp},
    })

summary = {
    "visible_example_rows": len(rows),
    "distinct_labels": len(groups),
    "labels_repeated": len(rep),
    "rows_in_repeated_labels": sum(len(v) for v in rep.values()),
    "rows_that_are_extra_copies_if_all_collapsed": sum(len(v) - 1 for v in rep.values()),
    "cases": CASES,
    "flagged_near_duplicate_rows_in_repeated_groups": sum(len(d["flagged_near_dup"]) for d in details),
    "groups_with_no_near_dup_flag_at_all": sum(1 for d in details if not d["flagged_near_dup"]),
    "any_pair_same_hash": sum(1 for d in details for p in d["pairs"] if p["same_hash"]),
    "pairs_diff_chunk": sum(1 for d in details for p in d["pairs"] if not p["same_chunk"]),
    "pairs_same_chunk": sum(1 for d in details for p in d["pairs"] if p["same_chunk"]),
}
json.dump({"summary": summary, "groups": details}, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(summary, indent=1, ensure_ascii=False))
