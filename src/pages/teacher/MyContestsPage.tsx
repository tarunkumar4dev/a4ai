// src/pages/teacher/MyContestsPage.tsx — /contests/mine: the teacher's contests (GET /contests/my).
// Card per contest: Results, Open leaderboard, Copy leaderboard link, Copy contest link, Publish / Hide results.
// Results view: podium summary, then the full table (incl. email, tab switches, submitted_via, retry, late and
// unfinished attempts) with CSV download. ?open=<contest_id> opens that contest's results (share step link).
// Only contests owned by the logged-in account are listed (contests.teacher_id = this user).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, Copy, Download, EyeOff, Link2, Loader2, Megaphone, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { contestApi, ContestApiError, formatIst, type LeaderboardResponse, type MyContest } from "@/lib/contestApi";
import { CONTEST_FONT_STACK, CONTEST_NAVY, useContestFont } from "@/lib/contestFont";
import { avatarColour, displayName, initials, leaderboardHref, mmss, percentOf, rankRows, resultsCsv, scoreTone } from "@/lib/leaderboard";

const MODE_LABEL: Record<string, string> = {
  instant: "Answers after each question",
  after_test: "Answers after submitting",
  teacher_release: "Results when you publish",
  none: "Answers never shown",
};
const VIA: Record<string, string> = { manual: "Submitted", auto_warnings: "Auto · tab switches", auto_timeout: "Auto · time up" };

