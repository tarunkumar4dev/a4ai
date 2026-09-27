// src/components/ModuleCreator.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — AI Module Creator
// Clean, reliable & modern UI for generating AI modules from PDF/DOCX
// ──────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  X,
  BookOpen,
  GraduationCap,
  BookCheck,
  Layers,
  Hash,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000'
).replace(/\/+$/, '');

interface ModuleCreatorProps {
  onModuleCreated?: (module: any) => void;
}

type ProcessingStatus = 'idle' | 'uploading' | 'creating' | 'processing' | 'ready' | 'failed';

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
];

const SCHOOL_LEVELS = [
  { value: 'Less than 9th', label: 'Less than 9th' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' },
];

const DEGREE_LEVELS = [
  'B.Tech',
  'BCA',
  'B.Sc',
  'B.A',
  'B.Com',
  'BBA',
  'M.Tech',
  'MCA',
  'MBA',
  'Other',
];

export const ModuleCreator: React.FC<ModuleCreatorProps> = ({ onModuleCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [moduleData, setModuleData] = useState<any>(null);
  const [error, setError] = useState('');

  const isSubmitting = status === 'uploading' || status === 'creating' || status === 'processing';
  const resolvedSubject = subject === 'Other' ? customSubject.trim() : subject;
  const canSubmit = Boolean(file && resolvedSubject && classLevel) && !isSubmitting;

  /* ── Dropzone ── */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: isSubmitting,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError('');
        setModuleData(null);
        setStatus('idle');
        setStatusMessage('');
      }
    },
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || 'Invalid file format or size exceeds 50MB';
      setError(msg);
    },
  });

  /* ── Submit Pipeline ── */
  const handleSubmit = async () => {
    const finalSubject = subject === 'Other' && customSubject.trim() ? customSubject.trim() : subject;
    if (!file || !finalSubject || !classLevel) {
      setError('Please select subject, class/level, and upload a document.');
      return;
    }

    setError('');
    setModuleData(null);

    try {
      // 1. Get teacher_id from Supabase auth
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) {
        setError('Please login first to create modules.');
        return;
      }
      const accessToken = sessionData?.session?.access_token || '';

      // 2. Upload file to Supabase Storage
      setStatus('uploading');
      setStatusMessage('Uploading document to secure storage...');

      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileId = uuidv4();
      const storagePath = `${teacherId}/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Modules')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 3. Create module row in backend
      setStatus('creating');
      setStatusMessage('Registering module in database...');

      const createRes = await fetch(`${API_URL}/modules/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          subject: finalSubject,
          class_level: classLevel,
          teacher_id: teacherId,
          file_type: fileExt,
          file_size_bytes: file.size,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || createData.detail || 'Failed to create module');
      }

      const moduleId = createData.module_id;

      // 4. Process module (extract + summarize + chunk)
      setStatus('processing');
      setStatusMessage('AI is analyzing the document (extracting topics, formulas & concepts)...');

      const processRes = await fetch(`${API_URL}/modules/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ module_id: moduleId }),
      });

      const processData = await processRes.json();
      if (!processData.success) {
        throw new Error(processData.error || processData.detail || 'AI processing failed');
      }

      // Done
      setStatus('ready');
      setStatusMessage('Module created and indexed successfully!');
      setModuleData(processData);

      if (onModuleCreated) {
        onModuleCreated(processData);
      }

      // Reset input form
      setFile(null);
      setSubject('');
      setCustomSubject('');
      setClassLevel('');
    } catch (err: any) {
      console.error('Module creation error:', err);
      setStatus('failed');
      setError(err.message || 'Something went wrong while generating the module.');
      setStatusMessage('');
    }
  };

  const resetAll = () => {
    setFile(null);
    setSubject('');
    setCustomSubject('');
    setClassLevel('');
    setStatus('idle');
    setStatusMessage('');
    setModuleData(null);
    setError('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Create AI Module
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Upload textbook chapter, notes, or PDF to extract smart study notes
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Subject & Class Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Subject Dropdown */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              <BookCheck className="w-3.5 h-3.5 text-orange-500" />
              <span>Subject</span>
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer disabled:opacity-60"
            >
              <option value="">Select subject...</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Other">Other (Custom Subject)</option>
            </select>

            {subject === 'Other' && (
              <input
                type="text"
                placeholder="e.g. Operating Systems, Data Structures..."
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                disabled={isSubmitting}
                className="w-full mt-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            )}
          </div>

          {/* Class / Degree Dropdown */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-orange-500" />
              <span>Class / Degree</span>
            </label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer disabled:opacity-60"
            >
              <option value="">Select class or degree...</option>
              <optgroup label="School">
                {SCHOOL_LEVELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Higher Education / Degree">
                {DEGREE_LEVELS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* File Dropzone */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            <Upload className="w-3.5 h-3.5 text-orange-500" />
            <span>Document (PDF / DOCX)</span>
          </label>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              file
                ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : isDragActive
                ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-orange-400 hover:bg-orange-50/20'
            } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input {...getInputProps()} />

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
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                  {isDragActive ? 'Drop your document here' : 'Click or drag & drop textbook chapter'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Supports PDF or DOCX (up to 50 MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3.5 px-5 rounded-xl font-black text-xs sm:text-sm text-white transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{statusMessage || 'Processing document with AI...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate AI Module</span>
            </>
          )}
        </button>

        {/* Status indicator while loading */}
        {isSubmitting && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-xl flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-orange-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-black">Creation Failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="p-1 hover:bg-rose-100 rounded text-rose-400 hover:text-rose-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Success Card */}
        {moduleData && status === 'ready' && (
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h4 className="font-black text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                  {moduleData.title || 'Module Generated Successfully!'}
                </h4>
              </div>
              <button
                onClick={resetAll}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                + New Module
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-bold uppercase text-slate-400">Pages</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {moduleData.page_count ?? '—'}
                </p>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-bold uppercase text-slate-400">Topics</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {moduleData.topics_count ?? '—'}
                </p>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-bold uppercase text-slate-400">Chunks</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {moduleData.chunks_count ?? '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleCreator;