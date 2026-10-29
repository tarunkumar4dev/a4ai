"""G6: risk analysis of the visible near-duplicate clusters (read-only analysis of a SQL dump of the 1,657 visible
Class 10 Maths rows). Usage: python g6_clusters.py <g6_visible.json> <out.json>"""
import collections
import json
import re
import sys

from rapidfuzz import fuzz

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src, encoding="utf-8"))["rows"]
by_id = {r["id"]: r for r in rows}
flags = lambda r: (r["quality_flags"] or {})
nd = lambda r: flags(r).get("near_duplicate_of")


def norm(s):
    return re.sub(r"[^0-9a-zͰ-Ͽ∀-⋿]+", "", (s or "").lower())


NOISE = [r"\(\s*see\s+fig[^)]*\)", r"\(\s*\d\s*\)", r"fig\.?\s*\d+\.\d+", r"example\s*\d+\s*:?", r"section\s*\d+\.\d+", r"exercise\s*\d+\.\d+"]


def signature(text):
    t = (text or "").lower()
    for p in NOISE:
        t = re.sub(p, " ", t)
    return tuple(sorted(re.findall(r"\d+(?:\.\d+)?", t)))


def lab(r):
    return re.sub(r"\s+", " ", (r.get("question_number") or "").strip().lower())


def garbled(r):
    return "garble" in flags(r) or "garbled_math" in (flags(r).get("flags") or [])


# clusters: a copy points at its canonical through quality_flags.near_duplicate_of
clusters = collections.defaultdict(list)
for r in rows:
    root = nd(r)
    if root:
        clusters[root].append(r["id"])
members_of = {root: [root] + ids for root, ids in clusters.items()}
missing_root = [root for root in clusters if root not in by_id]  # the canonical must itself be visible

stat = collections.Counter()
examples = collections.defaultdict(list)
for root, ids in members_of.items():
    mem = [by_id[i] for i in ids if i in by_id]
    canon = by_id.get(root)
    if not canon:
        continue
    stat["clusters"] += 1
    stat["copies"] += len(mem) - 1
    sizes = len(mem)
    stat[f"size_{min(sizes, 6)}"] += 1
    labs = {lab(r) for r in mem}
    types = {r["question_type"] for r in mem}
    sigs = {signature(r["question_text"]) for r in mem}
    # (1) label disagreement
    if len(labs) > 1:
        stat["clusters_mixed_label"] += 1
        examples["mixed_label"].append((root, sorted(labs)))
    # (2) different numeric values after dropping tags / figure refs / example numbers
    if len(sigs) > 1:
        stat["clusters_numeric_signature_differs"] += 1
        examples["numeric_differs"].append((root, [(r["id"], signature(r["question_text"])[:8]) for r in mem][:3]))
    if len(types) > 1:
        stat["clusters_mixed_question_type"] += 1
    # (3) canonical vs the rest
    if garbled(canon) and any(not garbled(r) for r in mem if r["id"] != root):
        stat["clusters_canonical_garbled_but_clean_copy_exists"] += 1
        examples["garbled_canon"].append(root)
    if not canon["has_answer"] and any(r["has_answer"] for r in mem if r["id"] != root):
        stat["clusters_canonical_lacks_answer_copy_has"] += 1
    if not canon["has_image"] and any(r["has_image"] for r in mem if r["id"] != root):
        stat["clusters_canonical_lacks_image_copy_has"] += 1
    if canon["quality_status"] == "needs_review" and any(r["quality_status"] in ("clean", "fixed") for r in mem if r["id"] != root):
        stat["clusters_canonical_needs_review_but_a_copy_is_clean_or_fixed"] += 1
    # similarity of each copy to its canonical
    for r in mem:
        if r["id"] == root:
            continue
        ratio = fuzz.ratio(norm(canon["question_text"]), norm(r["question_text"]))
        stat["copy_ratio_90_95"] += 90 < ratio <= 95
        stat["copy_ratio_95_100"] += ratio > 95
        stat["copy_len_ratio_gt_1.5"] += max(len(r["question_text"] or ""), len(canon["question_text"] or "")) > 1.5 * max(1, min(len(r["question_text"] or ""), len(canon["question_text"] or "")))

# "safe tier": a copy is auto-hide-able only if everything below agrees with its canonical
safe, unsafe, why = [], [], collections.Counter()
for root, ids in members_of.items():
    canon = by_id.get(root)
    if not canon:
        continue
    for i in ids[1:]:
        r = by_id.get(i)
        if not r:
            continue
        reasons = []
        if lab(r) != lab(canon):
            reasons.append("label differs")
        if signature(r["question_text"]) != signature(canon["question_text"]):
            reasons.append("numeric values differ")
        if r["question_type"] != canon["question_type"]:
            reasons.append("type differs")
        if fuzz.ratio(norm(canon["question_text"]), norm(r["question_text"])) < 95 and garbled(canon) is False and garbled(r) is False:
            reasons.append("ratio < 95 (both clean)")
        if r["has_answer"] and not canon["has_answer"]:
            reasons.append("copy has the answer, canonical doesn't")
        if r["has_image"] and not canon["has_image"]:
            reasons.append("copy has the image, canonical doesn't")
        if reasons:
            unsafe.append(i)
            for x in reasons:
                why[x] += 1
        else:
            safe.append(i)

# how many repeated Example labels would remain if the safe tier were hidden
vis_after = [r for r in rows if r["id"] not in set(safe)]
ex = [r for r in vis_after if re.match(r"(?i)example", r.get("question_number") or "")]
rep_after = collections.Counter((r["chapter"], lab(r)) for r in ex)
ex_all = [r for r in rows if re.match(r"(?i)example", r.get("question_number") or "")]
rep_before = collections.Counter((r["chapter"], lab(r)) for r in ex_all)

res = {
    "visible_rows": len(rows),
    "visible_status": dict(collections.Counter(r["quality_status"] for r in rows)),
    "rows_with_near_duplicate_of (visible copies)": sum(1 for r in rows if nd(r)),
    "canonical_not_visible (must be 0)": len(missing_root),
    "cluster_stats": dict(stat),
    "safe_tier_copies": len(safe),
    "unsafe_copies_keep_visible": len(unsafe),
    "why_unsafe": dict(why),
    "visible_after_safe_tier": len(vis_after),
    "example_labels_repeating_before": sum(1 for v in rep_before.values() if v > 1),
    "example_labels_repeating_after_safe_tier": sum(1 for v in rep_after.values() if v > 1),
    "example_rows_before": len(ex_all), "example_rows_after": len(ex),
    "examples_numeric_differs": examples["numeric_differs"][:12],
    "examples_mixed_label": examples["mixed_label"][:8],
}
json.dump({"result": res, "safe": safe, "unsafe": unsafe}, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False)[:6000])
