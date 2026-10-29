// Stage 2 measurement + screenshots: dashboard home (stubbed teacher session) and landing page.
// Usage: node scripts/stage2-measure.mjs <baseUrl> <label>   (label = before | after)
// Writes docs/screenshots/teacher-dashboard/stage2/<label>-<width>.png and prints computed styles as JSON.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", label = "before"] = process.argv.slice(2);
const outDir = "docs/screenshots/teacher-dashboard/stage2";
fs.mkdirSync(outDir, { recursive: true });
const WIDTHS = [320, 390, 768, 1440];

const browser = await chromium.launch();
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const cs = (sel) => `(() => { const el = ${sel}; if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { weight: s.fontWeight, size: s.fontSize, color: s.color, bg: s.backgroundColor, radius: s.borderRadius, height: Math.round(r.height), top: Math.round(r.top), font: s.fontFamily.split(",")[0] }; })()`;

const result = {};

// Landing page (regression reference) at 1440 and 390.
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load", timeout: 180000 });
  await page.waitForSelector("h1");
  await page.waitForTimeout(600);
  result[`landing-${width}`] = {
    h1: await page.evaluate(`(() => { const el = document.querySelector("h1"); const s = getComputedStyle(el); return { weight: s.fontWeight, color: s.color, size: s.fontSize, font: s.fontFamily.split(",")[0] }; })()`),
    primaryCta: await page.evaluate(`(() => { const a = [...document.querySelectorAll("a")].find(x => x.textContent.includes("Try for FREE")); if (!a) return null; const s = getComputedStyle(a); return { bg: s.backgroundColor, color: s.color, radius: s.borderRadius, height: Math.round(a.getBoundingClientRect().height) }; })()`),
    bodyColor: await page.evaluate(`getComputedStyle(document.querySelector("main") || document.body).color`),
    overflow: await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth"),
  };
  if (width === 1440) await page.screenshot({ path: path.join(outDir, `landing-${label}-1440.png`) });
  await ctx.close();
}

// Dashboard home at each width.
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
  await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
  await ctx.route(/supabase\.co/, (r) => {
    const u = r.request().url();
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("get_my_access")) return json([{ institute_id: null, primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
    if (u.includes("/rest/v1/tests")) return json([{ id: "t1", exam_title: "Chapter 3 Polynomials — Unit Test", board: "CBSE", class_grade: "10", subject: "Mathematics", status: "saved", total_questions: 20, total_marks: 40, created_at: new Date().toISOString() }]);
    if (u.includes("/rest/v1/profiles")) return json(r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
    if (u.includes("/rpc/")) return json(null);
    return json([]);
  });
  const page = await ctx.newPage();
  await page.goto(base + "/dashboard", { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const dash = {
    h1s: await page.evaluate(`[...document.querySelectorAll("h1")].map(h => { const s = getComputedStyle(h); return { text: h.textContent.trim().slice(0, 30), weight: s.fontWeight, color: s.color, size: s.fontSize }; })`),
    heroCta: await page.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith("Create Test") && x.closest("main")); if (!b) return null; const s = getComputedStyle(b); const r = b.getBoundingClientRect(); return { bg: s.backgroundColor, color: s.color, radius: s.borderRadius, height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), visibleInViewport: r.bottom <= innerHeight }; })()`),
    rootColor: await page.evaluate(`getComputedStyle(document.querySelector(".dashboard-root")).color`),
    rootBg: await page.evaluate(`getComputedStyle(document.querySelector(".dashboard-root")).backgroundColor`),
    overflow: await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth"),
    navButtons: await page.evaluate(`document.querySelectorAll("aside button").length`),
  };
  result[`dashboard-${width}`] = dash;
  await page.screenshot({ path: path.join(outDir, `${label}-${width}.png`), fullPage: false });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(result, null, 2));
