// src/pages/teacher/MyCommunityQuizzesPage.tsx
// ──────────────────────────────────────────────────────────
// List of all community quizzes created by the teacher.
// Click → leaderboard. Trash → delete with confirmation.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { listMyQuizzes, deleteQuiz, type QuizListItem } from "@/lib/communityQuizApi";

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  .sf-pro { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  .anim-in { animation: fadeIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards; opacity: 0; }
  .anim-pop { animation: scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
  .ap-panel { background: rgba(255,255,255,0.72); backdrop-filter: saturate(180%) blur(20px); border: 0.5px solid rgba(0,0,0,0.06); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04); }
  .ap-card-hover { transition: all 0.2s cubic-bezier(0.32,0.72,0,1); }
  .ap-card-hover:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07); }
  .ap-btn-primary { background: #007AFF; color: white; font-weight: 600; transition: all 0.15s ease; }
  .ap-btn-primary:hover { background: #0066D9; }
  .ap-btn-secondary { background: rgba(120,120,128,0.12); color: #1d1d1f; font-weight: 500; transition: all 0.15s ease; }
  .ap-btn-secondary:hover { background: rgba(120,120,128,0.2); }
`;

const Icons = {
  ArrowLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Trophy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Link: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Loader: ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Sparkle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5z"/></svg>,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function timeUntilEnd(endsAt: string): { label: string; ended: boolean } {
  try {
    const ends = new Date(endsAt).getTime();
    const now = Date.now();
    const diff = ends - now;
    if (diff <= 0) return { label: "Ended", ended: true };
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return { label: `${hrs}h left`, ended: false };
    const days = Math.floor(hrs / 24);
    return { label: `${days}d left`, ended: false };
  } catch { return { label: "—", ended: false }; }
}

export default function MyCommunityQuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<QuizListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listMyQuizzes();
      setQuizzes(res.quizzes || []);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't load quizzes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteQuiz(confirmDelete.id);
      setQuizzes(prev => prev.filter(q => q.id !== confirmDelete.id));
      toast.success("Quiz deleted");
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't delete");
    } finally {
      setDeleting(false);
    }
  }

  function copyShareLink(slug: string) {
    const url = `${window.location.origin}/q/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <div className="sf-pro min-h-[100dvh] w-full text-[15px] text-[#1d1d1f] relative bg-[#F5F5F7]">
      <style>{customStyles}</style>

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#E3F2FF]/60 to-transparent pointer-events-none" />

      <main className="relative z-10 max-w-[840px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <header className="flex items-center gap-3 mb-8 anim-in">
          <button onClick={() => navigate("/teacher/dashboard")} className="ap-btn-secondary w-9 h-9 rounded-full flex items-center justify-center">
            <Icons.ArrowLeft />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-[#86868b] font-medium uppercase tracking-wider">Community quiz</p>
            <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-tight">My quizzes</h1>
          </div>
          <button onClick={() => navigate("/teacher/community-quiz/new")} className="ap-btn-primary px-3 sm:px-4 h-9 rounded-[10px] text-[13px] flex items-center gap-1.5 shrink-0">
            <Icons.Plus /> <span className="hidden sm:inline">New quiz</span>
          </button>
        </header>

        {loading && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-in">
            <div className="inline-block text-[#007AFF] mb-3"><Icons.Loader /></div>
            <p className="text-[14px] text-[#86868b]">Loading your quizzes…</p>
          </div>
        )}

        {!loading && quizzes.length === 0 && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
              <Icons.Sparkle />
            </div>
            <p className="text-[16px] font-semibold mb-1">No quizzes yet</p>
            <p className="text-[13px] text-[#86868b] mb-5">Create your first community quiz to share with your audience.</p>
            <button onClick={() => navigate("/teacher/community-quiz/new")} className="ap-btn-primary px-4 h-10 rounded-[10px] text-[14px] inline-flex items-center gap-1.5">
              <Icons.Plus /> Create quiz
            </button>
          </div>
        )}

        {!loading && quizzes.length > 0 && (
          <div className="space-y-2 anim-in">
            <p className="text-[13px] text-[#86868b] mb-3">{quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}</p>

            {quizzes.map((q) => {
              const timer = timeUntilEnd(q.ends_at);
              return (
                <div key={q.id} className="ap-panel ap-card-hover rounded-[14px] p-4 flex items-center gap-3 sm:gap-4">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/teacher/community-quiz/${q.id}/leaderboard`)}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-[15px] font-semibold truncate">{q.title}</h3>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 h-5 rounded-[4px] flex items-center shrink-0 ${
                        timer.ended ? "bg-[rgba(120,120,128,0.15)] text-[#6e6e73]" : "bg-[#34C759]/15 text-[#1A8B3F]"
                      }`}>
                        {timer.ended ? "Ended" : "Live"}
                      </span>
                      {q.source_type === "manual" && (
                        <span className="text-[10px] font-medium text-[#007AFF] bg-[#007AFF]/10 px-1.5 h-5 rounded-[4px] flex items-center shrink-0">Manual</span>
                      )}
                      {q.source_type === "video" && (
                        <span className="text-[10px] font-medium text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 h-5 rounded-[4px] flex items-center shrink-0">Video</span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#86868b] truncate">
                      {q.subject} · {q.total_questions}Q · {q.total_attempts || 0} {(q.total_attempts || 0) === 1 ? "attempt" : "attempts"} · {timer.label} · {formatDate(q.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copyShareLink(q.share_slug)}
                      className="ap-btn-secondary w-9 h-9 rounded-[10px] flex items-center justify-center"
                      title="Copy share link"
                    >
                      <Icons.Link />
                    </button>
                    <button
                      onClick={() => navigate(`/teacher/community-quiz/${q.id}/leaderboard`)}
                      className="ap-btn-secondary w-9 h-9 rounded-[10px] flex items-center justify-center"
                      title="View leaderboard"
                    >
                      <Icons.Trophy />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(q)}
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors"
                      title="Delete"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/30 backdrop-blur-sm anim-pop">
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
                <Icons.Trash />
              </div>
              <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-center mb-2">Delete this quiz?</h3>
              <p className="text-[13px] text-[#86868b] text-center leading-snug mb-1">
                <span className="font-medium text-[#1d1d1f]">"{confirmDelete.title}"</span>
              </p>
              <p className="text-[12px] text-[#86868b] text-center leading-snug">
                {(confirmDelete.total_attempts || 0) > 0
                  ? `This will permanently delete the quiz and all ${confirmDelete.total_attempts} participant attempt${confirmDelete.total_attempts !== 1 ? "s" : ""}. This cannot be undone.`
                  : "This action cannot be undone."}
              </p>
            </div>
            <div className="flex border-t-[0.5px] border-black/[0.08]">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 h-12 text-[15px] font-medium text-[#007AFF] hover:bg-black/[0.03] transition-colors"
              >
                Cancel
              </button>
              <div className="w-px bg-black/[0.08]" />
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-12 text-[15px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/5 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <><Icons.Loader size={14} /> Deleting…</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}