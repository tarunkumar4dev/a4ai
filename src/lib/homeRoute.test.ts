// Login landing: institute staff follow get_my_access; a self-signed-up student never lands on the teacher
// dashboard (the bug: signup → /student/dashboard, next login → /dashboard because home_route is '/dashboard'
// for everyone without an institute and RoleRoute treated primary_role 'none' as teacher).
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStudentOnly, resolveHomeRoute } from "./homeRoute";

const auth = { role: "student" as string | null };
const access = { value: null as null | Record<string, unknown> };
vi.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ role: auth.role }) }));
vi.mock("@/context/AccessProvider", () => ({
  useAccess: () => ({ access: access.value, loading: false, error: null, refresh: () => {} }),
}));

import { RoleRoute } from "@/components/routing/RoleRoute";

const none = { primary_role: "none" as const, home_route: "/dashboard" };
const hod = { primary_role: "hod" as const, home_route: "/hod" };

describe("resolveHomeRoute", () => {
  it("student without an institute → student dashboard", () => {
    expect(resolveHomeRoute(none, "student")).toBe("/student/dashboard");
    expect(resolveHomeRoute(none, " Student ")).toBe("/student/dashboard");
  });
  it("teacher (or no role) without an institute → teacher dashboard", () => {
    expect(resolveHomeRoute(none, "teacher")).toBe("/dashboard");
    expect(resolveHomeRoute(none, null)).toBe("/dashboard");
  });
  it("institute signup with no institute yet → /institute (create it)", () => {
    expect(resolveHomeRoute(none, "institute")).toBe("/institute");
  });
  it("institute staff follow the server's home_route, whatever they picked at signup", () => {
    expect(resolveHomeRoute(hod, "student")).toBe("/hod");
    expect(resolveHomeRoute({ primary_role: "teacher", home_route: "" }, "teacher")).toBe("/dashboard");
  });
  it("access check failed (null) → signup role", () => {
    expect(resolveHomeRoute(null, "student")).toBe("/student/dashboard");
    expect(resolveHomeRoute(undefined, undefined)).toBe("/dashboard");
  });
  it("isStudentOnly only for primary_role none + student", () => {
    expect(isStudentOnly(none, "student")).toBe(true);
    expect(isStudentOnly(hod, "student")).toBe(false);
    expect(isStudentOnly(none, "teacher")).toBe(false);
    expect(isStudentOnly(null, "student")).toBe(false);
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root | null = null;
function render(path: string) {
  root = createRoot(host);
  act(() => {
    root.render(
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(Routes, null,
          React.createElement(Route, {
            path: "/dashboard",
            element: React.createElement(RoleRoute, {
              allow: ["admin", "hod", "proctor", "teacher"],
              children: React.createElement("p", null, "TEACHER-DASH"),
            }),
          }),
          React.createElement(Route, { path: "/student/dashboard", element: React.createElement("p", null, "STUDENT-DASH") }),
          React.createElement(Route, { path: "/hod", element: React.createElement("p", null, "HOD-DASH") }),
        ),
      ),
    );
  });
}
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); });
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host.remove(); });

describe("RoleRoute /dashboard", () => {
  it("a student who types /dashboard goes to the student dashboard", () => {
    auth.role = "student"; access.value = none;
    render("/dashboard");
    expect(host.textContent).toBe("STUDENT-DASH");
  });
  it("an independent teacher still gets the teacher dashboard", () => {
    auth.role = "teacher"; access.value = none;
    render("/dashboard");
    expect(host.textContent).toBe("TEACHER-DASH");
  });
  it("a 'student' signup who is institute staff (HOD) is treated as staff, not sent away", () => {
    auth.role = "student"; access.value = { ...hod, institute_id: "i1" };
    render("/dashboard");
    expect(host.textContent).toBe("TEACHER-DASH");
  });
});
