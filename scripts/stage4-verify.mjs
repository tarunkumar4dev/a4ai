// Stage 4 verification gate: extra browser checks on the Attendance tab (Supabase stubbed, no real data, no writes).
// Usage: node scripts/stage4-verify.mjs <baseUrl> <label>
// Covers what scripts/stage4-attendance.mjs does not: monthly % shaped like the live RPC (0.00 when no class was held),
// double-click Save, a server edit-window error, keyboard focus, accessibility-tree roles, sticky Save after scrolling,
// help bubble returning after the sheet, dark mode, 200% zoom (720 px CSS viewport), 768 px.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5299", label = "verify"] = process.argv.slice(2);
const outDir = "docs/screenshots/teacher-dashboard/stage4/verify";
fs.mkdirSync(outDir, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uid = "00000000-0000-0000-0000-000000000001";
const user = { id: uid, email: "teacher@example.test", aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
const session = { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + 3600, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };
const STUDENTS = Array.from({ length: 43 }, (_, i) => ({ id: `stu-${i + 1}`, name: `Student ${String(i + 1).padStart(2, "0")} Kumar`, roll_no: `ECE2-${String(i + 1).padStart(2, "0")}` }));
const SESSION = { batch_id: "b1", batch_name: "ECE-2", section_name: "ECE-2", subject_id: "s1", subject_name: "Data Structures", subject_code: "DSA", timetable_slot_id: "t1", session_id: null, student_count: 43, start_time: "09:30:00", room: "204", is_marked: false };
const TARGETS = [{ batch_id: "b1", batch_name: "ECE-2", section_name: "ECE-2", subject_id: "s1", subject_name: "Data Structures", subject_code: "DSA", student_count: 43, is_mine: true }];
// Same shape as the live get_monthly_attendance: percentage is 0.00 when total_held = 0.
const MONTHLY = [
  { student_id: "stu-1", total_held: 4, percentage: 75 },
  { student_id: "stu-2", total_held: 0, percentage: 0 },
  { student_id: "stu-3", total_held: 2, percentage: null },
  { student_id: "stu-4", total_held: 3, percentage: "abc" },
];

const browser = await chromium.launch();

async function openDashboard(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  await ctx.addInitScript((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(session));
  const state = { saveCalls: 0 };
  await ctx.route(/supabase\.co/, async (r) => {
    const req = r.request();
    const u = req.url();
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("get_my_access")) return json([{ institute_id: "inst-1", primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: ["b1"] }]);
    if (u.includes("/rest/v1/profiles")) return json(one ? { id: uid, role: "teacher", full_name: "Test Teacher", coins: 100, total_coins_earned: 100 } : [{ id: uid, coins: 100 }]);
    if (u.includes("/rest/v1/institute_members")) return json(one ? { institute_id: "inst-1" } : [{ institute_id: "inst-1" }]);
    if (u.includes("/rpc/get_teacher_day_sessions")) return json([SESSION]);
    if (u.includes("/rpc/get_my_teaching_targets")) return json(TARGETS);
    if (u.includes("/rpc/get_my_class_teachers")) return json([]);
    if (u.includes("/rest/v1/students")) return json(STUDENTS);
    if (u.includes("/rest/v1/class_sessions")) return json(one ? null : []);
    if (u.includes("/rest/v1/attendance_records")) return json([]);
    if (u.includes("/rpc/get_monthly_attendance")) return json(MONTHLY);
    if (u.includes("/rpc/save_class_attendance")) {
      state.saveCalls += 1;
      if (opts.saveError) return json({ message: opts.saveError, code: "P0001" }, 400);
      await new Promise((res) => setTimeout(res, opts.saveDelay || 0));
      return json("sess-new");
    }
    if (u.includes("/rpc/")) return json(null);
    return json(one ? null : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(base + "/dashboard", { waitUntil: "load", timeout: 120000 });
  if (opts.dark) {
    // the dashboard's own toggle sets these two classes (TeacherDashboardPage: documentElement + .dashboard-root)
    await page.waitForSelector(".dashboard-root", { timeout: 90000 });
  }
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => b.textContent.trim().startsWith("Attendance")).click());
  await page.waitForSelector(".att-root", { timeout: 60000 });
  if (opts.dark) await page.evaluate(() => { document.documentElement.classList.add("dark"); document.querySelector(".dashboard-root")?.classList.add("dark"); });
  await page.waitForTimeout(1500);
  return { ctx, page, errors, state };
}
const openClass = async (page) => { await page.locator(".att-root button", { hasText: "Data Structures" }).first().click(); await page.waitForTimeout(1500); };
const saveBtn = (page) => page.locator(".att-root").getByRole("button", { name: "Save", exact: true });

// focus ring = outline or box-shadow on the focused element
const tabStops = async (page, n) => {
  const stops = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: "body" };
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
      const name = (el.getAttribute("aria-label") || (el.labels && [...el.labels].map((l) => l.innerText.trim()).join(" ")) || el.innerText || el.getAttribute("placeholder") || "").trim().slice(0, 30);
      return { tag: el.tagName.toLowerCase(), name, ring: !!ring, inAtt: !!el.closest(".att-root") };
    }));
  }
  return stops;
};
const contrast = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bgEl = el, bg = null;
  while (bgEl) { const c = rgb(getComputedStyle(bgEl).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) { bg = c; break; } bgEl = bgEl.parentElement; }
  const fg = rgb(getComputedStyle(el).color);
  if (!bg) return null;
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}, selector);

