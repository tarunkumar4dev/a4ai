// src/components/ModuleCreator.tsx
import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, BookOpen, Sparkles, X, Layers, Hash, BookCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Backend API URL — local dev mein localhost, production mein Vercel URL
const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000'
).replace(/\/+$/, '');

interface ModuleCreatorProps {
  onModuleCreated?: (module: any) => void;
}

type ProcessingStatus = 'idle' | 'uploading' | 'creating' | 'processing' | 'ready' | 'failed';

export const ModuleCreator: React.FC<ModuleCreatorProps> = ({ onModuleCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [moduleData, setModuleData] = useState<any>(null);
  const [error, setError] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError('');
        setModuleData(null);
        setStatus('idle');
      }
    },
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || 'Invalid file format or size exceeds 50MB';
      setError(msg);
    },
  });

  const handleSubmit = async () => {
    const finalSubject = subject === 'Other' && customSubject.trim() ? customSubject.trim() : subject;
    if (!file || !finalSubject || !classLevel) {
      setError('Please fill all fields and upload a document');
      return;
    }

    setError('');
    setModuleData(null);

    try {
      // ── Step 1: Get teacher_id from Supabase auth ──
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) {
        setError('Please login first');
        return;
      }
      const accessToken = sessionData?.session?.access_token || '';

      // ── Step 2: Upload file to Supabase Storage ──
      setStatus('uploading');
      setStatusMessage('Uploading document to secure storage...');

      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileId = uuidv4();
      const storagePath = `${teacherId}/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Modules')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // ── Step 3: Create module row in backend ──
      setStatus('creating');
      setStatusMessage('Registering module in database...');

      const createRes = await fetch(`${API_URL}/modules/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          subject: subject === 'Other' && customSubject.trim() ? customSubject.trim() : subject,
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

      // ── Step 4: Process module (extract + summarize + chunk) ──
      setStatus('processing');
      setStatusMessage('Analyzing document with AI (extracting topics, concepts & formulas)...');

      const processRes = await fetch(`${API_URL}/modules/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ module_id: moduleId }),
      });

      const processData = await processRes.json();
      if (!processData.success) {
        throw new Error(processData.error || processData.detail || 'Processing failed');
      }

      // ── Done! ──
      setStatus('ready');
      setStatusMessage('Module created and indexed successfully!');
      setModuleData(processData);

      if (onModuleCreated) {
        onModuleCreated(processData);
      }

      // Reset form
      setFile(null);
      setSubject('');
      setCustomSubject('');
      setClassLevel('');

    } catch (err: any) {
      console.error('Module creation error:', err);
      setStatus('failed');
      setError(err.message || 'Something went wrong');
      setStatusMessage('');
    }
  };

  const isSubmitting = status !== 'idle' && status !== 'failed';

  return (
    <div className="glass-panel rounded-3xl sm:rounded-[32px] p-5 sm:p-7 border border-slate-200/60 dark:border-white/10 shadow-sm relative overflow-hidden backdrop-blur-xl">
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200/60 dark:border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Create New Module
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Module Generator
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Transform textbook chapters & notes into interactive learning modules
            </p>
          </div>
        </div>
      </div>

      {/* Subject & Class Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 relative z-10">
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Subject
          </label>
          <div className="relative">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold shadow-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-60"
            >
              <option value="">Select Subject</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Science">Science</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Social Science">Social Science</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Economics">Economics</option>
              <option value="Accountancy">Accountancy</option>
              <option value="Business Studies">Business Studies</option>
              <option value="Other">Other (Custom Subject)</option>
            </select>
          </div>
          {subject === 'Other' && (
            <input
              type="text"
              placeholder="e.g. Operating Systems, DSA..."
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              disabled={isSubmitting}
              className="w-full mt-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Class / Degree
          </label>
          <div className="relative">
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold shadow-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-60"
            >
              <option value="">Select Class / Level</option>
              <option value="Less than 9th">Less than 9th</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
              <optgroup label="Higher Education / Degree">
                <option value="B.Tech">B.Tech</option>
                <option value="BCA">BCA</option>
                <option value="B.Sc">B.Sc</option>
                <option value="B.A">B.A</option>
                <option value="B.Com">B.Com</option>
                <option value="BBA">BBA</option>
                <option value="M.Tech">M.Tech</option>
                <option value="MCA">MCA</option>
                <option value="MBA">MBA</option>
                <option value="Other">Other</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* File Dropzone */}
      <div className="relative z-10 mb-4">
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Document File (PDF / DOCX)
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
            file
              ? 'border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs'
              : isDragActive
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20'
          } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2">
              <div className="flex items-center gap-3 text-left">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[280px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform border border-indigo-100 dark:border-indigo-900/40">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Drag & drop your document here, or <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/40">browse</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  PDF
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  DOCX
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Up to 50MB
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!file || !(subject === 'Other' ? customSubject.trim() : subject) || !classLevel || isSubmitting}
        className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 ${
          !file || !(subject === 'Other' ? customSubject.trim() : subject) || !classLevel || isSubmitting
            ? 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:-translate-y-0.5 cursor-pointer'
        }`}
      >
        {!isSubmitting ? (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Generate AI Module</span>
          </>
        ) : (
          <span className="flex items-center justify-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{status === 'uploading' ? 'Uploading...' : status === 'creating' ? 'Saving...' : 'Processing with AI...'}</span>
          </span>
        )}
      </button>

      {/* Status Progress Pill */}
      {statusMessage && (
        <div
          className={`mt-4 p-3 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border transition-all ${
            status === 'ready'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
              : status === 'failed'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
              : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50'
          }`}
        >
          {status === 'ready' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : status === 'failed' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          )}
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Analytics Card */}
      {moduleData && status === 'ready' && (
        <div className="mt-5 p-4 sm:p-5 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/50 bg-emerald-500/10 dark:bg-emerald-950/20 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-extrabold text-sm sm:text-base text-emerald-900 dark:text-emerald-200">
              Module Ready: {moduleData.title || 'Processed Document'}
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40">
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Pages</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {moduleData.page_count ?? '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Topics</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {moduleData.topics_count ?? '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Chunks</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {moduleData.chunks_count ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleCreator;
