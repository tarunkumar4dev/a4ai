import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from "framer-motion";
import {
  CheckCircle2,
  Lock,
  Video,
  AlertTriangle,
  Eye,
  Monitor,
  Timer as TimerIcon,
  ArrowRight,
  ArrowLeft,
  Grid,
  ShieldCheck,
  Maximize2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

// your components
import CameraPermission from "@/components/contest/CameraPermission";
import Timer from "@/components/contest/Timer";
import QuestionPanel from "@/components/contest/QuestionPanel";

// shadcn
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// hook comes from your codebase
import { useContestQuestions } from "@/hooks/useContestQuestions";

/**
 * ContestLivePage — Apple‑clean, modern, gradient UI (proctored)
 * Highlights:
 * - Glassy sticky header with gradient status chips & a single source of truth Timer
 * - Animated background with subtle sky/gray gradients (fits light & dark)
 * - Setup gate with progress + permission card
 * - Live mode: camera preview, question navigator grid, keyboard shortcuts, violations
 * - Tab/visibility monitoring + connection status + fullscreen helper
 * - Safer submission flow (confirm dialog, beforeunload guard)
 */

type PermissionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  granted: boolean;
  children: ReactNode;
};

export default function ContestLivePage() {
  const { contestId } = useParams();
  const contestCode = contestId;
  const navigate = useNavigate();

  const { questions, loading, meta } = useContestQuestions(contestCode);

  const [cameraGranted, setCameraGranted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isTabActive, setIsTabActive] = useState(true);
  const [permissionsOpen, setPermissionsOpen] = useState(true);
  const [violations, setViolations] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);

  // compute
  const answeredCount = useMemo(() =>
    questions.reduce((acc: number, q: any) => acc + (answers[q.id] ? 1 : 0), 0),
    [questions, answers]
  );
  const allAnswered = useMemo(() => questions.length > 0 && answeredCount === questions.length, [questions, answeredCount]);
  const progressSetup = useMemo(() => (cameraGranted ? 100 : 34), [cameraGranted]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  const [contestGate, setContestGate] = useState<{ allowed: boolean; reason?: string; title?: string }>({ allowed: true });

  // animated soft background
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bg = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, hsl(var(--primary)/0.08), transparent 60%),
    radial-gradient(800px 400px at calc(${mx}px + 220px) calc(${my}px + 140px), hsl(var(--primary)/0.06), transparent 65%),
    linear-gradient(to bottom, rgba(125, 211, 252, 0.08), rgba(203, 213, 225, 0.08))
  `;

  // Visibility & focus guard (more strict & accurate across OS)
  useEffect(() => {
    const onBlur = () => {
      setIsTabActive(false);
      setViolations(v => v + 1);
      toast.warning("Tab change detected. Please stay on the contest tab.");
    };
    const onFocus = () => setIsTabActive(true);
    const onVisibility = () => {
      if (document.hidden) {
        setIsTabActive(false);
        setViolations(v => v + 1);
        toast.warning("You left the contest view.");
      } else {
        setIsTabActive(true);
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Connection status (helps avoid accidental losses)
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Your changes will sync when reconnected.");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // fullscreen state watcher
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Prevent accidental close while contest running
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!submitting && cameraGranted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [submitting, cameraGranted]);

  // Gate check (is_live + time window)
  useEffect(() => {
    const gate = async () => {
      if (!contestCode) return;
      const { data, error } = await supabase
        .from("contests")
        .select("title,is_live,start_at,end_at")
        .eq("code", contestCode)
        .maybeSingle();

      if (error) {
        toast.error("Could not verify contest status.");
        setContestGate({ allowed: false, title: "Contest Locked", reason: "Server error. Try again." });
        return;
      }
      if (!data) {
        setContestGate({ allowed: false, title: "Contest Locked", reason: "Contest not found." });
        return;
      }

      const now = new Date();
      const start = data.start_at ? new Date(data.start_at) : undefined;
      const end = data.end_at ? new Date(data.end_at) : undefined;
      const within = (!start || now >= start) && (!end || now <= end);

      if (!data.is_live || !within) {
        setContestGate({
          allowed: false,
          title: data.title || "Contest Locked",
          reason: !data.is_live ? "Contest is not live." : "Outside contest window.",
        });
      } else {
        setContestGate({ allowed: true, title: data.title || "Contest" });
      }
    };

    gate();
    const t = setInterval(gate, 30_000);
    return () => clearInterval(t);
  }, [contestCode]);

  // Camera permission callback
  const handleCameraGranted = (stream?: MediaStream) => {
    setCameraGranted(true);
    // Wait for explicit Start Contest click instead of auto-entering live
    if (stream) {
      camStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const stopStreams = () => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
  };

  const selectAnswer = (qId: string, value: string) => setAnswers((prev) => ({ ...prev, [qId]: value }));

  const submitAttempt = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        toast.info("Please login first.");
        navigate("/dashboard");
        return;
      }
      const payloadAnswers = { ...answers, _meta: { email: user.email, violations } } as any;
      const { error } = await supabase
        .from("contest_attempts")
        .upsert({ user_id: user.id, contest_code: contestCode!, answers: payloadAnswers, score: null, submitted_at: new Date().toISOString() }, { onConflict: "user_id,contest_code" });
      if (error) throw error;
      stopStreams();
      toast.success("Submitted. You'll receive results by email.");
      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      toast.error("Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  const handleTimeUp = () => {
    toast.warning("⏱️ Time's up! Submitting your contest…");
    submitAttempt();
  };

  const goPrev = () => setIdx(i => Math.max(0, i - 1));
  const goNext = () => setIdx(i => Math.min(questions.length - 1, i + 1));
  const goTo = (i: number) => setIdx(Math.min(Math.max(i, 0), questions.length - 1));

  // keyboard shortcuts (←/→, S submit)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (permissionsOpen) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if ((e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) || e.key === "Enter") {
        e.preventDefault();
        if (allAnswered && !submitting) submitAttempt();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [permissionsOpen, allAnswered, submitting]);

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (_) {
      toast.info("Fullscreen not allowed by the browser.");
    }
  };

  if (!contestGate.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{contestGate.title || "Contest Locked"}</CardTitle>
            <CardDescription>{contestGate.reason}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 md:p-8" onMouseMove={onMove}>
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: bg }} />

      {/* Sticky header */}
      {!permissionsOpen && (
        <div className="sticky top-0 z-30 mb-4">
          <div className="rounded-2xl border bg-white/80 dark:bg-gray-900/75 backdrop-blur-xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40">Live</Badge>
              <div className="font-medium text-sm sm:text-base tracking-tight">{contestGate.title || "Contest"}</div>
              <div className="ml-2 hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />Camera</span>
                <span className="inline-flex items-center gap-1"><Monitor className="h-4 w-4" />Tab monitor</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Proctoring</span>
                <span className="inline-flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-500" />{violations} warnings</span>
                <span className="inline-flex items-center gap-1">{isOnline ? <Wifi className="h-4 w-4"/> : <WifiOff className="h-4 w-4"/>}{isOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TimerIcon className="h-4 w-4" />
              <Timer initialMinutes={meta?.durationMinutes ?? 30} onTimeUp={handleTimeUp} />
              <Button variant="outline" size="sm" className="ml-2" onClick={requestFullscreen}>
                <Maximize2 className="h-4 w-4 mr-1" /> {isFullscreen ? "Fullscreen on" : "Go fullscreen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {permissionsOpen ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="border border-sky-100 shadow-xl overflow-hidden rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold tracking-tight">Contest Setup</CardTitle>
                    <CardDescription className="text-slate-200/80">Complete these steps to join the competition</CardDescription>
                  </div>
                  <Lock className="h-6 w-6" />
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Setup Progress</span>
                    <span className="text-sm font-semibold text-sky-700">{progressSetup}%</span>
                  </div>
                  <Progress value={progressSetup} className="h-2" />
                </div>

                <div className="grid gap-4">
                  <PermissionCard
                    icon={<Video className="h-5 w-5 text-sky-600" />}
                    title="Camera Access"
                    description="Required for identity verification"
                    granted={cameraGranted}
                  >
                    <CameraPermission onGranted={handleCameraGranted} />
                  </PermissionCard>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FeatureCallout icon={<ShieldCheck className="h-4 w-4" />} title="Proctored Environment" text="Tab monitoring and camera are enabled during the contest." />
                  <FeatureCallout icon={<Grid className="h-4 w-4" />} title="Quick Navigation" text="Use ← / → to move between questions. Ctrl/Cmd + S to submit." />
                </div>

                <div className="bg-sky-50 dark:bg-sky-950/40 p-4 rounded-lg border border-sky-100 dark:border-sky-900/40">
                  <h4 className="font-medium text-sky-800 dark:text-sky-200 mb-2">Important Notes</h4>
                  <ul className="text-sm text-sky-700 dark:text-sky-300 space-y-1 list-disc list-inside">
                    <li>Ensure good lighting for your camera.</li>
                    <li>Close all unnecessary applications and notifications.</li>
                    <li>Do not switch tabs or minimize the window.</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 dark:bg-slate-900/30 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
                <Button onClick={() => setPermissionsOpen(false)} disabled={!cameraGranted} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Start Contest
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-sky-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold tracking-tight">Contest Started</CardTitle>
                    <CardDescription className="text-white/80">Good luck! The competition is now live.</CardDescription>
                  </div>
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8 py-2">
                  {/* Left Column: camera + quick stats + navigator */}
                  <div className="space-y-4">
                    <div className={`rounded-xl overflow-hidden border ${isTabActive ? "border-emerald-200 dark:border-emerald-800/60" : "border-amber-300 dark:border-amber-700/60"}`}>
                      <video ref={videoRef} className="w-full aspect-video bg-black" playsInline />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <StatTile label="Status" value={isTabActive ? "Focused" : "Tab switched"} subtle />
                      <StatTile label="Warnings" value={String(violations)} />
                      <StatTile label="Answered" value={`${answeredCount}/${questions.length || 0}`} />
                      <StatTile label="Connectivity" value={isOnline ? "Online" : "Offline"} subtle />
                    </div>

                    {/* Question Navigator */}
                    <Navigator
                      total={questions.length}
                      currentIndex={idx}
                      answeredMap={questions.map((q: any) => !!answers[q.id])}
                      onJump={goTo}
                    />
                  </div>

                  {/* Right Column: questions */}
                  <div>
                    {loading ? (
                      <div className="text-sm text-muted-foreground">Loading questions…</div>
                    ) : (
                      <QuestionPanel
                        questions={questions}
                        answers={answers}
                        currentIndex={idx}
                        onSelect={selectAnswer}
                        onPrev={goPrev}
                        onNext={goNext}
                      />
                    )}

                    {/* Action Bar */}
                    <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1 hidden sm:block">
                        <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} className="h-2" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={goPrev} disabled={idx === 0}><ArrowLeft className="h-4 w-4 mr-1"/>Prev</Button>
                        <Button variant="outline" onClick={goNext} disabled={idx >= questions.length - 1}>Next<ArrowRight className="h-4 w-4 ml-1"/></Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white" disabled={!allAnswered || submitting}>
                              {submitting ? "Submitting…" : allAnswered ? "Submit Answers" : "Answer all to submit"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. Your camera stream will stop and your attempt will be recorded.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={submitAttempt}>Submit</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PermissionCard({ icon, title, description, granted, children }: PermissionCardProps) {
  return (
    <Card className={`relative overflow-hidden rounded-xl ${granted ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/50" : ""}`}>
      {granted && (
        <div className="absolute top-2 right-2 bg-emerald-100 dark:bg-emerald-900/40 p-1 rounded-full">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/40 rounded-full">{icon}</div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {granted ? (
          <Button variant="outline" className="w-full" disabled>
            Permission Granted
          </Button>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Helper UI ---------- */
function FeatureCallout({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-white/60 dark:bg-gray-900/40 backdrop-blur p-4 flex items-start gap-3">
      <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 dark:from-sky-900/30 dark:to-emerald-900/20">{icon}</div>
      <div>
        <div className="font-medium leading-tight">{title}</div>
        <div className="text-sm text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}

function StatTile({ label, value, subtle }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${subtle ? "bg-slate-50/80 dark:bg-slate-900/30" : "bg-white/60 dark:bg-gray-900/40"} backdrop-blur`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Navigator({ total, currentIndex, answeredMap, onJump }: { total: number; currentIndex: number; answeredMap: boolean[]; onJump: (i: number) => void; }) {
  if (!total) return null;
  return (
    <div className="rounded-xl border bg-white/60 dark:bg-gray-900/40 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium inline-flex items-center gap-2"><Grid className="h-4 w-4"/>Question Navigator</div>
        <div className="text-xs text-muted-foreground">Use ← / → to move</div>
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-8 gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const active = i === currentIndex;
          const answered = answeredMap[i];
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={`aspect-square text-xs rounded-lg border flex items-center justify-center select-none transition-all
                ${active ? "border-slate-900 bg-slate-900 text-white" : answered ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 hover:bg-slate-50"}
              `}
              aria-current={active}
              aria-label={`Go to question ${i + 1}${answered ? ", answered" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
