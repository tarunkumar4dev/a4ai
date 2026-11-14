// src/pages/StudentPortalPage.tsx
// Route: /student
// No login needed — student enters the access code from their school.
// Same look as the student dashboard (/student/dashboard): white sidebar, black active item, colourful cards,
// bottom nav on phones. No animation (lite mode), no web fonts.

import React, { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FolderOpen,
  GraduationCap,
  LayoutGrid,
  Loader2,
  LogOut,
  Megaphone,
  Paperclip,
  Pin,
  Search,
  Sparkles,
  Star,
  Upload,
  type LucideIcon,
} from "lucide-react";
// Portal-only client: never carries a staff session (B2). DB access only via the access-code RPCs
// in supabase/migrations/05_student_portal.sql — no direct table reads.
import { portalSupabase as supabase } from "@/lib/supabasePortalClient";
import StudentCalendar, { type CalEvent } from "@/components/student/StudentCalendar";
import UploadAttempts, { type UploadTokens } from "@/components/student/UploadAttempts";

/* ─── Types ────────────────────────────────────────────────────── */
type StudentData = {
  id: string;
  name: string;
  roll_no: string;
  batch_id: string;
  batch_name: string;
  lab_batch_id: string | null;
  lab_batch_name: string | null;
  section_name: string | null;
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
  batch_id?: string;
  batch_name?: string | null;
  /** set when the teacher switched the copy-upload link on (19) → upload through create_submission */
  upload_link_token?: string | null;
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

type View = "dashboard" | "tasks" | "calendar" | "files" | "activity";
type TaskFilter = "all" | "pending" | "submitted" | "graded";

/* ─── Helpers ───────────────────────────────────────────────────── */
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtDeadline = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Overdue", color: "#B42318" };
  if (days === 0) return { text: "Due today", color: "#C2410C" };
  if (days === 1) return { text: "Due tomorrow", color: "#C2410C" };
  return { text: `Due ${fmtDate(d)}`, color: "#5D6570" };
};

const getInitials = (name: string) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

// upload-link attempts have their own statuses (docs/upload-flow-api.md §1): everything not yet published counts as submitted
const isDone = (s: string) => s === "graded" || s === "published";

/** Status pill for an assignment — same colours as the dashboard tiles. */
function statusOf(a: Assignment): { label: string; fg: string; bg: string } {
  const sub = a.submission;
  if (!sub) return { label: "Pending", fg: "#C2410C", bg: "#FFF1E3" };
  if (isDone(sub.status)) {
    return { label: sub.grade != null ? `Graded · ${sub.grade}/${a.max_marks ?? "?"}` : "Graded", fg: "#047857", bg: "#E4F8F3" };
  }
  if (sub.status === "rejected") return { label: "Not accepted", fg: "#B42318", bg: "#FFF1F0" };
  return { label: "Submitted", fg: "#5B4BC4", bg: "#EFEDFF" };
}

/* Colours from the student dashboard (StudentDashboardPage TOOLS) */
const TILE = {
  pink: { bg: "linear-gradient(135deg,#FFEDEF,#FFD9DE)", accent: "#D93F4D" },
  orange: { bg: "linear-gradient(135deg,#FFF1E3,#FFDDBE)", accent: "#C2410C" },
  lime: { bg: "linear-gradient(135deg,#EEF7D6,#DCEDB5)", accent: "#4D7C0F" },
  lilac: { bg: "linear-gradient(135deg,#EFEDFF,#DCD7FF)", accent: "#5B4BC4" },
  yellow: { bg: "linear-gradient(135deg,#FFF7D9,#FFE9AD)", accent: "#9A6B00" },
  mint: { bg: "linear-gradient(135deg,#E4F8F3,#C9EFE4)", accent: "#047857" },
};

/** Tokens for UploadAttempts (it styles itself from these). */
const UPLOAD_TOKENS: UploadTokens = {
  bg: "#F7F8FA", surface: "#FFFFFF", border: "#E5E7EB", textPrimary: "#1B1B1B", textSecondary: "#374151",
  textMuted: "#5D6570", accent: "#5B4BC4", accentHover: "#4C3DB0", accentBg: "#EFEDFF", teal: "#047857", tealBg: "#E4F8F3",
};

const NAV: { id: View; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Home", Icon: LayoutGrid },
  { id: "tasks", label: "Assignments", Icon: ClipboardList },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "files", label: "Files", Icon: FolderOpen },
  { id: "activity", label: "Activity", Icon: Activity },
];

