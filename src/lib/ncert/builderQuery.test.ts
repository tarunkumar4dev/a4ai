// Test Builder filters → request params (defaults left out, chosen values sent) and the PYQ row/facet helpers.
import { afterEach, describe, expect, it } from "vitest";
import {
  LANGUAGE_STORAGE_KEY,
  facetCount,
  groupByChapter,
  loadLanguagePref,
  paperMixesLanguages,
  parseFacets,
  pyqBadgeText,
  pyqNumberLabel,
  pyqPapersTitle,
  questionQueryString,
  rowLanguage,
  rowSource,
  saveLanguagePref,
  sortOptions,
  statsQueryString,
  typeLabel,
  typeOptions,
  type QuestionQuery,
} from "./builderQuery";

const base: QuestionQuery = {
  subject: "Political Science",
  classGrade: "12",
  chapter: "Accounting for Partnership: Basic Concepts",
  questionType: "all",
  search: "",
  figure: "all",
  source: "all",
  language: "en",
  year: null,
  difficulty: "all",
  marks: null,
  sort: "default",
};

/** What the builder sent before PYQs (TestBuilderPage questionsUrl). */
function legacyQuestionsQuery(
  subject: string,
  classGrade: string,
  chapter: string,
  questionType: string,
  search: string,
  offset: number,
  figure: string
): string {
  const params = new URLSearchParams({ subject, class_grade: classGrade, chapter, limit: "30", offset: String(offset) });
  if (questionType !== "all") params.set("question_type", questionType);
  if (search) params.set("search", search);
  if (figure !== "all") params.set("figure", figure);
  return params.toString();
}

describe("questionQueryString", () => {
  it("with every new filter at its default, is identical to the pre-PYQ request", () => {
    expect(questionQueryString(base, 0, 30)).toBe(
      legacyQuestionsQuery(base.subject, "12", base.chapter as string, "all", "", 0, "all")
    );
    const old = { ...base, questionType: "exercise", search: "goodwill & ratio", figure: "hide" as const };
    expect(questionQueryString(old, 60, 30)).toBe(
      legacyQuestionsQuery(base.subject, "12", base.chapter as string, "exercise", "goodwill & ratio", 60, "hide")
    );
  });

  it("leaves out every default", () => {
    const p = new URLSearchParams(questionQueryString(base, 0, 30));
    for (const k of ["source", "language", "year", "difficulty", "marks", "sort", "question_type", "search", "figure"]) {
      expect(p.has(k)).toBe(false);
    }
  });

  it("sends each chosen value", () => {
    const p = new URLSearchParams(
      questionQueryString(
        { ...base, source: "pyq", language: "hi", year: 2026, difficulty: "hard", marks: 6, sort: "marks_desc" },
        30,
        30
      )
    );
    expect(p.get("source")).toBe("pyq");
    expect(p.get("language")).toBe("hi");
    expect(p.get("year")).toBe("2026");
    expect(p.get("difficulty")).toBe("hard");
    expect(p.get("marks")).toBe("6");
    expect(p.get("sort")).toBe("marks_desc");
    expect(p.get("offset")).toBe("30");
  });

  it("sends source=ncert and language=all (they differ from the defaults)", () => {
    const p = new URLSearchParams(questionQueryString({ ...base, source: "ncert", language: "all" }, 0, 30));
    expect(p.get("source")).toBe("ncert");
    expect(p.get("language")).toBe("all");
  });

  it("All chapters: no chapter param", () => {
    const p = new URLSearchParams(questionQueryString({ ...base, chapter: null, sort: "chapter" }, 0, 30));
    expect(p.has("chapter")).toBe(false);
    expect(p.get("sort")).toBe("chapter");
  });
});

describe("statsQueryString", () => {
  it("defaults → the pre-PYQ request", () => {
    expect(statsQueryString("Political Science", "12", "all", "en")).toBe(
      `subject=${encodeURIComponent("Political Science")}&class_grade=12`
    );
  });
  it("sends source and language when chosen", () => {
    expect(statsQueryString("Accountancy", "12", "pyq", "hi")).toBe(
      "subject=Accountancy&class_grade=12&source=pyq&language=hi"
    );
    expect(statsQueryString("Accountancy", "12", "ncert", "all")).toBe(
      "subject=Accountancy&class_grade=12&source=ncert&language=all"
    );
  });
});

