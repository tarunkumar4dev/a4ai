#!/usr/bin/env python3
"""Class → Subject → Batch backfill: DRY RUN report + SQL generator. Never writes to the database.

    # 1) read-only report against the linked project (SELECTs only, `supabase db query --linked --read-only`)
    python scripts/class_subject_batch_backfill.py report --institute "Education Beast"
        -> supabase/backfill/class_subject_batch_map.csv          (batches: edit the `decision` column)
        -> supabase/backfill/class_subject_batch_ta_actions.csv   (teaching_assignments: edit the `decision` column)
        -> docs/design/class_subject_batch_backfill_report.md      (human-readable table)

    # 2) after you edited the CSVs: generate (NOT run) the apply script
    python scripts/class_subject_batch_backfill.py sql --institute-id <uuid>
        -> supabase/backfill/class_subject_batch_apply.sql        (one transaction; the human runs it in the SQL editor)

decision column (batches):   blank = take `action` as proposed; USE:<subject_uuid> | CREATE:<name> | SKIP
decision column (TA):        blank = take `proposed_action`;     DELETE | KEEP | REPOINT:<batch_uuid>
Matching rules mirror src/lib/teachingAssign.ts (compact names, "Eco" ≈ "Economics", trailing-s stem).
"""
import argparse
import csv
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "supabase" / "backfill"
MAP_CSV = OUT_DIR / "class_subject_batch_map.csv"
TA_CSV = OUT_DIR / "class_subject_batch_ta_actions.csv"
APPLY_SQL = OUT_DIR / "class_subject_batch_apply.sql"
REPORT_MD = ROOT / "docs" / "design" / "class_subject_batch_backfill_report.md"


# ─────────────────────────────── read-only DB access ───────────────────────────────
def query(sql: str) -> list[dict]:
    sql = " ".join(sql.split())          # one line: Windows cmd drops everything after a newline
    cmd = ["npx", "-y", "supabase@latest", "db", "query", "--linked", "--read-only", sql]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", shell=(sys.platform == "win32"), cwd=ROOT)
    out = res.stdout
    start = out.find("{")
    if start < 0:
        raise SystemExit(f"query failed: {(res.stdout + res.stderr)[:600]}")
    data = json.loads(out[start:])
    if "error" in data:
        raise SystemExit(f"query error: {json.dumps(data['error'])[:600]}")
    return data.get("rows", [])


