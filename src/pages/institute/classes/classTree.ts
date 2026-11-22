// src/pages/institute/classes/classTree.ts
// Pure model of the Class → Subject → Batch → Teacher tree (docs/design/class_subject_batch.md). No network, no React:
// the Classes screen, the read-only Teachers view and the "Add batch" picker are all built from these functions
// and unit-tested in classTree.test.ts. `departments` are the classes ("11th Commerce"); sections are not used.

export interface ClassRow { id: string; name: string }
export interface SubjectRow { id: string; name: string; code: string; department_id?: string | null }
export interface BatchRow {
  id: string; name: string;
  department_id?: string | null; subject_id?: string | null;
  is_lab?: boolean | null; is_active?: boolean | null;
}
export interface TeachingRow { teacher_id: string; batch_id: string }

export interface BatchNode {
  id: string; name: string;
  students: number;
  /** auth user ids of the teachers assigned to this batch (teaching_assignments.teacher_id) */
  teacherIds: string[];
}
export interface SubjectNode { id: string; name: string; code: string; batches: BatchNode[]; students: number }
export interface ClassNode { id: string; name: string; subjects: SubjectNode[]; looseBatches: BatchNode[]; students: number }
export interface ClassTree {
  classes: ClassNode[];
  /** batches that have no subject yet (legacy rows before the backfill), whatever their class */
  unassigned: (BatchNode & { classId: string | null })[];
  /** subjects without a class (legacy institute-wide subjects) */
  classless: SubjectNode[];
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export function buildClassTree(input: {
  classes: ClassRow[];
  subjects: SubjectRow[];
  batches: BatchRow[];
  teaching: TeachingRow[];
  /** batch id → number of enrolled students (student_batches) */
  studentCount: (batchId: string) => number;
  /** only these auth user ids are shown as teachers (active members); undefined = everyone */
  activeTeacherIds?: Set<string>;
}): ClassTree {
  const { classes, subjects, batches, teaching, studentCount, activeTeacherIds } = input;
  const teachersOf = new Map<string, string[]>();
  for (const t of teaching) {
    if (activeTeacherIds && !activeTeacherIds.has(t.teacher_id)) continue;
    const list = teachersOf.get(t.batch_id) ?? [];
    if (!list.includes(t.teacher_id)) list.push(t.teacher_id);
    teachersOf.set(t.batch_id, list);
  }
  const node = (b: BatchRow): BatchNode => ({ id: b.id, name: b.name, students: studentCount(b.id), teacherIds: teachersOf.get(b.id) ?? [] });

  const live = batches.filter(b => b.is_active !== false && !b.is_lab);
  const subjectIds = new Set(subjects.map(s => s.id));
  const batchesOfSubject = new Map<string, BatchRow[]>();
  const unassigned: ClassTree["unassigned"] = [];
  const looseByClass = new Map<string, BatchNode[]>();
  for (const b of live) {
    if (b.subject_id && subjectIds.has(b.subject_id)) {
      const l = batchesOfSubject.get(b.subject_id) ?? [];
      l.push(b);
      batchesOfSubject.set(b.subject_id, l);
    } else {
      unassigned.push({ ...node(b), classId: b.department_id ?? null });
      if (b.department_id) looseByClass.set(b.department_id, [...(looseByClass.get(b.department_id) ?? []), node(b)]);
    }
  }

  const subjectNode = (s: SubjectRow): SubjectNode => {
    const bs = (batchesOfSubject.get(s.id) ?? []).map(node).sort(byName);
    return { id: s.id, name: s.name, code: s.code, batches: bs, students: bs.reduce((n, b) => n + b.students, 0) };
  };
  const classNodes = classes.map((c): ClassNode => {
    const subs = subjects.filter(s => s.department_id === c.id).map(subjectNode).sort(byName);
    const loose = (looseByClass.get(c.id) ?? []).sort(byName);
    return { id: c.id, name: c.name, subjects: subs, looseBatches: loose, students: subs.reduce((n, s) => n + s.students, 0) + loose.reduce((n, b) => n + b.students, 0) };
  }).sort(byName);

  return {
    classes: classNodes,
    unassigned: unassigned.sort(byName),
    classless: subjects.filter(s => !s.department_id).map(subjectNode).sort(byName),
  };
}

/* ───────────────────────── delete guards (UI blocks the action and says why) ───────────────────────── */

export interface Blockers { sessions: number; slots: number; allBatches: number }

export function batchDeleteBlock(b: BatchNode, sessions: number): string | null {
  if (b.students > 0) return `${b.students} student${b.students === 1 ? " is" : "s are"} enrolled in this batch. Move them to another batch first.`;
  if (sessions > 0) return `Attendance exists for this batch (${sessions} class session${sessions === 1 ? "" : "s"}). It cannot be deleted.`;
  return null;
}

export function subjectDeleteBlock(s: SubjectNode, x: Blockers): string | null {
  if (s.batches.length > 0) return `This subject has ${s.batches.length} batch${s.batches.length === 1 ? "" : "es"}. Delete or move them first.`;
  if (x.allBatches > 0) return "Old (deleted) batches still point to this subject, so it cannot be deleted.";
  if (x.sessions > 0) return `Attendance exists for this subject (${x.sessions} class session${x.sessions === 1 ? "" : "s"}).`;
  if (x.slots > 0) return "This subject is used in the timetable.";
  return null;
}

export function classDeleteBlock(c: ClassNode, studentsWithClass: number): string | null {
  if (c.subjects.length > 0) return `This class has ${c.subjects.length} subject${c.subjects.length === 1 ? "" : "s"}. Delete them first.`;
  if (c.looseBatches.length > 0) return `This class has ${c.looseBatches.length} batch${c.looseBatches.length === 1 ? "" : "es"} without a subject. Move or delete them first.`;
  if (studentsWithClass > 0) return `${studentsWithClass} student${studentsWithClass === 1 ? " belongs" : "s belong"} to this class.`;
  return null;
}

/* ───────────────────────── Teachers tab (read-only grouping) + "Add batch" picker ───────────────────────── */

export interface PickerOption {
  batchId: string; label: string; classId: string | null; className: string; subjectName: string; batchName: string; students: number;
}

/** Every live batch as "Class › Subject › Batch", sorted; used by the Teachers tab "Add batch" picker. */
export function batchPickerOptions(tree: ClassTree): PickerOption[] {
  const out: PickerOption[] = [];
  for (const c of tree.classes) {
    for (const s of c.subjects) {
      for (const b of s.batches) {
        out.push({ batchId: b.id, label: `${c.name} › ${s.name} › ${b.name}`, classId: c.id, className: c.name, subjectName: s.name, batchName: b.name, students: b.students });
      }
    }
  }
  return out;
}

export interface TeacherGroup {
  classId: string | null;
  className: string;
  subjects: { subjectId: string | null; subjectName: string; batches: { id: string; name: string; students: number }[] }[];
}

/** What a teacher teaches, grouped Class → Subject → Batch (batches without a subject go under "No subject yet"). */
export function groupTeacherBatches(userId: string, tree: ClassTree): TeacherGroup[] {
  const mineOf = (batches: BatchNode[]) => batches.filter(b => b.teacherIds.includes(userId)).map(b => ({ id: b.id, name: b.name, students: b.students }));
  const groups: TeacherGroup[] = [];
  for (const c of tree.classes) {
    const subjects: TeacherGroup["subjects"] = [];
    for (const s of c.subjects) {
      const mine = mineOf(s.batches);
      if (mine.length) subjects.push({ subjectId: s.id, subjectName: s.name, batches: mine });
    }
    const loose = mineOf(c.looseBatches);
    if (loose.length) subjects.push({ subjectId: null, subjectName: "No subject yet", batches: loose });
    if (subjects.length) groups.push({ classId: c.id, className: c.name, subjects });
  }
  const noClass = mineOf(tree.unassigned.filter(b => !b.classId));
  const classless = tree.classless.map(s => ({ s, mine: mineOf(s.batches) })).filter(x => x.mine.length);
  if (noClass.length || classless.length) {
    const subjects: TeacherGroup["subjects"] = classless.map(x => ({ subjectId: x.s.id, subjectName: x.s.name, batches: x.mine }));
    if (noClass.length) subjects.push({ subjectId: null, subjectName: "No subject yet", batches: noClass });
    groups.push({ classId: null, className: "No class", subjects });
  }
  return groups;
}

/** Class number for batches.class_level ("11th Commerce" → "11"); null when the name has none. */
export function classLevelOf(className: string): string | null {
  const m = /^\s*(\d{1,2})/.exec(className);
  return m ? m[1] : null;
}

/** Same name ignoring case, spaces and punctuation ("BST" = "bst", "Business Studies" ≠ "BST"). */
export function isSameName(a: string, b: string): boolean {
  const k = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return !!k(a) && k(a) === k(b);
}

/** Default name for a new batch: "<Subject> Batch N", N = one more than the batches the subject has (or than its highest "Batch N"). */
export function nextBatchName(subjectName: string, existingBatchNames: string[]): string {
  const esc = subjectName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}\\s+batch\\s+(\\d+)$`, "i");
  let max = 0;
  for (const n of existingBatchNames) {
    const m = re.exec(n.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${subjectName.trim()} Batch ${Math.max(max, existingBatchNames.length) + 1}`;
}
