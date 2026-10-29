// Screenshots of the teacher dashboard with a stubbed teacher session (no real data).
// Usage: node scripts/dashboard-shots.mjs <baseUrl> <outDir>
// Writes <outDir>/<tab>-<width>.png for tabs: home, tests, analytics, assignments.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", outDir = "docs/screenshots/teacher-dashboard/after"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

// Tabs are opened by clicking the sidebar item (the dashboard has no URL param for most tabs).
// Every sidebar item of the teacher dashboard (labels as shown in the sidebar).
const TABS = [
  ["home", null],
  ["calendar", "Calendar"],
  ["assignments", "Assignments"],
  ["attendance", "Attendance"],
  ["students", "Students"],
  ["modules", "Modules"],
  ["tests", "Test History"],
  ["analytics", "Analytics"],
  ["ai-tools", "AI Tools"],
];
const WIDTHS = (process.env.WIDTHS || "1440,768,390").split(",").map(Number);

const browser = await chromium.launch();
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const sample = [{ id: "t1", exam_title: "Chapter 3 Polynomials — Unit Test", board: "CBSE", class_grade: "10", subject: "Mathematics", status: "saved", total_questions: 20, total_marks: 40, created_at: new Date().toISOString() }];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
  await ctx.route(/supabase\.co/, (r) => {
    const u = r.request().url();
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("get_my_access")) return json([{ institute_id: null, primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
    if (u.includes("/rest/v1/tests")) return json(sample);
    if (u.includes("/rest/v1/profiles")) return json(r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
    if (u.includes("/rpc/")) return json(null);
    return json([]);
  });
  const page = await ctx.newPage();
  await page.goto(base + "/dashboard", { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  for (const [name, label] of TABS) {
    if (label) {
      // The sidebar is a drawer below 1024px, so click through the DOM (works whether or not it is visible).
      await page.evaluate((text) => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
        if (!btn) throw new Error("tab not found: " + text);
        btn.click();
      }, label);
    }
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: false });
    console.log(`${name}-${width}: horizontal overflow ${overflow}px`);
  }
  await ctx.close();
}
await browser.close();
