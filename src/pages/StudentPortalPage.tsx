// src/pages/StudentPortalPage.tsx
// Route: /student
// No login needed — student enters 6-char access code
// MS Teams-inspired classroom view — Dark/Light Mode · Fully Responsive

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import StudentCalendar from "@/components/student/StudentCalendar";

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

type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  time: string;
  isStudent: boolean;
};

type Theme = "dark" | "light";

/* ─── Helpers ───────────────────────────────────────────────────── */
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtDeadline = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Overdue", color: "#EF4444" };
  if (days === 0) return { text: "Due today", color: "#F59E0B" };
  if (days === 1) return { text: "Due tomorrow", color: "#F59E0B" };
  return { text: `Due ${fmtDate(d)}`, color: "#94A3B8" };
};

const getInitials = (name: string) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    "#4F46E5", "#0D9488", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#10B981", "#3B82F6", "#F97316", "#14B8A6"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/* ─── Theme Tokens ─────────────────────────────────────────────── */
const themeTokens = {
  dark: {
    bg: "#09090b",
    surface: "#18181b",
    border: "#27272a",
    borderHover: "#3f3f46",
    textPrimary: "#f4f4f5",
    textSecondary: "#a1a1aa",
    textMuted: "#71717a",
    accent: "#4F46E5",
    accentHover: "#4338ca",
    accentBg: "rgba(79, 70, 229, 0.1)",
    teal: "#0D9488",
    tealBg: "rgba(13, 148, 136, 0.1)",
    hover: "rgba(39, 39, 42, 0.5)",
    scrollTrack: "#09090b",
    scrollThumb: "#27272a",
    scrollThumbHover: "#3f3f46",
  },
  light: {
    bg: "#fafafa",
    surface: "#ffffff",
    border: "#e4e4e7",
    borderHover: "#d4d4d8",
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    textMuted: "#a1a1aa",
    accent: "#4F46E5",
    accentHover: "#4338ca",
    accentBg: "rgba(79, 70, 229, 0.08)",
    teal: "#0D9488",
    tealBg: "rgba(13, 148, 136, 0.08)",
    hover: "rgba(244, 244, 245, 0.8)",
    scrollTrack: "#fafafa",
    scrollThumb: "#d4d4d8",
    scrollThumbHover: "#a1a1aa",
  },
};

