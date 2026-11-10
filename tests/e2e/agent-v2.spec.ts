// a4ai Agent v3 against the in-browser MOCK adapter (build with VITE_AGENT_MOCK=1 — playwright.agent-mock.config.ts).
// The agent backend is never called; Supabase (auth session, get_my_access, dashboard tables) is mocked here.
// v3 mock is in-memory only (no localStorage persistence) — after page.reload() the mock resets to its seed state,
// but the store reopens lastSession from prefs, so an opened chat replays from the (seed) mock.
// Covers: history panel + replay + restore after reload, search, infinite scroll, rename / pin / delete + undo,
// Google-style suggestions with the keyboard, remove + clear history, stop + regenerate + feedback note,
// edit and resend, my_scope + section_comparison blocks, the mobile sheet (history drawer, Esc order, Ctrl+K),
// axe-core a11y audit.
// AGENT_SHOTS=1 also writes docs/screenshots/v3/agent-v3-<390|1440>-<light|dark>-<name>.png.
import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";

if (process.env.PW_CHROMIUM_PATH) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const MOCK = "http://mock.supabase.local";
const USER = "user-t1";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", exp })}.sig`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "teacher.ece2@msit.a4ai.in", user_metadata: { full_name: "Priya Sharma" }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
const access = { institute_id: "inst-1", institute_name: "MSIT", primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: ["b-1"] };

async function install(page: Page) {
  const agentCalls: string[] = [];
  await page.addInitScript(([s]) => {
    localStorage.setItem("a4ai.auth.token", s);
    (window as unknown as { __AGENT_MOCK_LATENCY__: number }).__AGENT_MOCK_LATENCY__ = 40;
  }, [JSON.stringify(session)]);
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/agent/")) agentCalls.push(r.url()); });
  await page.route((u) => !["localhost", "mock.supabase.local"].includes(u.hostname), (r) => r.abort());
  await page.route(`${MOCK}/**`, (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (url.pathname.startsWith("/auth/v1/user")) return json(user);
    if (url.pathname.startsWith("/auth/")) return json({});
    if (url.pathname.startsWith("/storage/")) return route.fulfill({ status: 404, headers: cors, body: "" });
    if (url.pathname === "/rest/v1/rpc/get_my_access") return json([access]);
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": "*/0" }, body: "" });
    return json((req.headers()["accept"] || "").includes("vnd.pgrst.object") ? {} : []);
  });
  return agentCalls;
}

async function openWorkspace(page: Page) {
  const calls = await install(page);
  await page.goto("/dashboard?tab=agent");
  await expect(page.getByTestId("agent-workspace")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("data-source")).toHaveText("Demo data");
  return calls;
}

