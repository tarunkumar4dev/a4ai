// Stage 3b: keyboard path through the AI generator's row editor (stubbed session + backend).
// Usage: node scripts/stage3-keyboard.mjs <baseUrl>
// Focuses section 1's chapter control and presses Tab through the row; every stop must be a visible, named control.
import { chromium } from "playwright";

const [base = "http://localhost:5299"] = process.argv.slice(2);
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const browser = await chromium.launch();
const report = {};
for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
  await ctx.route(/supabase\.co/, (r) => {
    const u = r.request().url();
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("/rpc/")) return json(null);
    return json([]);
  });
  await ctx.route(/test-generator\/chapters/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, chapters: ["Chemical Reactions", "Life Processes", "Light"], count: 3 }) }));
  const page = await ctx.newPage();
  await page.goto(base + "/dashboard/test-generator", { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector('input[name="examTitle"]', { timeout: 90000 });
  await page.waitForTimeout(1500);
  const first = page.locator("select").filter({ has: page.locator("option", { hasText: "Light" }) }).first();
  await first.focus();
  const stops = [];
  for (let i = 0; i < 12; i++) {
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      const name = (el.getAttribute("aria-label") || (el.labels && [...el.labels].map((l) => l.textContent.trim()).join(" ")) || el.textContent.trim()).slice(0, 40);
      return { tag: el.tagName.toLowerCase(), name, visible: el.getClientRects().length > 0, pressed: el.getAttribute("aria-pressed") };
    }));
    await page.keyboard.press("Tab");
  }
  report[`width-${width}`] = {
    stops,
    allVisible: stops.every((s) => s.visible),
    allNamed: stops.every((s) => s.name),
  };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
