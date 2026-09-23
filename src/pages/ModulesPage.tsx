// src/pages/ModulesPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ModuleCreator from '../components/ModuleCreator';
import { supabase } from '@/lib/supabaseClient';
import {
  BookOpen, FileText, Clock, AlertCircle, ChevronDown, ChevronUp,
  Trash2, Loader2, Sparkles, CheckCircle, XCircle, RefreshCw,
  Beaker, Lightbulb, AlertTriangle, Brain, ListChecks, Table2,
  FileImage, Target, Zap, BookMarked, FlaskConical
} from 'lucide-react';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000'
).replace(/\/+$/, '');

// ─── Topic colors (cycle through) ───
const TOPIC_COLORS = [
  { bg: 'from-blue-500 to-indigo-600', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  { bg: 'from-purple-500 to-violet-600', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'from-orange-500 to-amber-600', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' },
  { bg: 'from-cyan-500 to-sky-600', light: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800' },
];

// ─── Mermaid Mind Map Renderer ───
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);
  const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        // @ts-ignore
        if (!window.mermaid) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
          script.onload = () => {
            // @ts-ignore
            window.mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: { primaryColor: '#6366f1', primaryTextColor: '#1e1b4b', primaryBorderColor: '#818cf8', lineColor: '#6366f1', secondaryColor: '#ede9fe', tertiaryColor: '#f5f3ff' } });
            renderChart();
          };
          document.head.appendChild(script);
        } else {
          renderChart();
        }
      } catch (e) {
        setError(true);
      }
    };

    const renderChart = async () => {
      if (!ref.current) return;
      try {
        // @ts-ignore
        const { svg } = await window.mermaid.render(id.current, chart);
        if (ref.current) {
          ref.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e) {
        setError(true);
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) return null;
  return (
    <div ref={ref} className={`mermaid-container overflow-x-auto ${!rendered ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`} />
  );
};

// ─── Build Mermaid mindmap from data ───
const buildMermaidChart = (mm: any): string => {
  if (!mm?.branches?.length) return '';
  const lines = ['mindmap', `  root((${mm.central_topic}))`];
  mm.branches.forEach((b: any) => {
    lines.push(`    ${b.branch}`);
    (b.sub_branches || []).forEach((s: string) => {
      lines.push(`      ${s}`);
    });
  });
  return lines.join('\n');
};

// ─── Types ───
interface Module { id: string; title: string; subject: string; class: string; status: string; page_count: number | null; original_filename: string; is_scanned: boolean; created_at: string; error_message: string | null; }
interface FormulaItem { formula: string; meaning: string; example?: string; }
interface TableItem { title: string; headers: string[]; rows: string[][]; }
interface MisconceptionItem { wrong: string; correct: string; }
interface TermItem { term: string; definition: string; example?: string; }
interface TopicItem { name: string; explanation?: string; key_points?: string[]; subtopics?: string[]; formulas?: FormulaItem[]; diagrams_description?: string[]; tables?: TableItem[]; real_life_applications?: string[]; misconceptions?: MisconceptionItem[]; }
interface ModuleSummary { title: string; overview: string; topics: TopicItem[]; important_terms: TermItem[]; mind_map?: any; learning_objectives?: string[]; formulas_or_rules?: string[]; quick_revision_notes?: string[]; difficulty_level: string; estimated_study_time: string; question_types_possible?: string[]; }

// ─── Main Component ───
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
  const [expandedTopics, setExpandedTopics] = useState<Record<string, Set<number>>>({});

  const fetchModules = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      if (!teacherId) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/modules/list?teacher_id=${teacherId}`);
      const data = await res.json();
      if (data.success) setModules(data.modules);
    } catch (err) { console.error('Failed to fetch modules:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const toggleTopicExpand = (moduleId: string, idx: number) => {
    setExpandedTopics(prev => {
      const set = new Set(prev[moduleId] || []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [moduleId]: set };
    });
  };

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
          setModuleSummary(prev => ({ ...prev, [moduleId]: data.summary }));
          if (data.images) setModuleImages(prev => ({ ...prev, [moduleId]: data.images }));
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
      if (data.success) { setModules(prev => prev.filter(m => m.id !== moduleId)); if (expandedModule === moduleId) setExpandedModule(null); }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, num_questions: 10, difficulty: 'medium', question_types: ['MCQ', 'Short Answer', 'Long Answer'] }),
      });
      const data = await res.json();
      if (data.success) setTestResult(data.test);
      else alert(data.error || 'Test generation failed');
    } catch (err) { alert('Test generation failed'); }
    finally { setGeneratingTest(null); }
  };

  const getDifficultyColor = (d: string) => {
    if (d === 'easy') return 'bg-green-100 text-green-700';
    if (d === 'hard') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" />Ready</span>;
      case 'processing': case 'extracting': case 'summarizing': case 'chunking':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" />{status}</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Failed</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ─── Section renderers ───

  const SectionHeader = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) => (
    <div className={`flex items-center gap-2 mb-3`}>
      <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
      <h5 className="text-sm font-bold text-gray-800">{label}</h5>
    </div>
  );

  const renderFormulas = (formulas: FormulaItem[]) => {
    if (!formulas?.length) return null;
    return (
      <div className="mt-4">
        <SectionHeader icon={<FlaskConical className="w-4 h-4 text-purple-600" />} label="Formulas & Equations" color="bg-purple-100" />
        <div className="space-y-3">
          {formulas.map((f, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
              <div className="pl-4 pr-4 py-3">
                <p className="font-mono text-base font-bold text-purple-900 bg-white/70 rounded-lg px-3 py-2 inline-block">{f.formula}</p>
                <p className="text-xs text-purple-700 mt-2">{f.meaning}</p>
                {f.example && <p className="text-xs text-purple-500 mt-1 italic flex items-center gap-1"><Zap className="w-3 h-3" />Example: {f.example}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTables = (tables: TableItem[]) => {
    if (!tables?.length) return null;
    return (
      <div className="mt-4">
        <SectionHeader icon={<Table2 className="w-4 h-4 text-indigo-600" />} label="Comparison Tables" color="bg-indigo-100" />
        {tables.map((table, i) => (
          <div key={i} className="mb-4 rounded-xl overflow-hidden border border-indigo-200 shadow-sm">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2">
              <p className="text-xs font-bold text-white">{table.title}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-indigo-50">{table.headers?.map((h, j) => <th key={j} className="px-4 py-2.5 text-left font-bold text-indigo-800 border-b border-indigo-200">{h}</th>)}</tr></thead>
                <tbody>{table.rows?.map((row, j) => <tr key={j} className={`${j % 2 === 0 ? 'bg-white' : 'bg-indigo-50/40'} hover:bg-indigo-50 transition-colors`}>{row.map((cell, k) => <td key={k} className="px-4 py-2.5 text-gray-700 border-b border-indigo-100">{cell}</td>)}</tr>)}</tbody>
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
      <div className="mt-4">
        <SectionHeader icon={<FileImage className="w-4 h-4 text-teal-600" />} label="Diagram Notes" color="bg-teal-100" />
        <div className="grid gap-2">
          {diagrams.map((d, i) => (
            <div key={i} className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-3">
              <span className="text-lg shrink-0">📐</span>
              <p className="text-xs text-teal-800 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderApps = (apps: string[]) => {
    if (!apps?.length) return null;
    return (
      <div className="mt-4">
        <SectionHeader icon={<Lightbulb className="w-4 h-4 text-amber-600" />} label="Real-Life Applications" color="bg-amber-100" />
        <div className="grid gap-2">
          {apps.map((app, i) => (
            <div key={i} className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3">
              <span className="text-lg shrink-0">🌍</span>
              <p className="text-xs text-amber-900 leading-relaxed">{app}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMisconceptions = (items: MisconceptionItem[]) => {
    if (!items?.length) return null;
    return (
      <div className="mt-4">
        <SectionHeader icon={<AlertTriangle className="w-4 h-4 text-orange-600" />} label="Common Misconceptions" color="bg-orange-100" />
        <div className="space-y-3">
          {items.map((m, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-orange-200 shadow-sm">
              <div className="flex items-start gap-3 bg-red-50 p-3 border-b border-orange-200">
                <span className="text-base shrink-0">❌</span>
                <div><p className="text-xs font-bold text-red-700 mb-0.5">Wrong Belief</p><p className="text-xs text-red-600">{m.wrong}</p></div>
              </div>
              <div className="flex items-start gap-3 bg-green-50 p-3">
                <span className="text-base shrink-0">✅</span>
                <div><p className="text-xs font-bold text-green-700 mb-0.5">Correct Understanding</p><p className="text-xs text-green-600">{m.correct}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMindMap = (mm: any) => {
    if (!mm?.branches?.length) return null;
    const chart = buildMermaidChart(mm);
    return (
      <div className="mt-6">
        <SectionHeader icon={<Brain className="w-4 h-4 text-violet-600" />} label="Mind Map" color="bg-violet-100" />
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 shadow-sm">
          {chart ? (
            <MermaidDiagram chart={chart} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {mm.branches.map((b: any, i: number) => (
                <div key={i} className="bg-white border border-violet-200 rounded-xl p-3 shadow-sm">
                  <p className="text-xs font-bold text-violet-800 mb-2 flex items-center gap-1"><span className="w-5 h-5 bg-violet-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>{b.branch}</p>
                  <div className="flex flex-wrap gap-1">{b.sub_branches?.map((s: string, j: number) => <span key={j} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-medium rounded-full">{s}</span>)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTerms = (terms: TermItem[]) => {
    if (!terms?.length) return null;
    return (
      <div className="mt-6">
        <SectionHeader icon={<BookMarked className="w-4 h-4 text-blue-600" />} label="Important Terms & Definitions" color="bg-blue-100" />
        <div className="grid gap-3">
          {terms.map((t, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-blue-200 shadow-sm">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 flex items-center gap-2">
                <span className="text-white text-xs font-bold">{t.term}</span>
              </div>
              <div className="bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-900 leading-relaxed">{t.definition}</p>
                {t.example && <p className="text-xs text-blue-500 mt-2 italic flex items-center gap-1"><Zap className="w-3 h-3" />Example: {t.example}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRevision = (notes: string[]) => {
    if (!notes?.length) return null;
    return (
      <div className="mt-6">
        <SectionHeader icon={<ListChecks className="w-4 h-4 text-amber-600" />} label="Quick Revision Notes" color="bg-amber-100" />
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4">
          <div className="grid gap-2">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/70 rounded-xl px-3 py-2">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-400 text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <p className="text-xs text-amber-900 leading-relaxed">{n}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderObjectives = (objs: string[]) => {
    if (!objs?.length) return null;
    return (
      <div className="mt-6">
        <SectionHeader icon={<Target className="w-4 h-4 text-green-600" />} label="Learning Objectives" color="bg-green-100" />
        <div className="space-y-2">
          {objs.map((o, i) => (
            <div key={i} className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs text-green-800 leading-relaxed">{o}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderImages = (images: any[]) => {
    if (!images?.length) return null;
    return (
      <div className="mt-6">
        <SectionHeader icon={<FileImage className="w-4 h-4 text-teal-600" />} label="Extracted Diagrams & Figures" color="bg-teal-100" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img: any, i: number) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white hover:shadow-md transition-shadow">
              <img src={img.url} alt={`Figure from page ${img.page}`} className="w-full h-32 object-contain bg-gray-50 p-2" loading="lazy" />
              <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100">
                <p className="text-[10px] text-gray-500 text-center font-medium">Page {img.page}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Main Render ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            Module Generator
          </h1>
          <p className="text-gray-500 mt-2 ml-1">Upload any PDF and generate a comprehensive, AI-powered study module</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Left: Create Module */}
          <div className="xl:col-span-2">
            <ModuleCreator onModuleCreated={() => fetchModules()} />
          </div>

          {/* Right: Module List */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Your Modules
                  {modules.length > 0 && <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{modules.length}</span>}
                </h3>
                <button onClick={fetchModules} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Loading your modules...</p>
                  </div>
                ) : modules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center">
                      <FileText className="w-10 h-10 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">No modules yet</p>
                      <p className="text-gray-400 text-sm mt-1">Upload a PDF to create your first module!</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                    {modules.map((mod) => (
                      <div key={mod.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                        {/* Module Card Header */}
                        <div
                          className={`p-4 cursor-pointer transition-colors ${mod.status === 'ready' ? 'hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/50' : ''}`}
                          onClick={() => mod.status === 'ready' && toggleExpand(mod.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 truncate text-sm">{mod.title}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{mod.subject}</span>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Class {mod.class}</span>
                                {mod.page_count && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{mod.page_count} pages</span>}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-[11px] text-gray-400">{formatDate(mod.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(mod.status)}
                              {mod.status === 'ready' && (
                                <div className="p-1 rounded-lg bg-gray-100">
                                  {expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                </div>
                              )}
                            </div>
                          </div>
                          {mod.error_message && (
                            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-red-600">{mod.error_message}</p>
                            </div>
                          )}
                        </div>

                        {/* Expanded Module Content */}
                        {expandedModule === mod.id && (
                          <div className="border-t border-gray-100">
                            {loadingSummary === mod.id ? (
                              <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                                <p className="text-sm text-gray-400">Generating beautiful module...</p>
                              </div>
                            ) : moduleSummary[mod.id] ? (
                              <div className="p-5">
                                {/* Overview Card */}
                                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-5 text-white mb-6 shadow-lg">
                                  <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <BookOpen className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Module Overview</span>
                                  </div>
                                  <p className="text-sm leading-relaxed opacity-95">{moduleSummary[mod.id].overview}</p>
                                  <div className="flex flex-wrap gap-2 mt-4">
                                    {moduleSummary[mod.id].difficulty_level && (
                                      <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">
                                        Difficulty: {moduleSummary[mod.id].difficulty_level}
                                      </span>
                                    )}
                                    {moduleSummary[mod.id].estimated_study_time && (
                                      <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">
                                        ⏱ {moduleSummary[mod.id].estimated_study_time}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Topics */}
                                {moduleSummary[mod.id].topics?.length > 0 && (
                                  <div className="mb-6">
                                    <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                                      <div className="p-1.5 bg-blue-100 rounded-lg"><BookOpen className="w-4 h-4 text-blue-600" /></div>
                                      Topics ({moduleSummary[mod.id].topics.length})
                                    </h4>
                                    <div className="space-y-3">
                                      {moduleSummary[mod.id].topics.map((topic, i) => {
                                        const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
                                        const isExpanded = expandedTopics[mod.id]?.has(i);
                                        return (
                                          <div key={i} className={`rounded-2xl overflow-hidden border ${color.border} shadow-sm`}>
                                            {/* Topic Header */}
                                            <div
                                              className={`bg-gradient-to-r ${color.bg} p-4 cursor-pointer flex items-center justify-between gap-3`}
                                              onClick={() => toggleTopicExpand(mod.id, i)}
                                            >
                                              <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 bg-white/25 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</span>
                                                <p className="font-bold text-white text-sm">{topic.name}</p>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                {topic.formulas?.length ? <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">{topic.formulas.length} formulas</span> : null}
                                                {topic.tables?.length ? <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">{topic.tables.length} tables</span> : null}
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                                              </div>
                                            </div>

                                            {/* Topic Body */}
                                            <div className={`${color.light} p-4`}>
                                              {/* Explanation always visible */}
                                              {topic.explanation && (
                                                <p className="text-sm text-gray-700 leading-relaxed mb-3">{topic.explanation}</p>
                                              )}

                                              {/* Key points always visible */}
                                              {topic.key_points?.length ? (
                                                <div className="mb-3">
                                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Key Points</p>
                                                  <ul className="space-y-1.5">
                                                    {topic.key_points.map((pt, j) => (
                                                      <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                                                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.text.replace('text-', 'bg-')}`} />
                                                        {pt}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              ) : null}

                                              {/* Expanded content */}
                                              {isExpanded && (
                                                <div className="mt-2 space-y-2">
                                                  {renderFormulas(topic.formulas || [])}
                                                  {renderTables(topic.tables || [])}
                                                  {renderDiagrams(topic.diagrams_description || [])}
                                                  {renderApps(topic.real_life_applications || [])}
                                                  {renderMisconceptions(topic.misconceptions || [])}
                                                </div>
                                              )}

                                              {/* Expand hint */}
                                              {!isExpanded && (topic.formulas?.length || topic.tables?.length || topic.misconceptions?.length || topic.real_life_applications?.length) ? (
                                                <button
                                                  onClick={() => toggleTopicExpand(mod.id, i)}
                                                  className={`mt-2 text-xs ${color.text} font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity`}
                                                >
                                                  <ChevronDown className="w-3 h-3" /> Show formulas, tables & more
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Extracted Images */}
                                {renderImages(moduleImages[mod.id] || [])}

                                {/* Mind Map */}
                                {moduleSummary[mod.id].mind_map && renderMindMap(moduleSummary[mod.id].mind_map)}

                                {/* Important Terms */}
                                {renderTerms(moduleSummary[mod.id].important_terms)}

                                {/* Learning Objectives */}
                                {renderObjectives(moduleSummary[mod.id].learning_objectives || [])}

                                {/* Quick Revision */}
                                {renderRevision(moduleSummary[mod.id].quick_revision_notes || [])}

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                                  <button
                                    onClick={() => handleGenerateTest(mod.id)}
                                    disabled={generatingTest === mod.id}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                                  >
                                    {generatingTest === mod.id ? <><Loader2 className="w-4 h-4 animate-spin" />Generating Test...</> : <><Sparkles className="w-4 h-4" />Generate Test Paper</>}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(mod.id)}
                                    disabled={deletingModule === mod.id}
                                    className="flex items-center gap-1.5 px-4 py-3 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 border border-red-200 disabled:opacity-50 transition-all"
                                  >
                                    {deletingModule === mod.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-6 text-center text-gray-400 text-sm">No summary available.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Result Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-blue-600">
              <div>
                <h3 className="text-lg font-bold text-white">{testResult.title}</h3>
                <div className="flex gap-4 text-xs text-white/80 mt-1">
                  <span>Total Marks: {testResult.total_marks}</span>
                  <span>Duration: {testResult.duration_minutes} min</span>
                  <span>{testResult.questions?.length} Questions</span>
                </div>
              </div>
              <button onClick={() => setTestResult(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 text-lg font-bold transition-colors">×</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {testResult.questions?.map((q: any, i: number) => (
                <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-800 text-sm"><span className="text-indigo-600 font-bold">Q{q.q_no}.</span> {q.question}</p>
                    <span className="shrink-0 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{q.marks}M</span>
                  </div>
                  {q.options && <div className="px-4 py-3 space-y-1 bg-white">{q.options.map((opt: string, j: number) => <p key={j} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-indigo-400 font-bold">{String.fromCharCode(65 + j)}.</span>{opt.replace(/^[a-d]\)/i, '').trim()}</p>)}</div>}
                  <details className="group">
                    <summary className="px-4 py-2 text-xs font-semibold text-indigo-600 cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-1">
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" /> Show Answer
                    </summary>
                    <div className="px-4 py-3 bg-green-50 border-t border-green-200">
                      <p className="text-green-800 font-semibold text-sm">✓ {q.answer}</p>
                      {q.solution && <p className="text-green-700 text-xs mt-1 leading-relaxed">{q.solution}</p>}
                    </div>
                  </details>
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