// a4ai Agent (/dashboard?tab=agent + the floating sheet) end to end. Supabase AND the agent backend are mocked in
// the browser: /agent/meta, /agent/sessions, /agent/chat (text/event-stream bodies built from contract-1.1 events),
// /agent/approve, /agent/drafts/:id/pdf. No live DB, no backend.
// Build with VITE_AGENT_URL=http://mock.agent.local (any agent origin works: every non-app /agent/* URL is mocked).
// AGENT_SHOTS=1 also writes docs/screenshots/agent-*.png (390 / 1440, light / dark).
import { test, expect, type Page, type Route } from "@playwright/test";
import path from "path";

if (process.env.PW_CHROMIUM_PATH) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const MOCK = "http://mock.supabase.local";
const INST = "inst-1", USER = "user-t1";
const DRAFT = "0f8fad5b-d9cb-469f-a165-70867728950e";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", exp })}.sig`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "teacher.ece2@msit.a4ai.in", user_metadata: { full_name: "Priya Sharma" }, app_metadata: { provider: "email" }, created_at: "2026-10-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
const access = { institute_id: INST, institute_name: "MSIT", primary_role: "teacher", home_route: "/dashboard", hod_department_ids: [], proctor_section_ids: [], teaching_batch_ids: ["b-1"] };

// ---- realistic agent event streams ---------------------------------------------------------------
const AS_OF = "2026-11-06T13:13:43+05:30";
let reqN = 0;
function stream(events: Record<string, unknown>[]): string {
  const rid = `req-${++reqN}`;
  return events.map((e, i) => `data: ${JSON.stringify({ seq: i, request_id: rid, ...e })}\n\n`).join("");
}
const tool = (name: string, ms: number, ok = true) => [
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "start" } },
  { type: "thinking_status", key: `tool.${name}`, params: { phase: "done", ms, ok } },
];
const SRC = { source: "tool:attendance_stats", as_of: AS_OF };
const final = { type: "final", session_id: "sess-1", usage: {} };

const ATTENDANCE = [
  ...tool("resolve_entity", 412), ...tool("attendance_stats", 1180),
  { type: "stat_card", ...SRC, title: "Attendance · ECE-2", value: "83.8", unit: "%", period: "1–6 Nov 2026", delta: "+2.1 pts vs Oct", subtitle: null },
  { type: "stat_card", ...SRC, title: "Classes held", value: "18", unit: null, period: "1–6 Nov 2026" },
  { type: "stat_card", ...SRC, title: "Below 75%", value: "6", unit: "students", period: "1–6 Nov 2026" },
  { type: "text_delta", text: "ECE-2 ki attendance is mahine **83.8%** hai — October se 2.1 points zyada.\n\n" },
  { type: "text_delta", text: "- 18 classes hui\n- **6 students** 75% se neeche hain\n\nKya main un 6 students ki list dikhaun?" },
  final,
];
const ATTENDANCE_MORE = [
  ...tool("low_attendance_list", 640), ...tool("attendance_trend", 720),
  { type: "chart", source: "tool:attendance_trend", as_of: AS_OF, kind: "line", title: "Weekly attendance · ECE-2", y_unit: "%",
    series: [{ name: "ECE-2", points: [["13 Oct", 79.5], ["20 Oct", 81.2], ["27 Oct", null], ["3 Nov", 83.8]] }] },
  { type: "table", source: "tool:low_attendance_list", as_of: AS_OF, title: "Below 75% · ECE-2", columns: ["Student", "Roll no", "Attendance", "Absent"],
    rows: [["Aarav Gupta", "ECE2-07", "61.1%", "7"], ["Diya Verma", "ECE2-12", "66.7%", "6"], ["Kabir Singh", "ECE2-19", "72.2%", "5"], ["Meera Nair", "ECE2-23", null, "—"], ["Rohan Das", "ECE2-31", "70.0%", "6"], ["Sana Khan", "ECE2-38", "74.4%", "4"]] },
  { type: "text_delta", text: "27 Oct wale hafte ka data nahi hai (chhutti), isliye graph me gap hai." },
  final,
];
const CLARIFY = [
  ...tool("resolve_entity", 380),
  { type: "clarify", question: "Do Rahul Kumar mile. Kaun se?", chips: [{ label: "Rahul Kumar (10A)", value: "Rahul Kumar (10A)" }, { label: "Rahul Kumar (10B)", value: "Rahul Kumar (10B)" }] },
  final,
];
const CLARIFY_ANSWER = [
  ...tool("attendance_stats", 900),
  { type: "stat_card", ...SRC, title: "Rahul Kumar (10A)", value: "91.7", unit: "%", period: "Oct 2026" },
  { type: "text_delta", text: "Rahul Kumar (10A) ki attendance October me **91.7%** rahi." },
  final,
];
const BLUEPRINT = [
  ...tool("resolve_entity", 210), ...tool("blueprint_defaults", 350),
  { type: "blueprint", class_grade: 10, subject: "Mathematics", chapters: ["Introduction to Trigonometry", "Some Applications of Trigonometry"], total_marks: 40, duration_min: 90,
    sections: [{ section: "A", qtype: "mcq", count: 8, marks_each: 1 }, { section: "B", qtype: "very_short", count: 4, marks_each: 2 }, { section: "C", qtype: "short_answer", count: 3, marks_each: 3 }, { section: "D", qtype: "long_answer", count: 1, marks_each: 5 }, { section: "E", qtype: "case_study", count: 1, marks_each: 10 }] },
  { type: "text_delta", text: "CBSE pattern ka blueprint tayyar hai. Numbers badal sakte hain, phir **Looks good** dabaiye." },
  final,
];
const q = (id: string, section: string, qtype: string, marks: number, text: string, extra: Record<string, unknown> = {}) =>
  ({ id, section, qtype, marks, text, status: "verified", answer: null, marking_scheme: null, options: null, sub_questions: null, ...extra });
