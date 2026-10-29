// Stage 3 measurement + screenshots: /dashboard/test-generator (stubbed signed-in teacher; no backend calls).
// Usage: node scripts/stage3-measure.mjs <baseUrl> <label>   (label = before | after)
// Writes docs/screenshots/teacher-dashboard/stage3/<label>-<tab>-<width>.png and prints computed values as JSON.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", label = "before"] = process.argv.slice(2);
const outDir = "docs/screenshots/teacher-dashboard/stage3";
fs.mkdirSync(outDir, { recursive: true });
const WIDTHS = [320, 390, 768, 1440];

const browser = await chromium.launch();
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const result = {};
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
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
  const page = await ctx.newPage();
  await page.goto(base + "/dashboard/test-generator", { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector("h1", { timeout: 90000 });
  await page.waitForTimeout(1200);
  // AI Generator tab (the generator form), then screenshot top of page
  const aiTab = page.locator('button[data-tab="ai"]');
  if (await aiTab.count()) { await aiTab.click(); await page.waitForTimeout(800); }
  const measure = await page.evaluate(`(() => {
    const cs = (el) => { if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { weight: s.fontWeight, color: s.color, bg: s.backgroundColor, radius: s.borderRadius, height: Math.round(r.height), font: s.fontFamily.split(",")[0] }; };
    const h1 = document.querySelector("h1");
    const tabs = [...document.querySelectorAll("[data-tab]")].map(b => ({ tab: b.dataset.tab, h: Math.round(b.getBoundingClientRect().height), active: b.className.includes("bg-[#111827]") }));
    const submit = [...document.querySelectorAll("button")].find(b => /Generate/i.test(b.textContent) && b.type === "submit") || [...document.querySelectorAll("button")].find(b => /Generate/i.test(b.textContent));
    const orbs = document.querySelectorAll(".blur-\\\\[60px\\\\], [class*='blur-[120px]'], [class*='blur-[60px]']").length;
    return { h1: cs(h1), h1Text: h1 && h1.textContent.trim().slice(0, 40), rootBg: getComputedStyle(document.querySelector(".fixed.inset-0")).backgroundColor, rootColor: getComputedStyle(document.querySelector(".fixed.inset-0")).color, tabs, submit: cs(submit), submitText: submit && submit.textContent.trim().slice(0, 30), blurOrbs: orbs, hasPro: document.body.innerText.toLowerCase().includes("pro plan"), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  result[`width-${width}`] = measure;
  await page.screenshot({ path: path.join(outDir, `${label}-ai-${width}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(result, null, 2));
