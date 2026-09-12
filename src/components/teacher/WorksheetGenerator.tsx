// src/components/teacher/WorksheetGenerator.tsx
import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import {
  Upload, FileText, Loader2, FileDown, CheckCircle, Trash2,
  Image as ImageIcon, Sparkles, ChevronDown, X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QUESTION_TYPES = [
  { id: 'MCQ', label: 'MCQ' },
  { id: 'Fill in the Blanks', label: 'Fill in Blanks' },
  { id: 'True/False', label: 'True / False' },
  { id: 'Short Answer', label: 'Short Answer' },
  { id: 'Long Answer', label: 'Long Answer' },
  { id: 'Match the Following', label: 'Match the Following' },
];

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Science', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Economics', 'Accountancy', 'Business Studies', 'Other'];

type Step = 'upload' | 'generating' | 'preview' | 'downloading';

const WorksheetGenerator: React.FC = () => {
  const { user } = useAuth();

  // Form
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

  // Process
  const [step, setStep] = useState<Step>('upload');
  const [worksheetData, setWorksheetData] = useState<any>(null);
  const [error, setError] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File handlers ───
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
    if (f) { setFile(f); setError(''); }
  };

  const toggleType = (id: string) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return; }
      setLogoFile(f);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const getLogoBase64 = (): Promise<string | null> => {
    return new Promise(resolve => {
      if (!logoFile) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(logoFile);
    });
  };

  // ─── Generate ───
  const handleGenerate = async () => {
    if (!file) { setError('Please upload a PDF/DOCX file'); return; }
    if (selectedTypes.length === 0) { setError('Select at least one question type'); return; }

    setError('');
    setStep('generating');

    try {
      const teacherId = user?.id;
      if (!teacherId) { setError('Please login first'); setStep('upload'); return; }

      // Upload PDF to Supabase Storage (temp)
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileId = uuidv4();
      const storagePath = `${teacherId}/worksheets/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('Modules')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const finalSubject = subject === 'Other' ? customSubject : subject;
      const finalClass = classLevel === 'Other' ? customClass : classLevel;

      // Call backend
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
      if (!data.success) throw new Error(data.detail || data.error || 'Generation failed');

      setWorksheetData(data.worksheet);
      setStep('preview');

    } catch (err: any) {
      setError(err.message || 'Failed to generate worksheet');
      setStep('upload');
    }
  };

  // ─── Download PDF ───
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

      // Download PDF
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

  // ─── Reset ───
  const handleReset = () => {
    setFile(null);
    setWorksheetData(null);
    setStep('upload');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          Worksheet Generator
        </h2>
        <p className="text-gray-500 mt-1 ml-1">Upload any PDF and generate a professional assignment worksheet</p>
      </div>

      {/* ─── STEP 1: Upload + Options ─── */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Upload + Settings */}
          <div className="lg:col-span-3 space-y-5">
            {/* File Upload */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📄 Upload Document</h3>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50/30'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileSelect} className="hidden" />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-green-700 text-sm">{file.name}</p>
                      <p className="text-xs text-green-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 text-sm font-medium">Drag & drop PDF/DOCX here</p>
                    <p className="text-gray-400 text-xs mt-1">or click to browse (max 50MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Subject, Class, Chapter */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📋 Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500">
                    <option value="">Select</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {subject === 'Other' && <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Type subject" className="w-full mt-2 p-2 border border-gray-300 rounded-xl text-sm" />}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Class</label>
                  <select value={classLevel} onChange={e => setClassLevel(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500">
                    <option value="">Select</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(c => <option key={c} value={String(c)}>Class {c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                  {classLevel === 'Other' && <input value={customClass} onChange={e => setCustomClass(e.target.value)} placeholder="Type class" className="w-full mt-2 p-2 border border-gray-300 rounded-xl text-sm" />}
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Chapter Name (optional)</label>
                <input value={chapterName} onChange={e => setChapterName(e.target.value)} placeholder="e.g. Chemical Reactions and Equations"
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>

            {/* Questions Config */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">⚙️ Question Settings</h3>

              {/* Number */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Number of Questions: <span className="text-violet-600 font-bold text-sm">{numQuestions}</span>
                </label>
                <input type="range" min={5} max={30} value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>5</span><span>15</span><span>30</span></div>
              </div>

              {/* Types */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(qt => (
                    <button key={qt.id} onClick={() => toggleType(qt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selectedTypes.includes(qt.id)
                          ? 'bg-violet-100 border-violet-400 text-violet-700 shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {selectedTypes.includes(qt.id) && '✓ '}{qt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Difficulty</label>
                <div className="flex gap-2">
                  {[
                    { id: 'easy', color: 'green' },
                    { id: 'medium', color: 'yellow' },
                    { id: 'hard', color: 'red' },
                    { id: 'mixed', color: 'blue' },
                  ].map(d => (
                    <button key={d.id} onClick={() => setDifficulty(d.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${
                        difficulty === d.id
                          ? `bg-${d.color}-100 border-${d.color}-400 text-${d.color}-700 shadow-sm`
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>{d.id}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Optional settings + Generate */}
          <div className="lg:col-span-2 space-y-5">
            {/* Optional */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-1">✨ Optional</h3>
              <p className="text-xs text-gray-400 mb-3">Add branding to your worksheet</p>

              {/* School Name */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">School / Institute Name</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Delhi Public School"
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
              </div>

              {/* Logo */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">School Logo</label>
                {logoPreview ? (
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded-lg border bg-white p-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 font-medium truncate">{logoFile?.name}</p>
                      <p className="text-[10px] text-gray-400">{((logoFile?.size || 0) / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors text-xs">
                    <ImageIcon className="w-4 h-4" />
                    Upload logo (PNG/JPG)
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="hidden" />
                <p className="text-[10px] text-gray-400 mt-1">Appears in header + as watermark</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>{error}
              </div>
            )}

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={!file}
              className={`w-full py-4 font-bold rounded-2xl text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                file ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 hover:shadow-xl' : 'bg-gray-300 cursor-not-allowed'
              }`}>
              <Sparkles className="w-5 h-5" />
              Generate Worksheet
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Generating ─── */}
      {step === 'generating' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-gray-800 font-bold text-lg">Generating Worksheet...</p>
          <p className="text-gray-400 text-sm">Creating {numQuestions} questions from your document</p>
          <div className="flex gap-2 mt-2">
            {['Extracting text', 'Analyzing content', 'Creating questions'].map((s, i) => (
              <span key={i} className="px-3 py-1 bg-violet-50 text-violet-600 text-xs font-medium rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview + Download ─── */}
      {step === 'preview' && worksheetData && (
        <div className="space-y-5">
          {/* Success header */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-green-800 text-lg">Worksheet Ready!</p>
              <p className="text-sm text-green-600">{worksheetData.questions?.length} questions generated from {file?.name}</p>
            </div>
          </div>

          {/* Questions Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-700">Preview Questions</h3>
            </div>
            <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
              {worksheetData.questions?.map((q: any, i: number) => (
                <div key={i} className="flex gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
                  <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{q.q_no}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{q.question}</p>
                    {q.options && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1">
                        {q.options.map((opt: string, j: number) => (
                          <p key={j} className="text-xs text-gray-600 bg-white rounded-lg px-2 py-1 border border-gray-100">{opt}</p>
                        ))}
                      </div>
                    )}
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-violet-50 text-violet-600 text-[10px] font-bold rounded-full">{q.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

          {/* Download Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => handleDownload(false)} disabled={(step as string) === 'downloading'}
              className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-2xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg text-sm">
              <FileDown className="w-5 h-5" />
              Download Questions Only
            </button>
            <button onClick={() => handleDownload(true)} disabled={(step as string) === 'downloading'}
              className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-2xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition-all shadow-lg text-sm">
              <FileDown className="w-5 h-5" />
              Download With Answers
            </button>
          </div>

          {/* Back */}
          <button onClick={handleReset}
            className="w-full py-3 text-sm text-violet-600 font-semibold hover:bg-violet-50 rounded-xl transition-colors border border-violet-200">
            ← Generate Another Worksheet
          </button>
        </div>
      )}

      {/* ─── Downloading ─── */}
      {step === 'downloading' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
          <p className="text-gray-800 font-bold text-lg">Preparing PDF...</p>
          <p className="text-gray-400 text-sm">Your download will start automatically</p>
        </div>
      )}
    </div>
  );
};

export default WorksheetGenerator;
