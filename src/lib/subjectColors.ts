// src/lib/subjectColors.ts
// One fixed colour per subject for batch chips / cards in the institute dashboard, so "Accounts" looks the same
// everywhere (student rows, batch cards, batch pickers, teacher chips). Batches carry the subject in
// batches.subject or only in the name ("ACC", "BST", "ECONOMICS BATCH 11th", "Accounts Rahul Sir" on live, 21 Nov),
// so both are read. Unknown subjects get a stable colour from the same palette (hash of the subject text).
import type { CSSProperties } from "react";

export interface SubjectColor {
  key: string;     // "accounts", "maths", … or "other:<text>" / "general"
  label: string;   // human name of the matched subject ("" for unknown)
  short: string;   // 2–4 letter code for tiles ("ACC", "ECO"); unknown → first letters of the text
  fg: string;      // text / accent (light theme)
  bg: string;      // chip background (light theme)
  bd: string;      // chip border (light theme)
  fgDark: string;  // text on the dark dashboard
  bgDark: string;
  bdDark: string;
}

type Tone = Omit<SubjectColor, "key" | "label" | "short">;
// Tailwind 700 / 50 / 200 for light, 300 + translucent 700 for dark. Text ≥ 4.5:1 on its chip in both themes.
const tone = (fg: string, bg: string, bd: string, fgDark: string, rgb: string): Tone =>
  ({ fg, bg, bd, fgDark, bgDark: `rgba(${rgb},0.22)`, bdDark: `rgba(${rgb},0.45)` });

const T = {
  red: tone("#B91C1C", "#FEF2F2", "#FECACA", "#FCA5A5", "185,28,28"),
  blue: tone("#1D4ED8", "#EFF6FF", "#BFDBFE", "#93C5FD", "29,78,216"),
  purple: tone("#7E22CE", "#FAF5FF", "#E9D5FF", "#D8B4FE", "126,34,206"),
  emerald: tone("#047857", "#ECFDF5", "#A7F3D0", "#6EE7B7", "4,120,87"),
  amber: tone("#B45309", "#FFFBEB", "#FDE68A", "#FCD34D", "180,83,9"),
  pink: tone("#BE185D", "#FDF2F8", "#FBCFE8", "#F9A8D4", "190,24,93"),
  teal: tone("#0F766E", "#F0FDFA", "#99F6E4", "#5EEAD4", "15,118,110"),
  indigo: tone("#4338CA", "#EEF2FF", "#C7D2FE", "#A5B4FC", "67,56,202"),
  sky: tone("#0369A1", "#F0F9FF", "#BAE6FD", "#7DD3FC", "3,105,161"),
  fuchsia: tone("#A21CAF", "#FDF4FF", "#F5D0FE", "#F0ABFC", "162,28,175"),
  lime: tone("#4D7C0F", "#F7FEE7", "#D9F99D", "#BEF264", "77,124,15"),
  orange: tone("#C2410C", "#FFF7ED", "#FED7AA", "#FDBA74", "194,65,12"),
  cyan: tone("#0E7490", "#ECFEFF", "#A5F3FC", "#67E8F9", "14,116,144"),
  violet: tone("#6D28D9", "#F5F3FF", "#DDD6FE", "#C4B5FD", "109,40,217"),
  green: tone("#15803D", "#F0FDF4", "#BBF7D0", "#86EFAC", "21,128,61"),
  rose: tone("#BE123C", "#FFF1F2", "#FECDD3", "#FDA4AF", "190,18,60"),
  slate: tone("#475569", "#F1F5F9", "#E2E8F0", "#CBD5E1", "100,116,139"),
};

