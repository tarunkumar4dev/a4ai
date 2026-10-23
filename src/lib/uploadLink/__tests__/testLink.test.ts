import { describe, expect, it, vi } from "vitest";
import { type LinkDeps, createOrReuseCheckingLink, defaultDeadlineIST, keyCoverage, submissionsHref } from "../testLink";

describe("default deadline = today (IST) + 2 days, 11:59 PM IST", () => {
  it.each([
    ["afternoon IST", "2026-10-23T10:00:00Z", "2026-10-25T18:29:00.000Z"],          // 23 Oct 3:30 PM IST → 25 Oct
    ["after midnight IST, still 'yesterday' in UTC", "2026-10-23T20:00:00Z", "2026-10-26T18:29:00.000Z"],  // 24 Oct 1:30 AM IST
    ["month boundary", "2026-10-30T19:00:00Z", "2026-11-02T18:29:00.000Z"],         // 31 Oct 12:30 AM IST → 2 Nov
    ["year boundary", "2026-12-30T12:00:00Z", "2027-01-01T18:29:00.000Z"],
  ])("%s", (_label, now, expected) => {
    expect(defaultDeadlineIST(new Date(now))).toBe(expected);
  });

  it("shows as 11:59 PM in IST", () => {
    const s = new Date(defaultDeadlineIST(new Date("2026-10-23T10:00:00Z")))
      .toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
    expect(s.toLowerCase().replace(/\s/g, " ")).toBe("11:59 pm");
  });
});

describe("answer key coverage", () => {
  it("counts correct answer, model answer or marking scheme", () => {
    expect(keyCoverage([
      { correct_answer: "B" }, { model_answer: "Because …" }, { marking_scheme: [{ point: "x", marks: 1 }] },
      { correct_answer: "  " }, { marking_scheme: [] }, {},
    ])).toEqual({ total: 6, withKey: 3, empty: false });
  });
  it("is empty when no question has anything to check against", () => {
    expect(keyCoverage([{ correct_answer: "" }, { model_answer: null }]).empty).toBe(true);
  });
});

function fakeDeps(over: Partial<LinkDeps> = {}) {
  const deps: LinkDeps = {
    findAssignment: vi.fn(async () => null),
    insertAssignment: vi.fn(async () => ({ id: "asg-new", file_url: null, link_token: "tok-new", has_key: false })),
    setPaper: vi.fn(async () => undefined),
    uploadPaper: vi.fn(async (_f: string, _b: Blob, name: string) => ({ url: `https://x/${name}`, name })),
    attachKey: vi.fn(async () => undefined),
    fetchQuestions: vi.fn(async () => [{ text: "Q1", correct_answer: "B", marks: 1 }, { text: "Q2", model_answer: "…", marks: 2 }]),
    exportPdf: vi.fn(async (_m, _q, isKey: boolean) => new Blob([isKey ? "key" : "paper"], { type: "application/pdf" })),
    saveSettings: vi.fn(async () => undefined),
    ...over,
  };
  return deps;
}

const input = {
  test: { id: "test-1", title: "Physics Unit Test 2", subject: "Physics", class_grade: "Class 12", total_marks: 40 },
  userId: "teacher-1", instituteId: "inst-1",
  choice: {
    batchId: "batch-1", deadline: "2026-10-25T18:29:00.000Z",
    settings: { max_attempts: 2, late_policy: "accept_flag" as const, auto_publish: false, max_mb: 10, max_pages: 30,
                allowed_mimes: ["application/pdf", "image/jpeg"], count_policy: "latest" as const },
  },
};

describe("createOrReuseCheckingLink", () => {
  it("reuses the class's existing assignment for this test (no second assignment, paper/key kept)", async () => {
    const deps = fakeDeps({
      findAssignment: vi.fn(async () => ({ id: "asg-old", file_url: "https://x/paper.pdf", link_token: "tok-old", has_key: true })),
    });
    const r = await createOrReuseCheckingLink(input, deps);
    expect(r).toEqual({ assignmentId: "asg-old", token: "tok-old", reused: true, keyMissing: false });
    expect(deps.findAssignment).toHaveBeenCalledWith("test-1", "batch-1");
    expect(deps.insertAssignment).not.toHaveBeenCalled();
    expect(deps.uploadPaper).not.toHaveBeenCalled();
    expect(deps.attachKey).not.toHaveBeenCalled();                 // no new key version for an unchanged test
    expect(deps.saveSettings).toHaveBeenCalledWith("asg-old", expect.objectContaining({
      upload_link_enabled: true, status: "active", deadline: input.choice.deadline, max_attempts: 2, late_policy: "accept_flag",
    }));
  });

  it("fills in what a reused assignment is missing (paper, key)", async () => {
    const deps = fakeDeps({ findAssignment: vi.fn(async () => ({ id: "asg-old", file_url: null, link_token: "tok-old", has_key: false })) });
    await createOrReuseCheckingLink(input, deps);
    expect(deps.insertAssignment).not.toHaveBeenCalled();
    expect(deps.setPaper).toHaveBeenCalledWith("asg-old", "https://x/Physics_Unit_Test_2.pdf", "Physics_Unit_Test_2.pdf");
    expect(deps.attachKey).toHaveBeenCalledWith("asg-old", "teacher-1", expect.any(Blob), "Physics_Unit_Test_2_AnswerKey.pdf");
  });

  it("creates the assignment for a new class with the test link, paper and key", async () => {
    const deps = fakeDeps();
    const r = await createOrReuseCheckingLink(input, deps);
    expect(r).toEqual({ assignmentId: "asg-new", token: "tok-new", reused: false, keyMissing: false });
    expect(deps.insertAssignment).toHaveBeenCalledWith(expect.objectContaining({
      test_id: "test-1", batch_id: "batch-1", institute_id: "inst-1", created_by: "teacher-1", status: "active",
      title: "Physics Unit Test 2", max_marks: 40, deadline: input.choice.deadline,
    }));
    expect(deps.exportPdf).toHaveBeenCalledTimes(2);                 // paper + key
    expect(deps.uploadPaper).toHaveBeenCalledWith("inst-1", expect.any(Blob), "Physics_Unit_Test_2.pdf");
    expect(deps.attachKey).toHaveBeenCalledOnce();
  });

  it("still makes the link without a key, and says so", async () => {
    const deps = fakeDeps({ fetchQuestions: vi.fn(async () => [{ text: "Q1", correct_answer: "" }]) });
    const r = await createOrReuseCheckingLink(input, deps);
    expect(r.keyMissing).toBe(true);
    expect(deps.attachKey).not.toHaveBeenCalled();
    expect(deps.saveSettings).toHaveBeenCalled();
  });

  it("refuses a test whose questions were never saved", async () => {
    const deps = fakeDeps({ fetchQuestions: vi.fn(async () => []) });
    await expect(createOrReuseCheckingLink(input, deps)).rejects.toThrow("Save the test first");
    expect(deps.insertAssignment).not.toHaveBeenCalled();
  });

  it("'View submissions' opens the assignment's Copy Submissions tab", () => {
    expect(submissionsHref("asg-1")).toBe("/dashboard?tab=assignments&assignment=asg-1&view=copies");
  });
});
