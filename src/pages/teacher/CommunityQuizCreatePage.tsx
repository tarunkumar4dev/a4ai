// src/pages/teacher/CommunityQuizCreatePage.tsx
// ──────────────────────────────────────────────────────────
// Community Quiz Create Wizard — v2 (with draft persistence)
//
// Changes from v1:
//   ✅ localStorage auto-save on every change
//   ✅ "Resume Draft" banner if saved data exists on mount
//   ✅ Clears draft on successful publish
//
// Steps:
//   1. URL paste → preview
//   2. Configure (count, difficulty, duration)
//   3. Generating (60-90s)
//   4. Success — share link + WhatsApp
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import {
  previewVideo,
  createQuiz,
  type VideoPreview,
} from "@/lib/communityQuizApi";

/* ------------------- STYLES ------------------- */
const customStyles = `
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .animate-entrance { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  .animate-pop { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
  .glass-panel { background: rgba(255,255,255,0.6); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255,255,255,1); box-shadow: 0 10px 40px -10px rgba(59,130,246,0.1), inset 0 1px 0 0 rgba(255,255,255,0.9); }
  .dark .glass-panel { background: rgba(30,41,59,0.55); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05); }
  .inset-pill { background: rgba(255,255,255,0.5); box-shadow: inset 4px 4px 10px rgba(59,130,246,0.05), inset -4px -4px 10px rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.8); }
  .dark .inset-pill { background: rgba(15,23,42,0.6); box-shadow: inset 4px 4px 10px rgba(0,0,0,0.4), inset -4px -4px 10px rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); }
  .btn-glossy-blue { background: linear-gradient(135deg,#38BDF8 0%,#2563EB 100%); box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), inset 0px -2px 4px rgba(0,0,0,0.15), 0px 8px 16px rgba(37,99,235,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; }
  .btn-glossy-blue:hover { background: linear-gradient(135deg,#0EA5E9 0%,#1D4ED8 100%); }
  .btn-glossy-blue:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
  .btn-glossy-light { background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); box-shadow: inset 0px 1px 2px rgba(255,255,255,1), 0px 4px 10px rgba(59,130,246,0.05); border: 1px solid rgba(255,255,255,1); color: #1E3A8A; }
  .dark .btn-glossy-light { background: rgba(30,41,59,0.6); box-shadow: inset 0px 1px 2px rgba(255,255,255,0.1), 0px 4px 10px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #BAE6FD; }
  .btn-glossy-light:hover { background: rgba(255,255,255,1); color: #2563EB; }
  .btn-glossy-green { background: linear-gradient(135deg,#34D399 0%,#059669 100%); box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), 0px 8px 16px rgba(5,150,105,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; }
  .btn-glossy-green:hover { background: linear-gradient(135deg,#10B981 0%,#047857 100%); }
  .btn-glossy-amber { background: linear-gradient(135deg,#FBBF24 0%,#D97706 100%); box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), 0px 8px 16px rgba(217,119,6,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; }
  .shimmer-bg { background: linear-gradient(90deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.15) 50%, rgba(59,130,246,0.05) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  ArrowLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  ArrowRight: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Youtube: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>,
  Sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>,
  Check: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Loader: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Whatsapp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  Link: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Refresh: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
};

/* ------------------- HELPERS ------------------- */

const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","Science","English","Hindi","Social Science","History","Geography","Civics","Economics","Computer Science","Accountancy","Business Studies","General Knowledge","Other"];
const CLASSES = ["6","7","8","9","10","11","12","Other"];
const DRAFT_KEY = "a4ai_community_quiz_draft_v1";

function isYoutubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url.trim());
}

interface DraftState {
  step: Step;
  videoUrl: string;
  preview: VideoPreview | null;
  title: string;
  subject: string;
  classLevel: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  focus: "conceptual" | "factual" | "mixed";
  durationMinutes: number;
  windowDays: number;
  creatorName: string;
  savedAt: string;
}

type Step = "url" | "config" | "generating" | "success";

/* ------------------- MAIN COMPONENT ------------------- */

export default function CommunityQuizCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";

  const [step, setStep] = useState<Step>("url");
  const [isDarkMode] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<VideoPreview | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Other");
  const [classLevel, setClassLevel] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [focus, setFocus] = useState<"conceptual" | "factual" | "mixed">("mixed");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [windowDays, setWindowDays] = useState(7);
  const [creatorName, setCreatorName] = useState(displayName || "");

  const [generationStartTs, setGenerationStartTs] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const [createdQuiz, setCreatedQuiz] = useState<{
    quiz_id: string;
    share_slug: string;
    share_link: string;
    total_questions: number;
    generation_seconds: number;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Draft restoration UI
  const [draftAvailable, setDraftAvailable] = useState<DraftState | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const draftLoadedRef = useRef(false);

  /* ─────────── Draft: detect on mount ─────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftState;
      // Only show banner if draft is meaningful (URL or preview present)
      if (parsed.videoUrl || parsed.preview) {
        setDraftAvailable(parsed);
        setShowDraftBanner(true);
      }
    } catch {
      // ignore corrupted draft
    }
  }, []);

  /* ─────────── Draft: auto-save on every relevant change ─────────── */
  useEffect(() => {
    // Don't save during/after generation (we don't want to restore mid-gen)
    if (step === "generating" || step === "success") return;
    // Don't save empty initial state
    if (!videoUrl && !preview && !title) return;

    const draft: DraftState = {
      step, videoUrl, preview, title, subject, classLevel,
      questionCount, difficulty, focus, durationMinutes, windowDays, creatorName,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // localStorage full / disabled — silent fail
    }
  }, [step, videoUrl, preview, title, subject, classLevel, questionCount, difficulty, focus, durationMinutes, windowDays, creatorName]);

  /* ─────────── Draft helpers ─────────── */

  function restoreDraft() {
    if (!draftAvailable) return;
    setStep(draftAvailable.step);
    setVideoUrl(draftAvailable.videoUrl);
    setPreview(draftAvailable.preview);
    setTitle(draftAvailable.title);
    setSubject(draftAvailable.subject);
    setClassLevel(draftAvailable.classLevel);
    setQuestionCount(draftAvailable.questionCount);
    setDifficulty(draftAvailable.difficulty);
    setFocus(draftAvailable.focus);
    setDurationMinutes(draftAvailable.durationMinutes);
    setWindowDays(draftAvailable.windowDays);
    setCreatorName(draftAvailable.creatorName);
    setShowDraftBanner(false);
    draftLoadedRef.current = true;
    toast.success("Draft restored ✨");
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    setDraftAvailable(null);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  /* ─────────── Elapsed timer during generation ─────────── */
  useEffect(() => {
    if (step !== "generating" || !generationStartTs) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - generationStartTs) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [step, generationStartTs]);

  /* ─────────── Step 1 ─────────── */

  async function handlePreview() {
    if (!videoUrl.trim()) { toast.error("Please paste a YouTube URL"); return; }
    if (!isYoutubeUrl(videoUrl)) { toast.error("That doesn't look like a YouTube URL"); return; }
    setPreviewLoading(true);
    try {
      const data = await previewVideo(videoUrl.trim());
      setPreview(data);
      if (!title) setTitle(`Quiz on: ${data.title}`.slice(0, 100));
      toast.success("Video loaded!");
    } catch (err: any) {
      toast.error(err?.message || "Could not fetch video");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleNextToConfig() {
    if (!preview) return;
    setStep("config");
  }

  /* ─────────── Step 2 → 3 → 4 ─────────── */

  async function handleGenerate() {
    if (!title.trim()) { toast.error("Quiz title is required"); return; }
    if (!preview) { toast.error("Video preview missing"); setStep("url"); return; }

    setStep("generating");
    setGenerationStartTs(Date.now());
    setElapsedSec(0);

    try {
      const resp = await createQuiz({
        title: title.trim(),
        subject,
        class_level: classLevel || undefined,
        source_type: "video",
        source_url: preview.url,
        duration_minutes: durationMinutes,
        duration_window_hours: windowDays * 24,
        question_count: questionCount,
        difficulty,
        focus,
        creator_name: creatorName.trim() || undefined,
        show_leaderboard_to_participants: false,
        show_correct_answers_after_submit: true,
      });

      setCreatedQuiz({
        quiz_id: resp.quiz_id,
        share_slug: resp.share_slug,
        share_link: resp.share_link,
        total_questions: resp.total_questions,
        generation_seconds: resp.generation_seconds,
      });
      setStep("success");
      clearDraft();  // ✅ published — draft no longer needed
      toast.success(`Quiz banaya! ${resp.total_questions} questions in ${resp.generation_seconds}s`);
    } catch (err: any) {
      toast.error(err?.message || "Could not generate quiz");
      setStep("config");
    }
  }

  /* ─────────── Step 4 helpers ─────────── */

  function copyLink() {
    if (!createdQuiz) return;
    navigator.clipboard.writeText(createdQuiz.share_link);
    setLinkCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function shareWhatsapp() {
    if (!createdQuiz) return;
    const msg = encodeURIComponent(
      `🎯 Take my quiz on YouTube video!\n\n${title}\n\n${createdQuiz.share_link}\n\nTop 3 winners get a prize 🏆`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function viewLeaderboard() {
    if (!createdQuiz) return;
    navigate(`/teacher/community-quiz/${createdQuiz.quiz_id}/leaderboard`);
  }

  function createAnother() {
    setStep("url");
    setVideoUrl("");
    setPreview(null);
    setTitle("");
    setCreatedQuiz(null);
    clearDraft();
  }

  const stepNumber = { url: 1, config: 2, generating: 3, success: 4 }[step];
  const stepLabels = ["Video", "Configure", "Generate", "Share"];

  /* ─────────── Format draft age ─────────── */
  function formatAgo(isoString: string): string {
    try {
      const ms = Date.now() - new Date(isoString).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 1) return "just now";
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      return `${Math.floor(hr / 24)}d ago`;
    } catch { return ""; }
  }

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-[100dvh] w-full font-sans text-slate-800 dark:text-slate-100 relative bg-slate-100 dark:bg-slate-900 transition-colors duration-500 overflow-x-hidden">
        <style>{customStyles}</style>

        <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-sky-200/90 via-blue-100/40 to-transparent dark:from-blue-900/60 dark:via-blue-900/20 pointer-events-none z-0" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[40rem] sm:w-[60rem] h-[20rem] sm:h-[30rem] bg-sky-300/40 dark:bg-blue-800/40 rounded-full filter blur-[100px] pointer-events-none z-0" />

        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

          {/* ─── Header ─── */}
          <header className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8 animate-entrance">
            <button onClick={() => navigate(-1)} className="p-2.5 sm:p-3 text-blue-600 inset-pill rounded-[20px] sm:rounded-[24px] border-none shrink-0 hover:scale-105 transition-transform">
              <Icons.ArrowLeft />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Create Community Quiz</h1>
              <p className="text-slate-600 dark:text-blue-200/70 text-xs sm:text-sm mt-1 font-medium">YouTube video se quiz banao, share link generate karo</p>
            </div>
          </header>

          {/* ─── Resume Draft Banner ─── */}
          {showDraftBanner && draftAvailable && (
            <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-4 sm:p-5 mb-6 animate-pop border-2 border-amber-300/40">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[16px] btn-glossy-amber flex items-center justify-center shrink-0">
                  <Icons.Refresh />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white">Draft found</p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium truncate">
                    {draftAvailable.title || draftAvailable.preview?.title || "Untitled draft"}
                    <span className="text-slate-400 ml-2">· saved {formatAgo(draftAvailable.savedAt)}</span>
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={discardDraft} className="btn-glossy-light px-4 py-2.5 rounded-[16px] font-bold text-xs flex items-center gap-1.5">
                    <Icons.Trash />
                    Discard
                  </button>
                  <button onClick={restoreDraft} className="btn-glossy-blue px-4 py-2.5 rounded-[16px] font-bold text-xs flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
                    <Icons.Refresh />
                    Resume
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Stepper ─── */}
          <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-10 animate-entrance" style={{ animationDelay: "100ms" }}>
            {stepLabels.map((label, idx) => {
              const num = idx + 1;
              const isActive = num === stepNumber;
              const isDone = num < stepNumber;
              return (
                <React.Fragment key={label}>
                  <div className={`flex items-center gap-2 ${isActive || isDone ? "opacity-100" : "opacity-50"}`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${isDone ? "btn-glossy-blue" : isActive ? "btn-glossy-blue scale-110" : "inset-pill border-none text-slate-400"}`}>
                      {isDone ? <Icons.Check /> : num}
                    </div>
                    <span className={`hidden sm:inline text-xs sm:text-sm font-bold ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`}>{label}</span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-colors ${num < stepNumber ? "bg-gradient-to-r from-sky-400 to-blue-600" : "bg-slate-300/50 dark:bg-slate-700/50"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* ═══════ STEP 1: URL ═══════ */}
          {step === "url" && (
            <div className="space-y-5 sm:space-y-6 animate-pop">
              <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-6 sm:p-10">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 inset-pill border-none rounded-[20px] sm:rounded-[24px] flex items-center justify-center text-red-500">
                    <Icons.Youtube />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Paste YouTube URL</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Captions wala video hona chahiye</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-5 py-4 rounded-[20px] sm:rounded-[24px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm sm:text-base text-slate-800 dark:text-white placeholder-slate-400"
                    onKeyDown={(e) => { if (e.key === "Enter" && !previewLoading) handlePreview(); }}
                  />
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading || !videoUrl.trim()}
                    className="btn-glossy-blue w-full px-5 py-4 rounded-[20px] sm:rounded-[24px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95"
                  >
                    {previewLoading ? (<><Icons.Loader size={18} /><span>Fetching video...</span></>) : (<><Icons.Sparkles /><span>Load Video</span></>)}
                  </button>
                </div>
              </div>

              {preview && (
                <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-7 animate-pop">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <img src={preview.thumbnail} alt={preview.title} className="w-full sm:w-48 h-32 sm:h-32 object-cover rounded-[20px] sm:rounded-[24px] shrink-0 border border-white/60" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-[12px] uppercase tracking-wider">✓ Loaded</span>
                        <span className="text-[10px] font-bold text-slate-600 inset-pill border-none px-2.5 py-1 rounded-[12px]">{preview.transcript_word_count.toLocaleString()} words</span>
                      </div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight mb-1 line-clamp-2">{preview.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium mb-3">{preview.channel}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">"{preview.transcript_preview}"</p>
                    </div>
                  </div>
                  <button onClick={handleNextToConfig} className="btn-glossy-blue mt-5 w-full px-5 py-3.5 rounded-[20px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                    <span>Continue to Configure</span><Icons.ArrowRight />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════ STEP 2: Config ═══════ */}
          {step === "config" && preview && (
            <div className="space-y-5 sm:space-y-6 animate-pop">
              <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-4 flex items-center gap-3 sm:gap-4">
                <img src={preview.thumbnail} alt="" className="w-16 h-12 sm:w-20 sm:h-14 object-cover rounded-[16px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{preview.title}</p>
                  <p className="text-xs text-slate-500 truncate">{preview.channel}</p>
                </div>
                <button onClick={() => setStep("url")} className="text-xs font-bold text-blue-600 hover:underline shrink-0">Change</button>
              </div>

              <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-6 sm:p-8 space-y-5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Configure Quiz</h2>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Quiz Title *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Aman Bhaiya Weekly Quiz #5" className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white placeholder-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Subject</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white">
                      {SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Class</label>
                    <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white">
                      <option value="">— Any —</option>
                      {CLASSES.map((c) => (<option key={c} value={c}>Class {c}</option>))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Number of Questions</label>
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">{questionCount}</span>
                  </div>
                  <input type="range" min={5} max={30} step={5} value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} className="w-full accent-blue-600" />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1 px-1"><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span></div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Difficulty</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["easy","medium","hard","mixed"] as const).map((d) => (
                      <button key={d} onClick={() => setDifficulty(d)} className={`py-2.5 sm:py-3 rounded-[14px] sm:rounded-[16px] font-black text-xs uppercase tracking-wide transition-all ${difficulty === d ? "btn-glossy-blue scale-105" : "inset-pill border-none text-slate-600 dark:text-slate-300 hover:scale-105"}`}>{d}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Question Focus</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["conceptual","factual","mixed"] as const).map((f) => (
                      <button key={f} onClick={() => setFocus(f)} className={`py-2.5 sm:py-3 rounded-[14px] sm:rounded-[16px] font-black text-xs uppercase tracking-wide transition-all ${focus === f ? "btn-glossy-blue scale-105" : "inset-pill border-none text-slate-600 dark:text-slate-300 hover:scale-105"}`}>{f}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Time Per Attempt</label>
                    <select value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value))} className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white">
                      <option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={20}>20 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Quiz Open For</label>
                    <select value={windowDays} onChange={(e) => setWindowDays(parseInt(e.target.value))} className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white">
                      <option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Creator Name (shown to participants)</label>
                  <input type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} maxLength={50} placeholder="e.g. Aman Bhaiya" className="w-full px-4 py-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-sm text-slate-800 dark:text-white placeholder-slate-400" />
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <button onClick={() => setStep("url")} className="btn-glossy-light px-6 py-3.5 rounded-[20px] font-bold text-sm transition-all hover:-translate-y-0.5">← Back</button>
                <button onClick={handleGenerate} disabled={!title.trim()} className="btn-glossy-blue flex-1 px-5 py-3.5 rounded-[20px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                  <Icons.Sparkles /><span>Generate Quiz</span>
                </button>
              </div>
            </div>
          )}

          {/* ═══════ STEP 3: Generating ═══════ */}
          {step === "generating" && (
            <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-14 text-center animate-pop">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8 rounded-full btn-glossy-blue flex items-center justify-center">
                <Icons.Loader size={40} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3">Generating Quiz...</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium mb-2">AI video transcript se {questionCount} questions bana raha hai</p>
              <p className="text-xs sm:text-sm text-slate-500 mb-8">Usually takes 60-90 seconds. Please don't close this tab.</p>
              <div className="inset-pill border-none rounded-[20px] py-3 px-5 inline-flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Elapsed</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{elapsedSec}s</span>
              </div>
              <div className="mt-6 h-1.5 rounded-full overflow-hidden bg-slate-200/50 dark:bg-slate-700/50">
                <div className="h-full shimmer-bg rounded-full" style={{ width: `${Math.min(95, (elapsedSec / 90) * 100)}%` }} />
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 text-left">
                {[
                  { label: "Fetching transcript", done: elapsedSec > 5 },
                  { label: "Analyzing content", done: elapsedSec > 20 },
                  { label: "Crafting questions", done: elapsedSec > 50 },
                ].map((s, i) => (
                  <div key={i} className={`p-3 rounded-[16px] inset-pill border-none flex items-center gap-2 transition-opacity ${s.done ? "opacity-100" : "opacity-50"}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-emerald-500 text-white" : "bg-slate-300"}`}>{s.done && <Icons.Check />}</div>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ STEP 4: Success ═══════ */}
          {step === "success" && createdQuiz && (
            <div className="space-y-5 sm:space-y-6 animate-pop">
              <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-12 text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-5 sm:mb-6 rounded-full btn-glossy-green flex items-center justify-center">
                  <div className="scale-150"><Icons.Check /></div>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white mb-3">Quiz is Live! 🎉</h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium mb-1">{createdQuiz.total_questions} questions generated in {createdQuiz.generation_seconds}s</p>
                <p className="text-xs text-slate-500">Share the link below — participants don't need to sign up</p>
              </div>

              <div className="glass-panel rounded-[28px] sm:rounded-[36px] p-5 sm:p-7">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Share Link</label>
                <div className="flex gap-2 sm:gap-3 items-center">
                  <div className="flex-1 inset-pill border-none rounded-[16px] sm:rounded-[20px] px-4 py-3 flex items-center gap-2 min-w-0">
                    <Icons.Link />
                    <code className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{createdQuiz.share_link}</code>
                  </div>
                  <button onClick={copyLink} className="btn-glossy-blue px-4 sm:px-5 py-3 rounded-[16px] sm:rounded-[20px] font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 transition-all hover:-translate-y-0.5">
                    {linkCopied ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy</>}
                  </button>
                </div>
                <button onClick={shareWhatsapp} className="btn-glossy-green w-full mt-4 px-5 py-3.5 rounded-[20px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                  <Icons.Whatsapp /><span>Share on WhatsApp</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button onClick={viewLeaderboard} className="btn-glossy-light px-5 py-4 rounded-[20px] sm:rounded-[24px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-1">
                  <Icons.Eye /><span>View Leaderboard</span>
                </button>
                <button onClick={createAnother} className="btn-glossy-light px-5 py-4 rounded-[20px] sm:rounded-[24px] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-1">
                  <Icons.Sparkles /><span>Create Another</span>
                </button>
              </div>

              <button onClick={() => navigate("/teacher/dashboard")} className="w-full text-center text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors py-3">← Back to Dashboard</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}