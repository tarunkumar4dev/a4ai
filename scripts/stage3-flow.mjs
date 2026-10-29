// Stage 3 functional checks on /dashboard/test-generator with the backend stubbed (no real AI call, no quota used).
// Usage: node scripts/stage3-flow.mjs <baseUrl> <outDir>
// Checks: (1) validation message, (2) loading status with elapsed seconds, (3) 500 error + retry keeps inputs,
// (4) success path renders the result view, (5) draft restore after reload.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", outDir = "docs/screenshots/teacher-dashboard/stage3"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const report = {};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
await ctx.route(/supabase\.co/, (r) => {
  const u = r.request().url();
  const json = (body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (u.includes("/auth/v1/user")) return json(user);
  if (u.includes("get_my_access")) return json([{ institute_id: null, primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
  if (u.includes("/rest/v1/profiles")) return json(r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
  if (u.includes("/rpc/")) return json(null);
  return json([]);
});

// Backend stub: first call fails with 500, second succeeds after a delay (so the loading state is visible).
// Chapter list (the Chapter dropdown is filled from the backend; stubbed here with a fixed list).
await ctx.route(/test-generator\/chapters/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, subject: "Science", classGrade: "10", chapters: ["Chemical Reactions", "Life Processes", "Light"], count: 3 }) }));
let calls = 0;
let lastPayload = null;
const questionFor = (i) => ({ id: `q${i}`, text: `Sample question ${i}?`, options: ["A", "B", "C", "D"], correctAnswer: "A", explanation: "Because.", marks: 1, difficulty: "Medium", bloomLevel: null, chapter: "Demo chapter", topic: "Demo topic", format: "MCQ", validationStatus: "ok" });
await ctx.route(/generate-frontend/, async (r) => {
  calls += 1;
  lastPayload = r.request().postDataJSON();
  if (calls === 1) {
    return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "upstream failed" }) });
  }
  await new Promise((res) => setTimeout(res, 2500));
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, testId: "t-demo", examTitle: lastPayload?.examTitle || "Demo", questions: [questionFor(1), questionFor(2)], totalMarks: 2, totalQuestions: 2, generationTime: 2.5, status: "ready", meta: {} }) });
});

const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));
await page.goto(base + "/dashboard/test-generator", { waitUntil: "load", timeout: 120000 });
await page.waitForSelector('button[data-tab="ai"]', { timeout: 90000 });
await page.locator('button[data-tab="ai"]').click();
await page.waitForSelector('input[name="examTitle"]', { timeout: 30000 });

// (1) validation: submit with empty title
await page.locator('button[type="submit"]').first().click();
await page.waitForSelector('[role="alert"]', { timeout: 8000 }).catch(() => {});
const alertText = await page.locator('[role="alert"]').allInnerTexts();
report.validation = { summaryShown: alertText.some((t) => t.includes("Fill in these fields")), summaryText: (alertText[0] || "").slice(0, 160), callsSoFar: calls };

// (2)+(3): fill, submit -> 500 -> error box with retry
await page.locator('input[name="examTitle"]').fill("Unit Test: Polynomials");
// The row is rendered twice (desktop + mobile layout, one hidden by CSS); use the visible chapter select.
// Both layouts are in the DOM and the first row sits in a panel that is not visible until opened; force the change.
const chapterSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Chemical Reactions" }) }).first();
await chapterSelect.selectOption({ label: "Chemical Reactions" }, { force: true });
await page.waitForTimeout(300);
await page.locator('button[type="submit"]').first().click();
await page.waitForSelector("text=Generation Failed", { timeout: 20000 });
report.failure = {
  errorTitle: true,
  errorText: (await page.locator("text=Generation Failed").locator("..").innerText()).slice(0, 160),
  retryButton: await page.getByRole("button", { name: "Try again with the same settings" }).count(),
  titlePreserved: (await page.locator('input[name="examTitle"]').inputValue()) === "Unit Test: Polynomials",
  callsAfterFailure: calls,
};
await page.screenshot({ path: path.join(outDir, "flow-error-retry-1440.png") });

// (4) retry -> loading status with elapsed seconds -> success
await page.getByRole("button", { name: "Try again with the same settings" }).click();
await page.waitForSelector('[role="status"]', { timeout: 10000 });
const statusText = (await page.locator('[role="status"]').first().innerText()).slice(0, 200);
await page.screenshot({ path: path.join(outDir, "flow-loading-1440.png") });
report.loading = { statusShown: true, statusText, percentShown: /%/.test(statusText) };
await page.waitForTimeout(3500);
report.success = {
  callsTotal: calls,
  payloadExamTitle: lastPayload?.examTitle,
  resultRendered: await page.getByText("Demo chapter").count() > 0 || await page.getByText("Sample question 1").count() > 0,
  errorGone: (await page.getByText("Generation Failed").count()) === 0,
};
await page.screenshot({ path: path.join(outDir, "flow-result-1440.png") });

// (5) draft restore: a fresh form with a saved draft should come back filled.
await page.reload({ waitUntil: "load" });
await page.waitForSelector('button[data-tab="ai"]', { timeout: 90000 });
await page.locator('button[data-tab="ai"]').click();
await page.waitForSelector('input[name="examTitle"]', { timeout: 30000 }).catch(() => {});
await page.locator('input[name="examTitle"]').fill("Draft check title").catch(() => {});
await page.waitForTimeout(400);
await page.reload({ waitUntil: "load" });
await page.waitForSelector('button[data-tab="ai"]', { timeout: 90000 });
await page.locator('button[data-tab="ai"]').click();
await page.waitForSelector('input[name="examTitle"]', { timeout: 30000 });
await page.waitForTimeout(600);
report.draftRestore = { restoredTitle: await page.locator('input[name="examTitle"]').inputValue(), expected: "Draft check title" };
report.draftRestore.status = report.draftRestore.restoredTitle === "Draft check title" ? "PASS" : "FAIL";

report.pageErrors = pageErrors;
await ctx.close();
await browser.close();
console.log(JSON.stringify(report, null, 2));