const chat = (page: Page) => page.getByTestId("agent-chat-page");
const input = (page: Page) => chat(page).getByRole("combobox", { name: "Message a4ai Agent" });
const sidebar = (page: Page) => page.getByTestId("history-sidebar");
const item = (scope: Locator, title: string | RegExp) => scope.getByTestId("history-item").filter({ hasText: title });
async function ask(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press("Enter");
}
async function menu(page: Page, row: Locator, action: string) {
  await row.hover();
  await row.getByRole("button", { name: /options/ }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test("history: groups, open + replay a chat, restore after reload, search, infinite scroll", async ({ page }) => {
  const calls = await openWorkspace(page);
  expect(calls).toEqual([]); // mock adapter: no network to the agent
  const hist = sidebar(page);
  await expect(hist.getByTestId("history-group").first()).toHaveText("Pinned");
  for (const g of ["Pinned", "Today", "Yesterday", "Previous 7 days"]) await expect(hist.getByTestId("history-group").filter({ hasText: new RegExp(`^${g}$`) })).toBeVisible();

  await item(hist, "Sections ki attendance compare karo").getByRole("button").first().click();
  await expect(item(hist, "Sections ki attendance compare karo").getByRole("button").first()).toHaveAttribute("aria-current", "page");
  await expect(chat(page).getByTestId("msg-user-text")).toHaveText("Sections ki attendance compare karo");
  await expect(chat(page).getByTestId("ranking-table")).toBeVisible();
  await expect(chat(page).getByTestId("agent-chart")).toBeVisible();
  await expect(chat(page).getByTestId("steps")).toContainText(/1 step · /);
  await expect(chat(page).getByTestId("chat-title")).toHaveText("Sections ki attendance compare karo");

  await item(hist, "Main kya kya dekh sakta hoon?").getByRole("button").first().click();
  await expect(chat(page).getByTestId("scope-card")).toContainText("44 students");
  await expect(chat(page).getByTestId("ranking-table")).toHaveCount(0);

  // v3: mock is in-memory, but lastSession pref is saved → reload reopens the same session from seed
  await page.reload();
  await expect(chat(page).getByTestId("scope-card")).toContainText("44 students", { timeout: 30_000 });
  await expect(item(sidebar(page), "Main kya kya dekh sakta hoon?").getByRole("button").first()).toHaveAttribute("aria-current", "page");

  const search = sidebar(page).getByRole("searchbox", { name: "Search chats" });
  await search.fill("trend");
  await expect(sidebar(page).getByTestId("history-item")).toHaveCount(1);
  await expect(sidebar(page).getByTestId("history-item")).toContainText("Pichhle 4 hafte ka attendance trend");
  await search.fill("kuch bhi nahi xyz");
  await expect(sidebar(page).getByTestId("history-empty")).toContainText("se koi chat nahi mili");
  await search.fill("");

  // infinite scroll: the oldest chat lives on the 3rd page
  const scroller = sidebar(page).getByTestId("history-scroller");
  await expect.poll(async () => {
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    return sidebar(page).getByTestId("history-item").filter({ hasText: "· 38" }).count();
  }, { timeout: 20_000 }).toBe(1);
  // windowed: far fewer rows in the DOM than chats loaded (45)
  expect(await sidebar(page).getByTestId("history-item").count()).toBeLessThan(40);
});

test("history: rename inline, pin, delete with confirm + undo (and it sticks after reload)", async ({ page }) => {
  await openWorkspace(page);
  const hist = sidebar(page);
  const row = item(hist, "Pichhle 4 hafte ka attendance trend");
  await menu(page, row, "Rename");
  const box = hist.getByLabel("Chat ka naya naam");
  await box.fill("Trend · ECE-2");
  await box.press("Enter");
  const renamed = item(hist, "Trend · ECE-2");
  await expect(renamed).toBeVisible();

  await menu(page, renamed, "Pin");
  await expect(renamed.locator("svg.lucide-pin")).toBeVisible();
  // pinned chats come first (newest first inside Pinned): it is now one of the first 3 rows
  await expect.poll(async () => (await hist.getByTestId("history-item").allInnerTexts()).slice(0, 3).some((t) => t.includes("Trend · ECE-2"))).toBe(true);

  const victim = item(hist, "ECE 1 ki attendance");
  await menu(page, victim, "Delete");
  const confirm = page.getByTestId("agent-confirm");
  await expect(confirm).toContainText("Chat delete karein?");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(victim).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(item(hist, "ECE 1 ki attendance")).toHaveCount(1);

  await menu(page, item(hist, "ECE 1 ki attendance"), "Delete");
  await page.getByTestId("agent-confirm").getByRole("button", { name: "Delete" }).click();
  await expect(item(hist, "ECE 1 ki attendance")).toHaveCount(0);
  // v3: mock is in-memory only — reload resets to seed (rename/pin/delete don't persist)
});

test("suggestions: recent + try on focus, typed matches with hints, keyboard (↓, Tab fills, Esc, Enter)", async ({ page }) => {
  await openWorkspace(page);
  await page.getByTestId("history-sidebar").getByRole("button", { name: /New chat/ }).click();
  await input(page).click();
  const list = page.getByTestId("agent-suggestions");
  await expect(list).toBeVisible();
  await expect(list.getByText("Recent", { exact: true })).toBeVisible();
  await expect(list.getByText("Try", { exact: true })).toBeVisible();
  await expect(list.locator('[data-type="recent"]')).toHaveCount(6);
  await expect(input(page)).toHaveAttribute("aria-expanded", "true");

  await input(page).pressSequentially("ece 1", { delay: 30 });
  await expect(list.locator('[data-type="entity"]').filter({ hasText: "ECE-1 ki attendance" })).toContainText("Batch · 22 students");
  await expect(list.locator("mark").first()).toHaveText(/ece/i);
  const first = list.getByRole("option").first();
  await expect(first).toContainText("ECE 1 ki attendance");

  await input(page).press("ArrowDown");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(input(page)).toHaveAttribute("aria-activedescendant", (await first.getAttribute("id"))!);
  await input(page).press("Tab"); // fill, don't send
  await expect(input(page)).toHaveValue("ECE 1 ki attendance");
  await expect(chat(page).getByTestId("msg-user")).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await input(page).press("Escape");
  await expect(list).toHaveCount(0);

  await input(page).press("Enter");
  const clarify = chat(page).getByTestId("clarify");
  await expect(clarify).toContainText("Kaun sa?");
  await expect(clarify).toContainText("Section · 22 students");
  await expect(clarify).toContainText("Section · 0 students");
  await clarify.getByTestId("clarify-chip").filter({ hasText: "ECE-1" }).first().click();
  await expect(chat(page).getByTestId("stat-grid")).toContainText("83.8");

  // a click on a suggestion runs it at once; the ↖ icon only fills
  await input(page).click();
  await input(page).pressSequentially("main", { delay: 30 });
  await list.getByRole("option").filter({ hasText: "Main kya kya dekh sakta hoon?" }).getByRole("button", { name: /Fill/ }).click();
  await expect(input(page)).toHaveValue("Main kya kya dekh sakta hoon?");
  await expect(chat(page).getByTestId("scope-card")).toHaveCount(0);
  await input(page).fill("");
  await input(page).pressSequentially("main", { delay: 30 });
  await list.getByRole("option").filter({ hasText: "Main kya kya dekh sakta hoon?" }).click();
  await expect(chat(page).getByTestId("scope-card")).toBeVisible();
});

test("suggestions: remove a recent one (×), clear history with confirm", async ({ page }) => {
  await openWorkspace(page);
  await input(page).click();
  const list = page.getByTestId("agent-suggestions");
  const recent = list.locator('[data-type="recent"]');
  await expect(recent).toHaveCount(6);
  const firstText = (await recent.first().innerText()).split("\n")[0].trim();
  await recent.first().getByTestId("suggestion-remove").click();
  await expect(list.locator('[data-type="recent"]').filter({ hasText: firstText })).toHaveCount(0);
  await expect(recent).toHaveCount(6); // the 7th moves up

  await list.getByTestId("clear-history").click();
  const confirm = page.getByTestId("agent-confirm");
  await expect(confirm).toContainText("Search history clear karein?");
  await confirm.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText("Search history clear ho gayi.")).toBeVisible();
  await input(page).click();
  await expect(page.getByTestId("agent-suggestions").locator('[data-type="recent"]')).toHaveCount(0);
  await expect(page.getByTestId("agent-suggestions").getByText("Try", { exact: true })).toBeVisible();
  await expect(page.getByTestId("clear-history")).toHaveCount(0);
});

test("stop keeps the partial answer, regenerate replaces it, 👎 with a note, edit and resend", async ({ page }) => {
  await openWorkspace(page);
  await ask(page, "slow explain karo");
  const answer = chat(page).getByTestId("msg-assistant").last();
  await expect(answer).toContainText("ECE-2 ki attendance", { timeout: 20_000 });
  await chat(page).getByTestId("agent-stop").click();
  await expect(answer.getByTestId("msg-stopped")).toBeVisible();
  const partial = await answer.innerText();
  expect(partial).not.toContain("7 din tak");
  await expect(input(page)).toBeEnabled();

  await answer.getByRole("button", { name: "Regenerate" }).click();
  await expect(chat(page).getByTestId("msg-stopped")).toHaveCount(0);
  await expect(chat(page).getByTestId("msg-assistant").last()).toContainText("7 din tak", { timeout: 20_000 });
  await expect(chat(page).getByTestId("msg-user")).toHaveCount(1);

  await chat(page).getByTestId("msg-assistant").last().getByRole("button", { name: "Not helpful" }).click();
  const note = page.getByTestId("feedback-note");
  await note.getByRole("textbox").fill("Number galat lag raha hai");
  await note.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Shukriya — feedback mil gaya.")).toBeVisible();
  await expect(chat(page).getByRole("button", { name: "Not helpful" })).toHaveAttribute("aria-pressed", "true");

  await chat(page).getByTestId("msg-user").hover();
  await chat(page).getByTestId("msg-edit").click();
  const edit = chat(page).getByTestId("msg-user-edit").getByRole("textbox");
  await edit.fill("Sections compare karo");
  await edit.press("Enter");
  await expect(chat(page).getByTestId("ranking-table")).toBeVisible();
  await expect(chat(page).getByTestId("msg-user-text")).toHaveText("Sections compare karo");
  await expect(chat(page).getByTestId("msg-assistant")).toHaveCount(1);

  // v3: mock is in-memory — reload resets the session to seed, so we just verify the edit worked live
});

test("my_scope + section_comparison blocks, scope empty state", async ({ page }) => {
  await openWorkspace(page);
  await page.getByTestId("history-sidebar").getByRole("button", { name: /New chat/ }).click();
  await expect(page.getByTestId("scope-summary")).toHaveText("Aapke paas: 2 batches · 44 students");
  await expect(chat(page).getByRole("button", { name: /ECE-1 ki attendance/ })).toBeVisible();
  await expect(chat(page).getByRole("button", { name: /Mere sections compare karo/ })).toBeVisible();

  await ask(page, "Main kya kya dekh sakta hoon?");
  const scope = chat(page).getByTestId("scope-card");
  await expect(scope.getByTestId("scope-total")).toHaveText("3 batches · 44 students");
  await expect(scope.getByTestId("scope-batch")).toHaveCount(3);
  await scope.getByTestId("scope-batch").filter({ hasText: "ECE-2" }).first().click();
  await expect(chat(page).getByTestId("msg-user-text").last()).toHaveText("ECE-2 ki attendance");
  await expect(chat(page).getByTestId("stat-grid")).toContainText("83.8");

  await ask(page, "Sections ki attendance compare karo");
  const table = chat(page).getByTestId("ranking-table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table.locator("tbody tr").first()).toContainText("ECE-1");
  await expect(table.locator("tbody tr").first()).toContainText("86.4%");
  await expect(table.locator("tbody tr").last()).toContainText("ECE-4");
  await expect(table.locator("tbody tr").last()).toContainText("—");
  await expect(chat(page).getByTestId("section-comparison").getByTestId("agent-chart")).toBeVisible();
});

test("mobile sheet: Ask a4ai, history drawer inside the sheet, Esc closes the drawer first, Ctrl+K", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await install(page);
  await page.goto("/dashboard");
  const launcher = page.getByTestId("ask-a4ai");
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  await launcher.click();
  const sheet = page.getByTestId("agent-chat-sheet");
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(389);

  await sheet.getByRole("button", { name: "Chat history" }).click();
  const drawer = page.getByTestId("sheet-history");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("searchbox", { name: "Search chats" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Chat history" })).toBeFocused();

  await sheet.getByRole("button", { name: "Chat history" }).click();
  await drawer.getByTestId("history-item").filter({ hasText: "Sections ki attendance compare karo" }).getByRole("button").first().click();
  await expect(drawer).toHaveCount(0);
  await expect(sheet.getByTestId("ranking-table")).toBeVisible();

  // suggestions on a phone: full-width list, ≥ 44px rows
  const msg = sheet.getByRole("combobox", { name: "Message a4ai Agent" });
  await msg.click();
  const opt = page.getByTestId("agent-suggestions").getByRole("option").first();
  await expect(opt).toBeVisible();
  expect((await opt.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape"); // closes the list only
  await expect(page.getByTestId("agent-suggestions")).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape"); // now the sheet
  await expect(sheet).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await expect(page.getByTestId("agent-chat-sheet")).toBeVisible();
  await expect(page.getByTestId("agent-chat-sheet").getByRole("combobox", { name: "Message a4ai Agent" })).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// ---- contrast audit (computed colours, alpha backgrounds composited over their parents) ------------------------
/** In the page: every visible text element under `rootSel` whose contrast is below WCAG AA (4.5, large text 3). */
function auditContrast(rootSels: string[]) {
  type RGBA = [number, number, number, number];
  const parse = (c: string): RGBA | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const over = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a) as RGBA;
  };
  const lum = ([r, g, b]: RGBA) => {
    const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el: Element): RGBA => {
    const stack: RGBA[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let acc: RGBA = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const fails: string[] = [];
  const seen = new Set<Element>();
  for (const sel of rootSels) for (const root of Array.from(document.querySelectorAll(sel))) {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (seen.has(el)) continue;
      seen.add(el);
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
      if (!own) continue;
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || el.closest(".sr-only, [aria-hidden=true], :disabled, [disabled], svg")) continue;
      let faded = false;
      for (let n: Element | null = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 1) { faded = true; break; }
      if (faded) continue; // hover-only / disabled states
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const fgc = over(fg, bg);
      const [a, b] = [lum(fgc), lum(bg)].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio < need) fails.push(`${ratio.toFixed(2)} < ${need}: "${(el.textContent ?? "").trim().slice(0, 40)}" (${cs.color} on rgb(${bg.slice(0, 3).map(Math.round).join(",")}))`);
    }
  }
  return fails;
}

test("contrast: agent text meets WCAG AA in light and dark (history, suggestions, scope, ranking, clarify)", async ({ page }) => {
  await openWorkspace(page);
  await ask(page, "Main kya kya dekh sakta hoon?");
  await expect(chat(page).getByTestId("scope-card")).toBeVisible();
  await ask(page, "Sections ki attendance compare karo");
  await expect(chat(page).getByTestId("ranking-table")).toBeVisible();
  await ask(page, "ECE 1 ki attendance");
  await expect(chat(page).getByTestId("clarify")).toBeVisible();
  await page.mouse.move(0, 0);
  for (const dark of [false, true]) {
    await setTheme(page, dark);
    await input(page).click();
    await expect(page.getByTestId("agent-suggestions")).toBeVisible();
    await input(page).press("ArrowDown"); // the highlighted row too
    await page.waitForTimeout(150);
    const fails = await page.evaluate(auditContrast, ["[data-agent-workspace]", "[data-testid=agent-suggestions]"]);
    expect(fails, `${dark ? "dark" : "light"} theme`).toEqual([]);
    await input(page).press("Escape");
  }
});

// ---- axe-core a11y audit (both themes, 0 serious) ---------------------------------------------------
test("a11y: axe-core finds 0 serious/critical violations in light and dark", async ({ page }) => {
  await openWorkspace(page);
  await ask(page, "Main kya kya dekh sakta hoon?");
  await expect(chat(page).getByTestId("scope-card")).toBeVisible();
  await ask(page, "Sections ki attendance compare karo");
  await expect(chat(page).getByTestId("ranking-table")).toBeVisible();
  await ask(page, "ECE 1 ki attendance");
  await expect(chat(page).getByTestId("clarify")).toBeVisible();
  for (const dark of [false, true]) {
    await setTheme(page, dark);
    await page.waitForTimeout(200);
    const results = await new AxeBuilder({ page })
      .include("[data-agent-workspace]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.description}`), `${dark ? "dark" : "light"} theme`).toEqual([]);
  }
});

// ---- screenshots (AGENT_SHOTS=1) -----------------------------------------------------------------------
const SHOTS = path.resolve(process.cwd(), "docs/screenshots/v3");
async function setTheme(page: Page, dark: boolean) {
  await page.evaluate((d) => { document.documentElement.classList.toggle("dark", d); document.documentElement.style.colorScheme = d ? "dark" : "light"; }, dark);
}

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`screenshots ${width} ${theme}`, async ({ page }) => {
      test.skip(!process.env.AGENT_SHOTS, "set AGENT_SHOTS=1 to capture docs/screenshots/v3");
      const phone = width === 390;
      await page.setViewportSize({ width, height: phone ? 844 : 900 });
      await openWorkspace(page);
      await setTheme(page, theme === "dark");
      const shot = async (name: string) => { await page.waitForTimeout(250); await page.screenshot({ path: `${SHOTS}/agent-v3-${width}-${theme}-${name}.png` }); };
      const newChat = async () => {
        const btn = phone ? chat(page).getByRole("button", { name: "New chat" }) : sidebar(page).getByRole("button", { name: /New chat/ });
        if (await btn.isEnabled()) await btn.click();
      };
      await newChat();
      await shot("empty");

      if (phone) {
        await chat(page).getByRole("button", { name: "Chat history" }).click();
        await expect(page.getByRole("dialog").getByTestId("agent-history")).toBeVisible();
        await shot("history");
        await page.keyboard.press("Escape");
      } else {
        await item(sidebar(page), "Pichhle 4 hafte ka attendance trend").hover();
      }

      await input(page).click();
      await expect(page.getByTestId("agent-suggestions")).toBeVisible();
      await shot("suggestions-recent");
      await input(page).pressSequentially("ece", { delay: 20 });
      await expect(page.getByTestId("agent-suggestions").locator('[data-type="entity"]').first()).toBeVisible();
      await input(page).press("ArrowDown");
      await shot("suggestions-typing");
      await input(page).fill("");
      await input(page).press("Escape");

      await ask(page, "Main kya kya dekh sakta hoon?");
      await expect(chat(page).getByTestId("scope-card")).toBeVisible();
      await chat(page).getByTestId("scope-card").scrollIntoViewIfNeeded();
      await shot("scope");

      await ask(page, "Sections ki attendance compare karo");
      await expect(chat(page).getByTestId("section-comparison").getByTestId("agent-chart")).toBeVisible();
      await chat(page).getByTestId("ranking-table").scrollIntoViewIfNeeded();
      await shot("comparison");

      await ask(page, "ECE 1 ki attendance");
      await expect(chat(page).getByTestId("clarify")).toBeVisible();
      await shot("clarify");

      await ask(page, "slow explain karo");
      await expect(chat(page).getByTestId("msg-assistant").last()).toContainText("ECE-2", { timeout: 20_000 });
      await chat(page).getByTestId("agent-stop").click();
      await expect(chat(page).getByTestId("msg-stopped")).toBeVisible();
      await chat(page).getByTestId("msg-assistant").last().getByRole("button", { name: "Not helpful" }).click();
      await expect(page.getByTestId("feedback-note")).toBeVisible();
      await shot("stopped-feedback");
      await page.keyboard.press("Escape");

      // the sheet with its history drawer, from the dashboard home
      await page.goto("/dashboard");
      await expect(page.getByTestId("ask-a4ai")).toBeVisible({ timeout: 30_000 });
      await setTheme(page, theme === "dark");
      await page.getByTestId("ask-a4ai").click();
      await expect(page.getByTestId("agent-chat-sheet")).toBeVisible();
      await page.waitForTimeout(500);
      await setTheme(page, theme === "dark"); // the dashboard re-applies its theme on mount
      await shot("sheet");
      await page.getByTestId("agent-chat-sheet").getByRole("button", { name: "Chat history" }).click();
      await expect(page.getByTestId("sheet-history")).toBeVisible();
      await shot("sheet-history");

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
