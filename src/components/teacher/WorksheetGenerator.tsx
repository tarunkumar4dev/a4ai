// src/components/teacher/WorksheetGenerator.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Worksheet Generator
// Matches the exact style, typography & palette of TeacherAssignmentsTab
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import {
  Upload,
  FileText,
  Loader2,
  FileDown,
  CheckCircle,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  X,
  BookOpen,
  GraduationCap,
  Sliders,
  Building,
  Check,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000'
).replace(/\/+$/, '');

const QUESTION_TYPES = [
  { id: 'MCQ', label: 'MCQ' },
  { id: 'Fill in the Blanks', label: 'Fill in Blanks' },
  { id: 'True/False', label: 'True / False' },
  { id: 'Short Answer', label: 'Short Answer' },
  { id: 'Long Answer', label: 'Long Answer' },
  { id: 'Match the Following', label: 'Match the Following' },
];

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Science',
  'English',
  'Hindi',
  'Social Science',
  'Computer Science',
  'Economics',
  'Accountancy',
  'Business Studies',
  'Other',
];

const CLASS_OPTIONS = [
  { label: 'School', options: ['Less than 9th', '9', '10', '11', '12'].map((c) => ({ value: c, label: c === 'Less than 9th' ? c : `Class ${c}` })) },
  { label: 'Higher Education / Degree', options: ['B.Tech', 'BCA', 'B.Sc', 'B.A', 'B.Com', 'BBA', 'M.Tech', 'MCA', 'MBA', 'Other'].map((d) => ({ value: d, label: d })) },
];

type Step = 'upload' | 'generating' | 'preview' | 'downloading';

