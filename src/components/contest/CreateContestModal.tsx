// src/components/contest/CreateContestModal.tsx
import React, { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Link2, Copy, Clock, Eye, EyeOff,
  Camera, Monitor, Check, MessageCircle,
  Zap, Unlock, BookOpen, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ContestApiError, type AnswerMode, type CreateContestResponse } from "@/lib/contestApi";
import { buildContestPayload, clampDuration, createTapGuard, localToIso } from "./contestPayload";

// ==================== TYPES ====================
interface CreateContestProps {
  isOpen: boolean;
  onClose: () => void;
  questions: any[];
  testTitle: string;
  subject: string;
  classGrade: string;
  /** board of the paper (test meta / PDF); defaults to CBSE */
  board?: string | null;
  logoBase64?: string | null;
  /** minutes to start with (e.g. from an imported PDF); the backend accepts 5–180 */
  initialDuration?: number | null;
  onCreated?: (res: CreateContestResponse) => void;
}

interface ContestSettings {
  title: string;
  duration: number;
  answerMode: AnswerMode;
  showExplanation: boolean;
  enableCamera: boolean;
  enableTabDetection: boolean;
  allowBackNavigation: boolean;
  maxWarnings: number;
  /** datetime-local values ("2026-10-24T10:00"), local time */
  scheduledAt: string | null;
  expiresAt: string | null;
  maxAttempts: number;
}

// ==================== CONSTANTS ====================
const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

const ANSWER_MODES: { value: AnswerMode; label: string; desc: string; icon: React.FC<any> }[] = [
  { value: "instant", label: "Show correct answer after each question", desc: "Students see if they were right as they go", icon: Eye },
  { value: "after_test", label: "Show answers after submitting", desc: "Score + answer key right after they submit", icon: BookOpen },
  { value: "teacher_release", label: "Don't show — I'll publish results later", desc: "Students see results when you tap “Publish results” in My contests", icon: Clock },
  { value: "none", label: "Never show answers", desc: "Only you see the results", icon: EyeOff },
];
const ANSWER_MODE_SHORT: Record<AnswerMode, string> = {
  instant: "After each question", after_test: "After submitting", teacher_release: "When you publish", none: "Never",
};

// ==================== TOGGLE ====================
const Toggle = ({ enabled, onChange, label, description, icon: Icon }: {
  enabled: boolean; onChange: (v: boolean) => void; label: string; description: string; icon: React.FC<any>;
}) => (
  <div className="flex items-start gap-4 py-4">
    <div className={`p-2.5 rounded-xl transition-colors ${enabled ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
      <Icon size={18} />
    </div>
    <div className="flex-1">
      <p className="text-sm font-bold text-gray-900">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
    </div>
    <button onClick={() => onChange(!enabled)} className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${enabled ? "bg-gray-900" : "bg-gray-200"}`}>
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-1 mt-1 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  </div>
);

// ==================== MAIN ====================
const toIso = localToIso;

