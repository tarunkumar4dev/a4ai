// src/pages/teacher/CommunityQuizLeaderboardPage.tsx
// ──────────────────────────────────────────────────────────
// Admin leaderboard. Back goes to My Quizzes (not -1)
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getLeaderboard, type LeaderboardResponse } from "@/lib/communityQuizApi";

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  .sf-pro { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .anim-in { animation: fadeIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards; opacity: 0; }
  .ap-panel { background: rgba(255, 255, 255, 0.72); backdrop-filter: saturate(180%) blur(20px); border: 0.5px solid rgba(0, 0, 0, 0.06); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04); }
  .ap-btn-primary { background: #007AFF; color: white; font-weight: 600; transition: all 0.15s ease; }
  .ap-btn-primary:hover { background: #0066D9; }
  .ap-btn-primary:active { transform: scale(0.985); }
  .ap-btn-secondary { background: rgba(120, 120, 128, 0.12); color: #1d1d1f; font-weight: 500; transition: all 0.15s ease; }
  .ap-btn-secondary:hover { background: rgba(120, 120, 128, 0.2); }
`;

const Icons = {
  ArrowLeft: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Whatsapp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
  Loader: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Users: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

function formatTime(sec: number): string {
  if (sec < 0 || !sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return ""; }
}

export default function CommunityQuizLeaderboardPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function load() {
    if (!quizId) return;
    setLoading(true);
    try {
      const res = await getLeaderboard(quizId);
      setData(res);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Couldn't load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [quizId]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Rank", "Name", "Phone", "Email", "Class", "Score", "Total Marks", "Correct", "Time (s)", "Submitted At"],
      ...data.leaderboard.map(l => [
        l.rank, l.participant_name, l.participant_phone, l.participant_email || "",
        l.participant_class || "", l.total_score, data.quiz.total_marks,
        l.correct_count, l.time_taken_seconds, l.submitted_at,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.quiz.title.replace(/[^a-z0-9]+/gi, "_")}_leaderboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function shareWinners() {
    if (!data || data.leaderboard.length === 0) return;
    const top3 = data.leaderboard.slice(0, 3);
    const lines = top3.map(l => `${l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : "🥉"} ${l.participant_name} — ${l.total_score}/${data.quiz.total_marks} (${formatTime(l.time_taken_seconds)})`);
    const msg = encodeURIComponent(`🏆 Quiz results — *${data.quiz.title}*\n\n${lines.join("\n")}\n\nTotal participants: ${data.total_participants}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="sf-pro min-h-[100dvh] w-full text-[15px] text-[#1d1d1f] relative bg-[#F5F5F7]">
      <style>{customStyles}</style>

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#E3F2FF]/60 to-transparent pointer-events-none" />

      <main className="relative z-10 max-w-[840px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <header className="flex items-center gap-3 mb-8 anim-in">
          <button onClick={() => navigate("/teacher/community-quizzes")} className="ap-btn-secondary w-9 h-9 rounded-full flex items-center justify-center">
            <Icons.ArrowLeft />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-[#86868b] font-medium uppercase tracking-wider">Leaderboard</p>
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.02em] leading-tight truncate">
              {data?.quiz.title || "Loading..."}
            </h1>
          </div>
          <button onClick={load} className="ap-btn-secondary w-9 h-9 rounded-full flex items-center justify-center" title="Refresh">
            <Icons.Refresh />
          </button>
        </header>

        {loading && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-in">
            <div className="w-10 h-10 mx-auto mb-3 text-[#007AFF]"><Icons.Loader /></div>
            <p className="text-[14px] text-[#86868b]">Loading leaderboard…</p>
          </div>
        )}

        {!loading && error && (
          <div className="ap-panel rounded-[16px] p-10 text-center anim-in">
            <p className="text-[15px] font-semibold text-[#FF3B30] mb-1">Couldn't load</p>
            <p className="text-[13px] text-[#86868b]">{error}</p>
          </div>
        )}

        {!loading && !error && data && data.leaderboard.length === 0 && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[rgba(120,120,128,0.1)] text-[#86868b] flex items-center justify-center">
              <Icons.Users />
            </div>
            <p className="text-[16px] font-semibold mb-1">No submissions yet</p>
            <p className="text-[13px] text-[#86868b]">Once participants complete the quiz, they'll show up here.</p>
          </div>
        )}

        {!loading && !error && data && data.leaderboard.length > 0 && (
          <div className="space-y-4 anim-in">

            <div className="ap-panel rounded-[16px] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Participants</p>
                  <p className="text-[28px] font-semibold tabular-nums leading-none mt-1">{data.total_participants}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Total marks</p>
                  <p className="text-[28px] font-semibold tabular-nums leading-none mt-1">{data.quiz.total_marks}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Top score</p>
                  <p className="text-[28px] font-semibold tabular-nums leading-none mt-1 text-[#34C759]">
                    {data.leaderboard[0]?.total_score || 0}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={shareWinners} className="ap-btn-secondary px-3 h-9 rounded-[8px] text-[13px] flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
                  <Icons.Whatsapp /> Share top 3
                </button>
                <button onClick={exportCSV} className="ap-btn-primary px-3 h-9 rounded-[8px] text-[13px] flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
                  <Icons.Download /> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.leaderboard.slice(0, 3).map((p) => (
                <div key={p.attempt_id} className="ap-panel rounded-[14px] p-4 text-center relative">
                  <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-white text-[14px] font-bold ${p.rank === 1 ? "bg-[#FFD700]" : p.rank === 2 ? "bg-[#C0C0C0]" : "bg-[#CD7F32]"}`}>
                    {p.rank}
                  </div>
                  <p className="text-[15px] font-semibold mt-2 truncate">{p.participant_name}</p>
                  <p className="text-[24px] font-semibold tabular-nums text-[#007AFF] my-1">
                    {p.total_score}<span className="text-[14px] text-[#86868b] font-normal">/{data.quiz.total_marks}</span>
                  </p>
                  <p className="text-[11px] text-[#86868b]">{formatTime(p.time_taken_seconds)}</p>
                </div>
              ))}
            </div>

            <div className="ap-panel rounded-[14px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[rgba(120,120,128,0.06)] text-[#86868b]">
                      <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Rank</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Name</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">Phone</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Score</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Time</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] hidden md:table-cell">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((p) => (
                      <tr key={p.attempt_id} className="border-t-[0.5px] border-black/[0.06] hover:bg-black/[0.02]">
                        <td className="px-3 py-2.5 font-semibold tabular-nums">{p.rank}</td>
                        <td className="px-3 py-2.5">{p.participant_name}</td>
                        <td className="px-3 py-2.5 text-[#86868b] tabular-nums hidden sm:table-cell">{p.participant_phone}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {p.total_score}<span className="text-[#a1a1a6] font-normal">/{data.quiz.total_marks}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#86868b]">{formatTime(p.time_taken_seconds)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-[#86868b] hidden md:table-cell">{formatDate(p.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}