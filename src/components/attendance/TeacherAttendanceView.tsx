// src/components/attendance/TeacherAttendanceView.tsx
// ──────────────────────────────────────────────────────────────────────
// Teacher attendance module — HIGH-UX · RESPONSIVE · BUTTERY SMOOTH
// Render as: {activeTab === "attendance" && <TeacherAttendanceView />}
//
// Flow: Teacher Info + Calendar + Assigned Classes grid
//       → click a class → Excel-like attendance sheet
//         (serial, name, Red/Green/Blue status buttons, attendance %)
//       + Class analytics (present/absent/leave counts, monthly trend)
//
// Optimised: memoised rows, touch-friendly targets, mobile card view,
// sticky toolbar, reduced motion respect, GPU-friendly transitions.
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
  attendanceHistory?: { date: string; status: Status }[];
}

interface ClassItem {
  id: string;
  name: string;
  studentCount: number;
  timeSlot?: string;
  roomNumber?: string;
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
  Star: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  StarOff: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  Alert: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12" y1="17" y2="17.01" />
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
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

/* ── Toast notification stack ─────────────────────────────── */
type Toast = { id: number; message: string; type?: string };

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)}
          style={{ background: "#1E293B", color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", cursor: "pointer", pointerEvents: "all", maxWidth: 320, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{t.type === "info" ? "ℹ️" : "✅"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Modal ─────────────────────────────────────────── */
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  type = "info",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
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
  student,
  index,
  onMark,
  getPct,
}: {
  student: Student;
  index: number;
  onMark: (id: string, s: Status) => void;
  getPct: (s: Student) => number;
}) => {
  const pct = getPct(student);
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
            <span className="text-[10px] font-medium text-slate-400 block">Roll {index + 1}</span>
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
                  active
                    ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring} scale-105`
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
        <span className="block text-[9px] font-bold text-slate-400">overall</span>
      </td>
    </tr>
  );
});
StudentRow.displayName = "StudentRow";

/* ── Student Card (Mobile) ────────────────────────────────── */
const StudentCard = memo(({
  student,
  index,
  onMark,
  getPct,
}: {
  student: Student;
  index: number;
  onMark: (id: string, s: Status) => void;
  getPct: (s: Student) => number;
}) => {
  const pct = getPct(student);
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
            #{index + 1} · Roll {index + 1} ·{" "}
            <span className={pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}>{pct}%</span>
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
                active
                  ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring}`
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
  const teacherId = user?.id?.slice(0, 6) || "DEMO";

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
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
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [fetchedBatches, setFetchedBatches] = useState<ClassItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [instituteId, setInstituteId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Load assigned batches from teacher_batches table ──
  useEffect(() => {
    async function loadBatches() {
      setBatchesLoading(true);
      try {
        const { data: mem } = await supabase
          .from("institute_members").select("institute_id, department_id")
          .eq("user_id", user?.id).eq("status", "active").limit(1).single();
        if (!mem) { setBatchesLoading(false); return; }
        setInstituteId(mem.institute_id);

        const { data: tb } = await supabase
          .from("teacher_batches").select("batch_id")
          .eq("teacher_id", user?.id).eq("institute_id", mem.institute_id);

        let batches: any[] = [];
        if (tb && tb.length > 0) {
          const { data: bRows } = await supabase
            .from("batches").select("id, name, class_level")
            .in("id", tb.map(t => t.batch_id)).eq("is_active", true).order("name");
          batches = bRows || [];
        } else if (mem.department_id) {
          const { data: bRows } = await supabase
            .from("batches").select("id, name, class_level")
            .eq("institute_id", mem.institute_id).eq("department_id", mem.department_id)
            .eq("is_active", true).order("name");
          batches = bRows || [];
        }
        if (batches && batches.length > 0) {
          const { data: stuCounts } = await supabase
            .from("students").select("batch_id").eq("institute_id", mem.institute_id)
            .eq("is_active", true).in("batch_id", batches.map(b => b.id));
          const countMap: Record<string, number> = {};
          stuCounts?.forEach(s => { if (s.batch_id) countMap[s.batch_id] = (countMap[s.batch_id] || 0) + 1; });
          setFetchedBatches(batches.map(b => ({
            id: b.id, name: b.name, studentCount: countMap[b.id] || 0,
            timeSlot: b.class_level ? `Class ${b.class_level}` : undefined,
          })));
        } else { setFetchedBatches([]); }
      } catch (e) { console.error(e); }
      setBatchesLoading(false);
    }
    if (user?.id) loadBatches();
  }, [user?.id]);

  const openClass = useCallback(async (cls: ClassItem) => {
    setSelectedClass(cls);
    setStudents([]);
    setHasChanges(false);
    setSearchQuery("");
    setStatusFilter("all");
    setLastSaved(null);
    try {
      const { data: stuRows } = await supabase
        .from("students").select("id, name, roll_no")
        .eq("batch_id", cls.id).eq("is_active", true).order("roll_no");
      if (!stuRows || stuRows.length === 0) {
        addToast(`${cls.name} has no students yet`, "info");
        setOriginalStudents([]);
        return;
      }
      const dateStr = toDateStr(selectedDate);
      const { data: existing } = await supabase
        .from("attendance").select("records")
        .eq("batch_id", cls.id).eq("date", dateStr).single();
      const savedRecords: Record<string, Status> = existing?.records || {};
      const loaded: Student[] = stuRows.map(s => ({
        id: s.id,
        name: s.name + (s.roll_no ? ` (${s.roll_no})` : ""),
        status: (savedRecords[s.id] as Status) || "present",
        attendanceHistory: [],
      }));
      setStudents(loaded);
      setOriginalStudents(JSON.parse(JSON.stringify(loaded)));
      addToast(`Opened ${cls.name} — ${loaded.length} students`, "info");
    } catch (e) {
      console.error("openClass:", e);
      addToast("Failed to load students", "success");
    }
  }, [addToast, selectedDate]);

  const goBack = useCallback(() => {
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
  }, [hasChanges]);

  const markStatus = useCallback((studentId: string, status: Status) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status } : s)));
    setHasChanges(true);
  }, []);

  const markAllPresent = useCallback(() => {
    setConfirmAction(() => () => {
      setStudents((prev) => prev.map((s) => ({ ...s, status: "present" as Status })));
      setHasChanges(true);
      addToast(`Marked all ${students.length} students as present`);
    });
    setConfirmTitle("Mark all present?");
    setConfirmMessage(`This will mark all ${students.length} students as present. You can adjust individual students afterward.`);
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
    if (!selectedClass || !instituteId) return;
    setIsSaving(true);
    try {
      const dateStr = toDateStr(selectedDate);
      const records: Record<string, string> = {};
      students.forEach(s => { records[s.id] = s.status; });
      const { error } = await supabase.from("attendance").upsert({
        batch_id: selectedClass.id,
        institute_id: instituteId,
        date: dateStr,
        records,
        marked_by: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "batch_id,date" });
      if (error) throw error;
      setOriginalStudents(JSON.parse(JSON.stringify(students)));
      setHasChanges(false);
      const now = new Date();
      setLastSaved(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      addToast(`Attendance saved for ${selectedClass.name}`);
    } catch (e: any) {
      addToast(e.message || "Save failed", "success");
    }
    setIsSaving(false);
  }, [students, selectedClass, addToast, selectedDate, instituteId, user?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectedClass) return;
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
  }, [selectedClass, hasChanges, isSaving, saveAttendance, goBack]);

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

  // Analytics
  const presentCount = useMemo(() => students.filter((s) => s.status === "present").length, [students]);
  const absentCount = useMemo(() => students.filter((s) => s.status === "absent").length, [students]);
  const leaveCount = useMemo(() => students.filter((s) => s.status === "leave").length, [students]);
  const attendancePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  // Filtered students
  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (statusFilter !== "all") filtered = filtered.filter((s) => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [students, statusFilter, searchQuery]);

  const getStudentPct = useCallback((student: Student) => {
    if (!student.attendanceHistory?.length) return 0;
    const present = student.attendanceHistory.filter((h) => h.status === "present").length;
    return Math.round((present / student.attendanceHistory.length) * 100);
  }, []);

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

  /* ═══════════════════════════════════════════════════════════
     RENDER: CLASS LIST
     ═══════════════════════════════════════════════════════════ */
  if (!selectedClass) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes popIn { from { opacity:0; transform:scale(0.96) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
            @media (prefers-reduced-motion: reduce) {
              .animate-pop, [class*="animate-"] { animation: none !important; }
            }
          `
        }} />
        <div className="space-y-5 sm:space-y-8 animate-[popIn_0.35s_cubic-bezier(0.16,1,0.3,1)]">
          {/* Teacher info + Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            {/* Teacher card */}
            <div className="lg:col-span-2 glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8 flex flex-col items-center text-center">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-[22px] sm:rounded-[28px] lg:rounded-[32px] flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg mb-3 sm:mb-4 transition-transform duration-200 hover:scale-105"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{displayName}</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Teacher ID: T-{teacherId}</p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Department: Science</p>

              <div className="flex items-center gap-0.5 mt-3 sm:mt-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= 4 ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}>
                    {n <= 4 ? <I.Star /> : <I.StarOff />}
                  </span>
                ))}
                <span className="text-xs font-bold text-slate-500 ml-1">4.0</span>
              </div>

              <div className="mt-4 flex items-center gap-2 inset-pill border-none rounded-2xl px-4 py-2 sm:px-5 sm:py-2.5">
                <I.Users />
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                  {batchesLoading ? "Loading..." : `${fetchedBatches.length} ${fetchedBatches.length !== 1 ? "batches" : "batch"} assigned`}
                </span>
              </div>

              <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 w-full">
                <div className="inset-pill border-none rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <span className="block text-base sm:text-lg font-black text-emerald-600">412</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Students</span>
                </div>
                <div className="inset-pill border-none rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <span className="block text-base sm:text-lg font-black text-blue-600">87.5%</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide">Avg. Attendance</span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="lg:col-span-3 glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
              <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
                <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span style={{ color: "var(--theme-start)" }}>
                    <I.Calendar />
                  </span>
                  <span className="hidden xs:inline">Calendar</span>
                </h3>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear(calYear - 1);
                      } else setCalMonth(calMonth - 1);
                    }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 transition-transform touch-manipulation"
                    aria-label="Previous month"
                  >
                    <I.ChevL />
                  </button>
                  <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[88px] sm:min-w-[110px] text-center tabular-nums">
                    {MONTHS_SHORT[calMonth]} {calYear}
                  </span>
                  <button
                    onClick={() => {
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear(calYear + 1);
                      } else setCalMonth(calMonth + 1);
                    }}
                    className="p-2 rounded-xl inset-pill border-none text-slate-500 active:scale-95 transition-transform touch-manipulation"
                    aria-label="Next month"
                  >
                    <I.ChevR />
                  </button>
                  <button
                    onClick={() => {
                      setCalMonth(new Date().getMonth());
                      setCalYear(new Date().getFullYear());
                      setSelectedDate(new Date());
                    }}
                    className="ml-1 px-2.5 py-1.5 rounded-xl inset-pill border-none text-[11px] sm:text-xs font-bold text-slate-500 active:scale-95 transition-transform touch-manipulation"
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center">
                {DAYS.map((d) => (
                  <div key={d} className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider py-0.5 sm:py-1">
                    {d}
                  </div>
                ))}
                {calDays.map((d, i) => {
                  if (d === null) return <div key={i} className="h-8 sm:h-9 lg:h-10" />;
                  const isSel = isSelected(d);
                  const isTdy = isToday(d);
                  const isWknd = isWeekend(d);
                  const hasAttendance = d <= new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
                  const demoStatus = d % 3 === 0 ? "present" : d % 3 === 1 ? "absent" : "leave";

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(new Date(calYear, calMonth, d))}
                      className={`relative h-8 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 active:scale-95 touch-manipulation ${
                        isSel
                          ? "text-white shadow-md"
                          : isTdy
                          ? "inset-pill border-none text-slate-800 dark:text-white ring-2"
                          : isWknd
                          ? "text-slate-400 dark:text-slate-500"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      style={
                        isSel
                          ? { background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }
                          : isTdy
                          ? ({ ["--tw-ring-color" as string]: "var(--theme-start)" } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {d}
                      {hasAttendance && (
                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${statusColor[demoStatus as Status].dot}`} />
                      )}
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

              <div className="mt-2.5 sm:mt-3 flex items-center gap-3 sm:gap-4 justify-center flex-wrap">
                {[
                  { c: "bg-emerald-500", l: "Present" },
                  { c: "bg-red-500", l: "Absent" },
                  { c: "bg-blue-500", l: "Leave" },
                ].map((item) => (
                  <span key={item.l} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${item.c}`} /> {item.l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Assigned classes */}
          <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white">Assigned classes</h3>
              <span className="text-[11px] sm:text-xs font-bold text-slate-400 inset-pill border-none px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shrink-0">
                {fetchedBatches.length} total
              </span>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {batchesLoading ? (
                <p style={{ textAlign: "center", padding: 32, color: "#94A3B8" }}>Loading your batches...</p>
              ) : fetchedBatches.length === 0 ? (
                <p style={{ textAlign: "center", padding: 32, color: "#94A3B8", fontWeight: 600 }}>No batches assigned yet. Your admin will assign batches to your account.</p>
              ) : fetchedBatches.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => openClass(cls)}
                  className="group glass-panel rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] p-4 sm:p-5 lg:p-6 text-left transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 touch-manipulation will-change-transform"
                >
                  <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] sm:rounded-[14px] flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-sm transition-transform duration-200 group-hover:scale-110"
                      style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}
                    >
                      {cls.name.split("—")[0]?.trim().replace("Class ", "C") || "C"}
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-400 inset-pill border-none px-2.5 py-1 rounded-full flex items-center gap-1">
                      <I.Users /> {cls.studentCount}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-[15px] sm:text-base lg:text-lg tracking-tight truncate group-hover:text-[var(--theme-start)] transition-colors duration-200">
                    {cls.name}
                  </h4>
                  {cls.timeSlot && (
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                      <I.Clock /> {cls.timeSlot}
                    </p>
                  )}
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-2 flex items-center gap-1">
                    Tap to mark attendance
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
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
     RENDER: ATTENDANCE SHEET
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
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes popIn { from { opacity:0; transform:scale(0.96) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
          @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          @media (prefers-reduced-motion: reduce) {
            .animate-pop, [class*="animate-"] { animation: none !important; }
          }
        `
      }} />

      <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Sticky header on mobile */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1 sm:static sm:mx-0 sm:px-0 sm:py-0 bg-[var(--bg,transparent)] sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              onClick={goBack}
              className="p-2.5 rounded-2xl inset-pill border-none text-slate-600 dark:text-slate-300 active:scale-95 transition-transform touch-manipulation shrink-0"
              title="Back (Esc)"
              aria-label="Back to classes"
            >
              <I.Back />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-1 truncate">
                <button onClick={goBack} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  Attendance
                </button>
                <span>›</span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{selectedClass.name}</span>
              </p>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {selectedClass.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                {DAYS_FULL[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                {students.length} students
                {selectedClass.timeSlot && ` · ${selectedClass.timeSlot}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={undoChanges}
                disabled={!hasChanges}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl inset-pill border-none font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                title="Undo"
              >
                <I.Undo /> <span className="hidden xs:inline">Undo</span>
              </button>
              <button
                onClick={markAllPresent}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl inset-pill border-none font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 active:scale-95 transition-all touch-manipulation"
                title="Mark all present"
              >
                <I.Check /> <span className="hidden xs:inline">All Present</span>
              </button>
              <button
                onClick={saveAttendance}
                disabled={!hasChanges || isSaving}
                className="flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
                title="Save (Ctrl+S)"
              >
                {isSaving ? <I.Spinner /> : <I.Save />}
                <span>{isSaving ? "Saving…" : "Save"}</span>
              </button>
            </div>
          </div>

          <div className={`text-[11px] sm:text-xs font-bold ${saveStatus.color} flex items-center gap-1.5 mt-1.5 sm:mt-2`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            {saveStatus.text}
            {hasChanges && !isSaving && changedCount > 0 && (
              <span className="text-slate-400 font-medium">({changedCount} changed)</span>
            )}
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
            <div
              key={i}
              className="glass-panel rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] p-3.5 sm:p-4 lg:p-5 flex flex-col items-center text-center transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className={`text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[9px] sm:text-[10px] lg:text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Table / Cards */}
        <div className="glass-panel rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] p-3.5 sm:p-5 lg:p-6 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 inset-pill border-none rounded-2xl px-3 py-2 flex-1 min-w-0">
              <span className="text-slate-400 shrink-0">
                <I.Search />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search student…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white placeholder-slate-400 w-full min-w-0"
                autoComplete="off"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0" aria-label="Clear search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
              <span className="text-slate-400 shrink-0 ml-0.5">
                <I.Filter />
              </span>
              {(["all", "present", "absent", "leave"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 touch-manipulation whitespace-nowrap shrink-0 ${
                    statusFilter === f ? "text-white shadow-sm" : "inset-pill border-none text-slate-500"
                  }`}
                  style={statusFilter === f ? { background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` } : undefined}
                >
                  {f === "all" ? "All" : statusFullLabel[f]}
                </button>
              ))}
            </div>
          </div>

          {filteredStudents.length !== students.length && (
            <p className="text-[11px] sm:text-xs font-bold text-slate-400 mb-2">
              Showing {filteredStudents.length} of {students.length}
            </p>
          )}

          {/* Desktop table (md+) */}
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
                {filteredStudents.map((student, idx) => (
                  <StudentRow key={student.id} student={student} index={students.indexOf(student)} onMark={markStatus} getPct={getStudentPct} />
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <p className="text-slate-400 font-bold text-sm">No students found</p>
                      <p className="text-slate-400 text-xs mt-1">Try adjusting search or filter</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (< md) */}
          <div className="md:hidden space-y-2.5">
            {filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} index={students.indexOf(student)} onMark={markStatus} getPct={getStudentPct} />
            ))}
            {filteredStudents.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-slate-400 font-bold text-sm">No students found</p>
                <p className="text-slate-400 text-xs mt-1">Try adjusting search or filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Analytics */}
        <div className="glass-panel rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl inset-pill border-none flex items-center justify-center" style={{ color: "var(--theme-start)" }}>
              <I.Chart />
            </div>
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white">Class analytics</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500">Today&apos;s attendance</span>
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
                  <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                    {item.label}: {item.count}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 sm:mt-4">
              <h4 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 mb-2.5 sm:mb-3">Monthly trend</h4>
              <div className="flex items-end gap-1.5 sm:gap-2 h-20 sm:h-28">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                  const pct = [88, 92, 78, 95, 85, 70][i];
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-0.5 bg-slate-900 text-white px-1.5 py-0.5 rounded-md pointer-events-none">
                        {pct}%
                      </span>
                      <div
                        className="w-full rounded-t-md sm:rounded-t-lg transition-all duration-300 group-hover:brightness-110 cursor-default"
                        style={{
                          height: `${pct}%`,
                          background:
                            pct >= 85
                              ? "linear-gradient(180deg, #34d399, #10b981)"
                              : pct >= 70
                              ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                              : "linear-gradient(180deg, #f87171, #ef4444)",
                        }}
                      />
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">{day}</span>
                    </div>
                  );
                })}
              </div>
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