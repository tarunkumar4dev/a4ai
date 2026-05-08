// src/pages/teacher/CommunityQuizCreatePage.tsx
// ──────────────────────────────────────────────────────────
// v4 — Added "My quizzes" button in header for quick access
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import {
  previewVideo,
  createQuiz,
  type VideoPreview,
  type ManualQuestion,
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
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .anim-in { animation: fadeIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards; opacity: 0; }
  .anim-pop { animation: scaleIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards; }

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

  .ap-btn-primary { background: #007AFF; color: white; font-weight: 600; transition: all 0.15s ease; }
  .ap-btn-primary:hover { background: #0066D9; }
  .ap-btn-primary:active { background: #0058BD; transform: scale(0.985); }
  .ap-btn-primary:disabled { background: #B5D4FF; cursor: not-allowed; }

  .ap-btn-secondary { background: rgba(120, 120, 128, 0.12); color: #1d1d1f; font-weight: 500; transition: all 0.15s ease; }
  .ap-btn-secondary:hover { background: rgba(120, 120, 128, 0.2); }
  .ap-btn-secondary:active { transform: scale(0.985); }

  .ap-btn-success { background: #34C759; color: white; font-weight: 600; transition: all 0.15s ease; }
  .ap-btn-success:hover { background: #2BB350; }

  .ap-btn-danger { background: rgba(255, 59, 48, 0.1); color: #FF3B30; font-weight: 500; transition: all 0.15s ease; }
  .ap-btn-danger:hover { background: rgba(255, 59, 48, 0.18); }

  .ap-segment { background: rgba(120, 120, 128, 0.12); padding: 2px; border-radius: 9px; }
  .ap-segment-btn { padding: 6px 12px; border-radius: 7px; font-size: 13px; font-weight: 500; color: #1d1d1f; transition: all 0.15s ease; text-align: center; }
  .ap-segment-btn.active { background: white; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.04); }

  .src-card { transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1); cursor: pointer; }
  .src-card:hover:not(.disabled) { transform: translateY(-2px); border-color: rgba(0, 122, 255, 0.3); }
  .src-card.disabled { opacity: 0.55; cursor: not-allowed; }
  .src-card.selected { border-color: #007AFF; background: rgba(0, 122, 255, 0.04); }

  .opt-row { transition: all 0.15s ease; }
  .opt-row.correct { background: rgba(52, 199, 89, 0.08); border-color: #34C759; }

  .shimmer-bg { background: linear-gradient(90deg, rgba(0,122,255,0.08) 0%, rgba(0,122,255,0.2) 50%, rgba(0,122,255,0.08) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }

  .ap-range { -webkit-appearance: none; appearance: none; height: 4px; background: rgba(120,120,128,0.2); border-radius: 2px; outline: none; }
  .ap-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; background: white; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.04); border: none; }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  ArrowLeft: ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  ArrowRight: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Play: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a.5.5 0 0 0 .77.42l10.85-6.86a.5.5 0 0 0 0-.84L8.77 4.72A.5.5 0 0 0 8 5.14Z"/></svg>,
  Edit: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Library: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18"/><path d="M5 5v15"/><path d="M19 5v15"/><path d="M5 12h14"/><path d="M5 19h14"/></svg>,
  Sparkle: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5z"/></svg>,
  Check: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Loader: ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Copy: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Whatsapp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  Trash: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Plus: ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  Lock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  RotateCcw: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  List: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
};

/* ------------------- HELPERS ------------------- */
const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","Science","English","Hindi","Social Science","History","Geography","Civics","Economics","Computer Science","Accountancy","Business Studies","General Knowledge","Other"];
const CLASSES = ["6","7","8","9","10","11","12"];
const DRAFT_KEY = "a4ai_community_quiz_draft_v2";

function isYoutubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url.trim());
}

type SourceType = "video" | "manual";
type Step = "source" | "video_url" | "manual_questions" | "config" | "generating" | "success";

interface DraftState {
  step: Step;
  source: SourceType | null;
  videoUrl: string;
  preview: VideoPreview | null;
  manualQuestions: ManualQuestion[];
  title: string;
  subject: string;
  classLevel: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  focus: "conceptual" | "factual" | "mixed";
  durationMinutes: number;
  windowDays: number;
  creatorName: string;
  revealMode: "never" | "after_end" | "immediate";
  savedAt: string;
}

function blankQuestion(): ManualQuestion {
  return {
    question_text: "",
    options: ["", "", "", ""],
    correct_option: 0,
    explanation: "",
    marks: 1,
  };
}

/* ------------------- COMPONENT ------------------- */

export default function CommunityQuizCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<SourceType | null>(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<VideoPreview | null>(null);

  const [manualQuestions, setManualQuestions] = useState<ManualQuestion[]>([blankQuestion()]);
  const [editingIdx, setEditingIdx] = useState<number>(0);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Other");
  const [classLevel, setClassLevel] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard"|"mixed">("mixed");
  const [focus, setFocus] = useState<"conceptual"|"factual"|"mixed">("mixed");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [windowDays, setWindowDays] = useState(7);
  const [creatorName, setCreatorName] = useState(displayName);
  const [revealMode, setRevealMode] = useState<"never" | "after_end" | "immediate">("after_end");

  const [generationStartTs, setGenerationStartTs] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const [createdQuiz, setCreatedQuiz] = useState<{
    quiz_id: string; share_slug: string; share_link: string; total_questions: number; generation_seconds: number;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [draftAvailable, setDraftAvailable] = useState<DraftState | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  /* Draft detection */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftState;
      const hasContent = parsed.videoUrl || parsed.preview ||
        (parsed.manualQuestions && parsed.manualQuestions.some(q => q.question_text));
      if (hasContent) {
        setDraftAvailable(parsed);
        setShowDraftBanner(true);
      }
    } catch {}
  }, []);

  /* Auto-save */
  useEffect(() => {
    if (step === "generating" || step === "success") return;
    const hasContent = videoUrl || preview || manualQuestions.some(q => q.question_text) || title;
    if (!hasContent) return;
    const draft: DraftState = {
      step, source, videoUrl, preview, manualQuestions, title, subject, classLevel,
      questionCount, difficulty, focus, durationMinutes, windowDays, creatorName, revealMode,
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [step, source, videoUrl, preview, manualQuestions, title, subject, classLevel, questionCount, difficulty, focus, durationMinutes, windowDays, creatorName, revealMode]);

  function restoreDraft() {
    if (!draftAvailable) return;
    setStep(draftAvailable.step);
    setSource(draftAvailable.source);
    setVideoUrl(draftAvailable.videoUrl);
    setPreview(draftAvailable.preview);
    setManualQuestions(draftAvailable.manualQuestions?.length ? draftAvailable.manualQuestions : [blankQuestion()]);
    setTitle(draftAvailable.title);
    setSubject(draftAvailable.subject);
    setClassLevel(draftAvailable.classLevel);
    setQuestionCount(draftAvailable.questionCount);
    setDifficulty(draftAvailable.difficulty);
    setFocus(draftAvailable.focus);
    setDurationMinutes(draftAvailable.durationMinutes);
    setWindowDays(draftAvailable.windowDays);
    setCreatorName(draftAvailable.creatorName);
    setRevealMode(draftAvailable.revealMode || "after_end");
    setShowDraftBanner(false);
    toast.success("Draft restored");
  }

  function discardDraft() { localStorage.removeItem(DRAFT_KEY); setShowDraftBanner(false); setDraftAvailable(null); }
  function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  /* Timer */
  useEffect(() => {
    if (step !== "generating" || !generationStartTs) return;
    const interval = setInterval(() => setElapsedSec(Math.floor((Date.now() - generationStartTs) / 1000)), 500);
    return () => clearInterval(interval);
  }, [step, generationStartTs]);

  function pickSource(s: SourceType) {
    setSource(s);
    if (s === "video") setStep("video_url");
    else if (s === "manual") setStep("manual_questions");
  }

  async function handlePreview() {
    if (!videoUrl.trim()) { toast.error("Paste a YouTube URL"); return; }
    if (!isYoutubeUrl(videoUrl)) { toast.error("That doesn't look like a YouTube URL"); return; }
    setPreviewLoading(true);
    try {
      const data = await previewVideo(videoUrl.trim());
      setPreview(data);
      if (!title) setTitle(data.title.slice(0, 100));
      toast.success("Video loaded");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't fetch video");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateQuestion(idx: number, patch: Partial<ManualQuestion>) {
    setManualQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }
  function updateOption(qIdx: number, oIdx: number, value: string) {
    setManualQuestions(prev => prev.map((q, i) =>
      i === qIdx ? { ...q, options: q.options.map((o, oi) => oi === oIdx ? value : o) } : q
    ));
  }
  function addQuestion() {
    setManualQuestions(prev => [...prev, blankQuestion()]);
    setEditingIdx(manualQuestions.length);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
  }
  function deleteQuestion(idx: number) {
    if (manualQuestions.length === 1) {
      toast.error("At least one question required");
      return;
    }
    setManualQuestions(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx >= manualQuestions.length - 1) setEditingIdx(Math.max(0, manualQuestions.length - 2));
  }

  function validateManualQuestions(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    manualQuestions.forEach((q, idx) => {
      if (!q.question_text.trim()) errors.push(`Q${idx + 1}: question text missing`);
      if (q.options.some(o => !o.trim())) errors.push(`Q${idx + 1}: all 4 options required`);
      if (q.correct_option < 0 || q.correct_option > 3) errors.push(`Q${idx + 1}: select correct answer`);
    });
    return { ok: errors.length === 0, errors };
  }

  function goToConfigFromManual() {
    const v = validateManualQuestions();
    if (!v.ok) {
      toast.error(v.errors[0]);
      return;
    }
    setStep("config");
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSubmitting(true);
    try {
      if (source === "video") {
        if (!preview) { setStep("source"); setSubmitting(false); return; }
        setStep("generating");
        setGenerationStartTs(Date.now());
        setElapsedSec(0);
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
          leaderboard_reveal_mode: revealMode,
        });
        setCreatedQuiz({
          quiz_id: resp.quiz_id,
          share_slug: resp.share_slug,
          share_link: resp.share_link,
          total_questions: resp.total_questions,
          generation_seconds: resp.generation_seconds,
        });
        setStep("success");
        clearDraft();
        toast.success(`Quiz published — ${resp.total_questions} questions`);
      } else if (source === "manual") {
        const resp = await createQuiz({
          title: title.trim(),
          subject,
          class_level: classLevel || undefined,
          source_type: "manual",
          duration_minutes: durationMinutes,
          duration_window_hours: windowDays * 24,
          manual_questions: manualQuestions.map(q => ({
            question_text: q.question_text.trim(),
            options: q.options.map(o => o.trim()),
            correct_option: q.correct_option,
            explanation: q.explanation?.trim() || "",
            marks: q.marks || 1,
          })),
          creator_name: creatorName.trim() || undefined,
          leaderboard_reveal_mode: revealMode,
        });
        setCreatedQuiz({
          quiz_id: resp.quiz_id,
          share_slug: resp.share_slug,
          share_link: resp.share_link,
          total_questions: resp.total_questions,
          generation_seconds: resp.generation_seconds,
        });
        setStep("success");
        clearDraft();
        toast.success(`Quiz published — ${resp.total_questions} questions`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't create quiz");
      if (step === "generating") setStep("config");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!createdQuiz) return;
    navigator.clipboard.writeText(createdQuiz.share_link);
    setLinkCopied(true);
    toast.success("Link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function shareWhatsapp() {
    if (!createdQuiz) return;
    const msg = encodeURIComponent(`${title}\n\nTake the quiz: ${createdQuiz.share_link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function viewLeaderboard() {
    if (!createdQuiz) return;
    navigate(`/teacher/community-quiz/${createdQuiz.quiz_id}/leaderboard`);
  }

  function createAnother() {
    setStep("source");
    setSource(null);
    setVideoUrl("");
    setPreview(null);
    setManualQuestions([blankQuestion()]);
    setEditingIdx(0);
    setTitle("");
    setCreatedQuiz(null);
    clearDraft();
  }

  function formatAgo(isoString: string): string {
    try {
      const ms = Date.now() - new Date(isoString).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 1) return "moments ago";
      if (min < 60) return `${min} min ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      return `${Math.floor(hr / 24)}d ago`;
    } catch { return ""; }
  }

  const stepNum = (() => {
    if (step === "source") return 1;
    if (step === "video_url" || step === "manual_questions") return 2;
    if (step === "config") return 3;
    if (step === "generating") return 4;
    return 4;
  })();
  const totalSteps = 4;

  return (
    <div className="sf-pro min-h-[100dvh] w-full text-[15px] text-[#1d1d1f] relative bg-[#F5F5F7]">
      <style>{customStyles}</style>

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#E3F2FF]/60 to-transparent pointer-events-none" />

      <main className="relative z-10 max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ═══ Header with My Quizzes button ═══ */}
        <header className="flex items-center gap-3 mb-8 anim-in">
          <button onClick={() => navigate(-1)} className="ap-btn-secondary w-9 h-9 rounded-full flex items-center justify-center shrink-0" aria-label="Back">
            <Icons.ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-[-0.02em] leading-tight truncate">Create community quiz</h1>
            <p className="text-[13px] sm:text-[14px] text-[#86868b] mt-0.5 truncate">
              {step === "source" ? "Choose how you want to create your quiz" :
               source === "video" ? "Generate from a YouTube video" :
               source === "manual" ? "Add your own questions" :
               "Generate a shareable quiz"}
            </p>
          </div>
          <button
            onClick={() => navigate("/teacher/community-quizzes")}
            className="ap-btn-secondary px-3 sm:px-4 h-9 rounded-[10px] text-[13px] flex items-center gap-1.5 shrink-0"
            title="View all your quizzes"
          >
            <Icons.List />
            <span className="hidden sm:inline">My quizzes</span>
          </button>
        </header>

        {/* Resume Draft */}
        {showDraftBanner && draftAvailable && (
          <div className="ap-panel rounded-[14px] px-4 py-3 mb-6 anim-pop flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF9500]/15 flex items-center justify-center text-[#FF9500] shrink-0">
              <Icons.RotateCcw />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium leading-tight">Draft available</p>
              <p className="text-[12px] text-[#86868b] truncate mt-0.5">
                {draftAvailable.title || draftAvailable.preview?.title || `${draftAvailable.manualQuestions?.length || 0} questions`} · {formatAgo(draftAvailable.savedAt)}
              </p>
            </div>
            <button onClick={discardDraft} className="ap-btn-secondary px-3 h-8 rounded-[8px] text-[13px]">Discard</button>
            <button onClick={restoreDraft} className="ap-btn-primary px-3 h-8 rounded-[8px] text-[13px]">Resume</button>
          </div>
        )}

        {/* Progress */}
        {step !== "source" && step !== "success" && (
          <div className="mb-6 anim-in" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[#86868b]">Step {stepNum} of {totalSteps}</span>
              <span className="text-[12px] font-medium text-[#86868b]">
                {source === "video" ? "Video quiz" : source === "manual" ? "Manual quiz" : ""}
              </span>
            </div>
            <div className="h-1 bg-[rgba(120,120,128,0.15)] rounded-full overflow-hidden">
              <div className="h-full bg-[#007AFF] rounded-full transition-all duration-500" style={{ width: `${(stepNum / totalSteps) * 100}%` }} />
            </div>
          </div>
        )}

        {/* ═══════ SOURCE PICKER ═══════ */}
        {step === "source" && (
          <div className="space-y-3 anim-pop">
            <p className="text-[15px] text-[#3a3a3c] mb-2">How do you want to create the quiz?</p>

            <button
              onClick={() => pickSource("manual")}
              className={`src-card w-full ap-panel rounded-[16px] p-5 sm:p-6 text-left ${source === "manual" ? "selected" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                  <Icons.Edit />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[17px] font-semibold tracking-[-0.005em]">Add manually</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 h-5 rounded-[4px] flex items-center bg-[#34C759]/15 text-[#1A8B3F]">Available</span>
                  </div>
                  <p className="text-[13px] text-[#86868b] leading-snug">
                    Type your own questions, options, and answers. Full control over content. Best for custom assessments.
                  </p>
                </div>
                <Icons.ArrowRight size={14} />
              </div>
            </button>

            <button
              onClick={() => pickSource("video")}
              className={`src-card w-full ap-panel rounded-[16px] p-5 sm:p-6 text-left ${source === "video" ? "selected" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center shrink-0">
                  <Icons.Play />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[17px] font-semibold tracking-[-0.005em]">From YouTube video</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 h-5 rounded-[4px] flex items-center bg-[#007AFF]/15 text-[#007AFF]">AI</span>
                  </div>
                  <p className="text-[13px] text-[#86868b] leading-snug">
                    Paste a YouTube URL — AI generates questions from the video transcript. Takes 60–90 seconds.
                  </p>
                </div>
                <Icons.ArrowRight size={14} />
              </div>
            </button>

            <div className="src-card disabled w-full ap-panel rounded-[16px] p-5 sm:p-6 text-left">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-[rgba(120,120,128,0.15)] text-[#86868b] flex items-center justify-center shrink-0">
                  <Icons.Library />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[17px] font-semibold tracking-[-0.005em]">From question bank</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 h-5 rounded-[4px] flex items-center bg-[rgba(120,120,128,0.2)] text-[#86868b]"><Icons.Lock /><span className="ml-1">Soon</span></span>
                  </div>
                  <p className="text-[13px] text-[#86868b] leading-snug">
                    Reuse questions from your previous tests and contests.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ VIDEO URL ═══════ */}
        {step === "video_url" && (
          <div className="space-y-4 anim-pop">
            <div className="ap-panel rounded-[16px] p-6">
              <h2 className="text-[20px] font-semibold tracking-[-0.01em] mb-1">Paste a YouTube URL</h2>
              <p className="text-[13px] text-[#86868b] mb-5">Video must have captions enabled.</p>

              <div className="space-y-3">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="ap-input w-full px-4 h-11 rounded-[10px] text-[15px] placeholder-[#a1a1a6]"
                  onKeyDown={(e) => { if (e.key === "Enter" && !previewLoading) handlePreview(); }}
                />
                <button onClick={handlePreview} disabled={previewLoading || !videoUrl.trim()} className="ap-btn-primary w-full h-11 rounded-[10px] text-[15px] flex items-center justify-center gap-2">
                  {previewLoading ? (<><Icons.Loader /><span>Loading…</span></>) : (<><Icons.Play /><span>Load video</span></>)}
                </button>
              </div>
            </div>

            {preview && (
              <div className="ap-panel rounded-[16px] p-4 anim-pop">
                <div className="flex gap-3">
                  <img src={preview.thumbnail} alt="" className="w-32 h-20 sm:w-40 sm:h-24 object-cover rounded-[10px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-[#34C759]">Loaded</span>
                      <span className="text-[11px] text-[#86868b]">·</span>
                      <span className="text-[11px] text-[#86868b]">{preview.transcript_word_count.toLocaleString()} words</span>
                    </div>
                    <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">{preview.title}</h3>
                    <p className="text-[12px] text-[#86868b] mt-1">{preview.channel}</p>
                  </div>
                </div>
                <button onClick={() => setStep("config")} className="ap-btn-primary w-full h-10 rounded-[10px] text-[14px] mt-4 flex items-center justify-center gap-1.5">
                  Continue<Icons.ArrowRight />
                </button>
              </div>
            )}

            <button onClick={() => setStep("source")} className="ap-btn-secondary px-4 h-10 rounded-[10px] text-[14px]">← Choose different source</button>
          </div>
        )}

        {/* ═══════ MANUAL QUESTIONS ═══════ */}
        {step === "manual_questions" && (
          <div className="space-y-3 anim-pop">
            <div className="ap-panel rounded-[14px] p-3 flex items-center gap-3">
              <button onClick={() => setStep("source")} className="ap-btn-secondary w-8 h-8 rounded-full flex items-center justify-center">
                <Icons.ArrowLeft size={14} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Add questions</p>
                <p className="text-[12px] text-[#86868b]">{manualQuestions.length} question{manualQuestions.length !== 1 ? "s" : ""} · 1 mark each</p>
              </div>
              <span className="text-[11px] text-[#86868b] font-medium">Min 1, max 50</span>
            </div>

            {manualQuestions.map((q, idx) => (
              <div key={idx} className="ap-panel rounded-[16px] p-5 anim-pop">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 h-5 rounded-[4px] flex items-center bg-[#007AFF]/15 text-[#007AFF]">Q{idx + 1}</span>
                    <span className="text-[11px] text-[#86868b]">·</span>
                    <span className="text-[11px] text-[#86868b]">{q.marks || 1} mark{(q.marks || 1) > 1 ? "s" : ""}</span>
                  </div>
                  {manualQuestions.length > 1 && (
                    <button onClick={() => deleteQuestion(idx)} className="ap-btn-danger w-8 h-8 rounded-[8px] flex items-center justify-center" title="Delete question">
                      <Icons.Trash />
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Question</label>
                  <textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(idx, { question_text: e.target.value })}
                    placeholder="What is the question?"
                    maxLength={2000}
                    rows={2}
                    className="ap-input w-full px-3.5 py-2.5 rounded-[10px] text-[14px] resize-y leading-snug"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Options · tap circle to mark correct</label>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = q.correct_option === oi;
                      return (
                        <div key={oi} className={`opt-row flex items-center gap-2 px-2 py-1.5 rounded-[10px] border-[0.5px] border-[rgba(0,0,0,0.06)] ${isCorrect ? "correct" : ""}`}>
                          <button
                            type="button"
                            onClick={() => updateQuestion(idx, { correct_option: oi })}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 transition-all ${isCorrect ? "bg-[#34C759] text-white" : "bg-[rgba(120,120,128,0.15)] text-[#86868b] hover:bg-[#34C759]/20"}`}
                            title={isCorrect ? "Correct answer" : "Mark as correct"}
                          >
                            {isCorrect ? <Icons.Check size={12} /> : String.fromCharCode(65 + oi)}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(idx, oi, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            className="ap-input flex-1 px-3 h-9 rounded-[8px] text-[14px] placeholder-[#a1a1a6]"
                            style={{ background: "rgba(255,255,255,0.5)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-[12px] font-medium text-[#007AFF] hover:underline list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform">▸</span>
                    {q.explanation ? "Edit explanation" : "Add explanation (optional)"}
                  </summary>
                  <textarea
                    value={q.explanation || ""}
                    onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                    placeholder="Why is this the correct answer?"
                    rows={2}
                    className="ap-input w-full mt-2 px-3.5 py-2.5 rounded-[10px] text-[13px] resize-y leading-snug"
                  />
                </details>
              </div>
            ))}

            <button
              onClick={addQuestion}
              disabled={manualQuestions.length >= 50}
              className="ap-btn-secondary w-full h-12 rounded-[12px] text-[14px] flex items-center justify-center gap-1.5"
            >
              <Icons.Plus size={16} />
              Add another question
              {manualQuestions.length >= 50 && <span className="text-[11px] text-[#86868b]">(max reached)</span>}
            </button>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep("source")} className="ap-btn-secondary px-4 h-11 rounded-[10px] text-[14px]">Back</button>
              <button onClick={goToConfigFromManual} className="ap-btn-primary flex-1 h-11 rounded-[10px] text-[15px] flex items-center justify-center gap-1.5">
                Continue<Icons.ArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* ═══════ CONFIG ═══════ */}
        {step === "config" && (
          <div className="space-y-4 anim-pop">
            {source === "video" && preview && (
              <div className="ap-panel rounded-[14px] p-3 flex items-center gap-3">
                <img src={preview.thumbnail} alt="" className="w-14 h-10 object-cover rounded-[8px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{preview.title}</p>
                  <p className="text-[11px] text-[#86868b] truncate">{preview.channel}</p>
                </div>
                <button onClick={() => setStep("video_url")} className="text-[13px] text-[#007AFF] font-medium">Change</button>
              </div>
            )}

            {source === "manual" && (
              <div className="ap-panel rounded-[14px] p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                  <Icons.Edit />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{manualQuestions.length} manual question{manualQuestions.length !== 1 ? "s" : ""}</p>
                  <p className="text-[11px] text-[#86868b]">Total {manualQuestions.reduce((s, q) => s + (q.marks || 1), 0)} marks</p>
                </div>
                <button onClick={() => setStep("manual_questions")} className="text-[13px] text-[#007AFF] font-medium">Edit</button>
              </div>
            )}

            <div className="ap-panel rounded-[16px] p-5 space-y-5">
              <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Quiz details</h2>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Weekly Quiz #5" className="ap-input w-full px-3.5 h-10 rounded-[8px] text-[14px]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Subject</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className="ap-input w-full px-3 h-10 rounded-[8px] text-[14px]">
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Class</label>
                  <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="ap-input w-full px-3 h-10 rounded-[8px] text-[14px]">
                    <option value="">Any</option>
                    {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
              </div>

              {source === "video" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-medium text-[#86868b]">Number of questions</label>
                      <span className="text-[15px] font-semibold tabular-nums">{questionCount}</span>
                    </div>
                    <input type="range" min={5} max={30} step={5} value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} className="ap-range w-full" />
                    <div className="flex justify-between text-[10px] text-[#a1a1a6] mt-1.5">
                      <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Difficulty</label>
                    <div className="ap-segment grid grid-cols-4 gap-0">
                      {(["easy","medium","hard","mixed"] as const).map(d => (
                        <button key={d} onClick={() => setDifficulty(d)} className={`ap-segment-btn capitalize ${difficulty === d ? "active" : ""}`}>{d}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Question style</label>
                    <div className="ap-segment grid grid-cols-3 gap-0">
                      {(["conceptual","factual","mixed"] as const).map(f => (
                        <button key={f} onClick={() => setFocus(f)} className={`ap-segment-btn capitalize ${focus === f ? "active" : ""}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Time per attempt</label>
                  <select value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value))} className="ap-input w-full px-3 h-10 rounded-[8px] text-[14px]">
                    <option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={20}>20 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Quiz open for</label>
                  <select value={windowDays} onChange={(e) => setWindowDays(parseInt(e.target.value))} className="ap-input w-full px-3 h-10 rounded-[8px] text-[14px]">
                    <option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">When participants see leaderboard</label>
                <div className="ap-segment grid grid-cols-3 gap-0">
                  <button type="button" onClick={() => setRevealMode("never")} className={`ap-segment-btn ${revealMode === "never" ? "active" : ""}`}>Never</button>
                  <button type="button" onClick={() => setRevealMode("after_end")} className={`ap-segment-btn ${revealMode === "after_end" ? "active" : ""}`}>After end</button>
                  <button type="button" onClick={() => setRevealMode("immediate")} className={`ap-segment-btn ${revealMode === "immediate" ? "active" : ""}`}>Immediate</button>
                </div>
                <p className="text-[11px] text-[#a1a1a6] mt-1.5 leading-snug">
                  {revealMode === "never" && "Only you see results. Share with participants manually."}
                  {revealMode === "after_end" && "Auto-revealed when quiz ends. Builds anticipation."}
                  {revealMode === "immediate" && "Participants see rank instantly after submitting."}
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">Creator name</label>
                <input type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} maxLength={50} placeholder="Shown to participants" className="ap-input w-full px-3.5 h-10 rounded-[8px] text-[14px]" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(source === "video" ? "video_url" : "manual_questions")} className="ap-btn-secondary px-4 h-11 rounded-[10px] text-[14px]">Back</button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="ap-btn-primary flex-1 h-11 rounded-[10px] text-[15px] flex items-center justify-center gap-1.5"
              >
                {submitting && source === "manual" ? (<><Icons.Loader />Publishing…</>) : (<><Icons.Sparkle />Publish quiz</>)}
              </button>
            </div>
          </div>
        )}

        {/* ═══════ GENERATING ═══════ */}
        {step === "generating" && (
          <div className="ap-panel rounded-[16px] p-10 text-center anim-pop">
            <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
              <Icons.Loader size={22} />
            </div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] mb-1.5">Generating quiz</h2>
            <p className="text-[14px] text-[#86868b] mb-6">Creating {questionCount} questions from the video</p>
            <div className="inline-flex items-center gap-2 px-3 h-8 rounded-[8px] bg-[rgba(120,120,128,0.1)]">
              <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Elapsed</span>
              <span className="text-[15px] font-semibold tabular-nums">{elapsedSec}s</span>
            </div>
            <div className="mt-6 h-1 rounded-full overflow-hidden bg-[rgba(120,120,128,0.15)] max-w-sm mx-auto">
              <div className="h-full shimmer-bg rounded-full transition-all" style={{ width: `${Math.min(95, (elapsedSec / 90) * 100)}%` }} />
            </div>
            <p className="text-[12px] text-[#a1a1a6] mt-6">Usually takes 60–90 seconds. Please don't close this tab.</p>
          </div>
        )}

        {/* ═══════ SUCCESS ═══════ */}
        {step === "success" && createdQuiz && (
          <div className="space-y-4 anim-pop">
            <div className="ap-panel rounded-[16px] p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#34C759]/15 flex items-center justify-center text-[#34C759]">
                <Icons.Check size={22} />
              </div>
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] mb-1.5">Quiz published</h2>
              <p className="text-[14px] text-[#86868b]">
                {createdQuiz.total_questions} question{createdQuiz.total_questions !== 1 ? "s" : ""}
                {source === "video" && createdQuiz.generation_seconds > 1 && ` · generated in ${createdQuiz.generation_seconds}s`}
              </p>
            </div>

            <div className="ap-panel rounded-[16px] p-5">
              <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wider mb-2">Share link</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 px-3 h-10 bg-[rgba(120,120,128,0.08)] rounded-[8px] flex items-center min-w-0">
                  <code className="text-[13px] font-medium truncate">{createdQuiz.share_link}</code>
                </div>
                <button onClick={copyLink} className="ap-btn-primary px-3 h-10 rounded-[8px] text-[13px] flex items-center gap-1.5 shrink-0">
                  {linkCopied ? <><Icons.Check size={13} />Copied</> : <><Icons.Copy />Copy</>}
                </button>
              </div>
              <button onClick={shareWhatsapp} className="ap-btn-success w-full h-10 rounded-[8px] mt-3 text-[14px] flex items-center justify-center gap-2">
                <Icons.Whatsapp />Share on WhatsApp
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={viewLeaderboard} className="ap-btn-secondary h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5">
                <Icons.Eye />Leaderboard
              </button>
              <button onClick={createAnother} className="ap-btn-secondary h-11 rounded-[10px] text-[14px] flex items-center justify-center gap-1.5">
                <Icons.Sparkle />New quiz
              </button>
            </div>

            <button onClick={() => navigate("/teacher/community-quizzes")} className="w-full text-center text-[13px] text-[#86868b] hover:text-[#007AFF] transition-colors py-2">
              ← View all my quizzes
            </button>
          </div>
        )}
      </main>
    </div>
  );
}