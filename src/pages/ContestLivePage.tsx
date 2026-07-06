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

/**
 * ContestLivePage — BACKEND-WIRED
 *
 * WHY THIS VERSION EXISTS:
 * The previous file only fixed Supabase column names but still wrote directly
 * to `contest_attempts` with NO score. That meant contest_service._calculate_score
 * never ran → score stayed NULL → leaderboard empty. This version routes through
 * the backend so the server computes the score.
 *
 * CHANGES vs previous:
 * 1. Questions no longer come from useContestQuestions (which leaked correct
 *    answers and used the wrong table). They now come from POST /contests/{code}/start,
 *    which returns questions WITHOUT correct answers + an attempt_id.
 * 2. submitAttempt() now calls POST /contests/{contest_id}/submit with X-Attempt-Id.
 *    Backend calculates score/total_marks/percentage and fills the leaderboard.
 * 3. Real time_taken_seconds is tracked from start.
 * 4. Gate check still reads contest status (no answers, so no leak) to show
 *    the locked screen before the student starts.
 *
 * ⚠️ ADJUST IF NEEDED:
 * - API_BASE assumes VITE_API_URL is the server root (e.g. https://api.a4ai.in).
 *   If your VITE_API_URL already includes /api/v1, remove it from API_BASE below.
 * - QuestionPanel must accept the question shape produced by mapApiQuestion().
 *   If questions don't render, send me QuestionPanel.tsx and I'll match the shape.
 */

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

type PermissionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  granted: boolean;
  children: ReactNode;
};

type SubmitState = "idle" | "sync" | "retry" | "done";

// Normalize a backend ContestQuestionOut into the shape QuestionPanel expects.
// Keeps both snake_case and camelCase so it works whichever your panel reads.
function mapApiQuestion(q: any) {
  return {
    ...q,
    id: String(q.id),
    questionNumber: q.question_number,
    questionText: q.question_text,
    type: q.question_type,
    question_type: q.question_type,
    options: q.options || [],
    marks: q.marks,
    difficulty: q.difficulty,
    chapter: q.chapter,
  };
}

