// Stage 3b: element screenshot of the AI generator's row editor (3 rows) at 390 and 1440. Usage: node scripts/stage3-editor-shot.mjs <baseUrl> <label>
import { chromium } from "playwright";
const [base = "http://localhost:5299", label = "after"] = process.argv.slice(2);
const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256" })}.${enc({ sub: uid, exp: now + 3600 })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };
const row = { id: "r1", topic: "Polynomials", quantity: 5, marks: 1, difficulty: "Medium", format: "MCQ" };
const draft = JSON.stringify({ v: 1, savedAt: Date.now(), data: { examTitle: "Rows", classGrade: "Class 9", subject: "Maths", simpleData: [row, { ...row, id: "r2", topic: "Number Systems", format: "Short" }, { ...row, id: "r3", topic: "" }] } });
const browser = await chromium.launch();
for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600 });
  await ctx.addInitScript(([s, d, k]) => { localStorage.setItem("a4ai.auth.token", s); localStorage.setItem(k, d); }, [JSON.stringify(session), draft, `a4ai.testgen.draft.v1.${uid}`]);
  await ctx.route(/supabase\.co/, (r) => r.request().url().includes("/auth/v1/user") ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }) : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.route(/test-generator\/chapters/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, chapters: ["Number Systems", "Polynomials", "Coordinate Geometry"], count: 3 }) }));
  const page = await ctx.newPage();
  await page.goto(base + "/dashboard/test-generator", { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector('input[name="examTitle"]', { timeout: 90000 });
  await page.waitForTimeout(1500);
  const editor = page.locator("button", { hasText: "Add Chapter Section" }).locator("..");
  await editor.scrollIntoViewIfNeeded();
  await editor.screenshot({ path: `docs/screenshots/teacher-dashboard/stage3/${label}-editor-${width}.png` });
  await ctx.close();
}
await browser.close();
console.log("ok");
