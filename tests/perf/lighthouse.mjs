// Lighthouse (mobile) on /s/:token against a production build — `node tests/perf/lighthouse.mjs`.
// Needs: a build in dist-perf made with VITE_SUPABASE_URL=http://localhost:54399 (see the run steps in
// docs/upload-flow-api.md §7), and CHROME_PATH (e.g. Playwright's Chromium). Prints score, LCP, TBT, CLS.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const run = (cmd, args, opts = {}) => spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
// shell: true starts a wrapper process; on Windows kill() leaves the server running — kill the whole tree
const killTree = p => (process.platform === "win32" ? spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"]) : p.kill());

const mock = run("node", ["tests/perf/mock-supabase-server.mjs"]);
const preview = run("npx", ["vite", "preview", "--outDir", "dist-perf", "--port", "4174", "--strictPort", "--host", "localhost"]);
await sleep(6000);

const out = "test-results/lighthouse-s-token.json";
const lh = run("npx", ["-y", "lighthouse@12.2.1", "http://localhost:4174/s/tok-1", "--form-factor=mobile",
  "--only-categories=performance", "--output=json", `--output-path=${out}`, "--quiet",
  "--chrome-flags=\"--headless=new --no-sandbox\""]);
const code = await new Promise(r => lh.on("exit", r));
killTree(mock); killTree(preview);
await sleep(500);
if (code !== 0) process.exit(code);

const r = JSON.parse(readFileSync(out, "utf8"));
const a = r.audits;
console.log(JSON.stringify({
  performance: Math.round(r.categories.performance.score * 100),
  LCP: a["largest-contentful-paint"].displayValue, FCP: a["first-contentful-paint"].displayValue,
  TBT: a["total-blocking-time"].displayValue, CLS: a["cumulative-layout-shift"].displayValue,
  SpeedIndex: a["speed-index"].displayValue,
  scriptKB: Math.round((a["resource-summary"]?.details?.items || []).find(i => i.resourceType === "script")?.transferSize / 1024),
}, null, 2));
process.exit(0);
