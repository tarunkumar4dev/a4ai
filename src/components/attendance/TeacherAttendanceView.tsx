// src/components/attendance/TeacherAttendanceView.tsx
// ──────────────────────────────────────────────────────────────────────
// Teacher attendance module — v2 (session-based schema)
//
// Flow: Teacher Info + Calendar
//       → Today's timetable classes (auto) OR pick batch+subject (manual)
//       → Attendance sheet (P/A/Leave per student) → mark_attendance() RPC
//
// Backend: class_sessions + attendance_records (normalized).
//   - get_teacher_today_sessions()  → today's scheduled classes
//   - teaching_assignments          → manual batch+subject picker
//   - get_monthly_attendance()      → real per-student %
//   - mark_attendance()             → saves session + records atomically
// ──────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo,
  useRef,
} from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";

interface Student {
  id: string;
  name: string;
  status: Status;
  pct?: number; // real monthly % for the selected subject
}

// A class the teacher can mark — either from timetable or picked manually
interface SessionTarget {
  batchId: string;
  batchName: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  timetableSlotId?: string | null;
  sessionId?: string | null; // existing session (from timetable) if any
  studentCount?: number;
  timeSlot?: string;
  room?: string;
  isMarked?: boolean;
}

/* ───── CONSTANTS ───── */
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ───── ICONS ───── */
const I = {
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  ChevL: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  ChevR: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  Chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Undo: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  ),
  Save: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  Book: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Spinner: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
};