const PAPER = [
  ...tool("generate_questions", 5200),
  { type: "thinking_status", key: "status.generating", params: { n: 17 } },
  { type: "thinking_status", key: "status.verifying", params: { round: 1 } },
  ...tool("verify_paper", 2100),
  { type: "thinking_status", key: "status.regenerating", params: { ids: ["q6"] } },
  ...tool("regenerate_failed", 1500),
  { type: "paper_preview", draft_id: DRAFT, title: "Introduction to Trigonometry — Unit Test", total_marks: 40, duration_min: 90, questions: [
    q("q1", "A", "mcq", 1, "If $\\sin A = \\frac{3}{5}$, then $\\cos A$ is:", { options: ["$\\frac{4}{5}$", "$\\frac{3}{4}$", "$\\frac{5}{4}$", "$\\frac{5}{3}$"], answer: "(a) $\\frac{4}{5}$" }),
    q("q2", "A", "mcq", 1, "The value of $\\tan 45^\\circ$ is:", { options: ["0", "1", "$\\sqrt{3}$", "$\\frac{1}{\\sqrt{3}}$"], answer: "(b) 1" }),
    q("q3", "A", "mcq", 1, "$\\sin^2 30^\\circ + \\cos^2 30^\\circ$ equals:", { options: ["0", "$\\frac{1}{2}$", "1", "2"], answer: "(c) 1" }),
    q("q4", "B", "very_short", 2, "Evaluate: $\\frac{\\sin 60^\\circ}{\\cos 30^\\circ}$", { answer: "1", marking_scheme: ["Both values: 1 mark", "Answer: 1 mark"] }),
    q("q5", "B", "very_short", 2, "If $\\sec\\theta = \\frac{13}{12}$, find $\\cot\\theta$.", { answer: "$\\frac{12}{5}$", status: "rubric_ok" }),
    q("q6", "C", "short_answer", 3, "Prove that $(\\sin A + \\cos A)^2 = 1 + 2\\sin A\\cos A$.", { status: "manual_review", marking_scheme: ["Expand: 1 mark", "Use identity: 1 mark", "Conclude: 1 mark"] }),
    q("q7", "D", "long_answer", 5, "From the top of a 75 m high lighthouse, the angles of depression of two ships are $30^\\circ$ and $45^\\circ$. Find the distance between the ships.", { answer: "$75(\\sqrt{3}-1)$ m", status: "rubric_ok" }),
    q("q8", "E", "case_study", 10, "A kite is flying at a height of 60 m. The string makes an angle of $60^\\circ$ with the ground.",
      { sub_questions: [{ text: "Find the length of the string.", marks: 4 }, { text: "If the angle becomes $45^\\circ$, find the new length.", marks: 4 }, { text: "Which angle needs a longer string?", marks: 2 }], answer: "(i) $40\\sqrt{3}$ m (ii) $60\\sqrt{2}$ m (iii) $45^\\circ$" }),
  ] },
  { type: "verification_summary", objective_verified: 4, objective_total: 4, rubric_checked: 2, rubric_total: 3, manual_review: ["q6"], marks_sum_ok: true, duplicates: [], rounds: 2 },
  { type: "pending_approval", approval_id: "appr-1", action: "finalize_test", summary: "Class 10 Mathematics · Introduction to Trigonometry — 8 sawaal, 40 marks, 90 min. Test History me save hoga.", args_sha256: "a".repeat(64), expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
  final,
];

// ---- mocks --------------------------------------------------------------------------------------------
type ChatCall = { message: string; session_id: string | null; auth: string | undefined };
class Mocks {
  chats: ChatCall[] = [];
  approvals: Record<string, unknown>[] = [];
  queue: string[][] = [];
  sessions: { session_id: string; title: string; created_at: string; updated_at: string }[] = [];
  chatDelayMs = 0;
  meta = { data_source: "live", read_only: true, role: "teacher", first_name: "Priya", institute_name: "MSIT" };

  async install(page: Page) {
    await page.addInitScript(([s]) => { localStorage.setItem("a4ai.auth.token", s); }, [JSON.stringify(session)]);
    await page.route(u => !["localhost", "mock.supabase.local", "mock.agent.local"].includes(u.hostname), r => r.abort());
    await page.route(`${MOCK}/**`, (route) => this.supabase(route));
    await page.route(u => u.pathname.startsWith("/agent/") && u.port !== "4173", (route) => this.agent(route));
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  private supabase(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return this.json(route, user);
    if (url.pathname.startsWith("/auth/")) return this.json(route, {});
    if (url.pathname.startsWith("/storage/")) return route.fulfill({ status: 404, headers: cors, body: "" });
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "rpc/get_my_access") return this.json(route, [access]);
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": "*/0" }, body: "" });
    return this.json(route, one ? {} : []);
  }

  private async agent(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const p = new URL(req.url()).pathname;
    if (p === "/agent/meta") return this.json(route, this.meta);
    if (p === "/agent/sessions") return this.json(route, { sessions: this.sessions });
    if (p === "/agent/approve") {
      this.approvals.push(JSON.parse(req.postData() || "{}"));
      return this.json(route, { ok: true, status: "finalized", test_id: "t-1", download_path: `/agent/drafts/${DRAFT}/pdf` });
    }
    if (p === `/agent/drafts/${DRAFT}/pdf`) return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/pdf" }, body: "%PDF-1.4\n%mock\n" });
    if (p === "/agent/chat") {
      const body = JSON.parse(req.postData() || "{}");
      this.chats.push({ message: body.message, session_id: body.session_id ?? null, auth: req.headers()["authorization"] });
      const events = this.queue.shift() ?? [{ type: "text_delta", text: "OK" }, final];
      if (this.chatDelayMs) await new Promise((r) => setTimeout(r, this.chatDelayMs));
      if (!this.sessions.length) this.sessions.push({ session_id: "sess-1", title: body.message.slice(0, 60), created_at: "2026-11-06T13:00:00+05:30", updated_at: "2026-11-06T13:13:00+05:30" });
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream", "cache-control": "no-cache" }, body: stream(events) });
    }
    return this.json(route, { detail: "not found" }, 404);
  }
}

async function openAgent(page: Page, m: Mocks) {
  await m.install(page);
  await page.goto("/dashboard?tab=agent");
  await expect(page.getByTestId("agent-workspace")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("data-source")).toHaveText("Live · read-only");
}

const chatPage = (page: Page) => page.getByTestId("agent-chat-page");
const input = (page: Page) => chatPage(page).getByLabel("Message a4ai Agent");

async function ask(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press("Enter");
}

test("attendance answer: stat cards + prose, steps summary, history survives a reload", async ({ page }) => {
  const m = new Mocks();
  m.queue.push(ATTENDANCE.map((e) => ({ ...e })));
  await openAgent(page, m);
  await expect(page.getByRole("heading", { name: /Namaste, Priya/ })).toBeVisible();
  await expect(chatPage(page).getByTestId("role-badge")).toHaveText("Teacher");
  await expect(page.getByTestId("ask-a4ai")).toHaveCount(0); // launcher hidden on the agent tab

  await chatPage(page).getByRole("button", { name: /Meri class ki attendance/ }).click();
  await expect(page.getByTestId("msg-user")).toHaveText("Meri class ki attendance");
  const grid = page.getByTestId("stat-grid");
  await expect(grid.getByTestId("stat-card")).toHaveCount(3);
  await expect(grid).toContainText("83.8");
  await expect(grid).toContainText("+2.1 pts vs Oct");
  await expect(grid).toContainText("Source: Attendance stats");
  await expect(chatPage(page).locator("strong", { hasText: "83.8%" })).toBeVisible();
  await expect(page.getByTestId("steps")).toContainText(/2 steps · \d/);
  expect(m.chats[0]).toMatchObject({ message: "Meri class ki attendance", session_id: null });
  expect(m.chats[0].auth).toBe(`Bearer ${jwt}`);
  await expect(chatPage(page).getByLabel("Message a4ai Agent")).toBeEnabled();

  // follow-up in the same session → chart (null = gap) + sortable table
  m.queue.push(ATTENDANCE_MORE.map((e) => ({ ...e })));
  await ask(page, "Haan, list dikhao");
  await expect(page.getByTestId("agent-chart")).toBeVisible();
  const table = page.getByTestId("data-table");
  await expect(table).toContainText("Aarav Gupta");
  expect(m.chats[1].session_id).toBe("sess-1");
  await table.getByRole("button", { name: /^Attendance/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Aarav Gupta");
  await table.getByRole("button", { name: /^Attendance/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Sana Khan");
  await expect(table.locator("tbody tr").last()).toContainText("Meera Nair"); // null stays last

  await page.reload();
  await expect(page.getByTestId("agent-workspace")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("msg-user").first()).toHaveText("Meri class ki attendance");
  await expect(page.getByTestId("stat-grid")).toContainText("83.8");
  await expect(page.getByTestId("agent-sessions").locator('[aria-current="true"]')).toContainText("Meri class ki attendance");
});

test("clarify flow: tapping a chip sends a second stream in the same session", async ({ page }) => {
  const m = new Mocks();
  m.queue.push(CLARIFY.map((e) => ({ ...e })), CLARIFY_ANSWER.map((e) => ({ ...e })));
  await openAgent(page, m);
  await ask(page, "Rahul Kumar ki attendance");
  const clarify = page.getByTestId("clarify");
  await expect(clarify).toContainText("Do Rahul Kumar mile");
  await clarify.getByRole("button", { name: "Rahul Kumar (10A)" }).click();
  await expect(chatPage(page).getByTestId("stat-card")).toContainText("91.7");
  await expect.poll(() => m.chats.map((c) => [c.message, c.session_id])).toEqual([["Rahul Kumar ki attendance", null], ["Rahul Kumar (10A)", "sess-1"]]);
  await expect(clarify.getByRole("button", { name: "Rahul Kumar (10A)" })).toHaveAttribute("aria-pressed", "true");
  await expect(clarify.getByRole("button", { name: "Rahul Kumar (10B)" })).toBeDisabled();
});

test("trigonometry paper: blueprint → paper + verification → approval → Approve → Download", async ({ page }) => {
  const m = new Mocks();
  m.queue.push(BLUEPRINT.map((e) => ({ ...e })), PAPER.map((e) => ({ ...e })));
  await openAgent(page, m);
  await ask(page, "Class 10 trigonometry test banao, 40 marks");
  const bp = page.getByTestId("blueprint");
  await expect(bp.getByTestId("blueprint-total")).toHaveText("Total 40 / 40");
  // an edit that breaks the total turns it red and blocks "Looks good"; undo restores it
  await bp.getByLabel("Section A questions").fill("10");
  await expect(bp.getByTestId("blueprint-total")).toContainText("Total 42 / 40");
  await expect(bp.getByRole("button", { name: /Looks good/ })).toBeDisabled();
  await bp.getByLabel("Section A questions").fill("8");
  await bp.getByRole("button", { name: /Looks good/ }).click();
  await expect.poll(() => m.chats[1]).toMatchObject({ message: "Blueprint theek hai, paper banao", session_id: "sess-1" });

  const paper = page.getByTestId("paper-preview");
  await expect(paper).toContainText("Max. Marks: 40");
  await expect(paper).toContainText("Class 10 · Mathematics");
  for (const s of ["A", "B", "C", "D", "E"]) await expect(paper).toContainText(`SECTION ${s}`);
  await expect(paper.locator(".katex").first()).toBeVisible();
  await expect(page.getByTestId("verification")).toContainText("Objective 4/4 · Rubric 2/3 · Manual review 1");
  await page.getByTestId("verification").getByRole("button", { name: /Details/ }).click();
  await expect(page.getByText("q6", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // per-question menu talks back to the agent
  await paper.getByRole("button", { name: "Q5 options" }).click();
  await page.getByRole("menuitem", { name: "Change marks" }).click();
  await expect(input(page)).toHaveValue("Q5 (q5) ke marks change karo: ");
  await input(page).fill("");

  const appr = page.getByTestId("approval");
  await expect(appr).toContainText("wapas nahi hoga");
  await expect(appr.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
  await appr.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(appr.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect.poll(() => m.approvals).toEqual([{ session_id: "sess-1", approval_id: "appr-1" }]);
  const dl = page.waitForEvent("download");
  await appr.getByRole("button", { name: "Download PDF" }).click();
  expect((await dl).suggestedFilename()).toBe("a4ai-test.pdf");
});

test("sheet: launcher opens the same chat, Esc closes and focus returns to the launcher", async ({ page }) => {
  const m = new Mocks();
  m.queue.push(ATTENDANCE.map((e) => ({ ...e })));
  await m.install(page);
  await page.goto("/dashboard");
  const launcher = page.getByTestId("ask-a4ai");
  await launcher.click();
  const sheet = page.getByTestId("agent-chat-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Message a4ai Agent")).toBeFocused();
  await sheet.getByLabel("Message a4ai Agent").fill("Meri class ki attendance");
  await sheet.getByLabel("Message a4ai Agent").press("Enter");
  await expect(sheet.getByTestId("stat-grid")).toContainText("83.8");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(page.getByTestId("agent-chat-sheet").getByTestId("stat-grid")).toContainText("83.8"); // history kept
});

// ---- screenshots (AGENT_SHOTS=1) -----------------------------------------------------------------------
const SHOTS = path.resolve(process.cwd(), "docs/screenshots");
async function setTheme(page: Page, dark: boolean) {
  await page.evaluate((d) => { document.documentElement.classList.toggle("dark", d); document.documentElement.style.colorScheme = d ? "dark" : "light"; }, dark);
}

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`screenshots ${width} ${theme}`, async ({ page }) => {
      test.skip(!process.env.AGENT_SHOTS, "set AGENT_SHOTS=1 to capture docs/screenshots");
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const m = new Mocks();
      m.queue.push(ATTENDANCE.map((e) => ({ ...e })), ATTENDANCE_MORE.map((e) => ({ ...e })), BLUEPRINT.map((e) => ({ ...e })), PAPER.map((e) => ({ ...e })));
      await openAgent(page, m);
      await setTheme(page, theme === "dark");
      const shot = (name: string) => page.screenshot({ path: `${SHOTS}/agent-${width}-${theme}-${name}.png` });
      await page.waitForTimeout(300);
      await shot("empty");

      await chatPage(page).getByRole("button", { name: /Meri class ki attendance/ }).click();
      await expect(page.getByTestId("stat-grid")).toContainText("83.8");
      await ask(page, "Haan, list dikhao");
      await expect(page.getByTestId("data-table")).toBeVisible();
      await page.getByTestId("stat-grid").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot("attendance");
      await page.getByTestId("agent-chart").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot("chart-table");

      await page.getByTestId("agent-workspace").getByRole("button", { name: "New chat" }).locator("visible=true").first().click();
      await ask(page, "Class 10 trigonometry test banao, 40 marks");
      await expect(page.getByTestId("blueprint")).toBeVisible();
      await page.getByTestId("blueprint").scrollIntoViewIfNeeded();
      await shot("blueprint");
      await page.getByTestId("blueprint").getByRole("button", { name: /Looks good/ }).click();
      await expect(page.getByTestId("paper-preview")).toBeVisible();
      await page.getByTestId("paper-preview").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot("paper");
      await page.getByTestId("approval").scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot("approval");

      // the sheet, from the dashboard home
      await page.goto("/dashboard");
      await expect(page.getByTestId("ask-a4ai")).toBeVisible({ timeout: 30_000 });
      await setTheme(page, theme === "dark");
      await page.getByTestId("ask-a4ai").click();
      await expect(page.getByTestId("agent-chat-sheet")).toBeVisible();
      await page.waitForTimeout(400);
      await shot("sheet");

      // no horizontal page overflow at any width
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
