import { describe, expect, it } from "vitest";
import {
  acceptFix,
  afterTeacherEdit,
  applyVerdicts,
  paperShortfall,
  summarizeVerification,
} from "./paperQuality";
import type { QuestionVerification } from "./paperQuality";

type TQ = {
  id: string;
  correctAnswer: string;
  explanation: string;
  validationStatus: string;
  editData?: unknown;
  verification?: QuestionVerification;
};
const q = (id: string, extra: Partial<TQ> = {}): TQ => ({
  id,
  correctAnswer: "A) 30",
  explanation: "old explanation",
  validationStatus: "needs_review",
  ...extra,
});
const originals = (qs: { id: string; correctAnswer: string }[]) => new Map(qs.map((x) => [x.id, x.correctAnswer]));

describe("applyVerdicts", () => {
  const qs = [q("ok"), q("fix"), q("reject"), q("unchecked")];
  const res = {
    checker_independent: true,
    results: [
      { id: "ok", verdict: "ok" as const },
      { id: "fix", verdict: "fix" as const, issue: "wrong key", correct_answer: "C) 60", explanation: "new explanation" },
      { id: "reject", verdict: "reject" as const, issue: "two correct options" },
    ],
  };
  const out = applyVerdicts(qs, res, originals(qs));
  const by = Object.fromEntries(out.map((x) => [x.id, x]));

  it("ok is the only verdict that upgrades to verified", () => {
    expect(out.map((x) => x.validationStatus)).toEqual(["verified", "needs_review", "needs_review", "needs_review"]);
    expect(by.ok.verification).toEqual({ verdict: "ok", independent: true });
  });

  it("fix stores a suggestion and leaves the key alone", () => {
    expect(by.fix.correctAnswer).toBe("A) 30");
    expect(by.fix.verification).toMatchObject({ verdict: "fix", suggestedAnswer: "C) 60", suggestedExplanation: "new explanation" });
  });

  it("reject flags the question; an unchecked one is untouched", () => {
    expect(by.reject.verification).toMatchObject({ verdict: "reject", issue: "two correct options" });
    expect(by.unchecked).toBe(qs[3]);
  });

  it("a key the teacher already changed is never verified or overwritten", () => {
    const edited = [q("ok", { correctAnswer: "B) 45" }), q("fix", { editData: { correctAnswer: "D) 90" } })];
    const after = applyVerdicts(edited, res, originals(qs));
    expect(after[0]).toBe(edited[0]);
    expect(after[1].verification?.verdict).toBe("reject");
    expect(after[1].correctAnswer).toBe("A) 30");
  });

  it("an existing verdict is kept (reload of a checked paper)", () => {
    const done = [q("ok", { verification: { verdict: "reject" } })];
    expect(applyVerdicts(done, res, originals(done))[0]).toBe(done[0]);
  });

  it("a fix without a usable key is a review flag; a same-family checker is labelled", () => {
    const one = [q("fix")];
    const r = applyVerdicts(one, { checker_independent: false, results: [{ id: "fix", verdict: "fix" }] }, originals(one));
    expect(r[0].verification).toMatchObject({ verdict: "reject", independent: false });
  });
});

describe("acceptFix / afterTeacherEdit", () => {
  const suggested = q("fix", { verification: { verdict: "fix", suggestedAnswer: "C) 60", suggestedExplanation: "new" } });

  it("accepting applies the suggested key but does not mark the question verified", () => {
    const a = acceptFix(suggested);
    expect(a.correctAnswer).toBe("C) 60");
    expect(a.explanation).toBe("new");
    expect(a.validationStatus).toBe("needs_review");
    expect(a.verification).toMatchObject({ accepted: true, previousAnswer: "A) 30" });
    expect(acceptFix(a)).toBe(a);
  });

  it("editing a verified question makes it unverified again", () => {
    const v = q("ok", { validationStatus: "verified", verification: { verdict: "ok" } });
    expect(afterTeacherEdit(v, false)).toBe(v);
    expect(afterTeacherEdit(v, true)).toMatchObject({ validationStatus: "needs_review", verification: undefined });
  });
});

describe("summarizeVerification", () => {
  it("counts verdicts", () => {
    const qs = [q("a", { verification: { verdict: "ok" } }), q("b", { verification: { verdict: "fix" } }), q("c")];
    expect(summarizeVerification(qs)).toEqual({ verified: 1, suggested: 1, flagged: 0 });
  });
});

describe("paperShortfall", () => {
  it("only when fewer were delivered than requested", () => {
    expect(paperShortfall({ requestedQuestions: 38, deliveredQuestions: 31 })).toEqual({ requested: 38, delivered: 31 });
    expect(paperShortfall({ requestedQuestions: 10, deliveredQuestions: 10 })).toBeNull();
    expect(paperShortfall({})).toBeNull(); // older backend: no numbers, no banner
    expect(paperShortfall(undefined)).toBeNull();
  });
});
