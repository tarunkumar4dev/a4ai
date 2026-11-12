// One realistic fixture per event the backend can send (contract 1.4), typed with the GENERATED types. The mapped
// type makes the object incomplete — a compile error — as soon as `npm run agent:contract` brings a new event type.
// contract.test.ts also checks this list against the OpenAPI JSON snapshot at runtime.
import type { ContractEvent, FileReady } from "../types";

type Fixtures = { [K in ContractEvent["type"]]: Extract<ContractEvent, { type: K }> };
const R = "9f2c1a7e5b3d4c21";
const AS_OF = "2026-11-09T15:45:00+05:30";

export const CONTRACT_FIXTURES: Fixtures = {
  session: { type: "session", seq: 0, request_id: R, session_id: "6b0e1c2d-1111-4aaa-8bbb-000000000001", title: "ECE 1 ki is mahine ki attendance" },
  thinking_status: { type: "thinking_status", seq: 1, request_id: R, key: "tool.attendance_stats", params: { phase: "done", ms: 412, ok: true } },
  text_delta: { type: "text_delta", seq: 2, request_id: R, text: "ECE 1 ki attendance is mahine **83.8%** rahi." },
  stat_card: { type: "stat_card", seq: 3, request_id: R, source: "tool:attendance_stats", as_of: AS_OF, title: "Attendance · ECE 1", value: "83.8", unit: "%", subtitle: "396 marks · 18 classes", period: "1–9 Nov 2026", delta: "+2.1 pts vs previous 9 days" },
  chart: { type: "chart", seq: 4, request_id: R, source: "tool:section_comparison", as_of: AS_OF, kind: "bar", title: "Attendance %", y_unit: "%", series: [{ name: "Attendance %", points: [["ECE 1", 86.4], ["ECE 2", 83.8], ["ECE 3", null]] }] },
  table: { type: "table", seq: 5, request_id: R, source: "tool:low_attendance_list", as_of: AS_OF, title: "Below 75%", columns: ["Student", "Section", "%", "Marked"], rows: [["Aarav Gupta", "ECE 2", "61.1", "18"], ["Meera Nair", "ECE 2", null, "0"]] },
  clarify: { type: "clarify", seq: 6, request_id: R, question: "Kaun sa? / Which one?", chips: [{ label: "ECE 1", value: "ECE 1 (id 6b0e)", hint: "Electronics · 2 students" }, { label: "ECE1", value: "ECE1 (id 77c1)", hint: "Electronics · 0 students" }] },
  blueprint: { type: "blueprint", seq: 7, request_id: R, class_grade: 10, subject: "Mathematics", chapters: ["Introduction to Trigonometry"], total_marks: 20, duration_min: 45, sections: [{ section: "A", qtype: "mcq", count: 4, marks_each: 1 }, { section: "B", qtype: "short_answer", count: 2, marks_each: 3 }, { section: "C", qtype: "long_answer", count: 2, marks_each: 5 }] },
  paper_preview: { type: "paper_preview", seq: 8, request_id: R, draft_id: "0f8fad5b-d9cb-469f-a165-70867728950e", title: "Trigonometry — Unit Test", total_marks: 20, duration_min: 45, questions: [{ id: "q1", section: "A", qtype: "mcq", marks: 1, text: "The value of $\\tan 45^\\circ$ is:", options: ["0", "1", "$\\sqrt{3}$", "$\\frac{1}{\\sqrt{3}}$"], answer: "(b) 1", marking_scheme: null, sub_questions: null, status: "verified" }] },
  verification_summary: { type: "verification_summary", seq: 9, request_id: R, objective_verified: 4, objective_total: 4, rubric_checked: 3, rubric_total: 4, manual_review: ["q6"], marks_sum_ok: true, duplicates: [], rounds: 2 },
  pending_approval: { type: "pending_approval", seq: 10, request_id: R, approval_id: "appr-1", action: "finalize_test", summary: "Class 10 Mathematics — 8 sawaal, 20 marks. Test History me save hoga.", args_sha256: "a".repeat(64), expires_at: "2099-01-01T00:00:00+00:00", status: "pending" },
  file: { type: "file", seq: 15, request_id: R, file_id: "f7a1c0de0000400080000000000000ab", kind: "defaulters_export", name: "below-75-ece2.xlsx", rows: 6, expires_at: "2099-01-01T00:00:00+00:00", download_path: "/agent/files/f7a1c0de0000400080000000000000ab" },
  error: { type: "error", seq: 11, request_id: R, code: "provider_error", message: "AI service abhi busy hai.", retryable: false, partial: {} },
  speech: { type: "speech", seq: 16, request_id: R, text: "ECE 1 की attendance इस महीने 83.8% रही।", language: "hi-en" },
  ui_action: { type: "ui_action", seq: 17, request_id: R, action: "navigate", route_key: "dashboard.attendance", params: {}, label: "Attendance" },
  final: { type: "final", seq: 12, request_id: R, session_id: "6b0e1c2d-1111-4aaa-8bbb-000000000001", usage: {}, cancelled: false },
};

/** The two tables the backend turns into dedicated views (my_scope, section_comparison). */
export const SCOPE_TABLE: Extract<ContractEvent, { type: "table" }> = {
  type: "table", seq: 13, request_id: R, source: "tool:my_scope", as_of: AS_OF, title: "Meri classes · 3", columns: ["Batch", "Students", "Role", "Subjects"],
  rows: [["ECE 1", "22", "teacher", "Signals"], ["ECE 2", "22", "proctor", "Signals, Networks"], ["ECE 2 A", "15", "proctor", null]],
};
export const RANKING_TABLE: Extract<ContractEvent, { type: "table" }> = {
  type: "table", seq: 14, request_id: R, source: "tool:section_comparison", as_of: AS_OF, title: "Attendance % by class · 1–9 Nov 2026", columns: ["#", "Class", "%", "Classes held", "Marked"],
  rows: [["1", "ECE 1", "86.4", "18", "396"], ["2", "ECE 2", "83.8", "18", "396"], [null, "ECE 4", null, "0", "0"]],
};

/** Convenience typed reference for tests that need the file fixture separately. */
export const FILE_FIXTURE: FileReady = CONTRACT_FIXTURES.file;
