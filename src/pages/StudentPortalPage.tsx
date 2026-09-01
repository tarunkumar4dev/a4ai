// src/pages/StudentPortalPage.tsx
// Route: /student
// No login needed — student enters 6-char access code
// MS Teams-inspired classroom view — Professional · Clean · Responsive

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";

/* ─── Types ────────────────────────────────────────────────────── */
type StudentData = {
  id: string;
  name: string;
  roll_no: string;
  batch_id: string;
  batch_name: string;
  class_level: string;
  department_name: string;
  access_code: string;
  institute_name: string;
  institute_id: string;
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  file_url: string | null;
  file_name: string | null;
  max_marks: number | null;
  created_at: string;
  submission?: Submission | null;
};

type Submission = {
  id: string;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  status: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
};

/* ─── Helpers ───────────────────────────────────────────────────── */
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const fmtDeadline = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Overdue", color: "#EF4444" };
  if (days === 0) return { text: "Due today", color: "#F59E0B" };
  if (days === 1) return { text: "Due tomorrow", color: "#F59E0B" };
  return { text: `Due ${fmtDate(d)}`, color: "#64748B" };
};

const getInitials = (name: string) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    "#6264A7", "#D46B4C", "#4A6BB5", "#2C9E5E", "#B34A7A",
    "#5A8C5A", "#A66B4A", "#4A8C8C", "#8C6B4A", "#6B4A8C"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/* ─── Icons ─────────────────────────────────────────────────────── */
