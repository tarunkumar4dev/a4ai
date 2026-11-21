// axe accessibility check of /__agent-preview states (dev server running). Reports serious / critical violations
// inside the agent panel. Usage: node scripts/agent-preview-axe.mjs <baseUrl> <state:lang:WxH> ...
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const [base, ...specs] = process.argv.slice(2);
const browser = await chromium.launch();
let bad = 0;
for (const spec of specs) {
  const [state, lang, size] = spec.split(":");
  const [w, h] = size.split("x").map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${base}/__agent-preview?state=${state}&lang=${lang}&bare=1`, { timeout: 240000 });
  await page.waitForSelector('[data-agent-root]', { timeout: 240000 });
  await page.waitForTimeout(state === "nobatch" || state === "empty" ? 2500 : 6000);
  const r = await new AxeBuilder({ page }).include('[data-testid="preview-frame"]').analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  bad += serious.length;
  console.log(`${spec}: ${serious.length} serious/critical, ${r.violations.length - serious.length} minor`);
  for (const v of serious) console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(" ")} :: ${v.nodes[0]?.failureSummary?.split("\n").slice(0, 2).join(" ")}`);
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
