// src/pages/CommunityQuizPlayPage.tsx
// ──────────────────────────────────────────────────────────
// Public participant page — Apple-grade refinement
// Same SF Pro typography + clean palette as CreatePage
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getPublicQuiz,
  startAttempt,
  submitAttempt,
  type PublicQuizInfo,
  type PublicQuizQuestion,
  type SubmitAnswer,
  type SubmitResponse,
  ApiError,
} from "@/lib/communityQuizApi";

/* ------------------- STYLES ------------------- */
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .sf-pro {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'kern', 'ss01', 'cv01';
    text-rendering: optimizeLegibility;
  }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulseRed { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); } 50% { box-shadow: 0 0 0 6px rgba(255, 59, 48, 0); } }
  .anim-in { animation: fadeIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards; opacity: 0; }
  .anim-pop { animation: scaleIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
  .timer-warning { animation: pulseRed 1.5s infinite; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 10px; }

  .ap-panel {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 0.5px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04);
  }
  .dark .ap-panel {
    background: rgba(28, 28, 30, 0.72);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
  }

  .ap-input {
    background: rgba(255, 255, 255, 0.6);
    border: 0.5px solid rgba(0, 0, 0, 0.08);
    transition: all 0.15s ease;
  }
  .ap-input:focus {
    background: rgba(255, 255, 255, 1);
    border-color: rgba(0, 122, 255, 0.5);
    box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
    outline: none;
  }

  .ap-btn-primary {
    background: #007AFF;
    color: white;
    font-weight: 600;
    transition: all 0.15s ease;
  }
  .ap-btn-primary:hover { background: #0066D9; }
  .ap-btn-primary:active { background: #0058BD; transform: scale(0.985); }
  .ap-btn-primary:disabled { background: #B5D4FF; cursor: not-allowed; }

  .ap-btn-secondary {
    background: rgba(120, 120, 128, 0.12);
    color: #1d1d1f;
    font-weight: 500;
    transition: all 0.15s ease;
  }
  .ap-btn-secondary:hover { background: rgba(120, 120, 128, 0.2); }
  .ap-btn-secondary:active { transform: scale(0.985); }

  .ap-btn-success {
    background: #34C759;
    color: white;
    font-weight: 600;
    transition: all 0.15s ease;
  }
  .ap-btn-success:hover { background: #2BB350; }
  .ap-btn-success:active { transform: scale(0.985); }

  .opt-btn {
    background: rgba(255, 255, 255, 0.7);
    border: 0.5px solid rgba(0, 0, 0, 0.08);
    transition: all 0.15s ease;
    text-align: left;
  }
  .opt-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(0, 122, 255, 0.3);
  }
  .opt-btn.selected {
    background: rgba(0, 122, 255, 0.08);
    border-color: #007AFF;
    border-width: 1px;
  }
  .opt-btn.correct {
    background: rgba(52, 199, 89, 0.1);
    border-color: #34C759;
    border-width: 1px;
  }
  .opt-btn.wrong {
    background: rgba(255, 59, 48, 0.08);
    border-color: #FF3B30;
    border-width: 1px;
  }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  ArrowLeft: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  ArrowRight: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Check: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Loader: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Clock: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  FileText: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Trophy: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Whatsapp: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
};

/* ------------------- HELPERS ------------------- */
function formatTime(sec: number): string {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
const CLASSES = ["6", "7", "8", "9", "10", "11", "12"];

type ScreenState = "loading" | "landing" | "registering" | "quiz" | "submitting" | "result" | "ended" | "not_found";

interface AnswerState { selected: number | null; startedAt: number; }

/* ------------------- COMPONENT ------------------- */

export default function CommunityQuizPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<ScreenState>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [quiz, setQuiz] = useState<PublicQuizInfo | null>(null);

  // Registration
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pClass, setPClass] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Quiz state
  const [attemptId, setAttemptId] = useState<string>("");
  const [questions, setQuestions] = useState<PublicQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Result
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  /* Load quiz */
  useEffect(() => {
    if (!slug) { setScreen("not_found"); return; }
    (async () => {
      try {
        const data = await getPublicQuiz(slug);
        setQuiz(data);
        setScreen("landing");
      } catch (err: any) {
        if (err instanceof ApiError) {
          if (err.status === 404) setScreen("not_found");
          else if (err.status === 410) setScreen("ended");
          else { setErrorMsg(err.message); setScreen("not_found"); }
        } else { setErrorMsg("Couldn't load quiz"); setScreen("not_found"); }
      }
    })();
  }, [slug]);

  /* Timer */
  useEffect(() => {
    if (screen !== "quiz") return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, timeLeft]);

  /* Tab switch */
  useEffect(() => {
    if (screen !== "quiz") return;
    const onVisChange = () => {
      if (document.visibilityState === "hidden") setTabSwitchCount((c) => c + 1);
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [screen]);

  /* Prevent navigation */
  useEffect(() => {
    if (screen !== "quiz") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim()) { toast.error("Name required"); return; }
    if (!pPhone.trim()) { toast.error("Phone required"); return; }
    if (!acceptedTerms) { toast.error("Please accept the terms"); return; }
    if (!slug || !quiz) return;

    setRegistering(true);
    try {
      const data = await startAttempt(slug, {
        name: pName.trim(),
        phone: pPhone.trim(),
        email: pEmail.trim() || undefined,
        class_level: pClass || undefined,
      });
      setAttemptId(data.attempt_id);
      setQuestions(data.questions);
      setTimeLeft(data.quiz.duration_minutes * 60);
      const init: Record<string, AnswerState> = {};
      data.questions.forEach((q) => { init[q.id] = { selected: null, startedAt: Date.now() }; });
      setAnswers(init);
      setScreen("quiz");
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "already_attempted") {
        toast.error(err.message, { duration: 5000 });
      } else {
        toast.error(err?.message || "Couldn't start");
      }
    } finally {
      setRegistering(false);
    }
  }

  function selectOption(qid: string, idx: number) {
    setAnswers((prev) => {
      const e = prev[qid] || { selected: null, startedAt: Date.now() };
      return { ...prev, [qid]: { ...e, selected: idx } };
    });
  }
  function nextQ() { if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1); }
  function prevQ() { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); }
  function jumpTo(i: number) { if (i >= 0 && i < questions.length) setCurrentIdx(i); }

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!slug || !attemptId) return;
    setScreen("submitting");
    const subAnswers: SubmitAnswer[] = questions.map((q) => {
      const a = answers[q.id];
      const timeMs = a ? Date.now() - a.startedAt : 0;
      return { question_id: q.id, selected_option: a?.selected ?? null, time_taken_ms: timeMs };
    });
    try {
      const res = await submitAttempt(slug, { attempt_id: attemptId, answers: subAnswers, tab_switch_count: tabSwitchCount });
      setResult(res);
      setScreen("result");
      if (autoSubmit) toast.info("Time's up — auto-submitted");
      else toast.success("Submitted");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit");
      setScreen("quiz");
    }
  }, [slug, attemptId, questions, answers, tabSwitchCount]);

  const answeredCount = Object.values(answers).filter((a) => a.selected !== null).length;

  return (
    <div className="sf-pro min-h-[100dvh] w-full text-[15px] text-[#1d1d1f] bg-[#F5F5F7] relative">
      <style>{customStyles}</style>

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#E3F2FF]/60 to-transparent pointer-events-none" />

      <main className="relative z-10 max-w-[640px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ──── LOADING ──── */}
        {screen === "loading" && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-pop">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
              <Icons.Loader size={20} />
            </div>
            <p className="text-[14px] text-[#86868b]">Loading quiz…</p>
          </div>
        )}

        {/* ──── NOT FOUND ──── */}
        {screen === "not_found" && (
          <div className="ap-panel rounded-[16px] p-10 text-center anim-pop">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#FF3B30]/10 flex items-center justify-center text-[#FF3B30]">
              <Icons.X size={20} />
            </div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] mb-2">Quiz not found</h2>
            <p className="text-[14px] text-[#86868b] mb-6">{errorMsg || "This link is invalid or no longer available."}</p>
            <button onClick={() => navigate("/")} className="ap-btn-primary px-5 h-10 rounded-[10px] text-[14px]">Visit a4ai</button>
          </div>
        )}

        {/* ──── ENDED ──── */}
        {screen === "ended" && (
          <div className="ap-panel rounded-[16px] p-10 text-center anim-pop">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#FF9500]/15 flex items-center justify-center text-[#FF9500]">
              <Icons.Clock size={20} />
            </div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] mb-2">This quiz has ended</h2>
            <p className="text-[14px] text-[#86868b] mb-6">The submission window has closed. Better luck next time.</p>
            <button onClick={() => navigate("/")} className="ap-btn-primary px-5 h-10 rounded-[10px] text-[14px]">Discover a4ai</button>
          </div>
        )}

        {/* ──── LANDING ──── */}
        {screen === "landing" && quiz && (
          <div className="space-y-4 anim-pop">
            <div className="ap-panel rounded-[16px] p-7 sm:p-8 text-center">
              {quiz.creator_name && (
                <div className="inline-flex items-center gap-1.5 mb-5 px-3 h-7 rounded-full bg-[rgba(120,120,128,0.1)]">
                  {quiz.creator_logo_url ? (
                    <img src={quiz.creator_logo_url} alt="" className="w-4 h-4 rounded-full" />
                  ) : (
                    <Icons.Trophy size={12} />
                  )}
                  <span className="text-[12px] font-medium">by {quiz.creator_name}</span>
                </div>
              )}
              <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.02em] leading-[1.15] mb-3">
                {quiz.title}
              </h1>
              {quiz.description && (
                <p className="text-[15px] text-[#86868b] mb-6 max-w-md mx-auto leading-snug">{quiz.description}</p>
              )}

              {/* Stats — Apple style: minimal, refined */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mt-6">
                <div className="p-4 rounded-[12px] bg-[rgba(120,120,128,0.06)]">
                  <div className="text-[#86868b] mb-1.5 flex justify-center"><Icons.FileText size={14} /></div>
                  <p className="text-[24px] font-semibold tracking-[-0.01em] tabular-nums">{quiz.total_questions}</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Questions</p>
                </div>
                <div className="p-4 rounded-[12px] bg-[rgba(120,120,128,0.06)]">
                  <div className="text-[#86868b] mb-1.5 flex justify-center"><Icons.Clock size={14} /></div>
                  <p className="text-[24px] font-semibold tracking-[-0.01em] tabular-nums">{quiz.duration_minutes}</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Minutes</p>
                </div>
                <div className="p-4 rounded-[12px] bg-[rgba(120,120,128,0.06)]">
                  <div className="text-[#86868b] mb-1.5 flex justify-center"><Icons.Trophy size={14} /></div>
                  <p className="text-[24px] font-semibold tracking-[-0.01em] tabular-nums">{quiz.total_marks}</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Marks</p>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="ap-panel rounded-[16px] p-5">
              <h3 className="text-[15px] font-semibold mb-3">How it works</h3>
              <ul className="space-y-2">
                {[
                  "One attempt per phone number",
                  `${quiz.duration_minutes} minute timer — auto-submits when time's up`,
                  "Ranked by score, then by time taken",
                  "No going back after you submit",
                ].map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-[#3a3a3c]">
                    <div className="w-4 h-4 rounded-full bg-[#34C759]/15 text-[#34C759] flex items-center justify-center shrink-0 mt-0.5">
                      <Icons.Check size={9} />
                    </div>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setScreen("registering")}
              className="ap-btn-primary w-full h-12 rounded-[12px] text-[16px] flex items-center justify-center gap-1.5"
            >
              Start quiz<Icons.ArrowRight />
            </button>
          </div>
        )}

        {/* ──── REGISTRATION ──── */}
        {screen === "registering" && quiz && (
          <div className="space-y-4 anim-pop">
            <div className="ap-panel rounded-[14px] p-3 flex items-center gap-3">
              <button onClick={() => setScreen("landing")} className="ap-btn-secondary w-8 h-8 rounded-full flex items-center justify-center">
                <Icons.ArrowLeft />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate">{quiz.title}</p>
                <p className="text-[12px] text-[#86868b]">Enter your details to begin</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="ap-panel rounded-[16px] p-6 space-y-4">
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Your details</h2>
                <p className="text-[12px] text-[#86868b] mt-1">Phone is needed to contact winners.</p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Full name</label>
                <input type="text" required value={pName} onChange={(e) => setPName(e.target.value)} maxLength={100} placeholder="Your name" className="ap-input w-full px-3.5 h-10 rounded-[8px] text-[14px]" />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Phone</label>
                <input type="tel" required value={pPhone} onChange={(e) => setPPhone(e.target.value)} maxLength={20} placeholder="+91 98765 43210" className="ap-input w-full px-3.5 h-10 rounded-[8px] text-[14px]" />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Email <span className="text-[#a1a1a6] font-normal">(optional)</span></label>
                <input type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="you@example.com" className="ap-input w-full px-3.5 h-10 rounded-[8px] text-[14px]" />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Class <span className="text-[#a1a1a6] font-normal">(optional)</span></label>
                <select value={pClass} onChange={(e) => setPClass(e.target.value)} className="ap-input w-full px-3 h-10 rounded-[8px] text-[14px]">
                  <option value="">Select</option>
                  {CLASSES.map((c) => (<option key={c} value={c}>Class {c}</option>))}
                </select>
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#007AFF] cursor-pointer shrink-0" />
                <span className="text-[12px] text-[#3a3a3c] leading-snug">
                  I agree to the rules. The creator may use my contact info to share results or prizes.
                </span>
              </label>

              <button type="submit" disabled={registering || !acceptedTerms} className="ap-btn-primary w-full h-11 rounded-[10px] text-[15px] flex items-center justify-center gap-1.5">
                {registering ? (<><Icons.Loader />Starting…</>) : (<>Start now<Icons.ArrowRight /></>)}
              </button>
            </form>
          </div>
        )}

        {/* ──── QUIZ ──── */}
        {screen === "quiz" && questions.length > 0 && (
          <div className="space-y-3 anim-pop">
            {/* Top bar — sticky, refined */}
            <div className="ap-panel rounded-[12px] px-3 py-2.5 flex items-center gap-3 sticky top-2 z-20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#86868b]">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  <span className="text-[11px] text-[#86868b]">
                    {answeredCount} answered
                  </span>
                </div>
                <div className="h-1 bg-[rgba(120,120,128,0.15)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#007AFF] rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
                </div>
              </div>
              <div className={`px-2.5 h-7 rounded-[6px] flex items-center gap-1 shrink-0 ${
                timeLeft < 60 ? "bg-[#FF3B30]/10 timer-warning" :
                timeLeft < 180 ? "bg-[#FF9500]/15" :
                "bg-[rgba(120,120,128,0.1)]"
              }`}>
                <Icons.Clock size={12} />
                <span className={`text-[13px] font-semibold tabular-nums ${
                  timeLeft < 60 ? "text-[#FF3B30]" :
                  timeLeft < 180 ? "text-[#FF9500]" :
                  "text-[#1d1d1f]"
                }`}>{formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* Question */}
            <div key={currentIdx} className="ap-panel rounded-[16px] p-6 anim-pop">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#007AFF]">
                  Q{currentIdx + 1}
                </span>
                <span className="text-[11px] text-[#86868b]">·</span>
                <span className="text-[11px] text-[#86868b]">
                  {questions[currentIdx].marks} {questions[currentIdx].marks > 1 ? "marks" : "mark"}
                </span>
              </div>
              <h2 className="text-[18px] font-semibold tracking-[-0.005em] leading-snug mb-5">
                {questions[currentIdx].question_text}
              </h2>

              <div className="space-y-2">
                {questions[currentIdx].options.map((opt, idx) => {
                  const selected = answers[questions[currentIdx].id]?.selected === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectOption(questions[currentIdx].id, idx)}
                      className={`opt-btn w-full px-4 py-3.5 rounded-[10px] text-[14px] flex items-center gap-3 ${selected ? "selected" : ""}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[12px] shrink-0 ${selected ? "bg-[#007AFF] text-white" : "bg-[rgba(120,120,128,0.15)] text-[#86868b]"}`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="flex-1 text-left">{opt}</span>
                      {selected && <div className="text-[#007AFF] shrink-0"><Icons.Check size={14} /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button onClick={prevQ} disabled={currentIdx === 0} className="ap-btn-secondary px-4 h-11 rounded-[10px] text-[14px] flex items-center gap-1.5 disabled:opacity-40">
                <Icons.ArrowLeft /><span className="hidden sm:inline">Previous</span>
              </button>
              {currentIdx < questions.length - 1 ? (
                <button onClick={nextQ} className="ap-btn-primary flex-1 h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5">
                  Next<Icons.ArrowRight />
                </button>
              ) : (
                <button onClick={() => handleSubmit(false)} className="ap-btn-success flex-1 h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5">
                  <Icons.Check size={14} />Submit quiz
                </button>
              )}
            </div>

            {/* Question grid */}
            <div className="ap-panel rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-[#86868b] mb-2.5">Quick navigation</p>
              <div className="flex flex-wrap gap-1.5">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id]?.selected !== null && answers[q.id]?.selected !== undefined;
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={q.id}
                      onClick={() => jumpTo(idx)}
                      className={`w-8 h-8 rounded-[8px] text-[12px] font-semibold transition-all ${
                        isCurrent ? "bg-[#007AFF] text-white" :
                        isAnswered ? "bg-[#34C759]/15 text-[#34C759]" :
                        "bg-[rgba(120,120,128,0.1)] text-[#86868b]"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ──── SUBMITTING ──── */}
        {screen === "submitting" && (
          <div className="ap-panel rounded-[16px] p-12 text-center anim-pop">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
              <Icons.Loader size={20} />
            </div>
            <p className="text-[14px] text-[#86868b]">Calculating your score…</p>
          </div>
        )}

        {/* ──── RESULT ──── */}
        {screen === "result" && result && quiz && (
          <div className="space-y-4 anim-pop">
            <div className="ap-panel rounded-[16px] p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#34C759]/15 flex items-center justify-center text-[#34C759]">
                <Icons.Check size={20} />
              </div>
              <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wider mb-2">Your score</p>
              <h1 className="text-[56px] sm:text-[64px] font-semibold tracking-[-0.03em] tabular-nums leading-none">
                {result.total_score}
                <span className="text-[28px] text-[#a1a1a6] font-normal">/{result.total_marks}</span>
              </h1>
              <p className="text-[14px] text-[#86868b] mt-3">
                {result.correct_count} of {result.total_questions} correct · {formatTime(result.time_taken_seconds)}
              </p>

              {result.show_leaderboard && result.rank !== null && (
                <div className="inline-flex items-center gap-1.5 mt-5 px-3 h-8 rounded-full bg-[#007AFF]/10 text-[#007AFF]">
                  <Icons.Trophy size={13} />
                  <span className="text-[13px] font-semibold">
                    Rank #{result.rank} of {result.total_participants}
                  </span>
                </div>
              )}
            </div>

            {/* Reveal-mode message */}
            {!result.show_leaderboard && (
              <div className="ap-panel rounded-[14px] p-5 text-center bg-[#FF9500]/8">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#FF9500]/15 flex items-center justify-center text-[#FF9500]">
                  <Icons.Clock size={16} />
                </div>
                <p className="text-[14px] font-semibold text-[#1d1d1f] mb-1">
                  {result.leaderboard_reveal_mode === "after_end"
                    ? "Leaderboard reveals when quiz ends"
                    : "Results will be shared later"}
                </p>
                <p className="text-[12px] text-[#86868b]">
                  {result.leaderboard_reveal_mode === "after_end" && result.quiz_ends_at
                    ? `Check back after ${new Date(result.quiz_ends_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                    : `${quiz.creator_name || "The creator"} will share results with you`}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {result.answers_review && result.answers_review.length > 0 && (
                <button onClick={() => setReviewMode(!reviewMode)} className="ap-btn-secondary h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5">
                  <Icons.FileText />{reviewMode ? "Hide" : "View"} answers
                </button>
              )}
              <button
                onClick={() => {
                  const text = encodeURIComponent(`I scored ${result.total_score}/${result.total_marks} on "${quiz.title}". Try it: ${window.location.href}`);
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}
                className="ap-btn-success h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5"
              >
                <Icons.Whatsapp />Share result
              </button>
            </div>

            <div className="ap-panel rounded-[14px] p-5 text-center">
              <p className="text-[14px] text-[#3a3a3c] mb-3">
                Want to create quizzes like this for your students?
              </p>
              <button onClick={() => navigate("/")} className="ap-btn-primary px-4 h-9 rounded-[8px] text-[13px]">
                Try a4ai free
              </button>
            </div>

            {/* Review section */}
            {reviewMode && result.answers_review && (
              <div className="space-y-3 anim-pop">
                {result.answers_review.map((rev, idx) => (
                  <div key={rev.question_id} className="ap-panel rounded-[14px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 h-5 rounded-[4px] flex items-center ${rev.is_correct ? "bg-[#34C759]/15 text-[#34C759]" : "bg-[#FF3B30]/10 text-[#FF3B30]"}`}>
                        Q{idx + 1} · {rev.is_correct ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                    <p className="text-[14px] font-semibold leading-snug mb-3">{rev.question_text}</p>
                    <div className="space-y-1.5">
                      {rev.options.map((opt, oi) => {
                        const isUserChoice = rev.selected_option === oi;
                        const isRight = rev.correct_option === oi;
                        let cls = "opt-btn";
                        if (isRight) cls = "opt-btn correct";
                        else if (isUserChoice && !isRight) cls = "opt-btn wrong";
                        return (
                          <div key={oi} className={`${cls} px-3 py-2 rounded-[8px] text-[13px] flex items-center gap-2`}>
                            <span className="font-semibold text-[10px] text-[#86868b]">{String.fromCharCode(65 + oi)}</span>
                            <span className="flex-1">{opt}</span>
                            {isRight && <Icons.Check size={12} />}
                            {isUserChoice && !isRight && <Icons.X size={12} />}
                          </div>
                        );
                      })}
                    </div>
                    {rev.explanation && (
                      <div className="mt-3 p-3 rounded-[8px] bg-[rgba(120,120,128,0.06)]">
                        <p className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider mb-1">Explanation</p>
                        <p className="text-[13px] text-[#3a3a3c] leading-snug">{rev.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}