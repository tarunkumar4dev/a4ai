// In-browser mock of the a4ai Agent v2 API (contract: ./types.ts). Loaded only when VITE_AGENT_MOCK=1, so it never
// ships in a normal build. State lives in localStorage ("a4ai.agent.mock.v2") so a reload keeps the chats —
// exactly like the server would. Data is made up (no real students).
//
// Scenarios (by message text, case-insensitive):
//   "scope" | "kya dekh" | "mere batches"        → my_scope
//   "compare" | "tulna" | "rank" | "sections"   → section_comparison (ranking table + bar chart)
//   "ece 1" | "ece1"                            → clarify with hints ("ECE-1 · 22 students" vs "ECE1 · 0 students")
//   "trend"                                     → line chart
//   "attendance"                                → stat cards + prose
//   "slow" | "detail" | "explain"               → a long answer streamed slowly (for Stop)
//   "fail"                                      → error event
//   anything else                               → a short answer
import type { AgentApi, StreamOptions } from "./api";
import { AgentHttpError } from "./client";
import type {
  AgentEvent, AgentMeta, MessagesPage, QueryHistoryItem, ScopeBatch, SessionSummary, SessionsPage, StoredMessage,
  Suggestion,
} from "./types";

const KEY = "a4ai.agent.mock.v2";
const PAGE_SESSIONS = 20;
const PAGE_MESSAGES = 40;
const DAY = 86_400_000;

interface MockSession extends SessionSummary { messages: StoredMessage[] }
interface MockDb { v: 2; sessions: MockSession[]; queries: QueryHistoryItem[]; nextId: number }

export const MOCK_BATCHES: ScopeBatch[] = [
  { batch_id: "b-ece1", name: "ECE-1", students: 22, kind: "Section", department: "ECE", via: "teacher" },
  { batch_id: "b-ece2", name: "ECE-2", students: 22, kind: "Section", department: "ECE", via: "proctor" },
];
const OTHER_BATCHES: ScopeBatch[] = [
  { batch_id: "b-ece1-legacy", name: "ECE1", students: 0, kind: "Section", department: "ECE", via: null },
  { batch_id: "b-ece2a", name: "ECE-2 A", students: 15, kind: "Lab", department: "ECE", via: "proctor" },
];
const TEMPLATES = [
  "Aaj ki attendance", "Meri class ki attendance", "Low attendance students (<75%)", "Sections ki attendance compare karo",
  "Main kya kya dekh sakta hoon?", "Pichhle 4 hafte ka attendance trend", "Class 10 trigonometry test banao, 40 marks",
];

// ---- storage ----------------------------------------------------------------------------------------
const iso = (ms: number) => new Date(ms).toISOString();
const nowIso = () => iso(Date.now());
let memory: MockDb | null = null;

function load(): MockDb {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    const db = raw ? (JSON.parse(raw) as MockDb) : null;
    if (db && db.v === 2 && Array.isArray(db.sessions)) { memory = db; return db; }
  } catch { /* fall through to seed */ }
  memory = seed();
  save();
  return memory;
}
function save() { try { if (memory) localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* quota: keep in memory */ } }
/** Tests / e2e: wipe and reseed. */
export function resetMock() { memory = null; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

const uid = (db: MockDb, p: string) => `${p}-${(db.nextId++).toString(36).padStart(4, "0")}`;

// ---- scenario events ---------------------------------------------------------------------------------
type Ev = Record<string, unknown>;
const tool = (name: string, ms: number): Ev[] => [
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "start" } },
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "done", ms, ok: true } },
];
const src = (name: string) => ({ source: `tool:${name}`, as_of: iso(Date.now()).replace("Z", "+00:00") });

