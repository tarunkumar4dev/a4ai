// src/components/WorksheetModal.tsx
import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  X, FileDown, Loader2, Upload, Image as ImageIcon,
  CheckCircle, FileText, Trash2, Sparkles
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface WorksheetModalProps {
  moduleId: string;
  moduleTitle: string;
  moduleSubject: string;
  moduleClass: string;
  onClose: () => void;
}

const QUESTION_TYPES = [
  { id: 'MCQ', label: 'MCQ' },
  { id: 'Fill in the Blanks', label: 'Fill in the Blanks' },
  { id: 'True/False', label: 'True / False' },
  { id: 'Short Answer', label: 'Short Answer' },
  { id: 'Long Answer', label: 'Long Answer' },
  { id: 'Match the Following', label: 'Match the Following' },
];

const WorksheetModal: React.FC<WorksheetModalProps> = ({
  moduleId, moduleTitle, moduleSubject, moduleClass, onClose
}) => {
  // ─── Form State ───
  const [subject, setSubject] = useState(moduleSubject || '');
  const [customSubject, setCustomSubject] = useState('');
  const [classLevel, setClassLevel] = useState(moduleClass || '');
  const [customClass, setCustomClass] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['MCQ', 'Fill in the Blanks', 'Short Answer']);
  const [schoolName, setSchoolName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ─── Process State ───
  const [step, setStep] = useState<'form' | 'generating' | 'preview' | 'downloading'>('form');
  const [worksheetData, setWorksheetData] = useState<any>(null);
  const [error, setError] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);

  // ─── Toggle question type ───
  const toggleType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  };

  // ─── Handle logo upload ───
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo file must be under 2MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // ─── Convert logo to base64 ───
  const getLogoBase64 = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!logoFile) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(logoFile);
    });
  };

  // ─── Generate worksheet ───
  const handleGenerate = async () => {
    if (selectedTypes.length === 0) {
      setError('Please select at least one question type');
      return;
    }

    setError('');
    setStep('generating');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) { setError('Please login first'); setStep('form'); return; }

      const finalSubject = subject === 'Other' ? customSubject : subject;
      const finalClass = classLevel === 'Other' ? customClass : classLevel;

      const res = await fetch(`${API_URL}/modules/${moduleId}/generate-worksheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          num_questions: numQuestions,
          question_types: selectedTypes,
          difficulty: difficulty,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.detail || data.error || 'Generation failed');

      // Override subject/class with user's selection
      const wd = data.worksheet;
      wd.subject = finalSubject || wd.subject;
      wd.class = finalClass || wd.class;

      setWorksheetData(wd);
      setStep('preview');

    } catch (err: any) {
      setError(err.message || 'Failed to generate worksheet');
      setStep('form');
    }
  };

  // ─── Download PDF ───
  const handleDownload = async (withAnswers: boolean) => {
    setStep('downloading');
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;

      const logoB64 = await getLogoBase64();

      const res = await fetch(`${API_URL}/modules/${moduleId}/download-worksheet`, {
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

      // Convert base64 to blob and download
      const byteChars = atob(data.pdf_base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `worksheet_${withAnswers ? 'with_answers' : 'questions_only'}.pdf`;
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-500 to-purple-600">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Worksheet
            </h3>
            <p className="text-violet-200 text-xs mt-0.5">{moduleTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {/* ─── STEP 1: Form ─── */}
          {step === 'form' && (
            <div className="space-y-5">
              {/* Subject & Class */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                    <option value="">Select</option>
                    {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Science', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Economics', 'Accountancy', 'Other'].map(s =>
                      <option key={s} value={s}>{s}</option>
                    )}
                  </select>
                  {subject === 'Other' && (
                    <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Type subject name"
                      className="w-full mt-2 p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Class</label>
                  <select value={classLevel} onChange={e => setClassLevel(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                    <option value="">Select</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(c =>
                      <option key={c} value={String(c)}>Class {c}</option>
                    )}
                    <option value="Other">Other</option>
                  </select>
                  {classLevel === 'Other' && (
                    <input value={customClass} onChange={e => setCustomClass(e.target.value)} placeholder="Type class/level"
                      className="w-full mt-2 p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
                  )}
                </div>
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Number of Questions: <span className="text-violet-600 font-bold">{numQuestions}</span>
                </label>
                <input type="range" min={5} max={30} value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>5</span><span>15</span><span>30</span>
                </div>
              </div>

              {/* Question Types */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(qt => (
                    <button key={qt.id} onClick={() => toggleType(qt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selectedTypes.includes(qt.id)
                          ? 'bg-violet-100 border-violet-400 text-violet-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {selectedTypes.includes(qt.id) && <span className="mr-1">✓</span>}
                      {qt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Difficulty Level</label>
                <div className="flex gap-2">
                  {['easy', 'medium', 'hard', 'mixed'].map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${
                        difficulty === d
                          ? d === 'easy' ? 'bg-green-100 border-green-400 text-green-700'
                            : d === 'hard' ? 'bg-red-100 border-red-400 text-red-700'
                            : d === 'mixed' ? 'bg-blue-100 border-blue-400 text-blue-700'
                            : 'bg-yellow-100 border-yellow-400 text-yellow-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Optional</p>
              </div>

              {/* School Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">School / Institute Name</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  placeholder="e.g. ABC Public School" maxLength={100}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">School Logo (header + watermark)</label>
                {logoPreview ? (
                  <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain rounded-lg border border-gray-200 bg-white p-1" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 font-medium truncate">{logoFile?.name}</p>
                      <p className="text-xs text-gray-400">{((logoFile?.size || 0) / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={removeLogo} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm">Click to upload logo (PNG/JPG, max 2MB)</span>
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="hidden" />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
              )}

              {/* Generate Button */}
              <button onClick={handleGenerate}
                className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Generate Worksheet
              </button>
            </div>
          )}

          {/* ─── STEP 2: Generating ─── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-gray-700 font-semibold">Generating worksheet...</p>
              <p className="text-gray-400 text-sm">Creating {numQuestions} questions from module content</p>
            </div>
          )}

          {/* ─── STEP 3: Preview + Download ─── */}
          {step === 'preview' && worksheetData && (
            <div className="space-y-5">
              {/* Preview header */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Worksheet Ready!</p>
                  <p className="text-xs text-green-600">{worksheetData.questions?.length} questions generated</p>
                </div>
              </div>

              {/* Questions preview */}
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {worksheetData.questions?.map((q: any, i: number) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{q.q_no}</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{q.question}</p>
                        {q.options && (
                          <div className="mt-1.5 space-y-0.5">
                            {q.options.map((opt: string, j: number) => (
                              <p key={j} className="text-xs text-gray-600 ml-2">{opt}</p>
                            ))}
                          </div>
                        )}
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-violet-100 text-violet-600 text-[10px] font-semibold rounded-full">{q.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
              )}

              {/* Download Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDownload(false)}
                  disabled={step as string === 'downloading'}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {(step as string) === 'downloading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Questions Only
                </button>
                <button
                  onClick={() => handleDownload(true)}
                  disabled={step as string === 'downloading'}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {(step as string) === 'downloading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  With Answers
                </button>
              </div>

              {/* Regenerate */}
              <button onClick={() => { setStep('form'); setWorksheetData(null); }}
                className="w-full py-2 text-sm text-violet-600 font-medium hover:bg-violet-50 rounded-xl transition-colors">
                ← Back to options (regenerate)
              </button>
            </div>
          )}

          {/* ─── Downloading state ─── */}
          {(step as string) === 'downloading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
              <p className="text-gray-700 font-semibold">Preparing PDF...</p>
              <p className="text-gray-400 text-sm">Your download will start automatically</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorksheetModal;
