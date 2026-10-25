// src/components/contest/CreateContestModal.tsx
import React, { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Link2, Copy, Clock, Eye, EyeOff,
  Camera, Monitor, Check, MessageCircle,
  Zap, Unlock, BookOpen, CalendarClock, ChevronDown, Trophy, Users,
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
  <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)}
    className="w-full flex items-center gap-3 py-3 min-h-[56px] text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
    <span className={`p-2.5 rounded-xl ${enabled ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}><Icon size={18} /></span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-gray-900">{label}</span>
      <span className="block text-xs text-gray-600 mt-0.5">{description}</span>
    </span>
    <span className={`w-12 h-7 rounded-full flex-shrink-0 relative ${enabled ? "bg-gray-900" : "bg-gray-300"}`} aria-hidden>
      <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm ${enabled ? "left-6" : "left-1"}`} />
    </span>
  </button>
);

/** Collapsible settings section: the header shows the current choice, so a closed section still says what it holds. */
const Section = ({ title, summary, open, onToggle, children, icon: Icon }: {
  title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode; icon: React.FC<any>;
}) => (
  <section className="border border-gray-200 rounded-2xl">
    <button type="button" onClick={onToggle} aria-expanded={open}
      className="w-full flex items-center gap-3 px-4 min-h-[56px] text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
      <Icon size={18} className="text-gray-700 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-900">{title}</span>
        {!open && <span className="block text-xs text-gray-600 truncate">{summary}</span>}
      </span>
      <ChevronDown size={18} className={`text-gray-500 shrink-0 ${open ? "rotate-180" : ""}`} />
    </button>
    {/* kept mounted (hidden) so a half-filled field never resets */}
    <div hidden={!open} className="px-4 pb-4 space-y-4">{children}</div>
  </section>
);

