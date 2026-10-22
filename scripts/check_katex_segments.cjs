/**
 * scripts/check_katex_segments.cjs — parses NCERT question text with the app's KaTeX (read-only audit helper).
 *
 *   NODE_PATH=<repo>/node_modules node scripts/check_katex_segments.cjs < items.json > results.json
 *
 * stdin:  [{ id, mode, text }]
 *   mode "builder" — split exactly like TestBuilderPage renderMathText and parse every $…$ / $$…$$ part
 *                    (what a teacher sees today)
 *   mode "full"    — parse the whole text as math (raw LaTeX without delimiters: would it render if delimited?)
 * stdout: [{ id, mode, mathParts, ok, error }]
 */
const katex = require("katex");

const SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g; // same regex as renderMathText in TestBuilderPage.tsx

function parse(math, displayMode) {
  try {
    katex.renderToString(math, { displayMode, throwOnError: true, strict: "ignore" });
    return null;
  } catch (e) {
    return String(e.message || e).slice(0, 200);
  }
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const out = JSON.parse(input).map(({ id, mode, text }) => {
    if (mode === "full") {
      const error = parse(text, false);
      return { id, mode, mathParts: 1, ok: !error, error };
    }
    let mathParts = 0;
    let error = null;
    for (const part of text.split(SPLIT)) {
      const block = part.startsWith("$$") && part.endsWith("$$") && part.length > 4;
      const inline = !block && part.startsWith("$") && part.endsWith("$") && part.length > 2;
      if (!block && !inline) continue;
      mathParts += 1;
      error = error || parse(block ? part.slice(2, -2) : part.slice(1, -1), block);
    }
    return { id, mode, mathParts, ok: !error, error };
  });
  process.stdout.write(JSON.stringify(out));
});
