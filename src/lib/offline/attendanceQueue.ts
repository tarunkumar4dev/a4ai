// src/lib/offline/attendanceQueue.ts — attendance saves that couldn't reach the server, and their replay.
//
// BEFORE ANY REPLAY the server's current marks are compared with what the teacher started from:
//   server == what I'm sending     → an earlier send got through and only the reply was lost: nothing to send
//   server == what I started from  → nobody else touched it: send
//   anything else                  → a proctor / HOD changed it meanwhile: never overwrite, ask the teacher
// save_class_attendance is last-write-wins, so this check is what stops a late sync erasing a correction. It runs in
// the browser: a change in the moments between the read and the send isn't caught (attendance_edit_log still records it).
//
// The server decides everything else. A replay is the same RPC with the caller's current JWT, so scope and the edit
// window (teacher 2 days, proctor 7) are checked again at sync time. A record is only ever sent by the user it
// belongs to.

import { supabase } from "@/lib/supabaseClient";
import { getItem, listItems, putItem, removeItem, updateItem, type QueueItem } from "./secureQueue";

export type AttStatus = "present" | "absent" | "leave";
export type Marks = Record<string, AttStatus>;

export type AttendanceSave = {
  key: string;
  instituteId: string;
  batchId: string;
  subjectId: string;
  date: string;
  slotId: string | null;
  sessionId: string | null;
  marks: Marks;
  /** the server's marks when the teacher opened the class ({} when it had none) */
  base: Marks;
  subjectName: string;
  classLabel: string;
  state: "pending" | "conflict" | "rejected";
  /** rejected: the server's reason */
  note?: string;
  /** conflict: the server's marks at the time */
  serverMarks?: Marks;
};

export type SendResult = { kind: "ok"; sessionId: string } | { kind: "retry"; message: string } | { kind: "reject"; message: string };

export type FlushResult = { synced: number; conflicts: number; rejected: number; waiting: number; expired: number };

const REQUEST_TIMEOUT_MS = 20000;
const MAX_MARKS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: readonly string[] = ["present", "absent", "leave"];
const LOCK_NAME = "a4ai-offline-sync";

export const attendanceKey = (batchId: string, subjectId: string, date: string, slotId?: string | null) =>
  `attendance|${batchId}|${subjectId}|${date}|${slotId ?? ""}`;

/* ───── pure rules ───── */
const sameMarks = (a: Marks, b: Marks) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
};

export function decideSync(server: Marks, base: Marks, mine: Marks): "already-saved" | "send" | "conflict" {
  if (Object.keys(mine).every(k => server[k] === mine[k])) return "already-saved";
  return sameMarks(server, base) ? "send" : "conflict";
}

/** How many of my marks differ from the server's. */
export const countDifferences = (server: Marks, mine: Marks) => Object.keys(mine).filter(k => server[k] !== mine[k]).length;