export const WorksheetGenerator: React.FC = () => {
  const { user } = useAuth();

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [customClass, setCustomClass] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['MCQ', 'Fill in the Blanks', 'Short Answer']);
  const [schoolName, setSchoolName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [chapterName, setChapterName] = useState('');

  // Process State
  const [step, setStep] = useState<Step>('upload');
  const [worksheetData, setWorksheetData] = useState<any>(null);
  const [error, setError] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.docx'))) {
      setFile(f);
      setError('');
    } else {
      setError('Only PDF and DOCX files are supported');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError('');
    }
  };

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 2 * 1024 * 1024) {
        setError('Logo must be under 2MB');
        return;
      }
      setLogoFile(f);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const getLogoBase64 = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!logoFile) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(logoFile);
    });
  };

  // Generate
  const handleGenerate = async () => {
    if (!file) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Please select at least one question type.');
      return;
    }

    setError('');
    setStep('generating');

    try {
      const teacherId = user?.id;
      if (!teacherId) {
        setError('Please login first');
        setStep('upload');
        return;
      }

      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileId = uuidv4();
      const storagePath = `${teacherId}/worksheets/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Modules')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const finalSubject = subject === 'Other' ? customSubject : subject;
      const finalClass = classLevel === 'Other' ? customClass : classLevel;

      const res = await fetch(`${API_URL}/worksheet/generate-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          storage_path: storagePath,
          subject: finalSubject || 'General',
          class_level: finalClass || '',
          chapter_name: chapterName || file.name.replace(/\.[^/.]+$/, ''),
          num_questions: numQuestions,
          question_types: selectedTypes,
          difficulty: difficulty,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.detail || data.error || 'Generation failed');
      }

      setWorksheetData(data.worksheet);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to generate worksheet');
      setStep('upload');
    }
  };

  // Download PDF
  const handleDownload = async (withAnswers: boolean) => {
    setStep('downloading');
    setError('');

    try {
      const teacherId = user?.id;
      const logoB64 = await getLogoBase64();

      const res = await fetch(`${API_URL}/worksheet/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          worksheet_data: worksheetData,
          include_answers: withAnswers,
          school_name: schoolName || null,
          logo_base64: logoB64,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.detail || 'Download failed');

      const byteChars = atob(data.pdf_base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `worksheet_${withAnswers ? 'with_answers' : 'questions'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Download failed');
      setStep('preview');
    }
  };

  const handleReset = () => {
    setFile(null);
    setWorksheetData(null);
    setStep('upload');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Top Header matching Assignments page ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Worksheet Generator
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">
              Printable PDF
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Create customized chapter worksheets with school branding & answer keys
          </p>
        </div>
      </div>

      {/* ── STEP 1: UPLOAD & CONFIG ── */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Document & Details */}
          <div className="lg:col-span-7 space-y-5">
            {/* File Upload Box */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Upload Document</span>
              </h3>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                  file
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-400 hover:bg-indigo-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to generate
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                      Click or drag & drop chapter PDF or DOCX
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                      Max file size: 50 MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Subject, Class & Chapter Details */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Subject & Class Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">Select subject...</option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {subject === 'Other' && (
                    <input
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Enter custom subject"
                      className="w-full mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Class / Level
                  </label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">Select class / level...</option>
                    {CLASS_OPTIONS.map((grp) => (
                      <optgroup key={grp.label} label={grp.label}>
                        {grp.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Chapter / Topic Name (Optional)
                </label>
                <input
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  placeholder="e.g. Chemical Reactions, Optics, Thermodynamics..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Branding */}
          <div className="lg:col-span-5 space-y-5">
            {/* Question Settings */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Question Settings</span>
              </h3>

              {/* Number of Questions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Questions Count:
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {numQuestions} Questions
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                  <span>5</span>
                  <span>15</span>
                  <span>30</span>
                </div>
              </div>

              {/* Question Types */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  Question Types
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUESTION_TYPES.map((qt) => {
                    const isSel = selectedTypes.includes(qt.id);
                    return (
                      <button
                        key={qt.id}
                        type="button"
                        onClick={() => toggleType(qt.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isSel
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isSel && <Check className="w-3 h-3" />}
                        <span>{qt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['easy', 'medium', 'hard', 'mixed'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                        difficulty === d
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* School / Institute Branding */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Institute Branding (Optional)</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Institute / School Name
                </label>
                <input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Delhi Public School / IIT Delhi"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Logo (PNG/JPG)
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-10 h-10 object-contain rounded-lg border bg-white p-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {logoFile?.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {((logoFile?.size || 0) / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-xl text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload Logo for Header & Watermark</span>
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={!file}
              className="w-full py-4 rounded-2xl font-black text-xs sm:text-sm text-white transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Worksheet PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: GENERATING ── */}
      {step === 'generating' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-2">
            Generating Worksheet...
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            AI is extracting {numQuestions} questions & formatting printable layout
          </p>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & DOWNLOAD ── */}
      {step === 'preview' && worksheetData && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-emerald-950">
                  Worksheet Generated Successfully!
                </h3>
                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                  {worksheetData.questions?.length || numQuestions} questions ready for download
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              + Create Another
            </button>
          </div>

          {/* Questions Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Worksheet Questions Preview
              </h4>
              <span className="text-xs text-slate-400 font-bold">
                {worksheetData.questions?.length} questions
              </span>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {worksheetData.questions?.map((q: any, i: number) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                      <span className="text-indigo-600 mr-1">Q{q.q_no || i + 1}.</span>
                      {q.question}
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {q.type}
                    </span>
                  </div>

                  {q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt: string, j: number) => (
                        <p
                          key={j}
                          className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                          <span className="font-bold text-indigo-600 mr-1.5">
                            {String.fromCharCode(65 + j)}.
                          </span>
                          {opt.replace(/^[a-d]\)/i, '').trim()}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Download Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleDownload(false)}
              className="py-4 px-5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
            >
              <FileDown className="w-5 h-5" />
              <span>Download Questions PDF</span>
            </button>

            <button
              onClick={() => handleDownload(true)}
              className="py-4 px-5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              <FileDown className="w-5 h-5" />
              <span>Download with Answer Key</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: DOWNLOADING ── */}
      {step === 'downloading' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-2">
            Preparing PDF...
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Your worksheet download will begin automatically
          </p>
        </div>
      )}
    </div>
  );
};

export default WorksheetGenerator;