const chip = (active: boolean) =>
  `min-h-[44px] rounded-xl text-sm font-bold border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900`;

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

  const [openSection, setOpenSection] = useState<Record<string, boolean>>({ basics: true });
  const toggleSection = (k: string) => setOpenSection((o) => ({ ...o, [k]: !o[k] }));

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

      if (res.teacher_attached === false) {
        // the backend couldn't read our login: the contest has no owner, so it won't show in My contests
        toast.warning("Contest created without your account — log in again", { duration: 10000 });
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

  const durationLabel = durationOptions.find((o) => o.value === settings.duration)?.label || `${settings.duration} min`;
  const fmtLocal = (v: string | null) => (v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);
  const scheduleSummary = settings.scheduledAt || settings.expiresAt
    ? [fmtLocal(settings.scheduledAt) && `Opens ${fmtLocal(settings.scheduledAt)}`, fmtLocal(settings.expiresAt) && `closes ${fmtLocal(settings.expiresAt)}`].filter(Boolean).join(", ")
    : "Opens right away, no end time";
  const proctorSummary = [settings.enableCamera ? "Camera on" : "Camera off",
    settings.enableTabDetection ? `${settings.maxWarnings} tab switches` : "Tab switches not counted",
    settings.allowBackNavigation ? "back allowed" : "no going back"].join(" · ");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* phone: full-screen bottom sheet · desktop: dialog up to 90vh. One scroll area; header + footer fixed. */}
      <div role="dialog" aria-modal="true" aria-labelledby="create-contest-title"
        className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="shrink-0 border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="create-contest-title" className="text-lg font-extrabold text-gray-900">{step === "configure" ? "Create contest" : "Share contest"}</h2>
            <p className="text-xs text-gray-600 mt-0.5 truncate">{questions.length} questions · {totalMarks} marks · {subject}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-xl hover:bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: CONFIGURE */}
        {step === "configure" && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3">
              <Section title="Basics" summary={`${settings.title || "Untitled"} · ${durationLabel}`} open={!!openSection.basics} onToggle={() => toggleSection("basics")} icon={Clock}>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700">Contest title</span>
                  <input type="text" value={settings.title} onChange={(e) => updateSetting("title", e.target.value)}
                    className="mt-1 w-full px-4 min-h-[48px] rounded-xl border border-gray-300 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
                    placeholder="Enter contest title..." />
                </label>
                <div>
                  <span className="text-xs font-bold text-gray-700">Duration</span>
                  <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-label="Duration">
                    {durationOptions.map((opt) => (
                      <button key={opt.value} type="button" aria-pressed={settings.duration === opt.value}
                        onPointerUp={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; pickDuration(opt.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDuration(opt.value); } }}
                        className={chip(settings.duration === opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Schedule (optional)" summary={scheduleSummary} open={!!openSection.schedule} onToggle={() => toggleSection("schedule")} icon={CalendarClock}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-700">Opens at</span>
                    <input type="datetime-local" value={settings.scheduledAt || ""} onChange={(e) => { tapGuard.block(); updateSetting("scheduledAt", e.target.value || null); }}
                      onBlur={() => tapGuard.block()}
                      className="mt-1 w-full px-3 min-h-[48px] rounded-xl border border-gray-300 text-sm text-gray-900 outline-none focus:border-gray-900 bg-white" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-gray-700">Closes at</span>
                    <input type="datetime-local" value={settings.expiresAt || ""} min={settings.scheduledAt || undefined} onChange={(e) => { tapGuard.block(); updateSetting("expiresAt", e.target.value || null); }}
                      onBlur={() => tapGuard.block()}
                      className="mt-1 w-full px-3 min-h-[48px] rounded-xl border border-gray-300 text-sm text-gray-900 outline-none focus:border-gray-900 bg-white" />
                  </label>
                </div>
                <p className={`text-xs ${scheduleError ? "text-red-700 font-semibold" : "text-gray-600"}`}>
                  {scheduleError || "Leave empty to open the contest right away with no end time."}
                </p>
              </Section>

              <Section title="Results" summary={ANSWER_MODE_SHORT[settings.answerMode] === "Never" ? "Answers never shown" : `Answers: ${ANSWER_MODE_SHORT[settings.answerMode].toLowerCase()}`}
                open={!!openSection.results} onToggle={() => toggleSection("results")} icon={Trophy}>
                <div className="space-y-2" role="radiogroup" aria-label="Answer visibility">
                  {ANSWER_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = settings.answerMode === mode.value;
                    return (
                      <button key={mode.value} type="button" role="radio" aria-checked={isActive} onClick={() => updateSetting("answerMode", mode.value)}
                        className={`w-full flex items-center gap-3 p-3 min-h-[56px] rounded-xl border-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${isActive ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}>
                        <span className={`p-2 rounded-xl ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}><Icon size={18} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-gray-900">{mode.label}</span>
                          <span className="block text-xs text-gray-600">{mode.desc}</span>
                        </span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? "bg-gray-900 border-gray-900" : "border-gray-400"}`}>
                          {isActive && <Check size={12} className="text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {settings.answerMode !== "none" && (
                  <Toggle enabled={settings.showExplanation} onChange={(v) => updateSetting("showExplanation", v)} label="Show explanations" description="Explanations appear with the answers" icon={BookOpen} />
                )}
              </Section>

              <Section title="Proctoring" summary={proctorSummary} open={!!openSection.proctoring} onToggle={() => toggleSection("proctoring")} icon={Camera}>
                <div className="divide-y divide-gray-100">
                  <Toggle enabled={settings.enableCamera} onChange={(v) => updateSetting("enableCamera", v)} label="Camera" description="Students keep the front camera on" icon={Camera} />
                  <Toggle enabled={settings.enableTabDetection} onChange={(v) => updateSetting("enableTabDetection", v)} label="Count tab switches" description="Leaving the test page counts; at the limit it auto-submits" icon={Monitor} />
                  <Toggle enabled={settings.allowBackNavigation} onChange={(v) => updateSetting("allowBackNavigation", v)} label="Allow going back" description="Students can return to earlier questions" icon={Unlock} />
                </div>
                {settings.enableTabDetection && (
                  <div>
                    <span className="text-xs font-bold text-gray-700">Max tab switches before auto-submit</span>
                    <div className="mt-1 grid grid-cols-4 gap-2">
                      {[2, 3, 5, 10].map((n) => (
                        <button key={n} type="button" aria-pressed={settings.maxWarnings === n} onClick={() => updateSetting("maxWarnings", n)} className={chip(settings.maxWarnings === n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Attempts" summary={settings.maxAttempts === 1 ? "1 attempt per student" : `${settings.maxAttempts} attempts per student`}
                open={!!openSection.attempts} onToggle={() => toggleSection("attempts")} icon={Users}>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Attempts per student">
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" aria-pressed={settings.maxAttempts === n} onClick={() => updateSetting("maxAttempts", n)} className={chip(settings.maxAttempts === n)}>
                      {n} {n === 1 ? "attempt" : "attempts"}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {/* FOOTER — always visible */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-5 pt-3 flex gap-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <button type="button" onClick={onClose} className="flex-1 min-h-[48px] rounded-xl border-2 border-gray-300 text-gray-800 font-bold text-sm">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={isCreating || !!scheduleError}
                className="flex-[2] min-h-[48px] bg-gray-900 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {isCreating ? (<><Zap size={18} className="animate-spin" /> Creating…</>) : (<><Zap size={18} className="fill-yellow-400 text-yellow-400" /> Create contest · {durationLabel}</>)}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: SHARE */}
        {step === "share" && contestLink && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-extrabold text-gray-900">Contest created!</h3>
                <p className="text-xs text-gray-600 mt-1">Share the link with your students</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3 border border-gray-200">
                <Link2 size={18} className="text-gray-500 flex-shrink-0" />
                <span className="text-sm font-mono text-gray-800 truncate flex-1">{contestLink}</span>
                <button onClick={handleCopy} aria-label="Copy link"
                  className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${copied ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-200"}`}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={shareWhatsApp}
                  className="flex items-center gap-3 p-4 min-h-[64px] rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-left">
                  <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><MessageCircle size={20} /></span>
                  <span><span className="block text-sm font-bold text-gray-900">WhatsApp</span><span className="block text-[11px] text-gray-600">Share to groups</span></span>
                </button>
                <button onClick={handleCopy}
                  className="flex items-center gap-3 p-4 min-h-[64px] rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left">
                  <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Link2 size={20} /></span>
                  <span><span className="block text-sm font-bold text-gray-900">Copy link</span><span className="block text-[11px] text-gray-600">Share anywhere</span></span>
                </button>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Contest summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-600">Questions</p><p className="text-sm font-bold text-gray-900">{questions.length}</p></div>
                  <div><p className="text-xs text-gray-600">Duration</p><p className="text-sm font-bold text-gray-900">{settings.duration} min</p></div>
                  <div><p className="text-xs text-gray-600">Total marks</p><p className="text-sm font-bold text-gray-900">{totalMarks}</p></div>
                  <div><p className="text-xs text-gray-600">Answers</p><p className="text-sm font-bold text-gray-900">{ANSWER_MODE_SHORT[settings.answerMode]}</p></div>
                  <div><p className="text-xs text-gray-600">Camera</p><p className="text-sm font-bold text-gray-900">{settings.enableCamera ? "On" : "Off"}</p></div>
                  <div><p className="text-xs text-gray-600">Tab switches</p><p className="text-sm font-bold text-gray-900">{settings.enableTabDetection ? `Max ${settings.maxWarnings}` : "Off"}</p></div>
                </div>
              </div>

              <Link to="/contests/mine" onClick={onClose} className="flex items-center justify-center w-full min-h-[48px] text-sm font-bold text-gray-800 rounded-2xl border border-gray-300 hover:bg-gray-50">
                See results{settings.answerMode === "teacher_release" ? " & publish them" : ""} in My contests →
              </Link>
            </div>
            <div className="shrink-0 border-t border-gray-200 px-5 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <button onClick={onClose} className="w-full min-h-[48px] bg-gray-900 text-white font-bold text-sm rounded-xl">Done</button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default CreateContestModal;