function scenario(text: string): { events: Ev[]; delay: number } {
  const t = text.toLowerCase();
  if (/\bfail\b/.test(t)) return { delay: 60, events: [...tool("resolve_entity", 300), { type: "error", code: "provider_error", message: "AI service abhi busy hai. Thodi der me retry karein." }] };
  if (/slow|detail|explain/.test(t)) {
    const words = "ECE-2 ki attendance ka poora breakdown: pehle hafte 79.5%, doosre hafte 81.2%, teesre hafte chhutti thi, aur chauthe hafte 83.8%. Sabse zyada absent Monday ki pehli class me hote hain. Lab batches me attendance theory se thodi behtar hai. Agar aap chahein to main har student ka hafte-wise record nikal sakta hoon, ya sirf un students ka jo 75% se neeche hain. Proctor ke roop me aap 7 din tak marks theek kar sakte hain.".split(" ");
    const deltas: Ev[] = [];
    for (let i = 0; i < words.length; i += 3) deltas.push({ type: "text_delta", text: `${words.slice(i, i + 3).join(" ")} ` });
    return { delay: 140, events: [...tool("attendance_stats", 900), ...deltas] };
  }
  if (/scope|kya dekh|kya kya|mere batches|my batches/.test(t)) {
    return { delay: 70, events: [...tool("my_scope", 240),
      { type: "my_scope", ...src("my_scope"), role: "teacher", title: "Aap ye dekh sakte hain", batches: MOCK_BATCHES.concat(OTHER_BATCHES[1]), total_students: 44, departments: ["ECE"] },
      { type: "text_delta", text: "Aap **2 sections** padhate hain (ECE-2 ke proctor bhi hain) — kul **44 students**. Kisi bhi batch par tap karke uske baare me poochiye." }] };
  }
  if (/compar|tulna|rank|sections/.test(t)) {
    return { delay: 70, events: [...tool("section_comparison", 820),
      { type: "section_comparison", ...src("section_comparison"), title: "Attendance by section · ECE", metric: "Attendance", unit: "%", period: "1–9 Nov 2026", higher_is_better: true,
        rows: [{ name: "ECE-1", value: 86.4, students: 22 }, { name: "ECE-2", value: 83.8, students: 22 }, { name: "ECE-3", value: 77.1, students: 41 }, { name: "ECE-4", value: null, students: 0, detail: "Abhi tak koi class mark nahi hui" }] },
      { type: "text_delta", text: "**ECE-1** sabse aage hai (86.4%). ECE-3 75% ke kareeb hai — wahan dhyan chahiye. ECE-4 me abhi data nahi hai." }] };
  }
  if (/ece ?1\b|ece1/.test(t)) {
    return { delay: 70, events: [...tool("resolve_entity", 310),
      { type: "clarify", question: "\"ECE 1\" naam ke do batch mile. Kaun sa?", chips: [
        { label: "ECE-1", value: "ECE-1 ki attendance", hint: "Section · 22 students" },
        { label: "ECE1", value: "ECE1 (purana batch) ki attendance", hint: "Section · 0 students" }] }] };
  }
  if (/trend/.test(t)) {
    return { delay: 70, events: [...tool("attendance_trend", 700),
      { type: "chart", ...src("attendance_trend"), kind: "line", title: "Weekly attendance · ECE-2", y_unit: "%", series: [{ name: "ECE-2", points: [["13 Oct", 79.5], ["20 Oct", 81.2], ["27 Oct", null], ["3 Nov", 83.8]] }] },
      { type: "text_delta", text: "27 Oct wale hafte chhutti thi, isliye graph me gap hai." }] };
  }
  if (/attendance/.test(t)) {
    return { delay: 70, events: [...tool("resolve_entity", 380), ...tool("attendance_stats", 1100),
      { type: "stat_card", ...src("attendance_stats"), title: "Attendance · ECE-2", value: "83.8", unit: "%", period: "1–9 Nov 2026", delta: "+2.1 pts vs Oct" },
      { type: "stat_card", ...src("attendance_stats"), title: "Classes held", value: "18", unit: null, period: "1–9 Nov 2026" },
      { type: "stat_card", ...src("attendance_stats"), title: "Below 75%", value: "6", unit: "students", period: "1–9 Nov 2026" },
      { type: "text_delta", text: "ECE-2 ki attendance is mahine **83.8%** hai — October se 2.1 points zyada.\n\n" },
      { type: "text_delta", text: "- 18 classes hui\n- **6 students** 75% se neeche hain" }] };
  }
  return { delay: 60, events: [{ type: "thinking_status", key: "status.thinking", params: {} }, { type: "text_delta", text: "Theek hai. " }, { type: "text_delta", text: "Is sawaal ke liye mere paas abhi koi data tool nahi hai — attendance, marks ya test ke baare me poochiye." }] };
}

const titleOf = (text: string) => {
  const line = text.trim().split(/\n/)[0].replace(/\s+/g, " ");
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || "New chat";
};

function finished(events: Ev[], rid: string, sid: string, startSeq = 0): AgentEvent[] {
  return [...events, { type: "final", session_id: sid, usage: {} }].map((e, i) => ({ seq: startSeq + i, request_id: rid, ...e }) as unknown as AgentEvent);
}