export default function ContestLivePage() {
  const { contestId } = useParams();
  const contestCode = contestId; // this is the short_code from URL
  const navigate = useNavigate();

  // Questions now come from the backend /start call (not a hook)
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [cameraGranted, setCameraGranted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const [isTabActive, setIsTabActive] = useState(true);
  const [permissionsOpen, setPermissionsOpen] = useState(true);
  const [starting, setStarting] = useState(false);
  const [violations, setViolations] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);

  // Attempt state from backend /start
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [contestDbId, setContestDbId] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Cached contest metadata from gate check (for the locked screen + duration)
  const [contestMeta, setContestMeta] = useState<{
    dbId: string;
    title: string;
    durationMinutes: number;
    answerMode: string;
    maxWarnings: number;
  } | null>(null);

  // compute
  const answeredCount = useMemo(
    () => questions.reduce((acc: number, q: any) => acc + (answers[q.id] ? 1 : 0), 0),
    [questions, answers]
  );
  const allAnswered = useMemo(
    () => questions.length > 0 && answeredCount === questions.length,
    [questions.length, answeredCount]
  );
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

  // Visibility & focus guard
  useEffect(() => {
    const onBlur = () => {
      setIsTabActive(false);
      setViolations((v) => v + 1);
      toast.warning("Tab change detected. Please stay on the contest tab.");
    };
    const onFocus = () => setIsTabActive(true);
    const onVisibility = () => {
      if (document.hidden) {
        setIsTabActive(false);
        setViolations((v) => v + 1);
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

  // Connection status
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

  // Prevent accidental close while a live attempt isn't submitted
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (attemptId && submitState !== "done") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [attemptId, submitState]);

  // Helper: current Supabase access token (for backend auth), if logged in
  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // Gate check — reads contest status only (NO answers → no leak)
  useEffect(() => {
    const gate = async () => {
      if (!contestCode) return;

      const { data, error } = await supabase
        .from("contests")
        .select("id, title, status, scheduled_at, expires_at, duration_minutes, answer_mode, max_warnings")
        .eq("short_code", contestCode)
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

      setContestMeta({
        dbId: data.id,
        title: data.title,
        durationMinutes: data.duration_minutes || 30,
        answerMode: data.answer_mode || "after_test",
        maxWarnings: data.max_warnings || 3,
      });

      const now = new Date();
      const scheduled = data.scheduled_at ? new Date(data.scheduled_at) : undefined;
      const expires = data.expires_at ? new Date(data.expires_at) : undefined;

      const isActive = data.status === "active";
      const withinWindow = (!scheduled || now >= scheduled) && (!expires || now <= expires);

      if (!isActive || !withinWindow) {
        setContestGate({
          allowed: false,
          title: data.title || "Contest Locked",
          reason: !isActive
            ? "Contest is not currently active."
            : "Contest is outside the scheduled window.",
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

  const selectAnswer = (qId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [qId]: value }));

  // ----------------- START ATTEMPT (backend) -----------------
  // Called when the student clicks "Start Contest". Creates the attempt on the
  // server and pulls questions WITHOUT correct answers.
  const startContest = async () => {
    if (!contestCode) return;
    setStarting(true);
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // NOTE: contests here require login (proctored). If you want anonymous
      // link-based attempts, drop this block and collect name/email via a form.
      if (!user) {
        toast.info("Please login first.");
        navigate("/dashboard");
        return;
      }

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/contests/${contestCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          student_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
          student_email: user.email,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Could not start the contest.");
      }

      const data = await res.json(); // ContestDataResponse

      setAttemptId(String(data.attempt_id));
      setContestDbId(String(data.contest_id));
      setQuestions((data.questions || []).map(mapApiQuestion));
      startedAtRef.current = Date.now();
      setPermissionsOpen(false);
    } catch (e: any) {
      console.error("start error:", e);
      toast.error(e?.message || "Could not start the contest.");
    } finally {
      setStarting(false);
      setLoading(false);
    }
  };

  // ----------------- SUBMIT ATTEMPT (backend — server scores) -----------------
  const submitAttempt = async () => {
    if (submitState === "sync" || submitState === "done") return;
    if (!attemptId || !contestDbId) {
      toast.error("Attempt not initialized. Please refresh and start again.");
      return;
    }

    setSubmitState("sync");
    setSubmitMsg("Submitting your answers…");

    const formattedAnswers = Object.entries(answers).map(([questionId, selected]) => ({
      questionId,
      selected,
    }));

    const warningLog = violations > 0 ? [`Tab switches detected: ${violations}`] : [];
    const timeTaken = startedAtRef.current
      ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0;

    const doSubmit = async (): Promise<boolean> => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/contests/${contestDbId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Attempt-Id": attemptId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          answers: formattedAnswers,
          warning_count: violations,
          warning_log: warningLog,
          time_taken_seconds: timeTaken,
        }),
      });

      if (res.ok) {
        const result = await res.json(); // { score, total_marks, percentage, ... }
        stopStreams();
        setSubmitState("done");
        setSubmitMsg("✅ Submitted. You can close the window.");
        toast.success(`Submitted! Score: ${result.score}/${result.total_marks}`);
        setTimeout(() => {
          navigate(`/contest/${contestCode}/results`, { state: { result } });
        }, 1200);
        return true;
      }

      // If the attempt was already submitted on a prior try, treat as success.
      const err = await res.json().catch(() => ({}));
      if (res.status === 400 && String(err.detail || "").toLowerCase().includes("already submitted")) {
        stopStreams();
        setSubmitState("done");
        setSubmitMsg("✅ Already submitted.");
        setTimeout(() => navigate(`/contest/${contestCode}/results`), 1200);
        return true;
      }

      throw new Error(err.detail || `Submit failed (${res.status})`);
    };

    try {
      await doSubmit();
    } catch (e1) {
      // one background retry (attempt is still in_progress on the server, so safe)
      console.warn("Submit retry due to:", e1);
      setSubmitState("retry");
      setSubmitMsg("Syncing to server… retrying.");
      try {
        await new Promise((r) => setTimeout(r, 4000));
        await doSubmit();
      } catch (e2) {
        console.error("Submit failed after retry:", e2);
        setSubmitState("idle");
        setSubmitMsg("");
        toast.error("Submission failed. Please check your connection and try again.");
      }
    }
  };

  const handleTimeUp = () => {
    toast.warning("⏱️ Time's up! Submitting your contest…");
    submitAttempt();
  };

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(questions.length - 1, i + 1));
  const goTo = (i: number) => setIdx(Math.min(Math.max(i, 0), questions.length - 1));

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (permissionsOpen) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if ((e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) || e.key === "Enter") {
        e.preventDefault();
        if (allAnswered && submitState !== "done") submitAttempt();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [permissionsOpen, allAnswered, submitState]);

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
              <Timer initialMinutes={contestMeta?.durationMinutes ?? 30} onTimeUp={handleTimeUp} />
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
                <Button
                  onClick={startContest}
                  disabled={!cameraGranted || starting}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {starting ? "Starting…" : "Start Contest"}
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

                    <Navigator
                      total={questions.length}
                      currentIndex={idx}
                      answeredMap={questions.map((q: any) => !!answers[q.id])}
                      onJump={goTo}
                    />
                  </div>

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

                    <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1 hidden sm:block">
                        <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} className="h-2" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={goPrev} disabled={idx === 0}><ArrowLeft className="h-4 w-4 mr-1"/>Prev</Button>
                        <Button variant="outline" onClick={goNext} disabled={idx >= questions.length - 1}>Next<ArrowRight className="h-4 w-4 ml-1"/></Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="lg"
                              className="bg-slate-900 hover:bg-slate-800 text-white"
                              disabled={!allAnswered || submitState === "done"}
                            >
                              {submitState === "sync" || submitState === "retry"
                                ? "Submitting…"
                                : allAnswered
                                  ? "Submit Answers"
                                  : "Answer all to submit"}
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

                    {submitMsg && (
                      <div className="mt-2 text-xs text-muted-foreground">{submitMsg}</div>
                    )}
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