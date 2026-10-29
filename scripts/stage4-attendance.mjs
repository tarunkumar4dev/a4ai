// Stage 4: teacher dashboard → Attendance tab, with Supabase stubbed (no real data, no writes).
// Usage: node scripts/stage4-attendance.mjs <baseUrl> <label>
// Writes docs/screenshots/teacher-dashboard/stage4/<label>-*.png and prints a JSON report.
// Scenarios: landing layout (320/390/768/1440) · open a never-marked class · mark + save (first save fails) ·
// previously marked class whose records fail to load · class list fails to load · teacher with no institute.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", label = "before"] = process.argv.slice(2);
const outDir = "docs/screenshots/teacher-dashboard/stage4";
fs.mkdirSync(outDir, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };

const STUDENTS = Array.from({ length: 43 }, (_, i) => ({ id: `stu-${i + 1}`, name: `Student ${String(i + 1).padStart(2, "0")} Kumar`, roll_no: `ECE2-${String(i + 1).padStart(2, "0")}` }));
const SESSION = { batch_id: "b1", batch_name: "ECE-2", section_name: "ECE-2", subject_id: "s1", subject_name: "Data Structures", subject_code: "DSA", timetable_slot_id: "t1", session_id: null, student_count: 43, start_time: "09:30:00", room: "204", is_marked: false };
const TARGETS = [
  { batch_id: "b1", batch_name: "ECE-2", section_name: "ECE-2", subject_id: "s1", subject_name: "Data Structures", subject_code: "DSA", student_count: 43, is_mine: true },
  { batch_id: "b2", batch_name: "ECE-2 A", section_name: "ECE-2", subject_id: "s2", subject_name: "DSA Lab", subject_code: "DSAL", student_count: 15, is_mine: true },
];

const browser = await chromium.launch();

// opts: noInstitute, targetsFail, marked (session already has records), recordsFail
async function openDashboard(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
  await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
  const state = { saveCalls: 0, lastSave: null };
  await ctx.route(/supabase\.co/, async (r) => {
    const req = r.request();
    const u = req.url();
    const accept = req.headers()["accept"] || "";
    const one = accept.includes("vnd.pgrst.object");
    const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const fail = () => json({ message: "stub failure", code: "XX000" }, 500);
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("get_my_access")) return json([{ institute_id: opts.noInstitute ? null : "inst-1", primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: ["b1", "b2"] }]);
    if (u.includes("/rest/v1/profiles")) return json(one ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
    if (u.includes("/rest/v1/institute_members")) {
      const row = opts.noInstitute ? null : { institute_id: "inst-1" };
      return json(one ? row : row ? [row] : []);
    }
    if (u.includes("/rest/v1/institutes")) return json(one ? null : []);
    if (u.includes("/rpc/get_teacher_day_sessions")) return json([{ ...SESSION, session_id: opts.marked ? "sess-1" : null, is_marked: !!opts.marked }]);
    if (u.includes("/rpc/get_my_teaching_targets")) return opts.targetsFail ? fail() : json(TARGETS);
    if (u.includes("/rpc/get_my_class_teachers")) return json([{ batch_id: "b1", proctor_user_id: "p1", proctor_name: "R. Sharma" }]);
    if (u.includes("/rest/v1/students")) return json(STUDENTS);
    if (u.includes("/rest/v1/class_sessions")) return json(one ? (opts.marked ? { id: "sess-1" } : null) : (opts.marked ? [{ id: "sess-1" }] : []));
    if (u.includes("/rest/v1/attendance_records")) {
      if (opts.recordsFail) return fail();
      return json(opts.marked ? STUDENTS.map((s, i) => ({ student_id: s.id, status: i < 5 ? "absent" : "present" })) : []);
    }
    if (u.includes("/rpc/get_monthly_attendance")) return json([]);
    if (u.includes("/rpc/save_class_attendance")) {
      state.saveCalls += 1;
      state.lastSave = req.postDataJSON();
      if (state.saveCalls === 1) return fail();
      return json("sess-new");
    }
    if (u.includes("/rpc/")) return json(null);
    return json(one ? null : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(base + "/dashboard", { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("aside button")].find((b) => b.textContent.trim().startsWith("Attendance"));
    btn.click();
  });
  await page.waitForSelector(".att-root", { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors, state };
}

const text = (page) => page.evaluate(() => document.querySelector(".att-root")?.innerText || "");
const unnamedButtons = (page) => page.evaluate(() => [...document.querySelectorAll(".att-root button, .att-root select, .att-root input")]
  .filter((b) => b.getClientRects().length > 0)
  .filter((b) => !(b.getAttribute("aria-label") || (b.labels && b.labels.length) || b.textContent.trim() || b.getAttribute("placeholder"))).length);
// Help bubble (StaticSarthi) vs. a target element: overlap in px²
const overlapWith = (page, selector) => page.evaluate((sel) => {
  const t = document.querySelector(sel);
  const bubble = [...document.querySelectorAll("button")].find((b) => /help|sarthi|chat/i.test(b.getAttribute("aria-label") || ""));
  if (!t || !bubble) return null;
  const a = t.getBoundingClientRect(), b = bubble.getBoundingClientRect();
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return Math.round(w * h);
}, selector);
const openClass = async (page) => {
  await page.locator(".att-root button", { hasText: "Data Structures" }).first().click();
  await page.waitForTimeout(1500);
};

const report = { label };

// 1. landing at 4 widths
for (const width of [320, 390, 768, 1440]) {
  const { ctx, page, errors } = await openDashboard(width);
  report[`landing-${width}`] = await page.evaluate(() => {
    const root = document.querySelector(".att-root");
    const first = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Data Structures"));
    const r0 = root.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootHeight: Math.round(r0.height),
      firstClassTop: first ? Math.round(first.getBoundingClientRect().top - r0.top) : null,
      blurLayers: [...root.querySelectorAll("*")].filter((e) => getComputedStyle(e).backdropFilter !== "none").length,
      gradients: [...root.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundImage.includes("gradient")).length,
    };
  });
  report[`landing-${width}`].unnamedControls = await unnamedButtons(page);
  report[`landing-${width}`].pageErrors = errors;
  report[`landing-${width}`].helpBubbleVisible = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /help/i.test(b.getAttribute("aria-label") || "") && b.getClientRects().length > 0));
  await page.screenshot({ path: path.join(outDir, `${label}-landing-${width}.png`) });
  await ctx.close();
}

