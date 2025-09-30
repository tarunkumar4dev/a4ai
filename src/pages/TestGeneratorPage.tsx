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
import { Download, RefreshCw, Sparkles, Loader2, ArrowRight, FileText, FileSpreadsheet } from "lucide-react";
import { uploadReferenceFiles } from "@/lib/uploadRefs";
import { buildEdgePayload } from "@/lib/mapFormToEdge";

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

/* ------------------------------ Page ---------------------------- */
const TestGeneratorPage = () => {
  const { toast } = useToast();

  // generation state
  const [loading, setLoading] = useState(false);
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
      setElapsedSec(0);
      setProgress(0);

      timerRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000) as unknown as number;

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
      setLoading(true);
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

      // Upload reference files (txt/csv/md handled server-side; pdf/docx optional)
      const ref_files = await uploadReferenceFiles(formData.referenceFiles || [], user.id, requestId);

      // Build an Edge payload that matches the new function’s Input
      const payload = buildEdgePayload(formData, user.id, requestId, ref_files);

      // (Back-compat helpers for the history card summary)
      const qCount =
        payload["qCount"] ??
        (Array.isArray(payload["sections"]) ? (payload["sections"] as any[]).reduce((s, x) => s + (x?.count || 0), 0) : undefined) ??
        (Array.isArray(formData.markingMatrix) ? formData.markingMatrix.reduce((s, x) => s + (x.count || 0), 0) : formData.qCount) ??
        5;

      const difficulty = mapDifficulty(formData?.difficulty);
      const subject = (formData?.subject || "Paper").trim();

      // Hit the generator (it will create sectioned or legacy depending on sectionsJSON)
      const res = await generateTest(payload as any, { timeoutMs: 120_000, retries: 2 });

      const pdfUrl = (res as any)?.pdfUrl || (res as any)?.publicUrl || (res as any)?.url || null;
      const docxUrl = (res as any)?.docxUrl || null;
      const csvUrl = (res as any)?.csvUrl || null;
      const legacy = !pdfUrl && (res as any)?.url ? (res as any).url : null;

      if (!pdfUrl && !legacy) throw new Error("File URL missing in response");

      setLinks({ pdf: pdfUrl, docx: docxUrl, csv: csvUrl, legacy });
      setLastMeta({ subject, difficulty, qCount });

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
      setLoading(false);
    }
  };

  /* ------------------------------ UI ------------------------------- */
  return (
    <div className="flex h-screen text-slate-900 bg-[#DFE4EF]">
      {/* subtle grid on background */}
      <div className="fixed inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 bg-clip-text text-transparent">
                  Test Generator
                </h1>
                <p className="text-sm text-slate-500">As Fast as Light</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
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
                  className="bg-white/85 backdrop-blur rounded-2xl p-6 shadow-[0_8px_24px_rgba(2,8,23,.06)] ring-1 ring-black/5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Create New Test</h2>
                    {loading ? (
                      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                      </span>
                    ) : null}
                  </div>

                  {/* Progress & Timer */}
                  <AnimatePresence>
                    {loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mb-4 rounded-xl border bg-white/70 p-3"
                      >
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div className="font-medium text-slate-700">Preparing your paper…</div>
                          <div className="tabular-nums text-slate-500">
                            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-black transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Tip: you can switch tabs while this runs. It’ll auto-update here.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                              Need DOCX/CSV? They’ll appear here when enabled on backend.
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
                  className="bg-white/85 backdrop-blur rounded-2xl p-6 shadow-[0_8px_24px_rgba(2,8,23,.06)] ring-1 ring-black/5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Recent Papers</h2>
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
                          <div>
                            <div className="font-medium">
                              {r.subject || "Paper"} — {r.grade ?? ""} {r.board ? `• ${r.board}` : ""}
                            </div>
                            <div className="opacity-70">
                              Q:{r.q_count ?? "-"} • {r.question_type ?? "-"} • {r.difficulty ?? "-"} • {fmtDate(r.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {r.pdf_url ? (
                              <a href={r.pdf_url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                                Open <ArrowRight className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-slate-400">No file</span>
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
