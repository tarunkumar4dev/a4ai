import { describe, expect, it } from "vitest";
import { fileErrorText, rejectText, warningText } from "../messages";
import { fmtLeft } from "../time";
import { stateMessage } from "@/lib/uploadFlow";

describe("server codes → plain English", () => {
  it("file errors name the page", () => {
    expect(fileErrorText({ code: "too_large", index: 3 }, 10)).toBe("Page 3 is too large (max 10 MB).");
    expect(fileErrorText({ code: "not_uploaded", index: 1 })).toBe("Page 1 didn't finish uploading. Tap Submit to upload it again.");
    expect(fileErrorText({ code: "no_files" })).toBe("Add at least one page.");
    expect(fileErrorText({ code: "something_new", index: 2, message: "Page 2 kuch galat" })).toBe("Page 2 can't be used. Add it again.");
  });

  it("warnings", () => {
    expect(warningText({ code: "same_as_earlier_upload", page_order: 1 })).toBe("Page 1 is the same file as an earlier upload.");
  });

  it("reject reasons never show the server's own wording", () => {
    expect(rejectText({ code: "bad_file", message: "Page 1 padhi nahi ja saki", page_order: 1 }))
      .toBe("Page 1: this file couldn't be read. Upload a clear photo or PDF.");
    expect(rejectText({ code: "needs_pass", page_order: 2 })).toBe("Page 2: this PDF has a password. Upload one without a password.");
    expect(rejectText({ code: "blank_page" })).toBe("the page looks blank. Upload a clear photo.");
  });

  it("access-code and link states", () => {
    expect(stateMessage({ state: "invalid_code" })).toBe("Wrong access code. Check with your teacher.");
    expect(stateMessage({ state: "locked", scope: "ip" })).toBe("Too many wrong codes from this network. Try again in {countdown}.");
  });

  it("countdowns read naturally", () => {
    expect(fmtLeft((2 * 86400 + 10 * 3600) * 1000)).toBe("2 days 10 hours");
    expect(fmtLeft((86400 + 3600) * 1000)).toBe("1 day 1 hour");
    expect(fmtLeft((3 * 3600 + 5 * 60) * 1000)).toBe("3 hours 5 min");
    expect(fmtLeft(42_000)).toBe("42 sec");
  });
});
