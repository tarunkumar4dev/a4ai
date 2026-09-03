// src/pages/ModulesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import ModuleCreator from '../components/ModuleCreator';
import { supabase } from '@/lib/supabaseClient';
import {
  BookOpen, FileText, Clock, AlertCircle, ChevronDown, ChevronUp,
  Trash2, Loader2, Sparkles, CheckCircle, XCircle, RefreshCw,
  Beaker, Lightbulb, AlertTriangle, Brain, ListChecks, Table2, FileImage
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Module {
  id: string;
  title: string;
  subject: string;
  class: string;
  status: string;
  page_count: number | null;
  original_filename: string;
  is_scanned: boolean;
  created_at: string;
  error_message: string | null;
}

interface FormulaItem { formula: string; meaning: string; example?: string; }
interface TableItem { title: string; headers: string[]; rows: string[][]; }
interface MisconceptionItem { wrong: string; correct: string; }
interface TermItem { term: string; definition: string; example?: string; }
interface MindMapBranch { branch: string; sub_branches: string[]; }

interface TopicItem {
  name: string;
  explanation?: string;
  key_points?: string[];
  subtopics?: string[];
  formulas?: FormulaItem[];
  diagrams_description?: string[];
  tables?: TableItem[];
  real_life_applications?: string[];
  misconceptions?: MisconceptionItem[];
}

interface ModuleSummary {
  title: string;
  overview: string;
  topics: TopicItem[];
  important_terms: TermItem[];
  mind_map?: { central_topic: string; branches: MindMapBranch[]; };
  learning_objectives?: string[];
  formulas_or_rules?: string[];
  quick_revision_notes?: string[];
  difficulty_level: string;
  estimated_study_time: string;
  question_types_possible?: string[];
}

const ModulesPage: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [moduleSummary, setModuleSummary] = useState<Record<string, ModuleSummary>>({});
  const [moduleImages, setModuleImages] = useState<Record<string, any[]>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [deletingModule, setDeletingModule] = useState<string | null>(null);
  const [generatingTest, setGeneratingTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchModules = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) { setLoading(false); return; }

      const res = await fetch(`${API_URL}/modules/list?teacher_id=${teacherId}`);
      const data = await res.json();
      if (data.success) setModules(data.modules);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchModules(); }, 1000);
    return () => clearTimeout(timer);
  }, [fetchModules]);

  const handleModuleCreated = () => { fetchModules(); };

  const toggleExpand = async (moduleId: string) => {
    if (expandedModule === moduleId) { setExpandedModule(null); return; }
    setExpandedModule(moduleId);
    if (!moduleSummary[moduleId]) {
      setLoadingSummary(moduleId);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData?.session?.user?.id;
        const res = await fetch(`${API_URL}/modules/${moduleId}?teacher_id=${teacherId}`);
        const data = await res.json();
        if (data.success && data.summary) {
          setModuleSummary((prev) => ({ ...prev, [moduleId]: data.summary }));
          if (data.images) setModuleImages((prev) => ({ ...prev, [moduleId]: data.images }));
        }
      } catch (err) { console.error('Failed to fetch module details:', err); }
      finally { setLoadingSummary(null); }
    }
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    setDeletingModule(moduleId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      const res = await fetch(`${API_URL}/modules/${moduleId}?teacher_id=${teacherId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setModules((prev) => prev.filter((m) => m.id !== moduleId));
        if (expandedModule === moduleId) setExpandedModule(null);
      }
    } catch (err) { console.error('Delete failed:', err); }
    finally { setDeletingModule(null); }
  };

  const handleGenerateTest = async (moduleId: string) => {
    setGeneratingTest(moduleId);
    setTestResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      const res = await fetch(`${API_URL}/modules/${moduleId}/generate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, num_questions: 10, difficulty: 'medium', question_types: ['MCQ', 'Short Answer', 'Long Answer'] }),
      });
      const data = await res.json();
      if (data.success) setTestResult(data.test);
      else alert(data.error || 'Test generation failed');
    } catch (err) { console.error('Test generation failed:', err); alert('Test generation failed'); }
    finally { setGeneratingTest(null); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Ready</span>;
      case 'processing': case 'extracting': case 'summarizing': case 'chunking':
        return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> {status}</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Failed</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ─── Section Renderers ───

  const renderFormulas = (formulas: FormulaItem[]) => {
    if (!formulas?.length) return null;
    return (
      <div className="mt-3">
        <h6 className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-2"><Beaker className="w-3.5 h-3.5" /> Formulas & Equations</h6>
        <div className="space-y-2">
          {formulas.map((f, i) => (
            <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="font-mono text-sm font-bold text-purple-900">{f.formula}</p>
              <p className="text-xs text-purple-700 mt-1">{f.meaning}</p>
              {f.example && <p className="text-xs text-purple-600 mt-1 italic">Example: {f.example}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTables = (tables: TableItem[]) => {
    if (!tables?.length) return null;
    return (
      <div className="mt-3">
        <h6 className="text-xs font-semibold text-indigo-700 flex items-center gap-1 mb-2"><Table2 className="w-3.5 h-3.5" /> Comparison Tables</h6>
        {tables.map((table, i) => (
          <div key={i} className="mb-3">
            <p className="text-xs font-medium text-indigo-800 mb-1">{table.title}</p>
            <div className="overflow-x-auto rounded-lg border border-indigo-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-indigo-50">{table.headers?.map((h, j) => <th key={j} className="px-3 py-2 text-left font-semibold text-indigo-800 border-b border-indigo-200">{h}</th>)}</tr></thead>
                <tbody>{table.rows?.map((row, j) => <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30'}>{row.map((cell, k) => <td key={k} className="px-3 py-2 text-gray-700 border-b border-indigo-100">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDiagrams = (diagrams: string[]) => {
    if (!diagrams?.length) return null;
    return (
      <div className="mt-3">
        <h6 className="text-xs font-semibold text-teal-700 flex items-center gap-1 mb-2"><FileImage className="w-3.5 h-3.5" /> Diagrams & Illustrations</h6>
        <div className="space-y-1">
          {diagrams.map((d, i) => <div key={i} className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-xs text-teal-800 flex items-start gap-2"><span className="mt-0.5">📐</span><span>{d}</span></div>)}
        </div>
      </div>
    );
  };

  const renderApps = (apps: string[]) => {
    if (!apps?.length) return null;
    return (
      <div className="mt-3">
        <h6 className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-2"><Lightbulb className="w-3.5 h-3.5" /> Real-Life Applications</h6>
        <div className="space-y-1">
          {apps.map((app, i) => <p key={i} className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg p-2 flex items-start gap-2"><span className="mt-0.5">🌍</span><span>{app}</span></p>)}
        </div>
      </div>
    );
  };

  const renderMisconceptions = (items: MisconceptionItem[]) => {
    if (!items?.length) return null;
    return (
      <div className="mt-3">
        <h6 className="text-xs font-semibold text-orange-700 flex items-center gap-1 mb-2"><AlertTriangle className="w-3.5 h-3.5" /> Common Misconceptions</h6>
        <div className="space-y-2">
          {items.map((m, i) => (
            <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs text-red-700"><span className="font-bold">✗ Wrong:</span> {m.wrong}</p>
              <p className="text-xs text-green-700 mt-1"><span className="font-bold">✓ Correct:</span> {m.correct}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMindMap = (mm: { central_topic: string; branches: MindMapBranch[] }) => {
    if (!mm?.branches?.length) return null;
    return (
      <div className="mt-4">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><Brain className="w-4 h-4 text-violet-600" /> Mind Map</h5>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="text-center mb-3"><span className="inline-block bg-violet-600 text-white text-sm font-bold px-4 py-2 rounded-full">{mm.central_topic}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mm.branches.map((b, i) => (
              <div key={i} className="bg-white border border-violet-200 rounded-lg p-3">
                <p className="text-xs font-bold text-violet-800 mb-2">{b.branch}</p>
                <div className="flex flex-wrap gap-1">{b.sub_branches?.map((s, j) => <span key={j} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] rounded-full">{s}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTerms = (terms: TermItem[]) => {
    if (!terms?.length) return null;
    return (
      <div className="mt-4">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4 text-blue-600" /> Important Terms & Definitions</h5>
        <div className="space-y-2">
          {terms.map((t, i) => (
            <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-bold text-blue-900">{t.term}</p>
              <p className="text-xs text-blue-800 mt-1">{t.definition}</p>
              {t.example && <p className="text-xs text-blue-600 mt-1 italic">Example: {t.example}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRevision = (notes: string[]) => {
    if (!notes?.length) return null;
    return (
      <div className="mt-4">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><ListChecks className="w-4 h-4 text-amber-600" /> Quick Revision Notes</h5>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
          {notes.map((n, i) => <p key={i} className="text-xs text-amber-900 flex items-start gap-2"><span className="font-bold text-amber-600 shrink-0">#{i + 1}</span><span>{n}</span></p>)}
        </div>
      </div>
    );
  };

  const renderObjectives = (objs: string[]) => {
    if (!objs?.length) return null;
    return (
      <div className="mt-4">
        <h5 className="text-sm font-semibold text-gray-700 mb-2">🎯 Learning Objectives</h5>
        <div className="space-y-1">
          {objs.map((o, i) => <p key={i} className="text-xs text-gray-700 flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span><span>{o}</span></p>)}
        </div>
      </div>
    );
  };

  // ─── Main Render ───
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ModuleCreator onModuleCreated={handleModuleCreated} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> Your Modules</h3>
            <button onClick={fetchModules} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /><span className="ml-2 text-gray-500">Loading modules...</span></div>
          ) : modules.length === 0 ? (
            <div className="text-center py-12"><FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No modules created yet.</p><p className="text-sm text-gray-400">Upload a document to create your first module!</p></div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {modules.map((mod) => (
                <div key={mod.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => mod.status === 'ready' && toggleExpand(mod.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-800 truncate">{mod.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500"><span>{mod.subject}</span><span>Class {mod.class}</span>{mod.page_count && <span>{mod.page_count} pages</span>}</div>
                        <div className="flex items-center gap-2 mt-1"><Clock className="w-3 h-3 text-gray-400" /><span className="text-xs text-gray-400">{formatDate(mod.created_at)}</span></div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {getStatusBadge(mod.status)}
                        {mod.status === 'ready' && (expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
                      </div>
                    </div>
                    {mod.error_message && <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{mod.error_message}</div>}
                  </div>

                  {expandedModule === mod.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {loadingSummary === mod.id ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="ml-2 text-sm text-gray-500">Loading summary...</span></div>
                      ) : moduleSummary[mod.id] ? (
                        <div className="space-y-4">
                          <div><h5 className="text-sm font-semibold text-gray-700 mb-1">Overview</h5><p className="text-sm text-gray-600 leading-relaxed">{moduleSummary[mod.id].overview}</p></div>

                          {moduleSummary[mod.id].topics?.length > 0 && (
                            <div>
                              <h5 className="text-sm font-semibold text-gray-700 mb-3">📚 Topics</h5>
                              <div className="space-y-4">
                                {moduleSummary[mod.id].topics.map((topic, i) => (
                                  <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200"><p className="font-semibold text-sm text-gray-900">{topic.name}</p></div>
                                    <div className="p-4 space-y-3">
                                      {topic.explanation && <p className="text-xs text-gray-700 leading-relaxed">{topic.explanation}</p>}
                                      {topic.key_points?.length ? <div><h6 className="text-xs font-semibold text-gray-600 mb-1">Key Points</h6><ul className="space-y-1">{topic.key_points.map((pt, j) => <li key={j} className="text-xs text-gray-600 flex items-start gap-2"><span className="text-blue-500 mt-0.5 shrink-0">●</span><span>{pt}</span></li>)}</ul></div> : null}
                                      {renderFormulas(topic.formulas || [])}
                                      {renderTables(topic.tables || [])}
                                      {renderDiagrams(topic.diagrams_description || [])}
                                      {renderApps(topic.real_life_applications || [])}
                                      {renderMisconceptions(topic.misconceptions || [])}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {renderTerms(moduleSummary[mod.id].important_terms)}
                          {moduleSummary[mod.id].mind_map && renderMindMap(moduleSummary[mod.id].mind_map!)}
                          {renderObjectives(moduleSummary[mod.id].learning_objectives || [])}
                          {renderRevision(moduleSummary[mod.id].quick_revision_notes || [])}
                                                    {/* Extracted PDF Images */}
                                                    {moduleImages[mod.id]?.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">🖼️ Extracted Diagrams & Figures</h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {moduleImages[mod.id].map((img: any, i: number) => (
                                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <img src={img.url} alt={`Figure from page ${img.page}`} className="w-full h-auto" loading="lazy" />
                                    <p className="text-xs text-gray-500 p-2 text-center">Page {img.page}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-2 border-t border-gray-200">
                            {moduleSummary[mod.id].difficulty_level && <span className="bg-gray-100 px-2 py-1 rounded-full">Difficulty: {moduleSummary[mod.id].difficulty_level}</span>}
                            {moduleSummary[mod.id].estimated_study_time && <span className="bg-gray-100 px-2 py-1 rounded-full">Study time: {moduleSummary[mod.id].estimated_study_time}</span>}
                          </div>
                        </div>
                      ) : <p className="text-sm text-gray-500">No summary available.</p>}

                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
                        <button onClick={() => handleGenerateTest(mod.id)} disabled={generatingTest === mod.id} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                          {generatingTest === mod.id ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate Test</>}
                        </button>
                        <button onClick={() => handleDelete(mod.id)} disabled={deletingModule === mod.id} className="flex items-center gap-1 px-3 py-2 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                          {deletingModule === mod.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {testResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-gray-800">{testResult.title}</h3><button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button></div>
            <div className="flex gap-4 text-sm text-gray-500 mb-4"><span>Total Marks: {testResult.total_marks}</span><span>Duration: {testResult.duration_minutes} min</span><span>Questions: {testResult.questions?.length}</span></div>
            <div className="space-y-4">
              {testResult.questions?.map((q: any, i: number) => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between"><p className="font-medium text-gray-800">Q{q.q_no}. {q.question}</p><span className="text-xs text-gray-500 ml-2 whitespace-nowrap">[{q.marks} marks]</span></div>
                  {q.options && <div className="mt-2 space-y-1">{q.options.map((opt: string, j: number) => <p key={j} className="text-sm text-gray-600 ml-4">{opt}</p>)}</div>}
                  <details className="mt-2"><summary className="text-sm text-blue-600 cursor-pointer">Show Answer</summary><div className="mt-1 p-2 bg-green-50 rounded text-sm"><p className="text-green-800 font-medium">Answer: {q.answer}</p>{q.solution && <p className="text-green-700 mt-1">{q.solution}</p>}</div></details>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulesPage;