const BTN_BLACK = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 text-[15px] font-bold text-white hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#374151] hover:bg-[#F7F8FA]";

/* Hero surface: the soft pink card from the student dashboard, shared by the login, home and assignment screens. Dark text, black button. */
const HERO_BG = "linear-gradient(135deg,#FFEDF0 0%,#FFD9E2 100%)";
const BTN_ON_HERO = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 text-[15px] font-bold text-white hover:bg-[#222222]";
const BTN_ON_HERO_GHOST = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-black/15 px-4 text-[15px] font-semibold text-[#1B1B1B] hover:border-black/40";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[#E5E7EB] bg-white p-5 sm:p-6 ${className}`}>{children}</div>;
}

function Empty({ Icon, title, body }: { Icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center">
      <Icon className="mx-auto h-7 w-7 text-[#9CA3AF]" aria-hidden="true" />
      <p className="mt-3 text-[15px] font-semibold text-[#1B1B1B]">{title}</p>
      {body && <p className="mt-1 text-[14px] text-[#5D6570]">{body}</p>}
    </div>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function StudentPortalPage() {
  const [view, setView] = useState<"login" | "dashboard" | "assignment">("login");
  const [code, setCode] = useState("");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sideView, setSideView] = useState<View>("dashboard");
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [fileCategoryFilter, setFileCategoryFilter] = useState<"all" | "assignments" | "submissions">("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskFilter>("all");

  useEffect(() => {
    const saved = localStorage.getItem("a4ai_student_code");
    if (saved) loginWithCode(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Login (get_student_by_code RPC) ── */
  async function loginWithCode(inputCode: string) {
    setLoading(true);
    setError("");
    const clean = inputCode.trim().toUpperCase();
    try {
      const { data: row, error: rpcErr } = await supabase.rpc("get_student_by_code", { p_code: clean });
      if (rpcErr) console.error("get_student_by_code:", rpcErr);
      if (rpcErr || !row) {
        setError("Invalid code. Please check and try again.");
        localStorage.removeItem("a4ai_student_code");
        setLoading(false);
        return;
      }

      const s: StudentData = {
        id: row.id,
        name: row.name || "Student",
        roll_no: row.roll_no || "",
        batch_id: row.batch_id,
        batch_name: row.batch_name || "—",
        lab_batch_id: row.lab_batch_id || null,
        lab_batch_name: row.lab_batch_name || null,
        section_name: row.section_name || null,
        class_level: row.class_level || "",
        department_name: row.department_name || "",
        access_code: clean,
        institute_name: row.institute_name || "Institute",
        institute_id: row.institute_id,
      };

      localStorage.setItem("a4ai_student_code", clean);
      setStudent(s);
      await loadDashboard(s);
      setView("dashboard");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  /* ── Feed (get_student_feed RPC): own batch + lab batch only ── */
  async function loadDashboard(s: StudentData): Promise<Assignment[]> {
    const { data: feed, error: feedErr } = await supabase.rpc("get_student_feed", { p_code: s.access_code });
    if (feedErr || !feed) {
      if (feedErr) console.error("get_student_feed:", feedErr);
      return [];
    }
    const asgns: Assignment[] = feed.assignments || [];
    setAssignments(asgns);
    setAnnouncements(feed.announcements || []);

    // Calendar = events + assignment deadlines
    const evts: CalEvent[] = [...(feed.events || [])];
    asgns.forEach((a) => {
      if (a.deadline) evts.push({
        id: `asgn-${a.id}`, title: `📋 ${a.title}`,
        description: `Assignment deadline${a.max_marks ? ` · ${a.max_marks} marks` : ""}`,
        event_type: "deadline", start_time: a.deadline, all_day: false,
        color: "#F59E0B", is_assignment: true,
      });
    });
    evts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    setCalEvents(evts);
    return asgns;
  }

  // Anon gets no realtime events once table policies are gone (05b) → poll + refresh on focus instead
  useEffect(() => {
    if (!student) return;
    const refresh = () => { if (document.visibilityState === "visible") loadDashboard(student); };
    const id = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(id); window.removeEventListener("focus", refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.access_code]);

  /* ── Submit. Upload-link assignments (upload_link_token, 19): components/student/UploadAttempts
     (create_submission / my_submissions, docs/upload-flow-api.md). Every other assignment keeps the old single-PDF
     flow (storage upload + submit_assignment), which the teacher's AI check reads through file_url. ── */
  async function handleSubmitFile(assignment: Assignment, file: File) {
    if (!student) return;
    setUploading(true);
    try {
      // Path must be <institute>/<assignment>/<student>_… — submit_assignment rejects anything else
      const path = `${student.institute_id}/${assignment.id}/${student.id}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { upsert: false, contentType: "application/pdf" }); // unique path; upsert would need storage SELECT (removed in 07)
      if (upErr) throw upErr;

      // Bucket is private (13_role_hardening): this URL isn't directly readable, it's the stored reference that
      // submit_assignment validates and staff/backend turn back into a path.
      const { data: { publicUrl } } = supabase.storage.from("submissions").getPublicUrl(path);

      const { error: subErr } = await supabase.rpc("submit_assignment", {
        p_code: student.access_code,
        p_assignment_id: assignment.id,
        p_file_url: publicUrl,
        p_file_name: file.name,
      });
      if (subErr) throw subErr;

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      const fresh = await loadDashboard(student);
      const updated = fresh.find((a) => a.id === assignment.id);
      if (updated) setActiveAssignment(updated);
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
    setCalEvents([]);
    setView("login");
    setCode("");
  }

  const pending = assignments.filter(a => !a.submission);
  const submitted = assignments.filter(a => a.submission && !isDone(a.submission.status) && a.submission.status !== "rejected");
  const graded = assignments.filter(a => a.submission && isDone(a.submission.status));

  /** Pending work, soonest deadline first (no deadline last). */
  const upcoming = [...pending].sort((a, b) =>
    (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity));

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

  const openAssignment = (a: Assignment) => { setActiveAssignment(a); setView("assignment"); window.scrollTo(0, 0); };
  const go = (v: View) => { setSideView(v); setView("dashboard"); setActiveAssignment(null); };
  const openTasks = (f: TaskFilter) => { setTaskStatusFilter(f); go("tasks"); };

  /* ══════════════════════════════════════════
     LOGIN SCREEN
  ══════════════════════════════════════════ */
  if (view === "login") return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#1B1B1B]">
      <header className="flex h-16 items-center border-b border-[#E5E7EB] bg-white px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/ICON.ico" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="text-lg font-bold">a4ai</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px]">
          <div className="rounded-[24px] p-6 text-[#1B1B1B] sm:p-8" style={{ backgroundImage: HERO_BG }}>
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
            <h1 className="mt-3 font-halenoir text-2xl font-bold sm:text-[1.9rem]">Student portal</h1>
            <p className="mt-1.5 text-[15px] text-[#5D6570]">For students of a school, college or institute on a4ai. Enter the access code your teacher gave you to see your assignments, deadlines and marks.</p>
          </div>

          <Card className="mt-4">
            <form onSubmit={e => { e.preventDefault(); if (code.length >= 4) loginWithCode(code); }}>
              <label htmlFor="access-code" className="block text-[14px] font-semibold text-[#374151]">Access code</label>
              <input
                id="access-code"
                type="text"
                maxLength={8}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? "code-error" : undefined}
                className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] outline-none placeholder:text-[#9CA3AF] focus:border-[#111111] focus:bg-white"
                autoFocus
              />

              {error && (
                <p id="code-error" role="alert" className="mt-3 rounded-xl border border-[#FECDCA] bg-[#FFF1F0] px-4 py-3 text-[14px] font-semibold text-[#B42318]">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || code.length < 4} className={`${BTN_BLACK} mt-4 w-full`}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…</> : "Enter classroom"}
              </button>
            </form>
          </Card>

          <div className="mt-5 rounded-[20px] border border-[#E5E7EB] bg-white p-5 text-center">
            <p className="text-[14px] font-semibold text-[#1B1B1B]">No code from your school?</p>
            <p className="mt-1 text-[13.5px] text-[#5D6570]">Use your own a4ai student account for contests, practice, flashcards and notes.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link to="/login" className="inline-flex min-h-[44px] items-center rounded-xl border border-[#E5E7EB] px-4 text-[14px] font-bold text-[#1B1B1B] hover:bg-[#F7F8FA]">Sign in</Link>
              <Link to="/signup" state={{ role: "student" }} className="inline-flex min-h-[44px] items-center rounded-xl bg-[#111111] px-4 text-[14px] font-bold text-white hover:bg-[#222222]">Create a student account</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (!student) return null;

  const firstName = student.name.split(" ")[0];
  const classLine = [student.batch_name, student.lab_batch_name ? `Lab ${student.lab_batch_name}` : null, student.institute_name]
    .filter(Boolean).join(" · ");
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const current: View | null = view === "assignment" ? null : sideView;
  const pageLabel = view === "assignment" ? "Assignment" : NAV.find(n => n.id === sideView)?.label;

  /* ── One assignment row (Home + Assignments) ── */
  const assignmentRow = (a: Assignment) => {
    const st = statusOf(a);
    const dl = fmtDeadline(a.deadline);
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => openAssignment(a)}
          className="flex w-full items-start justify-between gap-3 rounded-[20px] border border-[#E5E7EB] bg-white p-4 text-left hover:border-[#C9C4F5] sm:p-5"
        >
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-bold">{a.title}</span>
            <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-[#5D6570]">
              {dl && <span className="inline-flex items-center gap-1" style={{ color: dl.color }}><Clock className="h-3.5 w-3.5" aria-hidden="true" />{dl.text}</span>}
              {a.max_marks != null && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" aria-hidden="true" />{a.max_marks} marks</span>}
              {a.batch_name && a.batch_name !== student.batch_name && <span>{a.batch_name}</span>}
            </span>
          </span>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
        </button>
      </li>
    );
  };

  /* ══════════════════════════════════════════
     SHELL (sidebar · top bar · bottom nav)
  ══════════════════════════════════════════ */
  const shell = (content: ReactNode) => (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1B1B1B]">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r border-[#E5E7EB] bg-white p-5 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-2.5 px-2">
          <img src="/ICON.ico" alt="" width={36} height={36} className="h-9 w-9" />
          <span className="text-xl font-bold">a4ai</span>
        </Link>
        <nav aria-label="Student portal" className="flex-1 space-y-1">
          {NAV.map(({ id, label, Icon }) => {
            const active = current === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold ${
                  active ? "bg-[#111111] text-white" : "text-[#374151] hover:bg-[#F7F8FA]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
                {id === "tasks" && pending.length > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[12px] font-bold ${active ? "bg-white text-[#111111]" : "bg-[#FFF1E3] text-[#C2410C]"}`}>
                    {pending.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-[#E5E7EB] pt-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-[#5B4BC4]" style={{ backgroundImage: TILE.lilac.bg }}>
              {getInitials(student.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold">{student.name}</span>
              <span className="block truncate text-[12px] text-[#5D6570]">{student.roll_no ? `Roll ${student.roll_no}` : student.batch_name}</span>
            </span>
          </div>
          <button type="button" onClick={logout} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-[#B42318] hover:bg-[#FFF1F0]">
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[240px]">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <img src="/ICON.ico" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold">a4ai</span>
          </Link>
          <p className="hidden truncate text-[14px] text-[#5D6570] lg:block">
            {student.batch_name} <span aria-hidden="true">/</span> <span className="font-semibold text-[#1B1B1B]">{pageLabel}</span>
          </p>
          <div className="flex items-center gap-2">
            <div className="relative hidden w-[260px] sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search files and assignments"
                value={fileSearchQuery}
                onChange={e => {
                  setFileSearchQuery(e.target.value);
                  if (e.target.value.trim() && (sideView !== "files" || view !== "dashboard")) go("files");
                }}
                placeholder="Search files"
                className="min-h-[40px] w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] pl-9 pr-3 text-[14px] outline-none focus:border-[#111111] focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => openTasks("pending")}
              aria-label={pending.length ? `${pending.length} pending assignments` : "Assignments"}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] hover:bg-[#F7F8FA]"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {pending.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D93F4D]" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 text-[14px] font-semibold text-[#B42318] hover:bg-[#FFF1F0] lg:hidden"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Log out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1100px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">{content}</main>
      </div>

      {/* Bottom nav (phones) */}
      <nav aria-label="Student portal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E7EB] bg-white lg:hidden">
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-[#D93F4D]" : "text-[#5D6570]"}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
              {id === "tasks" && pending.length > 0 && (
                <span className="absolute right-[calc(50%-20px)] top-2 rounded-full bg-[#D93F4D] px-1.5 text-[10px] font-bold leading-4 text-white">{pending.length}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  /* ══════════════════════════════════════════
     ASSIGNMENT DETAIL VIEW
  ══════════════════════════════════════════ */
  if (view === "assignment" && activeAssignment) {
    const sub = activeAssignment.submission;
    const dl = fmtDeadline(activeAssignment.deadline);
    const st = statusOf(activeAssignment);

    return shell(
      <div className="mx-auto max-w-[820px]">
        <button type="button" onClick={() => { setView("dashboard"); setActiveAssignment(null); }} className={BTN_GHOST}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <div className="mt-4 rounded-[24px] p-6 text-[#1B1B1B] sm:p-8" style={{ backgroundImage: HERO_BG }}>
          <span className="inline-block rounded-full bg-white px-2.5 py-1 text-[12px] font-bold" style={{ color: st.fg }}>{st.label}</span>
          <h1 className="mt-3 break-words font-halenoir text-2xl font-bold sm:text-[1.9rem]">{activeAssignment.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] font-semibold text-[#5D6570]">
            {dl && <span className="inline-flex items-center gap-1.5 text-[#1B1B1B]"><Clock className="h-4 w-4" aria-hidden="true" />{dl.text}</span>}
            {activeAssignment.max_marks != null && <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4" aria-hidden="true" />{activeAssignment.max_marks} marks</span>}
            {activeAssignment.file_url && <span className="inline-flex items-center gap-1.5"><Paperclip className="h-4 w-4" aria-hidden="true" />PDF attached</span>}
          </div>
        </div>

        <Card className="mt-4 space-y-6">
          {activeAssignment.description && (
            <section>
              <h2 className="text-[14px] font-bold text-[#5D6570]">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{activeAssignment.description}</p>
            </section>
          )}

          {activeAssignment.file_url && (
            <section>
              <h2 className="text-[14px] font-bold text-[#5D6570]">Attachments</h2>
              <a href={activeAssignment.file_url} target="_blank" rel="noreferrer" className={`${BTN_GHOST} mt-2`}>
                <Download className="h-4 w-4" aria-hidden="true" /> {activeAssignment.file_name || "Download assignment"}
              </a>
            </section>
          )}

          <section className="border-t border-[#E5E7EB] pt-6">
            <h2 className="text-[14px] font-bold text-[#5D6570]">Your submission</h2>

            {sub && sub.status === "graded" && (
              <div className="mt-3 rounded-[20px] p-5" style={{ backgroundImage: TILE.mint.bg }}>
                <p className="flex items-center gap-2 text-[14px] font-bold text-[#047857]"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Graded</p>
                <p className="mt-1 text-3xl font-bold text-[#047857]">
                  {sub.grade ?? "—"} <span className="text-[15px] font-semibold text-[#374151]">/ {activeAssignment.max_marks || "?"}</span>
                </p>
                {sub.feedback && <p className="mt-3 rounded-xl bg-white/80 p-3 text-[14px]">{sub.feedback}</p>}
              </div>
            )}

            {sub && sub.status === "submitted" && (
              <div className="mt-3 flex items-center gap-3 rounded-[20px] p-4" style={{ backgroundImage: TILE.lilac.bg }}>
                <CheckCircle2 className="h-6 w-6 shrink-0 text-[#5B4BC4]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{sub.file_name || "Submitted"}</p>
                  {/* The submissions bucket is private and the portal has no session to sign a URL — no View link. */}
                  <p className="text-[13px] text-[#374151]">Submitted {fmtDate(sub.submitted_at)}</p>
                </div>
              </div>
            )}

            <div className="mt-4">
              {activeAssignment.upload_link_token ? (
                <UploadAttempts
                  code={student.access_code}
                  assignmentRef={activeAssignment.upload_link_token}
                  student={{ id: student.id, institute_id: student.institute_id }}
                  t={UPLOAD_TOKENS}
                  onChange={() => loadDashboard(student)}
                />
              ) : (
                <>
                  {submitSuccess && (
                    <p role="status" className="mb-4 rounded-xl px-4 py-3 text-[14px] font-semibold text-[#047857]" style={{ background: "#E4F8F3" }}>
                      Submitted successfully!
                    </p>
                  )}

                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) await handleSubmitFile(activeAssignment, file);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />

                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${BTN_BLACK} w-full`}>
                    {uploading
                      ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Uploading…</>
                      : <><Upload className="h-4 w-4" aria-hidden="true" /> {sub ? "Resubmit (PDF only)" : "Upload answer (PDF)"}</>}
                  </button>
                  <p className="mt-2 text-center text-[13px] text-[#5D6570]">PDF files only · Max 10 MB</p>
                </>
              )}
            </div>
          </section>
        </Card>
      </div>,
    );
  }

  /* ══════════════════════════════════════════
     DASHBOARD VIEWS
  ══════════════════════════════════════════ */
  const next = upcoming[0];
  const nextDl = next ? fmtDeadline(next.deadline) : null;
  const visibleAnnouncements = showAllAnnouncements ? announcements : announcements.slice(0, 3);

  const activityItems = [
    ...graded.map(a => ({
      Icon: CheckCircle2, color: "#047857", text: `Graded: ${a.title} — ${a.submission?.grade ?? "—"}/${a.max_marks || "?"}`,
      time: a.submission?.submitted_at || a.created_at,
    })),
    ...assignments.map(a => ({ Icon: ClipboardList, color: "#5B4BC4", text: `New assignment: ${a.title}`, time: a.created_at })),
    ...announcements.map(a => ({ Icon: Megaphone, color: "#D93F4D", text: a.title, time: a.created_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

  return shell(
    <>
      {/* ── Home ── */}
      {sideView === "dashboard" && (
        <>
          <h1 className="font-halenoir text-2xl font-bold tracking-[-0.01em] sm:text-[1.9rem]">Welcome back, {firstName}</h1>
          <p className="mt-1 text-[14px] text-[#5D6570]">{classLine} · {today}</p>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-[24px] p-6 text-[#1B1B1B] sm:p-8" style={{ backgroundImage: HERO_BG }}>
              <ClipboardList className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-3 font-halenoir text-xl font-bold sm:text-2xl">
                {pending.length > 0 ? `${pending.length} assignment${pending.length !== 1 ? "s" : ""} to submit` : "You're all caught up"}
              </h2>
              <p className="mt-1.5 max-w-md text-[15px] text-[#5D6570]">
                {next
                  ? <>Next: <span className="font-semibold text-[#1B1B1B]">{next.title}</span>{nextDl && <> · <span className="font-semibold text-[#1B1B1B]">{nextDl.text}</span></>}</>
                  : "New work from your teachers will show up here."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {next
                  ? <button type="button" onClick={() => openAssignment(next)} className={BTN_ON_HERO}>Open next assignment</button>
                  : <button type="button" onClick={() => openTasks("all")} className={BTN_ON_HERO}>View assignments</button>}
                <button type="button" onClick={() => go("calendar")} className={BTN_ON_HERO_GHOST}>
                  <CalendarDays className="h-4 w-4" aria-hidden="true" /> Calendar
                </button>
              </div>
            </div>

            <Card>
              <GraduationCap className="h-6 w-6 text-[#5B4BC4]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold">Your class</h2>
              <dl className="mt-2 space-y-1.5 text-[14px]">
                {[
                  ["Class", student.batch_name],
                  ["Lab", student.lab_batch_name],
                  ["Department", student.department_name],
                  ["Roll no.", student.roll_no],
                  ["School", student.institute_name],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#5D6570]">{k}</dt>
                    <dd className="truncate text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          {/* Progress tiles */}
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
            {([
              { f: "pending", label: "Pending", n: pending.length, tile: TILE.orange },
              { f: "submitted", label: "Submitted", n: submitted.length, tile: TILE.lilac },
              { f: "graded", label: "Graded", n: graded.length, tile: TILE.mint },
            ] as const).map(({ f, label, n, tile }) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => openTasks(f)}
                  className="w-full rounded-[20px] border border-black/[0.04] p-4 text-left sm:p-5"
                  style={{ backgroundImage: tile.bg }}
                >
                  <span className="block text-3xl font-bold" style={{ color: tile.accent }}>{n}</span>
                  <span className="mt-0.5 block text-[14px] font-semibold text-[#374151]">{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-9">
              <section>
                <SectionTitle action={assignments.length > 0 && (
                  <button type="button" onClick={() => openTasks("all")} className="min-h-[44px] text-[14px] font-bold underline underline-offset-4">See all ({assignments.length})</button>
                )}>
                  Assignments
                </SectionTitle>
                {assignments.length === 0
                  ? <Empty Icon={ClipboardList} title="No assignments yet" body="Your teachers will post work here." />
                  : <ul className="space-y-3">{assignments.slice(0, 4).map(assignmentRow)}</ul>}
              </section>

              <section>
                <SectionTitle action={announcements.length > 3 && (
                  <button type="button" onClick={() => setShowAllAnnouncements(s => !s)} className="min-h-[44px] text-[14px] font-bold underline underline-offset-4">
                    {showAllAnnouncements ? "Show less" : `See all (${announcements.length})`}
                  </button>
                )}>
                  Announcements
                </SectionTitle>
                {announcements.length === 0
                  ? <Empty Icon={Megaphone} title="No announcements yet" body="Your teacher will post updates here." />
                  : (
                    <ul className="space-y-3">
                      {visibleAnnouncements.map(ann => (
                        <li key={ann.id} className="flex gap-4 rounded-[20px] border border-[#E5E7EB] bg-white p-4 sm:p-5" style={ann.is_pinned ? { borderColor: "#FFE9AD" } : undefined}>
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundImage: ann.is_pinned ? TILE.yellow.bg : TILE.pink.bg, color: ann.is_pinned ? TILE.yellow.accent : TILE.pink.accent }}>
                            {ann.is_pinned ? <Pin className="h-5 w-5" aria-hidden="true" /> : <Megaphone className="h-5 w-5" aria-hidden="true" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="truncate text-[16px] font-bold">{ann.title}</h3>
                              <span className="shrink-0 text-[12px] text-[#5D6570]">{fmtDate(ann.created_at)}</span>
                            </div>
                            {ann.is_pinned && <p className="text-[12px] font-bold text-[#9A6B00]">Pinned</p>}
                            {ann.content && <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#374151]">{ann.content}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </div>

            <div className="space-y-5">
              <Card>
                <h2 className="text-lg font-bold">Upcoming deadlines</h2>
                {upcoming.length === 0
                  ? <p className="mt-3 text-[14px] text-[#5D6570]">Nothing due. Nice work!</p>
                  : (
                    <ul className="mt-3 space-y-2">
                      {upcoming.slice(0, 4).map(a => {
                        const dl = fmtDeadline(a.deadline);
                        return (
                          <li key={a.id}>
                            <button type="button" onClick={() => openAssignment(a)} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F7F8FA]">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dl?.color || "#9CA3AF" }} aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-semibold">{a.title}</span>
                                <span className="block text-[12px] font-medium" style={{ color: dl?.color || "#5D6570" }}>{dl?.text || "No deadline"}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </Card>

              <Card>
                <h2 className="text-lg font-bold">Recent marks</h2>
                {graded.length === 0
                  ? <p className="mt-3 text-[14px] text-[#5D6570]">Marks show up here after your teacher checks your work.</p>
                  : (
                    <ul className="mt-3 space-y-2">
                      {graded.slice(0, 4).map(a => (
                        <li key={a.id}>
                          <button type="button" onClick={() => openAssignment(a)} className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F7F8FA]">
                            <span className="truncate text-[14px] font-semibold">{a.title}</span>
                            <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold text-[#047857]" style={{ background: "#E4F8F3" }}>
                              {a.submission?.grade ?? "—"}/{a.max_marks || "?"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </Card>
            </div>
          </div>

          <h2 className="mt-9 text-lg font-bold">Keep going</h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {([
              { v: "calendar", title: "Calendar", body: "Classes and deadlines by date", Icon: CalendarDays, tile: TILE.yellow },
              { v: "files", title: "Files", body: "Question papers from your teachers", Icon: FolderOpen, tile: TILE.lime },
              { v: "activity", title: "Activity", body: "Everything new, latest first", Icon: Activity, tile: TILE.pink },
            ] as const).map(({ v, title, body, Icon, tile }) => (
              <li key={v}>
                <button type="button" onClick={() => go(v)} className="flex h-full w-full items-start gap-4 rounded-[20px] border border-black/[0.04] p-5 text-left" style={{ backgroundImage: tile.bg }}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80" style={{ color: tile.accent }}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span>
                    <span className="block text-[16px] font-bold">{title}</span>
                    <span className="mt-0.5 block text-[14px] text-[#374151]">{body}</span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <Link to="/student/dashboard" className="flex h-full items-start gap-4 rounded-[20px] border border-black/[0.04] p-5" style={{ backgroundImage: TILE.lilac.bg }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80" style={{ color: TILE.lilac.accent }}><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
                <span>
                  <span className="block text-[16px] font-bold">Practise on a4ai</span>
                  <span className="mt-0.5 block text-[14px] text-[#374151]">Contests, practice and flashcards</span>
                </span>
              </Link>
            </li>
          </ul>
        </>
      )}

      {/* ── Assignments ── */}
      {sideView === "tasks" && (
        <>
          <h1 className="font-halenoir text-2xl font-bold sm:text-[1.9rem]">Assignments</h1>
          <p className="mt-1 text-[14px] text-[#5D6570]">Homework, deadlines and marks from your teachers</p>
          <div role="group" aria-label="Filter assignments" className="mt-5 flex flex-wrap gap-2">
            {([
              { id: "all", label: "All", count: assignments.length },
              { id: "pending", label: "Pending", count: pending.length },
              { id: "submitted", label: "Submitted", count: submitted.length },
              { id: "graded", label: "Graded", count: graded.length },
            ] as const).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTaskStatusFilter(f.id)}
                aria-pressed={taskStatusFilter === f.id}
                className={`min-h-[40px] rounded-xl px-4 text-[14px] font-semibold ${taskStatusFilter === f.id ? "bg-[#111111] text-white" : "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F7F8FA]"}`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <div className="mt-5">
            {filteredTasks.length === 0
              ? <Empty Icon={CheckCircle2} title="Nothing here" body="You are all caught up." />
              : <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{filteredTasks.map(assignmentRow)}</ul>}
          </div>
        </>
      )}

      {/* ── Calendar ── */}
      {sideView === "calendar" && (
        <>
          <h1 className="mb-5 font-halenoir text-2xl font-bold sm:text-[1.9rem]">Calendar</h1>
          <StudentCalendar events={calEvents} />
        </>
      )}

      {/* ── Files ── */}
      {sideView === "files" && (
        <>
          <h1 className="font-halenoir text-2xl font-bold sm:text-[1.9rem]">Files</h1>
          <p className="mt-1 text-[14px] text-[#5D6570]">Assignment papers and the files you submitted</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:hidden">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search files"
                value={fileSearchQuery}
                onChange={e => setFileSearchQuery(e.target.value)}
                placeholder="Search files"
                className="min-h-[44px] w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 text-[14px] outline-none focus:border-[#111111]"
              />
            </div>
            {([
              { id: "all", label: "All files" },
              { id: "assignments", label: "From teachers" },
              { id: "submissions", label: "My submissions" },
            ] as const).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFileCategoryFilter(cat.id)}
                aria-pressed={fileCategoryFilter === cat.id}
                className={`min-h-[40px] rounded-xl px-4 text-[14px] font-semibold ${fileCategoryFilter === cat.id ? "bg-[#111111] text-white" : "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F7F8FA]"}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {allFiles.length === 0
              ? <Empty Icon={FolderOpen} title="No files found" body="Nothing matches this filter or search." />
              : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allFiles.map(file => {
                    const tile = file.type === "assignment" ? TILE.lime : TILE.lilac;
                    return (
                      <li key={file.id} className="flex flex-col justify-between rounded-[20px] border border-[#E5E7EB] bg-white p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold" style={{ backgroundImage: tile.bg, color: tile.accent }}>PDF</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-bold">{file.fileName}</span>
                            <span className="block truncate text-[12px] text-[#5D6570]">{file.title}</span>
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-3 text-[13px]">
                          <span className="text-[#5D6570]">{fmtDate(file.date)}</span>
                          {file.type === "submission" ? (
                            // private bucket, no portal session to sign a URL
                            <span className="font-semibold text-[#5B4BC4]">Submitted</span>
                          ) : (
                            <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3 font-semibold hover:bg-[#F7F8FA]">
                              <Download className="h-4 w-4" aria-hidden="true" /> Open
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </>
      )}

      {/* ── Activity ── */}
      {sideView === "activity" && (
        <>
          <h1 className="font-halenoir text-2xl font-bold sm:text-[1.9rem]">Activity</h1>
          <p className="mt-1 text-[14px] text-[#5D6570]">Latest first</p>
          <div className="mt-5">
            {activityItems.length === 0
              ? <Empty Icon={Activity} title="No activity yet" />
              : (
                <ul className="divide-y divide-[#E5E7EB] rounded-[24px] border border-[#E5E7EB] bg-white">
                  {activityItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 p-4">
                      <item.Icon className="h-5 w-5 shrink-0" style={{ color: item.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{item.text}</span>
                        <span className="block text-[12px] text-[#5D6570]">{fmtDate(item.time)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </>
      )}
    </>,
  );
}
