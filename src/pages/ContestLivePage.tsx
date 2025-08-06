import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Lock, Video, Monitor } from "lucide-react";
import CameraPermission from "@/components/contest/CameraPermission";
import ScreenSharePermission from "@/components/contest/ScreenSharePermission";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useParams } from "react-router-dom";
import Timer from "@/components/contest/Timer";
import QuestionPanel from "@/components/contest/QuestionPanel";
import { toast } from "sonner";

export default function ContestLivePage() {
  const { code: contestId } = useParams();
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [screenGranted, setScreenGranted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!permissionsGranted) {
      const timer = setTimeout(() => {
        const newProgress = progress + 25;
        setProgress(newProgress > 100 ? 100 : newProgress);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [progress, permissionsGranted]);

  const handleCameraGranted = () => {
    setCameraGranted(true);
    if (screenGranted) setPermissionsGranted(true);
  };

  const handleScreenGranted = () => {
    setScreenGranted(true);
    if (cameraGranted) setPermissionsGranted(true);
  };

  const handleTimeUp = () => {
    toast.warning("⏱️ Time's up! Submitting your contest...");
    // TODO: Auto-submit logic
  };

  const handleSubmit = () => {
    toast.success("✅ Contest submitted successfully!");
    // TODO: Manual submit logic
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <AnimatePresence mode="wait">
        {!permissionsGranted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-indigo-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Contest Setup</CardTitle>
                    <CardDescription className="text-indigo-100">
                      Complete these steps to join the competition
                    </CardDescription>
                  </div>
                  <Lock className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Setup Progress
                    </span>
                    <span className="text-sm font-semibold text-indigo-600">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <PermissionCard
                    icon={<Video className="h-5 w-5 text-indigo-600" />}
                    title="Camera Access"
                    description="Required for identity verification"
                    granted={cameraGranted}
                  >
                    <CameraPermission onGranted={handleCameraGranted} />
                  </PermissionCard>

                  <PermissionCard
                    icon={<Monitor className="h-5 w-5 text-indigo-600" />}
                    title="Screen Sharing"
                    description="Required to monitor your work"
                    granted={screenGranted}
                  >
                    <ScreenSharePermission onGranted={handleScreenGranted} />
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Contest Started</CardTitle>
                    <CardDescription className="text-green-100">
                      Good luck! The competition is now live.
                    </CardDescription>
                  </div>
                  <CheckCircle className="h-6 w-6" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-full max-w-md aspect-video bg-black rounded-lg overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <Video className="h-12 w-12" />
                    </div>
                  </div>

                  <Timer initialMinutes={30} onTimeUp={handleTimeUp} />

                  <QuestionPanel contestId={contestId!} />

                  <Button
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={handleSubmit}
                  >
                    Submit Answers
                  </Button>
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
