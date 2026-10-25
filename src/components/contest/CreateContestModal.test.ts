import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContestPayload, clampDuration, createTapGuard, localToIso, type ContestFormSettings } from "./contestPayload";

const createContest = vi.fn();
vi.mock("@/lib/contestApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/contestApi")>()),
  contestApi: { createContest: (...a: unknown[]) => createContest(...a) },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// React act() environment flag
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: ContestFormSettings = {
  title: "T", duration: 60, answerMode: "after_test", showExplanation: true, enableCamera: true, enableTabDetection: true,
  allowBackNavigation: true, maxWarnings: 5, scheduledAt: null, expiresAt: null, maxAttempts: 1,
};

describe("contest payload", () => {
  it("sends exactly the selected duration", () => {
    for (const d of [15, 30, 45, 60, 90, 120]) {
      expect(buildContestPayload({ settings: { ...base, duration: d }, subject: "Eco", classGrade: "12", questions: [] }).duration_minutes).toBe(d);
    }
  });
  it("initial duration from a PDF is clamped to 5–180, else 30", () => {
    expect(clampDuration(60)).toBe(60);
    expect(clampDuration(300)).toBe(180);
    expect(clampDuration(2)).toBe(5);
    expect(clampDuration(null)).toBe(30);
    expect(clampDuration(NaN)).toBe(30);
  });
  it("schedule: datetime-local → real UTC ISO (never the bare local string)", () => {
    const iso = localToIso("2026-10-25T11:36")!;
    expect(iso).toBe(new Date("2026-10-25T11:36").toISOString());
    expect(iso.endsWith("Z")).toBe(true);
    const p = buildContestPayload({ settings: { ...base, scheduledAt: "2026-10-25T11:36", expiresAt: "" }, subject: "E", classGrade: "12", questions: [] });
    expect(p.scheduled_at).toBe(iso);
    expect(p.expires_at).toBeNull();
    expect(localToIso("garbage")).toBeNull();
  });
  it("tap guard ignores taps for 400 ms after a picker closed", () => {
    let now = 1000;
    const g = createTapGuard(400, () => now);
    expect(g.allowed()).toBe(true);
    g.block();
    now = 1300; expect(g.allowed()).toBe(false);
    now = 1400; expect(g.allowed()).toBe(true);
  });
});

describe("CreateContestModal (rendered)", { timeout: 30000 }, () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    createContest.mockReset().mockResolvedValue({ contest_id: "c", short_code: "abc", share_link: "https://a4ai.in/contest/abc", total_questions: 1, total_marks: 1 });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  const render = async (initialDuration?: number) => {
    const { CreateContestModal } = await import("./CreateContestModal");
    await act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(CreateContestModal, {
        isOpen: true, onClose: () => {}, questions: [{ question_text: "Q", options: ["A) x", "B) y"], correct_answer: "A", marks: 1 }],
        testTitle: "T", subject: "Eco", classGrade: "12", initialDuration,
      })));
    });
  };
  const button = (label: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === label)!;
  const tap = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })); });
  const create = async () => {
    const btn = Array.from(host.querySelectorAll("button")).find((b) => /Create & Get Link/.test(b.textContent || ""))!;
    await act(async () => { btn.click(); });
  };

  it("“1 hour” → duration_minutes 60 in the request", async () => {
    await render();
    tap(button("1 hour"));
    await create();
    expect(createContest).toHaveBeenCalledTimes(1);
    expect(createContest.mock.calls[0][0].duration_minutes).toBe(60);
  });

  it("a ghost tap on “15 min” right after the date picker closes is ignored", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await render(60);
      const opens = host.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(opens, "2026-12-01T10:00");
        opens.dispatchEvent(new Event("input", { bubbles: true }));
        opens.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      tap(button("15 min"));                       // within 400 ms → ignored
      vi.advanceTimersByTime(500);
      await create();
      expect(createContest.mock.calls[0][0].duration_minutes).toBe(60);
      expect(createContest.mock.calls[0][0].scheduled_at).toBe(new Date("2026-12-01T10:00").toISOString());
    } finally {
      vi.useRealTimers();
    }
  });
});
