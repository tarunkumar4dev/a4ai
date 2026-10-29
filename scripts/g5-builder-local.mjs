// G5 browser checks for the NCERT test builder, against LOCAL servers (no production URL, no writes).
// Usage: node scripts/g5-builder-local.mjs <frontendUrl> <outDir>
//   e.g. node scripts/g5-builder-local.mjs http://localhost:5174 <scratchpad>/g5
// Checks: (1) Class 10 Maths count in the UI  (2) "Areas Related to Circles" Example 1  (3) drag preview not truncated
//         (4) no doubled option label "(A) (A)" in any chapter  (5) the paper survives a reload (localStorage + /by-ids)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const [base = "http://localhost:5174", outDir = "g5-out"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) });
const CHAPTERS = ["Areas Related to Circles", "Arithmetic Progressions", "Circles", "Coordinate Geometry", "Introduction to Trigonometry",
  "Pair of Linear Equations in Two Variables", "Polynomials", "Probability", "Quadratic Equations", "Real Numbers",
  "Some Applications of Trigonometry", "Statistics", "Surface Areas and Volumes", "Triangles"];
const SEL_KEY = "ncert_builder_selection_v2";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const report = {};
const errors = [], apiCalls = [];
const step = async (name, fn) => { try { await fn(); } catch (e) { report[name] = { ...(report[name] || {}), status: "ERROR", error: String(e.message).split(String.fromCharCode(10))[0].slice(0, 200) }; } };
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
page.on("response", (r) => { const u = r.url(); if (/test-generator\/ncert/.test(u)) apiCalls.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), status: r.status(), cc: r.headers()["cache-control"] || null, host: new URL(u).host }); });

async function settle(ms = 900) { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(ms); }
const chip = (name) => page.locator("button", { has: page.locator("span.truncate", { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) }).first();
async function loadAll() { // press "Load More Questions" until it is gone
  for (let i = 0; i < 40; i++) {
    const more = page.getByRole("button", { name: "Load More Questions" });
    if (!(await more.count())) return;
    await more.first().click(); await settle(500);
  }
}
const CARD_SEL = "div.relative.p-4.rounded-xl.border";
const LABEL_SEL = "span.inline-flex.min-w-0.items-baseline"; // QuestionLabel only (not the Easy / Fig. / marks badges)
const addBtn = () => page.getByRole("button", { name: "Add", exact: true });

await page.goto(`${base}/dashboard/test-generator?tab=builder`, { waitUntil: "load", timeout: 180000 });
await page.waitForSelector("button:has-text('NCERT Test Builder')", { timeout: 60000 });
await page.locator("select").filter({ has: page.locator("option", { hasText: "Mathematics" }) }).first().selectOption({ label: "Mathematics" });
await page.getByRole("button", { name: "10", exact: true }).click();
await settle(1500);
await chip("Circles").waitFor({ timeout: 30000 });
await shot(page, "01-class10-maths.png");

// ── (1) count in the UI ──
const chipCounts = await page.evaluate((names) => {
  const out = {};
  for (const b of document.querySelectorAll("button")) {
    const spans = b.querySelectorAll(":scope > span");
    if (spans.length === 2 && names.includes(spans[0].innerText.trim())) out[spans[0].innerText.trim()] = Number(spans[1].innerText.replace(/[^\d]/g, ""));
  }
  return out;
}, CHAPTERS);
const sum = Object.values(chipCounts).reduce((a, b) => a + b, 0);
const bodyText = await page.evaluate(() => document.body.innerText);
report.check1_count = { chaptersShown: Object.keys(chipCounts).length, sumOfChapterChips: sum, chipCounts, bodyMentions1657: /1[, ]?657/.test(bodyText), status: sum === 1657 ? "PASS" : "FAIL" };

// ── (2) Areas Related to Circles: Example 1 ──
await chip("Areas Related to Circles").click(); await settle(1200); await loadAll();
const arc = await page.evaluate(() => {
  const cardEls = [...document.querySelectorAll("div.relative.p-4.rounded-xl.border")].filter((c) => [...c.querySelectorAll("button")].some((b) => /^(Add|Added)$/.test(b.innerText.trim())));
  const labels = [...document.querySelectorAll("div.relative.p-4.rounded-xl.border span.inline-flex.min-w-0.items-baseline")].map((s) => s.innerText.replace(/\s+/g, " ").trim());
  return { cardsShown: cardEls.length, example1: labels.filter((l) => /^Areas Related to Circles · Example 1$/.test(l)).length, labelsSample: labels.slice(0, 4), allLabels: labels };
});
report.check2_example1 = { chapter: "Areas Related to Circles", cardsShown: arc.cardsShown, example1Count: arc.example1, labelsSample: arc.labelsSample, status: arc.example1 === 1 ? "PASS (1)" : `CHECK (${arc.example1})` };
await shot(page, "02-areas-related-to-circles.png");
// the same label in "Circles" (the documented 62 -> 2 case)
await chip("Circles").click(); await settle(1200); await loadAll();
report.check2_example1.circles = await page.evaluate(() => [...document.querySelectorAll("div.relative.p-4.rounded-xl.border span.inline-flex.min-w-0.items-baseline")].map((s) => s.innerText.replace(/\s+/g, " ").trim()).filter((l) => /^Circles · Example 1$/.test(l)).length);

// ── (4) doubled option labels, every chapter, everything the UI renders ──
const BAD = "\\(\\s*[A-Da-d]\\s*\\)\\s*[\\(\\[]?\\s*[A-Da-d]\\s*[\\)\\]]|\\b[A-D]\\)\\s*\\(\\s*[A-D]\\s*\\)";
let cardsChecked = 0, optionRows = 0, mcqCards = 0, renderedRows = 0, badgeLabel = 0; const hits = []; let firstMcqText = null;
for (const name of CHAPTERS) {
  await chip(name).click(); await settle(900); await loadAll();
  const r = await page.evaluate((badSrc) => {
    const bad = new RegExp(badSrc);
    const out = { cards: 0, opts: 0, mcq: 0, hits: [], first: null, rows: 0, badgeThenLabel: 0 };
    for (const c of document.querySelectorAll("div.relative.p-4.rounded-xl.border")) {
      if (![...c.querySelectorAll("button")].some((b) => /^(Add|Added)$/.test(b.innerText.trim()))) continue;
      out.cards++;
      const t = c.innerText;
      const rowLines = (t.match(/^[A-D]$/gm) || []).length; // option rows: a lone A-D badge on its own line
      out.rows += rowLines;
      const bl = (t.match(/^[A-D]\n\s*[\(\[]?[A-Da-d][\)\]]/gm) || []).length;
      out.badgeThenLabel += bl;
      if (bl) out.hits.push({ sample: "badge then label: " + t.replace(/\n+/g, " | ").slice(0, 140) });
      const labels = t.match(/\(\s*[A-Da-d]\s*\)|(?:^|\n)\s*[A-D]\s*[.)]/g) || [];
      if (labels.length >= 2) { out.mcq++; out.opts += labels.length; if (!out.first) out.first = t.replace(/\n+/g, " | ").slice(0, 260); }
      if (bad.test(t.replace(/\n+/g, " "))) out.hits.push({ chapter: document.title, sample: t.replace(/\n+/g, " | ").slice(0, 140) });
    }
    return out;
  }, BAD);
  renderedRows += r.rows; badgeLabel += r.badgeThenLabel; cardsChecked += r.cards; optionRows += r.opts; mcqCards += r.mcq; if (!firstMcqText) firstMcqText = r.first;
  r.hits.forEach((h) => hits.push({ ...h, chapter: name }));
}
report.check4_doubled_label = { chaptersScanned: CHAPTERS.length, cardsChecked, cardsWithOptions: mcqCards, optionLabelsSeen: optionRows, renderedOptionRows: renderedRows, badgeThenLabelHits: badgeLabel, hits: hits.length, hitSamples: hits.slice(0, 4), sampleMcqCardText: firstMcqText, status: hits.length === 0 && renderedRows > 0 ? "PASS" : (renderedRows === 0 ? "INCONCLUSIVE (no options seen)" : "FAIL") };

