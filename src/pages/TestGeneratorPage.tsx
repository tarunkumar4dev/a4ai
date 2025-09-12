// src/pages/TestGeneratorPage.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/DashboardSidebar";
import TestGeneratorForm, { TestGeneratorFormValues } from "@/components/TestGeneratorForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTest } from "@/lib/generateTest";

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
  storage_path: string | null; // e.g. users/<uid>/tests/YYYY/MM/DD/<testId>.pdf

  // ✅ handle either DB schema:
  // - new: file_url
  // - old: signed_url (we alias it as file_url in SELECT)
  file_url: string | null;
  signed_url?: string | null;

  status: string | null;
};

const BUCKET = "tests";

/* --------------------------- Mappers ---------------------------- */
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

/* ------------------------------ Page ---------------------------- */
const TestGeneratorPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<LastMeta>(null);

  // History
  const [rows, setRows] = useState<TestHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* --------- Fetch history from DB (tests table) --------- */
  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setRows([]);
        return;
      }

      // 👇 IMPORTANT: alias old `signed_url` as `file_url` so both schemas work
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

      if (error) throw error;

      setRows((data as TestHistoryRow[]) ?? []);
    } catch (e: any) {
      console.error("History error:", e);
      toast({ title: "History error", description: String(e?.message || e) });
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  /* --------- On-demand download from history --------- */
  const openHistoryDownload = useCallback(
    async (row: TestHistoryRow) => {
      try {
        // Prefer saved URL if present (works for both new and aliased old column)
        if (row.file_url) {
          window.open(row.file_url, "_blank", "noopener,noreferrer");
          return;
        }
        // Otherwise, sign from storage_path
        if (!row.storage_path) throw new Error("Missing storage path");

        const { data, error } = await supabase
          .storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 60 * 10); // 10 min

        if (error || !data?.signedUrl) throw new Error(error?.message || "Failed to sign URL");
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        toast({ title: "Download failed", description: String(e?.message || e) });
      }
    },
    [toast]
  );

  /* --------- Generate handler (called by form) --------- */
  const handleGenerateTest = async (formData: TestGeneratorFormValues): Promise<string | null> => {
    try {
      setLoading(true);
      setDownloadUrl(null);

      // 1) auth
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Login required", description: "Please sign in to generate a test." });
        throw new Error(userErr?.message || "Not logged in");
      }

      // 2) payload
      const payload = {
        userId: user.id,
        subject: formData?.subject || "Maths",
        difficulty: mapDifficulty(formData?.difficulty),
        questionType: mapQuestionType(formData?.questionType),
        qCount: Number(formData?.qCount ?? (formData as any)?.itemCount ?? 5),
        outputFormat: "PDF" as const,
      };

      // 3) call Edge Function via helper (handles tokens + normalization)
      const res = await generateTest(payload, { timeoutMs: 90_000 });

      // 4) decide URL
      if (res.kind === "json") {
        const url =
          res.json.publicUrl ||
          res.json.downloadUrl ||
          null;

        if (url) {
          setDownloadUrl(url);
        } else if (res.json.filePath || res.json.storagePath) {
          // If URL missing but path present (private bucket), sign it now
          const filePath = (res.json.filePath || res.json.storagePath)!;
          const { data, error } = await supabase
            .storage
            .from(BUCKET)
            .createSignedUrl(filePath, 60 * 30); // 30 min
          if (error || !data?.signedUrl) throw new Error(error?.message || "Failed to generate download link");
          setDownloadUrl(data.signedUrl);
        } else {
          // Hard fail -> surface proper error instead of vague toast
          throw new Error("File URL/path missing in response");
        }
      } else {
        // Server streamed PDF; build an object URL
        const link = URL.createObjectURL(res.blob);
        setDownloadUrl(link);
      }

      setLastMeta({
        subject: payload.subject,
        difficulty: payload.difficulty,
        qCount: payload.qCount,
      });

      // 5) refresh history after success
      await refreshHistory();

      toast({ title: "Generated", description: "Your PDF is ready to download." });
      return downloadUrl;
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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 bg-white border-b shadow-sm z-10">
          <div className="max-w-6xl mx-auto w-full px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-800">🧠 Test Generator</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <Tabs defaultValue="test-generator" className="w-full">
              <TabsList className="grid grid-cols-3 bg-zinc-100 rounded-xl overflow-hidden mb-6 shadow-sm">
                <TabsTrigger value="test-generator">✏️ Generate Test</TabsTrigger>
                <TabsTrigger value="history">📜 History</TabsTrigger>
                <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="test-generator">
                <section className="bg-white rounded-xl p-6 shadow-md transition-all">
                  <h2 className="text-xl font-semibold mb-4">Create New Test</h2>

                  {/* Form calls our handler and may await its returned URL */}
                  <TestGeneratorForm onGenerate={handleGenerateTest} loading={loading} />

                  {downloadUrl && (
                    <div className="mt-4 flex items-center gap-3">
                      <a
                        className="underline font-medium"
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download PDF
                      </a>
                      {lastMeta && (
                        <span className="text-sm text-zinc-500">
                          ({lastMeta.subject} • {lastMeta.difficulty} • {lastMeta.qCount} Qs)
                        </span>
                      )}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="history">
                <section className="bg-white rounded-xl p-6 shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Test History</h2>
                    <button
                      onClick={refreshHistory}
                      className="px-3 py-1.5 rounded-md border text-sm hover:bg-zinc-50"
                      disabled={historyLoading}
                    >
                      {historyLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>

                  {historyLoading && rows.length === 0 ? (
                    <p className="text-zinc-500">Loading your tests…</p>
                  ) : rows.length === 0 ? (
                    <p className="text-zinc-500">No tests yet. Generate your first one!</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-zinc-600">
                          <tr>
                            <th className="text-left px-4 py-2">Subject</th>
                            <th className="text-left px-4 py-2">Difficulty</th>
                            <th className="text-left px-4 py-2">Questions</th>
                            <th className="text-left px-4 py-2">Created</th>
                            <th className="text-left px-4 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                              <td className="px-4 py-2 font-medium">
                                {r.subject || "-"}
                                {r.topic ? <span className="text-zinc-500"> — {r.topic}</span> : null}
                              </td>
                              <td className="px-4 py-2">{r.difficulty || "-"}</td>
                              <td className="px-4 py-2">{typeof r.q_count === "number" ? r.q_count : "-"}</td>
                              <td className="px-4 py-2">
                                {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => openHistoryDownload(r)}
                                  className="px-3 py-1.5 rounded-md bg-black text-white hover:opacity-90"
                                >
                                  Download
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="analytics">
                <section className="bg-white rounded-xl p-6 shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Test Analytics</h2>
                  <p className="text-zinc-500">Analytics will appear after generating tests.</p>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TestGeneratorPage;
