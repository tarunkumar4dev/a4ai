import { describe, expect, it, vi } from "vitest";
import { ImportError, answerLabel, retryImport, warningText } from "@/lib/contestImportApi";
import { mockImportJob } from "@/lib/contestImportMock";

const opts = [{ label: "A", text: "Gold" }, { label: "B", text: "Silver" }, { label: "C", text: "Iron" }, { label: "D", text: "Tin" }];

describe("answerLabel", () => {
  it("reads bare, bracketed and label+text answers", () => {
    expect(answerLabel("B", opts)).toBe("B");
    expect(answerLabel("(c)", opts)).toBe("C");
    expect(answerLabel("D) Tin", opts)).toBe("D");
    expect(answerLabel("a. Gold", opts)).toBe("A");
  });
  it("falls back to option text, else null", () => {
    expect(answerLabel(" silver ", opts)).toBe("B");
    expect(answerLabel("", opts)).toBeNull();
    expect(answerLabel("Copper", opts)).toBeNull();
  });
});

describe("warningText", () => {
  it("maps known codes and keeps the backend message as detail", () => {
    expect(warningText({ question: 3, code: "KEY_MISMATCH_SUSPECT", message: "Key says D" }))
      .toEqual({ title: "AI thinks the key may be wrong", detail: "Key says D" });
    expect(warningText({ question: null, code: "KEY_CHECK_SKIPPED", message: "" }).title).toBe("Answer double-check was skipped");
    expect(warningText({ question: 1, code: "KEY_GRID_MISMATCH", message: "" }).title).toBe(warningText({ question: 1, code: "KEY_TEXT_MISMATCH", message: "" }).title);
  });
  it("falls back to the message for unknown codes", () => {
    expect(warningText({ question: null, code: "NEW_THING", message: "Something odd" })).toEqual({ title: "Something odd", detail: null });
  });
});

describe("mock import job", () => {
  const ago = (s: number) => Date.now() - s * 1000;
  it("finishes with the real result shape: 50 MCQs, Easy 1-10 / Medium 11-40 / Hard 41-50", () => {
    const job = mockImportJob(`mock-ok-${ago(60)}`);
    expect(job.status).toBe("done");
    const r = job.result!;
    expect(r.questions).toHaveLength(50);
    expect([r.class_grade, r.subject, r.board, r.duration_minutes, r.total_marks]).toEqual(["XII", "Economics", "CBSE", 60, 50]);
    expect(r.questions[9].difficulty).toBe("Easy");
    expect(r.questions[10].difficulty).toBe("Medium");
    expect(r.questions[40].difficulty).toBe("Hard");
    expect(r.questions.every((q) => typeof q.usable === "boolean")).toBe(true);
    expect(r.questions.filter((q) => q.usable === false).map((q) => q.source_number)).toEqual([33]);
    expect(r.questions[0].correct_answer).toMatch(/^[A-D]$/);
    expect(r.warnings.find((w) => w.question === null)?.code).toBe("KEY_CHECK_SKIPPED");
  });
  it("queues first, and the fail modes fail with the right retryable flag", () => {
    expect(mockImportJob(`mock-ok-${Date.now()}`).status).toBe("queued");
    expect(mockImportJob(`mock-fail-${ago(5)}`)).toMatchObject({ status: "failed", retryable: true });
    expect(mockImportJob(`mock-fatal-${ago(5)}`)).toMatchObject({ status: "failed", retryable: false });
  });
});

describe("retryImport (Try again)", () => {
  const pdf = new File(["%PDF-1.4"], "paper.pdf", { type: "application/pdf" });
  const gone = () => new ImportError("This file couldn't be used (file not found). Please upload it again.", "BAD_PATH");

  it("re-POSTs the same path first, without uploading", async () => {
    const start = vi.fn().mockResolvedValue("job-2");
    const upload = vi.fn();
    expect(await retryImport("u/contest-imports/a.pdf", pdf, { start, upload })).toEqual({ jobId: "job-2", path: "u/contest-imports/a.pdf", reuploaded: false });
    expect(start).toHaveBeenCalledWith("u/contest-imports/a.pdf");
    expect(upload).not.toHaveBeenCalled();
  });

  it("file gone (400/404) + File in memory → uploads to a NEW path and POSTs that", async () => {
    const start = vi.fn().mockRejectedValueOnce(gone()).mockResolvedValueOnce("job-3");
    const upload = vi.fn().mockResolvedValue("u/contest-imports/b.pdf");
    expect(await retryImport("u/contest-imports/a.pdf", pdf, { start, upload })).toEqual({ jobId: "job-3", path: "u/contest-imports/b.pdf", reuploaded: true });
    expect(upload).toHaveBeenCalledWith(pdf);
    expect(start.mock.calls).toEqual([["u/contest-imports/a.pdf"], ["u/contest-imports/b.pdf"]]);
  });

  it("file gone + no File (page was refreshed) → asks for the file again", async () => {
    const start = vi.fn().mockRejectedValue(gone());
    const upload = vi.fn();
    expect(await retryImport("u/contest-imports/a.pdf", null, { start, upload })).toEqual({ needFile: true });
    expect(upload).not.toHaveBeenCalled();
  });

  it("other errors (daily limit) are not swallowed", async () => {
    const start = vi.fn().mockRejectedValue(new ImportError("You've reached today's import limit, try again tomorrow.", "LIMIT"));
    await expect(retryImport("p", pdf, { start, upload: vi.fn() })).rejects.toMatchObject({ kind: "LIMIT" });
  });
});
