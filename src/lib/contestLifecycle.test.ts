// Contest states → allowed action. Every (my_state × phase) pair is covered, so a new state can't slip through.
import { describe, expect, it } from "vitest";
import {
  actionView, formatCountdown, nextBoundary, normalizeContest, phaseAt, primaryAction,
  type FeedContest, type MyState, type Phase,
} from "./contestLifecycle";

const NOW = Date.parse("2026-11-01T10:00:00Z");
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const base: FeedContest = normalizeContest({ id: "c1", short_code: "abcd1234", title: "Light", status: "active" })!;

describe("phaseAt", () => {
  it("open contest (no schedule, no expiry) is live", () => {
    expect(phaseAt(base, NOW)).toBe("live");
  });
  it("scheduled in the future → scheduled; at the start second → live", () => {
    expect(phaseAt({ ...base, scheduled_at: iso(1000) }, NOW)).toBe("scheduled");
    expect(phaseAt({ ...base, scheduled_at: iso(0) }, NOW)).toBe("live");
  });
  it("expired → ended, even when paused", () => {
    expect(phaseAt({ ...base, expires_at: iso(0) }, NOW)).toBe("ended");
    expect(phaseAt({ ...base, expires_at: iso(-1), status: "paused" }, NOW)).toBe("ended");
  });
  it("any status other than active → paused (unknown values too)", () => {
    expect(phaseAt({ ...base, status: "paused" }, NOW)).toBe("paused");
    expect(phaseAt({ ...base, status: "unknown" }, NOW)).toBe("paused");
  });
  it("broken dates are ignored", () => {
    expect(phaseAt({ ...base, scheduled_at: "garbage", expires_at: "" }, NOW)).toBe("live");
  });
});

describe("primaryAction — the full matrix", () => {
  const expected: Record<MyState, Record<Phase, string>> = {
    owner:       { scheduled: "manage",   live: "manage", ended: "manage",      paused: "manage" },
    submitted:   { scheduled: "result",   live: "result", ended: "result",      paused: "result" },
    in_progress: { scheduled: "resume",   live: "resume", ended: "result",      paused: "paused" },
    registered:  { scheduled: "registered", live: "start", ended: "leaderboard", paused: "paused" },
    none:        { scheduled: "register", live: "start",  ended: "leaderboard", paused: "paused" },
  };
  for (const [state, row] of Object.entries(expected)) {
    for (const [phase, kind] of Object.entries(row)) {
      it(`${state} × ${phase} → ${kind}`, () => {
        expect(primaryAction({ my_state: state as MyState, results_pending: false }, phase as Phase).kind).toBe(kind);
      });
    }
  }
  it("teacher_release before publishing: results_pending instead of a result", () => {
    expect(primaryAction({ my_state: "submitted", results_pending: true }, "live").kind).toBe("result_pending");
    expect(primaryAction({ my_state: "in_progress", results_pending: true }, "ended").kind).toBe("result_pending");
  });
  it("an unknown state from the server throws in primaryAction (caught earlier by normalizeContest)", () => {
    expect(() => primaryAction({ my_state: "banned" as MyState, results_pending: false }, "live")).toThrow(/Unhandled/);
  });
});

describe("actionView", () => {
  it("start / resume open the contest; results go to the leaderboard", () => {
    expect(actionView({ kind: "start" }, base)).toMatchObject({ href: "/contest/abcd1234", disabled: false });
    expect(actionView({ kind: "resume" }, base).href).toBe("/contest/abcd1234");
    expect(actionView({ kind: "result" }, base).href).toBe("/contests/leaderboard?c=abcd1234&id=c1");
    expect(actionView({ kind: "manage" }, base).label).toBe("Results");
  });
  it("register has no link (the caller registers); waiting states are disabled", () => {
    expect(actionView({ kind: "register" }, base)).toMatchObject({ href: null, disabled: false });
    for (const kind of ["registered", "result_pending", "paused"] as const) {
      expect(actionView({ kind }, base)).toMatchObject({ href: null, disabled: true });
    }
  });
});

describe("nextBoundary + countdown text", () => {
  it("scheduled → Starts in; live with expiry → Ends in; open / ended → none", () => {
    expect(nextBoundary({ ...base, scheduled_at: iso(5000) }, NOW)).toEqual({ at: NOW + 5000, label: "Starts in" });
    expect(nextBoundary({ ...base, expires_at: iso(9000) }, NOW)).toEqual({ at: NOW + 9000, label: "Ends in" });
    expect(nextBoundary(base, NOW)).toBeNull();
    expect(nextBoundary({ ...base, expires_at: iso(-1) }, NOW)).toBeNull();
  });
  it("fixed-width text", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(65_000)).toBe("00:01:05");
    expect(formatCountdown(2 * 86400_000 + 3_723_000)).toBe("2d 01:02:03");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});

describe("normalizeContest (partial / odd server rows)", () => {
  it("skips rows without id or code", () => {
    expect(normalizeContest(null)).toBeNull();
    expect(normalizeContest({ id: "x" })).toBeNull();
    expect(normalizeContest({ short_code: "abc" })).toBeNull();
  });
  it("fills defaults and maps unknown my_state to none", () => {
    const c = normalizeContest({ id: "x", short_code: "abcd", my_state: "weird", attempts: "7", my_score: "4.5" })!;
    expect(c).toMatchObject({ title: "Untitled contest", my_state: "none", attempts: 7, my_score: 4.5, status: "unknown",
      results_pending: false, scheduled_at: null });
  });
});
