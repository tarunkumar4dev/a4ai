// Screenshots of /__agent-preview states (dev server must be running). Usage:
//   node scripts/agent-preview-shots.mjs <baseUrl> <outDir> <name:state:lang:WxH[:wide][:action]> ...
// action: "type=<text>" types into the composer; "wait=<ms>" waits longer; "lang-menu" opens the language menu.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [base, out, ...specs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
for (const spec of specs) {
  const [name, state, lang, size, ...rest] = spec.split(":");
  const [w, h] = size.split("x").map(Number);
  const wide = rest.includes("wide");
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 640, isMobile: w < 640, colorScheme: rest.includes("dark") ? "dark" : "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: console ${m.text().slice(0, 200)}`); });
  await page.goto(`${base}/__agent-preview?state=${state}&lang=${lang}&bare=1${wide ? "&w=wide" : ""}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector('[data-testid^="agent-chat-"]', { timeout: 240000 });
  let waitMs = 1500;
  for (const a of rest) {
    if (a.startsWith("wait=")) waitMs = Number(a.slice(5));
  }
  await page.waitForTimeout(waitMs);
  for (const a of rest) {
    if (a.startsWith("type=")) { await page.locator("textarea").first().fill(""); await page.locator("textarea").first().pressSequentially(decodeURIComponent(a.slice(5)), { delay: 30 }); await page.waitForTimeout(600); }
    if (a === "lang-menu") { await page.getByTestId("agent-lang").click(); await page.waitForTimeout(300); }
    if (a === "scroll-up") { await page.getByTestId("agent-scroller").evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); }); await page.waitForTimeout(400); }
    if (a === "scope-help") { await page.getByTestId("scope-help").click(); await page.waitForTimeout(300); }
    if (a === "more") { await page.getByTestId("agent-more").click(); await page.waitForTimeout(300); }
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
