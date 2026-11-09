// Chat history list helpers (pure): ChatGPT-style groups, title filter, relative times, flat rows for the
// windowed list. Pinned chats always come first, whatever their date.
import type { SessionSummary } from "./types";

export type HistoryGroupKey = "pinned" | "today" | "yesterday" | "week" | "older";
export const GROUP_LABEL: Record<HistoryGroupKey, string> = {
  pinned: "Pinned", today: "Today", yesterday: "Yesterday", week: "Previous 7 days", older: "Older",
};
const ORDER: HistoryGroupKey[] = ["pinned", "today", "yesterday", "week", "older"];
const DAY = 86_400_000;

export const sessionTime = (s: SessionSummary): number => {
  const n = Date.parse(s.updated_at || s.created_at);
  return Number.isFinite(n) ? n : 0;
};

/** Date group by local calendar day: today / yesterday / the 7 days before / older. */
export function dateGroup(ms: number, now: number): Exclude<HistoryGroupKey, "pinned"> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  if (ms >= today) return "today";
  if (ms >= today - DAY) return "yesterday";
  if (ms >= today - 7 * DAY) return "week";
  return "older";
}

export const normTitle = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Every word of the query must appear in the title (any order). Empty query = everything. */
export function titleMatches(title: string, q: string): boolean {
  const words = normTitle(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const t = normTitle(title);
  return words.every((w) => t.includes(w));
}

export interface HistoryGroup { key: HistoryGroupKey; label: string; items: SessionSummary[] }

/**
 * Groups for the list. `pinned` and `rest` come from two server lists (pinned=true / pinned=false); a session that
 * is in both (a pin that raced a page load) is shown once, under Pinned. Optional title filter.
 */
export function groupSessions(pinned: SessionSummary[], rest: SessionSummary[], now: number, q = ""): HistoryGroup[] {
  const seen = new Set<string>();
  const buckets = new Map<HistoryGroupKey, SessionSummary[]>();
  const add = (k: HistoryGroupKey, s: SessionSummary) => {
    if (seen.has(s.session_id) || !titleMatches(s.title, q)) return;
    seen.add(s.session_id);
    buckets.set(k, [...(buckets.get(k) ?? []), s]);
  };
  for (const s of [...pinned].sort((a, b) => sessionTime(b) - sessionTime(a))) add("pinned", { ...s, pinned: true });
  for (const s of [...rest].sort((a, b) => sessionTime(b) - sessionTime(a))) {
    if (s.pinned) add("pinned", s);
    else add(dateGroup(sessionTime(s), now), s);
  }
  return ORDER.filter((k) => buckets.get(k)?.length).map((k) => ({ key: k, label: GROUP_LABEL[k], items: buckets.get(k)! }));
}

export type HistoryRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "item"; key: string; session: SessionSummary };

/** Flat rows (group header, then its chats) for the windowed list. */
export function flattenGroups(groups: HistoryGroup[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const g of groups) {
    rows.push({ kind: "header", key: `h:${g.key}`, label: g.label });
    for (const s of g.items) rows.push({ kind: "item", key: s.session_id, session: s });
  }
  return rows;
}

/** "now", "5m", "3h", "Yesterday", "3d", "12 Oct", "12 Oct 2025" */
export function relativeTime(ms: number, now: number): string {
  if (!ms) return "";
  const diff = now - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000 && dateGroup(ms, now) === "today") return `${Math.floor(diff / 60_000)}m`;
  const g = dateGroup(ms, now);
  if (g === "today") return `${Math.floor(diff / 3_600_000)}h`;
  if (g === "yesterday") return "Yesterday";
  if (g === "week") return `${Math.max(2, Math.round(diff / DAY))}d`;
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-IN", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/** Visible slice of a fixed-row-height list (windowing). Pure. */
export function windowRange(count: number, rowHeight: number, scrollTop: number, viewport: number, overscan = 6): { start: number; end: number } {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visible = Math.ceil(Math.max(viewport, rowHeight) / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) };
}

/** Row heights → offsets (offsets[i] = top of row i, offsets[n] = total height). Pure. */
export function rowOffsets(heights: number[]): number[] {
  const out = new Array<number>(heights.length + 1);
  out[0] = 0;
  for (let i = 0; i < heights.length; i++) out[i + 1] = out[i] + heights[i];
  return out;
}

/** Visible rows of a variable-height list from its offsets (binary search), plus overscan rows each side. Pure. */
export function windowByOffsets(offsets: number[], scrollTop: number, viewport: number, overscan = 6): { start: number; end: number } {
  const n = offsets.length - 1;
  if (n <= 0) return { start: 0, end: 0 };
  const find = (y: number) => {
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= y) lo = mid; else hi = mid - 1;
    }
    return lo;
  };
  const first = find(Math.max(0, scrollTop));
  const last = find(Math.max(0, scrollTop) + Math.max(viewport, 1));
  return { start: Math.max(0, first - overscan), end: Math.min(n, last + 1 + overscan) };
}
