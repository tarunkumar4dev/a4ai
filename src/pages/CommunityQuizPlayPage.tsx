// src/pages/CommunityQuizPlayPage.tsx
// ──────────────────────────────────────────────────────────
// PUBLIC participant page — accessed via share link a4ai.in/q/{slug}
//
// Flow:
//   1. Landing — quiz info, creator branding, name+phone form
//   2. Quiz — questions one-by-one with timer, navigation
//   3. Result — score, rank, optional review
//
// No auth required. One attempt per phone (DB-enforced).
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } }
  .animate-entrance { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  .animate-pop { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .timer-warning { animation: pulseGlow 1.5s infinite; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }

  .glass-panel { background: rgba(255,255,255,0.6); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255,255,255,1); box-shadow: 0 10px 40px -10px rgba(59,130,246,0.1), inset 0 1px 0 0 rgba(255,255,255,0.9); }
  .inset-pill { background: rgba(255,255,255,0.5); box-shadow: inset 4px 4px 10px rgba(59,130,246,0.05), inset -4px -4px 10px rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.8); }
  .btn-glossy-blue { background: linear-gradient(135deg,#38BDF8 0%,#2563EB 100%); box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), inset 0px -2px 4px rgba(0,0,0,0.15), 0px 8px 16px rgba(37,99,235,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; }
  .btn-glossy-blue:hover { background: linear-gradient(135deg,#0EA5E9 0%,#1D4ED8 100%); }
  .btn-glossy-blue:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
  .btn-glossy-light { background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); box-shadow: inset 0px 1px 2px rgba(255,255,255,1), 0px 4px 10px rgba(59,130,246,0.05); border: 1px solid rgba(255,255,255,1); color: #1E3A8A; }
  .btn-glossy-light:hover { background: rgba(255,255,255,1); color: #2563EB; }
  .btn-glossy-green { background: linear-gradient(135deg,#34D399 0%,#059669 100%); box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), 0px 8px 16px rgba(5,150,105,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; }
  .btn-glossy-green:hover { background: linear-gradient(135deg,#10B981 0%,#047857 100%); }
  .option-btn { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .option-btn:hover:not(:disabled) { transform: translateX(4px); }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Trophy: ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  GradCap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  Check: ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Loader: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  ArrowRight: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  ArrowLeft: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Whatsapp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
  Sparkles: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>,
};

/* ------------------- HELPERS ------------------- */

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const CLASSES = ["6", "7", "8", "9", "10", "11", "12", "Other"];

/* ------------------- TYPES ------------------- */

type ScreenState = "loading" | "landing" | "registering" | "quiz" | "submitting" | "result" | "ended" | "not_found";

interface AnswerState {
  selected: number | null;
  startedAt: number;  // ms
}

/* ------------------- MAIN ------------------- */

export default function CommunityQuizPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<ScreenState>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Quiz info (landing)
  const [quiz, setQuiz] = useState<PublicQuizInfo | null>(null);

  // Registration form
  const [participantName, setParticipantName] = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantClass, setParticipantClass] = useState("");
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

  /* ─── Load quiz info on mount ─── */
  useEffect(() => {
    if (!slug) {
      setScreen("not_found");
      return;
    }
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
        } else {
          setErrorMsg("Could not load quiz");
          setScreen("not_found");
        }
      }
    })();
  }, [slug]);

  /* ─── Timer ─── */
  useEffect(() => {
    if (screen !== "quiz") return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, timeLeft]);

  /* ─── Tab switch detection (light) ─── */
  useEffect(() => {
    if (screen !== "quiz") return;
    const onVisChange = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((c) => c + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [screen]);

  /* ─── Prevent accidental navigation away ─── */
  useEffect(() => {
    if (screen !== "quiz") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  /* ─── Register & start ─── */
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!participantName.trim()) { toast.error("Name is required"); return; }
    if (!participantPhone.trim()) { toast.error("Phone is required"); return; }
    if (!acceptedTerms) { toast.error("Please accept the terms to start"); return; }
    if (!slug || !quiz) return;

    setRegistering(true);
    try {
      const data = await startAttempt(slug, {
        name: participantName.trim(),
        phone: participantPhone.trim(),
        email: participantEmail.trim() || undefined,
        class_level: participantClass || undefined,
      });

      setAttemptId(data.attempt_id);
      setQuestions(data.questions);
      setTimeLeft(data.quiz.duration_minutes * 60);

      // Initialize answers map
      const initialAnswers: Record<string, AnswerState> = {};
      data.questions.forEach((q) => {
        initialAnswers[q.id] = { selected: null, startedAt: Date.now() };
      });
      setAnswers(initialAnswers);

      setScreen("quiz");
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "already_attempted") {
        toast.error(err.message, { duration: 5000 });
      } else {
        toast.error(err?.message || "Could not start quiz");
      }
    } finally {
      setRegistering(false);
    }
  }

  /* ─── Answering ─── */
  function selectOption(questionId: string, optionIdx: number) {
    setAnswers((prev) => {
      const existing = prev[questionId] || { selected: null, startedAt: Date.now() };
      return { ...prev, [questionId]: { ...existing, selected: optionIdx } };
    });
  }

  function nextQuestion() {
    if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
  }

  function prevQuestion() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  function jumpTo(idx: number) {
    if (idx >= 0 && idx < questions.length) setCurrentIdx(idx);
  }

  /* ─── Submit ─── */
  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!slug || !attemptId) return;
    setScreen("submitting");

    const submitAnswers: SubmitAnswer[] = questions.map((q) => {
      const a = answers[q.id];
      const timeMs = a ? Date.now() - a.startedAt : 0;
      return {
        question_id: q.id,
        selected_option: a?.selected ?? null,
        time_taken_ms: timeMs,
      };
    });

    try {
      const res = await submitAttempt(slug, {
        attempt_id: attemptId,
        answers: submitAnswers,
        tab_switch_count: tabSwitchCount,
      });
      setResult(res);
      setScreen("result");
      if (autoSubmit) toast.info("Time's up! Quiz auto-submitted.");
      else toast.success("Submitted!");
    } catch (err: any) {
      toast.error(err?.message || "Could not submit");
      setScreen("quiz");
    }
  }, [slug, attemptId, questions, answers, tabSwitchCount]);

  /* ─── Render ─── */

  return (
    <div className="min-h-[100dvh] w-full font-sans text-slate-800 relative bg-slate-100 overflow-x-hidden">
      <style>{customStyles}</style>

      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-sky-200/90 via-blue-100/40 to-transparent pointer-events-none z-0" />
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[40rem] sm:w-[60rem] h-[20rem] sm:h-[30rem] bg-sky-300/40 rounded-full filter blur-[100px] pointer-events-none z-0" />

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* ──── LOADING ──── */}
        {screen === "loading" && (
          <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-12 sm:p-16 text-center animate-pop">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full btn-glossy-blue flex items-center justify-center">
              <Icons.Loader size={32} />
            </div>
            <p className="text-base font-bold text-slate-700">Loading quiz...</p>
          </div>
        )}

        {/* ──── NOT FOUND / ERROR ──── */}
        {screen === "not_found" && (
          <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-10 sm:p-14 text-center animate-pop">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-red-100 flex items-center justify-center text-red-500">
              <Icons.X />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Quiz Not Found</h2>
            <p className="text-sm text-slate-600 mb-6">
              {errorMsg || "The link you opened is invalid or has been removed."}
            </p>
            <button onClick={() => navigate("/")} className="btn-glossy-blue px-6 py-3 rounded-[20px] font-bold text-sm">
              Go to a4ai.in
            </button>
          </div>
        )}

        {/* ──── ENDED ──── */}
        {screen === "ended" && (
          <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-10 sm:p-14 text-center animate-pop">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Icons.Clock />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Quiz Has Ended</h2>
            <p className="text-sm text-slate-600 mb-6">
              This quiz is no longer accepting attempts. Better luck next time!
            </p>
            <button onClick={() => navigate("/")} className="btn-glossy-blue px-6 py-3 rounded-[20px] font-bold text-sm">
              Discover a4ai
            </button>
          </div>
        )}

        {/* ──── LANDING ──── */}
        {screen === "landing" && quiz && (
          <div className="space-y-5 sm:space-y-6 animate-pop">
            {/* Hero */}
            <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-[48px]" />
              <div className="relative z-10">
                {quiz.creator_name && (
                  <div className="inline-flex items-center gap-2 mb-4 sm:mb-6 bg-white/50 border border-white/80 px-4 py-2 rounded-[20px] shadow-sm">
                    {quiz.creator_logo_url ? (
                      <img src={quiz.creator_logo_url} alt={quiz.creator_name} className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="text-blue-500"><Icons.Trophy size={16} /></div>
                    )}
                    <span className="text-xs sm:text-sm font-black text-blue-700">by {quiz.creator_name}</span>
                  </div>
                )}
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-3 sm:mb-4 tracking-tight leading-[1.1]">
                  {quiz.title}
                </h1>
                {quiz.description && (
                  <p className="text-sm sm:text-base text-slate-600 font-medium mb-5 sm:mb-6 max-w-md mx-auto">{quiz.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                  <div className="inset-pill border-none rounded-[20px] p-3 sm:p-4">
                    <Icons.FileText />
                    <p className="text-2xl font-black text-slate-900 mt-1">{quiz.total_questions}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Questions</p>
                  </div>
                  <div className="inset-pill border-none rounded-[20px] p-3 sm:p-4">
                    <Icons.Clock />
                    <p className="text-2xl font-black text-slate-900 mt-1">{quiz.duration_minutes}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Minutes</p>
                  </div>
                  <div className="inset-pill border-none rounded-[20px] p-3 sm:p-4">
                    <Icons.Trophy size={20} />
                    <p className="text-2xl font-black text-slate-900 mt-1">{quiz.total_marks}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Marks</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-5 sm:p-6">
              <h3 className="font-black text-base sm:text-lg text-slate-900 mb-3">Rules</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-600 font-medium">
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> One attempt per phone number</li>
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> {quiz.duration_minutes} min timer — auto-submit on timeout</li>
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> Top scorers ranked by score, then fastest time</li>
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> No going back after submit</li>
              </ul>
            </div>

            <button onClick={() => setScreen("registering")} className="btn-glossy-blue w-full px-5 py-4 rounded-[24px] font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
              <Icons.Sparkles /><span>Start Quiz</span><Icons.ArrowRight />
            </button>
          </div>
        )}

        {/* ──── REGISTRATION ──── */}
        {screen === "registering" && quiz && (
          <div className="space-y-5 sm:space-y-6 animate-pop">
            <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-4 flex items-center gap-3">
              <button onClick={() => setScreen("landing")} className="p-2 inset-pill border-none rounded-[14px] text-blue-600">
                <Icons.ArrowLeft />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm text-slate-900 truncate">{quiz.title}</p>
                <p className="text-xs text-slate-500">Enter your details to begin</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="glass-panel rounded-[28px] sm:rounded-[40px] p-6 sm:p-8 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">Your Details</h2>
              <p className="text-xs text-slate-500 mb-4">Phone is needed for winner contact</p>

              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">Full Name *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500"><Icons.User /></div>
                  <input type="text" required value={participantName} onChange={(e) => setParticipantName(e.target.value)} maxLength={100} placeholder="Tarun Kumar" className="w-full pl-12 pr-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 placeholder-slate-400" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">Phone Number *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500"><Icons.Phone /></div>
                  <input type="tel" required value={participantPhone} onChange={(e) => setParticipantPhone(e.target.value)} maxLength={20} placeholder="+91 98765 43210" className="w-full pl-12 pr-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 placeholder-slate-400" />
                </div>
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">Email <span className="text-slate-400 normal-case font-bold">(optional)</span></label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500"><Icons.Mail /></div>
                  <input type="email" value={participantEmail} onChange={(e) => setParticipantEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-12 pr-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 placeholder-slate-400" />
                </div>
              </div>

              {/* Class (optional) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">Class <span className="text-slate-400 normal-case font-bold">(optional)</span></label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500 z-10"><Icons.GradCap /></div>
                  <select value={participantClass} onChange={(e) => setParticipantClass(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800">
                    <option value="">— Select —</option>
                    {CLASSES.map((c) => (<option key={c} value={c}>Class {c}</option>))}
                  </select>
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 p-3 rounded-[16px] cursor-pointer hover:bg-white/40 transition-colors">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-xs text-slate-600 font-medium">
                  I agree to the rules. My contact info may be used by the quiz creator to share results or prizes.
                </span>
              </label>

              <button type="submit" disabled={registering || !acceptedTerms} className="btn-glossy-blue w-full px-5 py-4 rounded-[20px] sm:rounded-[24px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                {registering ? (<><Icons.Loader size={18} /> Starting...</>) : (<><Icons.Sparkles /> Start Quiz Now</>)}
              </button>
            </form>
          </div>
        )}

        {/* ──── QUIZ ──── */}
        {screen === "quiz" && questions.length > 0 && (
          <div className="space-y-4 sm:space-y-5 animate-pop">
            {/* Top bar: progress + timer */}
            <div className="glass-panel rounded-[20px] sm:rounded-[28px] p-3 sm:p-4 flex items-center gap-3 sticky top-2 sm:top-4 z-20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
                    Question {currentIdx + 1}/{questions.length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {Object.values(answers).filter((a) => a.selected !== null).length} answered
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
                </div>
              </div>
              <div className={`inset-pill border-none rounded-[16px] px-3 sm:px-4 py-2 flex items-center gap-1.5 shrink-0 ${timeLeft < 60 ? "timer-warning" : ""}`}>
                <Icons.Clock />
                <span className={`text-sm sm:text-base font-black tabular-nums ${timeLeft < 60 ? "text-red-600" : timeLeft < 180 ? "text-amber-600" : "text-slate-700"}`}>{formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* Question card */}
            <div key={currentIdx} className="glass-panel rounded-[28px] sm:rounded-[40px] p-6 sm:p-8 animate-pop">
              <div className="mb-5 sm:mb-6">
                <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-[12px] uppercase tracking-wider">
                  Q{currentIdx + 1} · {questions[currentIdx].marks} mark{questions[currentIdx].marks > 1 ? "s" : ""}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 leading-snug mb-5 sm:mb-7">
                {questions[currentIdx].question_text}
              </h2>

              <div className="space-y-2.5 sm:space-y-3">
                {questions[currentIdx].options.map((opt, idx) => {
                  const selected = answers[questions[currentIdx].id]?.selected === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectOption(questions[currentIdx].id, idx)}
                      className={`option-btn w-full text-left p-4 sm:p-5 rounded-[16px] sm:rounded-[20px] font-bold text-sm sm:text-base flex items-center gap-3 sm:gap-4 ${
                        selected
                          ? "btn-glossy-blue"
                          : "inset-pill border-none text-slate-700 hover:bg-white/80"
                      }`}
                    >
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs sm:text-sm shrink-0 ${selected ? "bg-white/30 text-white" : "bg-blue-50 text-blue-600"}`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="flex-1">{opt}</span>
                      {selected && <div className="text-white shrink-0"><Icons.Check size={16} /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={prevQuestion} disabled={currentIdx === 0} className="btn-glossy-light px-4 sm:px-5 py-3 rounded-[16px] sm:rounded-[20px] font-bold text-sm flex items-center gap-2 disabled:opacity-30">
                <Icons.ArrowLeft /><span className="hidden sm:inline">Previous</span>
              </button>

              {currentIdx < questions.length - 1 ? (
                <button onClick={nextQuestion} className="btn-glossy-blue flex-1 px-5 py-3 rounded-[16px] sm:rounded-[20px] font-bold text-sm flex items-center justify-center gap-2">
                  <span>Next</span><Icons.ArrowRight />
                </button>
              ) : (
                <button onClick={() => handleSubmit(false)} className="btn-glossy-green flex-1 px-5 py-3 rounded-[16px] sm:rounded-[20px] font-bold text-sm flex items-center justify-center gap-2">
                  <Icons.Send /><span>Submit Quiz</span>
                </button>
              )}
            </div>

            {/* Question grid (jump to any) */}
            <div className="glass-panel rounded-[20px] sm:rounded-[28px] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Quick Navigation</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id]?.selected !== null && answers[q.id]?.selected !== undefined;
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={q.id}
                      onClick={() => jumpTo(idx)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] font-black text-xs transition-all ${
                        isCurrent
                          ? "btn-glossy-blue scale-110"
                          : isAnswered
                          ? "bg-emerald-100 text-emerald-700 hover:scale-105"
                          : "inset-pill border-none text-slate-500 hover:scale-105"
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
          <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-12 sm:p-16 text-center animate-pop">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full btn-glossy-blue flex items-center justify-center">
              <Icons.Loader size={32} />
            </div>
            <p className="text-base font-bold text-slate-700">Calculating your score...</p>
          </div>
        )}

        {/* ──── RESULT ──── */}
        {screen === "result" && result && quiz && (
          <div className="space-y-5 sm:space-y-6 animate-pop">
            {/* Score hero */}
            <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-emerald-100/40 to-transparent pointer-events-none rounded-[48px]" />
              <div className="relative z-10">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-5 rounded-full btn-glossy-green flex items-center justify-center">
                  <div className="scale-150"><Icons.Check size={28} /></div>
                </div>
                <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 mb-2">Your Score</p>
                <h1 className="text-5xl sm:text-7xl font-black text-slate-900 mb-2 tabular-nums">
                  {result.total_score}<span className="text-2xl sm:text-3xl text-slate-400">/{result.total_marks}</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-600 font-bold mb-5 sm:mb-6">
                  {result.correct_count} of {result.total_questions} correct · {formatTime(result.time_taken_seconds)}
                </p>

                {result.rank !== null && (
                  <div className="inline-flex items-center gap-2 btn-glossy-blue px-5 py-2.5 rounded-[20px] mb-2">
                    <Icons.Trophy size={18} />
                    <span className="font-black text-sm sm:text-base">
                      Rank #{result.rank} of {result.total_participants}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.answers_review && result.answers_review.length > 0 && (
                <button onClick={() => setReviewMode(!reviewMode)} className="btn-glossy-light px-5 py-4 rounded-[20px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-1">
                  <Icons.FileText />
                  <span>{reviewMode ? "Hide" : "View"} Answers</span>
                </button>
              )}
              <button
                onClick={() => {
                  const text = encodeURIComponent(`I scored ${result.total_score}/${result.total_marks} on "${quiz.title}"! 🎉\n\nTry it: ${window.location.href}`);
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}
                className="btn-glossy-green px-5 py-4 rounded-[20px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-1"
              >
                <Icons.Whatsapp /><span>Share Result</span>
              </button>
            </div>

            {/* CTA */}
            <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 text-center">
              <p className="text-sm sm:text-base font-bold text-slate-700 mb-3">
                Want to make quizzes like this for your students?
              </p>
              <button onClick={() => navigate("/")} className="btn-glossy-blue px-5 py-3 rounded-[20px] font-bold text-sm inline-flex items-center gap-2">
                <Icons.Sparkles /> Try a4ai Free
              </button>
            </div>

            {/* Review section */}
            {reviewMode && result.answers_review && (
              <div className="space-y-3 animate-pop">
                {result.answers_review.map((rev, idx) => {
                  const isCorrect = rev.is_correct;
                  return (
                    <div key={rev.question_id} className="glass-panel rounded-[20px] sm:rounded-[28px] p-5 sm:p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-[12px] uppercase tracking-wider ${isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          Q{idx + 1} · {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                      <p className="font-black text-sm sm:text-base text-slate-900 mb-3">{rev.question_text}</p>
                      <div className="space-y-1.5">
                        {rev.options.map((opt, optIdx) => {
                          const isUserChoice = rev.selected_option === optIdx;
                          const isRight = rev.correct_option === optIdx;
                          let cls = "border border-slate-200/50 bg-white/40 text-slate-700";
                          if (isRight) cls = "bg-emerald-100 border-emerald-300 text-emerald-900 font-bold";
                          else if (isUserChoice && !isRight) cls = "bg-red-100 border-red-300 text-red-900 font-bold";
                          return (
                            <div key={optIdx} className={`p-2.5 rounded-[12px] text-xs sm:text-sm flex items-center gap-2 ${cls}`}>
                              <span className="font-black text-[10px]">{String.fromCharCode(65 + optIdx)}.</span>
                              <span className="flex-1">{opt}</span>
                              {isRight && <Icons.Check size={14} />}
                              {isUserChoice && !isRight && <Icons.X />}
                            </div>
                          );
                        })}
                      </div>
                      {rev.explanation && (
                        <div className="mt-3 p-3 inset-pill border-none rounded-[14px]">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Explanation</p>
                          <p className="text-xs sm:text-sm text-slate-700 font-medium">{rev.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}