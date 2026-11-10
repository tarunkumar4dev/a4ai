// In-memory mock of the a4ai Agent API, typed with the GENERATED contract types (./types.ts → ./api.gen.ts), so it
// cannot drift: a renamed or removed field is a compile error here. Loaded only when VITE_AGENT_MOCK=1. State is
// module memory only (nothing in localStorage / IndexedDB — same privacy rule as the app); a reload re-seeds it with
// the same ids. Data is made up (no real students). It follows the backend's own rules (RAG-BACKEND agent/api.py,
// docs/AGENT_API_V2.md): `session` first, `final` last (also after an error, `cancelled` on cancel), titles cut at 48,
// seq = max(remaining) + 1, regenerate/edit truncation, suggestion order recent → entity → template, my_scope and
// section_comparison as `table` (+ `chart`) events.
//
// Scenarios (by message text, case-insensitive):
//   "excel" | "export"                      → table + `file` event (download card; NOT in contract 1.2 yet)
//   "scope" | "kya dekh" | "meri classes"   → my_scope table "Meri classes · N"
//   "compare" | "comparison" | "section-wise" → section_comparison table + bar chart
//   "ece 1" | "ece1"                        → clarify with hints
//   "trend"                                 → line chart
//   "attendance"                            → stat card + prose
//   "slow" | "detail" | "explain"           → a long answer streamed slowly (for Stop)
//   "fail"                                  → error event, then final
//   anything else                           → a short answer
import type { AgentApi, StreamOptions } from "./api";
import { AgentHttpError, saveBlob } from "./client";
import type {
  AgentEvent, AgentMeta, CancelResponse, ContractEvent, FileEvent, QueryItem, SessionItem, SessionList, StoredMessage,
  StoredMessagePage, Suggestion,
} from "./types";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace("Z", "+00:00");
const nowIso = () => iso(Date.now());

interface MockSession extends SessionItem { title_source: "auto" | "user"; messages: StoredMessage[] }
interface MockQuery extends QueryItem { norm: string }
interface MockDb { sessions: MockSession[]; queries: MockQuery[]; next: number; files: Map<string, { name: string; csv: string; expires: number }> }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** Backend auto title (agent/store.py auto_title): whitespace collapsed; > 48 → cut at the last space in the second
 *  half of the first 47 chars, trailing punctuation dropped, "…" appended (≤ 48 chars). */
export function autoTitle(text: string, limit = 48): string {
  const t = text.split(/\s+/).filter(Boolean).join(" ");
  if (!t) return "New chat";
  if (t.length <= limit) return t;
  let cut = t.slice(0, limit - 1);
  const sp = cut.lastIndexOf(" ");
  if (sp >= Math.floor(limit / 2)) cut = cut.slice(0, sp);
  return `${cut.replace(/[ ,.;:\-–—?!]+$/, "")}…`;
}

export const MOCK_BATCHES = [
  { name: "ECE-1", students: 22, role: "teacher", subjects: "Signals" },
  { name: "ECE-2", students: 22, role: "proctor", subjects: "Signals, Networks" },
  { name: "ECE-2 A", students: 15, role: "proctor", subjects: null },
] as const;
const TEMPLATES: Record<AgentMeta["role"], string[]> = {
  teacher: ["Meri classes ki is mahine ki attendance", "75% se kam attendance wale students", "Class 10 trigonometry test banao, 40 marks", "Mere tests ke marks summary"],
  hod: ["Department ka section-wise comparison", "Is mahine department ki attendance", "75% se kam wale students, Excel mein", "Teachers ne kitne tests banaye"],
  admin: ["Aaj poore institute ki attendance", "Department-wise comparison is mahine", "75% se kam wale students, Excel mein", "Teachers ne kitne tests banaye"],
};