const report = { label };

// 1. monthly %: only students with classes held + a finite % get "this month"
{
  const { ctx, page } = await openDashboard(1440, 900);
  await openClass(page);
  report.monthlyPct = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".att-root li")].slice(0, 5).map((li) => li.innerText.replace(/\s+/g, " "));
    return { rows, withPct: rows.filter((r) => /this month/.test(r)).length, shows75: rows.some((r) => /75% this month/.test(r)), shows0: rows.some((r) => /0% this month/.test(r) && !/75%/.test(r)), showsNaN: rows.some((r) => /NaN/.test(r)) };
  });
  report.monthlyPct.status = report.monthlyPct.withPct === 1 && report.monthlyPct.shows75 && !report.monthlyPct.showsNaN ? "PASS" : "FAIL";
  // accessibility tree: groups and pressed buttons as an assistive technology sees them
  const sheet = page.locator(".att-root");
  report.a11yTree = {
    studentGroups: await sheet.getByRole("group", { name: /^Attendance for / }).count(),
    presentPressed: await sheet.getByRole("button", { name: "Present", exact: true, pressed: true }).count(),
    absentPressed: await sheet.getByRole("button", { name: "Absent", exact: true, pressed: true }).count(),
    statusRegion: await sheet.getByRole("status").count(),
  };
  await sheet.getByRole("button", { name: "Absent", exact: true }).nth(1).click();
  report.a11yTree.afterMarkingOneAbsent = {
    presentPressed: await sheet.getByRole("button", { name: "Present", exact: true, pressed: true }).count(),
    absentPressed: await sheet.getByRole("button", { name: "Absent", exact: true, pressed: true }).count(),
  };
  // keyboard on the sheet: start from the Back button
  await page.locator(".att-root").getByRole("button", { name: "Back to classes" }).focus();
  report.keyboardSheet = await tabStops(page, 14);
  await ctx.close();
}

// 2. keyboard on the class list
{
  const { ctx, page } = await openDashboard(1440, 900);
  await page.locator(".att-root").getByRole("button", { name: "Previous day" }).focus();
  report.keyboardList = [{ tag: "button", name: "Previous day (start)" }, ...(await tabStops(page, 7))];
  await ctx.close();
}