// 2. never-marked class: what does the sheet say, can it be saved as is?
for (const width of [390, 1440]) {
  const { ctx, page, errors, state } = await openDashboard(width);
  await openClass(page);
  const t = await text(page);
  const saveBtn = page.locator(".att-root button", { hasText: /^Save/ }).first();
  report[`newSheet-${width}`] = {
    saysSaved: /\bSaved\b/.test(t) && !/Not saved/i.test(t),
    saysNotSaved: /not saved/i.test(t),
    saveEnabled: await saveBtn.isEnabled(),
    sheetHeight: await page.evaluate(() => Math.round(document.querySelector(".att-root").getBoundingClientRect().height)),
    unnamedControls: await unnamedButtons(page),
    pressedStateExposed: await page.evaluate(() => document.querySelectorAll(".att-root [aria-pressed]").length),
    pageErrors: errors,
  };
  await page.screenshot({ path: path.join(outDir, `${label}-sheet-${width}.png`) });
  // leaving an unsaved sheet asks first; Esc closes the question and keeps the sheet
  if (width === 1440) {
    await page.locator(".att-root button").first().click();
    await page.waitForTimeout(400);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector('[role="alertdialog"]');
      return { open: !!d, text: d ? d.innerText.slice(0, 80) : null, focusInside: !!d && d.contains(document.activeElement) };
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    report.leaveUnsaved = { ...dlg, closedByEsc: (await page.locator('[role="alertdialog"]').count()) === 0, stillOnSheet: (await page.locator(".att-sheet").count()) === 1 };
  }
  // mark the 3rd student absent, save → first save fails
  if (width === 390) {
    const absentBtn = page.locator(".att-root").getByRole("button", { name: "Absent", exact: true }).nth(2);
    await absentBtn.click();
    await saveBtn.click();
    await page.waitForTimeout(5000); // longer than a toast's life
    const afterFail = await text(page);
    report.saveFailure = {
      errorStillVisibleAfter5s: /could not save|not saved|save failed|stub failure/i.test(afterFail),
      saveCalls: state.saveCalls,
    };
    await page.screenshot({ path: path.join(outDir, `${label}-save-failed-390.png`) });
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const recs = state.lastSave?.p_records || [];
    report.saveRetry = {
      saveCalls: state.saveCalls,
      records: recs.length,
      absent: recs.filter((r) => r.status === "absent").map((r) => r.student_id),
      statusText: (await text(page)).match(/Saved[^\n]*/)?.[0] || null,
    };
    report.bubbleOverSave = await overlapWith(page, ".att-root .sticky");
    report.helpBubbleVisibleOnSheet = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /help/i.test(b.getAttribute("aria-label") || "") && b.getClientRects().length > 0));
  }
  await ctx.close();
}

// 3. previously marked class, records fail to load
{
  const { ctx, page } = await openDashboard(390, { marked: true, recordsFail: true });
  await openClass(page);
  const t = await text(page);
  const presentPressed = await page.evaluate(() => [...document.querySelectorAll(".att-root button")].filter((b) => (b.getAttribute("aria-label") || b.textContent.trim()) === "Present" && (b.getAttribute("aria-pressed") === "true" || b.className.includes("bg-emerald-500 "))).length);
  report.recordsFail = {
    sheetShowsStudents: presentPressed > 0,
    studentsShownAsPresent: presentPressed,
    errorShown: /could not load|couldn't load|failed/i.test(t),
  };
  await page.screenshot({ path: path.join(outDir, `${label}-records-failed-390.png`) });
  await ctx.close();
}

// 3b. previously marked class loads its saved marks
{
  const { ctx, page } = await openDashboard(390, { marked: true });
  await openClass(page);
  report.markedLoads = { absentShown: await page.evaluate(() => [...document.querySelectorAll(".att-root button")].filter((b) => (b.getAttribute("aria-label") || b.textContent.trim()) === "Absent" && (b.getAttribute("aria-pressed") === "true" || b.className.includes("bg-red-500 "))).length) };
  await ctx.close();
}

// 4. class list fails to load
{
  const { ctx, page } = await openDashboard(390, { targetsFail: true });
  const t = await text(page);
  report.listFail = { saysNoClassesAssigned: /No classes assigned/i.test(t), errorShown: /could not load|couldn't load|failed/i.test(t), retryButton: await page.locator(".att-root button", { hasText: /Try again|Retry/ }).count() };
  await page.screenshot({ path: path.join(outDir, `${label}-list-failed-390.png`) });
  await ctx.close();
}

// 5. teacher with no institute
{
  const { ctx, page } = await openDashboard(390, { noInstitute: true });
  const t = await text(page);
  report.noInstitute = { saysAskHod: /Ask your HOD/i.test(t), mentionsInstitute: /institute/i.test(t), joinLink: await page.locator('.att-root a[href*="join-institute"]').count() };
  await page.screenshot({ path: path.join(outDir, `${label}-no-institute-390.png`) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
