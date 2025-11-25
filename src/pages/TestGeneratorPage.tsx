// /src/pages/TestGeneratorPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/DashboardSidebar";
import TestGeneratorForm, { TestGeneratorFormValues } from "@/components/TestGeneratorForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTest } from "@/lib/generateTest";
import { fetchRecentPapers, type PaperRow } from "@/lib/history";
import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, Sparkles, Loader2, ArrowRight, FileText, FileSpreadsheet, Zap, CheckCircle, ArrowLeft } from "lucide-react"; // Added CheckCircle, Zap, ArrowLeft
import { uploadReferenceFiles } from "@/lib/uploadRefs";
import { buildEdgePayload } from "@/lib/mapFormToEdge";
import { useNavigate } from "react-router-dom";

/* ----------------------------- Types ----------------------------- */
type LastMeta = { subject?: string; difficulty?: string; qCount?: number } | null;

type Links = {
  pdf?: string | null;
  docx?: string | null;
  csv?: string | null;
  legacy?: string | null;
};

/* --------------------------- Helpers ---------------------------- */
const mapDifficulty = (d?: string) => {
  if (!d) return "Easy";
  const v = d.trim().toLowerCase();
  if (v === "easy") return "Easy";
  if (v === "medium") return "Medium";
  if (v === "hard") return "Hard";
  return d.charAt(0).toUpperCase() + d.slice(1);
};

const mapQuestionType = (t?: string) => {
  if (!t) return "Multiple Choice";
  const v = t.trim().toLowerCase();
  if (["mcq", "multiplechoice", "multiple choice"].includes(v)) return "Multiple Choice";
  if (["short", "short answer", "shortanswer"].includes(v)) return "Short Answer";
  return "Mixed";
};

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "-");

// --- NEW COMPONENT: GenerationRoomPopup ---
interface GenerationRoomProps {
  elapsedSec: number;
  lastMeta: LastMeta;
  progress: number;
}

const GenerationRoomPopup = ({ elapsedSec, lastMeta, progress }: GenerationRoomProps) => {
  const steps = [
    "Analysing Blueprint",
    "Fetching Best Questions",
    "Refining Context & Tone",
    "Formatting Documents (PDF/DOCX)",
    "Final Touches (Quality Assurance)",
  ];
  
  // Calculate which step is currently active (very simple mapping for visual effect)
  const currentStepIndex = Math.floor(Math.min(progress / 20, 4));

  // Placeholder for Time Saved (adjust calculation as needed)
  const timeSaved = Math.max(1, Math.round((elapsedSec * 1.8) + (lastMeta?.qCount || 5) * 0.5));
  const minutesSaved = Math.floor(timeSaved);
  const secondsSaved = Math.round((timeSaved - minutesSaved) * 60);

  // Animation variants for the main card (using your wireframe description)
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
    exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Gradient Ring (Visual reinforcement of premium quality) */}
      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full bg-gradient-to-r from-sky-500/50 via-indigo-600/50 to-violet-500/50 blur-3xl opacity-50"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Center Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(2,8,23,.2)] ring-1 ring-black/5"
      >
        <div className="text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-800">A4AI Generation Room</h2>
          <p className="text-sm text-slate-500 mt-1">Generating your paper now...</p>
        </div>

        {/* Floating Cards Animation Area (Placeholder) */}
        <div className="my-6 h-16 flex items-center justify-center">
          <motion.div
            className="px-4 py-2 bg-indigo-500/10 text-indigo-700 font-medium rounded-full text-sm"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.5 }}
          >
            {lastMeta?.subject || "New Paper"} • {lastMeta?.difficulty || "Medium"} • {lastMeta?.qCount || 5} Qs
          </motion.div>
        </div>

        {/* 5-Step Progress Lines */}
        <div className="space-y-3 mb-8">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <CheckCircle className={`h-4 w-4 transition-colors ${index <= currentStepIndex ? "text-green-500" : "text-slate-300"}`} />
              <p className={`text-sm transition-opacity ${index <= currentStepIndex ? "font-medium text-slate-700" : "text-slate-400"}`}>
                {step}
              </p>
            </div>
          ))}
        </div>
        
        {/* Time Saved Meter (Micro-Gamification) */}
        <motion.div
          className="p-4 bg-slate-50 rounded-xl text-center border-t"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <div className="text-xs text-slate-500">Approx. Time Saved:</div>
          <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
            {minutesSaved}<span className="text-xl font-semibold">m</span> {secondsSaved}<span className="text-xl font-semibold">s</span>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Sit back, we're crafting your high-quality test ✨ (Elapsed: {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")})
        </p>
      </motion.div>
    </motion.div>
  );
};
// --- END NEW COMPONENT ---