// 3. double-click Save (slow server) → one request
{
  const { ctx, page, state } = await openDashboard(1440, 900, { saveDelay: 1500 });
  await openClass(page);
  await saveBtn(page).dblclick();
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2500);
  report.doubleSave = { saveCalls: state.saveCalls, status: state.saveCalls === 1 ? "PASS" : "FAIL" };
  // after a successful save, going back needs no confirmation and the help bubble returns
  await page.locator(".att-root").getByRole("button", { name: "Back to classes" }).click();
  await page.waitForTimeout(800);
  report.afterSaveBack = {
    dialog: await page.locator('[role="alertdialog"]').count(),
    onList: await page.locator(".att-sheet").count() === 0,
    helpBubbleVisible: await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /help/i.test(b.getAttribute("aria-label") || "") && b.getClientRects().length > 0)),
  };
  await ctx.close();
}

// 4. server rejects (edit window) → the server's message stays on screen
{
  const msg = "Edit window closed (2 days). Ask your class teacher (proctor).";
  const { ctx, page } = await openDashboard(390, 844, { mobile: true, saveError: msg });
  await openClass(page);
  await saveBtn(page).click();
  await page.waitForTimeout(5000);
  report.serverError = { shown: (await page.locator(".att-root [role=status]").innerText()).includes("Edit window closed"), text: await page.locator(".att-root [role=status]").innerText() };
  await ctx.close();
}

// 5. sticky Save after scrolling (390, 768) and layout at 768 / 200% zoom (720 px)
for (const [w, h, name, mobile] of [[320, 640, "320", true], [390, 844, "390", true], [768, 1024, "768", false], [720, 450, "zoom200", false], [1440, 900, "1440", false]]) {
  const { ctx, page, errors } = await openDashboard(w, h, { mobile });
  await page.screenshot({ path: path.join(outDir, `${label}-list-${name}.png`) });
  const listOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await openClass(page);
  await page.screenshot({ path: path.join(outDir, `${label}-sheet-${name}.png`) });
  // scroll whatever element scrolls the dashboard content
  await page.evaluate(() => {
    let el = document.querySelector(".att-root");
    while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) break; el = el.parentElement; }
    (el && el !== document.body ? el : document.scrollingElement).scrollBy(0, 1500);
  });
  await page.waitForTimeout(500);
  const box = await saveBtn(page).boundingBox();
  const btns = await page.evaluate(() => [...document.querySelectorAll(".att-root .sticky button")].map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), w: Math.round(r.width), right: Math.round(r.right) }; }));
  report[`layout-${name}`] = {
    listOverflow,
    sheetOverflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    saveVisibleAfterScroll: !!box && box.y >= 0 && box.y + box.height <= h && box.x + box.width <= w,
    // a click at Save's centre must land on Save (not on the dashboard header above it)
    saveClickable: !!box && await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest("button") && el.closest("button").innerText.trim() === "Save"; }, [box.x + box.width / 2, box.y + box.height / 2]),
    headerButtons: btns,
    buttonsInsideViewport: btns.every((b) => b.right <= w),
    pageErrors: errors,
  };
  await page.screenshot({ path: path.join(outDir, `${label}-sheet-scrolled-${name}.png`) });
  await ctx.close();
}

// 6. dark mode (the dashboard's dark class), list + sheet, contrast of key text
for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) {
  const { ctx, page } = await openDashboard(w, h, { dark: true, mobile });
  const listTitle = await contrast(page, "#att-day-title");
  await page.screenshot({ path: path.join(outDir, `${label}-dark-list-${w}.png`) });
  await openClass(page);
  report[`dark-${w}`] = {
    listTitleContrast: listTitle,
    studentNameContrast: await contrast(page, ".att-root li p"),
    statusContrast: await contrast(page, ".att-root [role=status]"),
    sheetTitleContrast: await contrast(page, ".att-root h2"),
  };
  await page.screenshot({ path: path.join(outDir, `${label}-dark-sheet-${w}.png`) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
