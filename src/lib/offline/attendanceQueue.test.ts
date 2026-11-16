import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { attendanceKey, classifyFailure, countDifferences, decideSync, isValidSave, type AttendanceSave } from "./attendanceQueue";
import { newKey, seal, unseal } from "./secureQueue";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

describe("decideSync", () => {
  it("sends when the server still has what the teacher started from", () => {
    expect(decideSync({}, {}, { [A]: "absent" })).toBe("send");
    expect(decideSync({ [A]: "present" }, { [A]: "present" }, { [A]: "absent" })).toBe("send");
  });

  it("does nothing when an earlier send got through and only the reply was lost", () => {
    expect(decideSync({ [A]: "absent" }, {}, { [A]: "absent" })).toBe("already-saved");
  });

  it("never overwrites a change made by someone else meanwhile", () => {
    expect(decideSync({ [A]: "leave" }, { [A]: "present" }, { [A]: "absent" })).toBe("conflict");
    expect(decideSync({ [A]: "present", [B]: "leave" }, {}, { [A]: "absent", [B]: "absent" })).toBe("conflict");
    // someone else's marks where the teacher started from an empty class
    expect(decideSync({ [A]: "present" }, {}, { [A]: "absent" })).toBe("conflict");
  });

  it("counts the differing marks", () => {
    expect(countDifferences({ [A]: "leave", [B]: "absent" }, { [A]: "absent", [B]: "absent" })).toBe(1);
  });
});

describe("classifyFailure", () => {
  it("keeps the save when the server never judged it", () => {
    expect(classifyFailure(0, "")).toBe("retry");
    expect(classifyFailure(undefined, undefined)).toBe("retry");
    expect(classifyFailure(503, "")).toBe("retry");
    expect(classifyFailure(429, "")).toBe("retry");
    expect(classifyFailure(401, "PGRST301")).toBe("retry");
  });

  it("stops retrying when the server said no", () => {
    expect(classifyFailure(400, "P0001")).toBe("reject"); // edit window closed, not assigned
    expect(classifyFailure(403, "42501")).toBe("reject");
  });
});

describe("isValidSave", () => {
  const good: AttendanceSave = {
    key: attendanceKey(ID, ID, "2026-11-02", null),
    instituteId: ID, batchId: ID, subjectId: ID, date: "2026-11-02", slotId: null, sessionId: null,
    marks: { [A]: "absent" }, base: {}, subjectName: "DSA", classLabel: "ECE-2", state: "pending",
  };

  it("accepts a well-formed save", () => {
    expect(isValidSave(good)).toBe(true);
  });

  it("refuses edited or malformed records", () => {
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave({ ...good, marks: { [A]: "hacked" } })).toBe(false);
    expect(isValidSave({ ...good, marks: { "not-a-uuid": "absent" } })).toBe(false);
    expect(isValidSave({ ...good, marks: {} })).toBe(false);
    expect(isValidSave({ ...good, batchId: "x" })).toBe(false);
    expect(isValidSave({ ...good, date: "2026-11-02'; drop table" })).toBe(false);
    // key must describe the same class as the fields
    expect(isValidSave({ ...good, date: "2026-11-01" })).toBe(false);
    expect(isValidSave({ ...good, state: "done" })).toBe(false);
  });
});

describe("seal / unseal", () => {
  it("round-trips", async () => {
    const key = await newKey();
    const { iv, data } = await seal(key, "rec|userA", { hello: "world" });
    await expect(unseal(key, "rec|userA", iv, data)).resolves.toEqual({ hello: "world" });
  });

  it("stores no readable text", async () => {
    const key = await newKey();
    const { data } = await seal(key, "rec|userA", { name: "absent-student" });
    expect(new TextDecoder().decode(data)).not.toContain("absent-student");
  });

  it("fails for another user, another key, or changed data", async () => {
    const key = await newKey();
    const { iv, data } = await seal(key, "rec|userA", { a: 1 });
    await expect(unseal(key, "rec|userB", iv, data)).rejects.toBeTruthy();
    await expect(unseal(await newKey(), "rec|userA", iv, data)).rejects.toBeTruthy();
    const edited = new Uint8Array(data.slice(0));
    edited[0] ^= 0xff;
    await expect(unseal(key, "rec|userA", iv, edited.buffer)).rejects.toBeTruthy();
  });

  it("makes a key that can't be exported", async () => {
    const key = await newKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toBeTruthy();
  });
});
