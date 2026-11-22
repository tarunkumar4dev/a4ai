# Class → Subject → Batch → Teacher

Branch `feat/class-subject-batch` (from `origin/main` 964b9f1). **Nothing here is applied to production; the UI is behind a flag that ships OFF.**
Background: [docs/audit/institute_hierarchy_audit.md](../audit/institute_hierarchy_audit.md) (on the `feat/hod-off-simple-attendance` working copy).

## 1. Target model

```
Institute
 └─ Class / Stream      = departments row ("11th Commerce")        UI label "Class"
     └─ Subject         = subjects row, subjects.department_id = the class   ("Economics")
         └─ Batch       = batches row, batches.subject_id → subject          ("Eco Batch A", "Eco Batch B")
             └─ Teacher = teaching_assignments (teacher, batch)  — subject is DERIVED from the batch
Students: students.department_id = class; enrolled per batch through student_batches (migration 33, unchanged)
```

Sections are not part of this flow. They stay in the database; the UI hides them when the flag is on and `institutes.hierarchy_mode = 'simple'`.

## 2. Schema changes

| Object | Change | File |
|---|---|---|
| `institutes.hierarchy_mode text not null default 'simple'` (`simple`/`full`) | new column. `get_my_teaching_targets` already reads this key through `to_jsonb()` and treats a missing column as `simple`, so adding it with that default changes nothing | 39 |
| `batches.subject_id uuid references subjects(id)` + partial index | nullable (legacy rows), `NO ACTION` on delete (a subject with batches cannot be deleted; an institute cascade still works) | 39 |
| trigger `a4_batch_sync_subject` (batches, before insert/update of subject_id, institute_id, department_id) | batch with a subject: `department_id := subject.department_id`, legacy text `batches.subject := subject.name`; subject must be in the batch's institute | 39 |
| trigger `a4_subject_sync_batches` (subjects, after update of name, department_id) | renaming / moving a subject re-syncs its batches | 39 |
| trigger `a4_ta_before_write` (teaching_assignments, before insert/update of institute_id, teacher_id, batch_id, subject_id) | batch must exist and be in `ta.institute_id`; teacher must be an active member (or the owner) of it; **`subject_id := batch.subject_id`**; a batch without a subject rejects new rows (legacy rows exempt: updating only `is_active` is allowed) | 40 |
| `a4_ta_links_ok(inst, teacher, batch, subject)` + policies `ta_insert`, `hod_insert`, `ta_update` | **closes the audit gap**: teacher, batch and subject must all belong to the same institute (before: only `is_institute_admin(institute_id)` / HOD of the batch's dept) | 40 |
| trigger `a4_member_cleanup_ta` (institute_members, after delete / status → not active) | deletes that member's `teaching_assignments` of that institute. No orphans, and a re-join starts empty | 40 |

Not changed: `student_batches`, `a4_batch_student_ids`, `get_class_roster`, `save_class_attendance`, `get_my_teaching_targets`, timetable tables. They keep reading `teaching_assignments(batch_id, subject_id, teacher_id)`, which the trigger now fills.
Rollbacks: `39_…_rollback.sql`, `40_…_rollback.sql` (40's restores the live policies of 22 Nov 2026 verbatim).
Tests: `supabase/tests/39_40_class_subject_batch_test.py` (pgserver, 56 checks).

## 3. Rules the UI follows

* A teacher is assigned to a **batch**. The client never sends `subject_id` for `teaching_assignments`.
* A batch is created under a subject (`subject_id` required in the new UI); its class is the subject's class.
* One teacher per batch on the Classes screen (dropdown replaces the previous teacher); the database allows several (co-teaching, and legacy rows) — the screen shows "+N more".
* Delete is blocked, with the reason, while students are enrolled (batch), attendance/timetable exists (batch, subject), or children exist (subject, class).
* Every write goes through `src/pages/institute/classes/classesApi.ts`, which throws a readable error; nothing is swallowed.

## 4. UI (flag `CLASS_SUBJECT_BATCH_ENABLED` in `src/config/features.ts`, default `false`)

| Screen | With the flag ON |
|---|---|
| **Classes** (new nav item; replaces *Departments* and *Batches*) | One tree: Class → Subjects → Batches. Inline add / rename / delete at every level. Each batch row: student count + teacher dropdown. Legacy batches without a subject are listed in an amber box with a "Choose subject…" dropdown. |
| **Teachers** | Join-code box as before, then a list of teachers. Under each: read-only *Class → Subject → Batch* chips and ONE "+ Add batch" picker grouped *Class › Subject*. No department dropdown, no "+ Subject" dropdown, no Batches modal, no filter chips. |
| **Students** | "Dept:" → "Class:"; section filter chips hidden for `simple` institutes. |
| **Overview / header buttons** | "New batch" / "New department" open the Classes screen. |
| **Bulk upload** | Same flow. Class column → department. New optional *Subject* column: it picks between batches that share a name under different subjects (paired by position when the lists have the same length), checks a named batch belongs to the row's subject, and with Subject but no Batch uses the subject's only batch in the class. |
| Teacher removal | also deletes the teacher's assignments (server trigger does it anyway after 40). |

With the flag OFF the dashboard renders as before, with two intended exceptions: `handleAddBatch` now reports a failed subject insert (and retries with a collision-proof code) instead of swallowing it, and `?tab=classes` falls back to Overview.

## 5. Backfill (dry run only)

`scripts/class_subject_batch_backfill.py report --institute "Education Beast"` (read-only SELECTs) writes
`supabase/backfill/class_subject_batch_map.csv`, `…_ta_actions.csv` and `docs/design/class_subject_batch_backfill_report.md`; you edit the `decision` columns; `… sql --institute-id <uuid>` then *generates* `class_subject_batch_apply.sql` (one transaction, not run). Rules: class = `batches.department_id` (or inferred from `class_level` when it matches exactly one class); subject = same-name subject in that class (EXACT), unique near-match (FUZZY), institute-wide subject that moves into its home class (ADOPT, one class only), otherwise CREATE; `ALL` batches and ambiguous ones are NEEDS_DECISION. Orphan TA rows → DELETE; a TA on a soft-deleted batch → REPOINT (proposes the live batch with the same name).

## 6. Assumptions (please confirm or correct)

1. `departments` = class/stream for **every** institute using the flag; colleges keep `hierarchy_mode = 'full'` and the old UI path (MSIT).
2. One subject belongs to one class. A subject shared by two classes becomes two subject rows.
3. A batch has exactly one subject. School-style batches with several subjects (EB "Mathematics" has Maths + English assignments; MSIT ECE-2 has many) cannot be represented — the extra subject has to become its own batch.
4. One teacher per batch in the new UI; co-teaching stays possible in the database.
5. Lab batches (`is_lab`) are not part of the tree (coaching has none); they stay readable.
6. `students.department_id` is the student's class and is not re-synced when a batch moves class.
7. `timetable_slots` keep their own (teacher, batch, subject) and are untouched; slots of a removed teacher are not cleaned up.
8. Migration 40's cleanup also fires when a member is set to `inactive` (that is how re-join / reset scripts model "left"); a temporary deactivation therefore drops the assignments.
9. Migration numbers 39 / 40: `wip/maths-analytics` (other session) uses 35–38.

## 7. Apply order on production

1. Deploy the frontend **with the flag OFF** (safe; only the `handleAddBatch` error fix and the extra tab id change).
2. Run `39_class_subject_batch.sql` (+ `notify pgrst, 'reload schema';`). Additive, no data changes.
3. Run the backfill dry run, edit the CSVs, generate and review `class_subject_batch_apply.sql`, run it. Check its VERIFY (0 batches without subject, 0 orphan TA, 0 class mismatches).
4. Run `40_teaching_assignment_integrity.sql` and, **in the same window**, deploy the build with `CLASS_SUBJECT_BATCH_ENABLED = true`. Reason: after 40 the old teacher-assignment buttons (explicit subject) are overridden by the batch's subject and are rejected on batches without a subject.
5. Test matrix: admin creates class → subject → batch → picks teacher; teacher sees only that batch and can mark attendance; bulk upload of the ECE-2-style file with and without a Subject column; remove a teacher → no TA rows left.
