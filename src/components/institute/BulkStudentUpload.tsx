// src/components/institute/BulkStudentUpload.tsx
// ──────────────────────────────────────────────────────────────────────
// Bulk student upload via Excel/CSV (.xlsx, .xls, .csv · ≤ 5 MB · ≤ 500 rows)
// 1. read the file in the browser → 2. preview: every row matched to a real department / section / batches
//    (src/lib/studentUpload) — green = matched, yellow = check, red = can't upload, with the reason
// 3. upload the ready rows with ONE call to bulk_add_students (migration 33: admin only, RLS applies,
//    each row = student + all its batches, or nothing) → 4. report + failed rows as CSV.
// ──────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { HOD_ENABLED } from "@/config/features";
import * as XLSX from "xlsx";
import {
  MAX_ROWS, UPLOAD_FIELDS, type ResolvedRow, type UploadField,
  autoMapHeaders, batchesWithoutDepartment, checkUploadFile, failedRowsCsv, resolveRows,
} from "@/lib/studentUpload/resolveRows";

interface Batch {
  id: string;
  name: string;
  section_id?: string | null;
  department_id?: string | null;
  is_lab?: boolean | null;
}

interface Department {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  department_id: string;
}

interface BulkStudentUploadProps {
  instituteId: string;
  batches: Batch[];
  departments: Department[];
  sections: Section[];
  onUploadComplete: () => void;
  onClose: () => void;
}

interface ReportRow { row: number; name: string; reason: string; raw: Record<string, unknown> }
interface Report { total: number; created: number; failed: ReportRow[] }

const FIELD_LABEL: Record<UploadField, string> = {
  name: "Name", roll_no: "Roll no", class_level: "Class", department: "Department", section: "Section",
  batch: "Batch(es)", lab_batch: "Lab batch", parent_name: "Parent name", parent_phone: "Parent phone",
  phone: "Student phone", email: "Email",
};

const Icons = {
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  FileSpreadsheet: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="16" x2="16" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="20" x2="13" y2="20" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Loader: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
};

const HOW_LABEL: Record<string, string> = {
  exact: "", alias: "matched", fuzzy: "partial name", picked: "picked above", "from batch": "from batch", "from section": "section's batch",
};

