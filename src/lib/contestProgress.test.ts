import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answersFor, clearLocal, clientDeadline, createAwayTracker, createProgressSync, loadLocal, mergeProgress, saveLocal,
  secondsLeft, submitWithRetry, type AttemptProgress, type WarningType,
} from "./contestProgress";
import { isContestActive, setContestActive } from "./contestGuard";

const ans = (id: string, selected: string | null) => ({ questionId: id, selected, textAnswer: "", timeSpent: 0, flagged: false });
const prog = (answers: ReturnType<typeof ans>[], warning_count = 0, log = 0): AttemptProgress => ({
  answers, current_index: 0, warning_count, warning_log: Array.from({ length: log }, () => ({ type: "tab_hidden" as const, at: "x" })),
});

describe("local copy", () => {
  it("saves, loads and clears per attempt", () => {
    saveLocal("a1", { ...prog([ans("q1", "B")]), local_deadline: 123 });
    expect(loadLocal("a1")?.answers[0].selected).toBe("B");
    expect(loadLocal("a1")?.local_deadline).toBe(123);
    expect(loadLocal("other")).toBeNull();
    clearLocal("a1");
    expect(loadLocal("a1")).toBeNull();
  });
});

describe("mergeProgress", () => {
  it("keeps the copy with more answers, warnings never go down", () => {
    const local = prog([ans("q1", "A"), ans("q2", "C")], 1, 1);
    const server = prog([ans("q1", "A"), ans("q2", null)], 3, 3);
    const m = mergeProgress(local, server)!;
    expect(m.answers.map((a) => a.selected)).toEqual(["A", "C"]);
    expect(m.warning_count).toBe(3);
    expect(m.warning_log).toHaveLength(3);
  });
  it("server wins when it has more (e.g. answered on another device)", () => {
    const m = mergeProgress(prog([ans("q1", null)]), prog([ans("q1", "D")]))!;
    expect(m.answers[0].selected).toBe("D");
  });
  it("works with only one side, or an old backend that sends nothing", () => {
    expect(mergeProgress(null, null)).toBeNull();
    expect(mergeProgress(prog([ans("q1", "A")]), undefined)!.answers[0].selected).toBe("A");
    expect(mergeProgress(null, { answers: [ans("q1", "B")] })!.warning_count).toBe(0);
  });
  it("answersFor fills blanks and drops unknown ids", () => {
    const out = answersFor(["q1", "q2"], [ans("q2", "C"), ans("zz", "A")]);
    expect(out.map((a) => [a.questionId, a.selected])).toEqual([["q1", null], ["q2", "C"]]);
  });
});

describe("timer from the server", () => {
  it("corrects a wrong device clock with server_now", () => {
    // server: 10:00:00, deadline 11:00:00; this phone's clock is 7 min fast
    const received = Date.parse("2026-10-25T10:07:00Z");
    const d = clientDeadline("2026-10-25T11:00:00Z", "2026-10-25T10:00:00Z", received)!;
    expect(secondsLeft(d, received)).toBe(3600);
  });
  it("falls back to deadline_at alone, and null without it (old backend)", () => {
    expect(clientDeadline("2026-10-25T11:00:00Z", null, 0)).toBe(Date.parse("2026-10-25T11:00:00Z"));
    expect(clientDeadline(null, "2026-10-25T10:00:00Z", 0)).toBeNull();
    expect(secondsLeft(1000, 5000)).toBe(0);
  });
});

describe("away tracker", () => {
  it("counts one warning per away episode (hidden + blur together = 1)", () => {
    const seen: WarningType[] = [];
    const t = createAwayTracker((type) => seen.push(type));
    t.hidden(); t.blur(); t.back();          // switch app: both events fire
    t.blur(); t.hidden(); t.back();          // other order
    expect(seen).toEqual(["tab_hidden", "window_blur"]);
  });
  it("ignores a blur right after our own permission prompt / fullscreen change", () => {
    let now = 0;
    const seen: WarningType[] = [];
    const t = createAwayTracker((type) => seen.push(type), () => now);
    t.suppress(1500);
    now = 1000; t.blur(); t.back();
    now = 1600; t.blur();
    expect(seen).toEqual(["window_blur"]);
    t.back(); t.hidden();                    // a real tab switch is still counted during suppression
    expect(seen).toEqual(["window_blur", "tab_hidden"]);
  });
});

describe("submitWithRetry", () => {
  const noSleep = () => Promise.resolve();
  it("retries until the server answers", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error("net")).mockRejectedValueOnce(new Error("net")).mockResolvedValue({ score: 7 });
    const retries: number[] = [];
    await expect(submitWithRetry(submit, { sleep: noSleep, onRetry: (n) => retries.push(n) })).resolves.toEqual({ score: 7 });
    expect(retries).toEqual([1, 2]);
  });
  it("gives up after the delays (≈ 60 s) and throws — the caller keeps the attempt open", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(submitWithRetry(submit, { sleep: noSleep, delays: [1, 2, 4] })).rejects.toThrow("offline");
    expect(submit).toHaveBeenCalledTimes(4);
  });
  it("stops at once on a final error", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("403"));
    await expect(submitWithRetry(submit, { sleep: noSleep, isFinal: () => true })).rejects.toThrow("403");
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe("progress sync", () => {
  afterEach(() => vi.useRealTimers());
  it("debounces changes, retries silently when offline, sends only the latest", async () => {
    vi.useFakeTimers();
    let n = 0;
    const sent: number[] = [];
    const states: string[] = [];
    const send = vi.fn(async (p: AttemptProgress) => {
      if (sent.length === 0 && states.filter((s) => s === "offline").length === 0) throw new Error("offline");
      sent.push(p.current_index);
    });
    const sync = createProgressSync({ send, snapshot: () => ({ ...prog([]), current_index: n }), onState: (s) => states.push(s), debounceMs: 2000, intervalMs: 15000 });
    n = 1; sync.changed();
    n = 2; sync.changed();
    await vi.advanceTimersByTimeAsync(2000);       // one send (fails)
    expect(send).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("offline");
    n = 3;
    await vi.advanceTimersByTimeAsync(15000);      // interval retries with the newest snapshot
    expect(sent).toEqual([3]);
    expect(states.at(-1)).toBe("saved");
    sync.stop();
  });
  it("flush() sends at once with keepalive", async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => ({ ok: true }));
    const sync = createProgressSync({ send, snapshot: () => prog([]), onState: () => {} });
    sync.changed();
    sync.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith(expect.anything(), true);
    sync.stop();
  });
});

describe("contest guard", () => {
  it("flags an active attempt for reload guards", () => {
    setContestActive(true);
    expect(isContestActive()).toBe(true);
    setContestActive(false);
    expect(isContestActive()).toBe(false);
  });
});
