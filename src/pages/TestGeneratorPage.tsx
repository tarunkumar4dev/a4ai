// /src/pages/TestGeneratorPage.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/DashboardSidebar";
import TestGeneratorForm, { TestGeneratorFormValues } from "@/components/TestGeneratorForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTest } from "@/lib/generateTest";
import { fetchRecentPapers, type PaperRow } from "@/lib/history";
import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, Sparkles, Loader2, ArrowRight } from "lucide-react";

/* ----------------------------- Types ----------------------------- */
type LastMeta = { subject?: string; difficulty?: string; qCount?: number } | null;

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
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<LastMeta>(null);

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

  // revoke previous blob URLs when component unmounts or downloadUrl changes
  useEffect(() => {
    return () => {
      if (downloadUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  /* --------- Generate handler --------- */
  const handleGenerateTest = async (
    formData: TestGeneratorFormValues
  ): Promise<string | null> => {
    let objectUrlToRevoke: string | null = null;

    try {
      setLoading(true);
      setDownloadUrl(null);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Login required", description: "Please sign in." });
        throw new Error("Not logged in");
      }

      const qCount = Math.max(5, Number(formData?.qCount ?? (formData as any)?.itemCount ?? 5));

      const payload = {
        userId: user.id,
        subject: (formData?.subject || "Maths").trim(),
        difficulty: mapDifficulty(formData?.difficulty),
        questionType: mapQuestionType(formData?.questionType),
        qCount,
        outputFormat: "PDF" as const,
      };

      // unified API: { ok, url, meta, json, used }
      const res = await generateTest(payload, { timeoutMs: 90_000 });

      let finalUrl = res.url;

      // In rare cases, client lib may return a blob URL (streamed PDF path).
      if (finalUrl.startsWith("blob:")) {
        objectUrlToRevoke = finalUrl;
      }

      if (!finalUrl) throw new Error("File URL missing in response");

      setDownloadUrl(finalUrl);
      setLastMeta({
        subject: payload.subject,
        difficulty: payload.difficulty,
        qCount: payload.qCount,
      });

      await refreshHistory();
      toast({ title: "Generated 🎉", description: "Your PDF is ready to download." });
      return finalUrl;
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
      if (objectUrlToRevoke) {
        setTimeout(() => URL.revokeObjectURL(objectUrlToRevoke!), 0);
      }
    }
  };

  /* ------------------------------ UI ------------------------------- */
  return (
    <div
      className="
        flex h-screen
        bg-[radial-gradient(900px_600px_at_0%_-10%,rgba(161,196,253,0.28),transparent),
            radial-gradient(1000px_700px_at_100%_0%,rgba(251,174,210,0.20),transparent)]
      "
    >
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
                <h1 className="text-2xl font-bold leading-tight bg-gradient-to-r from-sky-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                  Test Generator
                </h1>
                <p className="text-sm text-zinc-500">As Fast as Light</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Tabs */}
            <Tabs defaultValue="test-generator" className="w-full">
              <TabsList className="relative grid grid-cols-2 bg-zinc-100/70 rounded-xl overflow-hidden p-1">
                <TabsTrigger value="test-generator">Generate</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* Generate */}
              <TabsContent value="test-generator">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm ring-1 ring-black/5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Create New Test</h2>
                    {loading ? (
                      <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                      </span>
                    ) : null}
                  </div>

                  <TestGeneratorForm onGenerate={handleGenerateTest} loading={loading} />

                  <AnimatePresence>
                    {downloadUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mt-5 flex items-center justify-between rounded-xl border bg-gradient-to-r from-zinc-50 to-white p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-black text-white">
                            <Download className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">Your PDF is ready</div>
                            {lastMeta && (
                              <div className="text-sm text-zinc-500">
                                {lastMeta.subject} • {lastMeta.difficulty} • {lastMeta.qCount} Qs
                              </div>
                            )}
                          </div>
                        </div>
                        <a
                          className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download <ArrowRight className="h-4 w-4" />
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              </TabsContent>

              {/* History */}
              <TabsContent value="history">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm ring-1 ring-black/5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Recent Papers</h2>
                    <button
                      onClick={refreshHistory}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
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
                    <div className="text-sm opacity-70">
                      {historyLoading ? "Loading…" : "No papers yet."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((r) => (
                        <div
                          key={r.id}
                          className="border rounded p-2 flex items-center justify-between text-sm"
                        >
                          <div>
                            <div className="font-medium">
                              {r.subject || "Paper"} — {r.grade ?? ""} {r.board ? `• ${r.board}` : ""}
                            </div>
                            <div className="opacity-70">
                              Q:{r.q_count ?? "-"} • {r.question_type ?? "-"} • {r.difficulty ?? "-"} • {fmtDate(r.created_at)}
                            </div>
                          </div>
                          <a href={r.pdf_url} target="_blank" className="underline">
                            Open
                          </a>
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
