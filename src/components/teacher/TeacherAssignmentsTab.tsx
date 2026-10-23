// src/components/teacher/TeacherAssignmentsTab.tsx
// ── Production-grade MS Teams-style assignment management ──
// Features: bulk grade, hover cards, deadline tracking, late indicators,
//           real-time updates, notification badges, better empty states

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { openSubmissionFile } from "@/lib/submissionFiles";
import { useMyScope } from "@/hooks/useMyScope";
import { AiQuestionList, feedbackFromAi, type AiResult } from "@/components/checker/AiGradeBreakdown";
import { backendUrl } from "@/lib/apiBase";
import { checkerFetch } from "@/components/checker/checkerFetch";
import CopySubmissionsTab from "@/components/teacher/copySubmissions/CopySubmissionsTab";
import { attachAnswerKey, uploadAssignmentFile } from "@/lib/assignments";

/* ─── Types ─────────────────────────────────────────── */
type Batch = { id: string; name: string; class_level: string };
type Assignment = {
  id: string; title: string; description: string; deadline: string | null;
  file_url: string | null; file_name: string | null; max_marks: number | null;
  batch_id: string; batch_name?: string; status: string; created_at: string;
  submission_count?: number; graded_count?: number; late_count?: number;
  total_students?: number;
  ai_key_name?: string | null; ai_strictness?: Strictness;
};
type Strictness = "easy" | "medium" | "hard" | "extreme";
type Submission = {
  id: string; student_id: string; student_name?: string; student_roll?: string;
  file_url: string | null; file_name: string | null; submitted_at: string;
  grade: number | null; feedback: string | null; status: string;
  is_late?: boolean;
  ai_status?: "checking" | "done" | "failed" | null;
  ai_marks?: number | null; ai_max_marks?: number | null;
  ai_result?: AiResult | null; ai_error?: string | null;
};

/* ─── AI checking (backend: smart-assignment-checker) ─── */
const CHECKER_API = backendUrl("/v1/smart-assignment-checker");
const AI_PARALLEL = 3;
const KEY_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

const checkerPost = (path: string, body?: unknown) => checkerFetch(`${CHECKER_API}${path}`, "POST", body);


/* ─── Helpers ──────────────────────────────────────── */
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function deadlineStatus(deadline: string | null) {
  if (!deadline) return null;
  const dt = new Date(deadline);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / (86400000));
  const hours = Math.ceil(diff / (3600000));
  if (diff < 0) return { text: `Overdue by ${Math.abs(days)}d`, color: "#EF4444", urgent: true };
  if (hours < 24) return { text: `${hours}h left`, color: "#F59E0B", urgent: true };
  if (days === 1) return { text: "Due tomorrow", color: "#F59E0B", urgent: true };
  if (days <= 3) return { text: `${days} days left`, color: "#F59E0B", urgent: false };
  return { text: `${days} days left`, color: "#22C55E", urgent: false };
}

/* ─── Styles ───────────────────────────────────────── */
const styles = `
  .ta-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  .ta-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all .15s; }
  .ta-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.1); }
  .ta-btn-primary { background: linear-gradient(135deg, #6366F1, #4F46E5); color: #fff; border: none; border-radius: 12px; padding: 10px 20px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s; }
  .ta-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
  .ta-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
  .ta-btn-ghost { background: #F1F5F9; color: #475569; border: none; border-radius: 10px; padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
  .ta-btn-ghost:hover { background: #E2E8F0; color: #1E293B; }
  .ta-btn-danger { background: #FEF2F2; color: #DC2626; border: none; border-radius: 10px; padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .ta-btn-danger:hover { background: #FEE2E2; }
  .ta-field { width: 100%; padding: 12px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; font-size: 14px; font-weight: 500; color: #1E293B; outline: none; font-family: inherit; box-sizing: border-box; transition: border-color .15s; }
  .ta-field:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  .ta-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .ta-late-pulse { animation: latePulse 2s ease-in-out infinite; }
  @keyframes latePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .ta-fade { animation: fadeUp .3s ease-out forwards; }
  .ta-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #6366F1; }
  .ta-hover-lift { transition: transform .15s, box-shadow .15s; }
  .ta-hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
  .ta-empty-svg { width: 120px; height: 120px; margin: 0 auto 20px; }
`;

/* ─── Empty state illustration ─────────────────────── */
const EmptyIcon = ({ type }: { type: "assignments" | "submissions" }) => (
  <svg viewBox="0 0 200 200" className="ta-empty-svg">
    <defs>
      <linearGradient id="empGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EEF2FF" />
        <stop offset="100%" stopColor="#E0E7FF" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="80" fill="url(#empGrad)" />
    {type === "assignments" ? (
      <>
        <rect x="60" y="60" width="80" height="90" rx="8" fill="#fff" stroke="#C7D2FE" strokeWidth="2" />
        <line x1="72" y1="80" x2="128" y2="80" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round" />
        <line x1="72" y1="95" x2="118" y2="95" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round" />
        <line x1="72" y1="110" x2="128" y2="110" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round" />
        <circle cx="140" cy="55" r="18" fill="#6366F1" />
        <path d="M140 47v16M132 55h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M60 100 L100 130 L140 100 L140 145 L60 145 Z" fill="#fff" stroke="#C7D2FE" strokeWidth="2" />
        <path d="M60 100 L100 70 L140 100" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="2" />
        <circle cx="100" cy="105" r="8" fill="#6366F1" />
      </>
    )}
  </svg>
);

