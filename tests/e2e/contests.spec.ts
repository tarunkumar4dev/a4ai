// /contests (LeetCode-style contest home) end to end, Supabase mocked in the browser — no live DB.
// get_my_contests / get_contest_card / register_for_contest follow 29_contest_feed.sql (states, views, keyset).
// Checks the resilience list: slow network + timeout, partial rows, failed image, stale auth, missing RPC,
// duplicate register clicks, refresh, two tabs, paused contest, results pending, countdown on SERVER time.
import { test, expect, type Page, type Route, type BrowserContext } from "@playwright/test";

const MOCK = "http://mock.supabase.local";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;

type Row = Record<string, unknown> & { id: string; short_code: string; title: string; status: string; my_state: string };

function sessionFor(role: "student" | "teacher", id: string, name: string) {
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", aud: "authenticated", exp })}.sig`;
  const user = { id, aud: "authenticated", role: "authenticated", email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    user_metadata: { full_name: name, role }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
  return { user, session: { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user } };
}

class ContestsDb {
  /** server clock = device clock + offset (the device is "wrong" on purpose) */
  offsetMs = 10 * 60_000;
  rows: Row[] = [];
  registered = new Set<string>();
  rpcLog: { fn: string; body: Record<string, unknown> }[] = [];
  feedDelayMs = 0;
  /** search text → extra delay (race test) */
  searchDelay: Record<string, number> = {};
  feedHang = 0;            // next N feed calls never answer (timeout test)
  feedStatus: { status: number; body: unknown } | null = null;
  role: "student" | "teacher";
  boardCalls = 0;
  constructor(role: "student" | "teacher" = "student", opts: { empty?: boolean } = {}) {
    this.role = role;
    const S = this.now();
    const iso = (ms: number) => new Date(S + ms).toISOString();
    const base = { subject: "Physics", class_grade: "10", duration_minutes: 45, total_questions: 25, total_marks: 25,
      scheduled_at: null, expires_at: null, status: "active", answer_mode: "after_test", attempts: 12, registered_at: null,
      results_pending: false, my_score: null, my_percentage: null, my_submitted_at: null, created_at: iso(-5 * 86400_000) };
    const owner = role === "teacher";
    this.rows = [
      { ...base, id: "c-live", short_code: "live0001", title: "Light & Electricity Live", scheduled_at: iso(-600_000), expires_at: iso(3_000_000), my_state: owner ? "owner" : "registered" },
      { ...base, id: "c-soon", short_code: "soon0002", title: "Sunday Chemistry Mock", subject: "Chemistry", scheduled_at: iso(2 * 86400_000), my_state: owner ? "owner" : "registered" },
      { ...base, id: "c-open", short_code: "open0003", title: "Algebra Practice Contest", subject: "Maths", my_state: owner ? "owner" : "in_progress", created_at: iso(-86400_000) },
      { ...base, id: "c-done", short_code: "done0004", title: "Organic Chemistry Test", subject: "Chemistry", my_state: "submitted", my_score: 18, my_percentage: 72, my_submitted_at: iso(-3 * 86400_000) },
      { ...base, id: "c-pend", short_code: "pend0005", title: "Optics Unit Test", answer_mode: "teacher_release", my_state: "submitted", results_pending: true, my_submitted_at: iso(-86400_000) },
      { ...base, id: "c-paus", short_code: "paus0006", title: "Biology Quiz", subject: "Biology", status: "paused", my_state: owner ? "owner" : "registered" },
      { id: "c-part", short_code: "part0007", status: "active", my_state: "submitted", my_submitted_at: iso(-7 * 86400_000) } as unknown as Row, // partial row
    ];
    if (opts.empty) this.rows = [];
    for (const r of this.rows) if (r.my_state === "registered") this.registered.add(r.id);
  }
  extra: Row | null = null; // the contest found by code

  now() { return Date.now() + this.offsetMs; }
  calls(fn: string) { return this.rpcLog.filter((c) => c.fn === fn); }

  private phase(r: Row, now: number) {
    const ends = r.expires_at ? Date.parse(String(r.expires_at)) : null;
    if (ends != null && ends <= now) return "ended";
    if (r.status !== "active") return "paused";
    const starts = r.scheduled_at ? Date.parse(String(r.scheduled_at)) : null;
    return starts != null && starts > now ? "scheduled" : "live";
  }
  private upcoming(r: Row, now: number) {
    const p = this.phase(r, now);
    return p !== "ended" && r.status === "active" && r.my_state !== "submitted";
  }
  private sortAt(r: Row, view: string) {
    const t = (v: unknown) => (v ? Date.parse(String(v)) : NaN);
    if (view === "upcoming") return t(r.scheduled_at) || t(r.created_at) || 0;
    return t(r.my_submitted_at) || t(r.expires_at) || t(r.created_at) || 0;
  }

  feed(body: Record<string, unknown>) {
    const now = this.now();
    const all = this.extra && this.registered.has(this.extra.id) ? [...this.rows, { ...this.extra, my_state: "registered" }] : this.rows;
    const q = String(body.p_search ?? "").toLowerCase();
    const searched = all.filter((r) => !q || String(r.title ?? "").toLowerCase().includes(q) || String(r.subject ?? "").toLowerCase().includes(q) || r.short_code === q);
    const view = String(body.p_view);
    const viewed = searched.filter((r) => this.upcoming(r, now) === (view === "upcoming"))
      .sort((a, b) => (view === "upcoming" ? 1 : -1) * (this.sortAt(a, view) - this.sortAt(b, view)));
    const subj = String(body.p_subject ?? "").toLowerCase();
    const filtered = viewed.filter((r) => !subj || String(r.subject ?? "").toLowerCase() === subj);
    const start = body.p_cursor_id ? filtered.findIndex((r) => r.id === body.p_cursor_id) + 1 : 0;
    const limit = Number(body.p_limit ?? 20);
    const page = filtered.slice(start, start + limit);
    const more = filtered.length > start + limit;
    const facets = new Map<string, number>();
    for (const r of viewed) if (r.subject) facets.set(String(r.subject), (facets.get(String(r.subject)) ?? 0) + 1);
    const ups = all.filter((r) => this.upcoming(r, now));
    return {
      server_now: new Date(now).toISOString(), view,
      items: page,
      next_cursor: more ? { at: new Date(this.sortAt(page[page.length - 1], view)).toISOString(), id: page[page.length - 1].id } : null,
      counts: { upcoming: searched.filter((r) => this.upcoming(r, now)).length, past: searched.filter((r) => !this.upcoming(r, now)).length,
        live: ups.filter((r) => this.phase(r, now) === "live").length },
      subjects: [...facets].map(([name, count]) => ({ name, count })),
      next: ups.find((r) => r.my_state === "in_progress") ?? ups[0] ?? null,
      scheduled: all.filter((r) => r.scheduled_at).map((r) => r.scheduled_at),
    };
  }

  async install(ctx: BrowserContext | Page, session: object) {
    await ctx.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session)]);
    await ctx.route(`${MOCK}/**`, (route: Route) => this.handle(route));
    await ctx.route((u) => !["localhost", "mock.supabase.local"].includes(u.hostname), (r) => r.abort());
    await ctx.route("**/images/LOGO.png", (r) => r.abort()); // failed image: header must still render
    // FastAPI leaderboard (sidebar "Latest results"); registered last so it wins over the rules above
    await ctx.route("**/api/v1/contests/*/leaderboard", (r) => {
      this.boardCalls++;
      const id = new URL(r.request().url()).pathname.split("/").slice(-2)[0];
      const names = ["Kabir Singh", "Meera Nair", "Rohan Das", "Ishaan Roy", "Asha Verma"];
      return r.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({
        contest_id: id, title: "Organic Chemistry Test", total_attempts: 5, total_participants: 31, my_rank: 5,
        attempts: names.map((n, i) => ({ attempt_id: `a${i}`, rank: i + 1, student_name: n, status: "submitted",
          score: [25, 23, 21, 19, 18][i], total_marks: 25, is_me: n === "Asha Verma" })),
      }) });
    });
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  private async handle(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/")) return this.json(route, {});
    const table = url.pathname.replace("/rest/v1/", "");
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (table.startsWith("rpc/")) {
      const fn = table.slice(4);
      const body = JSON.parse(req.postData() || "{}");
      this.rpcLog.push({ fn, body });
      if (fn === "get_my_access") return this.json(route, [{ institute_id: null, institute_name: null, primary_role: "none", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
      if (fn === "get_my_contests") {
        if (this.feedHang > 0 && body.p_view === "upcoming") { this.feedHang--; return; } // never answers → 12 s timeout
        if (this.feedStatus) return this.json(route, this.feedStatus.body, this.feedStatus.status);
        const delay = this.feedDelayMs + (this.searchDelay[String(body.p_search ?? "")] ?? 0);
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return this.json(route, this.feed(body)).catch(() => undefined); // aborted by the page meanwhile
      }
      if (fn === "get_contest_card") {
        if (this.feedStatus) return this.json(route, this.feedStatus.body, this.feedStatus.status);
        // same parsing as a4_contest_code(): a pasted link → its code
        const raw = String(body.p_code).toLowerCase().replace(/[?#].*$/, "").replace(/^.*\/contests?\/(live\/)?/, "");
        const code = raw.split("/")[0].replace(/[^a-z0-9]/g, "");
        if (code !== this.extra?.short_code) return this.json(route, { state: "not_found", server_now: new Date(this.now()).toISOString() });
        return this.json(route, { state: "ok", server_now: new Date(this.now()).toISOString(),
          contest: { ...this.extra, my_state: this.registered.has(this.extra.id) ? "registered" : "none" } });
      }
      if (fn === "register_for_contest") {
        await new Promise((r) => setTimeout(r, 400)); // slow enough for a double click to land first
        const x = this.extra!;
        const first = !this.registered.has(x.id);
        this.registered.add(x.id);
        return this.json(route, { state: first ? "registered" : "already_registered", server_now: new Date(this.now()).toISOString(), contest: { ...x, my_state: "registered" } });
      }
      return this.json(route, null);
    }
    if (table === "profiles") return this.json(route, one ? { coins: 250, total_coins_earned: 300 } : [{ coins: 250 }]);
    if (table === "mega_contests") return this.json(route, { message: "should not be called" }, 500);
    return this.json(route, one ? {} : []);
  }
}

const row = (page: Page, title: string) => page.locator("li", { hasText: title });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Elements sticking out past the right edge (not clipped by a scroll / hidden container) + the page width.
 *  Run with isMobile: false — mobile emulation widens the layout viewport to fit, which hides overflow. */
const overflow = (page: Page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad: string[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= vw + 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) {
      if (getComputedStyle(p).overflowX !== "visible") { clipped = true; break; }
      p = p.parentElement;
    }
    if (!clipped) bad.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 70)} (${Math.round(r.right)}px)`);
  }
  return { ok: document.documentElement.scrollWidth <= vw && bad.length === 0, report: `scrollWidth ${document.documentElement.scrollWidth} / ${vw}: ${bad.slice(0, 4).join(" | ")}` };
});
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/visual/${name}.png`, fullPage: true });

test.describe("desktop", () => {
  test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("real list, no sample data; actions follow each contest's state", async ({ page }) => {
    const db = new ContestsDb("student");
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(page.getByRole("heading", { level: 1, name: "Contests" })).toBeVisible();
    for (const fake of ["Top 20%", "Tarun", "Mega Test", "day streak", "Failed to load contests", "JEE Sprint"]) {
      await expect(page.getByText(fake)).toHaveCount(0);
    }
    expect(db.rpcLog.some((c) => c.fn === "mega_contests")).toBe(false);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/student/dashboard");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Contests" })).toHaveAttribute("aria-current", "page");
    // sidebar: real leaderboard of the latest finished contest (FastAPI), the student's own rank
    await expect(page.getByRole("heading", { name: "Latest results" })).toBeVisible();
    await expect(page.getByText("Kabir Singh")).toBeVisible();
    await expect(page.getByText(/You: #5 of 31/)).toBeVisible();
    expect(db.boardCalls).toBe(1);
    // coins: the database read failed for this test user (no UUID) → no invented balance anywhere
    await expect(page.getByText("Your coins")).toHaveCount(0);

    await expect(row(page, "Light & Electricity Live").getByRole("link", { name: "Start" })).toHaveAttribute("href", "/contest/live0001");
    await expect(row(page, "Algebra Practice Contest").getByRole("link", { name: "Resume" })).toBeVisible();
    await expect(row(page, "Sunday Chemistry Mock").getByText("Registered")).toBeVisible();
    await expect(row(page, "Sunday Chemistry Mock").getByRole("timer")).toHaveText(/^\dd \d\d:\d\d:\d\d$/);
    // banner = the attempt to resume
    await expect(page.locator("section", { hasText: "Your attempt is open" }).getByRole("link", { name: "Resume" })).toBeVisible();

    await page.getByRole("tab", { name: /Past/ }).click();
    await expect(row(page, "Organic Chemistry Test").getByText("18/25").first()).toBeVisible();
    await expect(row(page, "Organic Chemistry Test").getByRole("link", { name: "View result" })).toHaveAttribute("href", "/contests/leaderboard?c=done0004&id=c-done");
    await expect(row(page, "Optics Unit Test").getByText("Results soon").first()).toBeVisible();   // teacher_release
    await expect(row(page, "Biology Quiz").getByText("Paused").first()).toBeVisible();            // cancelled / paused
    await expect(row(page, "Untitled contest")).toBeVisible();                                     // partial row
    await shot(page, "student-1366-past");
  });

  test("register: double click sends one request, list refreshes, other tab follows, refresh keeps it", async ({ context }) => {
    const db = new ContestsDb("student");
    db.extra = { id: "c-new", short_code: "newc0de1", title: "Electrostatics Weekly", subject: "Physics", class_grade: "10",
      duration_minutes: 30, total_questions: 20, total_marks: 20, scheduled_at: new Date(db.now() + 3_600_000).toISOString(),
      expires_at: null, status: "active", my_state: "none", attempts: 0, results_pending: false, created_at: new Date(db.now()).toISOString() };
    await db.install(context, sessionFor("student", "stu-1", "Asha Verma").session);
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto("/contests");
    await b.goto("/contests");
    await expect(row(b, "Sunday Chemistry Mock")).toBeVisible();

    await a.getByLabel("Contest code or link").fill("https://a4ai.in/contest/NEWC0DE1");
    await a.getByRole("button", { name: "Find" }).click();
    await expect(a.getByText("Electrostatics Weekly")).toBeVisible();
    const reg = a.getByRole("button", { name: "Register" });
    await reg.dblclick();
    await expect(a.getByText("Registered. It's in your Upcoming list.")).toBeVisible();
    expect(db.calls("register_for_contest")).toHaveLength(1);
    await expect(row(a, "Electrostatics Weekly").getByText("Registered")).toBeVisible();   // cache invalidated
    await expect(row(b, "Electrostatics Weekly")).toBeVisible();                           // other tab (BroadcastChannel)

    // the second tab registers the same code again → same single registration, honest message
    await b.getByLabel("Contest code or link").fill("newc0de1");
    await b.getByRole("button", { name: "Find" }).click();
    await expect(b.getByText("You're registered.")).toBeVisible();

    await a.reload();
    await expect(row(a, "Electrostatics Weekly").getByText("Registered")).toBeVisible();
  });

  test("search is debounced, and an older slow answer never replaces a newer one", async ({ page }) => {
    const db = new ContestsDb("student");
    db.searchDelay = { alg: 2500 };   // "alg" answers late
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(row(page, "Light & Electricity Live")).toBeVisible();
    const before = db.calls("get_my_contests").length;
    const box = page.getByLabel("Search your contests");
    await box.pressSequentially("alg", { delay: 60 });
    await page.waitForTimeout(500);                      // "alg" request in flight (slow)
    await box.fill("light");
    await expect(row(page, "Light & Electricity Live")).toBeVisible();
    await page.waitForTimeout(2600);                     // the late "alg" answer arrives now
    await expect(row(page, "Light & Electricity Live")).toBeVisible();
    await expect(row(page, "Algebra Practice Contest")).toHaveCount(0);
    const searches = db.calls("get_my_contests").slice(before).map((c) => c.body.p_search);
    expect(searches).not.toContain("a");                 // no request per keystroke
    expect(searches).not.toContain("al");
  });

  test("countdown runs on SERVER time and refetches when it reaches zero", async ({ page }) => {
    const db = new ContestsDb("student");
    // device clock is 10 min behind the server; the contest starts 10 s after the SERVER's now (room for a slow load)
    db.rows[1] = { ...db.rows[1], scheduled_at: new Date(db.now() + 10_000).toISOString() };
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    const r = row(page, "Sunday Chemistry Mock");
    await expect(r.getByRole("timer")).toHaveText(/^00:00:(0\d|10)$/);
    const before = db.calls("get_my_contests").length;
    await expect(r.getByRole("link", { name: "Start" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => db.calls("get_my_contests").length).toBeGreaterThan(before);
  });

  test("slow network: 12 s timeout → message → Try again recovers", async ({ page }) => {
    test.setTimeout(60_000);
    const db = new ContestsDb("student");
    db.feedHang = 3; // first try + 2 automatic retries
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(page.getByText("This is taking too long")).toBeVisible({ timeout: 50_000 });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(row(page, "Light & Electricity Live")).toBeVisible();
  });

  test("29 not applied yet: friendly note, and a code still opens the contest page", async ({ page }) => {
    const db = new ContestsDb("student");
    db.feedStatus = { status: 404, body: { code: "PGRST202", message: "Could not find the function public.get_my_contests" } };
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(page.getByText("Your contest list is almost ready")).toBeVisible();
    await shot(page, "student-1366-list-not-switched-on");
    await page.getByLabel("Contest code or link").fill("https://a4ai.in/contest/abcd1234?ref=wa");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page).toHaveURL(/\/contest\/abcd1234$/);
  });

  test("expired session: says so and offers sign in", async ({ page }) => {
    const db = new ContestsDb("student");
    db.feedStatus = { status: 401, body: { code: "PGRST301", message: "JWT expired" } };
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in again" })).toBeVisible();
  });

  test("teacher: own contests with copy link + results, create banner", async ({ page }) => {
    const db = new ContestsDb("teacher");
    await db.install(page, sessionFor("teacher", "tch-1", "Ravi Kumar").session);
    await page.goto("/contests");
    await expect(page.getByRole("heading", { name: "Create a contest" })).toBeVisible();
    const r = row(page, "Light & Electricity Live");
    await expect(r.getByRole("link", { name: "Results" })).toHaveAttribute("href", "/contests/leaderboard?c=live0001&id=c-live");
    await expect(r.getByRole("button", { name: /Copy link/ })).toBeVisible();
    await expect(r.getByText("Attempts")).toBeVisible();
    await expect(r.locator("dd", { hasText: /^12$/ })).toBeVisible();
    await shot(page, "teacher-1366");
    // laptop width (sidebar + card rows below xl): titles readable, no sideways scroll
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(r.getByRole("link", { name: "Results" })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, "teacher-1024");
  });
});

test.describe("phone (Pixel 5)", () => {
  test("own hierarchy: no sideways scroll, one sticky element, filters in a bottom sheet", async ({ page }) => {
    const db = new ContestsDb("student");
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests");
    await expect(row(page, "Light & Electricity Live")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // sticky / fixed BARS (wider than half the screen); the app-wide help bubble is a small floating button
    const bars = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .filter((el) => ["sticky", "fixed"].includes(getComputedStyle(el).position)
        && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > window.innerWidth / 2
        && !!(el.textContent || "").trim()) // the app-wide empty toast viewport (<ol>, no content) is not a bar
      .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 80)}`));
    expect(bars, bars.join(" | ")).toHaveLength(1);
    await expect(page.getByLabel("Search your contests")).toBeHidden(); // desktop search not shown
    await page.getByRole("button", { name: /Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /Chemistry/ }).click();
    await sheet.getByRole("button", { name: /^Show/ }).click();
    await expect(row(page, "Sunday Chemistry Mock")).toBeVisible();
    await expect(row(page, "Light & Electricity Live")).toHaveCount(0);
    await shot(page, "student-393-filtered");
  });
});

test.describe("entry points + visual widths", () => {
  test("old /contests/join link lands on the code box of the new page", async ({ page }) => {
    const db = new ContestsDb("student");
    await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
    await page.goto("/contests/join");
    await expect(page).toHaveURL(/\/contests$/);
    await expect(page.getByLabel("Contest code or link")).toBeFocused();
  });

  for (const width of [1440, 1280, 768, 430, 390, 375, 360, 320]) {
    test(`student page at ${width}px: no sideways scroll, banners + list + sidebar render`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 844 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const db = new ContestsDb("student");
      await db.install(page, sessionFor("student", "stu-1", "Asha Verma").session);
      await page.goto("/contests");
      await expect(row(page, "Light & Electricity Live")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Join a contest" })).toBeAttached();
      await expect(page.getByRole("heading", { name: "Live now" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Starting soon" })).toBeVisible();
      if (width < 1024) {
        await page.waitForTimeout(500);
        expect(db.boardCalls, "leaderboard must wait until the sidebar is on screen").toBe(0);
        await page.getByRole("heading", { name: "Latest results" }).scrollIntoViewIfNeeded();
      }
      await expect(page.getByText("Kabir Singh")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      const o = await overflow(page);
      expect(o.ok, `${width}px — ${o.report}`).toBe(true);
      if ([1440, 1280, 768, 390, 320].includes(width)) await shot(page, `student-${width}`);
      await ctx.close();
    });
  }

  test("new student with no contests: designed empty state, no fake rows", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const db = new ContestsDb("student", { empty: true });
    await db.install(page, sessionFor("student", "stu-2", "Neha Gupta").session);
    await page.goto("/contests");
    await expect(page.getByText("No live or upcoming contests")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your next contest shows up here" })).toBeVisible();
    await page.getByRole("button", { name: "Enter a code" }).first().click();
    await expect(page.getByLabel("Contest code or link")).toBeFocused();
    await shot(page, "student-1280-empty");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, "student-390-empty");
  });
});
