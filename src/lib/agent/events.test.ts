import { describe, it, expect } from "vitest";
import { createSseParser, decodeSseData, parseAgentEvent, parseAgentMeta, parseAgentSessions } from "./events";

describe("createSseParser", () => {
  it("splits events across chunk boundaries", () => {
    const p = createSseParser();
    expect(p.push('data: {"a":')).toEqual([]);
    expect(p.push('1}\n\ndata: {"b":2}\n')).toEqual(['{"a":1}']);
    expect(p.push("\n")).toEqual(['{"b":2}']);
  });
  it("handles CRLF, comments, other fields and multi-line data", () => {
    const p = createSseParser();
    const out = p.push(": ping\r\n\r\nevent: x\r\nid: 3\r\ndata: line1\r\ndata: line2\r\n\r\n");
    expect(out).toEqual(["line1\nline2"]);
  });
  it("flushes a trailing event on end()", () => {
    const p = createSseParser();
    expect(p.push('data: {"z":1}')).toEqual([]);
    expect(p.end()).toEqual(['{"z":1}']);
    expect(p.end()).toEqual([]);
  });
});

describe("parseAgentEvent", () => {
  const base = { seq: 1, request_id: "r1" };
  it("parses known types", () => {
    const e = decodeSseData(JSON.stringify({ ...base, type: "text_delta", text: "hi" }));
    expect(e?.type).toBe("text_delta");
  });
  it("drops unknown types, bad JSON and missing base fields", () => {
    expect(parseAgentEvent({ ...base, type: "mystery" })).toBeNull();
    expect(decodeSseData("{not json")).toBeNull();
    expect(parseAgentEvent({ type: "text_delta", text: "x" })).toBeNull();
    expect(parseAgentEvent(null)).toBeNull();
  });
  it("fills defaults and filters bad chips", () => {
    const c = parseAgentEvent({ ...base, type: "clarify", question: "Which?", chips: [{ label: "A", value: "a" }, { label: 1 }] });
    expect(c?.type === "clarify" && c.chips).toEqual([{ label: "A", value: "a" }]);
    const v = parseAgentEvent({ ...base, type: "verification_summary", objective_verified: 1, objective_total: 2,
      rubric_checked: 0, rubric_total: 1, manual_review: ["q3"], marks_sum_ok: true });
    expect(v?.type === "verification_summary" && v.duplicates).toEqual([]);
    const s = parseAgentEvent({ ...base, type: "stat_card", title: "Att", source: "tool:x", as_of: "t" });
    expect(s?.type === "stat_card" && s.value).toBeNull();
  });
});

describe("contract 1.1 additions", () => {
  const base = { seq: 1, request_id: "r1" };
  it("stat_card period/delta are optional strings (null when missing or bad)", () => {
    const a = parseAgentEvent({ ...base, type: "stat_card", title: "Att", value: "83.8", source: "tool:x", as_of: "t", period: "1–5 Nov 2026", delta: "+2.1 pts vs Oct" });
    expect(a?.type === "stat_card" && [a.period, a.delta]).toEqual(["1–5 Nov 2026", "+2.1 pts vs Oct"]);
    const b = parseAgentEvent({ ...base, type: "stat_card", title: "Att", value: "1", source: "tool:x", as_of: "t", delta: 3 });
    expect(b?.type === "stat_card" && [b.period, b.delta]).toEqual([null, null]);
  });
  it("GET /agent/meta", () => {
    expect(parseAgentMeta({ data_source: "live", read_only: true, role: "hod", first_name: "Priya", institute_name: "MSIT" }))
      .toEqual({ data_source: "live", read_only: true, role: "hod", first_name: "Priya", institute_name: "MSIT" });
    expect(parseAgentMeta({ data_source: "prod" })).toBeNull();
    expect(parseAgentMeta({ data_source: "demo", role: "root" })?.role).toBe("teacher");
  });
  it("GET /agent/sessions drops bad rows", () => {
    const s = parseAgentSessions({ sessions: [{ session_id: "s1", title: "Aaj ki attendance", created_at: "2026-11-06T10:00:00+05:30", updated_at: "2026-11-06T10:01:00+05:30" }, { title: "x" }, null] });
    expect(s).toHaveLength(1);
    expect(parseAgentSessions(null)).toEqual([]);
  });
});
