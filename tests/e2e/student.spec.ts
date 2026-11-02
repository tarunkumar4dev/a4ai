// Student experience end to end (dashboard, practice, rewards + shared nav). Supabase and the NCERT backend
// endpoints are mocked in the browser — no live DB, no live backend. Data shapes follow the real responses
// (get_my_contests from 29_contest_feed.sql, /ncert-question-stats and /ncert-questions checked on prod, 1 Nov).
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

const MOCK = "http://mock.supabase.local";
const UID = "5b8f0c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b"; // a real UUID: CoinContext only reads coins for UUID users
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;

function session(name: string) {
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", exp })}.sig`;
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "asha@example.com",
    user_metadata: { full_name: name, role: "student" }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
  return { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
}

type Opts = { empty?: boolean; coins?: number | null; backendDown?: boolean; signedOut?: boolean };

class StudentDb {
  opts: Opts;
  calls: Record<string, number> = {};
  sessionJson: ReturnType<typeof session> | null = null;
  constructor(opts: Opts = {}) { this.opts = opts; }
  hit(k: string) { this.calls[k] = (this.calls[k] ?? 0) + 1; }

  feed(view: string) {
    const now = Date.now();
    const iso = (ms: number) => new Date(now + ms).toISOString();
    const base = { class_grade: "10", duration_minutes: 45, total_questions: 25, total_marks: 25, status: "active", answer_mode: "after_test",
      attempts: 12, registered_at: null, results_pending: false, my_score: null, my_percentage: null, my_submitted_at: null, expires_at: null };
    const upcoming = this.opts.empty ? [] : [
      { ...base, id: "c-open", short_code: "open0003", title: "Algebra Practice Contest", subject: "Mathematics", scheduled_at: null, my_state: "in_progress" },
      { ...base, id: "c-soon", short_code: "soon0002", title: "Sunday Chemistry Mock", subject: "Chemistry", scheduled_at: iso(2 * 86400_000), my_state: "registered" },
    ];
    const past = this.opts.empty ? [] : [
      { ...base, id: "c-done", short_code: "done0004", title: "Light & Electricity Test", subject: "Physics", scheduled_at: null, my_state: "submitted", my_score: 20, my_percentage: 80, my_submitted_at: iso(-86400_000) },
      { ...base, id: "c-pend", short_code: "pend0005", title: "Optics Unit Test", subject: "Physics", scheduled_at: null, my_state: "submitted", results_pending: true, my_submitted_at: iso(-2 * 86400_000) },
    ];
    const items = view === "past" ? past : upcoming;
    return { server_now: new Date(now).toISOString(), view, items, next_cursor: null,
      counts: { upcoming: upcoming.length, past: past.length, live: upcoming.length ? 1 : 0 },
      subjects: [], next: upcoming[0] ?? null, scheduled: upcoming.filter((x) => x.scheduled_at).map((x) => x.scheduled_at) };
  }

  stats(subject: string) {
    if (subject !== "Mathematics") return { ok: true, chapters: [{ chapter: `${subject} basics`, total: 30, chapter_no: 1, types: [{ name: "exercise", count: 30 }] }] };
    return { ok: true, chapters: [
      { chapter: "Real Numbers", total: 24, chapter_no: 1, types: [{ name: "exercise", count: 14 }, { name: "example", count: 10 }] },
      { chapter: "Polynomials", total: 18, chapter_no: 2, types: [{ name: "exercise", count: 18 }] },
      { chapter: "Statistics", total: 9, chapter_no: 13, types: [{ name: "mcq", count: 9 }] },
    ] };
  }

  questions(url: URL) {
    const offset = Number(url.searchParams.get("offset") || 0);
    const qs = [
      { id: 101, question_number: "1.1", question_text: "Prove that $\\sqrt{2}$ is irrational.", question_type: "exercise", difficulty: "medium", answer: "None", options: null, section: "EXERCISE 1.1" },
      { id: 102, question_number: "2", question_text: "Which of these is a rational number?", question_type: "mcq", difficulty: "easy", answer: "(b)", options: ["√2", "0.25", "π", "√3"], section: "1.2" },
      { id: 103, question_number: "Ex 1", question_text: "Find the HCF of 96 and 404.", question_type: "example", difficulty: "hard", answer: "HCF = 4", options: null, image_url: "https://img.example.invalid/fig.png", section: "Examples" },
      { id: 103, question_number: "Ex 1", question_text: "duplicate row", question_type: "example" },
    ];
    return { ok: true, total: 24, questions: offset === 0 ? qs : qs.slice(0, 2).map((q) => ({ ...q, id: q.id + offset })), hasMore: offset < 20, limit: 10, offset };
  }

  async install(ctx: BrowserContext | Page, name = "Asha Verma") {
    if (!this.opts.signedOut) await ctx.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session(name))]);
    this.sessionJson = session(name);
    await ctx.route(`${MOCK}/**`, (r) => this.handle(r));
    await ctx.route((u) => !["localhost", "mock.supabase.local"].includes(u.hostname), (r) => r.abort()); // also fails the figure image
    await ctx.route("**/images/LOGO.png", (r) => r.abort());
    await ctx.route("**/api/v1/test-generator/ncert-question-stats*", (r) => {
      this.hit("stats");
      if (this.opts.backendDown) return r.abort("connectionrefused");
      const subject = new URL(r.request().url()).searchParams.get("subject") || "";
      return r.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(this.stats(subject)) });
    });
    await ctx.route("**/api/v1/test-generator/ncert-questions*", (r) => {
      this.hit("questions");
      if (this.opts.backendDown) return r.abort("connectionrefused");
      return r.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(this.questions(new URL(r.request().url()))) });
    });
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  private handle(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/token")) return this.json(route, this.sessionJson);   // password sign-in
    if (url.pathname.startsWith("/auth/v1/user")) return this.json(route, this.sessionJson?.user ?? {});
    if (url.pathname.startsWith("/auth/")) return this.json(route, {});
    const table = url.pathname.replace("/rest/v1/", "");
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (table === "rpc/get_my_access") return this.json(route, [{ institute_id: null, institute_name: null, primary_role: "none", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: [] }]);
    if (table === "rpc/get_my_contests") { this.hit("feed"); return this.json(route, this.feed(JSON.parse(req.postData() || "{}").p_view)); }
    if (table === "profiles") {
      if (this.opts.coins === null) return this.json(route, { message: "boom" }, 500);
      const row = { coins: this.opts.coins ?? 250, total_coins_earned: 300, full_name: "Asha Verma", school_name: "Green Valley School" };
      return this.json(route, one ? row : [row]); // maybeSingle() GETs a list
    }
    if (table === "ncert_questions") {                       // direct read when the backend is down
      this.hit("ncert_db");
      if ((url.searchParams.get("select") || "").includes("question_text")) {
        const qs = this.questions(url).questions.slice(0, 3);
        return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json", "content-range": `0-2/12` }, body: JSON.stringify(qs) });
      }
      const rows = [...Array(12)].map(() => ({ chapter: "1. Real Numbers", question_type: "exercise" }))
        .concat([...Array(5)].map(() => ({ chapter: "2. Polynomials", question_type: "example" })));
      return this.json(route, url.searchParams.get("subject")?.includes("Mathematics") ? rows : []);
    }
    if (table === "coin_transactions") {
      this.hit("coin_tx");
      if (this.opts.empty) return this.json(route, []);
      return this.json(route, [
        { id: "t1", user_id: UID, type: "earn", amount: 300, description: "Welcome bonus", contest_id: null, created_at: "2026-10-20T10:00:00Z" },
        { id: "t2", user_id: UID, type: "spend", amount: -50, description: "Old coin shop", contest_id: null, created_at: "2026-10-25T10:00:00Z" },
      ]);
    }
    return this.json(route, one ? {} : []);
  }
}

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
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const FAKE = ["Top 20%", "FREE Coins", "day streak", "Daily login bonus", "Weekly streak bonus", "Code will be sent"];

