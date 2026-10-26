import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");

// Simple static file server for dist directory
function createServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  };

  return http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end("Server Error");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content, "utf-8");
      }
    });
  });
}

const VIEWPORTS = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];

async function run() {
  const server = createServer();
  const PORT = 8199;
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running at http://localhost:${PORT}`);

  const outputDir = path.resolve(__dirname, "../test-results/hero-viewports");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

    // Measure metrics in page
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const hero = document.querySelector("section");
      const preview = document.querySelector('[data-testid="hero-preview"]') || document.querySelector('div[aria-hidden="true"]:not(.pointer-events-none)');
      const leftCol = hero ? hero.querySelector("h1")?.closest(".min-w-0") : null;

      const heroRect = hero ? hero.getBoundingClientRect() : null;
      const previewRect = preview ? preview.getBoundingClientRect() : null;
      const leftColRect = leftCol ? leftCol.getBoundingClientRect() : null;

      const hasHorizontalOverflow = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;

      return {
        hasHorizontalOverflow,
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        heroHeight: heroRect ? Math.round(heroRect.height) : 0,
        previewWidth: previewRect ? Math.round(previewRect.width) : 0,
        previewHeight: previewRect ? Math.round(previewRect.height) : 0,
        previewTop: previewRect ? Math.round(previewRect.top) : 0,
        leftColWidth: leftColRect ? Math.round(leftColRect.width) : 0,
        leftColTop: leftColRect ? Math.round(leftColRect.top) : 0,
      };
    });

    // Save screenshot
    const screenshotPath = path.join(outputDir, `hero-${width}px.png`);
    await page.screenshot({ path: screenshotPath, clip: { x: 0, y: 0, width, height: Math.min(metrics.heroHeight + 100, 1200) } });

    results.push({
      width,
      ...metrics,
      screenshot: `hero-${width}px.png`
    });

    await context.close();
  }

  await browser.close();
  server.close();

  console.table(results.map(r => ({
    Viewport: `${r.width}px`,
    Overflow: r.hasHorizontalOverflow ? "FAIL" : "PASS",
    "Preview Width": `${r.previewWidth}px`,
    "Preview Height": `${r.previewHeight}px`,
    "Hero Height": `${r.heroHeight}px`,
    "Preview Top": `${r.previewTop}px`
  })));

  console.log("Screenshots saved to:", outputDir);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

