// Contest states and what the viewer may do — the ONLY place these rules live (rows, banner and the code preview
// all call primaryAction). Inputs come from get_my_contests / get_contest_card (29_contest_feed.sql); the phase
// is recomputed on the shared server clock, so a row flips from "Starts in" to "Start" without a reload.
// The backend still decides for real: /start answers 403 not-started / 410 ended / 409 already-submitted.
import { leaderboardHref } from "@/lib/leaderboard";

export type MyState = "owner" | "registered" | "in_progress" | "submitted" | "none";
export type Phase = "scheduled" | "live" | "ended" | "paused";

export interface FeedContest {
  id: string;
  title: string;
  subject: string | null;
  class_grade: string | null;
  short_code: string;
  duration_minutes: number | null;
  total_questions: number | null;
  total_marks: number | null;
  scheduled_at: string | null;
  expires_at: string | null;
  /** DB free text; only 'active' runs (backend /start filters status = 'active') */
  status: string;
  answer_mode: string | null;
  attempts: number;
  my_state: MyState;
  registered_at: string | null;
  /** teacher_release and not published yet: the server withheld my_score */
  results_pending: boolean;
  my_score: number | null;
  my_percentage: number | null;
  my_submitted_at: string | null;
}

export type ContestAction =
  | { kind: "start" }
  | { kind: "resume" }
  | { kind: "register" }
  | { kind: "registered" }
  | { kind: "result" }
  | { kind: "result_pending" }
  | { kind: "leaderboard" }
  | { kind: "manage" }
  | { kind: "paused" };

const MY_STATES: readonly MyState[] = ["owner", "registered", "in_progress", "submitted", "none"];

export function assertNever(x: never): never {
  throw new Error(`Unhandled contest state: ${JSON.stringify(x)}`);
}

const ts = (iso: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
export const startsAt = (c: Pick<FeedContest, "scheduled_at">) => ts(c.scheduled_at);
export const endsAt = (c: Pick<FeedContest, "expires_at">) => ts(c.expires_at);

export function phaseAt(c: Pick<FeedContest, "scheduled_at" | "expires_at" | "status">, nowMs: number): Phase {
  const ends = endsAt(c);
  if (ends != null && ends <= nowMs) return "ended";
  if (c.status !== "active") return "paused";
  const starts = startsAt(c);
  if (starts != null && starts > nowMs) return "scheduled";
  return "live";
}

/** The next moment this contest's phase changes (for the countdown), or null when nothing is pending. */
export function nextBoundary(c: FeedContest, nowMs: number): { at: number; label: "Starts in" | "Ends in" } | null {
  const phase = phaseAt(c, nowMs);
  if (phase === "scheduled") return { at: startsAt(c)!, label: "Starts in" };
  const ends = endsAt(c);
  if (phase === "live" && ends != null) return { at: ends, label: "Ends in" };
  return null;
}

export function primaryAction(c: Pick<FeedContest, "my_state" | "results_pending">, phase: Phase): ContestAction {
  switch (c.my_state) {
    case "owner":
      return { kind: "manage" };
    case "submitted":
      return c.results_pending ? { kind: "result_pending" } : { kind: "result" };
    case "in_progress":
      switch (phase) {
        case "live":
        case "scheduled":
          return { kind: "resume" };
        // the backend finalizes a timed-out attempt from its saved answers when the leaderboard is opened
        case "ended":
          return c.results_pending ? { kind: "result_pending" } : { kind: "result" };
        case "paused":
          return { kind: "paused" };
        default:
          return assertNever(phase);
      }
    case "registered":
    case "none":
      switch (phase) {
        case "scheduled":
          return c.my_state === "registered" ? { kind: "registered" } : { kind: "register" };
        case "live":
          return { kind: "start" };
        case "ended":
          return { kind: "leaderboard" };
        case "paused":
          return { kind: "paused" };
        default:
          return assertNever(phase);
      }
    default:
      return assertNever(c.my_state);
  }
}

export const contestPath = (c: Pick<FeedContest, "short_code">) => `/contest/${encodeURIComponent(c.short_code)}`;
export const contestShareUrl = (c: Pick<FeedContest, "short_code">, origin = window.location.origin) =>
  `${origin}${contestPath(c)}`;

/** Label + where it goes (null href = handled by the caller: register, or a disabled state). */
export function actionView(a: ContestAction, c: Pick<FeedContest, "short_code" | "id">): {
  label: string; href: string | null; disabled: boolean; tone: "primary" | "secondary" | "muted";
} {
  switch (a.kind) {
    case "start": return { label: "Start", href: contestPath(c), disabled: false, tone: "primary" };
    case "resume": return { label: "Resume", href: contestPath(c), disabled: false, tone: "primary" };
    case "register": return { label: "Register", href: null, disabled: false, tone: "primary" };
    case "registered": return { label: "Registered", href: null, disabled: true, tone: "muted" };
    case "result": return { label: "View result", href: leaderboardHref(c.short_code, c.id), disabled: false, tone: "secondary" };
    case "result_pending": return { label: "Results soon", href: null, disabled: true, tone: "muted" };
    case "leaderboard": return { label: "Leaderboard", href: leaderboardHref(c.short_code, c.id), disabled: false, tone: "secondary" };
    case "manage": return { label: "Results", href: leaderboardHref(c.short_code, c.id), disabled: false, tone: "secondary" };
    case "paused": return { label: "Paused", href: null, disabled: true, tone: "muted" };
    default: return assertNever(a);
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** One row from the server → FeedContest. Missing optional fields become null; no id / code → null (skipped). */
export function normalizeContest(raw: unknown): FeedContest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const code = str(r.short_code);
  if (!id || !code) return null;
  const state = MY_STATES.includes(r.my_state as MyState) ? (r.my_state as MyState) : "none";
  return {
    id,
    title: str(r.title) ?? "Untitled contest",
    subject: str(r.subject),
    class_grade: str(r.class_grade),
    short_code: code,
    duration_minutes: num(r.duration_minutes),
    total_questions: num(r.total_questions),
    total_marks: num(r.total_marks),
    scheduled_at: str(r.scheduled_at),
    expires_at: str(r.expires_at),
    status: str(r.status) ?? "unknown",
    answer_mode: str(r.answer_mode),
    attempts: num(r.attempts) ?? 0,
    my_state: state,
    registered_at: str(r.registered_at),
    results_pending: r.results_pending === true,
    my_score: num(r.my_score),
    my_percentage: num(r.my_percentage),
    my_submitted_at: str(r.my_submitted_at),
  };
}

/** "2d 04:12:09" / "04:12:09" — fixed-width digits (tabular-nums in the UI), so nothing shifts as it ticks. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** "Sun, 3 Nov, 7:30 pm" in India time. */
export function formatWhen(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}
