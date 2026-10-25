// src/lib/leaderboard.ts — pure helpers for the contest leaderboard and result screen (unit-tested).
import type { LeaderboardRow } from "@/lib/contestApi";

export type Ranked = LeaderboardRow & { rank: number };

const pct = (r: LeaderboardRow) =>
  r.percentage ?? (r.score != null && r.total_marks ? (r.score / r.total_marks) * 100 : 0);

/**
 * Finished rows ranked: score desc, time asc, tab switches asc (when known). The backend's rank wins when every
 * row has one; otherwise ranks are computed — identical score + time share a rank (1, 2, 2, 4).
 */
export function rankRows(rows: LeaderboardRow[]): Ranked[] {
  const done = rows.filter((r) => r.status !== "in_progress" && r.score != null);
  const t = (r: LeaderboardRow) => r.time_taken_seconds ?? Number.MAX_SAFE_INTEGER;
  const w = (r: LeaderboardRow) => r.warning_count ?? 0;
  const sorted = [...done].sort((a, b) => (b.score! - a.score!) || (t(a) - t(b)) || (w(a) - w(b)));
  if (sorted.length && sorted.every((r) => typeof r.rank === "number")) {
    return [...sorted].sort((a, b) => a.rank! - b.rank!) as Ranked[];
  }
  let prev: LeaderboardRow | null = null;
  let prevRank = 0;
  return sorted.map((r, i) => {
    const rank = prev && prev.score === r.score && t(prev) === t(r) ? prevRank : i + 1;
    prev = r;
    prevRank = rank;
    return { ...r, rank };
  });
}

export interface Badge { id: string; emoji: string; label: string }

/** Only positive badges. Tab-switch badge only when the count is known (teacher data / your own attempt). */
export function badgesFor(row: Ranked, all: Ranked[], opts: { myWarnings?: number | null } = {}): Badge[] {
  const out: Badge[] = [];
  const n = all.length;
  const p = pct(row);
  if (row.rank === 1) out.push({ id: "topper", emoji: "🏆", label: "Topper" });
  if (row.score != null && row.total_marks > 0 && row.score === row.total_marks) out.push({ id: "perfect", emoji: "💯", label: "Perfect score" });
  const strong = all.filter((r) => pct(r) >= 70 && r.time_taken_seconds != null);
  if (p >= 70 && row.time_taken_seconds != null && strong.length > 1 &&
      row.time_taken_seconds === Math.min(...strong.map((r) => r.time_taken_seconds!))) {
    out.push({ id: "fastest", emoji: "⚡", label: "Fastest finisher" });
  }
  const answered = (row.correct ?? 0) + (row.wrong ?? 0);
  if (answered > 0 && (row.correct ?? 0) / answered >= 0.9) out.push({ id: "accuracy", emoji: "🎯", label: "Accuracy 90%+" });
  const warnings = row.warning_count ?? (row.is_me ? opts.myWarnings : null);
  if (warnings === 0) out.push({ id: "focused", emoji: "🧘", label: "Zero tab switches" });
  if (n >= 10 && row.rank <= Math.ceil(n * 0.1)) out.push({ id: "top10", emoji: "🔥", label: "Top 10%" });
  return out;
}

// Contrast ≥ 4.5 with white text
const AVATAR_COLOURS = ["#4338CA", "#6D28D9", "#BE185D", "#B45309", "#0F766E", "#1D4ED8", "#9D174D", "#047857"];

export function avatarColour(name: string): string {
  let h = 0;
  for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export function initials(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const displayName = (r: LeaderboardRow) => r.student_name?.trim() || "Student";

export const mmss = (sec: number | null | undefined) => {
  if (sec == null || !isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const percentOf = pct;

/** green / amber / red for score meaning only */
export function scoreTone(p: number): { bar: string; text: string } {
  if (p >= 75) return { bar: "#15803D", text: "text-green-800" };
  if (p >= 40) return { bar: "#B45309", text: "text-amber-800" };
  return { bar: "#B91C1C", text: "text-red-800" };
}

// ── contest id from a short code: this device remembers it (the link may outlive /info, which 410s after the end) ──
const idKey = (code: string) => `a4_contest_id_${code}`;
export function rememberContestId(code: string, id: string): void {
  try { localStorage.setItem(idKey(code), id); } catch { /* ignore */ }
}
export function rememberedContestId(code: string): string | null {
  try { return localStorage.getItem(idKey(code)); } catch { return null; }
}
export function myAttemptId(code: string): string | null {
  try { return localStorage.getItem(`a4_contest_attempt_${code}`); } catch { return null; }
}

export const leaderboardHref = (code: string, contestId?: string | null) =>
  `/contests/leaderboard?c=${encodeURIComponent(code)}${contestId ? `&id=${encodeURIComponent(contestId)}` : ""}`;
