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
APPLY_DIR = ROOT / "supabase" / "apply"
APPLY_FILE = APPLY_DIR / "class_subject_batch_apply.sql"
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
        # orphan TA rows of OTHER institutes: left alone by this script (the audit's global count of 6 = this institute's + these)
        "orphans_other": int(q(f"""select count(*) n from teaching_assignments t where t.institute_id <> {i}
                                    and not exists (select 1 from institute_members m where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active')
                                    and not exists (select 1 from institutes x where x.id = t.institute_id and x.owner_id = t.teacher_id)""")[0]["n"]),
    }


ALL_SUBJECTS = "All Subjects"


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
        elif text.upper() == "ALL" and cls:
            # decision (22 Nov): a catch-all batch gets its own "All Subjects" subject in its class (never matched to an old "ALL" subject)
            existing = [x for x in by_class.get(cls, []) if compact(x["name"]) == compact(ALL_SUBJECTS)]
            if existing:
                status, action, sid, sname, scode = "EXACT", "USE", existing[0]["id"], existing[0]["name"], existing[0]["code"]
            else:
                key = (cls, compact(ALL_SUBJECTS))
                if key not in planned_subjects:
                    planned_subjects[key] = new_code(ALL_SUBJECTS, taken_codes)
                status, action, sname, scode = "MISSING", "CREATE", ALL_SUBJECTS, planned_subjects[key]
                notes.append(f"'ALL' batch: gets the subject \"{ALL_SUBJECTS}\" in {dept_name.get(cls, '?')}")
            old_all = [x for x in by_class.get(cls, []) if compact(x["name"]) == "all"]
            if old_all:
                notes.append(f"old subject \"{old_all[0]['name']}\" ({old_all[0]['code']}) becomes unused — delete it in Classes")
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
        # decision (22 Nov): a batch that carries several subjects is split — the main subject stays, every other subject
        # gets its own batch with the SAME students (student_batches), named "<batch> - <subject>"
        split_ids, split_names = [], []
        if sid or action == "CREATE":
            subj_by_id = {x["id"]: x for x in d["subjects"]}
            for t in ta_by_batch.get(b["id"], []):
                if t["subject"] != sid and t["subject"] not in split_ids and t["subject"] in subj_by_id:
                    split_ids.append(t["subject"])
            for xid in split_ids:
                split_names.append(f"{b['name']} - {suggested_name(subj_by_id[xid]['name'])}")
            if split_ids:
                notes.append("SPLIT: " + "; ".join(f"new batch \"{n}\" ({subj_by_id[i]['name']}) with the same {b['students']} students" for i, n in zip(split_ids, split_names)))
        rows.append({
            "batch_id": b["id"], "batch_name": b["name"], "class_level": b["class_level"] or "", "students": b["students"],
            "class_in_db": dept_name.get(b["dept"], "") if b["dept"] else "", "class_proposed": dept_name.get(cls, "") if cls else "",
            "class_id": cls or "", "class_note": cls_note, "subject_text": text, "status": status, "action": action,
            "subject_id": sid, "subject_name": sname, "subject_code": scode, "teachers_assigned": len(ta_by_batch.get(b["id"], [])),
            "split_subject_ids": "|".join(split_ids), "split_batch_names": "|".join(split_names),
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
            "subject": t["subject_name"], "proposed_action": act, "target_batch_id": target, "decision": f"REPOINT:{target}" if target else "",
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
          "\n## Batches that are split (same students in every new batch)\n",
          md_table([{"b": r["batch_name"], "n": r["students"], "to": r["split_batch_names"].replace("|", "; "), "s": r["split_subject_ids"]} for r in rows if r["split_subject_ids"]],
                   [("Batch", "b"), ("Students", "n"), ("New batch(es)", "to")]) if any(r["split_subject_ids"] for r in rows) else "_none_",
          "\n## Teaching assignments that need an action\n",
          md_table(ta_rows, [("Kind", "kind"), ("Teacher", "teacher"), ("Batch", "batch"), ("Subject", "subject"), ("Proposed", "proposed_action"), ("Notes", "notes")]) if ta_rows else "_none_",
          f"\n### Why the audit said 6 orphan rows and this report deletes {sum(1 for t in ta_rows if t['proposed_action'] == 'DELETE')}\n",
          f"The audit counted every teaching_assignments row in the whole database whose teacher is not an active member of that row's institute: 6. "
          f"{sum(1 for t in ta_rows if t['proposed_action'] == 'DELETE')} of them belong to {inst_name} (this report); the other {d['orphans_other']} belong to another institute "
          "(MSIT demo data: ECE1/NAS, ECE-2/Digital Electronics, ECE 1/AC for one removed teacher) and are deliberately NOT touched by this script. "
          "They stay as legacy rows (migration 40 exempts them); the apply file's VERIFY shows them as 'orphan TA rows (OTHER institutes)'.\n",
          "\n## Batches with no class\n",
          md_table([r for r in rows if not r["class_in_db"]], [("Batch", "batch_name"), ("class_level", "class_level"), ("Proposed class", "class_proposed"), ("Why", "class_note")])
          if any(not r["class_in_db"] for r in rows) else "_none_"]
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{inst_name}: {len(rows)} batches: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"TA rows needing action: {len(ta_rows)}")
    print(f"wrote {MAP_CSV.relative_to(ROOT)}, {TA_CSV.relative_to(ROOT)}, {REPORT_MD.relative_to(ROOT)}")