test.describe("desktop", () => {
  test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("dashboard: real data only, continue + plan + contests + activity", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/student/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /, Asha!/ })).toBeVisible();
    await expect(page.getByText("Green Valley School").first()).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const f of FAKE) await expect(page.getByText(f)).toHaveCount(0);
    // stats: from the feed / coins; average over scored results only (pending one excluded)
    const overview = page.getByRole("region", { name: "Your progress" });
    await expect(overview.getByText("80%")).toBeVisible();
    await expect(overview.getByText("250")).toBeVisible();
    // continue: the in-progress contest attempt; primary CTA resumes it
    await expect(page.getByRole("link", { name: /Continue learning: Algebra Practice Contest/ })).toHaveAttribute("href", "/contest/open0003");
    await expect(page.getByRole("heading", { name: "Sunday Chemistry Mock" })).toBeVisible();
    await expect(page.getByText("Submitted Light & Electricity Test")).toBeVisible();
    await expect(page.getByText("Results soon").first()).toBeVisible();
    await page.getByRole("button", { name: "हिंदी में देखें" }).click();
    await expect(page.getByRole("heading", { name: "आपकी प्रगति" })).toBeVisible();
    await shot(page, "dashboard-1366");
  });

  test("practice: class → subject counts → chapter → session; marks are idempotent and survive refresh", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice. Improve. Master." })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Class\s*8/ })).toBeDisabled();
    const maths = page.getByRole("button", { name: /Mathematics/ });
    await expect(maths).toContainText("51 questions · 3 chapters");
    await maths.click();
    await expect(page).toHaveURL(/subject=Mathematics/);
    await page.getByLabel("Search chapters").fill("poly");
    await expect(page.getByRole("heading", { name: "Polynomials" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Real Numbers" })).toHaveCount(0);
    await page.getByLabel("Search chapters").fill("");
    await shot(page, "practice-1366");
    await page.getByRole("link", { name: "Practise: Real Numbers" }).click();

    await expect(page.getByRole("heading", { name: /Question 1/ })).toBeVisible();
    await expect(page.getByText("No answer key for this question")).toBeVisible();
    const got = page.getByRole("button", { name: "I got it" });
    await got.dblclick();
    await expect(got).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "This chapter" }).getByText("1", { exact: true }).first()).toBeVisible();

    await page.keyboard.press("ArrowRight");                         // MCQ with a key
    await expect(page.getByRole("heading", { name: /Question 2/ })).toBeVisible();
    await page.getByLabel(/0\.25/).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click(); // solved example: answer + failed figure
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.getByText("HCF = 4")).toBeVisible();
    await expect(page.getByText("The figure couldn't load.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Question \d/ })).toHaveCount(3);   // duplicate row dropped
    await shot(page, "practice-session-1366");

    await page.reload();                                               // URL keeps the place, device keeps the mark
    await expect(page.getByRole("heading", { name: /Question 3/ })).toBeVisible();
    await page.getByRole("button", { name: "Question 1, got it" }).click();
    await expect(page.getByRole("button", { name: "I got it" })).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await page.goto("/practice?class=10&subject=Mathematics");
    await expect(page.getByText("1 got it · 0 to review")).toBeVisible();
  });

  test("practice still works when the backend is down (direct read of the question bank)", async ({ page }) => {
    const db = new StudentDb({ backendDown: true });
    await db.install(page);
    await page.goto("/practice?class=10&subject=Mathematics");
    await expect(page.getByRole("button", { name: /Mathematics/ })).toContainText("17 questions · 2 chapters");
    await expect(page.getByText("Count unavailable")).toHaveCount(0);
    await page.getByRole("link", { name: /^Practise: 1\. Real Numbers/ }).click();
    await expect(page.getByRole("heading", { name: /Question 1/ })).toBeVisible();
    await expect(page.getByText("Set 1 of 2 · 12 questions")).toBeVisible();
    expect(db.calls.ncert_db).toBeGreaterThan(0);
  });

  test("rewards: real balance + history, milestones from results, no fake catalogue; /coinshop redirects", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/coinshop");
    await expect(page).toHaveURL(/\/rewards$/);
    await expect(page.getByRole("heading", { name: "Your coin balance" })).toBeVisible();
    await expect(page.getByText("250", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Welcome bonus")).toBeVisible();
    await expect(page.getByText("−50")).toBeVisible();
    // vouchers: real progress from the balance, redeeming off, banned games not offered
    const zomato = page.getByRole("article", { name: "Zomato" });
    await expect(zomato.getByText("250 / 1,000")).toBeVisible();
    await expect(zomato.getByText("750 more coins needed")).toBeVisible();
    await expect(page.getByRole("button", { name: /Redeem/ })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "PUBG" })).toHaveCount(0);
    await page.getByRole("button", { name: "Food", exact: true }).click();
    await expect(page.getByRole("article", { name: "Flipkart" })).toHaveCount(0);
    await expect(zomato).toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();
    for (const f of FAKE) await expect(page.getByText(f)).toHaveCount(0);
    const ms = page.getByRole("region", { name: "Milestones" });
    await expect(ms.getByText("Reached")).toHaveCount(2);            // first contest + 75 %+
    await expect(nav(page).getByRole("link", { name: "Rewards" })).toHaveAttribute("aria-current", "page");
    await shot(page, "rewards-1366");
  });

  test("unknown balance is never shown as a number", async ({ page }) => {
    const db = new StudentDb({ coins: null });
    await db.install(page);
    await page.goto("/rewards");
    await expect(page.getByText("Balance unavailable right now")).toBeVisible();
    await expect(page.getByText("100", { exact: true })).toHaveCount(0);
  });

  test("old routes land on the new pages; back / forward keep the active tab", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    for (const [from, to] of [["/practice/zone", /\/practice$/], ["/daily-practice", /\/practice$/], ["/dashboard/coinshop", /\/rewards$/]] as const) {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
    await page.goto("/student/dashboard");
    await nav(page).getByRole("link", { name: "Practice" }).click();
    await expect(nav(page).getByRole("link", { name: "Practice" })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(nav(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await expect(page).toHaveURL(/\/practice$/);
  });

  test("new student: designed empty states, no invented numbers", async ({ page }) => {
    const db = new StudentDb({ empty: true, coins: 0 });
    await db.install(page, "Neha Gupta");
    await page.goto("/student/dashboard");
    await expect(page.getByText("Nothing in progress")).toBeVisible();
    await expect(page.getByText("No upcoming contests")).toBeVisible();
    await expect(page.getByRole("region", { name: "Your progress" }).getByText("no scored contests yet")).toBeVisible();
    await shot(page, "dashboard-1366-empty");
  });
});

test.describe("student account routing", () => {
  // a desktop browser: the login page opens on email there (phones start on WhatsApp OTP)
  test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" });

  test("a student who signs in again lands on the student dashboard, never the teacher one", async ({ page }) => {
    const db = new StudentDb({ signedOut: true });
    await db.install(page);
    // a person's browser: the login form asks automated browsers (navigator.webdriver) for a human check
    await page.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
    await page.goto("/login");
    await page.getByLabel(/^Email/).first().fill("asha@example.com");
    await page.getByLabel(/^Password/).first().fill("secret-pass-1");
    await page.waitForTimeout(2500); // the login form's bot check flags instant submits
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: /, Asha!/ })).toBeVisible();
    await page.goto("/dashboard");                                   // typing the teacher URL bounces back
    await expect(page).toHaveURL(/\/student\/dashboard$/);
  });

  test("school portal is for access codes; students without one are sent to their own account", async ({ page }) => {
    const db = new StudentDb({ signedOut: true });
    await db.install(page);
    await page.goto("/student");
    await expect(page.getByText(/school, college or institute/)).toBeVisible();
    await page.getByRole("link", { name: "Create a student account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.goto("/login");
    await page.getByRole("link", { name: "Open the student portal" }).click();
    await expect(page).toHaveURL(/\/student$/);
  });
});

