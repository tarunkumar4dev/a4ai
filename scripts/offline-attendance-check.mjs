// Offline attendance queue, checked in a real browser: real IndexedDB + WebCrypto + UI, Supabase stubbed by an
// in-memory server below. Every supabase.co request is intercepted: no real data, nothing reaches the live project.
// Usage: npm run build && npx vite preview --port 5299   then   node scripts/offline-attendance-check.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";
import fs from "fs";

const [base = "http://localhost:5299", shots = ""] = process.argv.slice(2);
if (shots) fs.mkdirSync(shots, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INST = "10000000-0000-4000-8000-000000000001";
const BATCH = "20000000-0000-4000-8000-000000000002";
const SUBJECT = "30000000-0000-4000-8000-000000000003";
const SLOT = "40000000-0000-4000-8000-000000000004";
const SID = "50000000-0000-4000-8000-000000000005";
const stuId = (i) => `60000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const STUDENTS = Array.from({ length: 6 }, (_, i) => ({ id: stuId(i + 1), name: `Student ${i + 1}`, roll_no: `R${i + 1}` }));

const sessionFor = (uid, ttl = 3600) => {
  const user = { id: uid, email: `${uid.slice(0, 1)}@example.test`, aud: "authenticated", role: "authenticated", user_metadata: { full_name: "Test Teacher", role: "teacher" }, app_metadata: {} };
  return { access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, exp: now + ttl, role: "authenticated" })}.sig`, refresh_token: "r", expires_at: now + ttl, expires_in: ttl, token_type: "bearer", user };
};

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== "" ? `  → ${JSON.stringify(detail)}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(150); }
  return false;
}

async function start(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // first run only: a reload must keep whichever user a scenario signed in
  await ctx.addInitScript((s) => { if (!localStorage.getItem("a4ai.auth.token")) localStorage.setItem("a4ai.auth.token", s); }, JSON.stringify(sessionFor(opts.uid || UID_A, opts.longToken ? 30 * 24 * 3600 : 3600)));
  const srv = {
    sessionId: null, marks: {}, saves: [],
    down: false, // every Supabase data call fails like a dead network
    hang: false, // the save never gets a reply
    loseReply: false, // the save is applied, then the reply is lost
    reject: null,
  };
  await ctx.route(/supabase\.co/, async (r) => {
    const req = r.request();
    const u = req.url();
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/")) return json(sessionFor(opts.uid || UID_A).user);
    if (srv.down && (u.includes("/rest/v1/class_sessions") || u.includes("/rest/v1/attendance_records") || u.includes("save_class_attendance"))) return r.abort("failed");
    if (u.includes("get_my_access")) return json([{ institute_id: INST, primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [BATCH] }]);
    if (u.includes("/rest/v1/profiles")) return json(one ? { id: UID_A, role: "teacher", full_name: "Test Teacher", coins: 0 } : [{ id: UID_A, coins: 0 }]);
    if (u.includes("/rest/v1/institute_members")) return json(one ? { institute_id: INST } : [{ institute_id: INST }]);
    if (u.includes("/rpc/get_teacher_day_sessions")) return json([{ batch_id: BATCH, batch_name: "ECE-2", section_name: "ECE-2", subject_id: SUBJECT, subject_name: "Data Structures", subject_code: "DSA", timetable_slot_id: SLOT, session_id: null, student_count: 6, start_time: "09:30:00", room: "204", is_marked: !!srv.sessionId }]);
    if (u.includes("/rpc/get_my_teaching_targets")) return json([{ batch_id: BATCH, batch_name: "ECE-2", section_name: "ECE-2", subject_id: SUBJECT, subject_name: "Data Structures", student_count: 6, is_mine: true }]);
    if (u.includes("/rest/v1/students")) return json(STUDENTS);
    if (u.includes("/rest/v1/class_sessions")) {
      const row = srv.sessionId ? { id: srv.sessionId, teacher_id: UID_A, status: "conducted", created_at: "2026-11-01T00:00:00Z" } : null;
      return json(one ? row : row ? [row] : []);
    }
    if (u.includes("/rest/v1/attendance_records")) return json(Object.entries(srv.marks).map(([student_id, status]) => ({ student_id, status })));
    if (u.includes("/rpc/save_class_attendance")) {
      const body = req.postDataJSON();
      srv.saves.push(body);
      if (srv.hang) return; // never fulfilled: the client's timeout has to end it
      if (srv.reject) return json({ message: srv.reject, code: "P0001" }, 400);
      srv.sessionId = SID;
      srv.marks = Object.fromEntries(body.p_records.map((x) => [x.student_id, x.status]));
      if (srv.loseReply) { srv.loseReply = false; return r.abort("failed"); }
      return json(SID);
    }
    if (u.includes("/rpc/")) return json(null);
    return json(one ? null : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(base + "/dashboard", { waitUntil: "load", timeout: 120000 });
  await gotoAttendance(page);
  return { ctx, page, srv, errors };
}
async function gotoAttendance(page) {
  await page.waitForFunction(() => document.querySelectorAll("aside button").length > 5, null, { timeout: 90000 });
  await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => b.textContent.trim().startsWith("Attendance")).click());
  await page.waitForSelector(".att-root", { timeout: 60000 });
  await page.waitForTimeout(800);
}
const openClass = async (page) => {
  await page.locator(".att-root button", { hasText: "Data Structures" }).first().click();
  await page.waitForSelector(".att-sheet li", { timeout: 15000 });
};
const markAbsent = (page, n) => page.locator(".att-sheet").getByRole("button", { name: "Absent", exact: true }).nth(n).click();
const save = (page) => page.locator(".att-root").getByRole("button", { name: "Save", exact: true }).click();
const status = (page) => page.locator(".att-root [role=status]").innerText();
const back = (page) => page.locator(".att-root").getByRole("button", { name: "Back to classes" }).click();
const panel = (page) => page.locator('[data-testid="pending-saves"]');
const dump = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open("a4ai-offline");
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const t = db.transaction(["records", "keys"]);
    const recs = t.objectStore("records").getAll();
    const keys = t.objectStore("keys").getAll();
    t.oncomplete = () => {
      resolve({
        count: recs.result.length,
        users: recs.result.map((r) => r.userId),
        keys: keys.result.length,
        extractable: keys.result.map((k) => k.extractable),
        fields: recs.result[0] ? Object.keys(recs.result[0]).sort() : [],
        bytes: recs.result.map((r) => Array.from(new Uint8Array(r.data))),
        plain: recs.result.map(({ data, iv, ...rest }) => JSON.stringify(rest)),
      });
      db.close();
    };
  };
}));
const text = (bytes) => Buffer.from(bytes).toString("latin1");
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

/* 1 ─ offline: kept on the device, encrypted, then synced on reconnect */
{
  const { ctx, page, srv, errors } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  check("offline save: told 'saved on this device', not 'saved'", /Saved on this device/.test(await status(page)));
  check("offline save: no request sent", srv.saves.length === 0);
  await shot(page, "1-sheet-saved-on-device");

  const d = await dump(page);
  check("stored: exactly one record, owned by this user", d.count === 1 && d.users[0] === UID_A, d);
  check("stored: key can't be exported", d.extractable.length === 1 && d.extractable[0] === false);
  const raw = text(d.bytes[0]) + d.plain[0];
  check("stored: no student id / subject / class / status readable", ![stuId(2), "Data Structures", "ECE-2", "absent", BATCH].some((s) => raw.includes(s)));
  check("stored: only id, user, rev, expiry, iv, data", JSON.stringify(d.fields) === JSON.stringify(["data", "expiresAt", "id", "iv", "rev", "userId"]), d.fields);

  await back(page);
  check("leaving after a device save needs no 'unsaved' warning", (await page.locator('[role="alertdialog"]').count()) === 0);
  await panel(page).waitFor({ timeout: 5000 });
  check("list offline: pending panel shows the class", (await panel(page).innerText()).includes("Data Structures"));
  await shot(page, "2-list-pending");

  await ctx.setOffline(false);
  check("reconnect: synced on its own", await until(() => srv.saves.length === 1), srv.saves.length);
  const sent = srv.saves[0];
  check("reconnect: right class, right date, right marks", sent && sent.p_batch_id === BATCH && sent.p_subject_id === SUBJECT && sent.p_timetable_slot_id === SLOT && sent.p_records.find((x) => x.student_id === stuId(2))?.status === "absent", sent);
  check("reconnect: local copy deleted", await until(async () => (await dump(page)).count === 0));
  check("no page errors", errors.length === 0, errors);
  await ctx.close();
}

/* 2 ─ a dead network with navigator.onLine still true + a page reload */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 0);
  srv.down = true;
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  check("failed request (Wi-Fi without internet): kept on device", /Saved on this device/.test(await status(page)));
  await page.reload({ waitUntil: "load" });
  await gotoAttendance(page);
  check("after reload: the save is still there", (await dump(page)).count === 1 && (await panel(page).count()) === 1);
  srv.down = false;
  await page.getByRole("button", { name: "Sync now" }).click();
  check("after reload: 'Sync now' sends it", await until(() => srv.saves.length === 1) && await until(async () => (await dump(page)).count === 0));
  await ctx.close();
}

/* 3 ─ the save reached the server but the reply was lost → no second send */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 2);
  srv.loseReply = true;
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await back(page);
  await page.getByRole("button", { name: "Sync now" }).click();
  check("lost reply: queue clears", await until(async () => (await dump(page)).count === 0));
  check("lost reply: not sent a second time", srv.saves.length === 1, srv.saves.length);
  await ctx.close();
}

/* 4 ─ someone else changed the class: "Keep my marks" */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await back(page);
  const proctor = Object.fromEntries(STUDENTS.map((s) => [s.id, "present"]));
  proctor[stuId(4)] = "leave";
  srv.sessionId = SID; srv.marks = { ...proctor };
  await ctx.setOffline(false);
  check("conflict: panel asks the teacher", await until(async () => /Someone else changed/.test(await panel(page).innerText().catch(() => ""))));
  check("conflict: the proctor's marks are NOT overwritten", srv.saves.length === 0 && JSON.stringify(srv.marks) === JSON.stringify(proctor), srv.saves.length);
  check("conflict: says how many marks differ", /2 marks differ/.test(await panel(page).innerText()), await panel(page).innerText());
  await shot(page, "3-list-conflict");
  await page.getByRole("button", { name: "Keep my marks" }).click();
  await page.locator('[role="alertdialog"]').getByRole("button", { name: "Keep my marks" }).click();
  check("keep mine: sent at once after the teacher confirms", await until(() => srv.saves.length === 1, 5000));
  check("keep mine: 'synced' toast", await until(async () => /1 attendance save synced/.test(await page.locator("body").innerText()), 4000));
  check("keep mine: server has the teacher's marks", srv.marks[stuId(2)] === "absent" && srv.marks[stuId(4)] === "present", srv.marks);
  check("keep mine: local copy deleted", await until(async () => (await dump(page)).count === 0));
  await ctx.close();
}

/* 5 ─ someone else changed the class: "Use their marks" */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await back(page);
  srv.sessionId = SID; srv.marks = { [stuId(1)]: "leave" };
  await ctx.setOffline(false);
  await until(async () => /Someone else changed/.test(await panel(page).innerText().catch(() => "")));
  await page.getByRole("button", { name: "Use their marks" }).click();
  await page.locator('[role="alertdialog"]').getByRole("button", { name: "Remove my marks" }).click();
  check("use theirs: local copy deleted, nothing sent", await until(async () => (await dump(page)).count === 0) && srv.saves.length === 0);
  check("use theirs: server untouched", JSON.stringify(srv.marks) === JSON.stringify({ [stuId(1)]: "leave" }));
  await ctx.close();
}

/* 6 ─ the server refuses at sync time (edit window / no longer assigned) */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await back(page);
  srv.reject = "Edit window closed (2 days). Ask your class teacher (proctor).";
  await ctx.setOffline(false);
  check("refused: server's reason shown", await until(async () => /Edit window closed/.test(await panel(page).innerText().catch(() => ""))));
  await page.locator(".att-root").getByRole("button", { name: "Try again" }).click().catch(() => {});
  check("list online: 'On this device' badge on the class", await until(async () => (await page.locator(".att-root ul").first().innerText().catch(() => "")).length > 0 && /On this device/.test(await page.locator(".att-root").innerText())));
  await shot(page, "4-list-rejected");
  await sleep(17000); // longer than the first retry delay
  check("refused: not retried", srv.saves.length === 1, srv.saves.length);
  await page.getByRole("button", { name: "Remove from this device" }).click();
  await page.locator('[role="alertdialog"]').getByRole("button", { name: "Remove my marks" }).click();
  check("refused: can be removed", await until(async () => (await dump(page)).count === 0));
  await ctx.close();
}

/* 7 ─ shared device: another user never sees or sends the first user's save */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await ctx.setOffline(false);
  srv.down = true; // keep A's save unsent while the user changes
  await sleep(500);
  srv.down = false;
  if ((await dump(page)).count === 1) {
    await page.evaluate((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(sessionFor(UID_B)));
    await page.reload({ waitUntil: "load" });
    await gotoAttendance(page);
    await sleep(1500);
    check("other user: panel empty", (await panel(page).count()) === 0);
    check("other user: nothing sent", srv.saves.length === 0, srv.saves.length);
    check("other user: first user's record left alone", (await dump(page)).count === 1);
    await page.evaluate((s) => localStorage.setItem("a4ai.auth.token", s), JSON.stringify(sessionFor(UID_A)));
    await page.reload({ waitUntil: "load" });
    await gotoAttendance(page);
    check("first user back: it syncs", await until(() => srv.saves.length === 1));
  } else {
    check("other user: setup (record still queued)", false, "synced before the user could change");
  }
  await ctx.close();
}

/* 8 ─ sign-out wipes records and keys, and says so */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  // what supabase-js sends other tabs on sign-out; AuthProvider's listener runs the same code as a direct sign-out
  await page.evaluate(() => new BroadcastChannel("a4ai.auth.token").postMessage({ event: "SIGNED_OUT", session: null }));
  check("sign-out: records and keys gone", await until(async () => { const d = await dump(page); return d.count === 0 && d.keys === 0; }));
  check("sign-out: teacher is told", await until(async () => /removed from this device/.test(await page.locator("body").innerText().catch(() => ""))));
  check("offline + page can't load: stays in the app, not the browser's error page", await until(async () => /needs the internet/.test(await page.locator("body").innerText().catch(() => ""))) && page.url().startsWith(base), page.url());
  await shot(page, "5-offline-page-boundary");
  check("offline + page can't load: red banner still up", /No internet connection/.test(await page.locator(".a4-net-banner").innerText()));
  await ctx.setOffline(false);
  // this broadcast leaves the token in storage, so the reload may land on the dashboard or on login: either way, recovered
  check("back online: the page opens by itself", await until(async () => { const t = await page.locator("body").innerText().catch(() => ""); return t.length > 200 && !/needs the internet/.test(t); }, 15000));
  check("sign-out: nothing sent", srv.saves.length === 0);
  await ctx.close();
}

/* 9 ─ a record edited on disk is dropped, never sent */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("a4ai-offline");
    req.onsuccess = () => {
      const db = req.result;
      const s = db.transaction("records", "readwrite").objectStore("records");
      const all = s.getAll();
      all.onsuccess = () => {
        const rec = all.result[0];
        const bytes = new Uint8Array(rec.data);
        bytes[3] ^= 0xff;
        rec.data = bytes.buffer;
        s.put(rec).onsuccess = () => { db.close(); resolve(); };
      };
    };
  }));
  await ctx.setOffline(false);
  check("edited record: dropped", await until(async () => (await dump(page)).count === 0));
  await sleep(1000);
  check("edited record: nothing sent", srv.saves.length === 0);
  await ctx.close();
}

/* 10 ─ marking again offline replaces the earlier save */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await markAbsent(page, 3);
  check("re-mark: shows unsaved changes, Save enabled", /not saved yet/.test(await status(page)));
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  check("re-mark: still one record", (await dump(page)).count === 1);
  await ctx.setOffline(false);
  check("re-mark: one send with both marks", await until(() => srv.saves.length === 1) && srv.marks[stuId(2)] === "absent" && srv.marks[stuId(4)] === "absent", srv.marks);
  check("sheet flips to 'Saved at' after the sync", await until(async () => /Saved at/.test(await status(page))), await status(page));
  await ctx.close();
}

/* 11 ─ two tabs reconnecting send once */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  const page2 = await ctx.newPage();
  await ctx.setOffline(false);
  srv.down = true; // hold the sync back until the 2nd tab is up
  await page2.goto(base + "/dashboard", { waitUntil: "load" });
  await gotoAttendance(page2);
  srv.down = false;
  await ctx.setOffline(true);
  await sleep(300);
  await ctx.setOffline(false);
  check("two tabs: queue clears", await until(async () => (await dump(page)).count === 0, 20000));
  await sleep(1000);
  check("two tabs: sent once", srv.saves.length === 1, srv.saves.length);
  await ctx.close();
}

/* 12 ─ a request that never answers ends in the queue, not a stuck "Saving…" */
{
  const { ctx, page, srv } = await start();
  await openClass(page);
  await markAbsent(page, 1);
  srv.hang = true;
  await save(page);
  check("hung request: queued after the timeout", await until(async () => /Saved on this device/.test(await status(page)), 25000), await status(page));
  srv.hang = false;
  await ctx.close();
}

/* 13 ─ older than 7 days: removed, and the teacher is told */
{
  const { ctx, page, srv } = await start({ longToken: true });
  await openClass(page);
  await markAbsent(page, 1);
  await ctx.setOffline(true);
  await save(page);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector(".att-root [role=status]")?.textContent || ""), null, { timeout: 8000 });
  await ctx.addInitScript(() => { const real = Date.now; Date.now = () => real() + 8 * 24 * 3600 * 1000; });
  await ctx.setOffline(false);
  srv.down = true;
  await page.reload({ waitUntil: "load" });
  await gotoAttendance(page);
  check("expired: record removed", await until(async () => (await dump(page)).count === 0));
  check("expired: teacher is told", await until(async () => /older than 7 days/.test(await page.locator("body").innerText())));
  srv.down = false;
  await sleep(500);
  check("expired: nothing sent", srv.saves.length === 0, srv.saves.length);
  await ctx.close();
}

/* 14 ─ a real stale deploy (site reachable, chunk gone) still reloads once and recovers */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let failedOnce = false;
  await ctx.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.route(/\/assets\/LoginPage-.*\.js/, (r) => {
    if (failedOnce) return r.continue();
    failedOnce = true;
    return r.fulfill({ status: 404, contentType: "text/html", body: "gone" });
  });
  const page = await ctx.newPage();
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(base + "/login", { waitUntil: "load" });
  check("stale deploy: reloads and the page opens", await until(async () => /Sign In/.test(await page.locator("body").innerText().catch(() => "")), 15000));
  check("stale deploy: chunk really failed first, reloaded", failedOnce && loads >= 2, { failedOnce, loads });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