def lit(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


# ─────────────────────────────── name matching (port of teachingAssign.ts) ───────────────────────────────
def compact(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "").lower()
    return re.sub(r"[^0-9a-z]", "", s)


def initials(name: str) -> str:
    return "".join(w[0] for w in re.split(r"[^0-9A-Za-z]+", name) if w).lower()


def same_subject(subject_name: str, label: str) -> bool:
    a, b = compact(subject_name), compact(label)
    if not a or not b:
        return False
    if a == b:
        return True
    short, long = (a, b) if len(a) <= len(b) else (b, a)
    stem = short[:-1] if len(short) > 4 and short.endswith("s") else short
    if len(stem) >= 3 and long.startswith(stem):
        return True
    ini = initials(subject_name)
    return len(ini) >= 2 and len(b) <= 4 and b.startswith(ini)


def class_number(name: str) -> str | None:
    m = re.match(r"\s*(\d{1,2})", name or "")
    return m.group(1) if m else None


def suggested_name(text: str) -> str:
    t = text.strip()
    return t.capitalize() if t.isupper() and len(t) > 4 else t


def new_code(name: str, taken: set[str]) -> str:
    base = (re.sub(r"[^A-Z0-9]", "", compact(name).upper()) or "SUB")[:6]
    if base not in taken:
        taken.add(base)
        return base
    for i in range(2, 1000):
        c = f"{base[:5]}{i}"
        if c not in taken:
            taken.add(c)
            return c
    raise SystemExit("could not build a unique subject code")


# ─────────────────────────────── report ───────────────────────────────
def load(inst_id: str) -> dict:
    q = lambda sql: query(sql)
    i = lit(inst_id)
    return {
        "depts": q(f"select id::text, name from departments where institute_id = {i} order by name"),
        "subjects": q(f"select id::text, name, code, department_id::text dept, coalesce(is_active,true) active from subjects where institute_id = {i}"),
        "batches": q(f"""select b.id::text, b.name, b.class_level, b.subject, b.department_id::text dept, b.section_id::text section,
                                (select count(*) from student_batches sb where sb.batch_id = b.id) students
                           from batches b where b.institute_id = {i} and b.is_active order by b.name"""),
        "tas": q(f"""select t.id::text, t.teacher_id::text teacher, t.batch_id::text batch, t.subject_id::text subject, coalesce(t.is_active,true) active,
                            b.name batch_name, coalesce(b.is_active,true) batch_active, s.name subject_name,
                            (select m.user_name from institute_members m where m.user_id = t.teacher_id and m.institute_id = t.institute_id limit 1) member_name,
                            exists (select 1 from institute_members m where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active') is_member
                       from teaching_assignments t join batches b on b.id = t.batch_id join subjects s on s.id = t.subject_id
                      where t.institute_id = {i}"""),
    }


def plan(d: dict) -> tuple[list[dict], list[dict]]:
    dept_name = {x["id"]: x["name"] for x in d["depts"]}
    by_class: dict[str, list[dict]] = {}
    for s in d["subjects"]:
        by_class.setdefault(s["dept"] or "", []).append(s)
    taken_codes = {(s["code"] or "").upper() for s in d["subjects"]}
    ta_by_batch: dict[str, list[dict]] = {}
    for t in d["tas"]:
        ta_by_batch.setdefault(t["batch"], []).append(t)
    planned_subjects: dict[tuple[str, str], str] = {}   # (class, compact name) → code, so 2 batches share one new subject
    adopted_by: dict[str, str] = {}                     # institute-wide subject id → the ONE class that adopts it
    # home class of an institute-wide subject = the class of the batches it is already assigned in (inferred if the batch has none)
    def batch_class(bt: dict) -> str:
        if bt["dept"]:
            return bt["dept"]
        n = class_number(bt["class_level"] or "")
        c = [x for x in d["depts"] if n and class_number(x["name"]) == n]
        return c[0]["id"] if len(c) == 1 else ""
    batch_by_id = {bt["id"]: bt for bt in d["batches"]}
    for s_ in by_class.get("", []):
        for t in d["tas"]:
            if t["subject"] == s_["id"] and t["batch"] in batch_by_id and batch_class(batch_by_id[t["batch"]]):
                adopted_by.setdefault(s_["id"], batch_class(batch_by_id[t["batch"]]))

    rows = []
    for b in d["batches"]:
        text = (b["subject"] or "").strip()
        cls, cls_note, status, action = b["dept"], "", "", ""
        sid, sname, scode, notes = "", "", "", []

        if not cls:                                    # class missing → infer from class_level (unique match only)
            n = class_number(b["class_level"] or "")
            cands = [x for x in d["depts"] if n and class_number(x["name"]) == n]
            if len(cands) == 1:
                cls, cls_note = cands[0]["id"], "inferred from class_level " + (b["class_level"] or "")
            else:
                cls_note = f"{len(cands)} classes match class_level '{b['class_level']}'"
        if b["section"] and cls:
            notes.append("has a section (ignored in the new flow)")

        if not text:
            status, action = "NEEDS_DECISION", "DECIDE"
            notes.append("batch has no subject text")
        elif text.upper() == "ALL":
            status, action = "NEEDS_DECISION", "DECIDE"
            sname = "All subjects"
            notes.append("'ALL' is a catch-all batch, not a subject — decide: a 'General' subject or split per subject")
        elif not cls:
            status, action = "NEEDS_DECISION", "DECIDE"
            notes.append("no class and none could be inferred")
        else:
            pool = by_class.get(cls, [])
            exact = [s for s in pool if compact(s["name"]) == compact(text)]
            fuzzy = [s for s in pool if same_subject(s["name"], text)]
            nulls = [s for s in by_class.get("", []) if same_subject(s["name"], text)]
            if len(exact) == 1:
                status, action, sid, sname, scode = "EXACT", "USE", exact[0]["id"], exact[0]["name"], exact[0]["code"]
            elif len(exact) > 1:
                status, action = "AMBIGUOUS", "DECIDE"
                notes.append("several subjects with this name in the class: " + ", ".join(s["code"] for s in exact))
            elif len(fuzzy) == 1:
                status, action, sid, sname, scode = "FUZZY", "USE", fuzzy[0]["id"], fuzzy[0]["name"], fuzzy[0]["code"]
                notes.append(f"'{text}' ≈ '{fuzzy[0]['name']}' — please confirm")
            elif len(fuzzy) > 1:
                status, action = "AMBIGUOUS", "DECIDE"
                notes.append("fuzzy matches: " + ", ".join(s["name"] for s in fuzzy))
            elif len(nulls) == 1 and adopted_by.setdefault(nulls[0]["id"], cls) == cls:
                status, action, sid, sname, scode = "ADOPT", "ADOPT", nulls[0]["id"], nulls[0]["name"], nulls[0]["code"]
                notes.append("institute-wide subject (no class): will be moved into this class")
            else:
                if len(nulls) == 1:
                    notes.append(f"institute-wide subject '{nulls[0]['name']}' goes to {dept_name.get(adopted_by[nulls[0]['id']], '?')}; "
                                 "a subject belongs to one class, so this class gets its own")
                key = (cls, compact(text))
                sname = suggested_name(text)
                if key not in planned_subjects:
                    planned_subjects[key] = new_code(sname, taken_codes)
                scode = planned_subjects[key]
                status, action = "MISSING", "CREATE"
                notes.append(f"no subject '{text}' in {dept_name.get(cls, '?')} — will be created")

        # existing assignments that disagree with the mapped subject
        for t in ta_by_batch.get(b["id"], []):
            if sid and t["subject"] != sid:
                notes.append(f"TA subject '{t['subject_name']}' differs from the batch subject")
        rows.append({
            "batch_id": b["id"], "batch_name": b["name"], "class_level": b["class_level"] or "", "students": b["students"],
            "class_in_db": dept_name.get(b["dept"], "") if b["dept"] else "", "class_proposed": dept_name.get(cls, "") if cls else "",
            "class_id": cls or "", "class_note": cls_note, "subject_text": text, "status": status, "action": action,
            "subject_id": sid, "subject_name": sname, "subject_code": scode, "teachers_assigned": len(ta_by_batch.get(b["id"], [])),
            "notes": "; ".join(notes), "decision": "",
        })

    ta_rows = []
    for t in d["tas"]:
        if not t["is_member"]:
            kind, act = "ORPHAN_TEACHER_NOT_A_MEMBER", "DELETE"
        elif not t["batch_active"]:
            kind, act = "SOFT_DELETED_BATCH", "REPOINT"
        else:
            continue
        who = t["member_name"] or ("(no member row) " + t["teacher"][:8])
        target, tnote = "", ""
        if kind == "SOFT_DELETED_BATCH":
            old = compact(t["batch_name"])
            live = [b for b in d["batches"] if old and old in compact(b["name"])]
            if len(live) == 1:
                target, tnote = live[0]["id"], f" PROPOSED target: '{live[0]['name']}' ({live[0]['students']} students) — confirm"
        ta_rows.append({
            "ta_id": t["id"], "kind": kind, "teacher": who, "teacher_id": t["teacher"], "batch": t["batch_name"], "batch_id": t["batch"],
            "subject": t["subject_name"], "proposed_action": act, "target_batch_id": target, "decision": "",
            "notes": "teacher is not an active member (removed teacher)" if kind.startswith("ORPHAN")
                     else "batch was soft-deleted; set target_batch_id to the live batch this teacher teaches, or DELETE." + tnote,
        })
    return rows, ta_rows


def write_csv(path: pathlib.Path, rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["empty"])
        w.writeheader()
        w.writerows(rows)


def md_table(rows: list[dict], cols: list[tuple[str, str]]) -> str:
    head = "| " + " | ".join(h for h, _ in cols) + " |\n|" + "|".join("---" for _ in cols) + "|\n"
    return head + "\n".join("| " + " | ".join(str(r[k]).replace("|", "/") for _, k in cols) + " |" for r in rows)


def cmd_report(args):
    inst = query(f"select id::text, name from institutes where name = {lit(args.institute)} or id::text = {lit(args.institute)}")
    if len(inst) != 1:
        raise SystemExit(f"institute not found / not unique: {inst}")
    inst_id, inst_name = inst[0]["id"], inst[0]["name"]
    d = load(inst_id)
    rows, ta_rows = plan(d)
    write_csv(MAP_CSV, rows)
    write_csv(TA_CSV, ta_rows)

    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    missing = {}
    for r in rows:
        if r["action"] == "CREATE":
            missing.setdefault((r["class_proposed"], r["subject_name"], r["subject_code"]), []).append(r["batch_name"])
    md = [f"# Backfill dry run — {inst_name} (`{inst_id}`)\n",
          "Generated by `scripts/class_subject_batch_backfill.py report` — **read-only, nothing was written**. "
          "Edit `supabase/backfill/class_subject_batch_map.csv` / `…_ta_actions.csv` (column `decision`), then run the `sql` mode.\n",
          f"Batches: {len(rows)} · classes: {len(d['depts'])} · subjects today: {len(d['subjects'])} · TA rows: {len(d['tas'])}\n",
          "## Summary\n", md_table([{"status": k, "batches": v} for k, v in sorted(counts.items())], [("Status", "status"), ("Batches", "batches")]),
          "\nEXACT = same name in the batch's class · FUZZY = unique near match (confirm) · ADOPT = institute-wide subject moves into the class · "
          "MISSING = subject will be created · AMBIGUOUS / NEEDS_DECISION = a human must choose.\n",
          "## Subjects that would be created\n",
          md_table([{"c": k[0], "n": k[1], "code": k[2], "b": ", ".join(v)} for k, v in sorted(missing.items())],
                   [("Class", "c"), ("Subject", "n"), ("Code", "code"), ("For batches", "b")]) if missing else "_none_",
          "\n## Batch → class → subject\n",
          md_table(rows, [("Batch", "batch_name"), ("Students", "students"), ("Class (db)", "class_in_db"), ("Class (proposed)", "class_proposed"),
                          ("Subject text", "subject_text"), ("Status", "status"), ("Action", "action"), ("Subject", "subject_name"),
                          ("Code", "subject_code"), ("Teachers", "teachers_assigned"), ("Notes", "notes")]),
          "\n## Teaching assignments that need an action\n",
          md_table(ta_rows, [("Kind", "kind"), ("Teacher", "teacher"), ("Batch", "batch"), ("Subject", "subject"), ("Proposed", "proposed_action"), ("Notes", "notes")]) if ta_rows else "_none_",
          "\n## Batches with no class\n",
          md_table([r for r in rows if not r["class_in_db"]], [("Batch", "batch_name"), ("class_level", "class_level"), ("Proposed class", "class_proposed"), ("Why", "class_note")])
          if any(not r["class_in_db"] for r in rows) else "_none_"]
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{inst_name}: {len(rows)} batches: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"TA rows needing action: {len(ta_rows)}")
    print(f"wrote {MAP_CSV.relative_to(ROOT)}, {TA_CSV.relative_to(ROOT)}, {REPORT_MD.relative_to(ROOT)}")


