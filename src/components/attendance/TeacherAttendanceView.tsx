// src/components/attendance/TeacherAttendanceView.tsx
// ──────────────────────────────────────────────────────────────────────
// Teacher attendance module for the TeacherDashboardPage.
// Render as: {activeTab === "attendance" && <TeacherAttendanceView />}
//
// Flow: Teacher Info + Calendar + Assigned Classes grid
//       → click a class → Excel-like attendance sheet
//         (serial, name, Red/Green/Blue status buttons, attendance %)
//       + Class analytics (present/absent/leave counts, monthly trend)
//
// Uses demo data until Supabase tables are wired. Matches the
// teacher dashboard's glass-panel / inset-pill / GlossyButton style.
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";

interface Student {
  id: string;
  name: string;
  status: Status;
  attendanceHistory?: { date: string; status: Status }[];
}

interface ClassItem {
  id: string;
  name: string;        // "Class 10 - Physics", "JEE 2026 - Maths" etc.
  studentCount: number;
  timeSlot?: string;
  roomNumber?: string;
}

/* ───── ICONS (inline, matching teacher dashboard style) ───── */
const I = {
  Back:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  Star:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  StarOff:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Users:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ChevL:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  ChevR:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Chart:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Check:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Clock:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Search:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Filter:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Undo:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  Save:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Info:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  Alert:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12" y1="17" y2="17.01"/></svg>,
};

/* ───── DEMO DATA ───── */
const DEMO_CLASSES: ClassItem[] = [
  { id: "c1", name: "Class 10 — Physics", studentCount: 42, timeSlot: "9:00 AM - 10:30 AM", roomNumber: "Lab 201" },
  { id: "c2", name: "Class 12 — Chemistry", studentCount: 38, timeSlot: "11:00 AM - 12:30 PM", roomNumber: "Lab 305" },
  { id: "c3", name: "Class 9 — Mathematics", studentCount: 45, timeSlot: "1:00 PM - 2:30 PM", roomNumber: "Room 101" },
  { id: "c4", name: "Class 11 — English", studentCount: 36, timeSlot: "2:30 PM - 4:00 PM", roomNumber: "Room 204" },
  { id: "c5", name: "JEE 2026 — Maths", studentCount: 28, timeSlot: "4:00 PM - 5:30 PM", roomNumber: "Room 305" },
  { id: "c6", name: "NEET 2026 — Biology", studentCount: 32, timeSlot: "5:30 PM - 7:00 PM", roomNumber: "Lab 410" },
];

const STUDENT_NAMES = [
  "Aarav Sharma", "Diya Patel", "Kabir Nair", "Meera Iyer", "Rohan Gupta",
  "Sana Khan", "Vikram Rao", "Priya Singh", "Arjun Reddy", "Ananya Das",
  "Ishaan Joshi", "Kavya Menon", "Rishi Verma", "Tanya Bose", "Nikhil Pandey",
  "Pooja Thakur", "Varun Kapoor", "Shreya Nath", "Amit Saxena", "Neha Agarwal",
  "Rahul Mehta", "Sneha Kulkarni", "Aditya Roy", "Nisha Verma", "Karan Malhotra",
  "Riya Chopra", "Siddharth Jain", "Anushka Rao", "Manav Shah", "Divya Krishnan",
  "Harsh Vardhan", "Ishita Gupta", "Pranav Desai", "Tanvi Kaur", "Yash Raj",
  "Zoya Sheikh", "Aryan Bansal", "Kriti Sanon", "Lakshya Singh", "Mahi Patel",
  "Naman Arora", "Ojasvi Joshi", "Parth Khanna", "Qasim Ali", "Ritika Sharma",
];

// Generate deterministic random based on index
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const makeStudents = (count: number): Student[] =>
  STUDENT_NAMES.slice(0, count).map((name, i) => {
    const rand = seededRandom(i);
    const statuses: Status[] = ["present", "present", "present", "absent", "leave"];
    return {
      id: `s${i}`,
      name,
      status: statuses[Math.floor(rand * 5)],
      attendanceHistory: generateHistory(rand),
    };
  });