const Icons = {
  Teams: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#6264A7" />
      <path d="M15.5 10.5H19V17.5C19 18.6 18.1 19.5 17 19.5H15.5V10.5Z" fill="white" fillOpacity="0.9" />
      <path d="M15.5 6.5H17.5C18.6 6.5 19.5 7.4 19.5 8.5V10.5H15.5V6.5Z" fill="white" />
      <circle cx="12" cy="9.5" r="3.5" fill="white" />
      <path d="M6 10.5H12V14.5C12 15.6 11.1 16.5 10 16.5H6V10.5Z" fill="white" />
      <path d="M6 6.5H10C11.1 6.5 12 7.4 12 8.5V10.5H6V6.5Z" fill="white" />
    </svg>
  ),
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  ),
  Activity: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Chat: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Files: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Tasks: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 15 12 18 16 14" />
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  Help: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  LogOut: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Pin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 2v4l2 1v3h-5v7l-1 3-1-3v-7H6V7l2-1V2h8zm0-2H8v4.28L6 5.5V10h5v7.72L12 21l1-3.28V10h5V5.5L16 4.28V0z" />
    </svg>
  ),
  Loader: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Paper: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function StudentPortalPage() {
  const [view, setView] = useState<"login" | "dashboard" | "assignment">("login");
  const [code, setCode] = useState("");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [activeTab, setActiveTab] = useState<"assignments" | "announcements">("assignments");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sideView, setSideView] = useState<"dashboard" | "calendar" | "activity" | "chat" | "files" | "tasks">("dashboard");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("a4ai_student_code");
    if (saved) loginWithCode(saved);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  /* ── Login ── */
  async function loginWithCode(inputCode: string) {
    setLoading(true);
    setError("");
    const clean = inputCode.trim().toUpperCase();
    try {
      const { data: sac, error: sacErr } = await supabase
        .from("student_access_codes")
        .select("*")
        .eq("access_code", clean)
        .eq("is_active", true)
        .single();

      if (sacErr || !sac) {
        setError("Invalid code. Please check and try again.");
        setLoading(false);
        return;
      }

      const { data: studentRow } = await supabase
        .from("students").select("*").eq("id", sac.student_id).single();

      if (!studentRow) {
        setError("Student record not found.");
        setLoading(false);
        return;
      }

      let batchName = "—", batchClass = studentRow.class_level || "";
      if (sac.batch_id) {
        const { data: batch } = await supabase
          .from("batches").select("name, class_level").eq("id", sac.batch_id).single();
        if (batch) { batchName = batch.name; batchClass = batchClass || batch.class_level || ""; }
      }

      let instName = "Institute";
      if (sac.institute_id) {
        const { data: inst } = await supabase
          .from("institutes").select("name").eq("id", sac.institute_id).single();
        if (inst) instName = inst.name;
      }

      let deptName = "";
      if (studentRow.department_id) {
        const { data: dept } = await supabase
          .from("departments").select("name").eq("id", studentRow.department_id).single();
        if (dept) deptName = dept.name;
      }

      const s: StudentData = {
        id: sac.student_id,
        name: studentRow.name || "Student",
        roll_no: studentRow.roll_no || "",
        batch_id: sac.batch_id,
        batch_name: batchName,
        class_level: batchClass,
        department_name: deptName,
        access_code: clean,
        institute_name: instName,
        institute_id: sac.institute_id,
      };

      localStorage.setItem("a4ai_student_code", clean);
      setStudent(s);

      await supabase
        .from("student_access_codes")
        .update({ last_used_at: new Date().toISOString() })
        .eq("access_code", clean);

      await loadDashboard(s);
      setView("dashboard");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  async function loadDashboard(s: StudentData) {
    const { data: asgns } = await supabase
      .from("assignments")
      .select("*")
      .eq("batch_id", s.batch_id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (asgns) {
      const { data: subs } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", s.id)
        .in("assignment_id", asgns.map(a => a.id));

      const subMap: Record<string, Submission> = {};
      if (subs) subs.forEach(sub => { subMap[sub.assignment_id] = sub; });

      setAssignments(asgns.map(a => ({ ...a, submission: subMap[a.id] || null })));
    }

    const { data: anns } = await supabase
      .from("announcements")
      .select("*")
      .eq("batch_id", s.batch_id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (anns) setAnnouncements(anns);
  }

  async function handleSubmitFile(assignment: Assignment, file: File) {
    if (!student) return;
    setUploading(true);
    try {
      const path = `${student.institute_id}/${assignment.id}/${student.id}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("submissions").getPublicUrl(path);

      const existing = assignment.submission;
      if (existing) {
        await supabase.from("submissions").update({
          file_url: publicUrl, file_name: file.name,
          submitted_at: new Date().toISOString(), status: "submitted",
        }).eq("id", existing.id);
      } else {
        await supabase.from("submissions").insert({
          assignment_id: assignment.id, student_id: student.id,
          file_url: publicUrl, file_name: file.name, status: "submitted",
        });
      }

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      await loadDashboard(student);
      const { data: updated } = await supabase.from("assignments").select("*").eq("id", assignment.id).single();
      if (updated) {
        const { data: sub } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id).eq("student_id", student.id).single();
        setActiveAssignment({ ...updated, submission: sub || null });
      }
    } catch (e: any) {
      alert("Upload failed: " + (e.message || "Unknown error"));
    }
    setUploading(false);
  }

  function logout() {
    localStorage.removeItem("a4ai_student_code");
    setStudent(null);
    setAssignments([]);
    setAnnouncements([]);
    setView("login");
    setCode("");
  }

  const pending = assignments.filter(a => !a.submission);
  const submitted = assignments.filter(a => a.submission && a.submission.status === "submitted");
  const graded = assignments.filter(a => a.submission && a.submission.status === "graded");

  /* ══════════════════════════════════════════
     LOGIN SCREEN — Teams-inspired
  ══════════════════════════════════════════ */
  if (view === "login") return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #E8EAF6, #C5CAE9)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-[#6264A7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#6264A7]/25">
            <span className="text-white font-black text-2xl tracking-tight">a4</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Student Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your access code to view your classroom</p>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">Access Code</label>
          <input
            type="text"
            maxLength={8}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && code.length >= 4 && loginWithCode(code)}
            placeholder="e.g. AB12CD"
            className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-2xl font-bold text-center tracking-[0.3em] outline-none font-mono text-slate-800 focus:border-[#6264A7] transition-colors"
            autoFocus
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold mb-4">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={() => loginWithCode(code)}
          disabled={loading || code.length < 4}
          className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: loading || code.length < 4 ? "#CBD5E1" : "linear-gradient(135deg, #6264A7, #4A4B7A)" }}
        >
          {loading ? <><Icons.Loader /> Verifying...</> : "Enter Classroom →"}
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">
          Enter the access code provided by your institution
        </p>
      </motion.div>
    </div>
  );

  /* ══════════════════════════════════════════
     ASSIGNMENT DETAIL VIEW
  ══════════════════════════════════════════ */
  if (view === "assignment" && activeAssignment && student) {
    const sub = activeAssignment.submission;
    const dl = fmtDeadline(activeAssignment.deadline);

    return (
      <div className="min-h-screen bg-[#F0F2F5]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
        `}</style>

        {/* Teams-style header */}
        <div className="bg-[#6264A7] text-white sticky top-0 z-50 shadow-sm">
          <div className="flex items-center h-12 px-4 max-w-7xl mx-auto">
            <button
              onClick={() => { setView("dashboard"); setActiveAssignment(null); }}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold truncate">{activeAssignment.title}</span>
            </div>
            <div className="w-16" />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
              <h1 className="text-xl font-bold text-slate-900">{activeAssignment.title}</h1>
              <div className="flex flex-wrap gap-3 mt-2">
                {dl && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: dl.color }}>
                    <Icons.Clock /> {dl.text}
                  </span>
                )}
                {activeAssignment.max_marks && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
                    <Icons.Star /> {activeAssignment.max_marks} marks
                  </span>
                )}
                {activeAssignment.file_url && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600">
                    📎 PDF attached
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {activeAssignment.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">Description</h3>
                  <p className="text-slate-700 leading-relaxed">{activeAssignment.description}</p>
                </div>
              )}

              {activeAssignment.file_url && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">Attachments</h3>
                  <a href={activeAssignment.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#F0F2F5] hover:bg-[#E4E6EA] text-indigo-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                    <Icons.Download /> {activeAssignment.file_name || "Download Assignment"}
                  </a>
                </div>
              )}

              {/* Submission */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Your Submission</h3>

                {sub && sub.status === "graded" && (
                  <div className="bg-[#ECFDF5] rounded-lg p-4 border border-[#A7F3D0] mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Icons.Check />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">Graded ✓</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {sub.grade ?? "—"} <span className="text-sm text-slate-400 font-medium">/ {activeAssignment.max_marks || "?"}</span>
                        </p>
                      </div>
                    </div>
                    {sub.feedback && (
                      <div className="mt-3 bg-white rounded-lg p-3 text-sm text-slate-700 border border-emerald-100">
                        💬 {sub.feedback}
                      </div>
                    )}
                  </div>
                )}

                {sub && sub.status === "submitted" && (
                  <div className="bg-[#EFF6FF] rounded-lg p-4 border border-[#BFDBFE] mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Icons.Check />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{sub.file_name || "Submitted"}</p>
                        <p className="text-xs text-slate-500">Submitted {fmtDate(sub.submitted_at)}</p>
                      </div>
                    </div>
                    {sub.file_url && (
                      <a href={sub.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm font-medium hover:underline">View</a>
                    )}
                  </div>
                )}

                {submitSuccess && (
                  <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm font-medium mb-4 border border-emerald-200">
                    ✅ Submitted successfully!
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await handleSubmitFile(activeAssignment, file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: uploading ? "#CBD5E1" : "linear-gradient(135deg, #6264A7, #4A4B7A)" }}
                >
                  {uploading ? <><Icons.Loader /> Uploading...</> : sub ? <><Icons.Upload /> Resubmit (PDF only)</> : <><Icons.Upload /> Upload Answer (PDF)</>}
                </button>
                <p className="text-center text-xs text-slate-400 mt-2">PDF files only · Max 10MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     DASHBOARD — MS Teams Professional
  ══════════════════════════════════════════ */
  if (!student) return null;

  return (
    <div className="min-h-screen bg-[#F0F2F5]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .sidebar-transition { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .nav-item { transition: all 0.15s ease; }
      `}</style>

      {/* ── Teams App Bar ── */}
      <div className="bg-[#6264A7] text-white sticky top-0 z-50 shadow-sm">
        <div className="flex items-center h-12 px-3 max-w-7xl mx-auto">
          {/* Menu button (mobile) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Icons.Menu />
          </button>

          {/* Teams logo */}
          <div className="flex items-center gap-2 ml-1 lg:ml-0">
            <Icons.Teams />
            <span className="font-semibold text-sm hidden sm:block">a4ai Classroom</span>
          </div>

          {/* Search bar */}
          <div className="hidden md:flex items-center bg-white/15 rounded-lg px-3 py-1.5 ml-4 flex-1 max-w-xs">
            <Icons.Search />
            <input
              type="text"
              placeholder="Search"
              className="bg-transparent border-none outline-none text-white/90 placeholder-white/50 text-sm ml-2 w-full"
            />
          </div>

          {/* Right actions */}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded hover:bg-white/10 transition-colors relative" title="Notifications">
              <Icons.Bell />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#6264A7]" />
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-sm"
              title="Exit"
            >
              <Icons.LogOut />
              <span className="hidden sm:inline text-xs font-medium">Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex max-w-7xl mx-auto relative">

        {/* ── Sidebar ── */}
        <div
          className={`
            fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-white shadow-lg lg:shadow-none border-r border-slate-200
            sidebar-transition ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            overflow-y-auto
          `}
          style={{ top: '48px', height: 'calc(100vh - 48px)' }}
        >
          <div className="p-4">
            {/* User profile */}
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F0F2F5] transition-colors cursor-pointer">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: getAvatarColor(student.name) }}
              >
                {getInitials(student.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{student.name}</p>
                <p className="text-xs text-slate-500 truncate">{student.batch_name}</p>
              </div>
            </div>

            {/* Nav items */}
            <div className="mt-4 space-y-0.5">
              {[
                { icon: <Icons.Home />, label: "Dashboard", view: "dashboard" },
                { icon: <Icons.Activity />, label: "Activity", view: "activity" },
                { icon: <Icons.Chat />, label: "Chat", view: "chat" },
                { icon: <Icons.Calendar />, label: "Calendar", view: "calendar" },
                { icon: <Icons.Files />, label: "Files", view: "files" },
                { icon: <Icons.Tasks />, label: "Tasks", view: "tasks" },
              ].map((item, i) => {
                const isActive = sideView === item.view;
                const pendingCount = i === 0 ? assignments.filter(a => !a.submission).length : 0;
                return (
                <button
                  key={i}
                  onClick={() => setSideView(item.view as any)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 500, textAlign: "left", transition: "all .15s",
                    background: isActive ? "linear-gradient(135deg, #E8EAF6, #EDE7F6)" : "transparent",
                    color: isActive ? "#5C6BC0" : "#475569",
                    boxShadow: isActive ? "0 1px 4px rgba(92,107,192,0.15)" : "none",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8FAFF"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ 
                    color: isActive ? "#5C6BC0" : "#94A3B8", 
                    display: "flex", alignItems: "center", flexShrink: 0 
                  }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {pendingCount > 0 && (
                    <span style={{ 
                      fontSize: 10, fontWeight: 800, color: "#5C6BC0", 
                      background: "#E8EAF6", padding: "2px 7px", borderRadius: 20 
                    }}>
                      {pendingCount}
                    </span>
                  )}
                  {isActive && <span style={{ width: 3, height: 16, background: "#5C6BC0", borderRadius: 2, flexShrink: 0 }} />}
                </button>
                );
              })}
            </div>

            {/* Quick stats */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Progress</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Pending", value: pending.length, color: "#F59E0B", bg: "#FFF8E1", icon: "⏳" },
                  { label: "Submitted", value: submitted.length, color: "#5C6BC0", bg: "#E8EAF6", icon: "📤" },
                  { label: "Graded", value: graded.length, color: "#22C55E", bg: "#E8F5E9", icon: "✅" },
                ].map((stat) => (
                  <div key={stat.label} style={{ 
                    display: "flex", alignItems: "center", gap: 10, 
                    padding: "8px 12px", borderRadius: 10, background: stat.bg 
                  }}>
                    <span style={{ fontSize: 16 }}>{stat.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</p>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Backdrop ── */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} style={{ top: '48px' }} />
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 p-4 lg:p-6">

          {/* Welcome header — always visible */}
          {sideView !== "calendar" && sideView !== "activity" && sideView !== "chat" && sideView !== "files" && sideView !== "tasks" ? null : (
            <div className="mb-4">
              <h1 className="text-xl font-bold text-slate-900 capitalize">{sideView}</h1>
            </div>
          )}

          {/* Calendar View */}
          {sideView === "calendar" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 p-4">
              <h2 className="font-bold text-slate-800 mb-4">📅 Calendar</h2>
              <div className="text-slate-500 text-sm">
                <p>Coming soon: View your upcoming deadlines and events.</p>
              </div>
            </div>
          )}

          {/* Activity View */}
          {sideView === "activity" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 p-4">
              <h2 className="font-bold text-slate-800 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {[
                  ...assignments.filter(a => a.submission?.status === "graded").map(a => ({
                    icon: "✅", text: `Graded: ${a.title} — ${a.submission?.grade}/${a.max_marks || "?"}`,
                    time: a.submission?.submitted_at || a.created_at, color: "#22C55E"
                  })),
                  ...assignments.map(a => ({
                    icon: "📋", text: `New assignment: ${a.title}`,
                    time: a.created_at, color: "#6264A7"
                  })),
                  ...announcements.map(a => ({
                    icon: "📢", text: a.title,
                    time: a.created_at, color: "#F59E0B"
                  }))
                ].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                 .slice(0, 10)
                 .map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{item.text}</p>
                      <p className="text-xs text-slate-400">{fmtDate(item.time)}</p>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && announcements.length === 0 && (
                  <p className="text-center text-slate-400 py-8">No activity yet</p>
                )}
              </div>
            </div>
          )}

          {/* Coming Soon Views */}
          {(sideView === "chat" || sideView === "files" || sideView === "tasks") && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 p-12 text-center">
              <div className="text-6xl mb-4">{sideView === "chat" ? "💬" : sideView === "files" ? "📁" : "✅"}</div>
              <p className="text-lg font-bold text-slate-700 capitalize">{sideView}</p>
              <p className="text-sm text-slate-400 mt-2">This feature is coming soon!</p>
            </div>
          )}

          {/* Dashboard View */}
          {sideView === "dashboard" && (
          <div>
          {/* Welcome header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Hello, {student.name.split(" ")[0]}! 👋</h1>
            <div className="flex items-center gap-2 text-slate-500 text-sm flex-wrap">
              <span>{student.institute_name}</span>
              <span className="text-slate-300">•</span>
              <span>{student.batch_name}</span>
              <span className="text-slate-300">•</span>
              <span>Roll {student.roll_no || "—"}</span>
              {student.department_name && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{student.department_name}</span>
                </>
              )}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="border-b border-slate-200">
              <div className="flex px-2">
                {[
                  { id: "assignments", label: "Assignments", count: assignments.length },
                  { id: "announcements", label: "Announcements", count: announcements.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                        ? 'border-[#6264A7] text-[#6264A7]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-[#E8EAF6] text-[#6264A7]' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {/* ── Assignments ── */}
              {activeTab === "assignments" && (
                <div className="space-y-3">
                  {assignments.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📭</div>
                      <p className="font-semibold text-slate-600">No assignments yet</p>
                      <p className="text-sm text-slate-400">Your teacher will post assignments here</p>
                    </div>
                  )}
                  {assignments.map(a => {
                    const sub = a.submission;
                    const dl = fmtDeadline(a.deadline);
                    const statusColor = !sub ? "#F59E0B" : sub.status === "graded" ? "#22C55E" : "#3B82F6";
                    const statusLabel = !sub
                      ? "Pending"
                      : sub.status === "graded"
                        ? `Graded ${sub.grade !== null ? `· ${sub.grade}/${a.max_marks || "?"}` : ""}`
                        : "Submitted";

                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -1 }}
                        onClick={() => { setActiveAssignment(a); setView("assignment"); }}
                        className="bg-[#F8FAFC] hover:bg-[#F0F2F5] rounded-lg p-4 border border-slate-200/60 cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                              <h3 className="font-semibold text-slate-900 truncate">{a.title}</h3>
                            </div>
                            {a.description && (
                              <p className="text-sm text-slate-500 truncate mt-0.5 pl-4">{a.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2 pl-4">
                              {dl && (
                                <span className="text-xs font-medium flex items-center gap-1" style={{ color: dl.color }}>
                                  <Icons.Clock /> {dl.text}
                                </span>
                              )}
                              {a.max_marks && (
                                <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                                  <Icons.Star /> {a.max_marks} marks
                                </span>
                              )}
                              {a.file_url && (
                                <span className="text-xs font-medium text-indigo-600 flex items-center gap-1">
                                  <Icons.Paper /> PDF
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: statusColor + '15', color: statusColor }}>
                              {statusLabel}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              View <Icons.ChevronRight />
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ── Announcements ── */}
              {activeTab === "announcements" && (
                <div className="space-y-4">
                  {announcements.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📢</div>
                      <p className="font-semibold text-slate-600">No announcements yet</p>
                      <p className="text-sm text-slate-400">Your teacher will post updates here</p>
                    </div>
                  )}
                  {announcements.map(ann => (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-lg p-4 border ${ann.is_pinned ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200/60'}`}
                    >
                      <div className="flex items-start gap-3">
                        {ann.is_pinned && (
                          <span className="text-amber-500 mt-0.5"><Icons.Pin /></span>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            {ann.title}
                            {ann.is_pinned && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Pinned</span>
                            )}
                          </h3>
                          {ann.content && (
                            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ann.content}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-2">{fmtDate(ann.created_at)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
          )}

          {/* Status bar */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-200 pt-3">
            <span>a4ai Classroom · v2.0</span>
            <span>
              {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} ·{" "}
              {announcements.length} announcement{announcements.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}