import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contestApi", () => ({
  getAuthHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer t" }),
  errorFromResponse: async (res: Response, fallback: string) => {
    const body = await res.json().catch(() => ({}));
    return new Error(typeof body?.detail === "string" ? body.detail : `${fallback} (${res.status})`);
  },
}));

import {
  QuestionBankError, availableByType, buildPaper, createBank, defaultSections, hasIndicText, paperFileName, paperTotals,
  parsePaperMeta, sectionProblems, toBankQuestions, type BankQuestion,
} from "@/lib/questionBankApi";
import type { ImportedQuestion } from "@/lib/contestImportApi";

const imported = (over: Partial<ImportedQuestion> = {}): ImportedQuestion => ({
  question_text: "What is money?", question_type: "MCQ",
  options: [{ label: "A", text: "Cash" }, { label: "B", text: "A medium of exchange" }],
  correct_answer: "B", explanation: "", marks: 1, difficulty: "Medium", chapter: "", source_number: 3, answer_source: "key", usable: true,
  ...over,
});

const bq = (over: Partial<BankQuestion>): BankQuestion => ({
  id: Math.random().toString(36), position: 1, qtype: "mcq", question_text: "Q", options: [], answer: "A", answer_source: "key",
  marks: 1, exam_year: null, source_tag: null, needs_review: false, excluded: false, ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("toBankQuestions", () => {
  it("keeps a key answer, and never sends a user id or the parser's extra fields", () => {
    const [q] = toBankQuestions([{ q: imported(), confirmed: false, usable: true }]);
    expect(q).toEqual({
      question_text: "What is money?", question_type: "MCQ",
      options: [{ label: "A", text: "Cash" }, { label: "B", text: "A medium of exchange" }],
      correct_answer: "B", answer_source: "key", marks: 1, usable: true, source_number: 3,
    });
  });
  it("sends an unconfirmed AI guess as 'ai' (the backend drops it) and a confirmed one as 'teacher'", () => {
    const ai = imported({ answer_source: "ai" });
    expect(toBankQuestions([{ q: ai, confirmed: false, usable: true }])[0].answer_source).toBe("ai");
    expect(toBankQuestions([{ q: ai, confirmed: true, usable: true }])[0].answer_source).toBe("teacher");
  });
  it("sends no answer as missing / null, and a typed answer as 'teacher'", () => {
    const none = toBankQuestions([{ q: imported({ correct_answer: "  ", answer_source: "missing" }), confirmed: false, usable: true }])[0];
    expect([none.correct_answer, none.answer_source]).toEqual([null, "missing"]);
    const typed = toBankQuestions([{ q: imported({ correct_answer: "A", answer_source: "missing" }), confirmed: false, usable: true }])[0];
    expect(typed.answer_source).toBe("teacher");
  });
  it("drops empty options, bad marks and a non-numeric source number; passes usable through", () => {
    const [q] = toBankQuestions([{
      q: imported({ options: [{ label: "A", text: "x" }, { label: "B", text: "  " }], marks: 0 as any, source_number: "Q7" as any }),
      confirmed: false, usable: false,
    }]);
    expect(q.options).toEqual([{ label: "A", text: "x" }]);
    expect([q.marks, q.source_number, q.usable]).toEqual([null, null, false]);
  });
});

describe("sections", () => {
  const questions = [
    ...Array.from({ length: 6 }, (_, i) => bq({ qtype: "mcq", exam_year: i < 2 ? 2023 : null })),
    bq({ qtype: "mcq", needs_review: true }), bq({ qtype: "mcq", excluded: true }),
    bq({ qtype: "long" }), bq({ qtype: "long" }),
  ];
  it("counts what a paper may use", () => {
    expect(availableByType(questions)).toEqual({ mcq: 6, true_false: 0, short: 0, long: 2 });
    expect(availableByType(questions, { allowNeedsReview: true }).mcq).toBe(7);
    expect(availableByType(questions, { year: 2023 })).toEqual({ mcq: 2, true_false: 0, short: 0, long: 0 });
  });
  it("starts with one section per type the bank has", () => {
    expect(defaultSections(availableByType(questions))).toEqual([
      { qtype: "mcq", count: 6, marks_each: 1 }, { qtype: "long", count: 2, marks_each: 5 },
    ]);
    expect(defaultSections({ mcq: 0, true_false: 0, short: 0, long: 0 })).toEqual([]);
  });
  it("says which section the bank cannot fill", () => {
    const available = availableByType(questions);
    expect(sectionProblems([{ qtype: "mcq", count: 6, marks_each: 1 }], available)).toEqual([]);
    expect(sectionProblems([{ qtype: "mcq", count: 10, marks_each: 1 }, { qtype: "true_false", count: 1, marks_each: 1 }], available))
      .toEqual(["Section A needs 10 MCQ questions, bank has 6.", "Section B needs 1 True / False question, bank has 0."]);
    // two sections of one type share the same questions
    expect(sectionProblems([{ qtype: "mcq", count: 4, marks_each: 1 }, { qtype: "mcq", count: 3, marks_each: 2 }], available))
      .toEqual(["Section B needs 3 MCQ questions, bank has 2."]);
    expect(sectionProblems([{ qtype: "mcq", count: 0, marks_each: 1 }], available)).toEqual(["Section A: enter how many questions."]);
    expect(sectionProblems([{ qtype: "mcq", count: 1, marks_each: 0 }], available)).toEqual(["Section A: enter the marks per question."]);
  });
  it("adds up the paper", () => {
    expect(paperTotals([{ qtype: "mcq", count: 10, marks_each: 1 }, { qtype: "long", count: 2, marks_each: 5 }])).toEqual({ questions: 12, marks: 20 });
  });
});

describe("small helpers", () => {
  it("detects Hindi text", () => {
    expect(hasIndicText(["What is money?", "₹ 500 — $5"])).toBe(false);
    expect(hasIndicText(["What is money?", "व्यवसाय क्या है?"])).toBe(true);
  });
  it("makes a safe file name", () => {
    expect(paperFileName("../Unit Test: 1 (Eco)", "pdf")).toBe("Unit_Test_1_Eco.pdf");
    expect(paperFileName("अर्थशास्त्र", "docx")).toBe("question_paper.docx");
  });
  it("reads the paper header", () => {
    expect(parsePaperMeta('{"questions":7,"saved_to_history":true}')?.questions).toBe(7);
    expect(parsePaperMeta("not json")).toBeNull();
    expect(parsePaperMeta(null)).toBeNull();
  });
});

describe("api calls", () => {
  it("createBank posts the questions with the login token and no user id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ bank: { id: "b1", name: "Eco" }, stats: { saved: 1 }, warnings: [] }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await createBank({ name: "Eco", questions: toBankQuestions([{ q: imported(), confirmed: false, usable: true }]) });
    expect(res.bank.id).toBe("b1");
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toMatch(/\/api\/v1\/question-banks$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(["name", "questions"]);
    expect(JSON.stringify(body)).not.toMatch(/teacher_id|owner_id|user_id/);
  });
  it("shows the backend's message when the bank is too small", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Section A needs 10 MCQs, bank has 6." }), { status: 422 })));
    const err = await buildPaper("b1", { title: "T", sections: [], include_answer_key: true, template: "modern", shuffle: false, format: "pdf" }).catch((e) => e);
    expect(err).toBeInstanceOf(QuestionBankError);
    expect(err.message).toBe("Section A needs 10 MCQs, bank has 6.");
    expect(err.status).toBe(422);
  });
  it("returns the file and what the server says about it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["%PDF-1.4"]), {
      status: 200, headers: { "X-Paper-Meta": '{"questions":5,"total_marks":5,"answers_found":4,"answers_missing":1,"saved_to_history":true,"answer_key_included":true,"test_id":"t1"}' },
    })));
    const out = await buildPaper("b1", { title: "Unit Test 1", sections: [{ qtype: "mcq", count: 5, marks_each: 1 }], include_answer_key: true, template: "modern", shuffle: false, format: "pdf" });
    expect(out.fileName).toBe("Unit_Test_1.pdf");
    expect(out.blob.size).toBeGreaterThan(0);
    expect(out.meta?.answers_missing).toBe(1);
  });
  it("turns a network failure and a 401 into plain messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(createBank({ name: "x", questions: [] })).rejects.toThrow("No connection to the server");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(createBank({ name: "x", questions: [] })).rejects.toThrow("Please log in again.");
  });
});
