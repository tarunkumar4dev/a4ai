// src/pages/TestGeneratorPage.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/DashboardSidebar";
import TestGeneratorForm, { TestGeneratorFormValues } from "@/components/TestGeneratorForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTest } from "@/lib/generateTest";
import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, FileText, Sparkles, Loader2, ArrowRight, Clock } from "lucide-react";

/* ----------------------------- Types ----------------------------- */
type LastMeta = { subject?: string; difficulty?: string; qCount?: number } | null;

type TestHistoryRow = {
  id: string;
  created_at: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  question_type: string | null;
  q_count: number | null;
  output_format: string | null;
  storage_path: string | null;
  file_url: string | null; // aliased from signed_url if old schema
  status: string | null;
  // (fallback-only fields)
  _size?: number | null;
};

const BUCKET = "tests";

/* --------------------------- Helpers ---------------------------- */
const mapDifficulty = (d?: string) => {
  if (!d) return "Easy";
  const v = d.toLowerCase();
  if (v === "easy") return "Easy";
  if (v === "medium") return "Medium";
  if (v === "hard") return "Hard";
  return d.charAt(0).toUpperCase() + d.slice(1);
};

const mapQuestionType = (t?: string) => {
  if (!t) return "Multiple Choice";
  const v = t.toLowerCase();
  if (["mcq", "multiplechoice", "multiple choice"].includes(v)) return "Multiple Choice";
  if (["short", "short answer", "shortanswer"].includes(v)) return "Short Answer";
  return "Mixed";
};

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "-");
const fmtBytes = (b?: number | null) =>
  typeof b === "number" ? (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`) : "-";

/* ------------------------------ Page ---------------------------- */
const TestGeneratorPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<LastMeta>(null);

  // History
  const [rows, setRows] = useState<TestHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* --------- Fallback: list from Storage if DB empty/error --------- */
  const listFromStorage = useCallback(async (userId: string): Promise<TestHistoryRow[]> => {
    const { data: list, error } = await supabase.storage.from(BUCKET).list(`${userId}`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !list) return [];

    return list
      .filter((f) => f.name?.toLowerCase().endsWith(".pdf"))
      .map((f) => ({
        id: `stor:${f.id ?? `${userId}/${f.name}`}`,
        created_at: (f as any).created_at ?? null,
        subject: "—",
        topic: null,
        difficulty: null,
        question_type: null,
        q_count: null,
        output_format: "PDF",
        storage_path: `${userId}/${f.name}`,
        file_url: null,
        status: "stored",
        _size: (f as any)?.metadata?.size ?? null,
      }));
  }, []);

  /* --------- Primary: fetch from DB; else fallback to Storage --------- */
  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { setRows([]); return; }

      // try DB first
      const { data, error } = await supabase
        .from("tests")
        .select(`
          id, created_at, subject, topic, difficulty, question_type, q_count,
          output_format, storage_path,
          file_url:signed_url,
          status
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        setRows(data as TestHistoryRow[]);
        return;
      }

      // fallback to Storage listing
      const stor = await listFromStorage(user.id);
      setRows(stor);
    } catch (e: any) {
      console.error("History error:", e);
      // even on DB failure, attempt storage fallback
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const stor = await listFromStorage(user.id);
          setRows(stor);
        }
      } catch {}
      toast({ title: "History issue", description: String(e?.message || e) });
    } finally {
      setHistoryLoading(false);
    }
  }, [listFromStorage, toast]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  /* --------- Download helper --------- */
  const openHistoryDownload = useCallback(async (row: TestHistoryRow) => {
    try {
      if (row.file_url) { window.open(row.file_url, "_blank", "noopener,noreferrer"); return; }
      if (!row.storage_path) throw new Error("Missing storage path");
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60 * 10);
      if (error || !data?.signedUrl) throw new Error(error?.message || "Failed to sign URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Download failed", description: String(e?.message || e) });
    }
  }, [toast]);

  /* --------- Generate handler --------- */
  const handleGenerateTest = async (formData: TestGeneratorFormValues): Promise<string | null> => {
    try {
      setLoading(true);
      setDownloadUrl(null);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { toast({ title: "Login required", description: "Please sign in." }); throw new Error("Not logged in"); }

      const payload = {
        userId: user.id,
        subject: formData?.subject || "Maths",
        difficulty: mapDifficulty(formData?.difficulty),
        questionType: mapQuestionType(formData?.questionType),
        qCount: Number(formData?.qCount ?? (formData as any)?.itemCount ?? 5),
        outputFormat: "PDF" as const,
      };

      const res = await generateTest(payload, { timeoutMs: 90_000 });

      if (res.kind === "json") {
        const url = res.json.publicUrl || res.json.downloadUrl || null;
        if (url) {
          setDownloadUrl(url);
        } else if (res.json.filePath || res.json.storagePath) {
          const filePath = (res.json.filePath || res.json.storagePath)!;
          const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 30);
          if (error || !data?.signedUrl) throw new Error(error?.message || "Failed to generate download link");
          setDownloadUrl(data.signedUrl);
        } else {
          throw new Error("File URL/path missing in response");
        }
      } else {
        const link = URL.createObjectURL(res.blob);
        setDownloadUrl(link);
      }

      setLastMeta({ subject: payload.subject, difficulty: payload.difficulty, qCount: payload.qCount });
      await refreshHistory();
      toast({ title: "Generated 🎉", description: "Your PDF is ready to download." });
      return downloadUrl;
    } catch (err: any) {
      console.error("Generation Error:", err);
      toast({ title: "Failed", description: String(err?.message || err) || "Could not generate test.", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
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
                <p className="text-sm text-zinc-500">Light blue aura, soft magenta tint — clean & modern.</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-4 w-4" />
              <span>Avg ~30s per paper</span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Tabs */}
            <Tabs defaultValue="test-generator" className="w-full">
              <TabsList className="relative grid grid-cols-3 bg-zinc-100/70 rounded-xl overflow-hidden p-1">
                <TabsTrigger value="test-generator" className="relative rounded-lg data-[state=active]:text-zinc-900">
                  <div className="relative z-10 flex items-center gap-2 px-2 py-1">
                    <Sparkles className="h-4 w-4" /> Generate
                  </div>
                </TabsTrigger>
                <TabsTrigger value="history" className="relative rounded-lg data-[state=active]:text-zinc-900">
                  <div className="relative z-10 flex items-center gap-2 px-2 py-1">
                    <FileText className="h-4 w-4" /> History
                  </div>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="relative rounded-lg data-[state=active]:text-zinc-900">
                  <div className="relative z-10 flex items-center gap-2 px-2 py-1">
                    <Clock className="h-4 w-4" /> Analytics
                  </div>
                </TabsTrigger>
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
                      {historyLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />Refreshing…</>) : (<><RefreshCw className="h-4 w-4" />Refresh</>)}
                    </button>
                  </div>

                  {/* Loading skeleton */}
                  {historyLoading && rows.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-xl border overflow-hidden bg-white shadow-sm">
                          <div className="animate-pulse h-28 bg-zinc-100" />
                          <div className="p-4 space-y-2">
                            <div className="h-4 bg-zinc-100 rounded w-3/5" />
                            <div className="h-3 bg-zinc-100 rounded w-2/5" />
                            <div className="h-3 bg-zinc-100 rounded w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="rounded-2xl border bg-gradient-to-r from-zinc-50 to-white p-10 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                        <FileText className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold">No tests yet</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Generate your first paper from the <span className="font-medium">Generate</span> tab.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AnimatePresence>
                        {rows.map((r) => (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.25 }}
                            className="group rounded-xl border bg-white/90 shadow-sm ring-1 ring-black/5 hover:shadow-md transition"
                          >
                            <div className="p-4 flex items-start gap-3">
                              <div className="h-10 w-10 inline-flex items-center justify-center rounded-lg bg-zinc-900 text-white">
                                <FileText className="h-5 w-5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium truncate">
                                    {r.subject || "Untitled"}
                                    {r.topic ? <span className="text-zinc-500"> — {r.topic}</span> : null}
                                  </div>
                                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                                    {r.difficulty || "-"}
                                  </span>
                                </div>

                                <div className="mt-1 text-sm text-zinc-500 flex flex-wrap items-center gap-3">
                                  <span>{typeof r.q_count === "number" ? `${r.q_count} Qs` : "-"}</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {fmtDate(r.created_at)}
                                  </span>
                                  {r._size != null && <span>{fmtBytes(r._size)}</span>}
                                  {r.status && (
                                    <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5 text-xs">
                                      {r.status}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={() => openHistoryDownload(r)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                                  >
                                    <Download className="h-4 w-4" />
                                    Download
                                  </button>
                                  {r.file_url && (
                                    <a
                                      href={r.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
                                    >
                                      Open link <ArrowRight className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.section>
              </TabsContent>

              {/* Analytics placeholder */}
              <TabsContent value="analytics">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm ring-1 ring-black/5"
                >
                  <h2 className="text-xl font-semibold mb-4">Test Analytics</h2>
                  <p className="text-zinc-500">Charts coming soon: subjects, difficulty mix, time saved, etc.</p>
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