/* ───── STATUS HELPERS ───── */
const statusLabel: Record<Status, string> = { present: "P", absent: "A", leave: "L" };
const statusFullLabel: Record<Status, string> = { present: "Present", absent: "Absent", leave: "On Leave" };
const statusColor: Record<Status, { bg: string; text: string; ring: string; dot: string }> = {
  present: { bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400", dot: "bg-emerald-500" },
  absent: { bg: "bg-red-500", text: "text-white", ring: "ring-red-400", dot: "bg-red-500" },
  leave: { bg: "bg-blue-500", text: "text-white", ring: "ring-blue-400", dot: "bg-blue-500" },
};
const statusBg: Record<Status, string> = {
  present: "bg-emerald-50/80 dark:bg-emerald-900/20",
  absent: "bg-red-50/80 dark:bg-red-900/20",
  leave: "bg-blue-50/80 dark:bg-blue-900/20",
};

/* ───── DATA HELPERS ───── */
function toDateStr(d: Date) {
  // Local date (not UTC) so "today" matches the teacher's timezone
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ── Toast notification stack ─────────────────────────────── */
type Toast = { id: number; message: string; type?: string };

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)}
          style={{ background: t.type === "error" ? "#7F1D1D" : "#1E293B", color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", cursor: "pointer", pointerEvents: "all", maxWidth: 340, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{t.type === "error" ? "⚠️" : t.type === "info" ? "ℹ️" : "✅"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Modal ─────────────────────────────────────────── */
function ConfirmModal({
  isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", type = "info",
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string;
  type?: "success" | "warning" | "info";
}) {
  if (!isOpen) return null;
  const isWarning = type === "warning";
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-[popIn_0.28s_cubic-bezier(0.16,1,0.3,1)]">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{message}</p>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${isWarning ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Student Row (Desktop) ────────────────────────────────── */
const StudentRow = memo(({
  student, index, onMark,
}: {
  student: Student; index: number; onMark: (id: string, s: Status) => void;
}) => {
  const pct = student.pct ?? 0;
  const initials = student.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  const hue = (index * 37) % 360;

  return (
    <tr className={`border-t border-slate-100/80 dark:border-white/5 transition-colors duration-150 ${statusBg[student.status]}`}>
      <td className="py-2.5 sm:py-3 pl-2 sm:pl-3 text-sm font-bold text-slate-400 w-10 sm:w-12">
        <span className="flex items-center gap-1.5 sm:gap-2">
          {index + 1}
          <span className={`w-1 h-6 sm:h-8 rounded-full ${statusColor[student.status].dot} opacity-70`} />
        </span>
      </td>
      <td className="py-2.5 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white text-[11px] font-black shrink-0" style={{ background: `hsl(${hue}, 55%, 52%)` }}>
            {initials}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-[13px] sm:text-sm text-slate-800 dark:text-white truncate block">{student.name}</span>
          </div>
        </div>
      </td>
      <td className="py-2.5 sm:py-3">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          {(["present", "absent", "leave"] as Status[]).map((s) => {
            const active = student.status === s;
            const c = statusColor[s];
            return (
              <button
                key={s}
                onClick={() => onMark(student.id, s)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black text-[13px] sm:text-sm transition-all duration-150 active:scale-90 touch-manipulation ${
                  active ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring} scale-105`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title={`Mark as ${statusFullLabel[s]}`}
                aria-pressed={active}
              >
                {statusLabel[s]}
              </button>
            );
          })}
        </div>
      </td>
      <td className="py-2.5 sm:py-3 text-center w-14 sm:w-16">
        <span className={`text-[13px] sm:text-sm font-extrabold ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
          {pct}%
        </span>
        <span className="block text-[9px] font-bold text-slate-400">month</span>
      </td>
    </tr>
  );
});
StudentRow.displayName = "StudentRow";

/* ── Student Card (Mobile) ────────────────────────────────── */
const StudentCard = memo(({
  student, index, onMark,
}: {
  student: Student; index: number; onMark: (id: string, s: Status) => void;
}) => {
  const pct = student.pct ?? 0;
  const initials = student.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  const hue = (index * 37) % 360;

  return (
    <div className={`rounded-2xl p-3.5 border border-slate-100/80 dark:border-white/5 transition-colors duration-150 ${statusBg[student.status]}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0" style={{ background: `hsl(${hue}, 55%, 52%)` }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] text-slate-800 dark:text-white truncate">{student.name}</p>
          <p className="text-[11px] font-medium text-slate-400">
            #{index + 1} ·{" "}
            <span className={pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}>{pct}% this month</span>
          </p>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor[student.status].dot}`} />
      </div>
      <div className="flex gap-2">
        {(["present", "absent", "leave"] as Status[]).map((s) => {
          const active = student.status === s;
          const c = statusColor[s];
          return (
            <button
              key={s}
              onClick={() => onMark(student.id, s)}
              className={`flex-1 h-11 rounded-xl font-black text-sm transition-all duration-150 active:scale-[0.96] touch-manipulation ${
                active ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring}`
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
              aria-pressed={active}
            >
              {statusFullLabel[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
});
StudentCard.displayName = "StudentCard";

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function TeacherAttendanceView() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";

  const [selected, setSelected] = useState<SessionTarget | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [originalStudents, setOriginalStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());

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
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [todaySessions, setTodaySessions] = useState<SessionTarget[]>([]);
  const [assignments, setAssignments] = useState<SessionTarget[]>([]); // manual picker options
  const [loading, setLoading] = useState(true);

  // Manual picker state
  const [pickBatchId, setPickBatchId] = useState("");
  const [pickSubjectId, setPickSubjectId] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Load institute + today's sessions + teaching assignments ──
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: mem } = await supabase
        .from("institute_members").select("institute_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).single();
      if (!mem) { setLoading(false); return; }
      setInstituteId(mem.institute_id);

      const dateStr = toDateStr(selectedDate);

      // Today's timetable-scheduled sessions
      const { data: sessRows } = await supabase.rpc("get_teacher_today_sessions", {
        p_institute_id: mem.institute_id,
        p_date: dateStr,
      });
      setTodaySessions(
        (sessRows || []).map((r: any): SessionTarget => ({
          batchId: r.batch_id,
          batchName: r.batch_name,
          subjectId: r.subject_id,
          subjectName: r.subject_name,
          subjectCode: r.subject_code,
          timetableSlotId: r.timetable_slot_id,
          sessionId: r.session_id,
          studentCount: Number(r.student_count) || 0,
          timeSlot: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
          room: r.room || undefined,
          isMarked: r.is_marked,
        }))
      );

      // Teaching assignments (manual picker: batch + subject options)
      const { data: taRows } = await supabase
        .from("teaching_assignments")
        .select("batch_id, subject_id, batches(name), subjects(name, code)")
        .eq("teacher_id", user.id)
        .eq("institute_id", mem.institute_id)
        .eq("is_active", true);
      setAssignments(
        (taRows || []).map((r: any): SessionTarget => ({
          batchId: r.batch_id,
          batchName: r.batches?.name || "Batch",
          subjectId: r.subject_id,
          subjectName: r.subjects?.name || "Subject",
          subjectCode: r.subjects?.code,
        }))
      );
    } catch (e) {
      console.error("loadData:", e);
      addToast("Failed to load classes", "error");
    }
    setLoading(false);
  }, [user?.id, selectedDate, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Distinct batches for manual picker dropdown
  const pickBatches = useMemo(() => {
    const seen = new Map<string, string>();
    assignments.forEach(a => { if (!seen.has(a.batchId)) seen.set(a.batchId, a.batchName); });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [assignments]);

  // Subjects available for the chosen batch
  const pickSubjects = useMemo(
    () => assignments.filter(a => a.batchId === pickBatchId),
    [assignments, pickBatchId]
  );

  // ── Open a class (from timetable card OR manual pick) ──
  const openSession = useCallback(async (target: SessionTarget) => {
    setSelected(target);
    setStudents([]);
    setHasChanges(false);
    setSearchQuery("");
    setStatusFilter("all");
    setLastSaved(null);
    setIsLoadingSheet(true);
    try {
      const dateStr = toDateStr(selectedDate);

      // 1. Students of the batch
      const { data: stuRows } = await supabase
        .from("students").select("id, name, roll_no")
        .eq("batch_id", target.batchId).eq("is_active", true).order("roll_no");
      if (!stuRows || stuRows.length === 0) {
        addToast(`${target.batchName} has no students yet`, "info");
        setOriginalStudents([]);
        setIsLoadingSheet(false);
        return;
      }

      // 2. Existing attendance for this session (if already marked)
      let sessionId = target.sessionId ?? null;
      if (!sessionId) {
        const { data: sess } = await supabase
          .from("class_sessions").select("id")
          .eq("batch_id", target.batchId)
          .eq("subject_id", target.subjectId)
          .eq("session_date", dateStr)
          .eq("teacher_id", user?.id)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        sessionId = sess?.id ?? null;
      }
      const savedRecords: Record<string, Status> = {};
      if (sessionId) {
        const { data: recs } = await supabase
          .from("attendance_records").select("student_id, status")
          .eq("session_id", sessionId);
        recs?.forEach((r: any) => { savedRecords[r.student_id] = r.status as Status; });
      }

      // 3. Real monthly % per student for this subject
      const pctMap: Record<string, number> = {};
      try {
        const { data: monthly } = await supabase.rpc("get_monthly_attendance", {
          p_batch_id: target.batchId,
          p_month: selectedDate.getMonth() + 1,
          p_year: selectedDate.getFullYear(),
          p_subject_id: target.subjectId,
        });
        monthly?.forEach((m: any) => { pctMap[m.student_id] = Number(m.percentage) || 0; });
      } catch { /* non-fatal */ }

      const loaded: Student[] = stuRows.map((s: any) => ({
        id: s.id,
        name: s.name + (s.roll_no ? ` (${s.roll_no})` : ""),
        status: savedRecords[s.id] || "present",
        pct: pctMap[s.id] ?? 0,
      }));
      setStudents(loaded);
      setOriginalStudents(JSON.parse(JSON.stringify(loaded)));
      addToast(
        `${target.batchName} · ${target.subjectName} — ${loaded.length} students${sessionId ? " (already marked)" : ""}`,
        "info"
      );
    } catch (e) {
      console.error("openSession:", e);
      addToast("Failed to load students", "error");
    }
    setIsLoadingSheet(false);
  }, [addToast, selectedDate, user?.id]);

  const openManual = useCallback(() => {
    const target = assignments.find(a => a.batchId === pickBatchId && a.subjectId === pickSubjectId);
    if (!target) { addToast("Pick a batch and subject first", "info"); return; }
    openSession(target);
  }, [assignments, pickBatchId, pickSubjectId, openSession, addToast]);

  const goBack = useCallback(() => {
    if (hasChanges) {
      setConfirmAction(() => () => { setSelected(null); setHasChanges(false); });
      setConfirmTitle("Discard changes?");
      setConfirmMessage("You have unsaved attendance changes. Go back anyway?");
      setConfirmType("warning");
      setShowConfirm(true);
    } else {
      setSelected(null);
      loadData(); // refresh marked-status on the landing
    }
  }, [hasChanges, loadData]);

  const markStatus = useCallback((studentId: string, status: Status) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status } : s)));
    setHasChanges(true);
  }, []);

  const markAllPresent = useCallback(() => {
    setConfirmAction(() => () => {
      setStudents((prev) => prev.map((s) => ({ ...s, status: "present" as Status })));
      setHasChanges(true);
      addToast(`Marked all ${students.length} students present`);
    });
    setConfirmTitle("Mark all present?");
    setConfirmMessage(`All ${students.length} students will be marked present. Adjust individuals after.`);
    setConfirmType("info");
    setShowConfirm(true);
  }, [students.length, addToast]);

  const undoChanges = useCallback(() => {
    if (originalStudents.length > 0) {
      setStudents(JSON.parse(JSON.stringify(originalStudents)));
      setHasChanges(false);
      addToast("Changes reverted", "info");
    }
  }, [originalStudents, addToast]);

  const saveAttendance = useCallback(async () => {
    if (!selected || !instituteId) return;
    setIsSaving(true);
    try {
      const dateStr = toDateStr(selectedDate);
      const records = students.map(s => ({ student_id: s.id, status: s.status }));
      const { data, error } = await supabase.rpc("mark_attendance", {
        p_institute_id: instituteId,
        p_batch_id: selected.batchId,
        p_subject_id: selected.subjectId,
        p_session_date: dateStr,
        p_timetable_slot_id: selected.timetableSlotId ?? null,
        p_topic: null,
        p_records: records,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOriginalStudents(JSON.parse(JSON.stringify(students)));
      setHasChanges(false);
      setLastSaved(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      addToast(`Saved — ${selected.subjectName} attendance for ${selected.batchName}`);
    } catch (e: any) {
      addToast(e.message || "Save failed", "error");
    }
    setIsSaving(false);
  }, [students, selected, addToast, selectedDate, instituteId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !isSaving) saveAttendance();
      }
      if (e.key === "Escape") goBack();
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, hasChanges, isSaving, saveAttendance, goBack]);

  // Calendar
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

  const isToday = useCallback((d: number) => {
    const now = new Date();
    return d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  }, [calMonth, calYear]);

  const isSelected = useCallback((d: number) =>
    d === selectedDate.getDate() && calMonth === selectedDate.getMonth() && calYear === selectedDate.getFullYear(),
  [selectedDate, calMonth, calYear]);

  const isWeekend = useCallback((d: number) => {
    const day = new Date(calYear, calMonth, d).getDay();
    return day === 0 || day === 6;
  }, [calMonth, calYear]);

  // ─── FIX: Future date check ───────────────────────────────
  const isFutureDate = useCallback((d: number) => {
    const clicked = new Date(calYear, calMonth, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clicked > today;
  }, [calYear, calMonth]);

  // Analytics (current sheet)
  const presentCount = useMemo(() => students.filter((s) => s.status === "present").length, [students]);
  const absentCount = useMemo(() => students.filter((s) => s.status === "absent").length, [students]);
  const leaveCount = useMemo(() => students.filter((s) => s.status === "leave").length, [students]);
  const attendancePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (statusFilter !== "all") filtered = filtered.filter((s) => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [students, statusFilter, searchQuery]);

  const saveStatus = useMemo(() => {
    if (isSaving) return { text: "Saving…", color: "text-amber-600" };
    if (lastSaved) return { text: `Saved at ${lastSaved}`, color: "text-emerald-600" };
    if (hasChanges) return { text: "Unsaved changes", color: "text-amber-600" };
    return { text: "All saved", color: "text-slate-400" };
  }, [isSaving, lastSaved, hasChanges]);

  const changedCount = useMemo(() => {
    if (!hasChanges || originalStudents.length === 0) return 0;
    return students.reduce((acc, s, i) => (s.status !== originalStudents[i]?.status ? acc + 1 : acc), 0);
  }, [students, originalStudents, hasChanges]);

  const totalStudents = useMemo(() => {
    const seen = new Set<string>();
    let sum = 0;
    [...todaySessions, ...assignments].forEach(a => {
      if (!seen.has(a.batchId)) { seen.add(a.batchId); sum += a.studentCount || 0; }
    });
    return sum;
  }, [todaySessions, assignments]);

  /* ═══════════════════════════════════════════════════════════
     RENDER: LANDING (today's classes + manual pick)
     ═══════════════════════════════════════════════════════════ */
  if (!selected) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes popIn { from { opacity:0; transform:scale(0.96) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
            @media (prefers-reduced-motion: reduce) { [class*="animate-"] { animation: none !important; } }
          `
        }} />
        <div className="space-y-5 sm:space-y-8 animate-[popIn_0.35s_cubic-bezier(0.16,1,0.3,1)]">
          {/* Teacher info + Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            <div className="lg:col-span-2 glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-[22px] sm:rounded-[28px] lg:rounded-[32px] flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg mb-3 sm:mb-4"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{displayName}</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Teacher</p>

              <div className="mt-4 flex items-center gap-2 inset-pill border-none rounded-2xl px-4 py-2 sm:px-5 sm:py-2.5">
                <I.Book />
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                  {loading ? "Loading…" : `${assignments.length} ${assignments.length !== 1 ? "classes" : "class"} assigned`}
                </span>
              </div>

              <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 w-full">
                <div className="inset-pill border-none rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <span className="block text-base sm:text-lg font-black text-emerald-600">{totalStudents || "—"}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Students</span>
                </div>
                <div className="inset-pill border-none rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <span className="block text-base sm:text-lg font-black text-blue-600">{todaySessions.length}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide">Today's Classes</span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="lg:col-span-3 glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
              <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
                <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span style={{ color: "var(--theme-start)" }}><I.Calendar /></span>
                  <span className="hidden xs:inline">Calendar</span>
                </h3>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 transition-transform touch-manipulation" aria-label="Previous month"><I.ChevL /></button>
                  <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[88px] sm:min-w-[110px] text-center tabular-nums">
                    {MONTHS_SHORT[calMonth]} {calYear}
                  </span>
                  <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 transition-transform touch-manipulation" aria-label="Next month"><I.ChevR /></button>
                  <button onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); setSelectedDate(new Date()); }}
                    className="ml-1 px-2.5 py-1.5 rounded-xl inset-pill border-none text-[11px] sm:text-xs font-bold text-slate-500 active:scale-95 transition-transform touch-manipulation">Today</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center">
                {DAYS.map((d) => (
                  <div key={d} className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider py-0.5 sm:py-1">{d}</div>
                ))}
                {calDays.map((d, i) => {
                  if (d === null) return <div key={i} className="h-8 sm:h-9 lg:h-10" />;
                  
                  const isSel = isSelected(d);
                  const isTdy = isToday(d);
                  const isWknd = isWeekend(d);
                  const isFuture = isFutureDate(d);
                  
                  // ─── FIX: Future dates are not clickable ──────
                  const handleClick = () => {
                    if (isFuture) return; // future date click = ignore
                    setSelectedDate(new Date(calYear, calMonth, d));
                  };

                  return (
                    <button 
                      key={i} 
                      onClick={handleClick}
                      disabled={isFuture}
                      className={`relative h-8 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 active:scale-95 touch-manipulation ${
                        isFuture 
                          ? "opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-500" 
                          : isSel 
                            ? "text-white shadow-md" 
                            : isTdy 
                              ? "inset-pill border-none text-slate-800 dark:text-white ring-2" 
                              : isWknd 
                                ? "text-slate-400 dark:text-slate-500" 
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      style={isSel && !isFuture 
                        ? { background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" } 
                        : isTdy && !isFuture 
                          ? ({ ["--tw-ring-color" as string]: "var(--theme-start)" } as React.CSSProperties) 
                          : undefined}
                      aria-disabled={isFuture}
                    >
                      {d}
                      {/* {isFuture && (
                        <span className="absolute -top-1 -right-1 text-[6px] font-bold text-slate-300">🔒</span>
                      )} */}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 sm:mt-4 inset-pill border-none rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                  {DAYS_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {isToday(selectedDate.getDate()) && selectedDate.getMonth() === new Date().getMonth() && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Today</span>
                )}
              </div>
            </div>
          </div>

          {/* Today's timetable classes */}
          <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white">Today's classes</h3>
              <span className="text-[11px] sm:text-xs font-bold text-slate-400 inset-pill border-none px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shrink-0">
                {todaySessions.length} scheduled
              </span>
            </div>

            {loading ? (
              <p className="text-center py-8 text-slate-400 font-semibold">Loading…</p>
            ) : todaySessions.length === 0 ? (
              <p className="text-center py-6 text-slate-400 font-semibold text-sm">
                No timetable classes for this date. Use "Mark a class" below to pick manually.
              </p>
            ) : (
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {todaySessions.map((s, idx) => (
                  <button key={s.sessionId || idx} onClick={() => openSession(s)}
                    className="group glass-panel rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] p-4 sm:p-5 lg:p-6 text-left transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 touch-manipulation will-change-transform">
                    <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] sm:rounded-[14px] flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-sm"
                        style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
                        {s.subjectCode?.slice(0, 3) || s.batchName.slice(0, 2)}
                      </div>
                      {s.isMarked ? (
                        <span className="text-[10px] font-bold text-emerald-600 inset-pill border-none px-2.5 py-1 rounded-full flex items-center gap-1"><I.Check /> Marked</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 inset-pill border-none px-2.5 py-1 rounded-full">Pending</span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-[15px] sm:text-base tracking-tight truncate group-hover:text-[var(--theme-start)] transition-colors">
                      {s.subjectName}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 truncate">{s.batchName}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-medium">
                      {s.timeSlot && <span className="flex items-center gap-1"><I.Clock /> {s.timeSlot}</span>}
                      <span className="flex items-center gap-1"><I.Users /> {s.studentCount}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual pick */}
          <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-1">Mark a class</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4">Pick a batch and subject to mark attendance manually.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={pickBatchId} onChange={(e) => { setPickBatchId(e.target.value); setPickSubjectId(""); }}
                className="inset-pill border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none">
                <option value="">Select batch…</option>
                {pickBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={pickSubjectId} onChange={(e) => setPickSubjectId(e.target.value)} disabled={!pickBatchId}
                className="inset-pill border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none disabled:opacity-40">
                <option value="">Select subject…</option>
                {pickSubjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}{s.subjectCode ? ` (${s.subjectCode})` : ""}</option>)}
              </select>
              <button onClick={openManual} disabled={!pickBatchId || !pickSubjectId}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
                Open sheet →
              </button>
            </div>
            {assignments.length === 0 && !loading && (
              <p className="text-center py-4 mt-2 text-slate-400 font-semibold text-sm">
                No classes assigned to you yet. Ask your admin to set up teaching assignments.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: ATTENDANCE SHEET
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={confirmAction}
        title={confirmTitle} message={confirmMessage} type={confirmType} />
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes popIn { from { opacity:0; transform:scale(0.96) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
          @media (prefers-reduced-motion: reduce) { [class*="animate-"] { animation: none !important; } }
        `
      }} />

      <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1 sm:static sm:mx-0 sm:px-0 sm:py-0 backdrop-blur-md sm:backdrop-blur-none">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-wrap">
            <button onClick={goBack} className="p-2.5 rounded-2xl inset-pill border-none text-slate-600 dark:text-slate-300 active:scale-95 transition-transform touch-manipulation shrink-0" title="Back (Esc)" aria-label="Back"><I.Back /></button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-1 truncate">
                <button onClick={goBack} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Attendance</button>
                <span>›</span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{selected.subjectName}</span>
              </p>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {selected.subjectName} <span className="text-slate-400 font-bold">· {selected.batchName}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                {DAYS_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {students.length} students
                {selected.timeSlot && ` · ${selected.timeSlot}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
              <button onClick={undoChanges} disabled={!hasChanges}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl inset-pill border-none font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation" title="Undo"><I.Undo /> <span className="hidden xs:inline">Undo</span></button>
              <button onClick={markAllPresent}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl inset-pill border-none font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 active:scale-95 transition-all touch-manipulation" title="Mark all present"><I.Check /> <span className="hidden xs:inline">All Present</span></button>
              <button onClick={saveAttendance} disabled={!hasChanges || isSaving}
                className="flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }} title="Save (Ctrl+S)">
                {isSaving ? <I.Spinner /> : <I.Save />}<span>{isSaving ? "Saving…" : "Save"}</span>
              </button>
            </div>
          </div>
          <div className={`text-[11px] sm:text-xs font-bold ${saveStatus.color} flex items-center gap-1.5 mt-1.5 sm:mt-2`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            {saveStatus.text}
            {hasChanges && !isSaving && changedCount > 0 && (<span className="text-slate-400 font-medium">({changedCount} changed)</span>)}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
          {[
            { label: "Present", value: presentCount, color: "text-emerald-600" },
            { label: "Absent", value: absentCount, color: "text-red-600" },
            { label: "On leave", value: leaveCount, color: "text-blue-600" },
            { label: "Attendance %", value: `${attendancePct}%`, color: "text-slate-900 dark:text-white" },
          ].map((s, i) => (
            <div key={i} className="glass-panel rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] p-3.5 sm:p-4 lg:p-5 flex flex-col items-center text-center transition-transform duration-200 hover:-translate-y-0.5">
              <span className={`text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[9px] sm:text-[10px] lg:text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Table / Cards */}
        <div className="glass-panel rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] p-3.5 sm:p-5 lg:p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 inset-pill border-none rounded-2xl px-3 py-2 flex-1 min-w-0">
              <span className="text-slate-400 shrink-0"><I.Search /></span>
              <input ref={searchInputRef} type="search" placeholder="Search student…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white placeholder-slate-400 w-full min-w-0" autoComplete="off" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0" aria-label="Clear search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
              <span className="text-slate-400 shrink-0 ml-0.5"><I.Filter /></span>
              {(["all", "present", "absent", "leave"] as const).map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 touch-manipulation whitespace-nowrap shrink-0 ${statusFilter === f ? "text-white shadow-sm" : "inset-pill border-none text-slate-500"}`}
                  style={statusFilter === f ? { background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` } : undefined}>
                  {f === "all" ? "All" : statusFullLabel[f]}
                </button>
              ))}
            </div>
          </div>

          {filteredStudents.length !== students.length && (
            <p className="text-[11px] sm:text-xs font-bold text-slate-400 mb-2">Showing {filteredStudents.length} of {students.length}</p>
          )}

          {isLoadingSheet ? (
            <p className="text-center py-10 text-slate-400 font-semibold">Loading students…</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest pb-2.5 pl-2 sm:pl-3 w-10 sm:w-12">#</th>
                      <th className="text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest pb-2.5">Student</th>
                      <th className="text-center text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest pb-2.5 w-44 sm:w-52">Status</th>
                      <th className="text-center text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest pb-2.5 w-14 sm:w-16">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <StudentRow key={student.id} student={student} index={students.indexOf(student)} onMark={markStatus} />
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={4} className="py-10 text-center">
                        <p className="text-slate-400 font-bold text-sm">No students found</p>
                        <p className="text-slate-400 text-xs mt-1">Try adjusting search or filter</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2.5">
                {filteredStudents.map((student) => (
                  <StudentCard key={student.id} student={student} index={students.indexOf(student)} onMark={markStatus} />
                ))}
                {filteredStudents.length === 0 && (
                  <div className="py-10 text-center">
                    <p className="text-slate-400 font-bold text-sm">No students found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting search or filter</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Analytics (today's sheet only — real numbers) */}
        <div className="glass-panel rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl inset-pill border-none flex items-center justify-center" style={{ color: "var(--theme-start)" }}><I.Chart /></div>
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white">Today's breakdown</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500">Present rate</span>
                <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-white tabular-nums">{attendancePct}%</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                {students.length > 0 && (
                  <>
                    <div className="h-full bg-emerald-500 transition-[width] duration-500 ease-out" style={{ width: `${(presentCount / students.length) * 100}%` }} />
                    <div className="h-full bg-blue-500 transition-[width] duration-500 ease-out" style={{ width: `${(leaveCount / students.length) * 100}%` }} />
                    <div className="h-full bg-red-500 transition-[width] duration-500 ease-out" style={{ width: `${(absentCount / students.length) * 100}%` }} />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {[
                { label: "Present", count: presentCount, color: "bg-emerald-500" },
                { label: "Absent", count: absentCount, color: "bg-red-500" },
                { label: "On leave", count: leaveCount, color: "bg-blue-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">{item.label}: {item.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                Shortcuts: <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">Ctrl+S</kbd> Save ·{" "}
                <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">Esc</kbd> Back ·{" "}
                <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">Ctrl+F</kbd> Search
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}