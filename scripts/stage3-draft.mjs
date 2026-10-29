// Stage 3b checks on /dashboard/test-generator (backend + Supabase stubbed; no real AI call).
// Usage: node scripts/stage3-draft.mjs <baseUrl> <label>
// (1) a saved draft restores class, subject AND the row's chapter; (2) a broken draft does not crash the page;
// (3) signing out removes generator drafts; (4) row editor: control count and accessible names at 390 / 1440.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", label = "after"] = process.argv.slice(2);
const outDir = "docs/screenshots/teacher-dashboard/stage3";
fs.mkdirSync(outDir, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };
const KEY = `a4ai.testgen.draft.v1.${uid}`;
const row = { id: "r1", topic: "Polynomials", quantity: 5, marks: 1, difficulty: "Medium", format: "MCQ" };
const draftOf = (data) => JSON.stringify({ v: 1, savedAt: Date.now(), data });
const goodDraft = draftOf({ examTitle: "Draft: Unit 2", classGrade: "Class 9", subject: "Maths", simpleData: [row] });
const badDraft = draftOf({ examTitle: "Bad draft", simpleData: "garbage", classGrade: 42 });
const CHAPTERS = { Maths: ["Number Systems", "Polynomials", "Coordinate Geometry"], Science: ["Chemical Reactions", "Life Processes", "Light"] };

const browser = await chromium.launch();
async function open(width, draft) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
  await ctx.addInitScript(([s, k, d]) => {
    if (sessionStorage.getItem("seeded")) return; // seed once per tab, so a reload shows what the app saved
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("a4ai.auth.token", s);
    if (d) localStorage.setItem(k, d); else localStorage.removeItem(k);
  }, [JSON.stringify(session), KEY, draft]);
  await ctx.route(/supabase\.co/, (r) => {
    const u = r.request().url();
    const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/logout")) return r.fulfill({ status: 204, body: "" });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("get_my_access")) return json([{ institute_id: null, primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
    if (u.includes("/rest/v1/profiles")) return json(r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
    if (u.includes("/rpc/")) return json(null);
    return json([]);
  });
  await ctx.route(/test-generator\/chapters/, (r) => {
    const subject = new URL(r.request().url()).searchParams.get("subject") || "Science";
    const chapters = CHAPTERS[subject] || CHAPTERS.Science;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, subject, classGrade: "9", chapters, count: chapters.length }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(base + "/dashboard/test-generator", { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector('input[name="examTitle"]', { timeout: 90000 });
  await page.waitForTimeout(1500); // chapters fetch + effects
  return { ctx, page, errors };
}

// Chapter select = a select whose options contain a known chapter. "Visible" = it has a layout box.
const rowState = (page) => page.evaluate((all) => {
  const known = new Set(all);
  const nameOf = (el) => (el.getAttribute("aria-label") || (el.labels && [...el.labels].map((l) => l.textContent).join(" ")) || el.getAttribute("title") || "").trim();
  const chapterSelects = [...document.querySelectorAll("select")].filter((s) => [...s.options].some((o) => known.has(o.value)));
  const visible = chapterSelects.filter((s) => s.getClientRects().length > 0);
  // the row editor = the card that holds the "Add Chapter Section" button
  const addBtn = [...document.querySelectorAll("button")].find((b) => /Add Chapter/.test(b.textContent));
  const editor = addBtn?.parentElement || document;
  const editorSelects = [...editor.querySelectorAll("select")];
  const iconButtons = [...editor.querySelectorAll("button")].filter((b) => !b.textContent.trim());
  return {
    chapterSelectsInDom: chapterSelects.length,
    chapterSelectsVisible: visible.length,
    chapterValue: visible[0]?.value ?? null,
    optionsInDocument: document.querySelectorAll("option").length,
    editorSelectsInDom: editorSelects.length,
    editorSelectsVisible: editorSelects.filter((s) => s.getClientRects().length > 0).length,
    visibleSelectsWithoutName: editorSelects.filter((s) => s.getClientRects().length > 0 && !nameOf(s)).length,
    visibleIconButtonsWithoutName: iconButtons.filter((b) => b.getClientRects().length > 0 && !b.getAttribute("aria-label")).length,
    duplicateIds: (() => { const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); return ids.length - new Set(ids).size; })(),
  };
}, [...CHAPTERS.Maths, ...CHAPTERS.Science]);

const report = { label };

// (1) restore
{
  const { ctx, page, errors } = await open(1440, goodDraft);
  const r = {
    title: await page.locator('input[name="examTitle"]').inputValue(),
    classGrade: await page.locator('select[name="classGrade"]').inputValue(),
    subject: await page.locator('select[name="subject"]').inputValue(),
    chapter: (await rowState(page)).chapterValue,
    pageErrors: errors,
  };
  r.status = r.title === "Draft: Unit 2" && r.classGrade === "Class 9" && r.subject === "Maths" && r.chapter === "Polynomials" ? "PASS" : "FAIL";
  report.restore = r;
  await page.screenshot({ path: path.join(outDir, `${label}-draft-restore-1440.png`) });
  // a reload shows what the app itself saved back
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('input[name="examTitle"]', { timeout: 90000 });
  await page.waitForTimeout(1500);
  report.restoreAfterReload = { chapter: (await rowState(page)).chapterValue };
  report.restoreAfterReload.status = report.restoreAfterReload.chapter === "Polynomials" ? "PASS" : "FAIL";
  await ctx.close();
}

// (2) broken draft
{
  const { ctx, page, errors } = await open(1440, badDraft);
  const r = {
    title: await page.locator('input[name="examTitle"]').inputValue(),
    classGrade: await page.locator('select[name="classGrade"]').inputValue(),
    rowsVisible: (await rowState(page)).chapterSelectsVisible,
    pageErrors: errors,
  };
  r.status = errors.length === 0 && r.rowsVisible >= 1 ? "PASS" : "FAIL";
  report.brokenDraft = r;
  await ctx.close();
}

// (3) sign-out clears drafts
{
  const { ctx, page } = await open(1440, goodDraft);
  const count = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("a4ai.testgen.draft.")).length);
  const before = await count();
  await page.goto(base + "/dashboard", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.locator("button", { hasText: "Test Teacher" }).first().click();
  await page.getByRole("button", { name: /Logout/ }).click();
  await page.waitForTimeout(1500);
  const after = await count();
  report.signOut = { draftsBefore: before, draftsAfter: after, path: new URL(page.url()).pathname, status: before > 0 && after === 0 ? "PASS" : "FAIL" };
  await ctx.close();
}

// (4) row editor with 3 rows
for (const width of [390, 1440]) {
  const three = draftOf({ examTitle: "Rows", classGrade: "Class 9", subject: "Maths", simpleData: [row, { ...row, id: "r2" }, { ...row, id: "r3" }] });
  const { ctx, page, errors } = await open(width, three);
  report[`editor-${width}`] = { ...(await rowState(page)), pageErrors: errors };
  await page.screenshot({ path: path.join(outDir, `${label}-rows-${width}.png`), fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
