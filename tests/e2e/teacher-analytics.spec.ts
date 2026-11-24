// Teacher dashboard → Analytics (/dashboard?tab=analytics) end to end, Supabase mocked in the browser — no live DB.
// Checks: every number comes from the mocked rows (no sample names / made-up deltas), "vs previous" only from real
// older rows, empty data shows an empty state, a failed read shows an error (never sample data), the reads go
// through student_batches / conducted sessions, and the drawer / students list / question-wise panel work.
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
  { id: "s2", name: "Bilal Khan", roll_no: "2", batch_id: BATCH, parent_phone: "9876543210", student_batches: [{ batch_id: BATCH }] },
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
const ASSIGNMENTS = [{ id: "a1", title: "Chapter 3 worksheet", max_marks: 20, count_policy: "latest", created_at: `${day(5)}T09:00:00Z`, batch_id: BATCH, deadline: `${day(2)}T18:00:00Z` }];
const SUBMISSIONS = [
  { id: "x1", assignment_id: "a1", student_id: "s1", submitter_key: null, guest_name: null, guest_roll: null, grade: 18, status: "published", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
  { id: "x2", assignment_id: "a1", student_id: "s2", submitter_key: null, guest_name: null, guest_roll: null, grade: "5.00", status: "published", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
  { id: "x3", assignment_id: "a1", student_id: "s3", submitter_key: null, guest_name: null, guest_roll: null, grade: null, status: "uploaded", attempt_no: 1, submitted_at: `${day(4)}T09:00:00Z`, check_sheets: [] },
];
const SHEETS = [
  { id: "h1", session_id: "cs1", student_id: "s1", student_name: "Asha Rao", roll_no: "1", final_marks: "30.00", max_marks: "40.00", ai_max: 40,
    check_sessions: { title: "Unit Test 1", batch_id: BATCH, total_marks: 40, created_at: `${day(3)}T09:00:00Z` } },
];

// 35 days ago = the previous 30-day period: 1 of 3 attended → 33.3 % (this period 55.6 % → +22.3 pts, as shown)
const PREV_SESSION = { id: "c0", batch_id: BATCH, session_date: day(35) };
const PREV_RECORDS = [
  { id: "p1", session_id: "c0", student_id: "s1", status: "present", class_sessions: { session_date: day(35) } },
  { id: "p2", session_id: "c0", student_id: "s2", status: "absent", class_sessions: { session_date: day(35) } },
  { id: "p3", session_id: "c0", student_id: "s3", status: "absent", class_sessions: { session_date: day(35) } },
];
// question-wise rows of the copy check "Unit Test 1": Q2 is the weak one, two students missed "Ohm's law"
const QUESTION_ROWS = [
  { id: "h1", submission_id: null, per_question: [{ q_no: "1", marks: 2, max_marks: 2, counted: true }, { q_no: "2", marks: 1, max_marks: 4, counted: true }],
    graded: [{ q_no: "1", key_concepts_found: ["Series circuits"] }, { q_no: "2", key_concepts_missed: ["Ohm's law"] }] },
  { id: "h2", submission_id: null, per_question: [{ q_no: "1", marks: 1, max_marks: 2, counted: true }, { q_no: "2", marks: 0, max_marks: 4, counted: true, not_attempted: true }],
    graded: [{ q_no: "2", key_concepts_missed: ["ohm's law"] }] },
];

const SAMPLE_NAMES = /Aarav Sharma|Diya Patel|Vikram Malhotra|Sahil Mehta|Neha Gupta|Arjun Reddy|Benchmark Preview|vs last term/;

type Opts = { empty?: boolean; failAttendance?: boolean; previous?: boolean };
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
    if (table === "class_sessions") return this.json(route, e ? [] : this.o.previous ? [PREV_SESSION, ...SESSIONS] : SESSIONS);
    if (table === "attendance_records") {
      if (this.o.failAttendance) return this.json(route, { code: "57014", message: "canceling statement due to statement timeout" }, 500);
      return this.json(route, e ? [] : this.o.previous ? [...PREV_RECORDS, ...RECORDS] : RECORDS);
    }
    if (table === "assignments") return this.json(route, e ? [] : ASSIGNMENTS);
    if (table === "submissions") return this.json(route, e ? [] : SUBMISSIONS);
    if (table === "check_sheets") return this.json(route, e ? [] : url.search.includes("per_question") ? QUESTION_ROWS : SHEETS);
    return this.json(route, one ? {} : []);
  }
}

async function openAnalytics(page: Page, db: Db) {
  await db.install(page);
  await page.goto("/dashboard?tab=analytics"); // the deep link the agent's "dashboard.analytics" key opens
  await expect(modeBtn(page, "Overview")).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
}

const modeBtn = (page: Page, name: "Overview" | "Marks" | "Attendance" | "Students") =>
  page.getByRole("group", { name: "Analytics view" }).getByRole("button", { name });

const kpi = (page: Page, label: string) =>
  page.locator(".glass-panel").filter({ has: page.getByText(label, { exact: true }) }).first();