/* ─── Icons ─────────────────────────────────────────────────────── */
const Icons = {
  Teams: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  Home: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  ),
  Activity: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Chat: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Calendar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Files: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Tasks: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Bell: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
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
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24Z"></path>
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
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Hash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"></line>
      <line x1="4" y1="15" x2="20" y2="15"></line>
      <line x1="10" y1="3" x2="8" y2="21"></line>
      <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
  ),
  MonitorPlay: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
      <polygon points="10 7 15 10 10 13 10 7"></polygon>
    </svg>
  ),
  Paper: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Sun: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  ),
  Moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
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
  const [activeTab, setActiveTab] = useState<"overview" | "assignments" | "announcements">("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sideView, setSideView] = useState<"dashboard" | "calendar" | "activity" | "chat" | "files" | "tasks">("dashboard");
  const [expandedCourse, setExpandedCourse] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* New Interactive State for Files, Tasks, & Chat */
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [fileCategoryFilter, setFileCategoryFilter] = useState<"all" | "assignments" | "submissions">("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");

  const t = themeTokens[theme];

  useEffect(() => {
    const savedTheme = localStorage.getItem("a4ai_theme") as Theme | null;
    if (savedTheme) setTheme(savedTheme);
    const saved = localStorage.getItem("a4ai_student_code");
    if (saved) loginWithCode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("a4ai_theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

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

      // Initialize initial batch chat
      setChatMessages([
        {
          id: "welcome-1",
          sender: "Teacher / Class Notice",
          text: `Welcome to ${batchName}! Use this General Chat space to discuss class topics, ask questions, and share study notes.`,
          time: fmtDate(new Date().toISOString()),
          isStudent: false,
        }
      ]);

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

  function handleSendChatMessage() {
    if (!newChatMessage.trim() || !student) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: student.name,
      text: newChatMessage.trim(),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      isStudent: true,
    };
    setChatMessages(prev => [...prev, msg]);
    setNewChatMessage("");
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

  /* Aggregated files for the Files View */
  const allFiles = useMemo(() => {
    const list: {
      id: string;
      title: string;
      fileName: string;
      url: string;
      type: "assignment" | "submission";
      date: string;
      assignmentObj: Assignment;
    }[] = [];

    assignments.forEach(a => {
      if (a.file_url) {
        list.push({
          id: `asgn-${a.id}`,
          title: a.title,
          fileName: a.file_name || `${a.title.replace(/\s+/g, "_")}.pdf`,
          url: a.file_url,
          type: "assignment",
          date: a.created_at,
          assignmentObj: a,
        });
      }
      if (a.submission && a.submission.file_url) {
        list.push({
          id: `sub-${a.submission.id}`,
          title: `${a.title} (My Submission)`,
          fileName: a.submission.file_name || `Submission_${a.title.replace(/\s+/g, "_")}.pdf`,
          url: a.submission.file_url,
          type: "submission",
          date: a.submission.submitted_at,
          assignmentObj: a,
        });
      }
    });

    return list.filter(f => {
      if (fileCategoryFilter === "assignments" && f.type !== "assignment") return false;
      if (fileCategoryFilter === "submissions" && f.type !== "submission") return false;
      if (fileSearchQuery.trim()) {
        const q = fileSearchQuery.toLowerCase();
        return f.title.toLowerCase().includes(q) || f.fileName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assignments, fileCategoryFilter, fileSearchQuery]);

  /* Tasks filtering for Tasks View */
  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === "pending") return pending;
    if (taskStatusFilter === "submitted") return submitted;
    if (taskStatusFilter === "graded") return graded;
    return assignments;
  }, [assignments, pending, submitted, graded, taskStatusFilter]);

  const appNav = [
    { id: 'dashboard', icon: <Icons.Home />, label: 'Dashboard', badge: pending.length > 0 },
    { id: 'tasks', icon: <Icons.Tasks />, label: 'Tasks' },
    { id: 'files', icon: <Icons.Files />, label: 'Files' },
    { id: 'calendar', icon: <Icons.Calendar />, label: 'Calendar' },
    { id: 'chat', icon: <Icons.Chat />, label: 'Discussion' },
    { id: 'activity', icon: <Icons.Activity />, label: 'Activity' },
  ];

  /* ══════════════════════════════════════════
     LOGIN SCREEN
  ══════════════════════════════════════════ */
  if (view === "login") return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300" style={{ background: t.bg, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      `}</style>

      {/* Theme toggle top-right */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2.5 rounded-xl border transition-all hover:scale-105 z-50"
        style={{ background: t.surface, borderColor: t.border, color: t.textSecondary }}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border transition-colors duration-300"
        style={{ background: t.surface, borderColor: t.border }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.teal})`, boxShadow: `0 8px 24px ${t.accent}40` }}>
            <span className="text-white font-black text-xl sm:text-2xl tracking-tight">a4</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: t.textPrimary }}>Student Portal</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: t.textSecondary }}>Enter your access code to view your classroom</p>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: t.textSecondary }}>Access Code</label>
          <input
            type="text"
            maxLength={8}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && code.length >= 4 && loginWithCode(code)}
            placeholder="e.g. AB12CD"
            className="w-full px-4 py-3 sm:py-3.5 rounded-xl text-xl sm:text-2xl font-bold text-center tracking-[0.3em] outline-none font-mono transition-all placeholder:opacity-50"
            style={{
              background: t.bg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = `0 0 0 1px ${t.accent}`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = "none"; }}
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold mb-4" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={() => loginWithCode(code)}
          disabled={loading || code.length < 4}
          className="w-full py-3 sm:py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          style={{ background: loading || code.length < 4 ? "#94A3B8" : `linear-gradient(135deg, ${t.accent}, ${t.accentHover})`, boxShadow: loading || code.length < 4 ? "none" : `0 8px 20px ${t.accent}30` }}
        >
          {loading ? <><Icons.Loader /> Verifying...</> : "Enter Classroom →"}
        </button>

        <p className="text-center text-xs mt-6" style={{ color: t.textMuted }}>
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
      <div className="min-h-screen transition-colors duration-300" style={{ background: t.bg, color: t.textPrimary, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
        `}</style>

        {/* Header */}
        <div className="sticky top-0 z-50 border-b transition-colors duration-300" style={{ background: t.surface, borderColor: t.border }}>
          <div className="flex items-center h-14 px-3 sm:px-4 max-w-7xl mx-auto">
            <button
              onClick={() => { setView("dashboard"); setActiveAssignment(null); }}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: t.textSecondary }}
              onMouseEnter={e => e.currentTarget.style.color = t.textPrimary}
              onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            <div className="flex-1 text-center px-2 min-w-0">
              <span className="text-sm font-semibold truncate block" style={{ color: t.textPrimary }}>{activeAssignment.title}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ color: t.textSecondary }}
              onMouseEnter={e => e.currentTarget.style.background = t.hover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              title="Toggle theme"
            >
              {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="rounded-xl border overflow-hidden transition-colors duration-300" style={{ background: t.surface, borderColor: t.border }}>
            {/* Header */}
            <div className="p-4 sm:p-6 border-b" style={{ borderColor: t.border }}>
              <h1 className="text-lg sm:text-xl font-bold break-words" style={{ color: t.textPrimary }}>{activeAssignment.title}</h1>
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
                {dl && (
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium" style={{ color: dl.color }}>
                    <Icons.Clock /> {dl.text}
                  </span>
                )}
                {activeAssignment.max_marks && (
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-amber-500">
                    <Icons.Star /> {activeAssignment.max_marks} marks
                  </span>
                )}
                {activeAssignment.file_url && (
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium" style={{ color: t.teal }}>
                    📎 PDF attached
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
              {activeAssignment.description && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: t.textSecondary }}>Description</h3>
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap" style={{ color: t.textPrimary }}>{activeAssignment.description}</p>
                </div>
              )}

              {activeAssignment.file_url && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: t.textSecondary }}>Attachments</h3>
                  <a
                    href={activeAssignment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border"
                    style={{ background: t.bg, color: t.teal, borderColor: t.border }}
                  >
                    <Icons.Download /> {activeAssignment.file_name || "Download Assignment"}
                  </a>
                </div>
              )}

              {/* Submission */}
              <div className="border-t pt-5 sm:pt-6" style={{ borderColor: t.border }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: t.textSecondary }}>Your Submission</h3>

                {sub && sub.status === "graded" && (
                  <div className="rounded-lg p-4 mb-4 border" style={{ background: t.tealBg, borderColor: `${t.teal}30` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${t.teal}20`, color: t.teal }}>
                        <Icons.Check />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: t.teal }}>Graded ✓</p>
                        <p className="text-xl sm:text-2xl font-bold" style={{ color: t.teal }}>
                          {sub.grade ?? "—"} <span className="text-sm font-medium" style={{ color: t.textMuted }}>/ {activeAssignment.max_marks || "?"}</span>
                        </p>
                      </div>
                    </div>
                    {sub.feedback && (
                      <div className="mt-3 rounded-lg p-3 text-sm border" style={{ background: t.bg, color: t.textPrimary, borderColor: `${t.teal}20` }}>
                        💬 {sub.feedback}
                      </div>
                    )}
                  </div>
                )}

                {sub && sub.status === "submitted" && (
                  <div className="rounded-lg p-4 mb-4 flex items-center justify-between gap-3 border" style={{ background: t.accentBg, borderColor: `${t.accent}30` }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${t.accent}20`, color: t.accent }}>
                        <Icons.Check />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{sub.file_name || "Submitted"}</p>
                        <p className="text-xs" style={{ color: t.textMuted }}>Submitted {fmtDate(sub.submitted_at)}</p>
                      </div>
                    </div>
                    {sub.file_url && (
                      <a href={sub.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline shrink-0" style={{ color: t.accent }}>View</a>
                    )}
                  </div>
                )}

                {submitSuccess && (
                  <div className="rounded-lg px-4 py-3 text-sm font-medium mb-4 border" style={{ background: t.tealBg, color: t.teal, borderColor: `${t.teal}30` }}>
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
                  className="w-full py-3 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  style={{ background: uploading ? "#94A3B8" : `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}
                >
                  {uploading ? <><Icons.Loader /> Uploading...</> : sub ? <><Icons.Upload /> Resubmit (PDF only)</> : <><Icons.Upload /> Upload Answer (PDF)</>}
                </button>
                <p className="text-center text-xs mt-2" style={{ color: t.textMuted }}>PDF files only · Max 10MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════════ */
  if (!student) return null;

  const courses = [
    { id: student.batch_id, name: student.batch_name || "Class", code: student.class_level || "" },
  ];

  const channels = [
    { id: 'announcements', name: 'Announcements', icon: <Icons.Bell /> },
    { id: 'general', name: 'General Chat', icon: <Icons.Hash /> },
    { id: 'assignments', name: 'Assignments & Tasks', icon: <Icons.Tasks /> },
    { id: 'live', name: 'Live Lectures', icon: <Icons.MonitorPlay /> },
  ];

  const breadcrumb = courses[0]?.name || "Class";

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-300" style={{ background: t.bg, color: t.textPrimary, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .sidebar-transition { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.scrollThumbHover}; }
      `}</style>

      {/* 1. Leftmost App Bar */}
      <nav className="w-16 border-r flex flex-col items-center py-4 z-30 shrink-0 justify-between transition-colors duration-300" style={{ background: t.bg, borderColor: t.border }}>
        <div className="flex flex-col items-center space-y-4 w-full">
          {appNav.map((app) => (
            <button
              key={app.id}
              onClick={() => { setSideView(app.id as any); setSidebarOpen(false); }}
              className="relative flex flex-col items-center justify-center w-full group focus:outline-none"
              title={app.label}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ease-in-out"
                style={{
                  color: sideView === app.id ? t.accent : t.textMuted,
                  background: sideView === app.id ? t.accentBg : "transparent",
                }}
                onMouseEnter={e => { if (sideView !== app.id) { e.currentTarget.style.color = t.textPrimary; e.currentTarget.style.background = t.border; } }}
                onMouseLeave={e => { if (sideView !== app.id) { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.background = "transparent"; } }}
              >
                {app.icon}
                {app.badge && (
                  <span className="absolute top-0 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2" style={{ borderColor: t.bg }}></span>
                )}
              </div>
              {sideView === app.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-md" style={{ background: t.accent }}></div>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center w-full pb-2 gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: t.textMuted }}
            onMouseEnter={e => { e.currentTarget.style.color = t.textPrimary; e.currentTarget.style.background = t.border; }}
            onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.background = "transparent"; }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
          </button>

          {/* Logout avatar */}
          <button
            onClick={logout}
            className="relative w-9 h-9 rounded-full p-[2px] transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${getAvatarColor(student.name)}, ${t.accent})` }}
            title="Logout"
          >
            <div className="w-full h-full rounded-full border-2 overflow-hidden flex items-center justify-center" style={{ background: t.surface, borderColor: t.surface }}>
              <span className="text-xs font-bold" style={{ color: t.textPrimary }}>{getInitials(student.name)}</span>
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 rounded-full" style={{ borderColor: t.bg }}></div>
          </button>
        </div>
      </nav>

      {/* 2. Contextual Sidebar */}
      <aside
        className={`fixed md:relative inset-y-0 left-16 md:left-0 z-20 w-64 border-r flex-col shrink-0 sidebar-transition ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex overflow-y-auto transition-colors duration-300`}
        style={{ background: t.surface, borderColor: t.border }}
      >
        <div className="p-4 border-b w-full" style={{ borderColor: t.border }}>
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>Enrolled Courses</h2>
        </div>
        <div className="flex-1 py-2 overflow-y-auto w-full">
          {courses.map((course) => (
            <div key={course.id} className="mb-1">
              <button
                onClick={() => setExpandedCourse(!expandedCourse)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                style={{ color: t.textPrimary }}
                onMouseEnter={e => e.currentTarget.style.background = t.hover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span className="font-medium truncate pr-2 text-left">{course.name}</span>
                <span className={`transition-transform duration-200 ${expandedCourse ? 'rotate-180' : ''}`}>
                  <Icons.ChevronDown />
                </span>
              </button>

              {expandedCourse && (
                <div className="px-3 pb-2 pt-1 space-y-1">
                  {channels.map((channel) => {
                    const isChannelActive =
                      (channel.id === 'assignments' && (sideView === 'tasks' || (sideView === 'dashboard' && activeTab === 'assignments'))) ||
                      (channel.id === 'announcements' && sideView === 'dashboard' && activeTab === 'announcements') ||
                      (channel.id === 'live' && sideView === 'calendar') ||
                      (channel.id === 'general' && sideView === 'chat');
                    return (
                      <button
                        key={channel.id}
                        onClick={() => {
                          if (channel.id === 'assignments') { setSideView('tasks'); }
                          else if (channel.id === 'announcements') { setSideView('dashboard'); setActiveTab('announcements'); }
                          else if (channel.id === 'live') { setSideView('calendar'); }
                          else { setSideView('chat'); }
                          setSidebarOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                        style={{
                          background: isChannelActive ? t.accentBg : "transparent",
                          color: isChannelActive ? t.accent : t.textSecondary,
                          fontWeight: isChannelActive ? 500 : 400,
                        }}
                        onMouseEnter={e => { if (!isChannelActive) { e.currentTarget.style.background = t.border; e.currentTarget.style.color = t.textPrimary; } }}
                        onMouseLeave={e => { if (!isChannelActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.textSecondary; } }}
                      >
                        <span className="opacity-70">{channel.icon}</span>
                        <span>{channel.name}</span>
                        {channel.id === 'assignments' && pending.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: t.accent, background: t.accentBg }}>
                            {pending.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-t w-full" style={{ borderColor: t.border }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>Your Progress</p>
          <div className="space-y-2">
            {[
              { label: "Pending", value: pending.length, color: "#F59E0B" },
              { label: "Submitted", value: submitted.length, color: t.accent },
              { label: "Graded", value: graded.length, color: t.teal },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between rounded-lg px-3 py-2 border" style={{ background: t.bg, borderColor: t.border }}>
                <span className="text-xs font-medium" style={{ color: t.textSecondary }}>{stat.label}</span>
                <span className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 3. Main Content Stage */}
      <main className="flex-1 flex flex-col min-w-0 relative transition-colors duration-300" style={{ background: t.bg }}>

        {/* Top Header Bar */}
        <header className="h-14 border-b flex items-center justify-between px-3 md:px-6 shrink-0 backdrop-blur z-10 transition-colors duration-300" style={{ background: `${t.bg}ee`, borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 rounded transition-colors"
              style={{ color: t.textSecondary }}
            >
              <Icons.Menu />
            </button>
            <div className="flex items-center space-x-2 text-sm" style={{ color: t.textSecondary }}>
              <span className="hidden sm:inline">{breadcrumb}</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-medium capitalize" style={{ color: t.textPrimary }}>{sideView === 'chat' ? 'Batch Discussion' : sideView}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-1 justify-end max-w-md ml-4">
            <div className="relative w-full max-w-sm hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: t.textMuted }}>
                <Icons.Search />
              </div>
              <input
                type="text"
                value={fileSearchQuery}
                onChange={e => {
                  setFileSearchQuery(e.target.value);
                  if (sideView !== "files" && e.target.value.trim()) setSideView("files");
                }}
                placeholder="Search files or assignments..."
                className="w-full rounded-lg py-1.5 pl-9 pr-4 text-sm outline-none transition-all"
                style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textPrimary }}
                onFocus={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = `0 0 0 1px ${t.accent}`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            <button
              onClick={() => setSideView("tasks")}
              className="relative p-1.5 rounded-lg transition-colors"
              style={{ color: t.textSecondary }}
              onMouseEnter={e => e.currentTarget.style.background = t.border}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              title="Pending Tasks"
            >
              <Icons.Bell />
              {pending.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2" style={{ borderColor: t.bg }} />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Calendar View */}
            {sideView === "calendar" && (
              <StudentCalendar
                batchId={student.batch_id}
                instituteId={student.institute_id}
              />
            )}

            {/* Activity View */}
            {sideView === "activity" && (
              <div>
                <h1 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: t.textPrimary }}>Recent Activity</h1>
                <div className="rounded-xl p-4 border" style={{ background: t.surface, borderColor: t.border }}>
                  <div className="space-y-3">
                    {[
                      ...assignments.filter(a => a.submission?.status === "graded").map(a => ({
                        icon: "✅", text: `Graded: ${a.title} — ${a.submission?.grade}/${a.max_marks || "?"}`,
                        time: a.submission?.submitted_at || a.created_at
                      })),
                      ...assignments.map(a => ({
                        icon: "📋", text: `New assignment: ${a.title}`,
                        time: a.created_at
                      })),
                      ...announcements.map(a => ({
                        icon: "📢", text: a.title,
                        time: a.created_at
                      }))
                    ].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                     .slice(0, 10)
                     .map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border transition-colors" style={{ borderColor: t.border }}>
                        <span className="text-xl">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{item.text}</p>
                          <p className="text-xs" style={{ color: t.textMuted }}>{fmtDate(item.time)}</p>
                        </div>
                      </div>
                    ))}
                    {assignments.length === 0 && announcements.length === 0 && (
                      <p className="text-center py-8" style={{ color: t.textMuted }}>No activity yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tasks & Homework View */}
            {sideView === "tasks" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold" style={{ color: t.textPrimary }}>Assignments & Tasks</h1>
                    <p className="text-sm mt-1" style={{ color: t.textSecondary }}>Manage your homework, view deadlines, and check grades</p>
                  </div>
                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl border self-start sm:self-auto" style={{ background: t.surface, borderColor: t.border }}>
                    {[
                      { id: "all", label: "All Tasks", count: assignments.length },
                      { id: "pending", label: "Pending", count: pending.length },
                      { id: "submitted", label: "Submitted", count: submitted.length },
                      { id: "graded", label: "Graded", count: graded.length },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setTaskStatusFilter(f.id as any)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: taskStatusFilter === f.id ? t.accentBg : "transparent",
                          color: taskStatusFilter === f.id ? t.accent : t.textSecondary,
                        }}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="rounded-xl p-12 text-center border" style={{ background: t.surface, borderColor: t.border }}>
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-base font-semibold" style={{ color: t.textPrimary }}>No tasks found in this section</p>
                    <p className="text-xs mt-1" style={{ color: t.textMuted }}>You are all caught up!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTasks.map(a => {
                      const sub = a.submission;
                      const dl = fmtDeadline(a.deadline);
                      const statusColor = !sub ? "#F59E0B" : sub.status === "graded" ? t.teal : t.accent;
                      const statusLabel = !sub ? "Pending" : sub.status === "graded" ? `Graded (${sub.grade}/${a.max_marks || "?"})` : "Submitted";

                      return (
                        <div
                          key={a.id}
                          className="rounded-xl p-5 border flex flex-col justify-between transition-all hover:border-indigo-500/40"
                          style={{ background: t.surface, borderColor: t.border }}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="font-semibold text-base break-words" style={{ color: t.textPrimary }}>{a.title}</h3>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: `${statusColor}15`, color: statusColor }}>
                                {statusLabel}
                              </span>
                            </div>
                            {a.description && (
                              <p className="text-xs leading-relaxed line-clamp-3 mb-4" style={{ color: t.textSecondary }}>{a.description}</p>
                            )}
                          </div>

                          <div className="border-t pt-4 mt-2 flex items-center justify-between flex-wrap gap-2" style={{ borderColor: t.border }}>
                            <div className="flex items-center gap-3 text-xs">
                              {dl && <span className="font-medium" style={{ color: dl.color }}>⏰ {dl.text}</span>}
                              {a.max_marks && <span className="font-medium text-amber-500">⭐ {a.max_marks} marks</span>}
                            </div>
                            <button
                              onClick={() => { setActiveAssignment(a); setView("assignment"); }}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-transform active:scale-95"
                              style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}
                            >
                              {!sub ? "Submit PDF →" : sub.status === "graded" ? "View Grade →" : "View Submission"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Files & Document Library View */}
            {sideView === "files" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold" style={{ color: t.textPrimary }}>Files & Documents</h1>
                    <p className="text-sm mt-1" style={{ color: t.textSecondary }}>Access course PDFs, assignment attachments, and submitted files</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Category Filter */}
                    <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: t.surface, borderColor: t.border }}>
                      {[
                        { id: "all", label: "All Files" },
                        { id: "assignments", label: "Assignments" },
                        { id: "submissions", label: "Submissions" },
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setFileCategoryFilter(cat.id as any)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: fileCategoryFilter === cat.id ? t.accentBg : "transparent",
                            color: fileCategoryFilter === cat.id ? t.accent : t.textSecondary,
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {allFiles.length === 0 ? (
                  <div className="rounded-xl p-12 text-center border" style={{ background: t.surface, borderColor: t.border }}>
                    <div className="text-5xl mb-3">📁</div>
                    <p className="text-base font-semibold" style={{ color: t.textPrimary }}>No files found</p>
                    <p className="text-xs mt-1" style={{ color: t.textMuted }}>No documents match your current filter or search query.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allFiles.map(file => (
                      <div
                        key={file.id}
                        className="rounded-xl p-4 border flex flex-col justify-between transition-all hover:border-teal-500/40"
                        style={{ background: t.surface, borderColor: t.border }}
                      >
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: file.type === "assignment" ? t.tealBg : t.accentBg, color: file.type === "assignment" ? t.teal : t.accent }}>
                              PDF
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm truncate" style={{ color: t.textPrimary }}>{file.fileName}</h4>
                              <p className="text-xs truncate" style={{ color: t.textMuted }}>{file.title}</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-3 mt-2 flex items-center justify-between text-xs" style={{ borderColor: t.border }}>
                          <span style={{ color: t.textMuted }}>{fmtDate(file.date)}</span>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-colors"
                            style={{ background: t.bg, color: file.type === "assignment" ? t.teal : t.accent, borderColor: t.border }}
                          >
                            <Icons.Download /> Open / Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Batch Discussion / Chat View */}
            {sideView === "chat" && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold" style={{ color: t.textPrimary }}>Batch Discussion & Noticeboard</h1>
                  <p className="text-sm mt-1" style={{ color: t.textSecondary }}>Connect with your class, ask questions, and discuss assignments</p>
                </div>

                <div className="rounded-xl border overflow-hidden flex flex-col h-[520px]" style={{ background: t.surface, borderColor: t.border }}>
                  {/* Discussion Header */}
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: t.border, background: t.bg }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="font-semibold text-sm" style={{ color: t.textPrimary }}>#{student.batch_name} — General Q&A</span>
                    </div>
                    <span className="text-xs" style={{ color: t.textMuted }}>{chatMessages.length} message{chatMessages.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.isStudent ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: msg.isStudent ? t.accent : t.teal }}>{msg.sender}</span>
                          <span className="text-[10px]" style={{ color: t.textMuted }}>{msg.time}</span>
                        </div>
                        <div
                          className="max-w-md p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words border"
                          style={{
                            background: msg.isStudent ? t.accentBg : t.bg,
                            borderColor: msg.isStudent ? `${t.accent}30` : t.border,
                            color: t.textPrimary,
                            borderBottomRightRadius: msg.isStudent ? 2 : 16,
                            borderBottomLeftRadius: msg.isStudent ? 16 : 2,
                          }}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input Box */}
                  <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: t.border, background: t.bg }}>
                    <input
                      type="text"
                      value={newChatMessage}
                      onChange={e => setNewChatMessage(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendChatMessage()}
                      placeholder="Type a message or question for your batch..."
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                      style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textPrimary }}
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={!newChatMessage.trim()}
                      className="p-2.5 rounded-xl text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}
                      title="Send Message"
                    >
                      <Icons.Send />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard View */}
            {sideView === "dashboard" && (
            <div className="space-y-6">

              {/* Top Banner Widget */}
              <div
                className="relative overflow-hidden rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-center group transition-colors duration-300"
                style={{ background: t.surface, borderColor: t.border }}
              >
                <div className="p-6 md:p-8 flex-1 z-10">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: t.textPrimary }}>
                    Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {student.name.split(" ")[0]}.
                  </h1>
                  <p className="mt-2 text-sm md:text-base" style={{ color: t.textSecondary }}>
                    You have <span className="font-medium" style={{ color: t.teal }}>{pending.length} pending</span> assignment{pending.length !== 1 ? "s" : ""} and <strong style={{ color: t.textPrimary }}>{assignments.length} total</strong>.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-5">
                    <button
                      onClick={() => setSideView('calendar')}
                      className="px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-all shadow-md flex items-center space-x-2"
                      style={{ background: t.accent, boxShadow: `0 8px 20px ${t.accent}30` }}
                      onMouseEnter={e => e.currentTarget.style.background = t.accentHover}
                      onMouseLeave={e => e.currentTarget.style.background = t.accent}
                    >
                      <Icons.MonitorPlay />
                      <span>View Schedule</span>
                    </button>
                    <button
                      onClick={() => setSideView('tasks')}
                      className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all border"
                      style={{ background: t.bg, color: t.textPrimary, borderColor: t.border }}
                    >
                      View Assignments
                    </button>
                  </div>
                </div>

                <div
                  className="relative w-full sm:w-64 h-40 sm:h-full shrink-0 border-l"
                  style={{ borderColor: t.border, background: `linear-gradient(135deg, ${t.accent}20, ${t.teal}10, ${t.surface})` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-5xl mb-2">🎓</div>
                      <p className="text-xs font-medium" style={{ color: t.textSecondary }}>{student.batch_name}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex items-center space-x-1.5 px-2.5 py-1 rounded-md backdrop-blur-md" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-bold tracking-wider uppercase">Live</span>
                  </div>
                </div>
              </div>

              {/* Dashboard View Tabs */}
              <div className="flex items-center gap-2 border-b pb-1" style={{ borderColor: t.border }}>
                {[
                  { id: "overview", label: "Overview" },
                  { id: "announcements", label: `Announcements (${announcements.length})` },
                  { id: "assignments", label: `Assignments (${assignments.length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className="px-4 py-2 text-xs font-bold rounded-lg transition-all"
                    style={{
                      background: activeTab === tab.id ? t.accentBg : "transparent",
                      color: activeTab === tab.id ? t.accent : t.textSecondary,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 2-Column Bento Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column */}
                <div className="col-span-1 lg:col-span-2 space-y-4">
                  {(activeTab === "overview" || activeTab === "announcements") && (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: t.border }}>
                        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center" style={{ color: t.textPrimary }}>
                          <Icons.Pin /> <span className="ml-2">Announcements</span>
                        </h3>
                        <span className="text-xs" style={{ color: t.textMuted }}>{announcements.length} total</span>
                      </div>

                      {announcements.length === 0 && (
                        <div className="rounded-xl p-8 text-center border" style={{ background: t.surface, borderColor: t.border }}>
                          <div className="text-4xl mb-3">📢</div>
                          <p className="text-sm" style={{ color: t.textSecondary }}>No announcements yet</p>
                          <p className="text-xs mt-1" style={{ color: t.textMuted }}>Your teacher will post updates here</p>
                        </div>
                      )}

                      {(activeTab === "overview" ? announcements.slice(0, 3) : announcements).map(ann => (
                        <div
                          key={ann.id}
                          className="rounded-xl p-5 border transition-colors duration-150"
                          style={{
                            background: t.surface,
                            borderColor: ann.is_pinned ? "rgba(245,158,11,0.3)" : t.border,
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${getAvatarColor(ann.title)}, ${t.accent})` }}>
                              <span className="text-sm font-bold text-white">{ann.is_pinned ? "📌" : "📢"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-2">
                                <h4 className="font-semibold text-sm truncate" style={{ color: t.textPrimary }}>{ann.title}</h4>
                                <span className="text-xs shrink-0" style={{ color: t.textMuted }}>{fmtDate(ann.created_at)}</span>
                              </div>
                              {ann.is_pinned && (
                                <p className="text-xs text-amber-500 font-medium mt-0.5">📌 Pinned</p>
                              )}
                              {ann.content && (
                                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.textSecondary }}>{ann.content}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {(activeTab === "overview" || activeTab === "assignments") && (
                    <>
                      {/* Assignments Quick View */}
                      <div className="flex items-center justify-between pb-2 border-b mt-6" style={{ borderColor: t.border }}>
                        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center" style={{ color: t.textPrimary }}>
                          <Icons.Tasks /> <span className="ml-2">Recent Assignments</span>
                        </h3>
                        <span className="text-xs" style={{ color: t.textMuted }}>{assignments.length} total</span>
                      </div>

                      {assignments.length === 0 && (
                        <div className="rounded-xl p-8 text-center border" style={{ background: t.surface, borderColor: t.border }}>
                          <div className="text-4xl mb-3">📭</div>
                          <p className="text-sm" style={{ color: t.textSecondary }}>No assignments yet</p>
                        </div>
                      )}

                      {(activeTab === "overview" ? assignments.slice(0, 3) : assignments).map(a => {
                        const sub = a.submission;
                        const dl = fmtDeadline(a.deadline);
                        const statusColor = !sub ? "#F59E0B" : sub.status === "graded" ? t.teal : t.accent;
                        const statusLabel = !sub ? "Pending" : sub.status === "graded" ? `Graded · ${sub.grade}/${a.max_marks || "?"}` : "Submitted";

                        return (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -1 }}
                            onClick={() => { setActiveAssignment(a); setView("assignment"); }}
                            className="rounded-xl p-4 cursor-pointer transition-all border"
                            style={{ background: t.surface, borderColor: t.border }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                                  <h3 className="font-semibold text-sm truncate" style={{ color: t.textPrimary }}>{a.title}</h3>
                                </div>
                                {a.description && (
                                  <p className="text-xs truncate mt-1 pl-4" style={{ color: t.textSecondary }}>{a.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-2 pl-4">
                                  {dl && (
                                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: dl.color }}>
                                      <Icons.Clock /> {dl.text}
                                    </span>
                                  )}
                                  {a.max_marks && (
                                    <span className="text-xs font-medium text-amber-500 flex items-center gap-1">
                                      <Icons.Star /> {a.max_marks} marks
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0" style={{ background: statusColor + '15', color: statusColor }}>
                                {statusLabel}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Right Column */}
                <div className="col-span-1 space-y-6">

                  {/* Deadlines Widget */}
                  <div className="rounded-xl p-5 shadow-sm border" style={{ background: t.surface, borderColor: t.border }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textPrimary }}>Deadlines Approaching</h3>
                    <div className="space-y-4">
                      {pending.length === 0 && (
                        <div className="text-center py-4">
                          <div className="text-3xl mb-2">🎉</div>
                          <p className="text-xs" style={{ color: t.textSecondary }}>All caught up!</p>
                        </div>
                      )}
                      {pending.slice(0, 3).map(a => {
                        const dl = fmtDeadline(a.deadline);
                        const progress = a.deadline ? Math.max(0, Math.min(100, 100 - (new Date(a.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7) * 100)) : 0;
                        const circumference = 2 * Math.PI * 16;
                        const offset = circumference - (progress / 100) * circumference;
                        const color = dl?.color === "#EF4444" ? "#EF4444" : dl?.color === "#F59E0B" ? "#F59E0B" : t.teal;

                        return (
                          <div
                            key={a.id}
                            onClick={() => { setActiveAssignment(a); setView("assignment"); }}
                            className="flex items-center justify-between p-3 rounded-lg border transition-colors group cursor-pointer"
                            style={{ background: t.bg, borderColor: t.border }}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="relative w-10 h-10 shrink-0">
                                <svg className="w-10 h-10 transform -rotate-90">
                                  <circle cx="20" cy="20" r="16" fill="transparent" stroke={t.border} strokeWidth="3" />
                                  <circle cx="20" cy="20" r="16" fill="transparent" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: t.textPrimary }}>{Math.round(progress)}%</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium transition-colors truncate" style={{ color: t.textPrimary }}>{a.title}</p>
                                {dl && <p className="text-xs mt-0.5 truncate" style={{ color: dl.color }}>{dl.text}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grade Activity Widget */}
                  <div className="rounded-xl p-5 shadow-sm border" style={{ background: t.surface, borderColor: t.border }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textPrimary }}>Recent Grades</h3>
                    <div className="space-y-3">
                      {graded.length === 0 && (
                        <div className="text-center py-4">
                          <div className="text-3xl mb-2">📊</div>
                          <p className="text-xs" style={{ color: t.textSecondary }}>No grades yet</p>
                        </div>
                      )}
                      {graded.slice(0, 3).map(a => {
                        const pct = a.max_marks ? Math.round((a.submission!.grade || 0) / a.max_marks * 100) : 0;
                        const gradeColor = pct >= 80 ? t.teal : pct >= 60 ? t.accent : "#F59E0B";
                        return (
                          <div
                            key={a.id}
                            onClick={() => { setActiveAssignment(a); setView("assignment"); }}
                            className="flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors" style={{ background: t.border, color: t.textSecondary }}>
                                <Icons.Tasks />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{a.title}</p>
                                <p className="text-[11px]" style={{ color: t.textMuted }}>Graded {a.submission?.submitted_at ? fmtDate(a.submission.submitted_at) : ""}</p>
                              </div>
                            </div>
                            <div className="px-2 py-1 rounded text-xs font-bold border shrink-0" style={{ background: gradeColor + '15', color: gradeColor, borderColor: gradeColor + '30' }}>
                              {a.submission?.grade ?? "—"}/{a.max_marks || "?"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {graded.length > 0 && (
                      <button
                        onClick={() => setSideView('tasks')}
                        className="w-full mt-5 py-2 text-xs font-medium rounded-lg border transition-colors"
                        style={{ background: t.bg, color: t.textSecondary, borderColor: t.border }}
                      >
                        View All Tasks & Grades
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-xs border-t pt-3 flex-wrap gap-2" style={{ color: t.textMuted, borderColor: t.border }}>
                <span>a4ai Classroom · v2.0</span>
                <span>
                  {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} ·{" "}
                  {announcements.length} announcement{announcements.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}