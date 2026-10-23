import { describe, expect, it, beforeEach } from "vitest";
import { attemptKey, clearAttemptKey } from "@/lib/uploadFlow";
import {
  type DraftItem, cleanCode, clearCode, clearDraft, loadCode, loadDraft, pendingUploads, resumeItems, saveCode, saveDraft,
  totalPages,
} from "../session";

const item = (id: string, path: string | null, pages = 1): DraftItem => ({
  id, name: `${id}.jpg`, mime: "image/jpeg", ext: "jpg", size: 1000, sha256: id.padEnd(64, "0"), pages, warning: null, path,
});

beforeEach(() => localStorage.clear());

describe("idempotency key (one per attempt)", () => {
  it("is created once and reused on every retry / refresh", () => {
    const k1 = attemptKey("asg-1", "ABCD2345");
    expect(k1).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(attemptKey("asg-1", "ABCD2345")).toBe(k1);              // retry
    expect(localStorage.getItem("a4ai_upload_key_asg-1_ABCD2345")).toBe(k1);  // survives a refresh
  });

  it("is separate per assignment and per access code", () => {
    const a = attemptKey("asg-1", "ABCD2345");
    expect(attemptKey("asg-2", "ABCD2345")).not.toBe(a);
    expect(attemptKey("asg-1", "WXYZ6789")).not.toBe(a);
  });

  it("is replaced only after the server accepted the attempt", () => {
    const a = attemptKey("asg-1", "ABCD2345");
    clearAttemptKey("asg-1", "ABCD2345");
    expect(attemptKey("asg-1", "ABCD2345")).not.toBe(a);
  });

  it("ignores a corrupt stored key", () => {
    localStorage.setItem("a4ai_upload_key_asg-1_ABCD2345", "bad key!");
    expect(attemptKey("asg-1", "ABCD2345")).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });
});

describe("resume after a drop / refresh", () => {
  it("keeps the draft per assignment + code", () => {
    saveDraft("asg-1", "ABCD2345", [item("a", "p/a.jpg"), item("b", null)]);
    expect(loadDraft("asg-1", "ABCD2345").map(i => i.id)).toEqual(["a", "b"]);
    expect(loadDraft("asg-1", "WXYZ6789")).toEqual([]);
  });

  it("uploads only the pages that are not in Storage yet", () => {
    const items = [item("a", "p/a.jpg"), item("b", null), item("c", null)];
    expect(pendingUploads(items).map(i => i.id)).toEqual(["b", "c"]);
  });

  it("drops pages whose blob is gone, keeps uploaded ones even without a blob", () => {
    const items = [item("a", "p/a.jpg"), item("b", null), item("c", null)];
    const { kept, lost } = resumeItems(items, id => id === "c");
    expect(kept.map(i => i.id)).toEqual(["a", "c"]);
    expect(lost).toBe(1);
  });

  it("clears the draft after submit (and an empty save removes it)", () => {
    saveDraft("asg-1", "ABCD2345", [item("a", null)]);
    clearDraft("asg-1", "ABCD2345");
    expect(loadDraft("asg-1", "ABCD2345")).toEqual([]);
    saveDraft("asg-1", "ABCD2345", []);
    expect(localStorage.getItem("a4ai_upload_draft_asg-1_ABCD2345")).toBeNull();
  });

  it("survives a corrupt draft", () => {
    localStorage.setItem("a4ai_upload_draft_asg-1_ABCD2345", "{not json");
    expect(loadDraft("asg-1", "ABCD2345")).toEqual([]);
  });

  it("counts PDF pages in the page total", () => {
    expect(totalPages([item("a", null), item("b", null, 7)])).toBe(8);
  });
});

describe("access code", () => {
  it("is paste friendly: spaces / dashes out, upper case, max 8", () => {
    expect(cleanCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(cleanCode("abcd23456789")).toBe("ABCD2345");
  });

  it("is remembered per link", () => {
    saveCode("tok1", "ABCD2345");
    expect(loadCode("tok1")).toBe("ABCD2345");
    expect(loadCode("tok2")).toBeNull();
    clearCode("tok1");
    expect(loadCode("tok1")).toBeNull();
  });
});
