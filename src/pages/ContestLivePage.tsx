import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from "framer-motion";
import { CheckCircle2, Lock, Video, AlertTriangle, Eye, Monitor, Timer as TimerIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
 * ContestLivePage — polished & proctored
 * - Animated setup gate with progress and camera permission
 * - Live mode: sticky header (contest name, timer, status), camera preview, question panel
 * - Tab-change detection with violation counter
 * - Gentle background glow + dark‑mode
 * - Safe submission with confirmation + beforeunload guard
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

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((q: any) => !!answers[q.id]),
    [questions, answers]
  );
  const progress = useMemo(() => (cameraGranted ? 100 : 34), [cameraGranted]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  const [contestGate, setContestGate] = useState<{ allowed: boolean; reason?: string; title?: string }>(
    { allowed: true }
  );

  // background glow
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bg = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, hsl(var(--primary)/0.08), transparent 70%),
    radial-gradient(800px 400px at calc(${mx}px + 220px) calc(${my}px + 140px), hsl(var(--primary)/0.06), transparent 70%)
  `;

  // Tab focus guard
  useEffect(() => {
    const onBlur = () => {
      setIsTabActive(false);
      setViolations((v) => v + 1);
      toast.warning("Tab change detected. Please stay on the contest tab.");
    };
    const onFocus = () => setIsTabActive(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
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
    setPermissionsOpen(false);
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

      {/* Sticky top bar when live */}
      {!permissionsOpen && (
        <div className="sticky top-0 z-30 mb-4">
          <div className="rounded-xl border bg-white/80 dark:bg-gray-900/70 backdrop-blur px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Live</Badge>
              <div className="font-medium">{contestGate.title || "Contest"}</div>
              <div className="ml-3 hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" /> Camera
                <Monitor className="ml-2 h-4 w-4" /> Tab monitor
                <AlertTriangle className="ml-2 h-4 w-4 text-amber-500" /> {violations} warnings
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TimerIcon className="h-4 w-4" />
              <Timer initialMinutes={meta?.durationMinutes ?? 30} onTimeUp={handleTimeUp} />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {permissionsOpen ? (
          <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto">
            <Card className="border border-indigo-100 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Contest Setup</CardTitle>
                    <CardDescription className="text-indigo-100">Complete these steps to join the competition</CardDescription>
                  </div>
                  <Lock className="h-6 w-6" />
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Setup Progress</span>
                    <span className="text-sm font-semibold text-indigo-600">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="grid gap-4">
                  <PermissionCard icon={<Video className="h-5 w-5 text-indigo-600" />} title="Camera Access" description="Required for identity verification" granted={cameraGranted}>
                    <CameraPermission onGranted={handleCameraGranted} />
                  </PermissionCard>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Important Notes</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                    <li>Ensure good lighting for your camera.</li>
                    <li>Close all unnecessary applications.</li>
                    <li>Disable notifications during the contest.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
            <Card className="border border-emerald-100 dark:border-emerald-900/40 shadow-xl overflow-hidden">
              <CardHeader className="bg-emerald-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Contest Started</CardTitle>
                    <CardDescription className="text-emerald-100">Good luck! The competition is now live.</CardDescription>
                  </div>
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 py-4">
                  {/* Left: camera + time */}
                  <div className="space-y-3">
                    <div className={`rounded-lg overflow-hidden border ${isTabActive ? "border-emerald-200 dark:border-emerald-800/60" : "border-amber-300 dark:border-amber-700/60"}`}>
                      <video ref={videoRef} className="w-full aspect-video bg-black" playsInline />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Status: {isTabActive ? "Focused" : "Tab switched"}</div>
                      <Badge variant="secondary">Warnings: {violations}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">Time Remaining</div>
                    <div className="text-3xl font-bold"><Timer initialMinutes={meta?.durationMinutes ?? 30} onTimeUp={handleTimeUp} /></div>
                  </div>

                  {/* Right: questions */}
                  <div>
                    {loading ? (
                      <div className="text-sm text-muted-foreground">Loading questions…</div>
                    ) : (
                      <QuestionPanel
                        questions={questions}
                        answers={answers}
                        currentIndex={idx}
                        onSelect={selectAnswer}
                        onPrev={() => setIdx((i) => Math.max(0, i - 1))}
                        onNext={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
                      />
                    )}

                    <div className="mt-6">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700" disabled={!allAnswered || submitting}>
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
    <Card className={`relative overflow-hidden ${granted ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/50" : ""}`}>
      {granted && (
        <div className="absolute top-2 right-2 bg-emerald-100 dark:bg-emerald-900/40 p-1 rounded-full">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">{icon}</div>
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
