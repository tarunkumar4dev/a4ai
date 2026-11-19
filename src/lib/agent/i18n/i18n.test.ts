import { afterEach, describe, expect, it } from "vitest";
import { DICTS, LANG_STORAGE_KEY, agentLang, htmlLang, translate, type AgentKey, type Dict } from "./index";
import { hinglish } from "./hinglish";

const langs = ["hinglish", "en", "hi"] as const;
const placeholders = (v: unknown): string[] => {
  const texts = typeof v === "string" ? [v] : Object.values(v as Record<string, string>);
  return [...new Set(texts.flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
};

describe("agent i18n dictionaries", () => {
  it("all three have exactly the same keys", () => {
    const ref = Object.keys(hinglish).sort();
    for (const l of langs) expect(Object.keys(DICTS[l]).sort()).toEqual(ref);
  });

  it("plural keys are plural everywhere, plain keys plain", () => {
    for (const k of Object.keys(hinglish) as AgentKey[]) {
      const kind = typeof hinglish[k];
      for (const l of langs) expect([k, typeof DICTS[l][k]]).toEqual([k, kind]);
    }
  });

  it("every {placeholder} matches across languages", () => {
    for (const k of Object.keys(hinglish) as AgentKey[]) {
      const ref = placeholders(hinglish[k]);
      for (const l of langs) expect([k, placeholders(DICTS[l][k])]).toEqual([k, ref]);
    }
  });

  it("no empty strings, no ALL-CAPS labels, Hinglish has no Devanagari", () => {
    for (const l of langs) {
      for (const [k, v] of Object.entries(DICTS[l])) {
        for (const s of typeof v === "string" ? [v] : Object.values(v)) {
          expect([k, s.trim().length > 0]).toEqual([k, true]);
          const letters = s.replace(/[^A-Za-z]/g, "");
          if (letters.length > 6 && !/^(CBSE|NCERT|HOD|PDF|EN)/.test(s)) expect([k, letters === letters.toUpperCase()]).toEqual([k, false]);
        }
      }
    }
    for (const [k, v] of Object.entries(DICTS.hinglish)) {
      for (const s of typeof v === "string" ? [v] : Object.values(v)) expect([k, /[ऀ-ॿ]/.test(s)]).toEqual([k, false]);
    }
  });

  it("a missing key is a type error", () => {
    const { greeting: _drop, ...rest } = DICTS.en;
    // @ts-expect-error — "greeting" is missing
    const bad: Dict = rest;
    expect(bad).toBeTruthy();
  });
});

describe("translate", () => {
  afterEach(() => { try { localStorage.removeItem(LANG_STORAGE_KEY); } catch { /* */ } agentLang.reset(); });

  it("fills placeholders and picks plural forms with en-IN digits", () => {
    expect(translate("en", "greeting", { name: "Asha" })).toBe("Hello, Asha");
    expect(translate("hi", "greeting", { name: "Asha" })).toBe("नमस्ते, Asha जी");
    expect(translate("en", "scope.batches", { n: 1 })).toBe("1 batch");
    expect(translate("en", "scope.batches", { n: 3 })).toBe("3 batches");
    expect(translate("en", "scope.students", { n: 12345 })).toBe("12,345 students");
    expect(translate("hinglish", "error.rate", { s: 30 })).toContain("30 second");
  });

  it("persists the choice and keeps ui + reply in sync", () => {
    expect(agentLang.get()).toEqual({ ui: "hinglish", reply: "hinglish" });
    agentLang.set("hi");
    expect(agentLang.get()).toEqual({ ui: "hi", reply: "hi" });
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("hi");
    agentLang.reset();
    expect(agentLang.get().ui).toBe("hi");
    // @ts-expect-error — not a language
    agentLang.set("fr");
    expect(agentLang.get().ui).toBe("hi");
  });

  it("lang attributes", () => {
    expect([htmlLang("en"), htmlLang("hi"), htmlLang("hinglish")]).toEqual(["en", "hi", "hi-Latn"]);
  });
});
