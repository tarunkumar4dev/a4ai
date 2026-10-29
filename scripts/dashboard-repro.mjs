// Reproduces the two Test History defects on a stubbed teacher session.
// Usage: node scripts/dashboard-repro.mjs <baseUrl> <outDir>
//   - desktop 1440: title width of the first test row
//   - phone 390: scroll the content to the bottom, then check whether the help bubble covers a row action
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", outDir = "docs/screenshots/teacher-dashboard/landing-parity", label = "after"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };
const sample = [
  { id: "t1", exam_title: "Chapter 3 Polynomials — Unit Test with Long Descriptive Title for Layout Checking", board: "CBSE", class_grade: "10", subject: "Mathematics", status: "saved", total_questions: 20, total_marks: 40, created_at: new Date().toISOString() },
  { id: "t2", exam_title: "Light and Reflection", board: "CBSE", class_grade: "8", subject: "Science", status: "draft", total_questions: 12, total_marks: 30, created_at: new Date().toISOString() },
  { id: "t3", exam_title: "Real Numbers", board: "CBSE", class_grade: "10", subject: "Mathematics", status: "saved", total_questions: 10, total_marks: 20, created_at: new Date().toISOString() },
];

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
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
  // the shell appears last; wait for the sidebar, then click Test History
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("aside button")].find((b) => b.textContent.trim().startsWith("Test History"));
    btn?.click();
  });
  // wait for a Test History row, not just any h4 (the home tab has h4s too)
  await page.waitForFunction(() => document.body.innerText.includes("Access, preview, and download"), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

// Desktop
{
  const { ctx, page } = await open(1440, 900);
  const info = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h4")].find((x) => x.textContent.includes("Chapter 3"));
    const r = h.getBoundingClientRect();
    return { titleWidth: Math.round(r.width), scrollW: h.scrollWidth, clientW: h.clientWidth, text: h.textContent.trim().slice(0, 30) };
  });
  console.log("desktop 1440:", JSON.stringify(info));
  await page.screenshot({ path: path.join(outDir, `test-history-desktop-${label}.png`) });
  await ctx.close();
}

// Phone: scroll the main content to the very bottom, then find the bubble and the last row's buttons.
{
  const { ctx, page } = await open(390, 844);
  await page.evaluate(() => {
    const main = document.querySelector("main");
    main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const bubble = document.querySelector('button[aria-label*="assistant" i], button[aria-label*="chat" i], [class*="z-[110]"] button');
    const br = bubble?.getBoundingClientRect();
    const btns = [...document.querySelectorAll("main button")].filter((b) => /Preview|Paper PDF|Answer Key|Check copies/.test(b.textContent));
    const lastRowBtns = btns.slice(-4).map((b) => b.getBoundingClientRect());
    const overlaps = br ? lastRowBtns.filter((r) => r.bottom > br.top && r.top < br.bottom && r.right > br.left && r.left < br.right).length : -1;
    return { bubble: br ? { top: Math.round(br.top), left: Math.round(br.left), w: Math.round(br.width), h: Math.round(br.height) } : null, overlappingActions: overlaps, lastActionBottom: lastRowBtns.length ? Math.round(lastRowBtns[lastRowBtns.length - 1].bottom) : null };
  });
  console.log("phone 390 at bottom:", JSON.stringify(info));
  await page.screenshot({ path: path.join(outDir, `test-history-mobile-${label}.png`) });
  await ctx.close();
}
await browser.close();
