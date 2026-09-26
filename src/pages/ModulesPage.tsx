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
  { bg: 'from-blue-600 to-indigo-600', light: 'bg-blue-500/5 dark:bg-blue-950/20', border: 'border-blue-200/80 dark:border-blue-800/50', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' },
  { bg: 'from-purple-600 to-violet-600', light: 'bg-purple-500/5 dark:bg-purple-950/20', border: 'border-purple-200/80 dark:border-purple-800/50', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300' },
  { bg: 'from-emerald-600 to-teal-600', light: 'bg-emerald-500/5 dark:bg-emerald-950/20', border: 'border-emerald-200/80 dark:border-emerald-800/50', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' },
  { bg: 'from-orange-600 to-amber-600', light: 'bg-orange-500/5 dark:bg-orange-950/20', border: 'border-orange-200/80 dark:border-orange-800/50', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' },
  { bg: 'from-rose-600 to-pink-600', light: 'bg-rose-500/5 dark:bg-rose-950/20', border: 'border-rose-200/80 dark:border-rose-800/50', text: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300' },
  { bg: 'from-cyan-600 to-sky-600', light: 'bg-cyan-500/5 dark:bg-cyan-950/20', border: 'border-cyan-200/80 dark:border-cyan-800/50', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300' },
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
    if (d === 'easy') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40';
    if (d === 'hard') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300/40';
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 shadow-xs">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Ready
          </span>
        );
      case 'processing':
      case 'extracting':
      case 'summarizing':
      case 'chunking':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-300/50 dark:border-indigo-800/50 shadow-xs animate-pulse">
            <Loader2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400 animate-spin" />
            {status}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300/50 dark:border-rose-800/50 shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Failed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ─── Section renderers ───

  const SectionHeader = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-xl ${color}`}>{icon}</div>
      <h5 className="text-sm font-black text-slate-800 dark:text-slate-100">{label}</h5>
    </div>
  );

  const renderFormulas = (formulas: FormulaItem[]) => {
    if (!formulas?.length) return null;
    return (
      <div className="mt-4">
        <SectionHeader icon={<FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />} label="Formulas & Equations" color="bg-purple-100 dark:bg-purple-950/50" />
        <div className="space-y-3">
          {formulas.map((f, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-purple-200/80 dark:border-purple-800/50 bg-gradient-to-r from-purple-50/70 to-violet-50/70 dark:from-purple-950/20 dark:to-violet-950/20">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
              <div className="pl-4 pr-4 py-3">
                <p className="font-mono text-sm sm:text-base font-bold text-purple-900 dark:text-purple-200 bg-white/80 dark:bg-slate-900/80 rounded-xl px-3 py-2 inline-block border border-purple-100 dark:border-purple-900/40">{f.formula}</p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-2 font-medium">{f.meaning}</p>
                {f.example && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 italic flex items-center gap-1 font-medium">
                    <Zap className="w-3 h-3 text-purple-500" />Example: {f.example}
                  </p>
                )}
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
        <SectionHeader icon={<Table2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} label="Comparison Tables" color="bg-indigo-100 dark:bg-indigo-950/50" />
        {tables.map((table, i) => (
          <div key={i} className="mb-4 rounded-2xl overflow-hidden border border-indigo-200/80 dark:border-indigo-800/50 shadow-xs">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5">
              <p className="text-xs font-black text-white">{table.title}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-indigo-50/80 dark:bg-indigo-950/40">
                    {table.headers?.map((h, j) => (
                      <th key={j} className="px-4 py-2.5 text-left font-black text-indigo-900 dark:text-indigo-200 border-b border-indigo-200 dark:border-indigo-800/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows?.map((row, j) => (
                    <tr key={j} className={`${j % 2 === 0 ? 'bg-white/70 dark:bg-slate-900/70' : 'bg-indigo-50/30 dark:bg-indigo-950/20'} hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors`}>
                      {row.map((cell, k) => (
                        <td key={k} className="px-4 py-2.5 text-slate-700 dark:text-slate-300 border-b border-indigo-100/60 dark:border-indigo-900/30">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
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
        <SectionHeader icon={<FileImage className="w-4 h-4 text-teal-600 dark:text-teal-400" />} label="Diagram Notes" color="bg-teal-100 dark:bg-teal-950/50" />
        <div className="grid gap-2">
          {diagrams.map((d, i) => (
            <div key={i} className="flex items-start gap-3 bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/50 rounded-2xl p-3.5">
              <span className="text-lg shrink-0">📐</span>
              <p className="text-xs text-teal-900 dark:text-teal-200 leading-relaxed font-medium">{d}</p>
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
        <SectionHeader icon={<Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />} label="Real-Life Applications" color="bg-amber-100 dark:bg-amber-950/50" />
        <div className="grid gap-2">
          {apps.map((app, i) => (
            <div key={i} className="flex items-start gap-3 bg-gradient-to-r from-amber-50/70 to-yellow-50/70 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-3.5">
              <span className="text-lg shrink-0">🌍</span>
              <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed font-medium">{app}</p>
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
        <SectionHeader icon={<AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />} label="Common Misconceptions" color="bg-orange-100 dark:bg-orange-950/50" />
        <div className="space-y-3">
          {items.map((m, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <div className="flex items-start gap-3 bg-red-50/80 dark:bg-red-950/20 p-3.5 border-b border-orange-200/60 dark:border-orange-800/30">
                <span className="text-base shrink-0">❌</span>
                <div>
                  <p className="text-xs font-black text-rose-700 dark:text-rose-300 mb-0.5">Common Misconception</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{m.wrong}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-emerald-50/80 dark:bg-emerald-950/20 p-3.5">
                <span className="text-base shrink-0">✅</span>
                <div>
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 mb-0.5">Correct Understanding</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{m.correct}</p>
                </div>
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
        <SectionHeader icon={<Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />} label="Mind Map" color="bg-violet-100 dark:bg-violet-950/50" />
        <div className="bg-gradient-to-br from-violet-50/70 to-purple-50/70 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200/80 dark:border-violet-800/50 rounded-2xl p-4 shadow-xs">
          {chart ? (
            <MermaidDiagram chart={chart} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {mm.branches.map((b: any, i: number) => (
                <div key={i} className="bg-white/80 dark:bg-slate-900/80 border border-violet-200/70 dark:border-violet-800/40 rounded-xl p-3 shadow-xs">
                  <p className="text-xs font-extrabold text-violet-900 dark:text-violet-200 mb-2 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-violet-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                    {b.branch}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {b.sub_branches?.map((s: string, j: number) => (
                      <span key={j} className="px-2 py-0.5 bg-violet-100/80 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 text-[10px] font-bold rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
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
        <SectionHeader icon={<BookMarked className="w-4 h-4 text-blue-600 dark:text-blue-400" />} label="Important Terms & Definitions" color="bg-blue-100 dark:bg-blue-950/50" />
        <div className="grid gap-3">
          {terms.map((t, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-blue-200/80 dark:border-blue-800/50 shadow-xs">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 flex items-center gap-2">
                <span className="text-white text-xs font-black">{t.term}</span>
              </div>
              <div className="bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3">
                <p className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-medium">{t.definition}</p>
                {t.example && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic flex items-center gap-1 font-medium">
                    <Zap className="w-3 h-3 text-blue-500" />Example: {t.example}
                  </p>
                )}
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
        <SectionHeader icon={<ListChecks className="w-4 h-4 text-amber-600 dark:text-amber-400" />} label="Quick Revision Notes" color="bg-amber-100 dark:bg-amber-950/50" />
        <div className="bg-gradient-to-br from-amber-50/70 to-yellow-50/70 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-4">
          <div className="grid gap-2">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/80 dark:bg-slate-900/80 border border-amber-100 dark:border-amber-900/30 rounded-xl px-3.5 py-2.5">
                <span className="shrink-0 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{n}</p>
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
        <SectionHeader icon={<Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} label="Learning Objectives" color="bg-emerald-100 dark:bg-emerald-950/50" />
        <div className="space-y-2">
          {objs.map((o, i) => (
            <div key={i} className="flex items-start gap-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-3.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed font-medium">{o}</p>
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
        <SectionHeader icon={<FileImage className="w-4 h-4 text-teal-600 dark:text-teal-400" />} label="Extracted Diagrams & Figures" color="bg-teal-100 dark:bg-teal-950/50" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img: any, i: number) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
              <img src={img.url} alt={`Figure from page ${img.page}`} className="w-full h-32 object-contain bg-slate-50 dark:bg-slate-800/50 p-2" loading="lazy" />
              <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-bold">Page {img.page}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Main Render ───
  return (
    <div className="space-y-6 sm:space-y-8 animate-pop">
      {/* ── TOP CONTROL / HEADER BAR ── */}
      <div className="glass-panel rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-sm border border-slate-200/60 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Module Generator & Library
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  AI Powered
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Generate comprehensive study modules, mind maps, formula sheets & tests from PDF/DOCX
              </p>
            </div>
          </div>

          {/* Quick Stats & Refresh Action */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-2 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 uppercase text-[10px] tracking-wider">Modules:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm">{modules.length}</span>
            </div>
            <button
              onClick={fetchModules}
              disabled={loading}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Refresh Modules"
            >
              <div className={loading ? "animate-spin" : ""}>
                <RefreshCw className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN WORKSPACE: CREATOR + LIBRARY ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left: Module Creator Form */}
        <div className="xl:col-span-5">
          <ModuleCreator onModuleCreated={() => fetchModules()} />
        </div>

        {/* Right: Modules Library */}
        <div className="xl:col-span-7">
          <div className="glass-panel rounded-3xl sm:rounded-[32px] p-5 sm:p-7 border border-slate-200/60 dark:border-white/10 shadow-sm relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/60 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Your Modules
                </h3>
                {modules.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                    {modules.length}
                  </span>
                )}
              </div>
              <button
                onClick={fetchModules}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </button>
            </div>

            <div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm font-semibold">Loading your modules...</p>
                </div>
              ) : modules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-violet-500/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-500">
                    <FileText className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-slate-800 dark:text-slate-200 font-extrabold text-base">No modules created yet</p>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-sm">
                      Upload any syllabus chapter, study guide, or notes on the left to generate your first AI module!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
                  {modules.map((mod) => (
                    <div
                      key={mod.id}
                      className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-indigo-400/80 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                      {/* Module Card Header */}
                      <div
                        className={`p-4 sm:p-5 cursor-pointer transition-colors ${
                          mod.status === 'ready'
                            ? 'hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-blue-50/40 dark:hover:from-indigo-950/20 dark:hover:to-blue-950/20'
                            : ''
                        }`}
                        onClick={() => mod.status === 'ready' && toggleExpand(mod.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
                              {mod.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30">
                                {mod.subject}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
                                {/^\d+$/.test(String(mod.class || '')) ? `Class ${mod.class}` : (mod.class || 'General')}
                              </span>
                              {mod.page_count && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                  {mod.page_count} pages
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatDate(mod.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2.5">
                            {getStatusBadge(mod.status)}
                            {mod.status === 'ready' && (
                              <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                                {expandedModule === mod.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {mod.error_message && (
                          <div className="mt-3.5 flex items-start gap-2.5 bg-rose-500/10 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-3 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <p>{mod.error_message}</p>
                          </div>
                        )}
                      </div>

                      {/* Expanded Module Content */}
                      {expandedModule === mod.id && (
                        <div className="border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/40">
                          {loadingSummary === mod.id ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                              <p className="text-xs sm:text-sm text-slate-400 font-semibold">Loading module details & concepts...</p>
                            </div>
                          ) : moduleSummary[mod.id] ? (
                            <div className="p-4 sm:p-6 space-y-6">
                              {/* Overview Card */}
                              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-2 opacity-90">
                                  <BookOpen className="w-4 h-4" />
                                  <span className="text-xs font-black uppercase tracking-wider">Module Overview</span>
                                </div>
                                <p className="text-xs sm:text-sm leading-relaxed opacity-95 font-medium">
                                  {moduleSummary[mod.id].overview}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/20">
                                  {moduleSummary[mod.id].difficulty_level && (
                                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black backdrop-blur-sm">
                                      Difficulty: {moduleSummary[mod.id].difficulty_level}
                                    </span>
                                  )}
                                  {moduleSummary[mod.id].estimated_study_time && (
                                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black backdrop-blur-sm">
                                      ⏱ {moduleSummary[mod.id].estimated_study_time}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Topics Accordion */}
                              {moduleSummary[mod.id].topics?.length > 0 && (
                                <div>
                                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-3.5 flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                                      <BookOpen className="w-4 h-4" />
                                    </div>
                                    <span>Topics ({moduleSummary[mod.id].topics.length})</span>
                                  </h4>
                                  <div className="space-y-3">
                                    {moduleSummary[mod.id].topics.map((topic, i) => {
                                      const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
                                      const isExpanded = expandedTopics[mod.id]?.has(i);
                                      return (
                                        <div key={i} className={`rounded-2xl overflow-hidden border ${color.border} shadow-xs`}>
                                          {/* Topic Header */}
                                          <div
                                            className={`bg-gradient-to-r ${color.bg} p-3.5 sm:p-4 cursor-pointer flex items-center justify-between gap-3 text-white`}
                                            onClick={() => toggleTopicExpand(mod.id, i)}
                                          >
                                            <div className="flex items-center gap-3">
                                              <span className="w-6 h-6 bg-white/25 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0">
                                                {i + 1}
                                              </span>
                                              <p className="font-extrabold text-white text-xs sm:text-sm">{topic.name}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {topic.formulas?.length ? (
                                                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full">
                                                  {topic.formulas.length} formulas
                                                </span>
                                              ) : null}
                                              {topic.tables?.length ? (
                                                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full">
                                                  {topic.tables.length} tables
                                                </span>
                                              ) : null}
                                              {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                                            </div>
                                          </div>

                                          {/* Topic Body */}
                                          <div className={`${color.light} p-4 sm:p-5 border-t ${color.border}`}>
                                            {/* Explanation */}
                                            {topic.explanation && (
                                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3.5 font-medium">
                                                {topic.explanation}
                                              </p>
                                            )}

                                            {/* Key points */}
                                            {topic.key_points?.length ? (
                                              <div className="mb-3.5">
                                                <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                  Key Points
                                                </p>
                                                <ul className="space-y-1.5">
                                                  {topic.key_points.map((pt, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.text.replace('text-', 'bg-')}`} />
                                                      <span>{pt}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            ) : null}

                                            {/* Expanded content */}
                                            {isExpanded && (
                                              <div className="mt-3 space-y-3 pt-3 border-t border-slate-200/60 dark:border-white/5">
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
                                                className={`mt-2 text-xs ${color.text} font-bold flex items-center gap-1 hover:underline cursor-pointer`}
                                              >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                                <span>Show formulas, tables & concepts</span>
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
                              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-200/60 dark:border-white/5">
                                <button
                                  onClick={() => handleGenerateTest(mod.id)}
                                  disabled={generatingTest === mod.id}
                                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white text-xs sm:text-sm font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.99] cursor-pointer"
                                >
                                  {generatingTest === mod.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>Generating Test Paper...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4" />
                                      <span>Generate Test Paper</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDelete(mod.id)}
                                  disabled={deletingModule === mod.id}
                                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-3.5 px-4 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs sm:text-sm font-bold disabled:opacity-50 transition-all cursor-pointer"
                                >
                                  {deletingModule === mod.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-6 text-center text-slate-400 text-xs sm:text-sm font-semibold">
                              No summary available for this module.
                            </div>
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

      {/* Test Result Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-pop">
          <div className="glass-panel bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200/60 dark:border-white/10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
              <div>
                <h3 className="text-base sm:text-lg font-black">{testResult.title}</h3>
                <div className="flex flex-wrap gap-2.5 text-xs text-white/90 mt-1 font-bold">
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">Total Marks: {testResult.total_marks}</span>
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">Duration: {testResult.duration_minutes} min</span>
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">{testResult.questions?.length} Questions</span>
                </div>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-lg font-bold transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
              {testResult.questions?.map((q: any, i: number) => (
                <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 flex items-start justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60">
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                      <span className="text-indigo-600 dark:text-indigo-400 font-black mr-1">Q{q.q_no}.</span>
                      {q.question}
                    </p>
                    <span className="shrink-0 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 text-xs font-black rounded-full">
                      {q.marks}M
                    </span>
                  </div>
                  {q.options && (
                    <div className="px-4 py-3 space-y-1.5 bg-white/60 dark:bg-slate-900/60">
                      {q.options.map((opt: string, j: number) => (
                        <p key={j} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-indigo-500 dark:text-indigo-400 font-extrabold">{String.fromCharCode(65 + j)}.</span>
                          <span>{opt.replace(/^[a-d]\)/i, '').trim()}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <details className="group">
                    <summary className="px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-1.5">
                      <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                      <span>Show Answer & Solution</span>
                    </summary>
                    <div className="px-4 py-3 bg-emerald-500/10 dark:bg-emerald-950/20 border-t border-emerald-200/60 dark:border-emerald-900/40">
                      <p className="text-emerald-800 dark:text-emerald-300 font-black text-xs sm:text-sm">✓ {q.answer}</p>
                      {q.solution && (
                        <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-1.5 leading-relaxed font-medium">
                          {q.solution}
                        </p>
                      )}
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