test("marks: numbers come from submissions + checked copies, no sample data", async ({ page }) => {
  const db = new Db();
  await openAnalytics(page, db);
  await modeBtn(page, "Marks").click();

  await expect(kpi(page, "Class Average")).toContainText("63.3%");
  await expect(kpi(page, "Class Average")).toContainText("from 3 results");
  await expect(kpi(page, "Highest Score")).toContainText("90%");
  await expect(kpi(page, "Passing Rate")).toContainText("66.7%");
  await expect(kpi(page, "Assessments")).toContainText("1 assignment · 1 copy check");
  await expect(kpi(page, "Assessments")).toContainText("1 awaiting marks");

  const top = page.getByRole("region", { name: "Top performers" });
  await expect(top).toContainText("Asha Rao");
  await expect(top).toContainText("82.5%");
  const support = page.getByRole("region", { name: "Students needing support" });
  await expect(support.getByRole("listitem")).toHaveCount(1);
  await expect(support).toContainText("Bilal Khan");
  // the assignment tracker: Asha + Bilal submitted (marked), Chitra's attempt is waiting
  const tracker = page.getByRole("region", { name: "Assignment tracker" });
  await expect(tracker).toContainText("Chapter 3 worksheet");
  await expect(tracker).toContainText("3/3 submitted");

  // pass mark 50 → nobody new below it except Bilal; the bracket list has no gap
  await page.getByRole("group", { name: "Pass mark" }).getByRole("button", { name: "50%" }).click();
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
  await expect(page.getByRole("region", { name: "What stands out" })).toContainText("Mark attendance");
  await expect(kpi(page, "Attendance")).toContainText("—");
  await modeBtn(page, "Marks").click();
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

test("overview: rings, real insights, pictograph → student drawer", async ({ page }) => {
  const db = new Db();
  await openAnalytics(page, db);
  await expect(kpi(page, "Attendance")).toContainText("55.6%");
  await expect(kpi(page, "Class average")).toContainText("63.3%");
  await expect(kpi(page, "On track")).toContainText("1");
  // no older rows → no "vs previous" claim on any card
  for (const label of ["Attendance", "Class average", "Passing rate"]) await expect(kpi(page, label)).not.toContainText("vs previous");
  const insights = page.getByRole("region", { name: "What stands out" });
  await expect(insights).toContainText("2 students below 75% attendance");
  await expect(insights).toContainText("Lowest: Bilal Khan at 0%");

  // Bilal: 0 % attendance + 25 % marks → needs attention; Chitra: 66.7 % → keep an eye; Asha → on track
  const glance = page.getByRole("region", { name: "Your class at a glance" });
  await expect(glance).toContainText("Needs attention 1");
  await expect(glance).toContainText("Keep an eye 1");
  await glance.getByRole("button", { name: "Bilal Khan — Needs attention" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("Bilal Khan");
  await expect(drawer).toContainText("0 / 3");
  await expect(drawer).toContainText("Chapter 3 worksheet");
  await expect(drawer.getByRole("button", { name: "WhatsApp parent" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.locator("body")).not.toContainText(SAMPLE_NAMES);
});

test("vs previous: compares with the real rows of the 30 days before", async ({ page }) => {
  await openAnalytics(page, new Db({ previous: true }));
  await modeBtn(page, "Attendance").click();
  await expect(kpi(page, "Attendance Rate")).toContainText("55.6%"); // the older class is not counted in this period
  await expect(kpi(page, "Attendance Rate")).toContainText("+22.3 pts");
  await expect(kpi(page, "Attendance Rate")).toContainText("vs previous 30 days");
  await expect(kpi(page, "Classes Held")).toContainText("3");
  await modeBtn(page, "Overview").click();
  await expect(page.getByRole("region", { name: "What stands out" })).toContainText("Attendance is up 22.3 points");
});

test("students: one list with search and filters", async ({ page }) => {
  await openAnalytics(page, new Db());
  await modeBtn(page, "Students").click();
  const list = page.getByRole("region", { name: "Every student" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await list.getByRole("group", { name: "Filter students" }).getByRole("button", { name: /Needs attention/ }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Bilal Khan");
  await list.getByRole("group", { name: "Filter students" }).getByRole("button", { name: /^All/ }).click();
  await list.getByRole("textbox", { name: "Search students" }).fill("chit");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Chitra Iyer");
});

test("question-wise: weakest question and missed concepts of a copy check", async ({ page }) => {
  const db = new Db();
  await openAnalytics(page, db);
  await modeBtn(page, "Marks").click();
  const qa = page.getByRole("region", { name: "Question-wise analysis" });
  await expect(qa.getByRole("tab", { name: /Unit Test 1/ })).toHaveAttribute("aria-selected", "true"); // latest first
  await expect(qa).toContainText("Based on 2 copies");
  await expect(qa).toContainText("Weakest: Q2 (12.5%)"); // 1 of 8 marks
  await expect(qa).toContainText("Most skipped: Q2 (1 student)");
  await expect(qa).toContainText("Ohm's law2"); // missed by both (case-insensitive merge)
  expect(db.urls.some((u) => u.startsWith("/rest/v1/check_sheets") && u.includes("per_question") && u.includes("session_id=eq.cs1") && u.includes("status=eq.approved"))).toBe(true);
});
