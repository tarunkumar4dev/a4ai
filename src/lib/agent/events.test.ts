import { describe, it, expect } from "vitest";
import { createSseParser, decodeSseData, parseAgentEvent } from "./events";

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