test.describe("flashcards + notes", () => {
  test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("flashcards: class → subject → deck; flip, K marks + advances, card note lands in My notes", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/dashboard/flashcards");
    await expect(page.getByRole("heading", { level: 1, name: "Recall it. Remember it." })).toBeVisible();
    for (const f of ["4.9", "10k+", "Community Notes", "Gamified", "Student Mode"]) await expect(page.getByText(f)).toHaveCount(0);
    await expect(nav(page).getByRole("link", { name: "Flashcards" })).toHaveAttribute("aria-current", "page");
    const sci = page.getByRole("button", { name: /Science/ });
    await expect(sci).toContainText("139 cards · 13 chapters");
    await sci.click();
    await expect(page).toHaveURL(/subject=Science/);
    await page.screenshot({ path: "test-results/visual/flashcards-1366.png", fullPage: true });
    await page.getByRole("link", { name: /^Study: Chemical Reactions/ }).click();

    await expect(page.getByText("Card 1 of")).toBeVisible();
    await page.getByRole("button", { name: "Show the answer" }).click();
    await expect(page.getByText("Answer", { exact: true })).toBeVisible();
    await page.keyboard.press("k");
    await expect(page.getByText("Card 2 of")).toBeVisible();
    await expect(page.getByText(/1 of \d+ known/)).toBeVisible();
    await page.getByRole("textbox", { name: "My note for this card" }).fill("Balanced equation = same atoms both sides");
    await expect(page.getByRole("status").filter({ hasText: /^Saved on this device$/ })).toBeVisible();
    await page.screenshot({ path: "test-results/visual/flashcard-deck-1366.png", fullPage: true });
    await page.reload();
    await expect(page.getByText("Card 2 of")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "My note for this card" })).toHaveValue("Balanced equation = same atoms both sides");

    await page.goto("/notes?filter=flashcards");
    await expect(page.getByText("Balanced equation = same atoms both sides")).toBeVisible();
    await page.getByRole("link", { name: "Open card" }).click();
    await expect(page).toHaveURL(/flashcards\/deck\?class=10&subject=Science&chapter=1&card=1/);

    await page.goto("/dashboard/flashcards/Science/1");                 // old URL
    await expect(page).toHaveURL(/flashcards\/deck\?class=9&subject=Science&chapter=1/);
  });

  test("notes: write, search, pin, delete with confirmation; no app-wide dark mode", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/notes");
    await expect(page.getByText("No notes yet")).toBeVisible();
    await page.getByRole("button", { name: "New note" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Ohm's law");
    await page.getByLabel("Class", { exact: true }).selectOption("10");
    await page.getByLabel("Subject", { exact: true }).fill("Science");
    await page.getByLabel("Note", { exact: true }).fill("V = IR. Resistance in ohms.");
    await page.getByLabel(/Tags/).fill("formula, revise");
    await page.getByRole("button", { name: "Save note" }).click();
    await page.getByRole("button", { name: "New note" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Algebra identities");
    await page.getByLabel("Note", { exact: true }).fill("(a+b)^2 = a^2 + 2ab + b^2");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByRole("heading", { name: "Ohm's law" })).toBeVisible();
    await expect(page.getByText("#formula")).toBeVisible();
    await page.getByLabel("Search notes").fill("ohms");
    await expect(page.getByRole("heading", { name: "Algebra identities" })).toHaveCount(0);
    await page.getByLabel("Search notes").fill("");
    await page.getByRole("button", { name: "Pin Algebra identities" }).click();
    await page.getByRole("tab", { name: /Pinned/ }).click();
    await expect(page.getByRole("heading", { name: "Ohm's law" })).toHaveCount(0);
    await page.getByRole("tab", { name: /All/ }).click();
    await page.screenshot({ path: "test-results/visual/notes-1366.png", fullPage: true });
    await page.getByRole("button", { name: "Delete Ohm's law" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("heading", { name: "Ohm's law" })).toBeVisible();
    await page.getByRole("button", { name: "Delete Ohm's law" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ohm's law" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Algebra identities" })).toBeVisible();
  });
});

test.describe("phone (Pixel 5)", () => {
  test("one compact nav with a menu; pages stack without sideways scroll", async ({ page }) => {
    const db = new StudentDb();
    await db.install(page);
    await page.goto("/student/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    for (const l of ["Dashboard", "Contests", "Practice", "Flashcards", "Notes", "Rewards"]) await expect(page.getByRole("menuitem", { name: l })).toBeVisible();
    await page.getByRole("menuitem", { name: "Practice" }).click();
    await expect(page).toHaveURL(/\/practice$/);
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, "practice-393");
    await page.goto("/rewards");
    await shot(page, "rewards-393");
    await page.goto("/student/dashboard");
    await shot(page, "dashboard-393");
    await page.goto("/dashboard/flashcards?class=10&subject=Science");
    await shot(page, "flashcards-393");
    await page.goto("/notes");
    await shot(page, "notes-393");
  });
});

test.describe("widths", () => {
  test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    test(`dashboard, practice, rewards at ${width}px: no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const db = new StudentDb();
      await db.install(page);
      for (const [path, heading] of [["/student/dashboard", /, Asha!/], ["/practice?class=10&subject=Mathematics", /Practice\. Improve/], ["/rewards", /Your coin balance/],
        ["/dashboard/flashcards?class=10&subject=Science", /Recall it/], ["/notes", /Your notes, in one place/]] as const) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        if (path.startsWith("/practice")) await expect(page.getByRole("heading", { name: "Real Numbers" })).toBeVisible();
        const o = await overflow(page);
        expect(o.ok, `${path} @ ${width}px — ${o.report}`).toBe(true);
        if ([320, 768, 1440].includes(width)) await shot(page, `${path.split("?")[0].replace(/\//g, "_").replace(/^_/, "")}-${width}`);
      }
    });
  }
});
