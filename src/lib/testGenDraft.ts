// src/lib/testGenDraft.ts — the AI Test Generator's local draft (one per signed-in user, this browser only).
//   • what:   non-sensitive form settings only (title, class, subject, rows…). Never the logo, the paper date or
//             any student data. It is a local convenience, not a saved paper.
//   • when:   read once for the form's first values, written on every change.
//   • safety: each field is checked on read (a bad or old field is dropped, the default stays); drafts older than
//             30 days are ignored; every user's draft is removed on sign-out (AuthProvider), so a shared device
//             doesn't keep them.
// Pure parts are unit-tested in testGenDraft.test.ts.
import { z } from "zod";
import { simpleRowSchema } from "@/lib/schema";

const PREFIX = "a4ai.testgen.draft.";
const VERSION = 1;
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const draftKey = (userId: string) => `${PREFIX}v${VERSION}.${userId}`;

// A row may be half filled in a draft (no chapter yet), so the topic can be empty here.
const draftRow = simpleRowSchema.extend({ topic: z.string().max(300) });

const FIELDS = {
  examTitle: z.string().max(200),
  board: z.string().min(1).max(50),
  classGrade: z.string().min(1).max(50),
  subject: z.string().min(1).max(80),
  mode: z.string().min(1).max(30),
  simpleData: z.array(draftRow).min(1).max(30),
  useNCERT: z.boolean(),
  ncertChapters: z.array(z.string().max(300)).max(100),
  enableWatermark: z.boolean(),
  shuffleQuestions: z.boolean(),
} as const;

export type DraftValues = Partial<{ -readonly [K in keyof typeof FIELDS]: z.infer<(typeof FIELDS)[K]> }>;

/** Keeps only the draft fields, and only the ones that are valid. */
export function pickDraft(values: Record<string, unknown>): DraftValues {
  const out: Record<string, unknown> = {};
  for (const [k, schema] of Object.entries(FIELDS)) {
    if (!(k in values)) continue;
    const parsed = schema.safeParse(values[k]);
    if (parsed.success) out[k] = parsed.data;
  }
  return out as DraftValues;
}

/** Parses a stored draft; null when missing, unreadable, from another version or too old. */
export function parseDraft(raw: string | null, now = Date.now()): DraftValues | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved?.v !== VERSION || typeof saved.savedAt !== "number" || !saved.data || typeof saved.data !== "object") return null;
    if (now - saved.savedAt > DRAFT_MAX_AGE_MS || saved.savedAt > now + 60_000) return null;
    return pickDraft(saved.data);
  } catch {
    return null;
  }
}

export function loadDraft(userId: string): DraftValues | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(userId)));
  } catch {
    return null; // storage blocked (private mode)
  }
}

export function saveDraft(userId: string, values: Record<string, unknown>): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify({ v: VERSION, savedAt: Date.now(), data: pickDraft(values) }));
  } catch {
    /* storage full or blocked: the form keeps working without a draft */
  }
}

/** Removes every user's generator draft from this browser (called on sign-out). */
export function clearAllDrafts(storage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    /* storage blocked: nothing was saved either */
  }
}