/* ------------------------------ Page ---------------------------- */
const TestGeneratorPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // generation state
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // <--- NEW STATE FOR POPUP
  const [links, setLinks] = useState<Links>({});
  const [lastMeta, setLastMeta] = useState<LastMeta>(null);

  // timer/progress
  const [elapsedSec, setElapsedSec] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);

  // History state
  const [rows, setRows] = useState<PaperRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Handle back navigation
  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  /* --------- Refresh history from DB --------- */
  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const r = await fetchRecentPapers(20);
      setRows(r);
    } catch (e: any) {
      console.error("History error:", e);
      toast({
        title: "History issue",
        description: String(e?.message || e),
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // cleanup object URLs when links change/unmount
  useEffect(() => {
    return () => {
      const all = [links.legacy, links.pdf, links.docx, links.csv].filter((u): u is string => !!u);
      all.forEach((u) => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      });
    };
  }, [links]);

  /* --------- Timer/Progress orchestration --------- */
  useEffect(() => {
    if (loading) {
      // Timer setup (Kept for the GenerationRoom elapsed time display)
      setElapsedSec(0);
      setProgress(0);
      timerRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000) as unknown as number;

      // Progress bar calculation (Kept for GenerationRoom progress steps)
      const start = performance.now();
      const expectedMs = 75_000;
      const hardLimitMs = 95_000;

      progressRef.current = window.setInterval(() => {
        const t = performance.now() - start;
        const x = Math.min(t / expectedMs, 1);
        const eased = 1 - Math.pow(1 - x, 2);
        let pct = Math.min(95, Math.round(eased * 90 + 5));
        if (t > expectedMs) {
          const extra = Math.min((t - expectedMs) / (hardLimitMs - expectedMs), 1);
          pct = Math.min(95, Math.round(90 + extra * 5));
        }
        setProgress(pct);
      }, 300) as unknown as number;
    } else {
      // Cleanup
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
      setProgress((p) => (p > 0 ? 100 : 0));
      const id = window.setTimeout(() => setProgress(0), 1200);
      return () => clearTimeout(id);
    }
  }, [loading]);

  /* --------- Generate handler --------- */
  const handleGenerateTest = async (
    formData: TestGeneratorFormValues
  ): Promise<string | null> => {
    try {
      // 1. Show the Immersive Popup
      setIsGenerating(true); 
      setLoading(true); // Start the timer/progress calculation
      setLinks({});

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Login required", description: "Please sign in." });
        throw new Error("Not logged in");
      }

      // Create a requestId to link refs & DB rows
      const requestId =
        (globalThis.crypto && "randomUUID" in globalThis.crypto)
          ? (globalThis.crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      // Upload reference files
      const ref_files = await uploadReferenceFiles(formData.referenceFiles || [], user.id, requestId);

      // Build an Edge payload
      const payload = buildEdgePayload(formData, user.id, requestId, ref_files);

      // (Back-compat helpers for the history card summary)
      const qCount =
        payload["qCount"] ??
        (Array.isArray(payload["sections"]) ? (payload["sections"] as any[]).reduce((s, x) => s + (x?.count || 0), 0) : undefined) ??
        (Array.isArray(formData.markingMatrix) ? formData.markingMatrix.reduce((s, x) => s + (x.count || 0), 0) : formData.qCount) ??
        5;

      const difficulty = mapDifficulty(formData?.difficulty);
      const subject = (formData?.subject || "Paper").trim();
      setLastMeta({ subject, difficulty, qCount }); // Set meta data before generation

      // Hit the generator
      const res = await generateTest(payload as any, { timeoutMs: 120_000, retries: 2 });

      const pdfUrl = (res as any)?.pdfUrl || (res as any)?.publicUrl || (res as any)?.url || null;
      const docxUrl = (res as any)?.docxUrl || null;
      const csvUrl = (res as any)?.csvUrl || null;
      const legacy = !pdfUrl && (res as any)?.url ? (res as any).url : null;

      if (!pdfUrl && !legacy) throw new Error("File URL missing in response");

      setLinks({ pdf: pdfUrl, docx: docxUrl, csv: csvUrl, legacy });
      
      await refreshHistory();
      toast({ title: "Generated 🎉", description: "Your paper is ready to download." });
      return pdfUrl || legacy;
    } catch (err: any) {
      console.error("Generation Error:", err);
      toast({
        title: "Failed",
        description: String(err?.message || err) || "Could not generate test.",
        variant: "destructive",
      });
      return null;
    } finally {
      // 2. Hide the Popup and Stop timer
      setLoading(false); 
      setIsGenerating(false); 
    }
  };

  /* ------------------------------ UI ------------------------------- */
  return (
    <div className="flex h-screen text-slate-900 bg-[#DFE4EF]">
      {/* 3. Immersive Popup Injection */}
      <AnimatePresence>
        {isGenerating && (
          <GenerationRoomPopup 
            elapsedSec={elapsedSec} 
            lastMeta={lastMeta} 
            progress={progress} 
          />
        )}
      </AnimatePresence>
      
      {/* subtle grid on background */}
      <div className="fixed inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left Section - Back Button & Title */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Back Button */}
                <button
                  onClick={handleBack}
                  className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-white/80 hover:bg-white border shadow-sm hover:shadow-md transition-all active:scale-95"
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} className="text-slate-700" />
                </button>

                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-sm flex-shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl font-bold leading-tight bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 bg-clip-text text-transparent truncate">
                      Test Generator
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 truncate">As Fast as Light</p>
                  </div>
                </div>
              </div>

              {/* Right Section - Optional actions can be added here */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Future actions can be placed here */}
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Tabs */}
            <Tabs defaultValue="test-generator" className="w-full">
              <TabsList className="relative grid grid-cols-2 bg-slate-100/70 rounded-xl overflow-hidden p-1">
                <TabsTrigger value="test-generator">Generate</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* Generate */}
              <TabsContent value="test-generator">
                <motion.section
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="bg-white/85 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-[0_8px_24px_rgba(2,8,23,.06)] ring-1 ring-black/5 mt-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-semibold">Create New Test</h2>
                    {/* OLD progress indicator removed as the GenerationRoom now handles this visually */}
                    {loading ? (
                       <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                         <Loader2 className="h-4 w-4 animate-spin" /> Working...
                       </span>
                    ) : null}
                  </div>

                  {/* OLD Progress & Timer AnimatePresence block REMOVED */}

                  <TestGeneratorForm onGenerate={handleGenerateTest} loading={loading} />

                  {/* Download cards */}
                  <AnimatePresence>
                    {(links.pdf || links.docx || links.csv || links.legacy) && !loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-5 grid gap-3 sm:grid-cols-2"
                      >
                        {(links.pdf || links.legacy) && (
                          <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-slate-50 to-white p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-black text-white">
                                <Download className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-medium">PDF ready</div>
                                {lastMeta && (
                                  <div className="text-sm text-slate-500">
                                    {lastMeta.subject} • {lastMeta.difficulty} • {lastMeta.qCount} Qs
                                  </div>
                                )}
                              </div>
                            </div>
                            <a
                              className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                              href={links.pdf || links.legacy || "#"}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download <ArrowRight className="h-4 w-4" />
                            </a>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {links.docx && (
                            <a
                              href={links.docx}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center justify-between rounded-xl border bg-white/90 px-4 py-3 hover:bg-slate-50"
                            >
                              <span className="inline-flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-600" />
                                <span className="text-sm font-medium">Open in DOCX (Word)</span>
                              </span>
                              <span className="text-xs text-slate-500 group-hover:text-slate-700">Edit/Print</span>
                            </a>
                          )}
                          {links.csv && (
                            <a
                              href={links.csv}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center justify-between rounded-xl border bg-white/90 px-4 py-3 hover:bg-slate-50"
                            >
                              <span className="inline-flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-slate-600" />
                                <span className="text-sm font-medium">Download CSV (Spreadsheet)</span>
                              </span>
                              <span className="text-xs text-slate-500 group-hover:text-slate-700">Import/Customize</span>
                            </a>
                          )}
                          {!links.docx && !links.csv && (
                            <div className="text-xs text-slate-500 px-1">
                              Need DOCX/CSV? They'll appear here when enabled on backend.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              </TabsContent>

              {/* History */}
              <TabsContent value="history">
                <motion.section
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="bg-white/85 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-[0_8px_24px_rgba(2,8,23,.06)] ring-1 ring-black/5 mt-4"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-semibold">Recent Papers</h2>
                    <button
                      onClick={refreshHistory}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
                      disabled={historyLoading}
                    >
                      {historyLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Refreshing…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </>
                      )}
                    </button>
                  </div>

                  {!rows.length ? (
                    <div className="text-sm opacity-70">{historyLoading ? "Loading…" : "No papers yet."}</div>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((r) => (
                        <div
                          key={r.id}
                          className="border rounded-xl p-3 flex items-center justify-between text-sm bg-white/90"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {r.subject || "Paper"} — {r.grade ?? ""} {r.board ? `• ${r.board}` : ""}
                            </div>
                            <div className="opacity-70 text-xs sm:text-sm">
                              Q:{r.q_count ?? "-"} • {r.question_type ?? "-"} • {r.difficulty ?? "-"} • {fmtDate(r.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            {r.pdf_url ? (
                              <a href={r.pdf_url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1 text-xs sm:text-sm">
                                Open <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs">No file</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TestGeneratorPage;