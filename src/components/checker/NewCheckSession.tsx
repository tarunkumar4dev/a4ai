// src/components/checker/NewCheckSession.tsx
// Step 1 of "Check Copies": which paper (Test History or photos of the paper + key), which class,
// how strict. The marking scheme is prepared ONCE here, before any student copy is added.

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Camera, Check, FileText, Image as ImageIcon, Images } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { useMyScope } from "@/hooks/useMyScope";
import { humanError } from "./checkerFetch";
import { buildRubric, uploadPage, MAX_PAGES, STRICTNESS_LABEL, type Strictness } from "./copyCheckerApi";

/** A usable check name from a question-paper file, or "" for camera / chat names like IMG_2031.jpg. */
export function titleFromFile(file?: File): string {
  if (!file) return "";
  const base = file.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base || /^(img|pxl|dsc|dcim|screenshot|whatsapp image|image|photo|scan|scanned|cam|document)\b/i.test(base)) return "";
  if ((base.match(/[a-z]/gi) || []).length < 3) return "";   // mostly digits / dates
  return base.slice(0, 80);
}

const todayLabel = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });

type SavedTest = { id: string; exam_title: string | null; subject: string | null; class_grade: string | null; total_marks: number | null; created_at: string; usable?: boolean };

export default function NewCheckSession({ initialTestId, onCreated, onCancel }: {
  initialTestId?: string | null;
  /** pickStudents: a class was chosen → the session opens with its student picker (all ticked) */
  onCreated: (sessionId: string, pickStudents: boolean) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const scope = useMyScope();
  const [source, setSource] = useState<"test" | "upload">("test");
  const [tests, setTests] = useState<SavedTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [testId, setTestId] = useState<string>(initialTestId || "");
  const [qpFiles, setQpFiles] = useState<File[]>([]);
  const [keyFiles, setKeyFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  /** once the teacher types a name, we stop auto-filling it */
  const [titleEdited, setTitleEdited] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [busy, setBusy] = useState<string | null>(null);
  const qpCam = useRef<HTMLInputElement>(null);
  const qpPick = useRef<HTMLInputElement>(null);
  const keyCam = useRef<HTMLInputElement>(null);
  const keyPick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("tests")
      .select("id, exam_title, subject, class_grade, total_marks, created_at")
      .eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(40)
      .then(async ({ data }) => {
        const list: SavedTest[] = data || [];
        // Some tests (mostly old drafts) have no saved questions → no answers to build a scheme from.
        if (list.length) {
          const { data: qs } = await supabase.from("questions").select("test_id").in("test_id", list.map(t => t.id));
          const withQs = new Set((qs || []).map(q => q.test_id));
          // If RLS hid every row we can't tell — leave all usable and let the backend decide
          list.forEach(t => { t.usable = withQs.size === 0 ? true : withQs.has(t.id); });
        }
        setTests(list);
        setTestsLoading(false);
        if (initialTestId && list.find(t => t.id === initialTestId)?.usable === false) {
          setTestId("");
          setSource("upload");
          toast.info("This test's questions weren't saved — take a photo of the paper instead.");
        } else if (!list.some(t => t.usable) && !initialTestId) setSource("upload");
      });
  }, [user, initialTestId]);

  const chosenTest = tests.find(t => t.id === testId);
  // Name of the check = the paper's name, kept in sync until the teacher edits it.
  useEffect(() => {
    if (titleEdited) return;
    if (source === "test") {
      setTitle(chosenTest ? (chosenTest.exam_title || `${chosenTest.subject || "Test"} ${chosenTest.class_grade || ""}`.trim()) : "");
    } else {
      setTitle(qpFiles.length ? (titleFromFile(qpFiles[0]) || `Check – ${todayLabel()}`) : "");
    }
  }, [source, chosenTest, qpFiles, titleEdited]);

  const addFiles = (setter: React.Dispatch<React.SetStateAction<File[]>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setter(prev => [...prev, ...files].slice(0, MAX_PAGES));
  };

  const canCreate = !!title.trim() && (source === "test" ? !!testId : qpFiles.length > 0) && !busy;

  async function create() {
    if (!user || !canCreate) return;
    try {
      setBusy("Creating…");
      const { data: s, error } = await supabase.from("check_sessions").insert({
        title: title.trim().slice(0, 200), source,
        test_id: source === "test" ? testId : null,
        batch_id: batchId || null,
        subject: chosenTest?.subject || null, class_grade: chosenTest?.class_grade || null,
        strictness,
      }).select("id").single();
      if (error) throw error;

      if (source === "upload") {
        setBusy("Uploading question paper…");
        const qp: string[] = [];
        for (const f of qpFiles) qp.push(await uploadPage(user.id, s.id, "paper", f));
        const key: string[] = [];
        if (keyFiles.length) setBusy("Uploading answer key…");
        for (const f of keyFiles) key.push(await uploadPage(user.id, s.id, "key", f));
        const { error: uErr } = await supabase.from("check_sessions").update({ qp_paths: qp, key_paths: key }).eq("id", s.id);
        if (uErr) throw uErr;
      }

      setBusy(source === "test" ? "Preparing marking scheme…" : "Reading the paper and preparing the marking scheme…");
      try {
        await buildRubric(s.id);
      } catch {
        // shown once, in the session view's marking-scheme banner (with Retry) — no toast here
      }
      // Students are added in the session view: the picker opens for this class with everyone ticked,
      // so the teacher can untick absentees instead of every student being added silently.
      onCreated(s.id, !!batchId);
    } catch (e: any) {
      toast.error(humanError(e, "Could not create"));
      setBusy(null);
    }
  }

  const chip = (active: boolean) =>
    `flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${active ? "bg-[#111827] text-white border-[#111827]" : "bg-white text-gray-600 border-gray-200"}`;

  const FilePicker = ({ label, files, setFiles, cam, pick, optional }: {
    label: string; files: File[]; setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    cam: React.RefObject<HTMLInputElement>; pick: React.RefObject<HTMLInputElement>; optional?: boolean;
  }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-800">{label}{optional && <span className="text-gray-400 font-medium"> (optional)</span>}</p>
        {files.length > 0 && <button className="text-xs text-red-500 font-semibold" onClick={() => setFiles([])}>Clear</button>}
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {files.map((f, i) => (
            <span key={i} className="text-xs bg-gray-100 rounded-lg px-2 py-1 text-gray-700 max-w-[160px] truncate">
              {f.type === "application/pdf" ? <FileText size={12} className="inline -mt-0.5" /> : <ImageIcon size={12} className="inline -mt-0.5" />} {i + 1}. {f.name}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cam.current?.click()} className="py-3 rounded-xl bg-gray-900 text-white text-sm font-bold active:scale-[0.98] inline-flex items-center justify-center gap-1.5"><Camera size={16} /> Take photo</button>
        <button type="button" onClick={() => pick.current?.click()} className="py-3 rounded-xl bg-gray-100 text-gray-800 text-sm font-bold active:scale-[0.98] inline-flex items-center justify-center gap-1.5"><Images size={16} /> Gallery / PDF</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={addFiles(setFiles)} />
      <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={addFiles(setFiles)} />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="h-10 w-10 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center" aria-label="Back"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="text-lg font-black text-gray-900 leading-tight">New check</h2>
          <p className="text-xs text-gray-500">The marking scheme is prepared once for the whole class</p>
        </div>
      </div>

      {/* 1. Paper */}
      <section className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">1 · Question paper</p>
        <div className="flex gap-2">
          <button className={chip(source === "test")} onClick={() => setSource("test")}><span className="inline-flex items-center justify-center gap-1.5"><BookOpen size={15} /> From my tests</span></button>
          <button className={chip(source === "upload")} onClick={() => setSource("upload")}><span className="inline-flex items-center justify-center gap-1.5"><Camera size={15} /> Photo of paper</span></button>
        </div>

        {source === "test" ? (
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {testsLoading ? <p className="p-4 text-sm text-gray-400">Loading your tests…</p>
              : tests.length === 0 ? <p className="p-4 text-sm text-gray-500">No saved tests yet. Generate one, or use “Photo of paper”.</p>
              : tests.map(t => (
                <button key={t.id} onClick={() => t.usable !== false && setTestId(t.id)} disabled={t.usable === false}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${testId === t.id ? "bg-gray-900 text-white" : t.usable === false ? "opacity-50" : "active:bg-gray-50"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{t.exam_title || `${t.subject || "Test"} test`}</p>
                    <p className={`text-xs ${testId === t.id ? "text-gray-300" : "text-gray-400"}`}>
                      {[t.subject, t.class_grade && `Class ${t.class_grade}`, t.total_marks && `${t.total_marks} marks`].filter(Boolean).join(" · ")}
                      {" · "}{new Date(t.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    {t.usable === false && <p className="text-[11px] font-bold text-amber-700">Questions not saved — use “Photo of paper”</p>}
                  </div>
                  {testId === t.id && <Check size={18} className="shrink-0" />}
                </button>
              ))}
          </div>
        ) : (
          <>
            <FilePicker label="Question paper" files={qpFiles} setFiles={setQpFiles} cam={qpCam} pick={qpPick} />
            <FilePicker label="Answer key" files={keyFiles} setFiles={setKeyFiles} cam={keyCam} pick={keyPick} optional />
            {keyFiles.length === 0 && qpFiles.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No answer key: AI will write the answers itself. Check the marking scheme before adding copies.
              </p>
            )}
          </>
        )}
      </section>

      {/* 2. Details */}
      <section className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">2 · Details</p>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500">Name of this check</label>
            <input value={title} onChange={e => { setTitle(e.target.value); setTitleEdited(true); }} placeholder="e.g. Unit Test 2 – Science"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          {scope.batches.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500">Class</label>
              <select value={batchId} onChange={e => setBatchId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm bg-white">
                <option value="">Choose later</option>
                {scope.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Next you'll see its students, all ticked — untick anyone absent.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-gray-500">Checking strictness</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {(Object.keys(STRICTNESS_LABEL) as Strictness[]).map(k => (
                <button key={k} onClick={() => setStrictness(k)}
                  className={`py-2.5 rounded-xl text-xs font-bold border ${strictness === k ? "bg-[#111827] text-white border-[#111827]" : "bg-white text-gray-600 border-gray-200"}`}>
                  {STRICTNESS_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky action */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="max-w-xl mx-auto">
          <button onClick={create} disabled={!canCreate}
            className="w-full py-4 rounded-2xl bg-[#111827] text-white font-black text-sm disabled:bg-gray-300 active:scale-[0.99]">
            {busy || "Continue → add students' copies"}
          </button>
        </div>
      </div>
    </div>
  );
}
