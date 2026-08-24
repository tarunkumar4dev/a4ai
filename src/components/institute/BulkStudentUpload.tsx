// src/components/institute/BulkStudentUpload.tsx
// ──────────────────────────────────────────────────────────────────────
// Bulk student upload via Excel/CSV
// Supports: XLSX, XLS, CSV files
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Batch {
  id: string;
  name: string;
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

export default function BulkStudentUpload({
  instituteId,
  batches,
  departments,
  sections,
  onUploadComplete,
  onClose,
}: BulkStudentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "processing">("upload");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredFields = ["name"];
  const allFields = ["name", "roll_no", "class_level", "parent_name", "parent_phone"];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["xlsx", "xls", "csv"];

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension || "")) {
      toast.error("Please upload an Excel file (.xlsx, .xls, or .csv)");
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

        if (jsonData.length === 0) {
          toast.error("The file appears to be empty");
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const autoMapping: Record<string, string> = {};
        const fieldMap: Record<string, string[]> = {
          name: ["name", "student name", "student_name", "full name", "fullname"],
          roll_no: ["roll", "roll no", "roll_no", "roll number", "rollnumber"],
          class_level: ["class", "class level", "class_level", "grade", "standard"],
          parent_name: ["parent", "parent name", "parent_name", "father", "mother", "guardian"],
          parent_phone: ["phone", "parent phone", "parent_phone", "mobile", "contact"],
        };

        headers.forEach((header) => {
          const lower = header.toLowerCase().trim();
          for (const [field, aliases] of Object.entries(fieldMap)) {
            if (aliases.includes(lower) && !autoMapping[field]) {
              autoMapping[field] = header;
              break;
            }
          }
        });

        setMapping(autoMapping);
        setPreviewData(jsonData);
        setStep("preview");
        setErrors([]);
        toast.success(`Loaded ${jsonData.length} rows from ${file.name}`);
      } catch (error) {
        console.error("Parse error:", error);
        toast.error("Failed to parse the file. Please check the format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getMappedValue = (row: any, field: string): string => {
    const colName = mapping[field];
    return colName ? (row[colName] || "").toString().trim() : "";
  };

  const validateRow = (row: any, index: number): string | null => {
    const name = getMappedValue(row, "name");
    if (!name) {
      return `Row ${index + 2}: Name is required`;
    }
    return null;
  };

  const handlePreviewSubmit = () => {
    const newErrors: string[] = [];
    previewData.forEach((row, index) => {
      const error = validateRow(row, index);
      if (error) newErrors.push(error);
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      toast.error(`Found ${newErrors.length} validation errors`);
      return;
    }

    setStep("processing");
    uploadStudents();
  };

  const uploadStudents = async () => {
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        const studentData = {
          institute_id: instituteId,
          name: getMappedValue(row, "name"),
          roll_no: getMappedValue(row, "roll_no") || null,
          class_level: getMappedValue(row, "class_level") || null,
          parent_name: getMappedValue(row, "parent_name") || null,
          parent_phone: getMappedValue(row, "parent_phone") || null,
          batch_id: selectedBatch || null,
          department_id: selectedDepartment || null,
          section_id: selectedSection || null,
          is_active: true,
        };

        const { error } = await supabase
          .from("students")
          .insert(studentData);

        if (error) {
          failCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} students${failCount > 0 ? `, ${failCount} failed` : ""}`);
      } else {
        toast.error(`Failed to upload any students.`);
      }

      onUploadComplete();
      onClose();
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["name", "roll_no", "class_level", "parent_name", "parent_phone"];
    const exampleData = [
      {
        name: "John Doe",
        roll_no: "001",
        class_level: "10",
        parent_name: "Jane Doe",
        parent_phone: "9876543210",
      },
      {
        name: "Jane Smith",
        roll_no: "002",
        class_level: "10",
        parent_name: "John Smith",
        parent_phone: "9876543211",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exampleData);
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_upload_template.xlsx");
    toast.success("Template downloaded!");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Bulk Upload Students</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Upload multiple students at once using an Excel file
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          >
            <Icons.X />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-[#FF7043] transition-colors cursor-pointer bg-slate-50/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-4">
                <Icons.Upload />
              </div>
              <p className="text-lg font-bold text-slate-800">Drop your Excel file here</p>
              <p className="text-sm text-slate-500 font-medium mt-1">
                or click to browse · Supports .xlsx, .xls, .csv
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Required column:</span>
                <span className="font-bold text-[#FF7043]">name</span>
                <span>·</span>
                <span>Optional:</span>
                <span className="font-bold">roll_no, class_level, parent_name, parent_phone</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <Icons.FileSpreadsheet />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Download Template</p>
                  <p className="text-xs text-slate-500">Get a sample file with the correct format</p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 rounded-lg bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] transition-colors"
              >
                Download
              </button>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <Icons.FileSpreadsheet />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{file?.name}</p>
                <p className="text-xs text-slate-500">{previewData.length} rows loaded</p>
              </div>
              <button
                onClick={() => { setStep("upload"); setFile(null); setPreviewData([]); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Icons.X />
              </button>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800 mb-2">Column Mapping</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3">
                {allFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${requiredFields.includes(field) ? "text-[#FF7043]" : "text-slate-400"}`}>
                      {field} {requiredFields.includes(field) && "*"}
                    </span>
                    <span className="text-xs text-slate-500">→</span>
                    <span className="text-xs font-medium text-slate-700">
                      {mapping[field] || <span className="text-slate-400">(not mapped)</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                * Required field. Make sure your file has a column named "name".
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Department (optional)</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#FF7043] focus:ring-2 focus:ring-[#FF7043]/20"
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedSection("");
                  }}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Section (optional)</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#FF7043] focus:ring-2 focus:ring-[#FF7043]/20"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  disabled={!selectedDepartment}
                >
                  <option value="">None</option>
                  {sections
                    .filter((s) => s.department_id === selectedDepartment)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Batch (optional)</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#FF7043] focus:ring-2 focus:ring-[#FF7043]/20"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  <option value="">None</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-800">Preview (first 5 rows)</p>
                {errors.length > 0 && (
                  <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                    <Icons.AlertCircle /> {errors.length} error(s)
                  </span>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {allFields.map((field) => (
                        <th key={field} className="px-3 py-2 text-left text-xs font-bold text-slate-500">
                          {field} {requiredFields.includes(field) && "*"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        {allFields.map((field) => (
                          <td key={field} className="px-3 py-2 text-xs text-slate-700">
                            {getMappedValue(row, field) || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 5 && (
                <p className="text-xs text-slate-400 mt-1">+ {previewData.length - 5} more rows</p>
              )}
            </div>

            {errors.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 max-h-32 overflow-y-auto">
                <p className="text-xs font-bold text-red-600 mb-1">Validation Errors:</p>
                <ul className="space-y-0.5">
                  {errors.slice(0, 10).map((err, idx) => (
                    <li key={idx} className="text-xs text-red-500 flex items-start gap-1">
                      <span>•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-xs text-red-400">+ {errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => { setStep("upload"); setErrors([]); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePreviewSubmit}
                disabled={errors.length > 0 || uploading}
                className="px-6 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Icons.Loader /> Uploading...
                  </>
                ) : (
                  <>
                    <Icons.Check /> Upload {previewData.length} Students
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-4">
              <Icons.Loader />
            </div>
            <p className="text-lg font-bold text-slate-800">Uploading Students...</p>
            <p className="text-sm text-slate-500 mt-1">Please wait, this may take a moment</p>
          </div>
        )}
      </div>
    </div>
  );
}