describe("parseFacets", () => {
  it("older backend (no facets) → null", () => {
    for (const raw of [undefined, null, 7, "x", []]) expect(parseFacets(raw)).toBeNull();
  });
  it("keeps valid entries, coerces numbers, sorts years newest first and marks ascending", () => {
    const f = parseFacets({
      sources: [{ name: "ncert", count: 900 }, { name: "pyq", count: 120 }, { name: 3, count: 1 }],
      languages: [{ name: "en", count: 960 }, { name: "hi", count: 60 }],
      years: [{ name: 2025, count: 4 }, { name: "2026", count: 50 }, { name: null, count: 2 }],
      difficulties: [{ name: "easy", count: 10 }, "junk"],
      marks: [{ name: 6, count: 8 }, { name: 1, count: 40 }, { name: 3, count: "12" }],
    });
    expect(f).not.toBeNull();
    expect(f!.sources).toEqual([{ name: "ncert", count: 900 }, { name: "pyq", count: 120 }]);
    expect(f!.years.map((y) => y.name)).toEqual([2026, 2025]);
    expect(f!.marks.map((m) => m.name)).toEqual([1, 3, 6]);
    expect(f!.difficulties).toEqual([{ name: "easy", count: 10 }]);
    expect(facetCount(f!.sources, "pyq")).toBe(120);
    expect(facetCount(f!.languages, "hi")).toBe(60);
  });
  it("missing lists → empty lists", () => {
    const f = parseFacets({});
    expect(f).toEqual({ sources: [], languages: [], years: [], difficulties: [], marks: [] });
    expect(facetCount(f!.sources, "pyq")).toBe(0);
    expect(facetCount(undefined, "pyq")).toBe(0);
  });
});

describe("row helpers", () => {
  it("a row without source is NCERT, without language is English", () => {
    expect(rowSource({})).toBe("ncert");
    expect(rowSource({ source: null })).toBe("ncert");
    expect(rowSource({ source: "pyq" })).toBe("pyq");
    expect(rowLanguage({})).toBe("en");
    expect(rowLanguage({ language: null })).toBe("en");
    expect(rowLanguage({ language: "hi" })).toBe("hi");
  });
  it("PYQ numbering, badge and tooltip", () => {
    expect(pyqNumberLabel("7(a)")).toBe("Q7(a)");
    expect(pyqNumberLabel("Q23(iv)")).toBe("Q23(iv)");
    expect(pyqNumberLabel("")).toBeNull();
    expect(pyqNumberLabel(null)).toBeNull();
    expect(pyqBadgeText({ source: "pyq", pyq_exam: "CBSE", pyq_year: 2026 })).toBe("PYQ · CBSE 2026");
    expect(pyqBadgeText({ source: "pyq", pyq_year: 2026 })).toBe("PYQ · 2026");
    expect(pyqBadgeText({ source: "pyq" })).toBe("PYQ");
    expect(pyqPapersTitle({ pyq_papers: ["67/5/1", "67/5/2"] })).toBe("Q.P. 67/5/1, 67/5/2");
    expect(pyqPapersTitle({ pyq_papers: null })).toBeUndefined();
  });
  it("detects a paper that mixes English and Hindi", () => {
    expect(paperMixesLanguages([])).toBe(false);
    expect(paperMixesLanguages([{}, { language: "en" }])).toBe(false);
    expect(paperMixesLanguages([{ language: "hi" }, { language: "hi" }])).toBe(false);
    expect(paperMixesLanguages([{ language: null }, { language: "hi" }])).toBe(true);
  });
});

describe("labels", () => {
  it("new PYQ types read well; unknown types are title-cased", () => {
    expect(typeLabel("assertion_reason")).toBe("Assertion–Reason");
    expect(typeLabel("short_answer")).toBe("Short Answer");
    expect(typeLabel("long_answer")).toBe("Long Answer");
    expect(typeLabel("case_study")).toBe("Case Study");
    expect(typeLabel("case_based-mcq")).toBe("Case Based Mcq");
    expect(typeLabel("")).toBe("Question");
    expect(typeLabel(undefined)).toBe("Question");
  });
  it("type dropdown: base list first, extras after, current value always present, no duplicates", () => {
    const opts = typeOptions(["exercise", "case_study", "weird_one"], "long_answer");
    const values = opts.map((o) => o.value);
    expect(values.slice(0, 7)).toEqual(["all", "exercise", "example", "intext", "activity", "hots", "diagram"]);
    expect(values.slice(7)).toEqual(["case_study", "weird_one", "long_answer"]);
    expect(opts.find((o) => o.value === "weird_one")!.label).toBe("Weird One");
    expect(typeOptions([], "all").map((o) => o.value)).toHaveLength(7);
  });
  it("Newest year only while PYQs are in view", () => {
    expect(sortOptions(false).map((o) => o.value)).not.toContain("year_desc");
    expect(sortOptions(true).map((o) => o.value)).toContain("year_desc");
  });
});

describe("language preference", () => {
  afterEach(() => localStorage.clear());
  it("defaults to English and remembers a choice", () => {
    expect(loadLanguagePref()).toBe("en");
    saveLanguagePref("hi");
    expect(loadLanguagePref()).toBe("hi");
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(loadLanguagePref()).toBe("en");
  });
});

describe("groupByChapter", () => {
  it("groups consecutive runs in list order", () => {
    const g = groupByChapter([{ chapter: "A" }, { chapter: "A" }, { chapter: "B" }, { chapter: null }]);
    expect(g.map((x) => [x.chapter, x.rows.length])).toEqual([["A", 2], ["B", 1], ["Other", 1]]);
  });
});