function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });   // BOM: Excel keeps Hindi names readable
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\w\- ]+/g, "").trim() || "results"}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function Results({ contest }: { contest: MyContest }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    contestApi.getLeaderboard(contest.contest_id)
      .then(setData)
      .catch((e) => setError(e?.message || "Could not load results"));
  }, [contest.contest_id]);
  const ranked = useMemo(() => rankRows(data?.attempts || []), [data]);
  const unfinished = useMemo(() => (data?.attempts || []).filter((r) => r.status === "in_progress" || r.score == null), [data]);

  if (error) return <p className="text-sm text-red-700 px-4 pb-4">{error}</p>;
  if (!data) return <p className="text-sm text-gray-700 px-4 pb-4 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading results…</p>;
  if (ranked.length === 0 && unfinished.length === 0) return <p className="text-sm text-gray-700 px-4 pb-4">No attempts yet.</p>;
  const avg = ranked.length ? Math.round(ranked.reduce((s, r) => s + percentOf(r), 0) / ranked.length) : 0;

  return (
    <div className="px-4 pb-4 space-y-4" data-testid={`results-${contest.contest_id}`}>
      {/* podium summary */}
      {ranked.length > 0 && (
        <div className="rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${CONTEST_NAVY}, #4338CA 55%, #7C3AED)` }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm font-bold inline-flex items-center gap-1.5"><Trophy size={16} className="text-amber-300" /> Top performers</p>
            <p className="text-xs text-indigo-100">{ranked.length} finished · average {avg}%{unfinished.length ? ` · ${unfinished.length} not finished` : ""}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ranked.slice(0, 3).map((r) => (
              <div key={r.attempt_id} className="rounded-xl bg-white/10 px-3 py-2 flex items-center gap-2 min-w-0">
                <span className="text-lg" aria-hidden>{["🥇", "🥈", "🥉"][Math.min(2, r.rank - 1)] ?? "🏅"}</span>
                <span aria-hidden className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0" style={{ background: avatarColour(displayName(r)) }}>{initials(displayName(r))}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold truncate">{displayName(r)}</span>
                  <span className="block text-xs text-indigo-100 tabular-nums">{r.score}/{r.total_marks} · {Math.round(percentOf(r))}% · {mmss(r.time_taken_seconds)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => downloadCsv(contest.title, resultsCsv(data.attempts))}
          className="min-h-[44px] px-4 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 inline-flex items-center gap-2 bg-white">
          <Download size={16} /> Download CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-gray-50"><tr className="text-left text-xs text-gray-700">
            <th className="py-2.5 px-3">#</th><th className="py-2.5 px-3">Student</th><th className="py-2.5 px-3">Email</th>
            <th className="py-2.5 px-3">Score</th><th className="py-2.5 px-3">Time</th><th className="py-2.5 px-3">Tab switches</th>
            <th className="py-2.5 px-3">How</th><th className="py-2.5 px-3">Notes</th>
          </tr></thead>
          <tbody>
            {ranked.map((r) => {
              const p = percentOf(r);
              return (
                <tr key={r.attempt_id} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-bold tabular-nums">{r.rank}</td>
                  <td className="py-2 px-3 font-semibold text-gray-900">{displayName(r)}</td>
                  <td className="py-2 px-3 text-gray-700">{r.student_email || "—"}</td>
                  <td className={`py-2 px-3 tabular-nums font-semibold ${scoreTone(p).text}`}>{r.score}/{r.total_marks} ({Math.round(p)}%)</td>
                  <td className="py-2 px-3 tabular-nums">{mmss(r.time_taken_seconds)}</td>
                  <td className="py-2 px-3 tabular-nums">{r.warning_count ?? "—"}</td>
                  <td className="py-2 px-3 text-gray-700">{r.submitted_via ? VIA[r.submitted_via] || r.submitted_via : "—"}</td>
                  <td className="py-2 px-3 text-xs">
                    {r.retry && <span className="mr-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-900 font-bold">Retry</span>}
                    {r.late && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-bold">Late</span>}
                  </td>
                </tr>
              );
            })}
            {unfinished.map((r) => (
              <tr key={r.attempt_id} className="border-t border-gray-100 bg-gray-50/60">
                <td className="py-2 px-3 text-gray-500">—</td>
                <td className="py-2 px-3 font-semibold text-gray-900">{displayName(r)}</td>
                <td className="py-2 px-3 text-gray-700">{r.student_email || "—"}</td>
                <td className="py-2 px-3 text-gray-700" colSpan={5}>Not finished{r.warning_count != null ? ` · ${r.warning_count} tab switches` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MyContestsPage() {
  useContestFont();
  const [params] = useSearchParams();
  const [contests, setContests] = useState<MyContest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [busy, setBusy] = useState<string | null>(null);
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    contestApi.listMyContests()
      .then((r) => setContests(r.contests || []))
      .catch((e) => setError(e?.message || "Could not load your contests"));
  }, []);
  useEffect(load, [load]);

  const isPublished = (c: MyContest) => published[c.contest_id] ?? (!!c.results_published_at || !!c.results_published);

  const publish = async (c: MyContest) => {
    if (!window.confirm(`Publish results of “${c.title}”? Students will see their scores, the leaderboard and the answers.`)) return;
    setBusy(c.contest_id);
    try {
      await contestApi.publishResults(c.contest_id);
      setPublished((p) => ({ ...p, [c.contest_id]: true }));
      toast.success("Results published — students can see them now.");
    } catch (e) {
      const notYet = e instanceof ContestApiError && (e.status === 404 || e.status === 405);
      toast.error(notYet ? "Publishing isn't available on the server yet." : (e as Error)?.message || "Could not publish results");
    } finally { setBusy(null); }
  };

  const hide = async (c: MyContest) => {
    if (!window.confirm(`Hide results of “${c.title}” again?`)) return;
    setBusy(c.contest_id);
    try {
      await contestApi.unpublishResults(c.contest_id);
      setPublished((p) => ({ ...p, [c.contest_id]: false }));
      toast.success("Results hidden.");
    } catch (e) {
      const notYet = e instanceof ContestApiError && (e.status === 404 || e.status === 405);
      toast.error(notYet ? "Hiding results isn't available on the server yet." : (e as Error)?.message || "Could not hide results");
    } finally { setBusy(null); }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); })
      .catch(() => toast.info(text));
  };

  const btn = "min-h-[44px] px-3 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-bold text-gray-800 inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <div className="min-h-screen bg-[#F4F6FA]" style={{ fontFamily: CONTEST_FONT_STACK }}>
      <header className="text-white" style={{ background: `linear-gradient(135deg, ${CONTEST_NAVY}, #4338CA)` }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/contests" aria-label="Back" className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-lg font-bold">My contests</h1>
            <p className="text-xs text-indigo-100">Results, leaderboards, links and publishing</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3">
            {error}<button onClick={load} className="min-h-[44px] px-4 rounded-xl bg-gray-900 text-white text-sm font-bold">Retry</button>
          </div>
        )}
        {!contests && !error && <p className="text-sm text-gray-700 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
        {contests?.length === 0 && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">No contests yet. Create one from a test or a PDF.</p>}
        {contests && contests.length > 0 && (
          <p className="text-xs text-gray-700">Showing contests created while logged in as this account ({contests.length}).</p>
        )}
        {contests?.map((c) => {
          const lbLink = `${window.location.origin}${leaderboardHref(c.short_code, c.contest_id)}`;
          const contestLink = `${window.location.origin}/contest/${c.short_code}`;
          const released = c.answer_mode === "teacher_release";
          const pub = isPublished(c);
          const attempts = c.attempts_count ?? c.total_attempts ?? 0;
          return (
            <article key={c.contest_id} className="rounded-2xl border border-gray-200 bg-white shadow-sm" data-testid={`contest-${c.short_code}`}>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-900">{c.title}</h2>
                    <p className="text-xs text-gray-700 mt-0.5">
                      {[c.subject, c.class_grade && (/^\d+$/.test(c.class_grade) ? `Class ${c.class_grade}` : c.class_grade), `${c.total_questions} Qs`, `${c.duration_minutes} min`, MODE_LABEL[c.answer_mode] || c.answer_mode].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-gray-700 mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {attempts} attempt{attempts === 1 ? "" : "s"}</span>
                      {c.scheduled_at && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Opens {formatIst(c.scheduled_at)}</span>}
                      <span className="font-mono">{c.short_code}</span>
                    </p>
                  </div>
                  {released && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pub ? "bg-green-50 text-green-900 border border-green-200" : "bg-amber-50 text-amber-900 border border-amber-200"}`}>
                      {pub ? "✓ Results published" : "Results hidden"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button onClick={() => setOpen(open === c.contest_id ? null : c.contest_id)} aria-expanded={open === c.contest_id} className={btn}>
                    <Trophy size={15} /> {open === c.contest_id ? "Close results" : "Results"}
                  </button>
                  <Link to={leaderboardHref(c.short_code, c.contest_id)} className={btn}><Users size={15} /> Open leaderboard</Link>
                  <button onClick={() => copy(`lb-${c.contest_id}`, lbLink)} className={btn}>
                    {copied === `lb-${c.contest_id}` ? <Check size={15} /> : <Link2 size={15} />} Copy leaderboard link
                  </button>
                  <button onClick={() => copy(`c-${c.contest_id}`, contestLink)} className={btn}>
                    {copied === `c-${c.contest_id}` ? <Check size={15} /> : <Copy size={15} />} Copy contest link
                  </button>
                  {released && !pub && (
                    <button onClick={() => publish(c)} disabled={busy === c.contest_id}
                      className="min-h-[44px] px-3 rounded-xl text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                      {busy === c.contest_id ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />} Publish results
                    </button>
                  )}
                  {released && pub && (
                    <button onClick={() => hide(c)} disabled={busy === c.contest_id} className={btn}>
                      {busy === c.contest_id ? <Loader2 size={15} className="animate-spin" /> : <EyeOff size={15} />} Hide results
                    </button>
                  )}
                </div>
              </div>
              {open === c.contest_id && <Results contest={c} />}
            </article>
          );
        })}
      </main>
    </div>
  );
}
