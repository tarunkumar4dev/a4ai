import { describe, expect, it } from "vitest";
import { cleanName, isRealName, isValidName, loadSavedName, saveName } from "./studentName";

describe("leaderboard name", () => {
  it("2–40 characters after trimming", () => {
    expect(isValidName(" a ")).toBe(false);
    expect(isValidName("Al")).toBe(true);
    expect(isValidName("x".repeat(40))).toBe(true);
    expect(isValidName("x".repeat(41))).toBe(false);
    expect(cleanName("  Priya   Sharma ")).toBe("Priya Sharma");
  });
  it("placeholder / email profile names don't count — the lobby asks instead", () => {
    expect(isRealName("User")).toBe(false);
    expect(isRealName("student")).toBe(false);
    expect(isRealName("a@b.com")).toBe(false);
    expect(isRealName(null)).toBe(false);
    expect(isRealName("Priya Sharma")).toBe(true);
  });
  it("remembered on this device", () => {
    saveName("  Rahul  K ");
    expect(loadSavedName()).toBe("Rahul K");
  });
});
