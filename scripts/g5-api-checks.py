"""G5 data-level checks against a local backend (read-only GETs). Usage: python g5_api_checks.py <base> <out.json>"""
import json
import re
import sys
import urllib.parse
import urllib.request

base, out = sys.argv[1].rstrip("/"), sys.argv[2]
API = base + "/api/v1/test-generator"


def get(path, **params):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r), dict(r.headers)


def all_rows(**params):
    rows, offset = [], 0
    while True:
        d, _ = get("/ncert-questions", limit=100, offset=offset, **params)
        assert d.get("ok"), d
        rows += d["questions"]
        if not d.get("hasMore") or not d["questions"]:
            return rows, d["total"]
        offset += len(d["questions"])


rows, total = all_rows(subject="Mathematics", class_grade="10")
ids = [r["id"] for r in rows]
res = {
    "rows_downloaded": len(rows),
    "total_reported": total,
    "distinct_ids": len(set(ids)),
    "duplicate_ids_across_pages": len(ids) - len(set(ids)),
}

# quality_status of what is visible (hidden duplicates / junk must not appear)
res["quality_status_values"] = {}
for r in rows:
    k = str(r.get("quality_status"))
    res["quality_status_values"][k] = res["quality_status_values"].get(k, 0) + 1

# 2. "Areas Related to Circles": how many visible rows are "Example 1"
arc = [r for r in rows if r.get("chapter") == "Areas Related to Circles"]
ex1 = [r for r in arc if str(r.get("question_number") or "").strip().lower() == "example 1"]
res["areas_related_to_circles"] = {
    "visible_rows": len(arc),
    "example_1_count": len(ex1),
    "example_1_ids": [r["id"] for r in ex1],
    "example_1_texts": [(r.get("question_text") or r.get("text") or "")[:90] for r in ex1],
    "question_numbers": sorted({str(r.get("question_number")) for r in arc})[:40],
}
# the same check, per chapter: any "Example N" label that repeats inside one chapter
dups = {}
for r in rows:
    qn = str(r.get("question_number") or "").strip()
    if re.fullmatch(r"(?i)example\s*\d+", qn):
        dups.setdefault((r["chapter"], qn.lower()), []).append(r["id"])
res["example_labels_repeating_in_a_chapter"] = {f"{c} · {q}": v for (c, q), v in dups.items() if len(v) > 1}
res["example_labels_total"] = sum(len(v) for v in dups.values())

# 4. "(A)(A)": doubled option labels in question text or options
BAD = re.compile(r"\(\s*[A-Da-d]\s*\)\s*[\(\[]\s*[A-Da-d]\s*[\)\]]|\b[A-D]\)\s*\(\s*[A-D]\s*\)|^\s*\(\s*[A-D]\s*\)\s*\(\s*[A-D]\s*\)", re.M)
hits = []
checked_options = 0
for r in rows:
    texts = [("text", r.get("question_text") or r.get("text") or "")]
    opts = r.get("options")
    if isinstance(opts, list):
        for i, o in enumerate(opts):
            checked_options += 1
            texts.append((f"option{i}", o if isinstance(o, str) else json.dumps(o)))
    elif isinstance(opts, dict):
        for k, o in opts.items():
            checked_options += 1
            texts.append((f"option{k}", f"({k}) {o}"))
    for where, t in texts:
        if BAD.search(t or ""):
            hits.append({"id": r["id"], "where": where, "sample": (t or "")[:80]})
res["double_option_label"] = {"rows_checked": len(rows), "options_checked": checked_options, "hits": len(hits), "samples": hits[:5]}

# the builder's own raw option field shape (for the browser check)
sample = next((r for r in rows if r.get("options")), None)
res["option_shape_example"] = {"type": type(sample["options"]).__name__, "first": (sample["options"][:2] if isinstance(sample["options"], list) else list(sample["options"].items())[:2])} if sample else None

# 5. cache headers on all three endpoints, and by-ids on a visible + a made-up id
hdr = {}
for name, path, params in [
    ("ncert-questions", "/ncert-questions", dict(subject="Mathematics", class_grade="10", limit=1)),
    ("ncert-question-stats", "/ncert-question-stats", dict(subject="Mathematics", class_grade="10")),
    ("by-ids", "/ncert-questions/by-ids", dict(ids=f"{ids[0]},{ids[1]},999999999")),
]:
    d, h = get(path, **params)
    hdr[name] = h.get("cache-control") or h.get("Cache-Control")
    if name == "by-ids":
        res["by_ids"] = {"asked": 3, "returned": len(d["questions"]), "made_up_id_dropped": 999999999 not in [q["id"] for q in d["questions"]]}
res["cache_control"] = hdr

json.dump(res, open(out, "w"), indent=1)
print(json.dumps(res, indent=1)[:6000])