export const CreateContestModal = ({ isOpen, onClose, questions, testTitle, subject, classGrade, board, logoBase64, initialDuration, onCreated }: CreateContestProps) => {
  const [step, setStep] = useState<"configure" | "share">("configure");
  const [contestLink, setContestLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState<ContestSettings>({
    title: testTitle || "Test Paper",
    duration: clampDuration(initialDuration),
    answerMode: "after_test",
    showExplanation: true,
    enableCamera: true,
    enableTabDetection: true,
    allowBackNavigation: true,
    maxWarnings: 5,
    scheduledAt: null,
    expiresAt: null,
    maxAttempts: 1,
  });

  const updateSetting = useCallback(
    <K extends keyof ContestSettings>(key: K, value: ContestSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Duration: pointerup / keyboard only, and never within 400 ms after a date picker closed (phone ghost taps
  // once picked "15 min" under the finger while "1 hour" had been chosen).
  const tapGuard = useRef(createTapGuard(400)).current;
  const pickDuration = (value: number) => {
    if (!tapGuard.allowed()) return;
    updateSetting("duration", value);
  };

  const durationOptions = useMemo(() =>
    DURATION_OPTIONS.some((o) => o.value === settings.duration)
      ? DURATION_OPTIONS
      : [...DURATION_OPTIONS, { value: settings.duration, label: `${settings.duration} min` }].sort((a, b) => a.value - b.value),
  [settings.duration]);

  const scheduleError = useMemo(() => {
    const start = toIso(settings.scheduledAt), end = toIso(settings.expiresAt);
    if (end && new Date(end).getTime() <= Date.now()) return "End time is in the past.";
    if (start && end && end <= start) return "End time must be after the start time.";
    return null;
  }, [settings.scheduledAt, settings.expiresAt]);

  const handleCreate = useCallback(async () => {
    if (scheduleError) { toast.error(scheduleError); return; }
    setIsCreating(true);
    try {
      const { contestApi } = await import("@/lib/contestApi");

      const payload = buildContestPayload({ settings, subject, classGrade, board, logoBase64, questions });

      let res: CreateContestResponse;
      try {
        res = await contestApi.createContest(payload);
      } catch (err) {
        // older backends only know instant / after_test / none
        if (payload.answer_mode !== "teacher_release" || !(err instanceof ContestApiError) || ![400, 422].includes(err.status)) throw err;
        res = await contestApi.createContest({ ...payload, answer_mode: "none" });
        updateSetting("answerMode", "none");
        toast.warning(`“Publish results later” isn't available on the server yet (${err.message}). Saved as “Never show answers”.`);
      }

      setContestLink(res.share_link);
      setStep("share");
      onCreated?.(res);
    } catch (err: any) {
      console.error("Failed to create contest:", err);
      toast.error(err?.message || "Failed to create contest. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }, [settings, questions, subject, classGrade, board, logoBase64, scheduleError, onCreated, updateSetting]);

  const handleCopy = useCallback(() => {
    if (!contestLink) return;
    navigator.clipboard.writeText(contestLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contestLink]);

  const shareWhatsApp = useCallback(() => {
    if (!contestLink) return;
    const text = encodeURIComponent(
      `📝 *${settings.title}*\n\nSubject: ${subject} | Class: ${classGrade}\nQuestions: ${questions.length} | Duration: ${settings.duration} min\n\nAttempt here: ${contestLink}\n\n⚡ Powered by a4ai.in`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [contestLink, settings, subject, classGrade, questions.length]);

  const totalMarks = useMemo(() => questions.reduce((sum, q) => sum + (q.marks || 1), 0), [questions]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
        className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* HEADER */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">{step === "configure" ? "Create Contest" : "Share Contest"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{questions.length} questions · {totalMarks} marks · {subject}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: CONFIGURE */}
        {step === "configure" && (
          <div className="p-6 space-y-6">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Contest Title</label>
              <input type="text" value={settings.title} onChange={(e) => updateSetting("title", e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900 outline-none focus:border-gray-400 transition-colors"
                placeholder="Enter contest title..." />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                <Clock size={10} className="inline mr-1" /> Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {durationOptions.map((opt) => (
                  <button key={opt.value} type="button" aria-pressed={settings.duration === opt.value}
                    onPointerUp={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; pickDuration(opt.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDuration(opt.value); } }}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border ${settings.duration === opt.value ? "bg-gray-900 text-white border-gray-900 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                <CalendarClock size={10} className="inline mr-1" /> Schedule <span className="normal-case font-medium">(optional)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-gray-500">Opens at</span>
                  <input type="datetime-local" value={settings.scheduledAt || ""} onChange={(e) => { tapGuard.block(); updateSetting("scheduledAt", e.target.value || null); }}
                    onBlur={() => tapGuard.block()}
                    className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Closes at</span>
                  <input type="datetime-local" value={settings.expiresAt || ""} min={settings.scheduledAt || undefined} onChange={(e) => { tapGuard.block(); updateSetting("expiresAt", e.target.value || null); }}
                    onBlur={() => tapGuard.block()}
                    className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
                </label>
              </div>
              <p className={`text-[11px] mt-1 ${scheduleError ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                {scheduleError || "Leave empty to open the contest right away with no end time."}
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Answer Visibility</label>
              <div className="space-y-2">
                {ANSWER_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = settings.answerMode === mode.value;
                  return (
                    <button key={mode.value} onClick={() => updateSetting("answerMode", mode.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isActive ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className={`p-2 rounded-xl ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}><Icon size={18} /></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{mode.label}</p>
                        <p className="text-xs text-gray-400">{mode.desc}</p>
                      </div>
                      {isActive && <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {settings.answerMode !== "none" && (
              <Toggle enabled={settings.showExplanation} onChange={(v) => updateSetting("showExplanation", v)} label="Show Explanations" description="Display detailed explanations with answers" icon={BookOpen} />
            )}

            <div className="border-t border-gray-100 pt-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Proctoring & Security</p>
            </div>

            <div className="space-y-1 divide-y divide-gray-50">
              <Toggle enabled={settings.enableCamera} onChange={(v) => updateSetting("enableCamera", v)} label="Camera Proctoring" description="Monitor student via webcam during test" icon={Camera} />
              <Toggle enabled={settings.enableTabDetection} onChange={(v) => updateSetting("enableTabDetection", v)} label="Tab Switch Detection" description="Warn students if they leave the test page" icon={Monitor} />
              <Toggle enabled={settings.allowBackNavigation} onChange={(v) => updateSetting("allowBackNavigation", v)} label="Allow Back Navigation" description="Let students go back to previous questions" icon={Unlock} />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Max Warnings Before Auto-Submit</label>
              <div className="flex gap-2">
                {[2, 3, 5, 10].map((n) => (
                  <button key={n} onClick={() => updateSetting("maxWarnings", n)}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${settings.maxWarnings === n ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleCreate} disabled={isCreating || !!scheduleError}
              className="w-full py-4 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg">
              {isCreating ? (<><Zap size={18} className="animate-spin" /> Creating Contest...</>) : (<><Zap size={18} className="fill-yellow-400 text-yellow-400" /> Create & Get Link</>)}
            </button>
          </div>
        )}

        {/* STEP 2: SHARE */}
        {step === "share" && contestLink && (
          <div className="p-6 space-y-6">
            <div className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-500" />
              </motion.div>
              <h3 className="text-lg font-extrabold text-gray-900">Contest Created!</h3>
              <p className="text-xs text-gray-400 mt-1">Share the link with your students</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 border border-gray-200">
              <Link2 size={18} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm font-mono text-gray-700 truncate flex-1">{contestLink}</span>
              <button onClick={handleCopy}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${copied ? "bg-emerald-100 text-emerald-600" : "bg-white text-gray-600 hover:bg-gray-200 border border-gray-200"}`}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={shareWhatsApp}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center"><MessageCircle size={20} /></div>
                <div><p className="text-sm font-bold text-gray-900">WhatsApp</p><p className="text-[10px] text-gray-400">Share to groups</p></div>
              </button>
              <button onClick={handleCopy}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center"><Link2 size={20} /></div>
                <div><p className="text-sm font-bold text-gray-900">Copy Link</p><p className="text-[10px] text-gray-400">Share anywhere</p></div>
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contest Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400">Questions</p><p className="text-sm font-bold text-gray-900">{questions.length}</p></div>
                <div><p className="text-xs text-gray-400">Duration</p><p className="text-sm font-bold text-gray-900">{settings.duration} min</p></div>
                <div><p className="text-xs text-gray-400">Total Marks</p><p className="text-sm font-bold text-gray-900">{totalMarks}</p></div>
                <div><p className="text-xs text-gray-400">Answers</p><p className="text-sm font-bold text-gray-900">{ANSWER_MODE_SHORT[settings.answerMode]}</p></div>
                <div><p className="text-xs text-gray-400">Camera</p><p className="text-sm font-bold text-gray-900">{settings.enableCamera ? "On" : "Off"}</p></div>
                <div><p className="text-xs text-gray-400">Tab Detection</p><p className="text-sm font-bold text-gray-900">{settings.enableTabDetection ? "On" : "Off"}</p></div>
              </div>
            </div>

            <Link to="/contests/mine" onClick={onClose} className="block w-full py-3 text-center text-sm font-bold text-gray-700 rounded-2xl border border-gray-200 hover:bg-gray-50">
              See results{settings.answerMode === "teacher_release" ? " & publish them" : ""} in My contests →
            </Link>
            <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-colors">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default CreateContestModal;