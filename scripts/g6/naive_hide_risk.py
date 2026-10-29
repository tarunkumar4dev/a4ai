"""G6: measure the two risks of a naive 'hide every near_duplicate_of copy' rule on the 1,657 visible rows.
 (1) a copy that is a DIFFERENT question than its canonical (other sub-part / other question number)
 (2) a canonical that is a WORSE text than a copy (missing blank, truncated, garbled)
Usage: python g6_risk.py <g6_visible.json> <out.json>"""
import collections
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src, encoding="utf-8"))["rows"]
by = {r["id"]: r for r in rows}
nd = lambda r: (r["quality_flags"] or {}).get("near_duplicate_of")
clusters = collections.defaultdict(list)
for r in rows:
    if nd(r):
        clusters[nd(r)].append(r["id"])

ROMAN = r"\(\s*([ivx]{1,4})\s*\)"


def parse_label(lbl):
    """-> (question number or None, roman sub-part or None). Labels are free text ('Q.3', '4. (viii)', 'Exercise 5.2 Q2 (i)', '9')."""
    s = (lbl or "").strip().lower()
    sub = re.search(ROMAN, s)
    sub = sub.group(1) if sub else None
    s2 = re.sub(ROMAN, " ", s)
    s2 = re.sub(r"exercise\s*\d+\.\d+|ex\.?\s*\d+\.\d+|example", " ", s2)  # keep Example N's N as the number
    m = re.search(r"q\.?\s*(\d+)", s2) or re.search(r"(\d+)", s2)
    return (m.group(1) if m else None), sub


def label_of(r):
    base = r.get("question_number") or ""
    if re.match(r"(?i)example", base):
        m = re.search(r"example\s*(\d+)", base, re.I)
        n, sub = parse_label(base)
        return ("ex" + (m.group(1) if m else ""), sub)
    return parse_label(base)


stat = collections.Counter()
wrong_copies = []   # copies a naive rule would hide although they are another question
for root, ids in clusters.items():
    canon = by[root]
    cq, cs = label_of(canon)
    mem = [by[i] for i in ids]
    subs = {label_of(by[i])[1] for i in [root] + ids} - {None}
    qs = {label_of(by[i])[0] for i in [root] + ids} - {None}
    if len(subs) > 1:
        stat["clusters_with_different_sub_parts"] += 1
    if len(qs) > 1:
        stat["clusters_with_different_question_numbers"] += 1
    if len(subs) > 1 or len(qs) > 1:
        stat["clusters_with_a_different_question_inside"] += 1
    for r in mem:
        q, s = label_of(r)
        different = (s and cs and s != cs) or (q and cq and q != cq)
        if different:
            wrong_copies.append((r["id"], root, r["chapter"], r["question_number"], canon["question_number"]))
    # (2) canonical worse than a copy
    ct = canon["question_text"] or ""
    blank = lambda t: bool(re.search(r"_{3,}", t or ""))
    if any(blank(by[i]["question_text"]) for i in ids) and not blank(ct):
        stat["canonical_lost_the_blank"] += 1
    longest = max((by[i]["question_text"] or "" for i in ids), key=len)
    if len(longest) > 1.25 * len(ct) and len(ct) > 0:
        stat["canonical_much_shorter_than_a_copy(>25%)"] += 1
    if canon["quality_flags"] and "garble" in canon["quality_flags"] and any("garble" not in (by[i]["quality_flags"] or {}) for i in ids):
        stat["canonical_garbled_a_copy_is_not"] += 1
    stat["clusters"] += 1
    stat["copies"] += len(ids)

res = {
    "clusters": stat["clusters"], "visible_copies": stat["copies"],
    **{k: v for k, v in stat.items() if k not in ("clusters", "copies")},
    "copies_a_naive_hide_would_wrongly_remove (different sub-part / question number than the canonical)": len(wrong_copies),
    "pct_of_copies": round(100 * len(wrong_copies) / max(1, stat["copies"]), 1),
    "sample_wrong_copies": wrong_copies[:14],
}
json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))
