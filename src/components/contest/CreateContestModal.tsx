// src/components/contest/CreateContestModal.tsx
import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Link2, Copy, Clock, Eye, EyeOff,
  Camera, Monitor, Check, MessageCircle,
  Zap, Unlock, BookOpen,
} from "lucide-react";

// ==================== TYPES ====================
interface CreateContestProps {
  isOpen: boolean;
  onClose: () => void;
  questions: any[];
  testTitle: string;
  subject: string;
  classGrade: string;
  logoBase64?: string | null;
}

interface ContestSettings {
  title: string;
  duration: number;
  answerMode: "instant" | "after_test" | "none";
  showExplanation: boolean;
  enableCamera: boolean;
  enableTabDetection: boolean;
  allowBackNavigation: boolean;
  maxWarnings: number;
  scheduledAt: string | null;
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

const ANSWER_MODES = [
  { value: "instant" as const, label: "Instant Answers", desc: "Show correct answer after each question", icon: Eye },
  { value: "after_test" as const, label: "After Submission", desc: "Show all answers after test is submitted", icon: BookOpen },
  { value: "none" as const, label: "No Answers", desc: "Only teacher sees the results", icon: EyeOff },
];

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
export const CreateContestModal = ({ isOpen, onClose, questions, testTitle, subject, classGrade, logoBase64 }: CreateContestProps) => {
  const [step, setStep] = useState<"configure" | "share">("configure");
  const [contestLink, setContestLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState<ContestSettings>({
    title: testTitle || "Test Paper",
    duration: 30,
    answerMode: "after_test",
    showExplanation: true,
    enableCamera: true,
    enableTabDetection: true,
    allowBackNavigation: true,
    maxWarnings: 3,
    scheduledAt: null,
    maxAttempts: 1,
  });

  const updateSetting = useCallback(
    <K extends keyof ContestSettings>(key: K, value: ContestSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const { contestApi } = await import("@/lib/contestApi");

      const res = await contestApi.createContest({
        title: settings.title,
        subject,
        class_grade: classGrade,
        board: "CBSE",
        logo_base64: logoBase64 || undefined,
        duration_minutes: settings.duration,
        answer_mode: settings.answerMode,
        show_explanation: settings.showExplanation,
        enable_camera: settings.enableCamera,
        enable_tab_detection: settings.enableTabDetection,
        allow_back_navigation: settings.allowBackNavigation,
        max_warnings: settings.maxWarnings,
        max_attempts: settings.maxAttempts,
        questions: questions.map((q: any) => {
          // Fix question_type: "mcq" → "MCQ", "short" → "Short", "long" → "Long"
          const rawType = q.type || q.format || q.question_type || "MCQ";
          const typeMap: Record<string, string> = { mcq: "MCQ", short: "Short", long: "Long", essay: "Long" };
          const questionType = typeMap[rawType.toLowerCase()] || rawType;

          // Fix options: convert strings to {label, text} dicts
          const rawOptions = q.options || [];
          const options = rawOptions.map((opt: any, idx: number) => {
            if (typeof opt === "string") {
              const labels = ["A", "B", "C", "D"];
              // Remove "A) " prefix if present
              const cleaned = opt.replace(/^[A-D]\)\s*/i, "");
              return { label: labels[idx] || String(idx + 1), text: cleaned };
            }
            return opt; // already a dict
          });

          return {
            question_text: q.question_text || q.text || "",
            question_type: questionType,
            options,
            correct_answer: q.correct_answer || q.correctAnswer || "",
            explanation: q.explanation || "",
            marks: q.marks || 1,
            difficulty: q.difficulty || "Medium",
            chapter: q.chapter || "",
          };
        }),
      });

      setContestLink(res.share_link);
      setStep("share");
    } catch (err: any) {
      console.error("Failed to create contest:", err);
      alert("Failed to create contest. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }, [settings, questions, subject, classGrade, logoBase64]);

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
                {DURATION_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => updateSetting("duration", opt.value)}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border ${settings.duration === opt.value ? "bg-gray-900 text-white border-gray-900 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
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

            <button onClick={handleCreate} disabled={isCreating}
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
                <div><p className="text-xs text-gray-400">Answers</p><p className="text-sm font-bold text-gray-900 capitalize">{settings.answerMode === "after_test" ? "After Test" : settings.answerMode}</p></div>
                <div><p className="text-xs text-gray-400">Camera</p><p className="text-sm font-bold text-gray-900">{settings.enableCamera ? "On" : "Off"}</p></div>
                <div><p className="text-xs text-gray-400">Tab Detection</p><p className="text-sm font-bold text-gray-900">{settings.enableTabDetection ? "On" : "Off"}</p></div>
              </div>
            </div>

            <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-colors">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default CreateContestModal;