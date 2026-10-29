import { describe, expect, it } from "vitest";
import { isoDate } from "./localDate";

describe("isoDate", () => {
  it("YYYY-MM-DD in local time (never DD/MM/YYYY)", () => {
    expect(isoDate(new Date(2026, 9, 25, 23, 59))).toBe("2026-10-25");
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