const generateHistory = (seed: number): { date: string; status: Status }[] => {
  const history = [];
  const statuses: Status[] = ["present", "present", "present", "absent", "leave"];
  for (let d = 1; d <= 15; d++) {
    const rand = seededRandom(seed + d * 10);
    history.push({
      date: `2026-08-${String(d).padStart(2, '0')}`,
      status: statuses[Math.floor(rand * 5)],
    });
  }
  return history;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ───── HELPERS ───── */
const statusLabel: Record<Status, string> = { present: "P", absent: "A", leave: "L" };
const statusFullLabel: Record<Status, string> = { present: "Present", absent: "Absent", leave: "On Leave" };
const statusColor: Record<Status, { bg: string; text: string; ring: string; dot: string }> = {
  present: { bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400", dot: "bg-emerald-500" },
  absent:  { bg: "bg-red-500",     text: "text-white", ring: "ring-red-400", dot: "bg-red-500" },
  leave:   { bg: "bg-blue-500",    text: "text-white", ring: "ring-blue-400", dot: "bg-blue-500" },
};
const statusBg: Record<Status, string> = {
  present: "bg-emerald-50 dark:bg-emerald-900/20",
  absent:  "bg-red-50 dark:bg-red-900/20",
  leave:   "bg-blue-50 dark:bg-blue-900/20",
};
const statusBorder: Record<Status, string> = {
  present: "border-l-emerald-500",
  absent:  "border-l-red-500",
  leave:   "border-l-blue-500",
};

/* ═══════════════════════════════════════════════════════════════════
   TOAST NOTIFICATION COMPONENT (Inline)
   ═══════════════════════════════════════════════════════════════════ */
interface Toast {
  id: number;
  message: string;
  type: "success" | "info" | "warning";
}

const ToastStack = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) => {
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-[300] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-pop glass-overlay rounded-[20px] px-4 py-3 flex items-center gap-3 shadow-xl"
        >
          <span className={`shrink-0 ${toast.type === "success" ? "text-emerald-600" : toast.type === "warning" ? "text-amber-600" : "text-blue-600"}`}>
            {toast.type === "success" ? <I.Check /> : toast.type === "warning" ? <I.Alert /> : <I.Info />}
          </span>
          <p className="text-sm font-bold text-slate-800 dark:text-white flex-1">{toast.message}</p>
          <button onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   CONFIRMATION MODAL (Inline)
   ═══════════════════════════════════════════════════════════════════ */
const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Confirm", 
  type = "info" 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  type?: "success" | "warning" | "info";
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-overlay rounded-[32px] p-6 sm:p-8 w-full max-w-md relative z-10 animate-pop">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 ${
            type === "success" ? "bg-emerald-100 text-emerald-600" : 
            type === "warning" ? "bg-amber-100 text-amber-600" : 
            "bg-blue-100 text-blue-600"
          }`}>
            {type === "success" ? <I.Check /> : type === "warning" ? <I.Alert /> : <I.Info />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-[16px] inset-pill border-none font-bold text-sm text-slate-600 dark:text-slate-300 active:scale-95">
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="px-5 py-2.5 rounded-[16px] font-bold text-sm text-white active:scale-95"
            style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function TeacherAttendanceView() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
  const teacherId = user?.id?.slice(0, 6) || "DEMO";

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [originalStudents, setOriginalStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  
  // New UX state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "warning" | "info">("info");
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const openClass = (cls: ClassItem) => {
    setSelectedClass(cls);
    const newStudents = makeStudents(Math.min(cls.studentCount, STUDENT_NAMES.length));
    setStudents(newStudents);
    setOriginalStudents(JSON.parse(JSON.stringify(newStudents)));
    setHasChanges(false);
    setSearchQuery("");
    setStatusFilter("all");
    setLastSaved(null);
    addToast(`Opened ${cls.name}`, "info");
  };

  const goBack = () => {
    if (hasChanges) {
      setConfirmAction(() => () => {
        setSelectedClass(null);
        setHasChanges(false);
      });
      setConfirmTitle("Discard changes?");
      setConfirmMessage("You have unsaved attendance changes. Are you sure you want to go back?");
      setConfirmType("warning");
      setShowConfirm(true);
    } else {
      setSelectedClass(null);
    }
  };

  const markStatus = (studentId: string, status: Status) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status } : s)));
    setHasChanges(true);
  };

  const markAllPresent = () => {
    setConfirmAction(() => () => {
      setStudents((prev) => prev.map((s) => ({ ...s, status: "present" as Status })));
      setHasChanges(true);
      addToast(`Marked all ${students.length} students as present`);
    });
    setConfirmTitle("Mark all present?");
    setConfirmMessage(`This will mark all ${students.length} students as present. You can adjust individual students afterward.`);
    setConfirmType("info");
    setShowConfirm(true);
  };

  const undoChanges = () => {
    if (originalStudents.length > 0) {
      setStudents(JSON.parse(JSON.stringify(originalStudents)));
      setHasChanges(false);
      addToast("Changes reverted", "info");
    }
  };

  const saveAttendance = () => {
    setIsSaving(true);
    setTimeout(() => {
      setOriginalStudents(JSON.parse(JSON.stringify(students)));
      setHasChanges(false);
      setIsSaving(false);
      const now = new Date();
      setLastSaved(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      addToast(`Attendance saved for ${selectedClass?.name}`);
    }, 800);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedClass) return;
      
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges) saveAttendance();
      }
      
      // Escape to go back
      if (e.key === "Escape") {
        goBack();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClass, hasChanges, students]);

  // ── Calendar logic ──
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const startDay = first.getDay();
    const totalDays = last.getDate();
    const cells: (number | null)[] = Array(startDay).fill(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth, calYear]);

  const isToday = (d: number) => {
    const now = new Date();
    return d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  };
  const isSelected = (d: number) =>
    d === selectedDate.getDate() && calMonth === selectedDate.getMonth() && calYear === selectedDate.getFullYear();
  const isWeekend = (d: number) => {
    const day = new Date(calYear, calMonth, d).getDay();
    return day === 0 || day === 6;
  };

  // ── Analytics ──
  const presentCount = students.filter((s) => s.status === "present").length;
  const absentCount = students.filter((s) => s.status === "absent").length;
  const leaveCount = students.filter((s) => s.status === "leave").length;
  const attendancePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  // ── Filtered students for table ──
  const filteredStudents = useMemo(() => {
    let filtered = students;
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }
    
    if (searchQuery.trim()) {
      filtered = filtered.filter((s) => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [students, statusFilter, searchQuery]);

  // ── Student attendance percentage ──
  const getStudentPct = (student: Student) => {
    if (!student.attendanceHistory || student.attendanceHistory.length === 0) return 0;
    const present = student.attendanceHistory.filter((h) => h.status === "present").length;
    return Math.round((present / student.attendanceHistory.length) * 100);
  };

  // ── Save status indicator ──
  const getSaveStatus = () => {
    if (isSaving) return { text: "Saving...", color: "text-amber-600" };
    if (lastSaved) return { text: `Saved at ${lastSaved}`, color: "text-emerald-600" };
    if (hasChanges) return { text: "Unsaved changes", color: "text-amber-600" };
    return { text: "All saved", color: "text-slate-400" };
  };
  const saveStatus = getSaveStatus();

  /* ═══════════════════════════════════════════════════════════
     RENDER: CLASS LIST (no class selected)
     ═══════════════════════════════════════════════════════════ */
  if (!selectedClass) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        
        <div className="space-y-6 sm:space-y-8 animate-pop">
          {/* ── Teacher info + Calendar row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-8">
            {/* Teacher info card */}
            <div className="lg:col-span-2 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 flex flex-col items-center text-center relative group">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-[28px] sm:rounded-[32px] flex items-center justify-center text-white font-black text-3xl shadow-lg mb-4 group-hover:scale-105 transition-transform"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{displayName}</h3>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Teacher ID: T-{teacherId}</p>
              <p className="text-sm text-slate-500 font-medium">Department: Science</p>

              {/* Rating with tooltip */}
              <div className="flex items-center gap-1 mt-4 group/rating relative">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`${n <= 4 ? "text-amber-400" : "text-slate-300 dark:text-slate-600"} transition-transform hover:scale-110`}>
                    {n <= 4 ? <I.Star /> : <I.StarOff />}
                  </span>
                ))}
                <span className="text-xs font-bold text-slate-500 ml-1">4.0</span>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover/rating:opacity-100 transition-opacity whitespace-nowrap">
                  Based on 128 reviews
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 inset-pill border-none rounded-[20px] px-5 py-2.5 hover:scale-105 transition-transform">
                <I.Users />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{DEMO_CLASSES.length} classes assigned</span>
              </div>
              
              {/* Quick summary */}
              <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                <div className="inset-pill border-none rounded-[16px] px-3 py-2">
                  <span className="block text-lg font-black text-emerald-600">412</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Students</span>
                </div>
                <div className="inset-pill border-none rounded-[16px] px-3 py-2">
                  <span className="block text-lg font-black text-blue-600">87.5%</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Avg. Attendance</span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="lg:col-span-3 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span style={{ color: "var(--theme-start)" }}><I.Calendar /></span> Calendar
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { 
                      if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } 
                      else setCalMonth(calMonth - 1); 
                    }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    title="Previous month"
                  >
                    <I.ChevL />
                  </button>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[110px] text-center">
                    {MONTHS_SHORT[calMonth]} {calYear}
                  </span>
                  <button 
                    onClick={() => { 
                      if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } 
                      else setCalMonth(calMonth + 1); 
                    }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    title="Next month"
                  >
                    <I.ChevR />
                  </button>
                  <button 
                    onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); setSelectedDate(new Date()); }}
                    className="ml-2 px-3 py-1.5 rounded-xl inset-pill border-none text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                    title="Go to today"
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {DAYS.map((d) => (
                  <div key={d} className="text-[11px] font-black text-slate-400 uppercase tracking-wider py-1">{d}</div>
                ))}
                {calDays.map((d, i) => {
                  if (d === null) return <div key={i} className="h-9 sm:h-10" />;
                  
                  const isSel = isSelected(d);
                  const isTdy = isToday(d);
                  const isWknd = isWeekend(d);
                  
                  // Demo attendance indicator dot
                  const hasAttendance = d <= new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
                  const demoStatus = d % 3 === 0 ? "present" : d % 3 === 1 ? "absent" : "leave";
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(new Date(calYear, calMonth, d))}
                      className={`relative h-9 sm:h-10 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        isSel ? "text-white shadow-md" :
                        isTdy ? "inset-pill border-none text-slate-800 dark:text-white ring-2" :
                        isWknd ? "text-slate-400 dark:text-slate-500" :
                        "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      style={
                        isSel
                          ? { background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }
                          : isTdy
                          ? { ["--tw-ring-color" as any]: "var(--theme-start)" }
                          : undefined
                      }
                      title={`${DAYS_FULL[new Date(calYear, calMonth, d).getDay()]}, ${d} ${MONTHS[calMonth]} ${calYear}`}
                    >
                      {d}
                      {hasAttendance && (
                        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${statusColor[demoStatus as Status].dot}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 inset-pill border-none rounded-[20px] px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {DAYS_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isToday(selectedDate.getDate()) && selectedDate.getMonth() === new Date().getMonth() ? "Today" : ""}
                </span>
              </div>
              
              {/* Calendar legend */}
              <div className="mt-3 flex items-center gap-4 justify-center">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Absent
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Leave
                </span>
              </div>
            </div>
          </div>

          {/* ── Assigned classes grid ── */}
          <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Assigned classes
              </h3>
              <span className="text-xs font-bold text-slate-400 inset-pill border-none px-4 py-2 rounded-full">
                {DEMO_CLASSES.length} total
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {DEMO_CLASSES.map((cls, idx) => (
                <button
                  key={cls.id}
                  onClick={() => openClass(cls)}
                  className="group glass-panel rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 text-left hover:-translate-y-1 transition-all active:scale-[0.98] relative overflow-hidden"
                  title={`Open attendance for ${cls.name}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-110 transition-transform"
                      style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}
                    >
                      {cls.name.split("—")[0]?.trim().replace("Class ", "C") || "C"}
                    </div>
                    <span className="text-xs font-bold text-slate-400 inset-pill border-none px-3 py-1 rounded-full flex items-center gap-1">
                      <I.Users /> {cls.studentCount}
                    </span>
                  </div>
                  
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight truncate group-hover:text-[var(--theme-start)] transition-colors">
                    {cls.name}
                  </h4>
                  
                  {cls.timeSlot && (
                    <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                      <I.Clock /> {cls.timeSlot}
                    </p>
                  )}
                  {cls.roomNumber && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Room: {cls.roomNumber}
                    </p>
                  )}
                  
                  <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1">
                    Tap to view attendance sheet 
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: ATTENDANCE SHEET (class selected)
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
        type={confirmType}
      />
      
      <div className="space-y-6 sm:space-y-8 animate-pop">
        {/* ── Header bar with breadcrumb ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={goBack}
            className="p-2.5 rounded-[16px] inset-pill border-none text-slate-600 dark:text-slate-300 active:scale-95 transition-transform hover:scale-105"
            title="Back to classes (Esc)"
          >
            <I.Back />
          </button>
          
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              <button onClick={goBack} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Attendance
              </button>
              <span>›</span>
              <span className="text-slate-600 dark:text-slate-300">{selectedClass.name}</span>
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {selectedClass.name}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {DAYS_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {students.length} students
              {selectedClass.timeSlot && ` · ${selectedClass.timeSlot}`}
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={undoChanges}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[16px] inset-pill border-none font-bold text-sm text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-800 dark:hover:text-white transition-colors"
              title="Undo changes"
            >
              <I.Undo /> <span className="hidden sm:inline">Undo</span>
            </button>
            
            <button
              onClick={markAllPresent}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[16px] inset-pill border-none font-bold text-sm text-slate-600 dark:text-slate-300 active:scale-95 hover:text-slate-800 dark:hover:text-white transition-colors"
              title="Mark all students as present"
            >
              <I.Check /> <span className="hidden sm:inline">All Present</span>
            </button>
            
            <button
              onClick={saveAttendance}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[16px] font-bold text-sm text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110"
              style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
              title="Save attendance (Ctrl+S)"
            >
              {isSaving ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <I.Save />
              )}
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>
        
        {/* Save status indicator */}
        <div className={`text-xs font-bold ${saveStatus.color} flex items-center gap-1.5 -mt-4`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {saveStatus.text}
          {hasChanges && !isSaving && (
            <span className="text-slate-400 font-medium">({students.length - originalStudents.filter((o, i) => o.status === students[i]?.status).length} changed)</span>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[
            { label: "Present", value: presentCount, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "●" },
            { label: "Absent", value: absentCount, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", icon: "●" },
            { label: "On leave", value: leaveCount, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", icon: "●" },
            { label: "Attendance %", value: `${attendancePct}%`, color: "", bg: "", icon: "📊" },
          ].map((s, i) => (
            <div 
              key={i} 
              className="glass-panel rounded-[24px] sm:rounded-[32px] p-4 sm:p-5 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform cursor-default"
              title={`${s.label}: ${s.value}`}
            >
              <span className={`text-3xl sm:text-4xl font-black ${s.color || "text-slate-900 dark:text-white"}`}>
                {s.value}
              </span>
              <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Excel-like attendance table ── */}
        <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-4 sm:p-6 overflow-x-auto">
          {/* Table toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {/* Search */}
            <div className="flex items-center gap-2 inset-pill border-none rounded-[16px] px-3 py-2 flex-1 min-w-[150px] max-w-xs">
              <span className="text-slate-400"><I.Search /></span>
              <input
                type="text"
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white placeholder-slate-400 w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400"><I.Filter /></span>
              {(["all", "present", "absent", "leave"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-[12px] text-xs font-bold transition-all active:scale-95 ${
                    statusFilter === f
                      ? "text-white shadow-sm"
                      : "inset-pill border-none text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  style={statusFilter === f ? { background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` } : undefined}
                >
                  {f === "all" ? "All" : statusFullLabel[f]}
                </button>
              ))}
            </div>
          </div>
          
          {/* Results count */}
          {filteredStudents.length !== students.length && (
            <p className="text-xs font-bold text-slate-400 mb-2">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          )}
          
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3 pl-3 w-12">#</th>
                <th className="text-left text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3">Student name</th>
                <th className="text-center text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3 w-52">Status</th>
                <th className="text-center text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3 w-16">%</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, idx) => {
                const pct = getStudentPct(student);
                const isHovered = hoveredStudent === student.id;
                return (
                  <tr
                    key={student.id}
                    className={`border-t border-slate-100 dark:border-white/5 transition-all ${statusBg[student.status]} ${isHovered ? "bg-opacity-80" : ""}`}
                    onMouseEnter={() => setHoveredStudent(student.id)}
                    onMouseLeave={() => setHoveredStudent(null)}
                  >
                    <td className="py-3 pl-3 text-sm font-bold text-slate-400">
                      <span className="flex items-center gap-2">
                        {idx + 1}
                        {/* Status color indicator */}
                        <span className={`w-1 h-8 rounded-full ${statusColor[student.status].dot} opacity-70`} />
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white text-xs font-black shrink-0"
                          style={{ background: `hsl(${(students.indexOf(student) * 37) % 360}, 55%, 52%)` }}
                        >
                          {student.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-slate-800 dark:text-white truncate block">{student.name}</span>
                          <span className="text-[10px] font-medium text-slate-400 block">Roll: {students.indexOf(student) + 1}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-center gap-2">
                        {(["present", "absent", "leave"] as Status[]).map((s) => {
                          const active = student.status === s;
                          const c = statusColor[s];
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                markStatus(student.id, s);
                                if (student.status !== s) {
                                  addToast(`${student.name} marked as ${statusFullLabel[s]}`, s === "present" ? "success" : s === "absent" ? "warning" : "info");
                                }
                              }}
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] font-black text-sm transition-all active:scale-90 ${
                                active
                                  ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring} scale-105`
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105"
                              }`}
                              title={`Mark as ${statusFullLabel[s]}`}
                            >
                              {statusLabel[s]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-sm font-extrabold ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {pct}%
                      </span>
                      <span className="block text-[9px] font-bold text-slate-400">overall</span>
                    </td>
                  </tr>
                );
              })}
              
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <p className="text-slate-400 font-bold text-sm">No students found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Class Analytics ── */}
        <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-[16px] inset-pill border-none flex items-center justify-center" style={{ color: "var(--theme-start)" }}>
              <I.Chart />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Class analytics</h3>
          </div>

          {/* Visual bar breakdown */}
          <div className="space-y-4">
            {/* Attendance bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">Today's attendance</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-white">{attendancePct}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex group/bar cursor-pointer" title={`${presentCount} present, ${leaveCount} leave, ${absentCount} absent`}>
                {students.length > 0 && (
                  <>
                    <div className="h-full bg-emerald-500 transition-all group-hover/bar:brightness-110" style={{ width: `${(presentCount / students.length) * 100}%` }} />
                    <div className="h-full bg-blue-500 transition-all group-hover/bar:brightness-110" style={{ width: `${(leaveCount / students.length) * 100}%` }} />
                    <div className="h-full bg-red-500 transition-all group-hover/bar:brightness-110" style={{ width: `${(absentCount / students.length) * 100}%` }} />
                  </>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Present", count: presentCount, color: "bg-emerald-500" },
                { label: "Absent", count: absentCount, color: "bg-red-500" },
                { label: "On leave", count: leaveCount, color: "bg-blue-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 group cursor-default">
                  <span className={`w-3 h-3 rounded-full ${item.color} group-hover:scale-125 transition-transform`} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.label}: {item.count}</span>
                </div>
              ))}
            </div>

            {/* Monthly trend (simple bar chart with hover tooltips) */}
            <div className="mt-4">
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3">Monthly trend</h4>
              <div className="flex items-end gap-2 h-28">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                  const pct = [88, 92, 78, 95, 85, 70][i];
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1 bg-slate-900 text-white px-1.5 py-0.5 rounded-md">
                        {pct}%
                      </span>
                      <div className="w-full rounded-t-lg transition-all group-hover:brightness-110 cursor-pointer" style={{
                        height: `${pct}%`,
                        background: pct >= 85
                          ? "linear-gradient(180deg, #34d399, #10b981)"
                          : pct >= 70
                          ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                          : "linear-gradient(180deg, #f87171, #ef4444)",
                      }} />
                      <span className="text-[10px] font-bold text-slate-400">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Keyboard shortcuts hint */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">Ctrl+S</kbd> Save · <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">Esc</kbd> Back
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}