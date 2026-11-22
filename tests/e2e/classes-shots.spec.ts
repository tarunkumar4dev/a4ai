// Screenshots of the Classes screen and the Teachers tab, light + dark, desktop + phone (npm run e2e -- classes-shots).
// Supabase is mocked in the browser (no live DB). Output: docs/design/classes-ui-polish/*.png
import { test, expect, type Page, type Route } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "docs/design/classes-ui-polish");
const MOCK = "http://mock.supabase.local";
const INST = "inst-1", USER = "user-admin";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", exp })}.sig`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "admin@example.test", user_metadata: { full_name: "Demo Admin" }, app_metadata: { provider: "email" }, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
const access = { institute_id: INST, institute_name: "Education Beast", primary_role: "admin", home_route: "/institute", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] };

const D = { c11: "d-11", c12: "d-12", c8: "d-8" };
const depts = [
  { id: D.c11, institute_id: INST, name: "11th - Commerce", student_code: "A", teacher_code: "B" },
  { id: D.c12, institute_id: INST, name: "12th - Commerce", student_code: "C", teacher_code: "D" },
  { id: D.c8, institute_id: INST, name: "8th class", student_code: "E", teacher_code: "F" },
];
const subjects = [
  { id: "s-eco", name: "Economics", code: "ECO101", department_id: D.c11 }, { id: "s-acc", name: "Accounts", code: "ACC101", department_id: D.c11 },
  { id: "s-bst", name: "BST", code: "BST101", department_id: D.c11 }, { id: "s-mth", name: "Maths", code: "MATH3", department_id: D.c11 },
  { id: "s-eco12", name: "Economics", code: "ECO12", department_id: D.c12 }, { id: "s-all", name: "All Subjects", code: "ALLSUB", department_id: D.c8 },
];
const bt = (id: string, name: string, dept: string, subj: string | null) => ({ id, institute_id: INST, name, class_level: "11", subject: "", description: "", is_active: true, department_id: dept, subject_id: subj, section_id: null, is_lab: false, created_at: "2026-10-10T00:00:00Z" });
const batches = [
  bt("b1", "Economics Batch 1", D.c11, "s-eco"), bt("b2", "Economics Batch 2", D.c11, "s-eco"), bt("b3", "Accounts Rahul Sir", D.c11, "s-acc"),
  bt("b4", "BST", D.c11, "s-bst"), bt("b5", "Maths Batch 1", D.c11, "s-mth"), bt("b6", "Economics Batch 1", D.c12, "s-eco12"),
  bt("b7", "ALL", D.c8, "s-all"), bt("b8", "Old batch (no subject)", D.c11, null),
];
const counts: Record<string, number> = { b1: 12, b2: 9, b3: 21, b4: 2, b5: 0, b6: 16, b7: 8, b8: 3 };
const studentBatches = Object.entries(counts).flatMap(([b, n]) => Array.from({ length: n }, (_, i) => ({ student_id: `${b}-${i}`, batch_id: b })));
const members = [
  { id: "m-1", user_id: "t-rahul", institute_id: INST, role: "teacher", status: "active", joined_at: "2026-10-10T00:00:00Z", user_name: "Rahul Verma", user_email: "rahul@example.test" },
  { id: "m-2", user_id: "t-deepak", institute_id: INST, role: "teacher", status: "active", joined_at: "2026-10-11T00:00:00Z", user_name: "Deepak Sir", user_email: "deepak@example.test" },
  { id: "m-3", user_id: "t-priya", institute_id: INST, role: "teacher", status: "active", joined_at: "2026-10-12T00:00:00Z", user_name: "Priya Singh", user_email: "priya@example.test" },
];
const teaching = [
  { teacher_id: "t-rahul", batch_id: "b3", subject_id: "s-acc" }, { teacher_id: "t-rahul", batch_id: "b1", subject_id: "s-eco" },
  { teacher_id: "t-priya", batch_id: "b2", subject_id: "s-eco" }, { teacher_id: "t-priya", batch_id: "b5", subject_id: "s-mth" },
  { teacher_id: "t-deepak", batch_id: "b6", subject_id: "s-eco12" },
];

async function install(page: Page) {
  await page.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session)]);
  await page.route(`${MOCK}/**`, (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const json = (b: unknown, extra: Record<string, string> = {}) => route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json", ...extra }, body: JSON.stringify(b) });
    if (url.pathname.startsWith("/auth/v1/user")) return json(user);
    if (url.pathname.startsWith("/auth/v1/token")) return json(session);   // the app refreshes the session on start
    if (url.pathname.startsWith("/auth/")) return json({});
    if (url.pathname.startsWith("/storage/")) return route.fulfill({ status: 404, headers: cors, body: "" });
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "rpc/get_my_access") return json([access]);
    if (table === "institutes") return url.searchParams.get("owner_id") ? json([{ id: INST }]) : json({ id: INST, name: "Education Beast", join_code: "JOIN42", max_teachers: 50, max_students: 500, monthly_test_limit: 100, hierarchy_mode: "simple" });
    if (table === "students") return req.method() === "HEAD" ? route.fulfill({ status: 200, headers: { ...cors, "content-range": "*/0" }, body: "" }) : json([], { "content-range": "*/0" });
    const lists: Record<string, unknown[]> = { departments: depts, subjects, batches, institute_members: members, student_batches: studentBatches, teaching_assignments: teaching, sections: [], proctor_assignments: [] };
    return json(lists[table] ?? (req.headers()["accept"]?.includes("vnd.pgrst.object") ? {} : []));
  });
  await page.route(u => !["localhost", "mock.supabase.local"].includes(u.hostname), r => r.abort());
}

const open = async (page: Page, tab: string) => {
  await install(page);
  await page.goto(`/institute?tab=${tab}`);
  await expect(page.getByText("Loading workspace...")).toHaveCount(0);
};
const setTheme = async (page: Page, theme: "Light" | "Dark") => {
  const btn = page.locator("aside button", { hasText: theme }).last();
  if (await btn.count()) await btn.click();
};

for (const [name, viewport] of [["desktop", { width: 1366, height: 1000 }], ["phone", { width: 390, height: 844 }]] as const) {
  test.describe(name, () => {
    test.use({ viewport, isMobile: name === "phone", hasTouch: name === "phone", deviceScaleFactor: 1 });
    for (const theme of ["Light", "Dark"] as const) {
      test(`classes tab ${name} ${theme}`, async ({ page }) => {
        await open(page, "classes");
        await expect(page.getByTestId("classes-tab")).toBeVisible();
        if (name === "desktop") await setTheme(page, theme);
        else if (theme === "Dark") await page.evaluate(() => document.querySelector(".dashboard-root")?.classList.add("dark-mode"));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `classes-${name}-${theme.toLowerCase()}.png`), fullPage: true });
      });
      test(`teachers tab ${name} ${theme}`, async ({ page }) => {
        await open(page, "teachers");
        await expect(page.getByTestId("teachers-simple")).toBeVisible();
        if (name === "desktop") await setTheme(page, theme);
        else if (theme === "Dark") await page.evaluate(() => document.querySelector(".dashboard-root")?.classList.add("dark-mode"));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `teachers-${name}-${theme.toLowerCase()}.png`), fullPage: true });
      });
    }
  });
}
