// src/pages/ModulesPage.tsx
// ──────────────────────────────────────────────────────────────────────
// AI Study Modules & Knowledge Hub
// Clean, aesthetic & powerful module library with instant test generation
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import ModuleCreator from '../components/ModuleCreator';
import { supabase } from '@/lib/supabaseClient';
import {
  BookOpen,
  FileText,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  Brain,
  ListChecks,
  Table2,
  FileImage,
  Target,
  Zap,
  BookMarked,
  FlaskConical,
  X,
} from 'lucide-react';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000'
).replace(/\/+$/, '');

// ─── Topic visual theme sets ───
const TOPIC_COLORS = [
  {
    bg: 'from-blue-600 to-indigo-600',
    light: 'bg-blue-50/60 dark:bg-blue-950/20',
    border: 'border-blue-200/80 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  },
  {
    bg: 'from-purple-600 to-violet-600',
    light: 'bg-purple-50/60 dark:bg-purple-950/20',
    border: 'border-purple-200/80 dark:border-purple-800/50',
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
  },
  {
    bg: 'from-emerald-600 to-teal-600',
    light: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    border: 'border-emerald-200/80 dark:border-emerald-800/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300',
  },
  {
    bg: 'from-orange-600 to-amber-600',
    light: 'bg-orange-50/60 dark:bg-orange-950/20',
    border: 'border-orange-200/80 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  },
  {
    bg: 'from-rose-600 to-pink-600',
    light: 'bg-rose-50/60 dark:bg-rose-950/20',
    border: 'border-rose-200/80 dark:border-rose-800/50',
    text: 'text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300',
  },
];

// ─── Interfaces ───
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

interface FormulaItem {
  formula: string;
  meaning: string;
  example?: string;
}

interface TableItem {
  title: string;
  headers: string[];
  rows: string[][];
}

interface MisconceptionItem {
  wrong: string;
  correct: string;
}

interface TermItem {
  term: string;
  definition: string;
  example?: string;
}

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
  mind_map?: any;
  learning_objectives?: string[];
  formulas_or_rules?: string[];
  quick_revision_notes?: string[];
  difficulty_level: string;
  estimated_study_time: string;
  question_types_possible?: string[];
}

export const ModulesPage: React.FC = () => {
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
      if (!teacherId) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/modules/list?teacher_id=${teacherId}`);
      const data = await res.json();
      if (data.success) {
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const toggleTopicExpand = (moduleId: string, idx: number) => {
    setExpandedTopics((prev) => {
      const set = new Set(prev[moduleId] || []);
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      return { ...prev, [moduleId]: set };
    });
  };

  const toggleExpand = async (moduleId: string) => {
    if (expandedModule === moduleId) {
      setExpandedModule(null);
      return;
    }
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
          if (data.images) {
            setModuleImages((prev) => ({ ...prev, [moduleId]: data.images }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch module details:', err);
      } finally {
        setLoadingSummary(null);
      }
    }
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    setDeletingModule(moduleId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const teacherId = sessionData?.session?.user?.id;
      const res = await fetch(`${API_URL}/modules/${moduleId}?teacher_id=${teacherId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setModules((prev) => prev.filter((m) => m.id !== moduleId));
        if (expandedModule === moduleId) setExpandedModule(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingModule(null);
    }
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
        body: JSON.stringify({
          teacher_id: teacherId,
          num_questions: 10,
          difficulty: 'medium',
          question_types: ['MCQ', 'Short Answer', 'Long Answer'],
        }),
      });
      const data = await res.json();
      if (data.success) setTestResult(data.test);
      else alert(data.error || 'Test generation failed');
    } catch (err) {
      alert('Test generation failed. Please try again.');
    } finally {
      setGeneratingTest(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Ready
          </span>
        );
      case 'processing':
      case 'extracting':
      case 'summarizing':
      case 'chunking':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-300/50 dark:border-orange-800/50 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 text-orange-600 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300/50 dark:border-rose-800/50">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                AI Knowledge Hub & Modules
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200">
                <Sparkles className="w-3 h-3 text-orange-600" />
                AI Sarthi Ready
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Generate structured notes, formulas, concept maps & test papers from chapters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            <span className="text-slate-400 uppercase text-[10px] tracking-wider">Total Modules:</span>
            <span className="text-orange-600 font-black text-sm">{modules.length}</span>
          </div>

          <button
            onClick={fetchModules}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Refresh Modules"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Module Creator */}
        <div className="lg:col-span-5">
          <ModuleCreator onModuleCreated={() => fetchModules()} />
        </div>

        {/* Right Column: Modules Library */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-500" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Your Modules
                </h3>
                {modules.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-700">
                    {modules.length}
                  </span>
                )}
              </div>

              <button
                onClick={fetchModules}
                className="text-xs font-bold text-slate-500 hover:text-orange-600 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-xs sm:text-sm font-semibold">Loading your modules...</p>
              </div>
            ) : modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/40 text-orange-500 rounded-3xl flex items-center justify-center">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-800 dark:text-slate-200 font-extrabold text-sm sm:text-base">
                    No modules created yet
                  </p>
                  <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                    Upload any textbook chapter or syllabus notes on the left to generate your first AI module.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                {modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-orange-300 dark:hover:border-orange-500/50 shadow-xs transition-all overflow-hidden"
                  >
                    {/* Module Card Header */}
                    <div
                      className={`p-4 sm:p-5 cursor-pointer transition-colors ${
                        mod.status === 'ready'
                          ? 'hover:bg-orange-50/20 dark:hover:bg-orange-950/10'
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
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60">
                              {mod.subject}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60">
                              {/^\d+$/.test(String(mod.class || ''))
                                ? `Class ${mod.class}`
                                : mod.class || 'General'}
                            </span>
                            {mod.page_count && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200">
                                {mod.page_count} pages
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDate(mod.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {getStatusBadge(mod.status)}
                          {mod.status === 'ready' && (
                            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
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
                        <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <p>{mod.error_message}</p>
                        </div>
                      )}
                    </div>

                    {/* Expanded Module Details */}
                    {expandedModule === mod.id && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 sm:p-6 space-y-5">
                        {loadingSummary === mod.id ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <Loader2 className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin text-orange-500" />
                            <p className="text-xs text-slate-400 font-semibold">Loading module summary...</p>
                          </div>
                        ) : moduleSummary[mod.id] ? (
                          <>
                            {/* Overview Box */}
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-5 text-white shadow-sm space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider opacity-90">
                                <BookOpen className="w-4 h-4" />
                                <span>Module Overview</span>
                              </div>
                              <p className="text-xs sm:text-sm leading-relaxed font-medium opacity-95">
                                {moduleSummary[mod.id].overview}
                              </p>
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/20 text-xs font-black">
                                {moduleSummary[mod.id].difficulty_level && (
                                  <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">
                                    Difficulty: {moduleSummary[mod.id].difficulty_level}
                                  </span>
                                )}
                                {moduleSummary[mod.id].estimated_study_time && (
                                  <span className="bg-white/20 px-2.5 py-0.5 rounded-lg">
                                    ⏱ {moduleSummary[mod.id].estimated_study_time}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Topics Accordion */}
                            {moduleSummary[mod.id].topics?.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-orange-500" />
                                  <span>Topics ({moduleSummary[mod.id].topics.length})</span>
                                </h4>

                                <div className="space-y-2.5">
                                  {moduleSummary[mod.id].topics.map((topic, i) => {
                                    const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
                                    const isExpanded = expandedTopics[mod.id]?.has(i);

                                    return (
                                      <div
                                        key={i}
                                        className={`rounded-2xl border ${color.border} overflow-hidden shadow-xs`}
                                      >
                                        <div
                                          className={`bg-gradient-to-r ${color.bg} p-3 sm:p-4 text-white flex items-center justify-between gap-3 cursor-pointer`}
                                          onClick={() => toggleTopicExpand(mod.id, i)}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                                              {i + 1}
                                            </span>
                                            <p className="font-extrabold text-xs sm:text-sm truncate">
                                              {topic.name}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {topic.formulas?.length ? (
                                              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                {topic.formulas.length} formulas
                                              </span>
                                            ) : null}
                                            {isExpanded ? (
                                              <ChevronUp className="w-4 h-4" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4" />
                                            )}
                                          </div>
                                        </div>

                                        <div className={`${color.light} p-4 border-t ${color.border} space-y-3`}>
                                          {topic.explanation && (
                                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                              {topic.explanation}
                                            </p>
                                          )}

                                          {topic.key_points?.length ? (
                                            <div>
                                              <p className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-1.5">
                                                Key Points
                                              </p>
                                              <ul className="space-y-1">
                                                {topic.key_points.map((pt, j) => (
                                                  <li
                                                    key={j}
                                                    className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium"
                                                  >
                                                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 shrink-0" />
                                                    <span>{pt}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          ) : null}

                                          {/* Formulas */}
                                          {topic.formulas && topic.formulas.length > 0 && (
                                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                                              <p className="text-[11px] font-black uppercase text-purple-700 dark:text-purple-400 flex items-center gap-1">
                                                <FlaskConical className="w-3.5 h-3.5" />
                                                <span>Formulas & Equations</span>
                                              </p>
                                              {topic.formulas.map((f, fi) => (
                                                <div
                                                  key={fi}
                                                  className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-200/70 dark:border-purple-900/40"
                                                >
                                                  <p className="font-mono text-xs font-bold text-purple-800 dark:text-purple-300">
                                                    {f.formula}
                                                  </p>
                                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                                    {f.meaning}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Important Terms */}
                            {moduleSummary[mod.id].important_terms?.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <BookMarked className="w-4 h-4 text-blue-500" />
                                  <span>Important Terms</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {moduleSummary[mod.id].important_terms.slice(0, 6).map((t, ti) => (
                                    <div
                                      key={ti}
                                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                    >
                                      <p className="font-bold text-xs text-blue-700 dark:text-blue-400">{t.term}</p>
                                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{t.definition}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                              <button
                                onClick={() => handleGenerateTest(mod.id)}
                                disabled={generatingTest === mod.id}
                                className="flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm text-white transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)' }}
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
                                className="px-4 py-3 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm font-bold disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                {deletingModule === mod.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs">
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

      {/* Generated Test Paper Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)' }}>
              <div className="text-white">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20">
                    Generated Test Paper
                  </span>
                  <span className="text-xs opacity-90">{testResult.questions?.length || 0} Questions</span>
                </div>
                <h3 className="text-lg font-black mt-1">{testResult.title || 'Module Assessment Test'}</h3>
                <div className="flex items-center gap-3 text-xs font-bold opacity-90 mt-1">
                  <span>Marks: {testResult.total_marks || 25}</span>
                  <span>•</span>
                  <span>Duration: {testResult.duration_minutes || 30} mins</span>
                </div>
              </div>

              <button
                onClick={() => setTestResult(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Questions Body */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1">
              {testResult.questions?.map((q: any, i: number) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <div className="bg-slate-100/80 dark:bg-slate-800 p-3.5 flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-slate-700">
                    <p className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                      <span className="text-orange-600 font-black mr-1">Q{q.q_no || i + 1}.</span>
                      {q.question}
                    </p>
                    <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-black shrink-0">
                      {q.marks || 1}M
                    </span>
                  </div>

                  {q.options && (
                    <div className="p-3.5 space-y-1.5 bg-white dark:bg-slate-900">
                      {q.options.map((opt: string, j: number) => (
                        <p key={j} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="font-bold text-orange-600">{String.fromCharCode(65 + j)}.</span>
                          <span>{opt.replace(/^[a-d]\)/i, '').trim()}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {q.answer && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                        ✓ Answer: {q.answer}
                      </p>
                      {q.solution && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                          {q.solution}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-end">
              <button
                onClick={() => setTestResult(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black transition-all cursor-pointer"
              >
                Close Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulesPage;