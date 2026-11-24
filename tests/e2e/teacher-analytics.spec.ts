// Teacher dashboard → Analytics (/dashboard?tab=analytics) end to end, Supabase mocked in the browser — no live DB.
// Checks: every number comes from the mocked rows (no sample names / made-up deltas), empty data shows an empty state,
// a failed read shows an error (never sample data), and the reads go through student_batches / conducted sessions.
import { test, expect, type Page, type Route } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const MOCK = "http://mock.supabase.local";
const INST = "inst-1", USER = "user-t1", BATCH = "b-1";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", exp })}.sig`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "teacher.ece2@msit.a4ai.in", user_metadata: { full_name: "Priya Sharma" }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
const access = { institute_id: INST, institute_name: "MSIT", primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [BATCH] };

const day = (ago: number) => {
  const d = new Date(); d.setDate(d.getDate() - ago);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ROSTER = [
  { id: "s1", name: "Asha Rao", roll_no: "1", batch_id: BATCH, student_batches: [{ batch_id: BATCH }] },
  { id: "s2", name: "Bilal Khan", roll_no: "2", batch_id: BATCH, student_batches: [{ batch_id: BATCH }] },
  { id: "s3", name: "Chitra Iyer", roll_no: "3", batch_id: BATCH, student_batches: [{ batch_id: BATCH }] },
];
const SESSIONS = [
  { id: "c1", batch_id: BATCH, session_date: day(2) },
  { id: "c2", batch_id: BATCH, session_date: day(1) },
  { id: "c3", batch_id: BATCH, session_date: day(0) },
];
const rec = (id: string, session: string, student: string, status: string) =>
  ({ id, session_id: session, student_id: student, status, class_sessions: { session_date: SESSIONS.find((s) => s.id === session)!.session_date } });
const RECORDS = [
  rec("r1", "c1", "s1", "present"), rec("r2", "c2", "s1", "present"), rec("r3", "c3", "s1", "present"),
  rec("r4", "c1", "s2", "absent"), rec("r5", "c2", "s2", "absent"), rec("r6", "c3", "s2", "leave"),
  rec("r7", "c1", "s3", "late"), rec("r8", "c2", "s3", "present"), rec("r9", "c3", "s3", "absent"),
];
// marks: 18/20 = 90 %, 5/20 = 25 %, s3 waiting; copy check 30/40 = 75 % → avg 63.3, highest 90, pass(33) 66.7
const ASSIGNMENTS = [{ id: "a1", title: "Chapter 3 worksheet", max_marks: 20, count_policy: "latest", created_at: `${day(5)}T09:00:00Z` }];
const SUBMISSIONS = [
  { id: "x1", assignment_id: "a1", student_id: "s1", submitter_key: null, guest_name: null, guest_roll: null, grade: 18, status: "published", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
  { id: "x2", assignment_id: "a1", student_id: "s2", submitter_key: null, guest_name: null, guest_roll: null, grade: "5.00", status: "published", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
  { id: "x3", assignment_id: "a1", student_id: "s3", submitter_key: null, guest_name: null, guest_roll: null, grade: null, status: "uploaded", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
];
const SHEETS = [
  { id: "h1", session_id: "cs1", student_id: "s1", student_name: "Asha Rao", roll_no: "1", final_marks: "30.00", max_marks: "40.00", ai_max: 40,
    check_sessions: { title: "Unit Test 1", batch_id: BATCH, total_marks: 40, created_at: `${day(3)}T09:00:00Z` } },
];

const SAMPLE_NAMES = /Aarav Sharma|Diya Patel|Vikram Malhotra|Sahil Mehta|Neha Gupta|Arjun Reddy|Benchmark Preview|vs last term/;

type Opts = { empty?: boolean; failAttendance?: boolean };
class Db {
  urls: string[] = [];
  o: Opts;
  constructor(o: Opts = {}) { this.o = o; }

  async install(page: Page) {
    await page.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session)]);
    await page.route((u) => !["localhost", "mock.supabase.local"].includes(u.hostname), (r) => r.abort());
    await page.route(`${MOCK}/**`, (route) => this.handle(route));
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  private handle(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return this.json(route, user);
    if (url.pathname.startsWith("/auth/")) return this.json(route, {});
    if (url.pathname.startsWith("/storage/")) return route.fulfill({ status: 404, headers: cors, body: "" });
    const table = url.pathname.replace("/rest/v1/", "");
    this.urls.push(decodeURIComponent(url.pathname + url.search));
    if (table === "rpc/get_my_access") return this.json(route, [access]);
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": "*/0" }, body: "" });
    const e = this.o.empty;
    if (table === "batches") return this.json(route, [{ id: BATCH, name: "ECE-2", class_level: "2025", section_id: null, department_id: null }]);
    if (table === "students") return this.json(route, ROSTER);
    if (table === "class_sessions") return this.json(route, e ? [] : SESSIONS);
    if (table === "attendance_records") {
      if (this.o.failAttendance) return this.json(route, { code: "57014", message: "canceling statement due to statement timeout" }, 500);
      return this.json(route, e ? [] : RECORDS);
    }
    if (table === "assignments") return this.json(route, e ? [] : ASSIGNMENTS);
    if (table === "submissions") return this.json(route, e ? [] : SUBMISSIONS);
    if (table === "check_sheets") return this.json(route, e ? [] : SHEETS);
    return this.json(route, one ? {} : []);
  }
}

async function openAnalytics(page: Page, db: Db) {
  await db.install(page);
  await page.goto("/dashboard?tab=analytics"); // the deep link the agent's "dashboard.analytics" key opens
  await expect(modeBtn(page, "Marks")).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
}

const modeBtn = (page: Page, name: "Marks" | "Attendance") =>
  page.getByRole("group", { name: "Analytics type" }).getByRole("button", { name });

const kpi = (page: Page, label: string) =>
  page.locator(".glass-panel").filter({ has: page.getByText(label, { exact: true }) }).first();

test("marks: numbers come from submissions + checked copies, no sample data", async ({ page }) => {
  const db = new Db();
  await openAnalytics(page, db);

  await expect(kpi(page, "Class Average")).toContainText("63.3%");
  await expect(kpi(page, "Class Average")).toContainText("from 3 results");
  await expect(kpi(page, "Highest Score")).toContainText("90%");
  await expect(kpi(page, "Passing Rate")).toContainText("66.7%");
  await expect(kpi(page, "Assessments")).toContainText("1 assignment · 1 copy check");
  await expect(kpi(page, "Assessments")).toContainText("1 awaiting marks");

  const top = page.locator(".glass-panel").filter({ has: page.getByRole("heading", { name: "Top performers" }) });
  await expect(top.getByRole("listitem").first()).toContainText("Asha Rao");
  await expect(top.getByRole("listitem").first()).toContainText("82.5%");
  const support = page.locator(".glass-panel").filter({ has: page.getByRole("heading", { name: "Students needing support" }) });
  await expect(support.getByRole("listitem")).toHaveCount(1);
  await expect(support).toContainText("Bilal Khan");

  // pass mark 50 → nobody new below it except Bilal; the bracket list has no gap
  await page.getByRole("button", { name: "50%" }).click();
  await expect(kpi(page, "Passing Rate")).toContainText("66.7%");

  await expect(page.locator("body")).not.toContainText(SAMPLE_NAMES);
  // reads: roster through student_batches, only rejected attempts left out, copy checks not tied to a submission
  expect(db.urls.some((u) => u.startsWith("/rest/v1/students") && u.includes("student_batches.batch_id=in.(b-1)"))).toBe(true);
  expect(db.urls.some((u) => u.startsWith("/rest/v1/submissions") && u.includes("status.neq.rejected"))).toBe(true);
  expect(db.urls.some((u) => u.startsWith("/rest/v1/check_sheets") && u.includes("submission_id=is.null") && u.includes("status=eq.approved"))).toBe(true);
});

test("attendance: same rule as get_monthly_attendance (late = attended, leave in total), real defaulters", async ({ page }) => {
  const db = new Db();
  await openAnalytics(page, db);
  await modeBtn(page, "Attendance").click();

  await expect(kpi(page, "Attendance Rate")).toContainText("55.6%"); // 5 attended / 9 marked
  await expect(kpi(page, "Attendance Rate")).toContainText("Under the 75% target");
  await expect(kpi(page, "Classes Held")).toContainText("3");
  await expect(kpi(page, "Avg Present")).toContainText("1.7");
  await expect(kpi(page, "Below 75%")).toContainText("2");

  const table = page.getByRole("table");
  await expect(table).toContainText("Bilal Khan");
  await expect(table).toContainText("0 / 3");
  await expect(table).toContainText("Chitra Iyer");
  await expect(table).toContainText("66.7%");
  await expect(table).not.toContainText("Asha Rao");
  await expect(page.locator("body")).not.toContainText(SAMPLE_NAMES);

  expect(db.urls.some((u) => u.startsWith("/rest/v1/class_sessions") && u.includes("status=eq.conducted") && u.includes(`teacher_id=eq.${USER}`))).toBe(true);
  expect(db.urls.some((u) => u.startsWith("/rest/v1/attendance_records") && u.includes("class_sessions.status=eq.conducted"))).toBe(true);
});

test("no data → empty states with zeros / dashes, never sample numbers", async ({ page }) => {
  await openAnalytics(page, new Db({ empty: true }));
  await expect(page.getByRole("heading", { name: "No marks in this period yet" })).toBeVisible();
  await expect(kpi(page, "Class Average")).toContainText("—");
  await modeBtn(page, "Attendance").click();
  await expect(page.getByRole("heading", { name: "No attendance in this period yet" })).toBeVisible();
  await expect(kpi(page, "Classes Held")).toContainText("0");
  await expect(page.locator("body")).not.toContainText(SAMPLE_NAMES);
  await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
});

test("a failed read shows an error with Retry, not made-up data", async ({ page }) => {
  await openAnalytics(page, new Db({ failAttendance: true }));
  await modeBtn(page, "Attendance").click();
  await expect(page.getByRole("alert")).toContainText("Couldn't load attendance");
  await expect(page.getByRole("alert").getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(SAMPLE_NAMES);
  // marks still load on their own
  await modeBtn(page, "Marks").click();
  await expect(kpi(page, "Class Average")).toContainText("63.3%");
});