# ─────────────────────────────── SQL generator (does not run anything) ───────────────────────────────
def read_csv(path: pathlib.Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def backfill_sql(inst_id: str, rows: list[dict], ta_rows: list[dict]) -> tuple[list[str], list[str]]:
    """SQL lines of the backfill (batch → subject, splits, TA actions) from the (edited) CSV rows. Returns (lines, batches_left)."""
    inst = lit(inst_id)
    out: list[str] = ["-- 1. every batch gets its subject (new subjects are created first; an institute-wide subject moves into its class)"]
    left: list[str] = []
    splits: list[tuple[dict, str, str]] = []
    for r in rows:
        dec = (r.get("decision") or "").strip()
        act = r["action"]
        if dec.upper() == "SKIP":
            continue
        if dec.startswith("USE:"):
            act, r["subject_id"] = "USE", dec[4:].strip()
        elif dec.startswith("CREATE:"):
            act, r["subject_name"] = "CREATE", dec[7:].strip()
        if act == "DECIDE":
            left.append(r["batch_name"])
            continue
        cls = r["class_id"]
        if act == "CREATE":
            out.append(f"insert into subjects (institute_id, department_id, name, code, is_active)\n"
                       f"select {inst}, {lit(cls)}, {lit(r['subject_name'])}, {lit(r['subject_code'])}, true\n"
                       f" where not exists (select 1 from subjects where institute_id = {inst} and department_id = {lit(cls)} and lower(name) = lower({lit(r['subject_name'])}));")
            out.append(f"update batches set subject_id = (select id from subjects where institute_id = {inst} and department_id = {lit(cls)} "
                       f"and lower(name) = lower({lit(r['subject_name'])}) limit 1) where id = {lit(r['batch_id'])};   -- {r['batch_name']}")
        else:
            if act == "ADOPT":
                out.append(f"update subjects set department_id = {lit(cls)} where id = {lit(r['subject_id'])} and department_id is null;")
            out.append(f"update batches set subject_id = {lit(r['subject_id'])} where id = {lit(r['batch_id'])};   -- {r['batch_name']}")
        if r.get("split_subject_ids") and dec.upper() != "NOSPLIT":
            for sid, nm in zip(r["split_subject_ids"].split("|"), r["split_batch_names"].split("|")):
                splits.append((r, sid, nm))

    if splits:
        out += ["", "-- 2. split: a batch that carried several subjects keeps its main subject; each other subject gets its own batch",
                "--    with the SAME students (student_batches). The new batch's class and subject text come from the subject (trigger 39)."]
        for r, sid, nm in splits:
            out.append(f"insert into batches (institute_id, name, class_level, subject_id, is_active, is_lab)\n"
                       f"select {inst}, {lit(nm)}, nullif({lit(r['class_level'])}, ''), {lit(sid)}, true, false\n"
                       f" where not exists (select 1 from batches where institute_id = {inst} and name = {lit(nm)} and is_active);   -- {r['batch_name']} -> {nm}")
            out.append(f"insert into student_batches (student_id, batch_id)\n"
                       f"select sb.student_id, nb.id from student_batches sb,\n"
                       f"       (select id from batches where institute_id = {inst} and name = {lit(nm)} and subject_id = {lit(sid)} and is_active limit 1) nb\n"
                       f" where sb.batch_id = {lit(r['batch_id'])}\n"
                       f" on conflict do nothing;")

    out += ["", "-- 3. teaching_assignments: orphans (teacher is not an active member) are deleted; a row on a deleted batch moves to the live batch"]
    for r in ta_rows:
        dec = ((r.get("decision") or "") or r["proposed_action"]).strip()
        if dec.upper() == "KEEP":
            continue
        if dec.upper() == "DELETE":
            out.append(f"delete from teaching_assignments where id = {lit(r['ta_id'])};   -- {r['kind']}: {r['teacher']} / {r['batch']} / {r['subject']}")
        else:
            target = dec.split(":", 1)[1].strip() if dec.upper().startswith("REPOINT:") else r.get("target_batch_id", "").strip()
            if not target:
                out.append(f"-- SKIPPED (no target_batch_id): {r['ta_id']} {r['teacher']} / {r['batch']} / {r['subject']}")
                continue
            out.append(f"update teaching_assignments set batch_id = {lit(target)},\n"
                       f"  subject_id = (select subject_id from batches where id = {lit(target)})\n"
                       f" where id = {lit(r['ta_id'])} and exists (select 1 from batches where id = {lit(target)} and subject_id is not null);"
                       f"   -- {r['teacher']}: {r['batch']} -> live batch")
    return out, left


def _ta_decision(t: dict) -> str:
    return ((t.get("decision") or "") or t["proposed_action"]).strip()


def expected_after(d: dict, rows: list[dict], ta_rows: list[dict]) -> dict:
    """The numbers the VERIFY block must show after the backfill, computed from the plan (not from the database)."""
    dept_name = {x["id"]: x["name"] for x in d["depts"]}
    subj_by_id = {x["id"]: x for x in d["subjects"]}
    per: dict[str, int] = {}
    after: dict[str, int] = {}          # batch id (or "new:<name>") -> students
    new_subjects = set()
    for r in rows:
        dec = (r.get("decision") or "").strip().upper()
        if dec == "SKIP" or r["action"] == "DECIDE":
            continue
        if r["action"] == "CREATE":
            new_subjects.add((r["class_id"], r["subject_name"].lower()))
        key = f"{r['class_proposed']} > {r['subject_name']}"
        per[key] = per.get(key, 0) + 1
        after[r["batch_id"]] = int(r["students"])
        if r.get("split_subject_ids") and dec != "NOSPLIT":
            for sid, nm in zip(r["split_subject_ids"].split("|"), r["split_batch_names"].split("|")):
                sub = subj_by_id[sid]
                k2 = f"{dept_name.get(sub['dept'], r['class_proposed'])} > {sub['name']}"
                per[k2] = per.get(k2, 0) + 1
                after["new:" + nm] = int(r["students"])
    deleted = {t["ta_id"] for t in ta_rows if _ta_decision(t).upper() == "DELETE"}
    moved = {t["ta_id"]: (_ta_decision(t).split(":", 1) + [""])[1].strip() or t.get("target_batch_id", "")
             for t in ta_rows if _ta_decision(t).upper().startswith("REPOINT")}
    teacher_batches = set()
    for t in d["tas"]:
        if t["id"] in deleted:
            continue
        if t["id"] in moved and moved[t["id"]]:
            teacher_batches.add(moved[t["id"]])
        elif t["batch_active"]:
            teacher_batches.add(t["batch"])
    kept = [t for t in d["tas"] if t["id"] not in deleted]
    return {
        "active_batches": len(after),
        "subjects": len(d["subjects"]) + len(new_subjects),
        "by_class_subject": "; ".join(f"{k}={v}" for k, v in sorted(per.items())),
        "batches_without_teacher": len([b for b in after if b not in teacher_batches]),
        "ta_rows": len(kept),
        "orphans_other": d.get("orphans_other", 0),
        "split_students": {nm: n for nm, n in after.items() if nm.startswith("new:")},
    }


def verify_sql(inst_id: str, exp: dict) -> list[str]:
    inst = lit(inst_id)
    orphan = ("not exists (select 1 from institute_members m where m.user_id = t.teacher_id and m.institute_id = t.institute_id and m.status = 'active')"
              " and not exists (select 1 from institutes x where x.id = t.institute_id and x.owner_id = t.teacher_id)")
    live = f"b.institute_id = {inst} and b.is_active and not coalesce(b.is_lab, false)"
    checks = [
        ("batches without a subject", f"(select count(*) from batches b where {live} and b.subject_id is null)::text", "0"),
        ("active batches", f"(select count(*) from batches b where {live})::text", str(exp["active_batches"])),
        ("subjects", f"(select count(*) from subjects where institute_id = {inst})::text", str(exp["subjects"])),
        ("batches per class > subject",
         f"(select string_agg(k || '=' || n, '; ' order by k) from (select d.name || ' > ' || s.name as k, count(*)::text as n from batches b "
         f"join subjects s on s.id = b.subject_id join departments d on d.id = s.department_id where {live} group by d.name, s.name) x)", exp["by_class_subject"]),
        ("batches without a teacher", f"(select count(*) from batches b where {live} and not exists (select 1 from teaching_assignments t where t.batch_id = b.id))::text", str(exp["batches_without_teacher"])),
        ("teaching_assignments rows (this institute)", f"(select count(*) from teaching_assignments where institute_id = {inst})::text", str(exp["ta_rows"])),
        ("orphan TA rows (this institute)", f"(select count(*) from teaching_assignments t where t.institute_id = {inst} and {orphan})::text", "0"),
        ("orphan TA rows (OTHER institutes, left alone)", f"(select count(*) from teaching_assignments t where t.institute_id <> {inst} and {orphan})::text", str(exp["orphans_other"])),
        ("TA subject <> batch subject", f"(select count(*) from teaching_assignments t join batches b on b.id = t.batch_id where t.institute_id = {inst} and t.subject_id is distinct from b.subject_id)::text", "0"),
        ("batch class <> subject class", f"(select count(*) from batches b join subjects s on s.id = b.subject_id where b.institute_id = {inst} and b.department_id is distinct from s.department_id)::text", "0"),
    ]
    for nm, n in exp["split_students"].items():
        bn = nm[4:]
        checks.append((f"students in split batch '{bn}'", f"(select count(*) from student_batches sb join batches b on b.id = sb.batch_id where b.institute_id = {inst} and b.name = {lit(bn)} and b.is_active)::text", str(n)))
    vals = ",\n  ".join(f"({lit(n)}, {q}, {lit(e)})" for n, q, e in checks)
    return [f"select name, actual, expected, (actual = expected) as ok from (values\n  {vals}\n) as t(name, actual, expected);"]


def strip_tx(sql: str) -> str:
    return "\n".join(l for l in sql.splitlines() if l.strip().lower() not in ("begin;", "commit;"))


BATCH_COLS = ["institute_id", "name", "description", "class_level", "subject", "is_active", "updated_at", "department_id", "section_id", "proctor_id", "is_lab"]


def build_apply(inst_id: str, d: dict, rows: list[dict], ta_rows: list[dict], mig_dir: pathlib.Path, bak: str = "20261122") -> str:
    """The ONE paste-able file (supabase/apply/class_subject_batch_apply.sql). Nothing runs here."""
    sch = f"a4_backup_{bak}"
    backfill, left = backfill_sql(inst_id, rows, ta_rows)
    exp = expected_after(d, rows, ta_rows)
    rd = lambda n: (mig_dir / n).read_text(encoding="utf-8").strip()
    tables = ["batches", "subjects", "teaching_assignments", "student_batches"]
    L: list[str] = []
    A = L.append
    A(f"""-- class_subject_batch_apply.sql — Class -> Subject -> Batch -> Teacher. GENERATED by scripts/class_subject_batch_backfill.py (apply).
-- Paste the WHOLE file into the Supabase SQL editor (project a4ai.in) and run it ONCE. Nothing here has been run by Claude.
-- Order: (a) backup  (b) migration 39  (c) reload schema cache  (d) backfill  (e) VERIFY  (f) migration 40  (g) restore (commented)
-- Each block is its own transaction. If a block fails the editor stops: nothing after it ran. Fix it, or use block (g), then re-run
-- from the failed block. Do NOT run (a) twice: it refuses to overwrite an existing backup (drop schema {sch} cascade first).
-- Institute: {inst_id} (Education Beast). Only its batches are changed, but migration 40 applies to ALL institutes: from then
-- on a teaching assignment can only be created on a batch that has a subject.
-- Numbering: 39 / 40 are these. The checker's AI_UNREADABLE migration will be 41+ (35-38 belong to wip/maths-analytics).
""")
    if left:
        A("-- !!! BATCHES STILL WITHOUT A DECISION (they stay without a subject): " + "; ".join(left) + "\n")
    A(f"""-- ═══════════════ (a) BACKUP: own schema, not public (a table in public is readable through the REST API) ═══════════════
begin;
create schema {sch};
revoke all on schema {sch} from public, anon, authenticated;""")
    for t in tables:
        A(f"create table {sch}.{t} as select * from public.{t};")
    A(f"revoke all on all tables in schema {sch} from public, anon, authenticated;")
    A("commit;")
    A("-- check: row counts of the backup\nselect " + ", ".join(f"(select count(*) from {sch}.{t}) as {t}" for t in tables) + ";\n")
    A("-- ═══════════════ (b) MIGRATION 39: batches.subject_id, class/text sync triggers, institutes.hierarchy_mode ═══════════════")
    A(rd("39_class_subject_batch.sql") + "\n")
    A("-- ═══════════════ (c) reload the API schema cache ═══════════════\nnotify pgrst, 'reload schema';\n")
    A("-- ═══════════════ (d) BACKFILL: from supabase/backfill/*.csv decisions ═══════════════\nbegin;")
    A("\n".join(backfill))
    A("commit;\n")
    A("-- ═══════════════ (e) VERIFY: run this single query; every row must say ok = true (expected values come from the plan) ═══════════════")
    A("\n".join(verify_sql(inst_id, exp)))
    A("-- If any row says false: STOP, do not run (f). Use block (g) to go back to the backup.\n")
    A("-- ═══════════════ (f) MIGRATION 40: subject derived from the batch, same-institute checks, orphan cleanup (ALL institutes) ═══════════════")
    A(rd("40_teaching_assignment_integrity.sql") + "\n")
    A("-- check after 40: expect triggers = 2, policies = 3\nselect (select count(*) from pg_trigger where tgname in ('a4_ta_before_write','a4_member_cleanup_ta') and not tgisinternal) as triggers,\n"
      "       (select count(*) from pg_policies where tablename = 'teaching_assignments' and policyname in ('ta_insert','hod_insert','ta_update')) as policies;\n")
    sets = ", ".join(f"{c} = o.{c}" for c in BATCH_COLS)
    B = [
        "EXACT RESTORE (undo everything above). Un-comment the lines from BEGIN to COMMIT and run them together.",
        "It puts the four tables back to the backup copy: any change made to teaching_assignments / student_batches / batches / subjects",
        "AFTER the backup (by anyone, in any institute) is lost. Other tables are not touched.",
        "",
        "begin;",
        "-- 1. remove migration 40 and 39 (their rollback files, inlined)",
        strip_tx(rd("40_teaching_assignment_integrity_rollback.sql")),
        strip_tx(rd("39_class_subject_batch_rollback.sql")),
        "-- 2. data back to the backup",
        "delete from public.teaching_assignments;",
        f"delete from public.student_batches where (student_id, batch_id) not in (select student_id, batch_id from {sch}.student_batches);",
        f"delete from public.batches where id not in (select id from {sch}.batches);       -- the split batches (their student_batches cascade)",
        f"delete from public.subjects where id not in (select id from {sch}.subjects);     -- the created subjects",
        f"update public.subjects s set institute_id = o.institute_id, department_id = o.department_id, name = o.name, code = o.code, is_active = o.is_active from {sch}.subjects o where o.id = s.id;",
        f"update public.batches b set {sets.replace('institute_id = o.institute_id', 'institute_id = o.institute_id')} from {sch}.batches o where o.id = b.id;",
        f"insert into public.student_batches select * from {sch}.student_batches on conflict do nothing;",
        f"insert into public.teaching_assignments select * from {sch}.teaching_assignments;",
        "commit;",
        "notify pgrst, 'reload schema';",
        f"-- 3. when everything is fine again: drop schema {sch} cascade;   (it holds copies of batches and assignments)",
    ]
    A("-- ═══════════════ (g) RESTORE FROM THE BACKUP: commented on purpose ═══════════════")
    A("\n".join(("-- " + l) if l.strip() else "--" for l in "\n".join(B).splitlines()))
    return "\n".join(L) + "\n"


def cmd_apply(args):
    d = load(args.institute_id)
    rows, ta_rows = read_csv(MAP_CSV), read_csv(TA_CSV)
    text = build_apply(args.institute_id, d, rows, ta_rows, ROOT / "supabase" / "migrations", args.bak)
    APPLY_DIR.mkdir(parents=True, exist_ok=True)
    APPLY_FILE.write_text(text, encoding="utf-8")
    exp = expected_after(d, rows, ta_rows)
    print(f"wrote {APPLY_FILE.relative_to(ROOT)} ({len(text.splitlines())} lines)")
    print("expected:", json.dumps({k: v for k, v in exp.items() if k != "by_class_subject"}, ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report"); r.add_argument("--institute", required=True, help="name or uuid"); r.set_defaults(fn=cmd_report)
    a_ = sub.add_parser("apply"); a_.add_argument("--institute-id", required=True); a_.add_argument("--bak", default="20261122"); a_.set_defaults(fn=cmd_apply)
    a = ap.parse_args()
    a.fn(a)
