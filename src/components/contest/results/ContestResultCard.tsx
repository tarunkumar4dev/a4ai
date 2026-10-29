// src/components/contest/results/ContestResultCard.tsx — the student's result: score ring, %, rank, correct /
// wrong / left, time, badges, "See leaderboard" / "Review answers". Used right after submit and when a submitted
// contest is reopened. teacher_release before publishing: a friendly "results coming soon" card instead.
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Trophy } from "lucide-react";
import { CONTEST_FONT_STACK, CONTEST_NAVY } from "@/lib/contestFont";
import { mmss, scoreTone, type Badge } from "@/lib/leaderboard";
import { useCountUp } from "./motion";

export interface ResultCardProps {
  title: string;
  subtitle?: string;
  /** results withheld until the teacher publishes */
  pending?: boolean;
  score?: number | null;
  total?: number | null;
  percentage?: number | null;
  rank?: number | null;
  participants?: number | null;
  correct?: number | null;
  wrong?: number | null;
  left?: number | null;
  attempted?: number | null;
  timeSec?: number | null;
  badges?: Badge[];
  leaderboardHref?: string | null;
  onReview?: (() => void) | null;
  extra?: React.ReactNode;
  /** default "Test submitted" */
  heading?: string;
}

function ScoreRing({ pct, score, total }: { pct: number; score: number; total: number }) {
  const shown = useCountUp(pct, 1000);
  const shownScore = useCountUp(score, 1000);
  const r = 64;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(pct);
  return (
    <div className="relative w-40 h-40 mx-auto" role="img" aria-label={`Score ${score} out of ${total}, ${Math.round(pct)} percent`}>
      <svg viewBox="0 0 160 160" className="w-40 h-40 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#E5E7EB" strokeWidth="14" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={tone.bar} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, shown) / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-gray-900 tabular-nums">{Math.round(shownScore)}<span className="text-base text-gray-600">/{total}</span></p>
        <p className={`text-sm font-bold tabular-nums ${tone.text}`}>{Math.round(shown)}%</p>
      </div>
    </div>
  );
}

const Stat = ({ label, value, cls }: { label: string; value: React.ReactNode; cls: string }) => (
  <div className={`rounded-2xl border py-3 ${cls}`}>
    <p className="text-xl font-bold tabular-nums">{value}</p>
    <p className="text-[11px] font-semibold">{label}</p>
  </div>
);

export default function ContestResultCard(p: ResultCardProps) {
  const hasScore = !p.pending && p.score != null && p.total;
  const pct = p.percentage ?? (hasScore ? (p.score! / p.total!) * 100 : 0);
  return (
    <div className="min-h-screen bg-[#F4F6FA] flex items-start sm:items-center justify-center p-4" style={{ fontFamily: CONTEST_FONT_STACK }}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-lg overflow-hidden text-center" data-testid="result-card">
        <div className="px-6 py-4 text-white text-left" style={{ background: `linear-gradient(135deg, ${CONTEST_NAVY}, #4338CA)` }}>
          <p className="text-sm font-bold truncate">{p.title}</p>
          {p.subtitle && <p className="text-xs text-indigo-100">{p.subtitle}</p>}
        </div>
        <div className="p-6 md:p-8 space-y-5">
          {p.pending ? (
            <>
              <p className="text-5xl" aria-hidden>🎉</p>
              <h2 className="text-2xl font-bold text-gray-900">{p.heading || "Test submitted"}</h2>
              <p className="text-sm font-semibold text-gray-800 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                Results coming soon — your teacher will publish them.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm font-bold"><CheckCircle2 size={18} /> {p.heading || "Test submitted"}</div>
              {hasScore ? <ScoreRing pct={pct} score={p.score!} total={p.total!} /> : <p className="text-sm text-gray-700">Your answers have been recorded.</p>}
              {p.rank != null && (
                <p className="text-lg font-bold text-gray-900" data-testid="my-rank">
                  <Trophy size={18} className="inline -mt-1 mr-1 text-amber-600" />
                  You are #{p.rank}{p.participants ? <span className="text-gray-700 font-semibold"> of {p.participants}</span> : null}
                </p>
              )}
            </>
          )}

          <div className="grid grid-cols-3 gap-2">
            {p.correct != null && !p.pending ? (
              <>
                <Stat label="Correct" value={p.correct} cls="bg-green-50 border-green-200 text-green-900" />
                <Stat label="Wrong" value={p.wrong ?? 0} cls="bg-red-50 border-red-200 text-red-900" />
                <Stat label="Left" value={p.left ?? 0} cls="bg-gray-50 border-gray-200 text-gray-800" />
              </>
            ) : (
              <>
                <Stat label="Attempted" value={p.attempted ?? "—"} cls="bg-indigo-50 border-indigo-200 text-indigo-900" />
                <Stat label="Left" value={p.left ?? "—"} cls="bg-gray-50 border-gray-200 text-gray-800" />
                <Stat label="Time" value={mmss(p.timeSec)} cls="bg-gray-50 border-gray-200 text-gray-800" />
              </>
            )}
          </div>
          {p.correct != null && !p.pending && p.timeSec != null && <p className="text-xs text-gray-700">Time taken: {mmss(p.timeSec)}</p>}

          {!!p.badges?.length && !p.pending && (
            <ul className="flex flex-wrap justify-center gap-2" aria-label="Badges">
              {p.badges.map((b) => (
                <li key={b.id} className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">{b.emoji} {b.label}</li>
              ))}
            </ul>
          )}

          {p.extra}

          <div className="grid gap-2">
            {p.leaderboardHref && !p.pending && (
              <Link to={p.leaderboardHref} className="min-h-[48px] rounded-xl text-white font-bold text-sm inline-flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, #4F46E5, #7C3AED)` }}>
                <Trophy size={16} /> See leaderboard
              </Link>
            )}
            {p.onReview && !p.pending && (
              <button onClick={p.onReview} className="min-h-[48px] rounded-xl font-bold text-sm text-white inline-flex items-center justify-center gap-2" style={{ background: CONTEST_NAVY }}>
                <BookOpen size={16} /> Review answers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