/** retry = the request may never have been judged (network, timeout, server trouble, expired token). */
export function classifyFailure(status: number | undefined, code: string | undefined): "retry" | "reject" {
  if (!status) return "retry";
  if (status === 401 || status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  if (code === "PGRST301" || code === "PGRST302" || code === "PGRST303") return "retry";
  return "reject";
}

const validMarks = (m: unknown, min: number): m is Marks => {
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const entries = Object.entries(m);
  return entries.length >= min && entries.length <= MAX_MARKS && entries.every(([id, st]) => UUID.test(id) && STATUSES.includes(st as string));
};
const optionalUuid = (v: unknown) => v === null || (typeof v === "string" && UUID.test(v));

/** Checks a stored record before it is sent or shown. */
export function isValidSave(s: unknown): s is AttendanceSave {
  const x = s as AttendanceSave | null;
  return !!x && typeof x === "object"
    && typeof x.key === "string" && x.key === attendanceKey(x.batchId, x.subjectId, x.date, x.slotId)
    && UUID.test(x.instituteId) && UUID.test(x.batchId) && UUID.test(x.subjectId)
    && optionalUuid(x.slotId) && optionalUuid(x.sessionId)
    && /^\d{4}-\d{2}-\d{2}$/.test(x.date)
    && validMarks(x.marks, 1) && validMarks(x.base, 0)
    && typeof x.subjectName === "string" && typeof x.classLabel === "string"
    && ["pending", "conflict", "rejected"].includes(x.state);
}

/* ───── server calls ───── */
function withTimeout() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

/** The one place attendance is sent from: the sheet's Save and the replay. */
export async function sendAttendance(s: Pick<AttendanceSave, "instituteId" | "batchId" | "subjectId" | "date" | "slotId" | "sessionId" | "marks">): Promise<SendResult> {
  const t = withTimeout();
  try {
    const { data, error, status } = await supabase.rpc("save_class_attendance", {
      p_institute_id: s.instituteId,
      p_batch_id: s.batchId,
      p_subject_id: s.subjectId,
      p_date: s.date,
      p_timetable_slot_id: s.slotId,
      p_session_id: s.sessionId,
      p_records: Object.entries(s.marks).map(([student_id, st]) => ({ student_id, status: st })),
    }).abortSignal(t.signal);
    if (!error) return { kind: "ok", sessionId: data as string };
    return { kind: classifyFailure(status, error.code), message: error.message };
  } catch (e) {
    return { kind: "retry", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    t.done();
  }
}

class RetryLater extends Error {}

/** Finds the session the way save_class_attendance does, so the compare looks at the row the save would change. */
async function findSessionId(s: AttendanceSave, userId: string, signal: AbortSignal): Promise<string | null> {
  if (s.sessionId) return s.sessionId;
  if (s.slotId) {
    const { data, error, status } = await supabase.from("class_sessions").select("id")
      .eq("timetable_slot_id", s.slotId).eq("session_date", s.date).abortSignal(signal).maybeSingle();
    if (error) throw readFailure(status, error);
    if (data?.id) return data.id;
  }
  const { data, error, status } = await supabase.from("class_sessions").select("id, teacher_id, status, created_at")
    .eq("batch_id", s.batchId).eq("subject_id", s.subjectId).eq("session_date", s.date).abortSignal(signal);
  if (error) throw readFailure(status, error);
  const rows = (data || [])
    .filter(r => r.status !== "cancelled")
    .sort((a, b) => Number(b.teacher_id === userId) - Number(a.teacher_id === userId) || String(a.created_at).localeCompare(String(b.created_at)));
  return rows[0]?.id ?? null;
}

const readFailure = (status: number, error: { code?: string; message: string }) =>
  classifyFailure(status, error.code) === "retry" ? new RetryLater(error.message) : new Error(error.message);

async function readServerMarks(s: AttendanceSave, userId: string): Promise<Marks> {
  const t = withTimeout();
  try {
    const sid = await findSessionId(s, userId, t.signal);
    if (!sid) return {};
    const { data, error, status } = await supabase.from("attendance_records").select("student_id, status")
      .eq("session_id", sid).abortSignal(t.signal);
    if (error) throw readFailure(status, error);
    const marks: Marks = {};
    (data || []).forEach(r => { marks[r.student_id as string] = r.status as AttStatus; });
    return marks;
  } finally {
    t.done();
  }
}

/* ───── queue ───── */
export const queueAttendanceSave = (userId: string, save: AttendanceSave) => {
  if (!isValidSave(save)) throw new Error("Invalid attendance data");
  return putItem<AttendanceSave>(userId, save.key, save);
};

export async function getQueuedSave(userId: string, key: string): Promise<QueueItem<AttendanceSave> | null> {
  const item = await getItem<AttendanceSave>(userId, key);
  return item && isValidSave(item.body) ? item : null;
}

// Any read sweeps expired records (the panel usually reads first); the next sync reports them.
let expiredUnreported = 0;

export async function listQueuedSaves(userId: string) {
  const { items, expired } = await listItems<AttendanceSave>(userId);
  expiredUnreported += expired;
  const valid: QueueItem<AttendanceSave>[] = [];
  for (const item of items) {
    if (isValidSave(item.body)) valid.push(item);
    else await removeItem(item.id);
  }
  return { items: valid, expired };
}

export const discardQueuedSave = (id: string) => removeItem(id);

/** "Keep mine" on a conflict: the server's current marks become the new starting point, so the send goes ahead. */
export const keepMyMarks = (userId: string, item: QueueItem<AttendanceSave>) => {
  const { serverMarks, note: _note, ...rest } = item.body;
  return updateItem<AttendanceSave>(userId, item, { ...rest, base: serverMarks ?? item.body.base, state: "pending" });
};

/* ───── replay ───── */
let inflight: Promise<FlushResult> | null = null;

/** Lets the sheet's own Save go after a running replay, never alongside it. */
export const waitForFlush = () => (inflight ? inflight.then(() => undefined, () => undefined) : Promise.resolve());

async function sessionUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function replay(userId: string): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, conflicts: 0, rejected: 0, waiting: 0, expired: 0 };
  const { items } = await listQueuedSaves(userId);
  result.expired = expiredUnreported;
  expiredUnreported = 0;
  const pending = items.filter(i => i.body.state === "pending");
  if (!pending.length) return result;

  if (typeof navigator !== "undefined" && !navigator.onLine) { result.waiting = pending.length; return result; }
  // a record belongs to whoever queued it, not to whoever is signed in now.
  // No session here can also be a token that expired offline and can't refresh yet (a real sign-out wipes the queue).
  const current = await sessionUserId();
  if (!current) { result.waiting = pending.length; return result; }
  if (current !== userId) return result;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const save = item.body;
    try {
      const server = await readServerMarks(save, userId);
      const decision = decideSync(server, save.base, save.marks);

      if (decision === "conflict") {
        await updateItem<AttendanceSave>(userId, item, { ...save, state: "conflict", serverMarks: server });
        result.conflicts++;
        continue;
      }
      if (decision === "send") {
        const sent = await sendAttendance(save);
        if (sent.kind === "retry") { result.waiting = pending.length - i; return result; }
        if (sent.kind === "reject") {
          await updateItem<AttendanceSave>(userId, item, { ...save, state: "rejected", note: sent.message });
          result.rejected++;
          continue;
        }
      }
      if (await removeItem(item.id, item.rev)) {
        result.synced++;
      } else {
        // re-marked while this was being sent: what just went out is the newer record's starting point
        const newer = await getQueuedSave(userId, save.key);
        if (newer) await updateItem<AttendanceSave>(userId, newer, { ...newer.body, base: save.marks });
      }
    } catch (e) {
      if (e instanceof RetryLater || !(e instanceof Error)) { result.waiting = pending.length - i; return result; }
      await updateItem<AttendanceSave>(userId, item, { ...save, state: "rejected", note: e.message });
      result.rejected++;
    }
  }
  return result;
}

const flushListeners = new Set<(r: FlushResult) => void>();

/** Called once per finished sync, whoever started it (timer, "Sync now", "Keep my marks"). */
export function onFlushDone(fn: (r: FlushResult) => void): () => void {
  flushListeners.add(fn);
  return () => { flushListeners.delete(fn); };
}

/** Sends this user's waiting saves, oldest first. One tab at a time; a second call joins the running one. */
export function flushAttendanceQueue(userId: string): Promise<FlushResult> {
  if (inflight) return inflight;
  const skipped: FlushResult = { synced: 0, conflicts: 0, rejected: 0, waiting: 0, expired: 0 };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const run = locks
    ? locks.request(LOCK_NAME, { ifAvailable: true }, lock => (lock ? replay(userId) : skipped)) as Promise<FlushResult>
    : replay(userId);
  inflight = run
    .then(r => { flushListeners.forEach(fn => fn(r)); return r; })
    .finally(() => { inflight = null; });
  return inflight;
}