// ── (3) drag preview ──
await step("check3_dragOverlay", async () => {
await chip("Introduction to Trigonometry").click(); await settle(1000); await loadAll();
// a card the library truncates (text cut at 300 chars ends with "…"), with options if possible
const idx = await page.evaluate(() => {
  const list = [...document.querySelectorAll("div.relative.p-4.rounded-xl.border")].filter((c) => [...c.querySelectorAll("button")].some((b) => /^(Add|Added)$/.test(b.innerText.trim())));
  const canAdd = (c) => [...c.querySelectorAll("button")].some((b) => b.innerText.trim() === "Add");
  const cut = list.map((c, i) => ({ i, t: c.innerText, cut: /…/.test(c.innerText) && canAdd(c) })).filter((x) => x.cut);
  const withOpts = cut.find((x) => /\(\s*[A-D]\s*\)/.test(x.t)) || cut[0];
  if (!withOpts) return null;
  list[withOpts.i].setAttribute("data-g5", "target");
  return { i: withOpts.i, cardLen: withOpts.t.length };
});
report.check3_dragOverlay = { truncatedCardFound: !!idx };
if (idx) {
  const card = page.locator('[data-g5="target"]');
  await card.scrollIntoViewIfNeeded();
  const cardText = await card.innerText();
  // content block only (the header badges + Add button are not part of the question text)
  const cardContent = await card.evaluate((c) => { const col = c.querySelector("div.flex-1.min-w-0"); const kids = col ? [...col.children] : []; return kids.slice(1).map((k) => k.innerText).join(" "); });
  const grip = card.locator('[title="Drag to test paper"]');
  const gb = await grip.boundingBox();
  const zone = await page.locator("h2", { hasText: "Your Test Paper" }).boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + 30, gb.y + 20, { steps: 5 });
  await page.mouse.move(zone.x + 200, zone.y + 250, { steps: 25 });
  await page.waitForTimeout(500);
  const ov = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div.border-gray-900.shadow-2xl")].pop();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: el.innerText, textLen: el.innerText.length, scrollH: el.scrollHeight, clientH: el.clientHeight, width: Math.round(r.width), height: Math.round(r.height), vh: innerHeight, endsWithEllipsis: /…\s*$/.test(el.innerText.trim()) };
  });
  await shot(page, "03-drag-overlay.png");
  await page.mouse.up(); await page.waitForTimeout(700);
  const paperCount = await page.locator("span", { hasText: /^\d+ Questions$/ }).first().innerText().catch(() => null);
  report.check3_dragOverlay = {
    ...report.check3_dragOverlay,
    overlayShown: !!ov,
    cardContentLen: cardContent.length, cardContentTail: cardContent.replace(/\s+/g, " ").slice(-90), cardEndsWithEllipsis: /…/.test(cardContent),
    overlayTextLen: ov?.textLen, overlayTail: ov?.text.replace(/\s+/g, " ").slice(-90), overlayHasEllipsis: ov ? /…/.test(ov.text) : null,
    overlayHeightPx: ov?.height, overlayClippedByMaxHeight: ov ? ov.scrollH > ov.clientH + 1 : null,
    overlayTextSample: ov?.text.replace(/\n+/g, " | ").slice(0, 220),
    paperAfterDrop: paperCount,
  };
  const ok = ov && ov.textLen > cardContent.length && /…/.test(cardContent) && !/…/.test(ov.text) && !(ov.scrollH > ov.clientH + 1);
  report.check3_dragOverlay.status = ok ? "PASS" : "FAIL";
}
});