function Chip({ name, how, tone }: { name: string; how?: string; tone: "ok" | "warn" }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-800 border-amber-200";
  const note = how ? HOW_LABEL[how] : "";
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border ${cls} mr-1 mb-0.5`}>
      {name}{note ? <span className="font-medium opacity-70"> · {note}</span> : null}
    </span>
  );
}

function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BulkStudentUpload({
  instituteId,
  batches,
  departments,
  sections,
  onUploadComplete,
  onClose,
}: BulkStudentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "processing" | "report">("upload");
  const [mapping, setMapping] = useState<Partial<Record<UploadField, string>>>({});
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolved = useMemo<ResolvedRow[]>(() => resolveRows(rows, {
    departments, sections, batches, mapping,
    pickedDepartmentId: selectedDepartment, pickedSectionId: selectedSection, pickedBatchId: selectedBatch,
  }), [rows, departments, sections, batches, mapping, selectedDepartment, selectedSection, selectedBatch]);

  const ready = resolved.filter(r => r.payload);
  const problems = resolved.filter(r => !r.payload);
  const warned = resolved.filter(r => r.status === "warn");
  const noDeptBatches = useMemo(() => batchesWithoutDepartment(resolved), [resolved]);

  // Reminder for batches without a department (e.g. "ECONOMICS BATCH 11th" on 20 Nov 2026)
  useEffect(() => {
    if (noDeptBatches.length > 0) {
      console.warn("[bulk upload] batches without department_id — set them in the Batches tab:",
        noDeptBatches.map(b => `${b.name} (${b.id})`));
    }
  }, [noDeptBatches]);

  const reset = () => {
    setStep("upload"); setFile(null); setRows([]); setHeaders([]); setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const problem = checkUploadFile(selectedFile);
    if (problem) {
      toast.error(problem);
      e.target.value = "";
      return;
    }
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (f: File) => {
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read the file.");
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) { toast.error("The file has no sheet."); return; }
        // Header row as written (also columns that are empty in the first data row)
        const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })[0] ?? [])
          .map(h => String(h ?? "").trim()).filter(Boolean);
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", blankrows: false })
          .filter(r => Object.values(r).some(v => String(v ?? "").trim() !== ""));

        if (json.length === 0 || headerRow.length === 0) {
          toast.error("The file appears to be empty");
          return;
        }
        if (json.length > MAX_ROWS) {
          toast.error(`The file has ${json.length} students. Upload at most ${MAX_ROWS} at a time — split the file.`);
          return;
        }
        const map = autoMapHeaders(headerRow);
        setHeaders(headerRow);
        setMapping(map);
        setRows(json);
        setStep("preview");
        if (!map.name) toast.warning('No "Name" column found — pick it under Column mapping.');
        else toast.success(`Loaded ${json.length} rows from ${f.name}`);
      } catch (error) {
        console.error("Parse error:", error);
        toast.error("Failed to parse the file. Please check the format.");
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const setField = (field: UploadField, header: string) => {
    setMapping(prev => {
      const next = { ...prev };
      // one header → one field
      for (const k of Object.keys(next) as UploadField[]) if (next[k] === header) delete next[k];
      if (header) next[field] = header; else delete next[field];
      return next;
    });
  };

  const uploadStudents = async () => {
    if (ready.length === 0) {
      toast.error("No rows are ready to upload. Fix the red rows first.");
      return;
    }
    setStep("processing");
    const clientFailed: ReportRow[] = problems.map(r => ({
      row: r.row, name: r.name, reason: r.errors.join("; "), raw: r.raw,
    }));

    try {
      const { data, error } = await supabase.rpc("bulk_add_students", {
        p_institute_id: instituteId,
        p_rows: ready.map(r => r.payload!),
      });
      if (error) {
        const missing = error.code === "PGRST202" || error.code === "42883";
        toast.error(missing
          ? "The server isn't updated for this upload yet (migration 33_student_batches.sql). Ask the admin to run it."
          : error.code === "42501" ? "Only an institute admin can bulk-upload students."
          : `Upload failed: ${error.message}`);
        setStep("preview");
        return;
      }

      const res = data as { created: number; failed: number; results: { row: number; ok: boolean; error?: string }[] };
      const byRow = new Map(ready.map(r => [r.row, r]));
      const serverFailed: ReportRow[] = (res.results || []).filter(x => !x.ok).map(x => {
        const r = byRow.get(x.row);
        return { row: x.row, name: r?.name ?? "", reason: x.error || "Not saved", raw: r?.raw ?? {} };
      });
      const failed = [...clientFailed, ...serverFailed].sort((a, b) => a.row - b.row);
      setReport({ total: resolved.length, created: res.created ?? 0, failed });
      setStep("report");

      if ((res.created ?? 0) > 0) {
        // Access codes for the new students (admin/HOD only, server-side)
        const { error: codeErr } = await supabase.rpc("generate_student_access_codes", { p_institute_id: instituteId });
        if (codeErr) toast.warning("Students saved, but access codes weren't generated. Use “Access Codes” later.");
        onUploadComplete();
      }
    } catch (err: any) {
      console.error("Upload process error:", err);
      toast.error(`Upload failed: ${err?.message || "network error"}. Nothing was changed for rows that didn't reach the server.`);
      setStep("preview");
    }
  };

  const downloadFailed = (list: ReportRow[]) => {
    downloadCsv(failedRowsCsv(headers, list), `students_to_fix_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadTemplate = () => {
    const d = departments[0]?.name || "10th class";
    const exampleData = [
      { "Student Name": "Aarav Sharma", "Roll No": "101", "Class": d, "Section": sections[0]?.name || "", "Batch": batches.filter(b => !b.is_lab).slice(0, 2).map(b => b.name).join(", "), "Parent Name": "Rajesh Sharma", "Parent Phone": "9876543210", "Email": "aarav@example.com" },
      { "Student Name": "Priya Verma", "Roll No": "102", "Class": "X", "Section": "", "Batch": "", "Parent Name": "Suresh Verma", "Parent Phone": "9876543211", "Email": "" },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exampleData);
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_upload_template.xlsx");
    toast.success("Template downloaded!");
  };

  const shown = onlyProblems ? resolved.filter(r => r.status !== "ok") : resolved;
  const selectCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#FF7043] focus:ring-2 focus:ring-[#FF7043]/20";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto relative shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Bulk Upload Students</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Excel or CSV · up to {MAX_ROWS} students · 5 MB
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
            <Icons.X />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-[#FF7043] transition-colors cursor-pointer bg-slate-50/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              <div className="w-16 h-16 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-4">
                <Icons.Upload />
              </div>
              <p className="text-lg font-bold text-slate-800">Drop your Excel file here</p>
              <p className="text-sm text-slate-500 font-medium mt-1">or click to browse · .xlsx, .xls, .csv</p>
              <p className="mt-4 text-xs text-slate-400">
                Required: <span className="font-bold text-[#FF7043]">Name</span> · Class (X, 10, 10th, Class 10 all work) ·
                Batch (several allowed: <span className="font-mono">science, maths 10</span>) · Section · Lab batch · Roll no · Parent phone
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Icons.FileSpreadsheet /></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Download Template</p>
                  <p className="text-xs text-slate-500">Uses your real class and batch names</p>
                </div>
              </div>
              <button onClick={downloadTemplate} className="px-4 py-2 rounded-lg bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] transition-colors">Download</button>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center"><Icons.FileSpreadsheet /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{file?.name}</p>
                <p className="text-xs text-slate-500">{rows.length} rows</p>
              </div>
              <button onClick={reset} aria-label="Choose another file" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.X /></button>
            </div>

            <details className="bg-slate-50 rounded-xl p-3" open={!mapping.name}>
              <summary className="text-sm font-bold text-slate-800 cursor-pointer">Column mapping</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                {UPLOAD_FIELDS.map(field => (
                  <label key={field} className="flex items-center gap-2 text-xs">
                    <span className={`w-24 shrink-0 font-bold ${field === "name" ? "text-[#FF7043]" : "text-slate-500"}`}>{FIELD_LABEL[field]}{field === "name" && " *"}</span>
                    <select className="flex-1 min-w-0 p-1.5 bg-white border border-slate-200 rounded-lg text-xs" value={mapping[field] ?? ""} onChange={e => setField(field, e.target.value)}>
                      <option value="">(none)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Class is used to find the department when there is no Department column.</p>
            </details>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Department for all rows</label>
                <select className={selectCls} value={selectedDepartment} onChange={e => { setSelectedDepartment(e.target.value); setSelectedSection(""); setSelectedBatch(""); }}>
                  <option value="">Use the file (Class / Department)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Section for all rows</label>
                <select className={selectCls} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedDepartment}>
                  <option value="">Use the file</option>
                  {sections.filter(s => s.department_id === selectedDepartment).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Batch for all rows</label>
                <select className={selectCls} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
                  <option value="">Use the file (Batch column)</option>
                  {batches.filter(b => !selectedDepartment || !b.department_id || b.department_id === selectedDepartment)
                    .map(b => <option key={b.id} value={b.id}>{b.name}{b.department_id ? "" : " (no department)"}</option>)}
                </select>
              </div>
            </div>

            {noDeptBatches.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <b>Reminder:</b> {noDeptBatches.map(b => `"${b.name}"`).join(", ")} {noDeptBatches.length === 1 ? "has" : "have"} no department.
                Students will be saved, but the department's {HOD_ENABLED ? "HOD and teachers" : "teachers"} won't see {noDeptBatches.length === 1 ? "this batch" : "these batches"} until
                you set the department (Batches tab).
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">{ready.length - warned.length} ready</span>
              {warned.length > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800">{warned.length} ready, check</span>}
              {problems.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600">{problems.length} can't upload</span>}
              <label className="ml-auto flex items-center gap-1.5 text-slate-500 font-medium cursor-pointer">
                <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} /> Only rows to check
              </label>
              {problems.length > 0 && (
                <button onClick={() => downloadFailed(problems.map(r => ({ row: r.row, name: r.name, reason: r.errors.join("; "), raw: r.raw })))}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                  ⬇ Rows to fix (CSV)
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-auto max-h-[42vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left text-[11px] font-bold text-slate-500">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Batches</th>
                    <th className="px-3 py-2 min-w-[220px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r.row} className={`border-t border-slate-100 align-top ${r.status === "error" ? "bg-red-50/40" : ""}`}>
                      <td className="px-3 py-2 text-xs text-slate-400">{r.row}</td>
                      <td className="px-3 py-2 text-xs font-bold text-slate-800">{r.name || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-2">{r.department ? <Chip name={r.department.item.name} how={r.department.how} tone="ok" /> : <span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-3 py-2">{r.section ? <Chip name={r.section.item.name} how={r.section.how} tone="ok" /> : <span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-3 py-2">
                        {r.batches.map(b => <Chip key={b.item.id} name={b.item.name} how={b.how} tone={b.how === "fuzzy" || !b.item.department_id ? "warn" : "ok"} />)}
                        {r.lab && !r.batches.some(b => b.item.id === r.lab!.item.id) && <Chip name={`Lab: ${r.lab.item.name}`} tone="ok" />}
                        {r.batches.length === 0 && !r.lab && <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.status === "ok" && <span className="text-green-700 font-bold">✓ Ready</span>}
                        {r.errors.map((e, i) => <p key={i} className="text-red-600">✕ {e}</p>)}
                        {r.warnings.map((w, i) => <p key={i} className="text-amber-700">! {w}</p>)}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-400">Every row is ready.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={reset} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Back</button>
              <button
                onClick={uploadStudents}
                disabled={ready.length === 0}
                className="px-6 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.Check /> Upload {ready.length} student{ready.length !== 1 ? "s" : ""}
                {problems.length > 0 ? ` (skip ${problems.length})` : ""}
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-4"><Icons.Loader /></div>
            <p className="text-lg font-bold text-slate-800">Uploading {ready.length} students…</p>
            <p className="text-sm text-slate-500 mt-1">Please keep this window open</p>
          </div>
        )}

        {step === "report" && report && (
          <div className="space-y-5" aria-live="polite">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-4 rounded-2xl bg-slate-50"><p className="text-2xl font-black text-slate-800">{report.total}</p><p className="text-xs font-bold text-slate-500">rows in file</p></div>
              <div className="p-4 rounded-2xl bg-green-50"><p className="text-2xl font-black text-green-700">{report.created}</p><p className="text-xs font-bold text-green-700">added</p></div>
              <div className="p-4 rounded-2xl bg-red-50"><p className="text-2xl font-black text-red-600">{report.failed.length}</p><p className="text-xs font-bold text-red-600">not added</p></div>
            </div>

            {noDeptBatches.length > 0 && report.created > 0 && (
              <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <b>Note:</b> set a department for {noDeptBatches.map(b => `"${b.name}"`).join(", ")} in the Batches tab.
              </p>
            )}

            {report.failed.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-800">Rows not added</p>
                  <button onClick={() => downloadFailed(report.failed)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold">
                    ⬇ Download to fix (CSV)
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[40vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left font-bold text-slate-500"><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Reason</th></tr>
                    </thead>
                    <tbody>
                      {report.failed.map(f => (
                        <tr key={f.row} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 text-slate-400">{f.row}</td>
                          <td className="px-3 py-2 font-bold text-slate-800">{f.name || "—"}</td>
                          <td className="px-3 py-2 text-red-600">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Fix these rows in the CSV and upload it again — the extra “Row” and “Error” columns are ignored.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={reset} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Upload another file</button>
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] transition-colors">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
