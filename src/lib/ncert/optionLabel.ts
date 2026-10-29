/**
 * NCERT MCQ options: decode + clean labels — the same rules as RAG-BACKEND
 * test-generator-backend/app/services/ncert_options.py. Both must pass ./ncert_option_label_fixtures.json
 * (a copy of the backend's scripts/fixtures file):  node scripts/check_ncert_option_label.ts
 *
 * normalizeOptionLabel: "(A) (A) text" / "(A)(a) text" / "(1) (1) text" → one leading label (OCR doubled it).
 * stripOptionLabels:    "(A) 60°" → "60°" when the label is that option's own letter — the card and the PDF
 *                       print A/B/C/D themselves ("A (A) 60°" otherwise).
 */

// "(A)" / "(a)" / "(1)" / "(अ)" — ASCII digits only, so Python and JavaScript agree
const BRACKET_LABEL = String.raw`\(\s*([A-Za-z]|[0-9]{1,2}|[ऀ-ॿ]{1,3})\s*\)`;
const FIRST_LABEL = new RegExp(String.raw`^\s*` + BRACKET_LABEL);
const NEXT_LABEL = new RegExp(String.raw`\s*` + BRACKET_LABEL, "y");
const MAX_REPEATS = 3;
// own-letter label: "(A)", "A.", "A)" (any case)
const OWN_LABEL = /^\s*(?:\(\s*([A-Fa-f])\s*\)|([A-Fa-f])\s*[.)])\s*/;

/** options is jsonb, but most rows hold a JSON *string* of the list. Accept both. */
export function decodeOptions(raw: unknown): string[] {
  let value = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.map((o) => String(o)) : [];
}

/** Collapse a repeated leading label into the first one; anything else is returned unchanged. */
export function normalizeOptionLabel(opt: string): string {
  const first = FIRST_LABEL.exec(opt);
  if (!first) return opt;
  const label = first[1].toLowerCase();
  const firstEnd = first[0].length;
  let pos = firstEnd;
  for (let i = 0; i < MAX_REPEATS; i++) {
    NEXT_LABEL.lastIndex = pos;
    const next = NEXT_LABEL.exec(opt);
    if (!next || next[1].toLowerCase() !== label) break;
    pos = NEXT_LABEL.lastIndex;
  }
  if (pos === firstEnd) return opt;
  const head = opt.slice(0, firstEnd).trim();
  const rest = opt.slice(pos).trimStart();
  return rest ? `${head} ${rest}` : head;
}

export function stripOptionLabels(options: string[]): string[] {
  return options.map((raw, idx) => {
    const opt = normalizeOptionLabel(raw);
    const m = OWN_LABEL.exec(opt);
    const letter = m ? (m[1] || m[2]).toUpperCase() : null;
    const rest = m ? opt.slice(m[0].length) : opt;
    return letter === String.fromCharCode(65 + idx) && rest.trim() ? rest : opt;
  });
}

/** Options as the builder shows them: decoded, repeats collapsed, own letter dropped. */
export function parseOptions(raw: unknown): string[] {
  return stripOptionLabels(decodeOptions(raw));
}
