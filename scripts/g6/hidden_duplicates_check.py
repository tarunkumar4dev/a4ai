"""G6: do the ALREADY-HIDDEN duplicates (production, Class 10 Maths) ever differ from their canonical in question number or
sub-part? Reads the 400-row seeded sample (md5(id) order). Usage: python g6_hidden_check.py <g6_hidden_sample.json>"""
import collections
import json
import re
import sys

rows = json.load(open(sys.argv[1], encoding="utf-8"))["rows"]
ROMAN = r"\(\s*([ivx]{1,4})\s*\)"


def parse_label(lbl):
    s = (lbl or "").strip().lower()
    sub = re.search(ROMAN, s)
    sub = sub.group(1) if sub else None
    s2 = re.sub(ROMAN, " ", s)
    s2 = re.sub(r"exercise\s*\d+\.\d+|ex\.?\s*\d+\.\d+", " ", s2)
    m = re.search(r"example\s*(\d+)", s2) or re.search(r"q\.?\s*(\d+)", s2) or re.search(r"(\d+)", s2)
    return (m.group(1) if m else None), sub


reason = collections.Counter()
conf = []
for r in rows:
    reason[(r["flags"] or {}).get("duplicate_reason")] += 1
    q1, s1 = parse_label(r["lab"])
    q2, s2 = parse_label(r["clab"])
    if (s1 and s2 and s1 != s2) or (q1 and q2 and q1 != q2):
        conf.append(r)

print("hidden duplicates in sample:", len(rows), "| by duplicate_reason:", dict(reason))
print(f"label conflict with the canonical: {len(conf)} ({100 * len(conf) / len(rows):.1f}%)")
cl = lambda s: (s or "").replace("\r", "").replace("\n", " / ")[:92]
by_reason = collections.Counter((r["flags"] or {}).get("duplicate_reason") for r in conf)
print("conflicts by reason:", dict(by_reason))
for r in conf[:12]:
    print(f"  hidden {r['id']} [{(r['flags'] or {}).get('duplicate_reason')}] lab={r['lab']!r}: {cl(r['txt'])}")
    print(f"  canon  {r['cid']} lab={r['clab']!r}: {cl(r['ctxt'])}")