let db: MockDb | null = null;
const load = (): MockDb => (db ??= seed());
/** Tests / e2e: wipe and reseed (same ids every time). */
export function resetMock() { db = null; }
const nextId = (p: string) => { const d = load(); return `${p}-${(d.next++).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`; };
const mockRole = (): AgentMeta["role"] => {
  const r = typeof window !== "undefined" ? (window as unknown as { __AGENT_MOCK_ROLE__?: string }).__AGENT_MOCK_ROLE__ : undefined;
  return r === "admin" || r === "hod" ? r : "teacher";
};

// ---- scenario events (typed with the contract: a wrong field is a compile error) ----------------------
type Draft = { [K in AgentEvent["type"]]: Omit<Extract<AgentEvent, { type: K }>, "seq" | "request_id"> }[AgentEvent["type"]];
const tool = (name: string, ms: number): Draft[] => [
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "start" } },
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "done", ms, ok: true } },
];
const src = (name: string) => ({ source: `tool:${name}`, as_of: new Date().toISOString().replace("Z", "+05:30") });

function scenario(text: string): { events: Draft[]; delay: number } {
  const t = text.toLowerCase();
  if (/\bfail\b/.test(t)) return { delay: 60, events: [...tool("resolve_entity", 300), { type: "error", code: "provider_error", message: "AI service abhi busy hai. Thodi der me retry karein." }] };
  if (/excel|export|xlsx/.test(t)) {
    const fileId = nextId("file").slice(0, 32).replace(/-/g, "");
    load().files.set(fileId, { name: "below-75-ece2.xlsx", csv: "Student,Section,%,Marked\nAarav Gupta,ECE-2,61.1,18\nDiya Verma,ECE-2,66.7,18\n", expires: Date.now() + 15 * 60_000 });
    const file: Omit<FileEvent, "seq" | "request_id"> = { type: "file", file_id: fileId, name: "below-75-ece2.xlsx", rows: 6, expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 8200, source: "tool:low_attendance_list" };
    return { delay: 70, events: [...tool("low_attendance_list", 640),
      { type: "table", ...src("low_attendance_list"), title: "Below 75%", columns: ["Student", "Section", "%", "Marked"],
        rows: [["Aarav Gupta", "ECE-2", "61.1", "18"], ["Diya Verma", "ECE-2", "66.7", "18"], ["Kabir Singh", "ECE-2", "72.2", "18"], ["Meera Nair", "ECE-2", null, "0"], ["Rohan Das", "ECE-2", "70.0", "18"], ["Sana Khan", "ECE-2", "74.4", "18"]] },
      file,
      { type: "text_delta", text: "6 students 75% se neeche hain. Excel file tayyar hai — 15 minute tak download kar sakte hain." }] };
  }
  if (/slow|detail|explain/.test(t)) {
    const words = "ECE-2 ki attendance ka poora breakdown: pehle hafte 79.5%, doosre hafte 81.2%, teesre hafte chhutti thi, aur chauthe hafte 83.8%. Sabse zyada absent Monday ki pehli class me hote hain. Lab batches me attendance theory se thodi behtar hai. Agar aap chahein to main har student ka hafte-wise record nikal sakta hoon, ya sirf un students ka jo 75% se neeche hain. Proctor ke roop me aap 7 din tak marks theek kar sakte hain.".split(" ");
    const deltas: Draft[] = [];
    for (let i = 0; i < words.length; i += 3) deltas.push({ type: "text_delta", text: `${words.slice(i, i + 3).join(" ")} ` });
    return { delay: 140, events: [...tool("attendance_stats", 900), ...deltas] };
  }
  if (/scope|kya dekh|kya kya|meri classes\b|mere batches/.test(t) && !/attendance/.test(t)) {
    return { delay: 70, events: [...tool("my_scope", 240),
      { type: "table", ...src("my_scope"), title: `Meri classes · ${MOCK_BATCHES.length}`, columns: ["Batch", "Students", "Role", "Subjects"],
        rows: MOCK_BATCHES.map((b) => [b.name, String(b.students), b.role, b.subjects]) },
      { type: "text_delta", text: "Aap **2 sections** padhate hain (ECE-2 ke proctor bhi hain). Kisi bhi batch par tap karke uske baare me poochiye." }] };
  }
  if (/compar|tulna|rank|section-wise|sections/.test(t)) {
    const rows: [string | null, string, string | null, string, string][] = [["1", "ECE-1", "86.4", "18", "396"], ["2", "ECE-2", "83.8", "18", "396"], ["3", "ECE-3", "77.1", "16", "656"], [null, "ECE-4", null, "0", "0"]];
    return { delay: 70, events: [...tool("section_comparison", 820),
      { type: "table", ...src("section_comparison"), title: "Attendance % by class · 1–9 Nov 2026", columns: ["#", "Class", "%", "Classes held", "Marked"], rows },
      { type: "chart", ...src("section_comparison"), kind: "bar", y_unit: "%", title: "Attendance %", series: [{ name: "Attendance %", points: [["ECE-1", 86.4], ["ECE-2", 83.8], ["ECE-3", 77.1]] }] },
      { type: "text_delta", text: "**ECE-1** sabse aage hai (86.4%). ECE-3 75% ke kareeb hai. ECE-4 me abhi data nahi hai." }] };
  }
  if (/ece ?1\b|ece1/.test(t) && !/\(id /.test(t)) {
    return { delay: 70, events: [...tool("resolve_entity", 310),
      { type: "clarify", question: "Kaun sa? / Which one?", chips: [
        { label: "ECE 1", value: "ECE 1 (id 6b0e1c2d)", hint: "Electronics · 22 students" },
        { label: "ECE1", value: "ECE1 (id 77c1d2e3)", hint: "Electronics · 0 students" }] }] };
  }
  if (/trend/.test(t)) {
    return { delay: 70, events: [...tool("attendance_trend", 700),
      { type: "chart", ...src("attendance_trend"), kind: "line", y_unit: "%", title: "Attendance trend · ECE-2 (week)", series: [{ name: "Attendance %", points: [["13 Oct", 79.5], ["20 Oct", 81.2], ["27 Oct", null], ["3 Nov", 83.8]] }] },
      { type: "text_delta", text: "27 Oct wale hafte chhutti thi, isliye graph me gap hai." }] };
  }
  if (/attendance/.test(t)) {
    return { delay: 70, events: [...tool("resolve_entity", 380), ...tool("attendance_stats", 1100),
      { type: "stat_card", ...src("attendance_stats"), title: "Attendance · ECE-2", value: "83.8", unit: "%", period: "1–9 Nov 2026", delta: "+2.1 pts vs previous 9 days", subtitle: "396 marks · 18 classes" },
      { type: "text_delta", text: "ECE-2 ki attendance is mahine **83.8%** hai — pichhle 9 din se 2.1 points zyada." }] };
  }
  return { delay: 60, events: [{ type: "thinking_status", key: "status.thinking", params: {} }, { type: "text_delta", text: "Is sawaal ke liye mere paas abhi koi data tool nahi hai — attendance, marks ya test ke baare me poochiye." }] };
}

function stamp(drafts: Draft[], rid: string): AgentEvent[] {
  return drafts.map((e, i) => ({ ...e, seq: i, request_id: rid }) as AgentEvent);
}

// ---- seed ---------------------------------------------------------------------------------------------
function seed(): MockDb {
  db = { sessions: [], queries: [], next: 1, files: new Map() };
  const now = Date.now();
  const prompts: [string, number, boolean][] = [
    ["Meri classes ki is mahine ki attendance", 0.02, false],
    ["Department ka section-wise comparison", 0.1, true],
    ["Main kya kya dekh sakta hoon?", 1.1, false],
    ["Pichhle 4 hafte ka attendance trend", 1.3, false],
    ["75% se kam attendance wale students", 3, true],
    ["ECE 1 ki attendance", 4, false],
    ["Class 10 trigonometry test banao, 40 marks", 6, false],
  ];
  for (let i = 0; i < 38; i++) prompts.push([`${["Aaj ki attendance", "ECE-2 ki attendance", "Marks summary", "Tests banaye is mahine"][i % 4]} · ${i + 1}`, 8 + i * 1.5, false]);
  for (const [text, daysAgo, pinned] of prompts) {
    const t = now - daysAgo * DAY;
    const id = nextId("5e55");
    const rid = nextId("4e9").slice(0, 16);
    const sc = scenario(text);
    const events = stamp([{ type: "session", session_id: id, title: autoTitle(text) }, ...sc.events, { type: "final", session_id: id, usage: {}, cancelled: false }], rid);
    db.sessions.push({
      id, title: autoTitle(text), title_source: "auto", created_at: iso(t), last_message_at: iso(t + 2000), message_count: 2, pinned,
      preview: textOf(events), messages: [
        { seq: 1, role: "user", text, events: null, created_at: iso(t) },
        { seq: 2, role: "assistant", text: textOf(events), events, created_at: iso(t + 2000) },
      ],
    });
  }
  const recent = ["Meri classes ki is mahine ki attendance", "Department ka section-wise comparison", "ECE-2 ki attendance", "75% se kam attendance wale students", "Pichhle 4 hafte ka attendance trend", "Main kya kya dekh sakta hoon?", "Marks summary", "ECE 1 ki attendance"];
  db.queries = recent.map((text, i) => ({ id: nextId("9e7"), text, norm: norm(text), last_used_at: iso(now - i * 3_600_000), use_count: i === 0 ? 3 : 1 }));
  return db;
}

const textOf = (events: AgentEvent[]) => events.filter((e): e is Extract<AgentEvent, { type: "text_delta" }> => e.type === "text_delta").map((e) => e.text).join("\n\n") || null;

// ---- helpers ------------------------------------------------------------------------------------------
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
/** REST latency; e2e can set window.__AGENT_MOCK_LATENCY__. */
const latency = () => {
  const w = typeof window !== "undefined" ? (window as unknown as { __AGENT_MOCK_LATENCY__?: number }).__AGENT_MOCK_LATENCY__ : undefined;
  return typeof w === "number" ? w : 120;
};
const rest = async <T,>(fn: () => T, signal?: AbortSignal): Promise<T> => { await wait(latency(), signal); return fn(); };
const item = ({ title_source: _t, messages: _m, ...s }: MockSession): SessionItem => s;
const find = (id: string) => {
  const s = load().sessions.find((x) => x.id === id);
  if (!s) throw new AgentHttpError(404, "not found");
  return s;
};
const running = new Map<string, { cancelled: boolean }>();

function recordQuery(text: string) {
  const d = load();
  const n = norm(text);
  const hit = d.queries.find((q) => q.norm === n);
  if (hit) { hit.text = text; hit.last_used_at = nowIso(); hit.use_count += 1; }
  else d.queries.unshift({ id: nextId("9e7"), text, norm: n, last_used_at: nowIso(), use_count: 1 });
  d.queries.sort((a, b) => b.last_used_at.localeCompare(a.last_used_at));
}

// ---- the adapter ----------------------------------------------------------------------------------------
export const mockApi: AgentApi = {
  kind: "mock",
  meta: (signal) => rest((): AgentMeta => ({ data_source: "demo", read_only: false, role: mockRole(), first_name: "Priya", institute_name: "MSIT (mock)" }), signal),

  listSessions: (q, signal) => rest((): SessionList => {
    const needle = norm(q.q ?? "");
    let list = [...load().sessions].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at) || a.id.localeCompare(b.id));
    if (typeof q.pinned === "boolean") list = list.filter((s) => s.pinned === q.pinned);
    if (needle) list = list.filter((s) => norm(s.title).includes(needle) || s.messages.some((m) => m.role === "user" && norm(m.text ?? "").includes(needle)));
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const start = q.cursor ? Number(q.cursor) || 0 : 0;
    const page = list.slice(start, start + limit).map(item);
    return {
      items: page, next_cursor: start + limit < list.length ? String(start + limit) : null,
      sessions: page.map((s) => ({ session_id: s.id, title: s.title, created_at: s.created_at, updated_at: s.last_message_at })),
    };
  }, signal),

  getMessages: (id, q, signal) => rest((): StoredMessagePage => {
    const s = find(id);
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 200);
    const start = q.cursor ? Number(q.cursor) || 0 : 0; // ascending pages, like the backend
    return { items: s.messages.slice(start, start + limit), next_cursor: start + limit < s.messages.length ? String(start + limit) : null };
  }, signal),

  patchSession: (id, patch) => rest(() => {
    const s = find(id);
    if (patch.title === undefined && patch.pinned === undefined) throw new AgentHttpError(422, "nothing to change");
    if (typeof patch.title === "string") {
      const t = patch.title.trim().slice(0, 80);
      if (!t) throw new AgentHttpError(422, "title required");
      s.title = t; s.title_source = "user";
    }
    if (typeof patch.pinned === "boolean") s.pinned = patch.pinned;
    return item(s);
  }),

  deleteSession: (id) => rest(() => { find(id); load().sessions = load().sessions.filter((s) => s.id !== id); }),

  listQueries: (q, signal) => rest(() => {
    const needle = norm(q.q ?? "");
    return load().queries.filter((x) => !needle || x.norm.includes(needle)).slice(0, q.limit ?? 10).map(({ norm: _n, ...x }) => x);
  }, signal),
  deleteQuery: (id) => rest(() => {
    const d = load();
    if (!d.queries.some((x) => x.id === id)) throw new AgentHttpError(404, "not found");
    d.queries = d.queries.filter((x) => x.id !== id);
  }),
  clearQueries: () => rest(() => { load().queries = []; }),

  suggestions: (q, signal) => rest((): Suggestion[] => {
    const d = load();
    const needle = norm(q.q);
    const limit = Math.min(Math.max(q.limit ?? 8, 1), 20);
    const hint = (x: MockQuery) => (x.use_count > 1 ? `Recent · ${x.use_count}×` : "Recent");
    const tpl = TEMPLATES[mockRole()];
    if (!needle) {
      return [...d.queries.slice(0, 4).map((x): Suggestion => ({ type: "recent", text: x.text, hint: hint(x) })),
        ...tpl.map((text): Suggestion => ({ type: "template", text, hint: "Starter" }))].slice(0, limit);
    }
    const squash = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, "");
    const pref = d.queries.filter((x) => x.norm.startsWith(needle));
    const sub = d.queries.filter((x) => !x.norm.startsWith(needle) && x.norm.includes(needle));
    const out: Suggestion[] = [
      ...[...pref, ...sub].map((x): Suggestion => ({ type: "recent", text: x.text, hint: hint(x) })),
      ...MOCK_BATCHES.filter((b) => squash(b.name).includes(squash(needle)))
        .map((b): Suggestion => ({ type: "entity", text: `${b.name} ki is mahine ki attendance`, hint: `Batch · ${b.students} students` })),
      ...tpl.filter((x) => norm(x).includes(needle)).map((text): Suggestion => ({ type: "template", text, hint: "Starter" })),
    ];
    const seen = new Set<string>();
    return out.filter((s) => { const k = norm(s.text); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit);
  }, signal),

  feedback: (body) => rest(() => {
    const m = find(body.session_id).messages.find((x) => x.seq === body.message_seq && x.role === "assistant");
    if (!m) throw new AgentHttpError(404, "not found");
  }),

  cancel: (requestId) => rest((): CancelResponse => {
    const r = running.get(requestId);
    if (!r) throw new AgentHttpError(404, "not found");
    r.cancelled = true;
    return { request_id: requestId, cancelled: true };
  }),

  async chat({ body, onEvent, onRequestId, signal }: StreamOptions) {
    await wait(120, signal);
    const d = load();
    let s = body.session_id ? find(body.session_id) : null;
    const regen = typeof body.regenerate_from_seq === "number";
    const edit = typeof body.edit_of_seq === "number";
    if ((regen || edit) && !s) throw new AgentHttpError(422, "needs session_id");
    let text = (body.message ?? "").trim();
    if (!regen && !text) throw new AgentHttpError(422, "message required");
    if (!s) {
      s = { id: nextId("5e55"), title: autoTitle(text), title_source: "auto", created_at: nowIso(), last_message_at: nowIso(), message_count: 0, pinned: false, preview: null, messages: [] };
      d.sessions.unshift(s);
    }
    if (regen) {
      const m = s.messages.find((x) => x.seq === body.regenerate_from_seq);
      if (!m) throw new AgentHttpError(404, "not found");
      const user = [...s.messages].filter((x) => x.role === "user" && x.seq <= m.seq).pop();
      if (!user) throw new AgentHttpError(404, "not found");
      s.messages = s.messages.filter((x) => x.seq <= user.seq);
      text = user.text ?? "";
    } else if (edit) {
      const m = s.messages.find((x) => x.seq === body.edit_of_seq);
      if (!m) throw new AgentHttpError(404, "not found");
      if (m.role !== "user") throw new AgentHttpError(422, "edit_of_seq must point at a user message");
      const first = s.messages.find((x) => x.role === "user")?.seq;
      s.messages = s.messages.filter((x) => x.seq < m.seq);
      if (m.seq === first && s.title_source === "auto") s.title = autoTitle(text);
    }
    const nextSeq = () => (s!.messages.length ? Math.max(...s!.messages.map((x) => x.seq)) + 1 : 1);
    if (!regen) { s.messages.push({ seq: nextSeq(), role: "user", text, events: null, created_at: nowIso() }); recordQuery(text); }
    const rid = nextId("4e9").replace(/-/g, "").slice(0, 16);
    const run = { cancelled: false };
    running.set(rid, run);
    onRequestId?.(rid);
    const sc = scenario(text);
    const events: AgentEvent[] = [];
    let seq = 0;
    const emit = (draft: Draft) => { const ev = { ...draft, seq: seq++, request_id: rid } as AgentEvent; events.push(ev); onEvent(ev); };
    try {
      emit({ type: "session", session_id: s.id, title: s.title });
      for (const e of sc.events) {
        await wait(sc.delay, signal);
        if (run.cancelled) break;
        emit(e);
      }
      emit({ type: "final", session_id: s.id, usage: {}, cancelled: run.cancelled });
    } finally {
      running.delete(rid);
      if (!events.some((e) => e.type === "final")) events.push({ type: "final", seq, request_id: rid, session_id: s.id, usage: {}, cancelled: true });
      s.messages.push({ seq: nextSeq(), role: "assistant", text: textOf(events), events, created_at: nowIso() });
      s.message_count = s.messages.length;
      s.last_message_at = nowIso();
      s.preview = textOf(events);
    }
  },

  approve: ({ approvalId }) => rest(() => ({ ok: true, status: "finalized", approval_id: approvalId })),
  downloadPdf: async () => { throw new AgentHttpError(501, "PDF download isn't available in the mock"); },
  downloadFile: async ({ fileId, filename }) => {
    await wait(latency());
    const f = load().files.get(fileId);
    if (!f) throw new AgentHttpError(404, "not found");
    if (f.expires < Date.now()) throw new AgentHttpError(410, "expired");
    saveBlob(new Blob([f.csv], { type: "text/csv" }), filename.replace(/\.xlsx$/, ".csv"));
  },
};

/** The contract's own event union is what the mock streams (plus `file`, which is not in 1.2 yet). */
export type MockEvent = ContractEvent | FileEvent;
