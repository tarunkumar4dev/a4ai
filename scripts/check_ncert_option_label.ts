/**
 * Checks src/lib/ncert/optionLabel.ts against the fixtures shared with RAG-BACKEND (no test runner needed;
 * Node 24 runs TypeScript directly):  node scripts/check_ncert_option_label.ts
 */
import { readFileSync } from "node:fs";
import { normalizeOptionLabel, stripOptionLabels } from "../src/lib/ncert/optionLabel.ts";

type Case<T> = { input: T; expected: T; note: string };
const fixtures: { normalize_option_label: Case<string>[]; strip_option_labels: Case<string[]>[] } = JSON.parse(
  readFileSync(new URL("../src/lib/ncert/ncert_option_label_fixtures.json", import.meta.url), "utf-8"),
);

let failures = 0;
let total = 0;
function check<T>(name: string, cases: Case<T>[], fn: (input: T) => T) {
  for (const c of cases) {
    total += 1;
    const got = fn(c.input);
    const ok = JSON.stringify(got) === JSON.stringify(c.expected);
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${c.note}`);
    if (!ok) console.log(`      expected ${JSON.stringify(c.expected)}\n      got      ${JSON.stringify(got)}`);
  }
}
check("normalizeOptionLabel", fixtures.normalize_option_label, normalizeOptionLabel);
check("stripOptionLabels", fixtures.strip_option_labels, stripOptionLabels);
console.log(`\n${total - failures}/${total} passed`);
process.exit(failures ? 1 : 0);
