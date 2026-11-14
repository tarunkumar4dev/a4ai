// /institute (admin dashboard) end to end, Supabase mocked in the browser — no live DB.
// Checks: heavy chunks (xlsx, attendance, bulk upload) load only when needed; a mutation refreshes only what it
// changed, without the full-page spinner; tab focus doesn't reload the page; a failing access check shows Retry, not /login.
import { test, expect, type Page, type Request, type Route } from "@playwright/test";

test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const MOCK = "http://mock.supabase.local";
const INST = "inst-1", USER = "user-admin";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", exp })}.sig`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "admin.demo@msit.a4ai.in", user_metadata: { full_name: "Demo Admin" }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };

const access = { institute_id: INST, institute_name: "MSIT", primary_role: "admin", home_route: "/institute", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] };
const students = Array.from({ length: 43 }, (_, i) => ({
  id: `stu-${i}`, institute_id: INST, name: `Student ${String(i).padStart(2, "0")}`, roll_no: `${100 + i}`, class_level: "2025",
  parent_name: "", parent_phone: "", batch_id: i < 42 ? "b-1" : null, is_active: true, department_id: "d-1", section_id: "s-1",
  batches: i < 42 ? { name: "ECE-2" } : null, student_access_codes: [{ access_code: `CODE${i}` }],
}));

type Opts = { accessFailures?: number };
class Db {
  log: { method: string; table: string; query: string }[] = [];
  chunks: string[] = [];
  depts = [{ id: "d-1", institute_id: INST, name: "ECE", student_code: "A4I-ECE-STU-AAAA", teacher_code: "A4I-ECE-TCH-BBBB" }];
  accessFailures: number;
  constructor(o: Opts = {}) { this.accessFailures = o.accessFailures ?? 0; }

  reads(table: string) { return this.log.filter(l => l.table === table && (l.method === "GET" || l.method === "HEAD")).length; }

  async install(page: Page) {
    await page.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session)]);
    page.on("request", (r: Request) => {
      const m = r.url().match(/\/assets\/([A-Za-z0-9_]+)-[A-Za-z0-9_-]+\.js$/);
      if (m) this.chunks.push(m[1]);
    });
    await page.route(`${MOCK}/**`, (route: Route) => this.handle(route));
    await page.route(u => !["localhost", "mock.supabase.local"].includes(u.hostname), r => r.abort());
  }

  private json(route: Route, body: unknown, status = 200, extra: Record<string, string> = {}) {
    return route.fulfill({ status, headers: { ...cors, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
  }

  private handle(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return this.json(route, user);
    if (url.pathname.startsWith("/auth/")) return this.json(route, {});
    if (url.pathname.startsWith("/storage/")) return route.fulfill({ status: 404, headers: cors, body: "" });

    const table = url.pathname.replace("/rest/v1/", "");
    this.log.push({ method: req.method(), table, query: url.search });
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const q = url.searchParams;

    if (table === "rpc/get_my_access") {
      if (this.accessFailures > 0) { this.accessFailures--; return route.fulfill({ status: 503, headers: cors, body: "unavailable" }); }
      return this.json(route, [access]);
    }
    if (table === "institutes") {
      if (q.get("owner_id")) return this.json(route, [{ id: INST }]);
      return this.json(route, { id: INST, name: "MSIT", join_code: "JOIN42", max_teachers: 50, max_students: 500, monthly_test_limit: 100 });
    }
    if (table === "students") {
      if (req.method() === "HEAD") {
        const n = q.get("batch_id") === "is.null" ? 1 : students.length;
        return route.fulfill({ status: 200, headers: { ...cors, "content-range": `*/${n}` }, body: "" });
      }
      return this.json(route, students, 200, { "content-range": `0-${students.length - 1}/${students.length}` });
    }
    if (table === "departments") {
      if (req.method() === "POST") {
        const body = JSON.parse(req.postData() || "{}");
        this.depts.push({ id: `d-${this.depts.length + 1}`, ...body });
        return route.fulfill({ status: 201, headers: cors, body: "" });
      }
      return this.json(route, this.depts);
    }
    const lists: Record<string, unknown[]> = {
      institute_members: [{ id: "m-1", user_id: "user-t1", institute_id: INST, role: "teacher", status: "active", joined_at: "2026-10-10T00:00:00Z", user_name: "Teacher One", user_email: "teacher.ece2@msit.a4ai.in", department_id: "d-1" }],
      batches: [{ id: "b-1", institute_id: INST, name: "ECE-2", class_level: "2025", subject: "", description: "", is_active: true, department_id: "d-1", section_id: "s-1", created_at: "2026-10-10T00:00:00Z" }],
      sections: [{ id: "s-1", department_id: "d-1", name: "ECE-2", year: 2025, departments: { institute_id: INST } }],
      subjects: [{ id: "sub-1", name: "DSA", code: "DSA101", department_id: "d-1" }],
      teaching_assignments: [{ teacher_id: "user-t1", batch_id: "b-1", subject_id: "sub-1" }],
    };
    if (lists[table]) return this.json(route, lists[table]);
    return this.json(route, one ? {} : []);
  }
}

async function openDashboard(page: Page, db: Db) {
  await db.install(page);
  await page.goto("/institute");
  await expect(nav(page, "Attendance")).toBeVisible();
  await expect(page.getByText("Loading workspace...")).toHaveCount(0);
}

const nav = (page: Page, label: string) => page.locator("aside nav button", { hasText: label });

test("first screen has no xlsx / attendance / bulk-upload code; each loads when it is opened", async ({ page }) => {
  const db = new Db();
  await openDashboard(page, db);
  await page.waitForLoadState("networkidle");
  expect(db.chunks).toContain("InstituteDashboardPage");
  for (const c of ["xlsx", "HODAttendanceDashboard", "BulkStudentUpload", "BatchManagementPanel"]) expect(db.chunks, c).not.toContain(c);
  // every data request ran once (no duplicates on first load)
  for (const t of ["institute_members", "batches", "departments", "sections", "subjects", "teaching_assignments"]) expect(db.reads(t), t).toBe(1);
  expect(db.reads("students")).toBe(3); // list + 2 head counts

  await nav(page, "Attendance").click();
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
  await expect.poll(() => db.chunks).toContain("HODAttendanceDashboard");
  await expect(page.getByText("Attendance could not be shown.")).toHaveCount(0);

  await nav(page, "Batches").click();
  expect(db.chunks).not.toContain("BatchManagementPanel");
  await nav(page, "Analytics").click();
  await expect(page.getByRole("heading", { name: "Batch Settings" })).toBeVisible();
  await expect.poll(() => db.chunks).toContain("BatchManagementPanel");
  await expect(page.getByText("Batch settings could not be shown.")).toHaveCount(0);

  await page.locator('button[title="Bulk upload students"]').click();
  await expect.poll(() => db.chunks).toContain("BulkStudentUpload");
  await expect.poll(() => db.chunks).toContain("xlsx");
});

test("all tabs render with the institute's data", async ({ page }) => {
  const db = new Db();
  await openDashboard(page, db);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const [tab, expectText] of [
    ["Departments", "ECE"], ["Teachers", "Teacher One"], ["Students", "Student 00"], ["Batches", "ECE-2"],
    ["Attendance", "Monitor teacher marking status"], ["Analytics", "Institute Details"], ["Dashboard", "JOIN42"],
  ] as const) {
    await nav(page, tab).click();
    await expect(page.locator("main").getByText(expectText).locator("visible=true").first()).toBeVisible();
  }
  // student count comes from the server count (43), badge on the Students nav item
  await expect(nav(page, "Students")).toContainText("43");
  expect(errors).toEqual([]);
});

test("adding a department refreshes only departments, without the full-page spinner", async ({ page }) => {
  const db = new Db();
  await openDashboard(page, db);
  await nav(page, "Students").click();
  await page.waitForLoadState("networkidle");
  const before = db.log.length;
  let spinner = false;
  const watch = page.getByText("Loading workspace...").waitFor({ timeout: 4000 }).then(() => { spinner = true; }, () => {});

  await page.locator('button[title="New department"]').click();
  await page.getByPlaceholder("Department name *").fill("CSE");
  await page.getByRole("button", { name: "Create Department" }).click();
  await expect(page.getByText("CSE created")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await watch;

  const after = db.log.slice(before).map(l => `${l.method} ${l.table}`);
  expect(after).toEqual(["POST departments", "GET departments"]);
  expect(spinner).toBe(false);
  await expect(page.getByText("Student 00")).toBeVisible(); // the open tab stayed on screen
});

test("returning to the tab (auth SIGNED_IN on visibilitychange) does not reload the dashboard", async ({ page }) => {
  const db = new Db();
  await openDashboard(page, db);
  await page.waitForLoadState("networkidle");
  const before = db.log.filter(l => l.table !== "rpc/get_my_access" && l.table !== "teacher_profiles" && l.table !== "plans").length;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  const dataReads = db.log.filter(l => l.table !== "rpc/get_my_access" && l.table !== "teacher_profiles" && l.table !== "plans").length;
  expect(dataReads).toBe(before);
  await expect(page.getByText("Loading workspace...")).toHaveCount(0);
});

test("access check down: Retry screen instead of /login; Retry opens the dashboard", async ({ page }) => {
  const db = new Db({ accessFailures: 3 });
  await db.install(page);
  await page.goto("/institute");
  await expect(page.getByText("We couldn't check your access.")).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).pathname).toBe("/institute");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(nav(page, "Attendance")).toBeVisible();
});

test("one failed access check is retried silently", async ({ page }) => {
  const db = new Db({ accessFailures: 1 });
  await openDashboard(page, db);
  expect(new URL(page.url()).pathname).toBe("/institute");
});
