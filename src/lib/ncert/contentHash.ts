/**
 * normalize() / contentHash() for NCERT question text — the same rules as RAG-BACKEND
 * test-generator-backend/app/services/ncert_text_hash.py (HASH_VERSION "v2"). Both must pass
 * ./ncert_normalize_fixtures.json:  node scripts/check_ncert_normalize.ts
 *
 * NFC → lowercase → strip $ \( \) \[ \] → collapse whitespace → strip leading "Example 1 :" / "Q1." labels and
 * question numbering ("1)", "(i)") in any order → strip trailing punctuation → trim. Hash = SHA-256 hex.
 */
export const HASH_VERSION = "v2";

const MATH_DELIMS = /\$|\\\(|\\\)|\\\[|\\\]/g;
const WHITESPACE = /\s+/g;
const LEADING_LABEL = /^\s*(example|q)\s*\d+\s*[.:)]\s*/i;
// "q1." / "q 12." / "1)" / "1." (not "1.5") / "(i)" / "(a)" / "(3)"
const LEADING_NUMBERING = /^(?:q\s*\.?\s*\d+[a-z]?\s*[.):]?|\d+\s*[.)](?=\s|$)|\(\s*(?:[ivxlcdm]+|[a-z]|\d+)\s*\))\s*/;
const TRAILING_PUNCT = /[\s.,;:!?…।]+$/;

export function normalizeQuestionText(text: string | null | undefined): string {
  let t = (text ?? "").normalize("NFC").toLowerCase();
  t = t.replace(MATH_DELIMS, "").replace(WHITESPACE, " ").trim();
  for (;;) {
    const stripped = t.replace(LEADING_LABEL, "").replace(LEADING_NUMBERING, "");
    if (stripped === t) break;
    t = stripped;
  }
  return t.replace(TRAILING_PUNCT, "").trim();
}

export async function contentHash(text: string | null | undefined): Promise<string> {
  const normalized = normalizeQuestionText(text);
  const subtle = globalThis.crypto?.subtle;
  // crypto.subtle needs a secure context; without it the normalized text itself is a good-enough dedupe key
  if (!subtle) return `n:${normalized}`;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