# ─────────────────────────────── SQL generator (does not run anything) ───────────────────────────────
def cmd_sql(args):
    inst = lit(args.institute_id)
    out = [f"-- class_subject_batch_apply.sql — GENERATED from {MAP_CSV.name} + {TA_CSV.name}. Review, then run in the SQL editor.",
           "-- Needs migration 39 applied. Run BEFORE migration 40. One transaction; the last SELECTs are the VERIFY.", "begin;", ""]
    todo = []
    with MAP_CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            dec = (r["decision"] or "").strip()
            act = r["action"]
            if dec.upper() == "SKIP":
                continue
            if dec.startswith("USE:"):
                act, r["subject_id"] = "USE", dec[4:].strip()
            elif dec.startswith("CREATE:"):
                act, r["subject_name"] = "CREATE", dec[7:].strip()
            if act == "DECIDE":
                todo.append(r["batch_name"])
                continue
            todo_cls = r["class_id"]
            if act == "CREATE":
                out.append(f"insert into subjects (institute_id, department_id, name, code, is_active)\n"
                           f"select {inst}, {lit(todo_cls)}, {lit(r['subject_name'])}, {lit(r['subject_code'])}, true\n"
                           f" where not exists (select 1 from subjects where institute_id = {inst} and department_id = {lit(todo_cls)} and lower(name) = lower({lit(r['subject_name'])}));")
                out.append(f"update batches set subject_id = (select id from subjects where institute_id = {inst} and department_id = {lit(todo_cls)} "
                           f"and lower(name) = lower({lit(r['subject_name'])}) limit 1) where id = {lit(r['batch_id'])};")
            else:
                if act == "ADOPT":
                    out.append(f"update subjects set department_id = {lit(todo_cls)} where id = {lit(r['subject_id'])} and department_id is null;")
                out.append(f"update batches set subject_id = {lit(r['subject_id'])} where id = {lit(r['batch_id'])};   -- {r['batch_name']}")
    out.append("")
    with TA_CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            dec = (r["decision"] or r["proposed_action"]).strip()
            if dec.upper() == "KEEP":
                continue
            if dec.upper() == "DELETE":
                out.append(f"delete from teaching_assignments where id = {lit(r['ta_id'])};   -- {r['kind']}: {r['teacher']} / {r['batch']} / {r['subject']}")
            else:
                target = dec.split(":", 1)[1].strip() if dec.upper().startswith("REPOINT:") else r["target_batch_id"].strip()
                if not target:
                    out.append(f"-- SKIPPED (no target_batch_id): {r['ta_id']} {r['teacher']} / {r['batch']} / {r['subject']}")
                    continue
                out.append(f"update teaching_assignments set batch_id = {lit(target)},\n"
                           f"  subject_id = (select subject_id from batches where id = {lit(target)})\n"
                           f" where id = {lit(r['ta_id'])} and exists (select 1 from batches where id = {lit(target)} and subject_id is not null);")
    out += ["", "-- VERIFY", f"select count(*) as batches_without_subject from batches where institute_id = {inst} and is_active and subject_id is null;",
            f"select count(*) as orphan_ta from teaching_assignments t where t.institute_id = {inst} and not exists (select 1 from institute_members m where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active');",
            f"select count(*) as batch_class_mismatch from batches b join subjects s on s.id = b.subject_id where b.institute_id = {inst} and b.department_id is distinct from s.department_id;",
            "", "commit;"]
    if todo:
        out.insert(3, "-- BATCHES LEFT WITHOUT A SUBJECT (decision needed, not in this script): " + "; ".join(todo))
    APPLY_SQL.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {APPLY_SQL.relative_to(ROOT)} ({len(todo)} batches still need a decision)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report"); r.add_argument("--institute", required=True, help="name or uuid"); r.set_defaults(fn=cmd_report)
    s = sub.add_parser("sql"); s.add_argument("--institute-id", required=True); s.set_defaults(fn=cmd_sql)
    a = ap.parse_args()
    a.fn(a)
