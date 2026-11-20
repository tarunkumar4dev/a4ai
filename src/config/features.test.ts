// HOD switch (src/config/features.ts): false = HOD / class-teacher UI hidden, true = back exactly as before.
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectiveHomeRoute } from "./features";

describe("effectiveHomeRoute", () => {
  it("HOD off: /hod → teacher dashboard; other routes unchanged", () => {
    expect(effectiveHomeRoute("/hod", false)).toBe("/dashboard");
    expect(effectiveHomeRoute("/hod/x", false)).toBe("/dashboard");
    expect(effectiveHomeRoute("/institute", false)).toBe("/institute");
    expect(effectiveHomeRoute("", false)).toBe("/dashboard");
  });
  it("HOD on: /hod stays", () => {
    expect(effectiveHomeRoute("/hod", true)).toBe("/hod");
  });
});

/** Load a module with the flag forced to `on`. */
async function withFlag<T>(on: boolean, path: string): Promise<T> {
  vi.resetModules();
  vi.doMock("@/config/features", async () => {
    const real = await vi.importActual<typeof import("./features")>("./features");
    return { ...real, HOD_ENABLED: on, PROCTOR_UI_ENABLED: on, effectiveHomeRoute: (r: string) => real.effectiveHomeRoute(r, on) };
  });
  return (await import(/* @vite-ignore */ path)) as T;
}

describe("resolveHomeRoute follows the switch", () => {
  afterEach(() => { vi.doUnmock("@/config/features"); });
  const hod = { primary_role: "hod" as const, home_route: "/hod" };
  it("off → /dashboard", async () => {
    const m = await withFlag<typeof import("@/lib/homeRoute")>(false, "@/lib/homeRoute");
    expect(m.resolveHomeRoute(hod, null)).toBe("/dashboard");
  });
  it("on → /hod", async () => {
    const m = await withFlag<typeof import("@/lib/homeRoute")>(true, "@/lib/homeRoute");
    expect(m.resolveHomeRoute(hod, null)).toBe("/hod");
  });
});

describe("attendance: class-teacher (proctor) banner follows the switch", () => {
  let host: HTMLDivElement;
  let root: Root | null = null;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    vi.doMock("@/components/attendance/ProctorSectionView", () => ({
      useProctorCheck: () => ({ isProctor: true, proctorSections: [{ id: "s1", name: "ECE-2" }] }),
    }));
    vi.doMock("@/components/attendance/TeacherAttendanceView", () => ({ default: () => React.createElement("p", null, "SHEET") }));
  });
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    host.remove();
    vi.doUnmock("@/config/features");
    vi.doUnmock("@/components/attendance/ProctorSectionView");
    vi.doUnmock("@/components/attendance/TeacherAttendanceView");
  });

  const render = async (on: boolean) => {
    const { default: AttendancePage } = await withFlag<typeof import("@/components/attendance/AttendancePage")>(
      on, "@/components/attendance/AttendancePage");
    root = createRoot(host);
    act(() => root!.render(React.createElement(AttendancePage)));
    return host.textContent || "";
  };

  it("off: no class-teacher text, the sheet is there", async () => {
    const text = await render(false);
    expect(text).toContain("SHEET");
    expect(text).not.toMatch(/class teacher/i);
  });
  it("on: the banner comes back", async () => {
    const text = await render(true);
    expect(text).toMatch(/class teacher of ECE-2/i);
  });
});
