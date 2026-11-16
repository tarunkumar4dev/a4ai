// The registry copy must (1) be well-formed, (2) point only at routes that exist in App.tsx (not redirects),
// (3) gate by role, (4) accept only typed params. Also prints the report lists: routes with no key, shallow pages.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTES, resolveRoute, routeKeys, shallowRoutes } from "./routes";

const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
const appPaths = new Set([...app.matchAll(/path=\s*"([^"]+)"/g)].map((m) => m[1]));
const redirects = new Set([...app.matchAll(/path=\s*"([^"]+)"\s*element=\{<Navigate/g)].map((m) => m[1]));
const UUID = "c1000000-0000-0000-0000-000000000001";

describe("route registry", () => {
  it("is well-formed", () => {
    expect(ROUTES.version).toBe(1);
    for (const [k, r] of Object.entries(ROUTES.routes)) {
      expect(k).toMatch(/^[a-z0-9_.]+$/);
      expect(r.path.startsWith("/") && !r.path.includes("?")).toBe(true);
      expect(r.roles.length).toBeGreaterThan(0);
      expect(r.label.hi && r.label.en).toBeTruthy();
      for (const p of Object.values(r.params)) expect(ROUTES.param_types[p.type]).toBeTruthy();
      for (const m of r.path.matchAll(/:(\w+)/g)) {
        expect(Object.values(r.params).some((p) => p.in === "path" && p.name === m[1])).toBe(true);
      }
    }
  });

  it("every key points at a real App.tsx route, never a redirect (a missing route fails this test)", () => {
    for (const [k, r] of Object.entries(ROUTES.routes)) {
      expect(appPaths.has(r.path), `${k}: ${r.path} is not in App.tsx`).toBe(true);
      expect(redirects.has(r.path), `${k}: ${r.path} is a redirect`).toBe(false);
    }
  });

  it("builds URLs with query + typed params; rejects bad params and unfilled path params", () => {
    expect(resolveRoute("dashboard.assignments", {}, "teacher")?.to).toBe("/dashboard?tab=assignments");
    expect(resolveRoute("dashboard.assignments", { assignment_id: UUID, view: "copies" }, "teacher")?.to)
      .toBe(`/dashboard?tab=assignments&assignment=${UUID}&view=copies`);
    expect(resolveRoute("test_generator.check", { test_id: UUID }, "admin")?.to).toBe(`/dashboard/test-generator?tab=check&test=${UUID}`);
    expect(resolveRoute("test_generator.check", { test_id: "../x" }, "admin")).toBeNull();
    expect(resolveRoute("student.profile", { student_id: UUID }, "proctor")?.to).toBe(`/institute/students/${UUID}`);
    expect(resolveRoute("student.profile", {}, "proctor")).toBeNull();
    expect(resolveRoute("practice", { class: "10", subject: "Science" }, "teacher")?.to).toBe("/practice?class=10&subject=Science");
    expect(resolveRoute("practice", { class: "10", subject: "<b>" }, "teacher")).toBeNull();
    expect(resolveRoute("settings", { evil: "1" }, "teacher")?.to).toBe("/settings"); // unknown params dropped
  });

  it("gates by role and ignores unknown keys", () => {
    expect(resolveRoute("institute.dashboard", {}, "admin")?.to).toBe("/institute");
    expect(resolveRoute("institute.dashboard", {}, "teacher")).toBeNull();
    expect(resolveRoute("hod.dashboard", {}, "hod")?.to).toBe("/hod");
    expect(resolveRoute("hod.dashboard", {}, "proctor")).toBeNull();
    expect(resolveRoute("not.a.key", {}, "admin")).toBeNull();
    expect(resolveRoute("/etc/passwd", {}, "admin")).toBeNull();
    expect(resolveRoute("settings", {}, null)).toBeNull();
  });

  it("report: staff routes with no registry key, and pages that cannot be deep-linked", () => {
    const keyed = new Set(Object.values(ROUTES.routes).map((r) => r.path));
    const staffish = [...appPaths].filter((p) => !redirects.has(p) && /^\/(dashboard|institute|hod|students|notes|settings|contests|practice|admin|teacher|quiz|rewards)(\/|$)/.test(p));
    const noKey = staffish.filter((p) => !keyed.has(p)).sort();
    // eslint-disable-next-line no-console
    console.log(`[voice routes] routes with no key (${noKey.length}): ${noKey.join(", ")}`);
    // eslint-disable-next-line no-console
    console.log(`[voice routes] pages that open but cannot be deep-linked (${shallowRoutes().length}): ${shallowRoutes().join(", ")}`);
    expect(routeKeys().length).toBeGreaterThanOrEqual(20);
    expect(noKey).not.toContain("/dashboard");
  });
});