// ── (5) the paper survives a reload ──
await step("check5_localStorage", async () => {
const nAdd = Math.min(3, await addBtn().count());
for (let i = 0; i < nAdd; i++) { await addBtn().first().click(); await page.waitForTimeout(300); }
await settle(500);
const before = await page.evaluate((k) => ({ raw: localStorage.getItem(k) }), SEL_KEY);
const savedBefore = JSON.parse(before.raw || "[]");
const paperLabels = () => page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((e) => /Your Test Paper/.test(e.innerText));
  let col = h; while (col && col.parentElement && col.querySelectorAll("span.inline-flex.min-w-0.items-baseline").length === 0 && col !== document.body) col = col.parentElement;
  return [...(col || document).querySelectorAll("span.inline-flex.min-w-0.items-baseline")].map((s) => s.innerText.replace(/\s+/g, " ").trim());
});
const labelsBefore = await paperLabels();
const countBefore = await page.locator("span", { hasText: /^\d+ Questions$/ }).first().innerText();
// a stale id the server will not return must be dropped without breaking the page
await page.evaluate(([k, raw]) => { const a = JSON.parse(raw); a.push({ ...(a[0] || {}), id: 999999999 }); localStorage.setItem(k, JSON.stringify(a)); }, [SEL_KEY, before.raw]);
apiCalls.length = 0;
await page.reload({ waitUntil: "load" });
await page.waitForSelector("button:has-text('NCERT Test Builder')", { timeout: 60000 });
await settle(2500);
const countAfter = await page.locator("span", { hasText: /^\d+ Questions$/ }).first().innerText().catch(() => null);
const savedAfter = JSON.parse(await page.evaluate((k) => localStorage.getItem(k) || "[]", SEL_KEY));
const byIds = apiCalls.filter((c) => /by-ids/.test(c.url));
await shot(page, "05-after-reload.png");
report.check5_localStorage = {
  key: SEL_KEY, addedBeforeReload: nAdd, idsSavedBefore: savedBefore.map((s) => s.id), paperCountBefore: countBefore, paperCountAfterReload: countAfter,
  staleIdInjected: 999999999, staleIdPresentAfter: savedAfter.some((s) => s.id === 999999999),
  byIdsCalls: byIds.map((c) => ({ status: c.status, cacheControl: c.cc, url: c.url.slice(0, 90) })),
  restoredLabelsMatch: null, status: null,
};
const labelsAfter = await paperLabels();
report.check5_localStorage.paperLabelsBefore = labelsBefore;
report.check5_localStorage.paperLabelsAfter = labelsAfter;
report.check5_localStorage.restoredLabelsMatch = labelsBefore.length > 0 && JSON.stringify(labelsBefore) === JSON.stringify(labelsAfter);
report.check5_localStorage.idsKeptAfter = savedAfter.map((s) => s.id);
report.check5_localStorage.status = (nAdd >= 1 && countAfter === countBefore && report.check5_localStorage.restoredLabelsMatch && !report.check5_localStorage.staleIdPresentAfter && byIds.length > 0 && byIds.every((c) => c.status === 200)) ? "PASS" : "FAIL";
});

report.apiHosts = [...new Set(apiCalls.map((c) => c.host))];
report.cacheControlSeenInBrowser = [...new Set(apiCalls.map((c) => c.cc))];
report.pageErrors = errors;
await browser.close();
fs.writeFileSync(path.join(outDir, "g5-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
