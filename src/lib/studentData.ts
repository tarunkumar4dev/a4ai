// Numbers for the student dashboard and rewards page, computed only from real data:
//   contests  → get_my_contests (lib/contestFeed; the Past tab's first page = up to 20 latest results)
//   coins     → CoinContext (profiles.coins / coin_transactions, read-only here)
//   practice  → lib/practiceProgress (this device; always labelled as such)
// Pure functions (unit-tested) + two small queries (profile, coin history pages).
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { FeedContest } from "@/lib/contestLifecycle";
import type { PracticeSummary } from "@/lib/practiceProgress";

/* ─────────── contests ─────────── */

export interface ContestStats {
  /** submitted attempts among the loaded results */
  finished: number;
  /** submitted with a visible score (teacher_release before publishing has none) */
  scored: number;
  /** mean % over `scored`; null when nothing is scored (never 0 for "no data") */
  average: number | null;
  best: number | null;
  /** how many results the numbers are based on (the Past tab pages loaded so far) */
  basis: number;
}

export function contestStats(past: FeedContest[]): ContestStats {
  const done = past.filter((c) => c.my_state === "submitted");
  const pcts = done.filter((c) => !c.results_pending && c.my_percentage != null).map((c) => c.my_percentage!);
  return {
    finished: done.length,
    scored: pcts.length,
    average: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    best: pcts.length ? Math.round(Math.max(...pcts)) : null,
    basis: past.length,
  };
}

export interface SubjectRow { subject: string; contestAvg: number | null; contests: number; got: number; review: number }

/** Contest averages and practice marks per subject, side by side but never mixed into one number. */
export function subjectPerformance(past: FeedContest[], practice: PracticeSummary): SubjectRow[] {
  const rows = new Map<string, SubjectRow>();
  const row = (subject: string) => {
    const k = subject.trim().toLowerCase();
    if (!rows.has(k)) rows.set(k, { subject: subject.trim(), contestAvg: null, contests: 0, got: 0, review: 0 });
    return rows.get(k)!;
  };
  const sums = new Map<string, number>();
  for (const c of past) {
    if (!c.subject || c.my_state !== "submitted" || c.results_pending || c.my_percentage == null) continue;
    const r = row(c.subject);
    r.contests++;
    sums.set(r.subject.toLowerCase(), (sums.get(r.subject.toLowerCase()) ?? 0) + c.my_percentage);
  }
  for (const r of rows.values()) if (r.contests) r.contestAvg = Math.round(sums.get(r.subject.toLowerCase())! / r.contests);
  for (const s of practice.bySubject) {
    const r = row(s.subject);
    r.got += s.got;
    r.review += s.review;
  }
  return [...rows.values()].sort((a, b) => (b.contests + b.got + b.review) - (a.contests + a.got + a.review));
}

/* ─────────── activity ─────────── */

export interface CoinTx { id: string; type: string; amount: number; description: string; createdAt: string }
export type Activity =
  | { kind: "contest"; id: string; at: number; title: string; score: number | null; total: number | null; pending: boolean; href: string }
  | { kind: "coins"; id: string; at: number; amount: number; description: string; spent: boolean }
  | { kind: "practice"; id: string; at: number; count: number; day: string };

/** Newest first; one practice row per day; contest rows only for real submissions. */
export function buildActivity(
  past: FeedContest[], txs: CoinTx[], practice: PracticeSummary, hrefFor: (c: FeedContest) => string, limit = 8,
): Activity[] {
  const out: Activity[] = [];
  for (const c of past) {
    const at = c.my_submitted_at ? Date.parse(c.my_submitted_at) : NaN;
    if (c.my_state !== "submitted" || !Number.isFinite(at)) continue;
    out.push({ kind: "contest", id: `c-${c.id}`, at, title: c.title, score: c.results_pending ? null : c.my_score,
      total: c.total_marks, pending: c.results_pending, href: hrefFor(c) });
  }
  for (const t of txs) {
    const at = Date.parse(t.createdAt);
    if (!Number.isFinite(at) || !Number.isFinite(t.amount)) continue;
    out.push({ kind: "coins", id: `t-${t.id}`, at, amount: Math.abs(t.amount), description: t.description || "Coins",
      spent: t.type === "spend" || t.type === "redeem" || t.amount < 0 });
  }
  for (const d of practice.week) {
    if (!d.count) continue;
    const [y, m, day] = d.day.split("-").map(Number);
    out.push({ kind: "practice", id: `p-${d.day}`, at: new Date(y, m - 1, day, 23, 59).getTime(), count: d.count, day: d.day });
  }
  const seen = new Set<string>();
  return out.filter((a) => !seen.has(a.id) && !!seen.add(a.id)).sort((a, b) => b.at - a.at).slice(0, limit);
}

/* ─────────── milestones (server data only; nothing here is claimable) ─────────── */

export interface Milestone { id: string; title: string; detail: string; reached: boolean }

export function milestones(past: FeedContest[]): Milestone[] {
  const done = past.filter((c) => c.my_state === "submitted");
  const scored = done.filter((c) => !c.results_pending && c.my_percentage != null);
  return [
    { id: "first", title: "First contest", detail: "Finish your first contest", reached: done.length > 0 },
    { id: "five", title: "Regular", detail: "Finish 5 contests", reached: done.length >= 5 },
    { id: "75", title: "Strong score", detail: "Score 75% or more in a contest", reached: scored.some((c) => c.my_percentage! >= 75) },
    { id: "perfect", title: "Perfect score", detail: "Get full marks in a contest", reached: scored.some((c) => c.my_percentage! >= 100) },
  ];
}

/* ─────────── queries ─────────── */

export function useStudentProfile(uid: string | null) {
  return useQuery({
    queryKey: ["student", uid ?? "-", "profile"] as const,
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, school_name").eq("id", uid!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as { full_name: string | null; school_name: string | null } | null;
    },
  });
}

const TX_PAGE = 20;

/** Own coin transactions, newest first, 20 per page (RLS: read own). */
export function useCoinHistory(uid: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["student", uid ?? "-", "coins"] as const,
    enabled: !!uid && enabled,
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.from("coin_transactions")
        .select("id, type, amount, description, created_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + TX_PAGE - 1)
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []).map((r): CoinTx => ({
        id: String(r.id), type: String(r.type ?? ""), amount: Number(r.amount), description: String(r.description ?? ""), createdAt: String(r.created_at),
      }));
    },
    getNextPageParam: (last, all) => (last.length === TX_PAGE ? all.length * TX_PAGE : undefined),
  });
}
