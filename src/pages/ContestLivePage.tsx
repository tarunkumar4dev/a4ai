import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Lock, Video } from "lucide-react";
import CameraPermission from "@/components/contest/CameraPermission";
import ScreenSharePermission from "@/components/contest/ScreenSharePermission";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import Timer from "@/components/contest/Timer";
import QuestionPanel from "@/components/contest/QuestionPanel";
import { toast } from "sonner";
import { useContestQuestions } from "@/hooks/useContestQuestions";
import { supabase } from "@/lib/supabaseClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function ContestLivePage() {
  const { contestId } = useParams();
  const contestCode = contestId;
  const navigate = useNavigate();
  const { questions, loading } = useContestQuestions(contestCode);

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const progress = useMemo(() => cameraGranted ? 100 : 0, [cameraGranted]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const allAnswered = useMemo(() => questions.length > 0 && questions.every(q => !!answers[q.id]), [questions, answers]);
  const [contestGate, setContestGate] = useState<{ allowed: boolean; reason?: string }>({ allowed: true });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);

  useEffect(() => {
    const onBlur = () => { setIsTabActive(false); toast.warning('Tab change detected. Please stay on the contest tab.'); };
    const onFocus = () => setIsTabActive(true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const gate = async () => {
      if (!contestCode) return;
      const { data } = await supabase
        .from('contests')
        .select('is_live,start_at,end_at')
        .eq('code', contestCode)
        .maybeSingle();
      if (!data) return;
      const now = new Date();
      const start = data.start_at ? new Date(data.start_at) : undefined;
      const end = data.end_at ? new Date(data.end_at) : undefined;
      const within = (!start || now >= start) && (!end || now <= end);
      if (!data.is_live || !within) {
        setContestGate({ allowed: false, reason: !data.is_live ? 'Contest is not live.' : 'Outside contest window.' });
      } else {
        setContestGate({ allowed: true });
      }
    };
    gate();
  }, [contestCode]);

  const handleCameraGranted = (stream?: MediaStream) => {
    setCameraGranted(true);
    setPermissionsGranted(true); // Auto-grant permissions since screen share is not required
    if (stream) {
      camStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const stopStreams = () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
  };

  const selectAnswer = (qId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [qId]: value }));

  const submitAttempt = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/dashboard");   
      return;
    }

    const payloadAnswers = { ...answers, _meta: { email: user.email } } as any;

    await supabase
      .from("contest_attempts")
      .upsert(
        {
          user_id: user.id,
          contest_code: contestCode!,
          answers: payloadAnswers,
          score: null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "user_id,contest_code" }
      );

    stopStreams();
    toast.success("Submitted. You'll receive results by email.");
    navigate("/dashboard");
  };

  const handleTimeUp = () => {
    toast.warning("⏱️ Time's up! Submitting your contest...");
    submitAttempt();
  };

  const handleSubmit = () => {
    if (!allAnswered) {
      toast.warning('Please answer all questions before submitting.');
      return;
    }
    submitAttempt();
  };

  if (!contestGate.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Contest Locked</CardTitle>
            <CardDescription>{contestGate.reason}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <AnimatePresence mode="wait">
        {!permissionsGranted ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="max-w-3xl mx-auto">
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
                    <span className="text-sm font-medium text-gray-600">Setup Progress</span>
                    <span className="text-sm font-semibold text-indigo-600">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="grid gap-4">
                  <PermissionCard icon={<Video className="h-5 w-5 text-indigo-600" />} title="Camera Access" description="Required for identity verification" granted={cameraGranted}>
                    <CameraPermission onGranted={handleCameraGranted} />
                  </PermissionCard>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">Important Notes:</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Ensure good lighting for your camera</li>
                    <li>Close all unnecessary applications</li>
                    <li>Disable notifications during the contest</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
            <Card className="border border-green-100 shadow-xl overflow-hidden">
              <CardHeader className="bg-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Contest Started</CardTitle>
                    <CardDescription className="text-green-100">Good luck! The competition is now live.</CardDescription>
                  </div>
                  <CheckCircle className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-8 py-6">
                  <div className="space-y-3">
                    <div className={`rounded-lg overflow-hidden border ${isTabActive ? 'border-green-200' : 'border-amber-300'}`}>
                      <video ref={videoRef} className="w-full aspect-video bg-black" playsInline />
                    </div>
                    {!isTabActive && (
                      <div className="text-amber-700 text-sm">Warning: stay on this tab during the contest.</div>
                    )}
                    <div className="text-sm text-gray-600">Time Remaining</div>
                    <div className="text-3xl font-bold text-gray-800">
                      <Timer initialMinutes={30} onTimeUp={handleTimeUp} />
                    </div>
                  </div>

                  <div>
                    {loading ? (
                      <div className="text-sm text-gray-500">Loading questions…</div>
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
                          <Button size="lg" className={`bg-indigo-600 hover:bg-indigo-700 ${!allAnswered ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={handleSubmit} disabled={!allAnswered}>
                            Submit Answers
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will submit your contest answers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setIsTabActive(true)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
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

function PermissionCard({ icon, title, description, granted, children }) {
  return (
    <Card className={`relative overflow-hidden ${granted ? "border-green-200 bg-green-50" : ""}`}>
      {granted && (
        <div className="absolute top-2 right-2 bg-green-100 p-1 rounded-full">
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 rounded-full">{icon}</div>
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