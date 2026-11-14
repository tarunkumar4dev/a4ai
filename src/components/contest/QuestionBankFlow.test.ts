// The Contest from PDF tab, rendered at its review step with the canned 50-question paper (contestImportMock):
// the existing "Create contest" action is still there and behaves as before, and the two new actions save the
// reviewed questions as a question bank and build a paper from that bank. The backend calls are mocked; what is
// checked is what the UI sends and shows.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockImportJob } from "@/lib/contestImportMock";
import type { BankQuestion, BankQuestionPayload } from "@/lib/questionBankApi";

const createBank = vi.fn();
const listBanks = vi.fn();
const getBankQuestions = vi.fn();
const buildPaper = vi.fn();
const downloadBlob = vi.fn();
const contestModal = vi.fn();

vi.mock("@/lib/questionBankApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/questionBankApi")>()),
  createBank: (...a: unknown[]) => createBank(...a),
  listBanks: (...a: unknown[]) => listBanks(...a),
  getBankQuestions: (...a: unknown[]) => getBankQuestions(...a),
  buildPaper: (...a: unknown[]) => buildPaper(...a),
  downloadBlob: (...a: unknown[]) => downloadBlob(...a),
}));
vi.mock("@/providers/AuthProvider", () => {
  const auth = { role: "teacher", session: { user: { id: "u1" } } };
  return { useAuth: () => auth };
});
vi.mock("@/hooks/useGuestAccess", () => {
  const guest = { gateAction: () => true, showLoginModal: false, setShowLoginModal: () => {} };
  return { useGuestAccess: () => guest };
});
vi.mock("@/components/MathText", () => ({ default: ({ text }: { text: string }) => text }));
vi.mock("@/components/LoginModal", () => ({ default: () => null }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
vi.mock("./CreateContestModal", () => ({ CreateContestModal: (props: unknown) => { contestModal(props); return null; } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn(), message: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORE_KEY = "a4ai_contest_pdf_import";
const BANK = { id: "bank-1", name: "Foreign Exchange Rate", source_filename: "eco.pdf", status: "ready", subject: "Economics", class_grade: "XII", board: null, created_at: "2026-11-14T10:00:00Z", warnings: [], can_edit: true, question_count: 50 };

describe("Contest from PDF → question bank → paper (rendered)", { timeout: 60000 }, () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: BankQuestion[] = [];

  beforeEach(async () => {
    const job = await mockImportJob("mock-ok-1");
    const { questions, warnings: _w, ...meta } = job.result!;
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      storagePath: "mock/contest-imports/x.pdf", fileName: "eco.pdf", jobId: "mock-ok-0",
      draft: { meta: { ...meta, warnings: [] }, items: questions.map((q, i) => ({ uid: `q${i}`, q: { ...q, correct_answer: q.correct_answer || "" }, warnings: [], checked: false, edited: false })) },
    }));
    saved = [];
    [createBank, listBanks, getBankQuestions, buildPaper, downloadBlob, contestModal].forEach((m) => m.mockReset());
    listBanks.mockImplementation(async () => ({ banks: saved.length ? [BANK] : [], max_banks: 50 }));
    createBank.mockImplementation(async (body: { questions: BankQuestionPayload[] }) => {
      saved = body.questions.map((q, i) => ({
        id: `bq${i}`, position: i + 1, qtype: "mcq", question_text: q.question_text, options: q.options,
        answer: q.answer_source === "ai" ? null : q.correct_answer, answer_source: q.correct_answer && q.answer_source !== "ai" ? "key" : null,
        marks: q.marks, exam_year: null, source_tag: null, needs_review: !q.usable || !q.correct_answer || q.answer_source === "ai", excluded: false,
      }));
      return { bank: BANK, stats: { saved: saved.length }, warnings: ["1 answer guessed by AI was not saved."] };
    });
    getBankQuestions.mockImplementation(async () => ({ bank: BANK, questions: saved }));
    buildPaper.mockResolvedValue({ blob: new Blob(["%PDF"]), fileName: "Foreign_Exchange_Rate.pdf",
      meta: { test_id: "t1", saved_to_history: true, questions: 10, total_marks: 10, answers_found: 10, answers_missing: 0, answer_key_included: true } });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    Element.prototype.scrollIntoView = vi.fn();
    const { default: ImportContestFromPdf } = await import("./ImportContestFromPdf");
    await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(ImportContestFromPdf))); });
  }, 60000);
  afterEach(() => { act(() => root.unmount()); host.remove(); sessionStorage.clear(); });

  const all = () => Array.from(document.body.querySelectorAll("button"));
  const button = (starts: string) => all().find((b) => (b.textContent || "").trim().startsWith(starts))!;
  const exact = (label: string) => all().find((b) => (b.textContent || "").trim() === label)!;
  const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const click = async (el: HTMLElement) => { await act(async () => { el.click(); }); await act(async () => { await Promise.resolve(); }); };

  it("keeps the existing Create contest action as it was", async () => {
    const create = button("Create contest");
    expect(create.textContent?.trim()).toBe("Create contest · 50 questions (1 unchecked)");
    expect(create.disabled).toBe(true);                               // Q33 must be fixed, Q49 has no answer
    expect(host.textContent).toContain("1 question needs fixing. 1 question has no correct answer.");
    expect(host.textContent).toContain("Also save as test in my history");
    expect(createBank).not.toHaveBeenCalled();
    expect(contestModal).not.toHaveBeenCalled();
  });

  it("shows the empty state of My question banks", async () => {
    expect(listBanks).toHaveBeenCalledTimes(1);
    expect(byTestId("banks-empty").textContent).toContain("No question banks yet");
  });

  it("Save as Question Bank sends the reviewed questions, never an unconfirmed AI answer as confirmed", async () => {
    await click(byTestId("save-as-bank"));
    expect(byTestId("bank-name")).toBeTruthy();
    expect((byTestId("bank-name") as HTMLInputElement).value).toContain("Foreign Exchange Rate");
    await click(exact("Save"));

    expect(createBank).toHaveBeenCalledTimes(1);
    const body = createBank.mock.calls[0][0];
    expect(body.questions).toHaveLength(50);
    expect(body.subject).toBe("Economics");
    expect(body.source_filename).toBe("eco.pdf");
    expect(JSON.stringify(body)).not.toMatch(/teacher_id|owner_id|user_id/);
    const q = (n: number) => body.questions[n - 1] as BankQuestionPayload;
    expect([q(1).answer_source, q(1).correct_answer, q(1).usable]).toEqual(["key", "A", true]);
    expect(q(47).answer_source).toBe("ai");                           // guessed, not confirmed → backend drops it
    expect([q(49).answer_source, q(49).correct_answer]).toEqual(["missing", null]);
    expect(q(33).usable).toBe(false);

    expect(byTestId("save-as-bank").textContent).toContain("Saved as question bank");
    expect(listBanks).toHaveBeenCalledTimes(2);                       // the list reloaded
    expect(document.body.querySelectorAll('[data-testid="bank-row"]')).toHaveLength(1);
    expect(button("Create contest").textContent?.trim()).toBe("Create contest · 50 questions (1 unchecked)");   // untouched
  });

  it("Build paper from these questions saves the bank, opens the dialog and downloads the file", async () => {
    await click(byTestId("build-from-these"));
    await click(exact("Save"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(createBank).toHaveBeenCalledTimes(1);
    expect(getBankQuestions).toHaveBeenCalledWith("bank-1");
    expect(document.getElementById("build-paper-title")?.textContent).toBe("Build paper");
    // 47 usable MCQs: Q33 (unreadable), Q47 (AI guess dropped) and Q49 (no answer) need review
    expect(document.body.textContent).toContain("47 MCQ");

    await click(button("Download PDF"));
    expect(buildPaper).toHaveBeenCalledTimes(1);
    const [bankId, body] = buildPaper.mock.calls[0];
    expect(bankId).toBe("bank-1");
    expect(body).toMatchObject({ sections: [{ qtype: "mcq", count: 10, marks_each: 1 }], include_answer_key: true, template: "modern", format: "pdf", shuffle: false, allow_needs_review: false });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(byTestId("paper-done").textContent).toContain("10 questions, 10 marks");
  });

  it("asks for more questions than the bank has → the reason is shown and nothing is sent", async () => {
    await click(byTestId("build-from-these"));
    await click(exact("Save"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const count = byTestId("section-0").querySelectorAll("input")[0] as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(count, "60");
      count.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(byTestId("paper-problems").textContent).toBe("Section A needs 60 MCQ questions, bank has 47.");
    expect(button("Download PDF").disabled).toBe(true);
    expect(buildPaper).not.toHaveBeenCalled();
  });
});
