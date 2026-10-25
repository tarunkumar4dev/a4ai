// src/pages/teacher/MyContestsPage.tsx — /contests/mine: the teacher's contests (GET /contests/my), each one's
// results (GET /contests/{id}/leaderboard) and "Publish results" for contests whose answers wait for the teacher
// (answer_mode teacher_release → POST /contests/{id}/publish-results).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, Loader2, Megaphone, Trophy } from "lucide-react";
import { toast } from "sonner";
import { contestApi, ContestApiError, type LeaderboardRow, type MyContest } from "@/lib/contestApi";

const MODE_LABEL: Record<string, string> = {
  instant: "Answers after each question",
  after_test: "Answers after submitting",
  teacher_release: "Results when you publish",
  none: "Answers never shown",
};

function Results({ contestId }: { contestId: string }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    contestApi.getLeaderboard(contestId)
      .then((r) => setRows(r.attempts || []))
      .catch((e) => setError(e?.message || "Could not load results"));
  }, [contestId]);
  if (error) return <p className="text-sm text-red-700 px-4 pb-4">{error}</p>;
  if (!rows) return <p className="text-sm text-gray-500 px-4 pb-4 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading results…</p>;
  if (rows.length === 0) return <p className="text-sm text-gray-500 px-4 pb-4">No attempts yet.</p>;
  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-500 border-b">
          <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Score</th>
          <th className="py-2 pr-3">Tab switches</th><th className="py-2 pr-3">Status</th>
        </tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.attempt_id} className="border-b last:border-0">
              <td className="py-2 pr-3 text-gray-500">{i + 1}</td>
              <td className="py-2 pr-3 font-semibold text-gray-900">{r.student_name || r.student_email || "Student"}</td>
              <td className="py-2 pr-3 tabular-nums">{r.score ?? "—"}/{r.total_marks}{r.percentage != null ? ` (${Math.round(r.percentage)}%)` : ""}</td>
              <td className="py-2 pr-3 tabular-nums">{r.warning_count}</td>
              <td className="py-2 pr-3 text-gray-600">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MyContestsPage() {
  const [contests, setContests] = useState<MyContest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    contestApi.listMyContests()
      .then((r) => setContests(r.contests || []))
      .catch((e) => setError(e?.message || "Could not load your contests"));
  }, []);
  useEffect(load, [load]);

  const publish = async (c: MyContest) => {
    if (!window.confirm(`Publish results of “${c.title}”? Students will see their scores and the answers.`)) return;
    setPublishing(c.contest_id);
    try {
      await contestApi.publishResults(c.contest_id);
      setPublished((p) => ({ ...p, [c.contest_id]: true }));
      toast.success("Results published — students can see them now.");
    } catch (e) {
      const notYet = e instanceof ContestApiError && (e.status === 404 || e.status === 405);
      toast.error(notYet ? "Publishing isn't available on the server yet." : (e as Error)?.message || "Could not publish results");
    } finally {
      setPublishing(null);
    }
  };

  const copy = (c: MyContest) => {
    const link = `${window.location.origin}/contest/${c.short_code}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(c.contest_id); setTimeout(() => setCopied(null), 1500); }).catch(() => toast.info(link));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/contests" aria-label="Back" className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-lg font-black text-gray-900">My contests</h1>
            <p className="text-xs text-gray-500">Results, links and publishing</p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3">
            {error}<button onClick={load} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">Retry</button>
          </div>
        )}
        {!contests && !error && <p className="text-sm text-gray-500 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
        {contests?.length === 0 && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No contests yet. Create one from a test or a PDF.</p>}
        {contests?.map((c) => {
          const waiting = c.answer_mode === "teacher_release" && !c.results_published && !published[c.contest_id];
          return (
            <div key={c.contest_id} className="rounded-2xl border border-gray-200 bg-white">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{c.title}</p>
                  <p className="text-xs text-gray-500">
                    {[c.subject, c.class_grade, `${c.total_questions} Qs`, `${c.total_attempts ?? 0} attempts`, MODE_LABEL[c.answer_mode] || c.answer_mode].filter(Boolean).join(" · ")}
                  </p>
                  {(c.results_published || published[c.contest_id]) && <p className="text-xs font-bold text-emerald-700 mt-0.5">✓ Results published</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copy(c)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
                    {copied === c.contest_id ? <Check size={14} /> : <Copy size={14} />} {c.short_code}
                  </button>
                  <button onClick={() => setOpen(open === c.contest_id ? null : c.contest_id)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
                    <Trophy size={14} /> {open === c.contest_id ? "Hide results" : "Results"}
                  </button>
                  {waiting && (
                    <button onClick={() => publish(c)} disabled={publishing === c.contest_id}
                      className="px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                      {publishing === c.contest_id ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} Publish results
                    </button>
                  )}
                </div>
              </div>
              {open === c.contest_id && <Results contestId={c.contest_id} />}
            </div>
          );
        })}
      </main>
    </div>
  );
}
