// Practice stays textbook-only: the direct read asks for source=ncert, and still works before the column exists.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: unknown[][] = [];
let missingColumn = false;

vi.mock("@/lib/supabaseClient", () => {
  const builder = (): Record<string, unknown> => {
    const used: unknown[][] = [];
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "or", "order", "range", "abortSignal"]) {
      b[m] = (...args: unknown[]) => { used.push([m, ...args]); return b; };
    }
    b.then = (resolve: (r: unknown) => void) => {
      calls.push(used);
      const bySource = used.some((c) => c[0] === "eq" && c[1] === "source");
      resolve(missingColumn && bySource
        ? { data: null, error: { code: "42703", message: "column ncert_questions.source does not exist" }, count: null }
        : { data: [{ chapter: "Accounting Ratios", question_type: "short_answer" }], error: null, count: 1 });
    };
    return b;
  };
  return { supabase: { from: () => builder() } };
});

beforeEach(() => { calls.length = 0; vi.resetModules(); });

describe("direct read fallback", () => {
  it("filters to source=ncert", async () => {
    missingColumn = false;
    const { statsFromDb } = await import("./practiceApi");
    const stats = await statsFromDb("12", "Accountancy");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContainEqual(["eq", "source", "ncert"]);
    expect(stats[0].types[0].name).toBe("short_answer");
  });

  it("drops the filter once when the column is missing, then remembers", async () => {
    missingColumn = true;
    const { statsFromDb, questionsFromDb } = await import("./practiceApi");
    await statsFromDb("12", "Accountancy");
    expect(calls.map((c) => c.some((x) => x[1] === "source"))).toEqual([true, false]);
    await questionsFromDb({ cls: "12", subject: "Accountancy", chapter: "Accounting Ratios", page: 0 });
    expect(calls.map((c) => c.some((x) => x[1] === "source"))).toEqual([true, false, false]);
  });
});

describe("labels", () => {
  it("names the PYQ question types", async () => {
    const { typeLabel } = await import("./practiceApi");
    expect(["short_answer", "long_answer", "case_study"].map(typeLabel)).toEqual(["Short answer", "Long answer", "Case study"]);
  });
});