/* ═════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════ */
export default function TeacherAssignmentsTab() {
  const { user } = useAuth();
  const [view, setView] = useState<"list"|"create"|"submissions">("list");
  const [subTab, setSubTab] = useState<"submissions" | "copies">("submissions");
  // deep link from the Checking Link: ?assignment=<id>&view=copies opens that assignment once it is loaded
  const [params, setParams] = useSearchParams();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [hoveredAssignment, setHoveredAssignment] = useState<string | null>(null);
  const [instituteId, setInstituteId] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    title: "", description: "", deadline: "", batch_id: "",
    max_marks: "", file: null as File | null,
    keyFile: null as File | null, strictness: "medium" as Strictness,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  // Submissions view
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");

  // Bulk grading
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [bulkMarks, setBulkMarks] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [bulkGrading, setBulkGrading] = useState(false);

  // AI checking
  const [aiRun, setAiRun] = useState<{ phase: "rubric" | "grading"; done: number; total: number; failed: number } | null>(null);
  const [aiOpenId, setAiOpenId] = useState<string | null>(null);
  const aiStop = useRef(false);

  // Batches + institute come from useMyScope (teaching + proctor sections; admin: all). Never teacher_batches.
  const scope = useMyScope();

  useEffect(() => {
    if (!scope.loading) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, user?.id]);

  // ── Real-time subscription: refresh on any submission change ──
  useEffect(() => {
    if (!instituteId && !user?.id) return;
    const channelKey = `teacher-assignments-${instituteId || user?.id}`;
    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => loadDataRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => loadDataRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instituteId, user?.id]);

  // Realtime callbacks must call the latest loadData (with the loaded scope), not the first render's closure
  const loadDataRef = useRef<() => Promise<void>>(async () => {});
  loadDataRef.current = loadData;

  async function loadData() {
    setLoading(true);
    try {
      const instId = scope.instituteId;
      if (instId) setInstituteId(instId);

      // Batches = my scope only (the dropdown can't offer a batch the teacher doesn't teach)
      const batchRows: Batch[] = scope.batches.map(b => ({ id: b.id, name: b.name, class_level: b.class_level || "" }));
      const scopeIds = batchRows.map(b => b.id);

      // Assignments of my batches only
      let asgns: any[] = [];
      if (scopeIds.length > 0) {
        let asgnQuery = supabase.from("assignments").select("*");
        asgnQuery = scope.isAdmin && instId
          ? asgnQuery.eq("institute_id", instId)
          : asgnQuery.in("batch_id", scopeIds);
        const { data, error: asgnsErr } = await asgnQuery.order("created_at", { ascending: false });
        if (asgnsErr) console.error("Error fetching assignments:", asgnsErr);
        asgns = data || [];
      }

      setBatches(batchRows);

      const batchMap: Record<string, string> = {};
      batchRows.forEach(b => {
        batchMap[b.id] = b.name;
      });

      const asgIds = (asgns || []).map(a => a.id);
      // Answer keys (RLS: only staff who can grade see these rows)
      const keyMap: Record<string, { name: string | null; strictness: Strictness }> = {};
      if (asgIds.length > 0) {
        const { data: keys } = await supabase
          .from("assignment_ai_keys")
          .select("assignment_id, answer_key_name, strictness")
          .in("assignment_id", asgIds);
        (keys || []).forEach(k => { keyMap[k.assignment_id] = { name: k.answer_key_name, strictness: k.strictness }; });
      }
      const countMap: Record<string, { submitted: number; graded: number; late: number }> = {};

      if (asgIds.length > 0) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("assignment_id, status, submitted_at")
          .in("assignment_id", asgIds);

        if (subs) {
          subs.forEach(s => {
            if (!countMap[s.assignment_id]) {
              countMap[s.assignment_id] = { submitted: 0, graded: 0, late: 0 };
            }
            countMap[s.assignment_id].submitted++;
            if (s.status === "graded") countMap[s.assignment_id].graded++;
            const asgn = asgns?.find(a => a.id === s.assignment_id);
            if (asgn?.deadline && new Date(s.submitted_at) > new Date(asgn.deadline)) {
              countMap[s.assignment_id].late++;
            }
          });
        }
      }

      const batchStudentCount: Record<string, number> = {};
      if (instId && scopeIds.length > 0) {
        let countQuery = supabase
          .from("students")
          .select("batch_id")
          .eq("institute_id", instId)
          .eq("is_active", true);
        if (!scope.isAdmin) countQuery = countQuery.in("batch_id", scopeIds);
        const { data: studentCounts } = await countQuery;

        if (studentCounts) {
          studentCounts.forEach(s => {
            if (s.batch_id) {
              batchStudentCount[s.batch_id] = (batchStudentCount[s.batch_id] || 0) + 1;
            }
          });
        }
      }

      setAssignments(
        (asgns || []).map(a => ({
          ...a,
          batch_name: batchMap[a.batch_id] || "Batch",
          submission_count: countMap[a.id]?.submitted || 0,
          graded_count: countMap[a.id]?.graded || 0,
          late_count: countMap[a.id]?.late || 0,
          total_students: batchStudentCount[a.batch_id] || 0,
          ai_key_name: keyMap[a.id] ? (keyMap[a.id].name || "answer key") : null,
          ai_strictness: keyMap[a.id]?.strictness || "medium",
        }))
      );
    } catch (e) {
      console.error("loadData error in TeacherAssignmentsTab:", e);
    }
    setLoading(false);
  }

  /* ── Create / Update Assignment ── */
  async function handleSave() {
    if (!form.title.trim() || !form.batch_id || !user) {
      toast.error("Please fill in title and select a batch.");
      return;
    }
    setCreating(true);
    try {
      let fileUrl = null, fileName = null;
      if (form.file) {
        const up = await uploadAssignmentFile(instituteId || user.id, form.file, form.file.name);
        fileUrl = up.url;
        fileName = up.name;
      }

      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline: form.deadline || null,
        max_marks: form.max_marks ? parseInt(form.max_marks) : null,
      };
      if (fileUrl) { payload.file_url = fileUrl; payload.file_name = fileName; }

      let assignmentId = editingId;
      if (editingId) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from("assignments").insert({
          ...payload,
          institute_id: instituteId || null,
          batch_id: form.batch_id,
          created_by: user.id,
          status: "active",
        }).select("id").single();
        if (error) throw error;
        assignmentId = created.id;
      }

      // Answer key → PRIVATE bucket (students never see it); its row lives in assignment_ai_keys
      if (assignmentId && form.keyFile) {
        await attachAnswerKey(assignmentId, user.id, form.keyFile, form.keyFile.name, form.strictness);
      } else if (assignmentId && editingId) {
        // Strictness can change without a new key (rubric stays valid)
        await supabase.from("assignment_ai_keys").update({ strictness: form.strictness }).eq("assignment_id", assignmentId);
      }
      toast.success(editingId ? "Assignment updated!" : "Assignment published!");

      resetForm();
      setView("list");
      await loadData();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setCreating(false);
  }

  function resetForm() {
    setForm({ title: "", description: "", deadline: "", batch_id: "", max_marks: "", file: null, keyFile: null, strictness: "medium" });
    setEditingId(null);
  }

  function editAssignment(a: Assignment) {
    setForm({
      title: a.title,
      description: a.description || "",
      deadline: a.deadline ? a.deadline.slice(0, 16) : "",
      batch_id: a.batch_id,
      max_marks: a.max_marks?.toString() || "",
      file: null,
      keyFile: null,
      strictness: a.ai_strictness || "medium",
    });
    setEditingId(a.id);
    setView("create");
  }

  /* ── View Submissions ── */
  async function openSubmissions(assignment: Assignment) {
    setActiveAssignment(assignment);
    setView("submissions");
    setSubTab("submissions");
    setSelectedSubs(new Set());
    setSubmissions([]);

    const { data: subs } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", assignment.id)
      .is("idempotency_key", null)          // upload-link attempts live in the Copy Submissions tab
      .order("submitted_at", { ascending: false });

    if (subs) {
      const studentIds = subs.map(s => s.student_id);
      const { data: students } = await supabase
        .from("students")
        .select("id, name, roll_no")
        .in("id", studentIds.length > 0 ? studentIds : ["_"]);

      const nameMap: Record<string, { name: string; roll: string }> = {};
      if (students) students.forEach(s => nameMap[s.id] = { name: s.name, roll: s.roll_no || "" });

      setSubmissions(subs.map(s => ({
        ...s,
        student_name: nameMap[s.student_id]?.name || "Unknown",
        student_roll: nameMap[s.student_id]?.roll || "",
        is_late: assignment.deadline ? new Date(s.submitted_at) > new Date(assignment.deadline) : false,
      })));
    }
  }

  useEffect(() => {
    const id = params.get("assignment");
    if (!id || loading) return;
    const a = assignments.find(x => x.id === id);
    const view = params.get("view");
    const next = new URLSearchParams(params);
    next.delete("assignment");
    next.delete("view");
    setParams(next, { replace: true });
    if (!a) { toast.error("This assignment isn't in your list."); return; }
    openSubmissions(a).then(() => { if (view === "copies") setSubTab("copies"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, loading]);

  /* ── Grade Single ── */
  async function handleGrade(subId: string) {
    try {
      const { error } = await supabase.from("submissions").update({
        grade: gradeInput ? parseFloat(gradeInput) : null,
        feedback: feedbackInput.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: user?.id,
        status: "graded",
      }).eq("id", subId);

      if (error) throw error;
      toast.success("Graded successfully!");
      setGradingId(null);
      setGradeInput("");
      setFeedbackInput("");
      if (activeAssignment) openSubmissions(activeAssignment);
      loadData();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  }

  /* ── Bulk Grade ── */
  async function handleBulkGrade() {
    if (selectedSubs.size === 0 || !bulkMarks) return;
    setBulkGrading(true);
    try {
      const ids = Array.from(selectedSubs);
      const { error } = await supabase.from("submissions").update({
        grade: parseFloat(bulkMarks),
        feedback: bulkFeedback.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: user?.id,
        status: "graded",
      }).in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} submissions graded!`);
      setSelectedSubs(new Set());
      setBulkMarks("");
      setBulkFeedback("");
      if (activeAssignment) openSubmissions(activeAssignment);
      loadData();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setBulkGrading(false);
  }

  /* ── AI check: marking scheme once, then each submission (3 at a time; one request each, so it
        works on serverless and can be stopped/resumed) ── */
  async function runAiCheck(only?: string) {
    if (!activeAssignment || aiRun) return;
    const targets = submissions.filter(s =>
      only ? s.id === only : s.status !== "graded" && s.ai_status !== "done");
    if (targets.length === 0) { toast.info("Nothing left to check."); return; }
    aiStop.current = false;
    setAiRun({ phase: "rubric", done: 0, total: targets.length, failed: 0 });
    try {
      const r = await checkerPost(`/assignments/${activeAssignment.id}/rubric`);
      if (r.rubric?.marks_mismatch) toast.warning(r.rubric.marks_mismatch);
      if (activeAssignment.max_marks && r.rubric?.total_marks && Number(activeAssignment.max_marks) !== Number(r.rubric.total_marks)) {
        toast.warning(`Question paper totals ${r.rubric.total_marks} marks, assignment says ${activeAssignment.max_marks}.`);
      }
    } catch (e: any) {
      toast.error(e.message);
      setAiRun(null);
      return;
    }

    setAiRun(prev => prev && { ...prev, phase: "grading" });
    setSubmissions(prev => prev.map(s => targets.some(t => t.id === s.id) ? { ...s, ai_status: "checking", ai_error: null } : s));
    let next = 0, failed = 0, stopMsg = "";
    const worker = async () => {
      while (next < targets.length && !aiStop.current) {
        const sub = targets[next++];
        try {
          const { result } = await checkerPost(`/assignments/${activeAssignment.id}/submissions/${sub.id}/check`);
          setSubmissions(prev => prev.map(s => s.id === sub.id ? {
            ...s, ai_status: "done", ai_result: result, ai_marks: result.total_marks_awarded,
            ai_max_marks: result.max_marks, ai_error: null,
          } : s));
        } catch (e: any) {
          failed++;
          setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, ai_status: "failed", ai_error: e.message } : s));
          if (/daily limit|session expired/i.test(e.message)) { aiStop.current = true; stopMsg = e.message; }
        }
        setAiRun(prev => prev && { ...prev, done: prev.done + 1, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AI_PARALLEL, targets.length) }, worker));
    setAiRun(null);
    if (stopMsg) toast.error(stopMsg);
    else if (failed) toast.warning(`${targets.length - failed} checked, ${failed} failed — use Retry on those.`);
    else toast.success(`${targets.length} submission${targets.length > 1 ? "s" : ""} checked. Review and approve.`);
    if (activeAssignment) openSubmissions(activeAssignment);
  }

  function openAiReview(sub: Submission) {
    setAiOpenId(sub.id);
    setGradingId(sub.id);
    setGradeInput(sub.ai_marks != null ? String(sub.ai_marks) : "");
    setFeedbackInput(sub.ai_result ? feedbackFromAi(sub.ai_result) : "");
  }

  /** Approve AI marks as-is for every checked submission that has no review flags. */
  async function approveAllClean() {
    const clean = submissions.filter(s => s.status !== "graded" && s.ai_status === "done" && s.ai_result
      && !(s.ai_result.needs_review_count || 0));
    if (clean.length === 0) { toast.info("No AI-checked submissions without review flags."); return; }
    if (!confirm(`Approve AI marks for ${clean.length} submission(s)? Students will see marks and feedback.`)) return;
    setBulkGrading(true);
    const results = await Promise.all(clean.map(s => supabase.from("submissions").update({
      grade: s.ai_marks, feedback: feedbackFromAi(s.ai_result!),
      graded_at: new Date().toISOString(), graded_by: user?.id, status: "graded",
    }).eq("id", s.id)));
    const errs = results.filter(r => r.error).length;
    setBulkGrading(false);
    if (errs) toast.error(`${errs} could not be saved.`); else toast.success(`${clean.length} approved.`);
    if (activeAssignment) openSubmissions(activeAssignment);
    loadData();
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedSubs);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedSubs(next);
  }

  function toggleSelectAll() {
    const ungraded = submissions.filter(s => s.status !== "graded").map(s => s.id);
    if (selectedSubs.size === ungraded.length) setSelectedSubs(new Set());
    else setSelectedSubs(new Set(ungraded));
  }

  /* ── Delete ── */
  async function deleteAssignment(id: string) {
    if (!confirm("Delete this assignment? All submissions will also be deleted.")) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Assignment deleted");
    loadData();
  }

  const filtered = useMemo(() =>
    selectedBatch === "all" ? assignments : assignments.filter(a => a.batch_id === selectedBatch),
    [assignments, selectedBatch]
  );

  // Global stats for header
  const totalToGrade = assignments.reduce((sum, a) => sum + ((a.submission_count || 0) - (a.graded_count || 0)), 0);

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="ta-root">
      <style>{styles}</style>

      {/* ═══════════ CREATE / EDIT VIEW ═══════════ */}
      {view === "create" && (
        <div className="ta-fade" style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button className="ta-btn-ghost" onClick={() => { resetForm(); setView("list"); }}>← Back</button>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>
              {editingId ? "Edit Assignment" : "Create Assignment"}
            </h2>
          </div>

          <div className="ta-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>TITLE *</label>
              <input className="ta-field" placeholder="e.g. Chapter 5 Homework"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>BATCH *</label>
              <select className="ta-field" value={form.batch_id} disabled={!!editingId}
                onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">Select batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name} {b.class_level ? `(Class ${b.class_level})` : ""}</option>)}
              </select>
              {editingId && <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Batch can't be changed after creation</p>}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>DESCRIPTION</label>
              <textarea className="ta-field" rows={3} placeholder="Instructions for students..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>DEADLINE</label>
                <input className="ta-field" type="datetime-local"
                  value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>MAX MARKS</label>
                <input className="ta-field" type="number" placeholder="e.g. 20"
                  value={form.max_marks} onChange={e => setForm({ ...form, max_marks: e.target.value })} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6 }}>
                {editingId ? "REPLACE PDF (optional)" : "ATTACH PDF"}
              </label>
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed #E2E8F0", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", background: form.file ? "#F0FDF4" : "#FAFBFC", transition: "all .15s" }}>
                {form.file ? (
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#16A34A" }}>📎 {form.file.name}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>Click to upload PDF</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#CBD5E1" }}>Max 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) setForm({ ...form, file: e.target.files[0] }); }} />
            </div>

            <div style={{ padding: 16, borderRadius: 12, background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", display: "block", marginBottom: 4 }}>
                ✨ ANSWER KEY FOR AI CHECKING (optional · private)
              </label>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#7C3AED" }}>
                Students never see this file. With the question paper PDF above, AI can check every submission against it.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 10 }}>
                <div onClick={() => keyRef.current?.click()}
                  style={{ border: "2px dashed #C4B5FD", borderRadius: 12, padding: 14, textAlign: "center", cursor: "pointer", background: form.keyFile ? "#F0FDF4" : "#fff" }}>
                  {form.keyFile
                    ? <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#16A34A" }}>🔑 {form.keyFile.name}</p>
                    : <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#8B5CF6" }}>
                        {editingId && assignments.find(a => a.id === editingId)?.ai_key_name
                          ? `🔑 ${assignments.find(a => a.id === editingId)?.ai_key_name} — click to replace`
                          : "Click to upload answer key (PDF / image)"}
                      </p>}
                </div>
                <select className="ta-field" value={form.strictness} title="How strictly AI marks"
                  onChange={e => setForm({ ...form, strictness: e.target.value as Strictness })} style={{ background: "#fff" }}>
                  <option value="easy">Lenient</option>
                  <option value="medium">Standard</option>
                  <option value="hard">Strict</option>
                  <option value="extreme">Very strict</option>
                </select>
              </div>
              <input ref={keyRef} type="file" accept={KEY_ACCEPT} style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 20 * 1024 * 1024) { toast.error("Answer key too large (max 20 MB)."); return; }
                  setForm({ ...form, keyFile: f });
                }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
              <button className="ta-btn-ghost" onClick={() => { resetForm(); setView("list"); }}>Cancel</button>
              <button className="ta-btn-primary" onClick={handleSave}
                disabled={creating || !form.title.trim() || !form.batch_id}>
                {creating ? "Saving..." : editingId ? "💾 Save Changes" : "📤 Publish Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SUBMISSIONS VIEW ═══════════ */}
      {view === "submissions" && activeAssignment && (
        <div className="ta-fade">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <button className="ta-btn-ghost" onClick={() => { setView("list"); setActiveAssignment(null); setSelectedSubs(new Set()); }}>← Back</button>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E293B" }}>{activeAssignment.title}</h2>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94A3B8" }}>
                {activeAssignment.batch_name} · {submissions.length}/{activeAssignment.total_students} submitted
              </p>
            </div>
          </div>

          {/* Old single-PDF submissions vs. copies uploaded through the upload link (docs/upload-flow-api.md) */}
          <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {([["submissions", "📄 Submissions"], ["copies", "📸 Copy Submissions"]] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={subTab === k} onClick={() => setSubTab(k)}
                className={subTab === k ? "ta-btn-primary" : "ta-btn-ghost"} data-testid={`subtab-${k}`}>{label}</button>
            ))}
          </div>

          {subTab === "submissions" && (<>
          {/* Progress stats */}
          <div className="ta-card" style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { n: submissions.length, l: "Submitted", c: "#6366F1", sub: `of ${activeAssignment.total_students}` },
              { n: submissions.filter(s => s.status === "graded").length, l: "Graded", c: "#22C55E" },
              { n: submissions.filter(s => s.status === "submitted").length, l: "To Grade", c: "#F59E0B" },
              { n: submissions.filter(s => s.is_late).length, l: "Late", c: "#EF4444" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: s.c }}>
                  {s.n}{s.sub && <span style={{ fontSize: 13, color: "#94A3B8" }}>{" "}{s.sub}</span>}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* AI checking bar */}
          {(() => {
            const pending = submissions.filter(s => s.status !== "graded" && s.ai_status !== "done").length;
            const clean = submissions.filter(s => s.status !== "graded" && s.ai_status === "done" && !(s.ai_result?.needs_review_count || 0)).length;
            const ready = !!activeAssignment.ai_key_name && !!activeAssignment.file_url;
            return (
              <div className="ta-card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "linear-gradient(135deg, #F5F3FF, #EEF2FF)" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#4C1D95" }}>✨ AI checking</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6D28D9" }}>
                    {!ready
                      ? (!activeAssignment.file_url ? "Attach the question paper PDF and an answer key (Edit) to enable." : "Attach an answer key (Edit) to enable.")
                      : aiRun
                        ? (aiRun.phase === "rubric" ? "Reading question paper + answer key…" : `Checking ${aiRun.done}/${aiRun.total}${aiRun.failed ? ` · ${aiRun.failed} failed` : ""}…`)
                        : `AI marks each answer point by point. You review, then approve — students see marks only after approval.`}
                  </p>
                  {aiRun && aiRun.phase === "grading" && (
                    <div style={{ height: 4, background: "#DDD6FE", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(aiRun.done / aiRun.total * 100)}%`, height: "100%", background: "#7C3AED", transition: "width .3s" }} />
                    </div>
                  )}
                </div>
                {aiRun
                  ? <button className="ta-btn-ghost" onClick={() => { aiStop.current = true; }}>Stop</button>
                  : <>
                      {clean > 0 && (
                        <button className="ta-btn-ghost" disabled={bulkGrading} onClick={approveAllClean}>
                          ✓ Approve {clean} without review flags
                        </button>
                      )}
                      <button className="ta-btn-primary" disabled={!ready || pending === 0} onClick={() => runAiCheck()}>
                        ✨ AI check {pending > 0 ? pending : ""}
                      </button>
                    </>}
              </div>
            );
          })()}

          {/* Bulk grade bar */}
          {selectedSubs.size > 0 && (
            <div className="ta-fade" style={{ background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)", border: "1px solid #C7D2FE", borderRadius: 16, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#4338CA" }}>
                {selectedSubs.size} selected
              </span>
              <input className="ta-field" type="number"
                placeholder={`Marks (out of ${activeAssignment.max_marks || "?"})`}
                value={bulkMarks} onChange={e => setBulkMarks(e.target.value)}
                style={{ maxWidth: 180, background: "#fff" }} />
              <input className="ta-field" placeholder="Common feedback (optional)"
                value={bulkFeedback} onChange={e => setBulkFeedback(e.target.value)}
                style={{ flex: 1, minWidth: 200, background: "#fff" }} />
              <button className="ta-btn-ghost" onClick={() => setSelectedSubs(new Set())}>Cancel</button>
              <button className="ta-btn-primary" onClick={handleBulkGrade}
                disabled={bulkGrading || !bulkMarks}>
                {bulkGrading ? "Grading..." : `⚡ Grade All ${selectedSubs.size}`}
              </button>
            </div>
          )}

          {submissions.length === 0 ? (
            <div className="ta-card" style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>
              <EmptyIcon type="submissions" />
              <p style={{ fontWeight: 700, fontSize: 15, color: "#475569" }}>No submissions yet</p>
              <p style={{ fontSize: 13 }}>Students will appear here as they submit</p>
            </div>
          ) : (
            <>
              {/* Select-all bar */}
              {submissions.filter(s => s.status !== "graded").length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 12px" }}>
                  <input type="checkbox" className="ta-checkbox"
                    checked={selectedSubs.size > 0 && selectedSubs.size === submissions.filter(s => s.status !== "graded").length}
                    onChange={toggleSelectAll} />
                  <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Select all ungraded</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {submissions.map(sub => (
                  <div key={sub.id} className="ta-card"
                    style={{
                      borderLeft: `4px solid ${sub.status === "graded" ? "#22C55E" : sub.is_late ? "#EF4444" : "#F59E0B"}`,
                      background: selectedSubs.has(sub.id) ? "#F5F3FF" : "#fff",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
                        {sub.status !== "graded" && (
                          <input type="checkbox" className="ta-checkbox"
                            checked={selectedSubs.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)} />
                        )}
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#6366F1", flexShrink: 0 }}>
                          {(sub.student_name || "?")[0]}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                            {sub.student_name}
                            {sub.is_late && <span className="ta-badge" style={{ background: "#FEE2E2", color: "#DC2626", marginLeft: 8 }}>LATE</span>}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: "#94A3B8" }}>
                            Roll {sub.student_roll || "—"} · {fmtDateTime(sub.submitted_at)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {sub.file_url && (
                          <button
                            type="button"
                            className="ta-btn-ghost"
                            style={{ fontSize: 12 }}
                            onClick={async () => {
                              if (!(await openSubmissionFile(sub.file_url!))) toast.error("Couldn't open this file.");
                            }}
                          >
                            📄 View PDF
                          </button>
                        )}
                        {sub.status !== "graded" && sub.ai_status === "checking" && (
                          <span className="ta-badge" style={{ background: "#EDE9FE", color: "#6D28D9" }}>✨ Checking…</span>
                        )}
                        {sub.status !== "graded" && sub.ai_status === "failed" && (
                          <button className="ta-btn-danger" style={{ fontSize: 12 }} title={sub.ai_error || ""}
                            disabled={!!aiRun} onClick={() => runAiCheck(sub.id)}>⚠ AI failed · Retry</button>
                        )}
                        {sub.status !== "graded" && sub.ai_status === "done" && sub.ai_result && (
                          <button className="ta-btn-ghost" style={{ fontSize: 12, background: "#EDE9FE", color: "#5B21B6" }}
                            onClick={() => aiOpenId === sub.id ? (setAiOpenId(null), setGradingId(null)) : openAiReview(sub)}>
                            ✨ AI {sub.ai_marks}/{sub.ai_max_marks}
                            {(sub.ai_result.needs_review_count || 0) > 0 && <span style={{ color: "#C2410C" }}> · {sub.ai_result.needs_review_count} to review</span>}
                          </button>
                        )}
                        {sub.status === "graded" ? (
                          <span className="ta-badge" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                            ✓ {sub.grade !== null ? `${sub.grade}/${activeAssignment.max_marks || "?"}` : "Graded"}
                          </span>
                        ) : (
                          <button className="ta-btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}
                            onClick={() => {
                              setAiOpenId(null);
                              setGradingId(sub.id);
                              setGradeInput(sub.grade?.toString() || "");
                              setFeedbackInput(sub.feedback || "");
                            }}>
                            ✏️ Grade
                          </button>
                        )}
                      </div>
                    </div>

                    {sub.feedback && sub.status === "graded" && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: "#F8FAFC", borderRadius: 10, fontSize: 13, color: "#475569", borderLeft: "3px solid #22C55E" }}>
                        💬 <strong>Feedback:</strong> {sub.feedback}
                      </div>
                    )}

                    {aiOpenId === sub.id && sub.ai_result && (
                      <div className="ta-fade" style={{ marginTop: 12, border: "1px solid #E9D5FF", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                        <div style={{ padding: "10px 16px", background: "#FAF5FF", fontSize: 12, color: "#6B21A8" }}>
                          <b>AI: {sub.ai_result.total_marks_awarded}/{sub.ai_result.max_marks}</b> ({sub.ai_result.percentage}%) — {sub.ai_result.overall_remarks}
                          <span style={{ display: "block", marginTop: 2, color: "#9333EA" }}>Open a question to see each marking point and what the student wrote. Edit marks below if needed.</span>
                        </div>
                        <AiQuestionList questions={sub.ai_result.graded_questions || []} />
                      </div>
                    )}

                    {gradingId === sub.id && (
                      <div className="ta-fade" style={{ marginTop: 12, padding: 16, background: "#F8FAFC", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input className="ta-field" type="number" step="0.5" min="0"
                            placeholder={`Marks (out of ${activeAssignment.max_marks || "?"})`}
                            value={gradeInput} onChange={e => setGradeInput(e.target.value)}
                            style={{ maxWidth: 220, background: "#fff" }} autoFocus />
                          <button className="ta-btn-ghost" onClick={() => { setGradingId(null); setAiOpenId(null); }}>Cancel</button>
                          <button className="ta-btn-primary" onClick={() => { setAiOpenId(null); handleGrade(sub.id); }}>
                            {aiOpenId === sub.id ? "✓ Approve & send to student" : "Save Grade"}
                          </button>
                        </div>
                        <textarea className="ta-field" placeholder="Feedback for student (optional)..." rows={2}
                          value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)}
                          style={{ resize: "vertical", background: "#fff" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          </>)}

          {subTab === "copies" && (
            <CopySubmissionsTab
              assignment={{ id: activeAssignment.id, title: activeAssignment.title, batch_name: activeAssignment.batch_name }}
              onEditAssignment={() => editAssignment(activeAssignment)} />
          )}
        </div>
      )}

      {/* ═══════════ LIST VIEW ═══════════ */}
      {view === "list" && (
        <div className="ta-fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>Assignments</h2>
                {totalToGrade > 0 && (
                  <span className="ta-badge ta-late-pulse" style={{ background: "#FEF3C7", color: "#D97706" }}>
                    ⚡ {totalToGrade} to grade
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94A3B8" }}>
                {assignments.length} total · Real-time synced
              </p>
            </div>
            <button className="ta-btn-primary" onClick={() => setView("create")}>
              ➕ Create Assignment
            </button>
          </div>

          {/* Batch filter */}
          {batches.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => setSelectedBatch("all")}
                className={selectedBatch === "all" ? "ta-btn-primary" : "ta-btn-ghost"}
                style={{ padding: "6px 14px", fontSize: 12, borderRadius: 20 }}>All</button>
              {batches.map(b => (
                <button key={b.id} onClick={() => setSelectedBatch(b.id)}
                  className={selectedBatch === b.id ? "ta-btn-primary" : "ta-btn-ghost"}
                  style={{ padding: "6px 14px", fontSize: 12, borderRadius: 20 }}>{b.name}</button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>Loading assignments...</div>
          ) : filtered.length === 0 ? (
            <div className="ta-card" style={{ textAlign: "center", padding: 48 }}>
              <EmptyIcon type="assignments" />
              <p style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", margin: "0 0 6px" }}>No assignments yet</p>
              <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 20px" }}>Create your first assignment and students will see it instantly in their portal</p>
              <button className="ta-btn-primary" onClick={() => setView("create")}>➕ Create First Assignment</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(a => {
                const pct = a.total_students ? Math.round(((a.submission_count || 0) / a.total_students) * 100) : 0;
                const dl = deadlineStatus(a.deadline);
                const ungraded = (a.submission_count || 0) - (a.graded_count || 0);
                return (
                  <div key={a.id} className="ta-card ta-hover-lift"
                    style={{
                      cursor: "pointer",
                      borderLeft: `4px solid ${a.graded_count === a.total_students && (a.total_students || 0) > 0 ? "#22C55E" : dl?.urgent ? "#EF4444" : "#6366F1"}`,
                      position: "relative",
                    }}
                    onMouseEnter={() => setHoveredAssignment(a.id)}
                    onMouseLeave={() => setHoveredAssignment(null)}
                    onClick={() => openSubmissions(a)}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E293B" }}>{a.title}</h3>
                          {ungraded > 0 && (
                            <span className="ta-badge" style={{ background: "#FEF3C7", color: "#D97706" }}>
                              {ungraded} new
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="ta-badge" style={{ background: "#EEF2FF", color: "#6366F1" }}>📚 {a.batch_name}</span>
                          {dl && (
                            <span className="ta-badge" style={{ background: dl.color + "15", color: dl.color }}>
                              🕐 {dl.text}
                            </span>
                          )}
                          {a.max_marks && <span className="ta-badge" style={{ background: "#F1F5F9", color: "#64748B" }}>⭐ {a.max_marks} marks</span>}
                          {a.file_url && <span style={{ fontSize: 11, color: "#6366F1", fontWeight: 700 }}>📎 PDF</span>}
                          {a.ai_key_name && <span className="ta-badge" style={{ background: "#F5F3FF", color: "#7C3AED" }}>✨ AI ready</span>}
                          {(a.late_count || 0) > 0 && (
                            <span className="ta-badge" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                              ⚠ {a.late_count} late
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1E293B" }}>
                          {a.submission_count}<span style={{ fontSize: 12, color: "#94A3B8" }}>/{a.total_students}</span>
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Submitted</p>
                        <div style={{ width: 80, height: 4, background: "#F1F5F9", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22C55E" : "#6366F1", borderRadius: 2, transition: "width .3s" }} />
                        </div>
                      </div>
                    </div>

                    {/* Hover reveal */}
                    {hoveredAssignment === a.id && a.description && (
                      <div className="ta-fade" style={{ marginTop: 12, padding: "10px 14px", background: "#F8FAFC", borderRadius: 10, fontSize: 13, color: "#475569" }}>
                        {a.description.length > 150 ? a.description.slice(0, 150) + "..." : a.description}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>Created {fmtDate(a.created_at)}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className="ta-badge" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                          ✓ {a.graded_count} graded
                        </span>
                        <button onClick={e => { e.stopPropagation(); editAssignment(a); }}
                          className="ta-btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
                          ✏️ Edit
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }}
                          className="ta-btn-danger" style={{ padding: "4px 10px", fontSize: 11 }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}