// Order matters: the first rule that matches wins ("social science" before "science", "political" before "science").
// `words` = whole words / prefixes of words; `phrases` = substrings of the whole text.
type Rule = { key: string; short: string; label: string; tone: Tone; words?: RegExp; phrases?: RegExp };
const RULES: Rule[] = [
  { key: "general", short: "ALL", label: "All subjects", tone: T.slate, words: /^(all|general|combined|mixed)$/ },
  { key: "sst", short: "SST", label: "Social Science", tone: T.indigo, phrases: /social\s*(science|studies)/, words: /^(sst|ss)$/ },
  { key: "political", short: "POL", label: "Political Science", tone: T.violet, phrases: /political\s*science|civics/, words: /^(pol|polsci|polity)$/ },
  { key: "computer", short: "CS", label: "Computer", tone: T.green, phrases: /computer|informatics/, words: /^(cs|it|ip|coding|programming|python|java)$/ },
  { key: "home", short: "HSC", label: "Home Science", tone: T.rose, phrases: /home\s*science/ },
  { key: "accounts", short: "ACC", label: "Accountancy", tone: T.blue, words: /^(acc|accs|acct|accts|account\w*)$/ },
  { key: "bst", short: "BST", label: "Business Studies", tone: T.purple, phrases: /business/, words: /^(bs|bst|b\.st|bstd)$/ },
  { key: "economics", short: "ECO", label: "Economics", tone: T.emerald, words: /^(eco|econ|ecos|economics?|economy)$/ },
  { key: "maths", short: "MATH", label: "Mathematics", tone: T.red, words: /^(math|maths|mathematics|mat|mth|algebra|geometry|calculus)$/ },
  { key: "physics", short: "PHY", label: "Physics", tone: T.sky, words: /^(phy|phys|physics)$/ },
  { key: "chemistry", short: "CHEM", label: "Chemistry", tone: T.fuchsia, words: /^(chem|chemistry|che)$/ },
  { key: "biology", short: "BIO", label: "Biology", tone: T.lime, words: /^(bio|biology|botany|zoology)$/ },
  { key: "science", short: "SCI", label: "Science", tone: T.teal, words: /^(sci|science|evs)$/ },
  { key: "english", short: "ENG", label: "English", tone: T.amber, words: /^(eng|english|grammar|literature)$/ },
  { key: "hindi", short: "HIN", label: "Hindi", tone: T.pink, words: /^(hin|hindi)$/ },
  { key: "sanskrit", short: "SKT", label: "Sanskrit", tone: T.rose, words: /^(skt|sans|sanskrit)$/ },
  { key: "history", short: "HIS", label: "History", tone: T.orange, words: /^(hist|history)$/ },
  { key: "geography", short: "GEO", label: "Geography", tone: T.cyan, words: /^(geo|geog|geography)$/ },
  { key: "statistics", short: "STAT", label: "Statistics", tone: T.violet, words: /^(stats?|statistics)$/ },
];

// Unknown subjects: stable pick from these (no slate — that means "general").
const HASH_TONES = [T.blue, T.purple, T.emerald, T.red, T.amber, T.pink, T.teal, T.indigo, T.sky, T.fuchsia, T.lime, T.orange, T.cyan, T.violet, T.green, T.rose];

const words = (s: string) => s.toLowerCase().split(/[^a-z.]+/).map(w => w.replace(/\.+$/, "")).filter(Boolean);

/** Colour for a subject text ("ECO", "Accounts ", "Social Science"). */
export function subjectColorOf(text: string | null | undefined): SubjectColor {
  const raw = (text || "").trim();
  if (!raw) return { key: "general", label: "", short: "", ...T.slate };
  const low = raw.toLowerCase();
  const ws = words(raw);
  for (const r of RULES) {
    if ((r.phrases && r.phrases.test(low)) || (r.words && ws.some(w => r.words!.test(w)))) {
      return { key: r.key, label: r.label, short: r.short, ...r.tone };
    }
  }
  let h = 0;
  for (const ch of low.replace(/\s+/g, " ")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const short = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return { key: `other:${low}`, label: "", short, ...HASH_TONES[h % HASH_TONES.length] };
}

/** Colour for a batch: its subject field first, else its name ("ECONOMICS BATCH 11th"). */
export function batchSubjectColor(batch: { name?: string | null; subject?: string | null }): SubjectColor {
  const fromSubject = subjectColorOf(batch.subject);
  if (batch.subject?.trim() && !fromSubject.key.startsWith("other:")) return fromSubject;
  const fromName = subjectColorOf(batch.name);
  if (!fromName.key.startsWith("other:")) return fromName;
  return batch.subject?.trim() ? fromSubject : fromName;
}

/** CSS variables for the `.subj-chip` / `.subj-accent` classes (dashboardTheme.tsx), light + dark. */
export function subjectVars(c: SubjectColor): CSSProperties {
  return {
    "--s-fg": c.fg, "--s-bg": c.bg, "--s-bd": c.bd,
    "--s-fg-d": c.fgDark, "--s-bg-d": c.bgDark, "--s-bd-d": c.bdDark,
  } as CSSProperties;
}