// ---- seed ---------------------------------------------------------------------------------------------
function seed(): MockDb {
  const db: MockDb = { v: 2, sessions: [], queries: [], nextId: 1 };
  const now = Date.now();
  const at = (daysAgo: number, h = 0) => now - daysAgo * DAY - h * 3_600_000;
  const prompts: [string, number, boolean][] = [
    ["Meri class ki attendance", 0.02, false],
    ["Sections ki attendance compare karo", 0.1, true],
    ["Main kya kya dekh sakta hoon?", 1.1, false],
    ["Pichhle 4 hafte ka attendance trend", 1.3, false],
    ["Low attendance students (<75%)", 3, true],
    ["ECE 1 ki attendance", 4, false],
    ["Class 10 trigonometry test banao, 40 marks", 6, false],
  ];
  for (let i = 0; i < 38; i++) prompts.push([`${["Aaj ki attendance", "ECE-2 ki attendance", "Marks summary", "Tests banaye is mahine"][i % 4]} · ${i + 1}`, 8 + i * 1.5, false]);
  for (const [text, daysAgo, pinned] of prompts) {
    const t = at(daysAgo);
    const sid = `sess-${(db.nextId++).toString(36).padStart(4, "0")}`;
    const rid = uid(db, "req");
    const sc = scenario(text);
    db.sessions.push({
      session_id: sid, title: titleOf(text), created_at: iso(t), updated_at: iso(t + 60_000), pinned,
      messages: [
        { seq: 1, role: "user", text, created_at: iso(t), feedback: null },
        { seq: 2, role: "assistant", created_at: iso(t + 2_000), events: finished(sc.events, rid, sid), stopped: false, feedback: null, request_id: rid },
      ],
    });
  }
  const recent = ["Meri class ki attendance", "Sections ki attendance compare karo", "ECE-2 ki attendance", "Low attendance students (<75%)", "Pichhle 4 hafte ka attendance trend", "Main kya kya dekh sakta hoon?", "Marks summary", "ECE 1 ki attendance"];
  db.queries = recent.map((text, i) => ({ id: `q-${i + 1}`, text, created_at: iso(now - i * 3_600_000) }));
  return db;
}

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
const summary = (s: MockSession): SessionSummary => ({ session_id: s.session_id, title: s.title, created_at: s.created_at, updated_at: s.updated_at, pinned: s.pinned });
const find = (db: MockDb, id: string) => {
  const s = db.sessions.find((x) => x.session_id === id);
  if (!s) throw new AgentHttpError(404, "not found");
  return s;
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const cancelled = new Set<string>();

// ---- the adapter ----------------------------------------------------------------------------------------
export const mockApi: AgentApi = {
  kind: "mock",
  meta: (signal) => rest((): AgentMeta => ({
    data_source: "demo", read_only: true, role: "teacher", first_name: "Priya", institute_name: "MSIT (mock)",
    scope: { batches: MOCK_BATCHES, total_students: 44 },
  }), signal),

  listSessions: (q, signal) => rest((): SessionsPage => {
    const db = load();
    const needle = norm(q.q ?? "");
    let list = [...db.sessions].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (q.pinned !== undefined) list = list.filter((s) => s.pinned === q.pinned);
    if (needle) list = list.filter((s) => norm(s.title).includes(needle));
    const limit = Math.min(Math.max(q.limit ?? PAGE_SESSIONS, 1), 50);
    const start = q.cursor ? Number(q.cursor) || 0 : 0;
    const page = list.slice(start, start + limit);
    return { sessions: page.map(summary), next_cursor: start + limit < list.length ? String(start + limit) : null };
  }, signal),

  getMessages: (id, cursor, signal) => rest((): MessagesPage => {
    const s = find(load(), id);
    const end = cursor ? Number(cursor) || 0 : s.messages.length; // cursor = index to page back from
    const start = Math.max(0, end - PAGE_MESSAGES);
    return { messages: s.messages.slice(start, end), next_cursor: start > 0 ? String(start) : null };
  }, signal),

  patchSession: (id, patch) => rest(() => {
    const db = load();
    const s = find(db, id);
    if (typeof patch.title === "string") {
      const t = patch.title.trim().slice(0, 80);
      if (!t) throw new AgentHttpError(422, "title required");
      s.title = t;
    }
    if (typeof patch.pinned === "boolean") s.pinned = patch.pinned;
    save();
    return summary(s);
  }),

  deleteSession: (id) => rest(() => {
    const db = load();
    find(db, id);
    db.sessions = db.sessions.filter((s) => s.session_id !== id);
    save();
  }),

  listQueries: (q, signal) => rest(() => {
    const needle = norm(q.q ?? "");
    return load().queries.filter((x) => !needle || norm(x.text).includes(needle)).slice(0, q.limit ?? 20);
  }, signal),
  deleteQuery: (id) => rest(() => { const db = load(); db.queries = db.queries.filter((x) => x.id !== id); save(); }),
  clearQueries: () => rest(() => { load().queries = []; save(); }),

  suggestions: (q, signal) => rest((): Suggestion[] => {
    const db = load();
    const needle = norm(q.q);
    const limit = q.limit ?? 8;
    if (!needle) return TEMPLATES.slice(0, limit).map((text) => ({ type: "template", text, hint: null }));
    const recent: Suggestion[] = db.queries.filter((x) => norm(x.text).includes(needle)).slice(0, 4).map((x) => ({ type: "recent", text: x.text, hint: null, id: x.id }));
    const entities: Suggestion[] = MOCK_BATCHES.concat(OTHER_BATCHES)
      .filter((b) => norm(b.name).replace(/-/g, " ").includes(needle.replace(/-/g, " ")) || norm(b.name).includes(needle) || needle.includes(norm(b.name)))
      .map((b) => ({ type: "entity", text: `${b.name} ki attendance`, hint: `${b.kind === "Lab" ? "Lab" : "Batch"} · ${b.students ?? 0} students` }));
    const templates: Suggestion[] = TEMPLATES.filter((x) => norm(x).includes(needle)).map((text) => ({ type: "template", text, hint: null }));
    return [...recent, ...entities, ...templates].slice(0, limit);
  }, signal),

  feedback: (body) => rest(() => {
    const s = find(load(), body.session_id);
    const m = s.messages.find((x) => x.seq === body.message_seq && x.role === "assistant");
    if (!m) throw new AgentHttpError(404, "message not found");
    m.feedback = body.rating ? { rating: body.rating, note: body.note ?? null } : null;
    save();
  }),

  cancel: (requestId) => rest(() => { cancelled.add(requestId); }),

  async chat({ body, onEvent, signal }: StreamOptions) {
    await wait(150, signal);
    const db = load();
    const text = body.message.trim();
    if (!text) throw new AgentHttpError(422, "message required");
    let s = body.session_id ? find(db, body.session_id) : null;
    const created = !s;
    if (!s) {
      s = { session_id: uid(db, "sess"), title: titleOf(text), created_at: nowIso(), updated_at: nowIso(), pinned: false, messages: [] };
      db.sessions.unshift(s);
    }
    // regenerate: drop the assistant message (and everything after); edit: drop the user message (and after)
    if (typeof body.regenerate_from_seq === "number") s.messages = s.messages.filter((m) => m.seq < body.regenerate_from_seq!);
    if (typeof body.edit_of_seq === "number") s.messages = s.messages.filter((m) => m.seq < body.edit_of_seq!);
    const lastSeq = s.messages.length ? s.messages[s.messages.length - 1].seq : 0;
    const regenerating = typeof body.regenerate_from_seq === "number";
    const userText = regenerating ? [...s.messages].reverse().find((m) => m.role === "user")?.text ?? text : text;
    if (!regenerating) s.messages.push({ seq: lastSeq + 1, role: "user", text, created_at: nowIso(), feedback: null });
    const asstSeq = regenerating ? lastSeq + 1 : lastSeq + 2;
    const rid = uid(db, "req");
    const stored: StoredMessage = { seq: asstSeq, role: "assistant", created_at: nowIso(), events: [], stopped: false, feedback: null, request_id: rid };
    s.messages.push(stored);
    s.updated_at = nowIso();
    if (!regenerating) {
      db.queries = [{ id: uid(db, "q"), text, created_at: nowIso() }, ...db.queries.filter((q) => norm(q.text) !== norm(text))].slice(0, 50);
    }
    save();

    const sc = scenario(userText);
    const all: Ev[] = [{ type: "session", session_id: s.session_id, title: s.title }, ...sc.events, { type: "final", session_id: s.session_id, usage: {} }];
    let seq = 0;
    try {
      for (const e of all) {
        if (cancelled.has(rid)) { stored.stopped = true; break; }
        await wait(e.type === "session" ? 30 : sc.delay, signal);
        if (cancelled.has(rid)) { stored.stopped = true; break; }
        const ev = { seq: seq++, request_id: rid, ...e } as unknown as AgentEvent;
        if (ev.type !== "session") stored.events!.push(ev);
        save();
        onEvent(ev);
      }
    } catch (err) {
      stored.stopped = true;
      save();
      throw err;
    } finally {
      cancelled.delete(rid);
      if (created) save();
    }
  },

  approve: ({ approvalId }) => rest(() => ({ ok: true, status: "finalized", approval_id: approvalId })),
  downloadPdf: async () => { throw new AgentHttpError(501, "PDF download isn't available in the mock"); },
};
