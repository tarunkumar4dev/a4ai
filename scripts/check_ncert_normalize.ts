/**
 * Checks src/lib/ncert/contentHash.ts against the fixtures shared with RAG-BACKEND (no test runner needed;
 * Node 24 runs TypeScript directly):  node scripts/check_ncert_normalize.ts
 */
import { readFileSync } from "node:fs";
import { contentHash, normalizeQuestionText } from "../src/lib/ncert/contentHash.ts";

type Fixture = { input: string; normalized: string; sha256: string; note: string };

const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL("../src/lib/ncert/ncert_normalize_fixtures.json", import.meta.url), "utf-8"),
);

let failures = 0;
for (const [i, f] of fixtures.entries()) {
  const got = normalizeQuestionText(f.input);
  const hash = await contentHash(f.input);
  const ok = got === f.normalized && hash === f.sha256;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${String(i + 1).padStart(2)}  ${f.note}`);
  if (!ok) console.log(`      expected ${JSON.stringify(f.normalized)}\n      got      ${JSON.stringify(got)}`);
}
console.log(`\n${fixtures.length - failures}/${fixtures.length} passed`);
process.exit(failures ? 1 : 0);
