// src/components/teacher/TeacherStudentsTab.tsx
// Comprehensive, responsive student directory & roster for Teachers
// Features: Search, Batch filtering, Attendance tracking, Profile navigation,
// WhatsApp/Call parent integration, Excel/CSV export, and Add Student modal.

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useMyScope } from "@/hooks/useMyScope";
import {
  Users,
  Search,
  GraduationCap,
  Phone,
  Mail,
  Download,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Eye,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  UserCheck,
  Layers,
  Sparkles,
  CalendarCheck,
  X,
  PhoneCall,
  LayoutGrid,
  List,
} from "lucide-react";

/* ─── Interfaces ────────────────────────────────────────────────────────── */
export interface BatchInfo {
  id: string;
  name: string;
  class_level?: string;
  department_id?: string | null;
  subject?: string;
}

export interface StudentRecord {
  id: string;
  name: string;
  roll_no?: string | null;
  class_level?: string | null;
  batch_id?: string | null;
  batch_name?: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  is_active?: boolean;
  created_at?: string;
  access_code?: string | null;
  total_sessions?: number;
  present_sessions?: number;
  attendance_pct?: number | null;
}

interface TeacherStudentsTabProps {
  userId?: string;
  userEmail?: string;
  onNavigateTab?: (tab: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function TeacherStudentsTab({
  userId,
  userEmail,
  onNavigateTab,
}: TeacherStudentsTabProps) {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [instituteName, setInstituteName] = useState<string>("Institute");
  const [userRole, setUserRole] = useState<string>("teacher");
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "good" | "warning">("all");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "roll-asc" | "roll-desc" | "att-desc" | "att-asc">("name-asc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Detail Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Add Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    roll_no: "",
    batch_id: "",
    class_level: "",
    parent_name: "",
    parent_phone: "",
    phone: "",
    email: "",
    gender: "male",
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const scope = useMyScope();
  /** Not assigned anywhere yet (no teaching batch, not a proctor) → dedicated empty state. */
  const noScope = !scope.loading && !scope.isAdmin && batches.length === 0 && scope.proctorSectionIds.length === 0;

  /* ─── Data Fetching ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!scope.loading) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Institute + role come from get_my_access() (useMyScope) — no institute_members lookups here.
      const instId = scope.instituteId;
      if (!instId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setInstituteId(instId);
      setUserRole(scope.isAdmin ? "admin" : scope.isHod ? "hod" : "teacher");

      const { data: inst } = await supabase
        .from("institutes")
        .select("name")
        .eq("id", instId)
        .maybeSingle();
      if (inst?.name) setInstituteName(inst.name);

      // 2. Batches = my scope only (teaching + proctor sections; admin: all).
      //    No teacher_batches / department / whole-institute fallback.
      const batchRows: BatchInfo[] = scope.batches.map((b) => ({
        id: b.id,
        name: b.name,
        class_level: b.class_level || undefined,
        department_id: b.department_id,
      }));
      const allBatchesMap: Record<string, BatchInfo> = {};
      batchRows.forEach((b) => {
        allBatchesMap[b.id] = b;
      });
      setBatches(batchRows);

      // Pre-select a batch in the add form — only batches this user may add students to (admin / HOD)
      const firstAddable = scope.manageableBatches[0];
      if (firstAddable && !addForm.batch_id) {
        setAddForm((prev) => ({
          ...prev,
          batch_id: firstAddable.id,
          class_level: firstAddable.class_level || "",
        }));
      }

      if (!scope.isAdmin && batchRows.length === 0 && scope.proctorSectionIds.length === 0) {
        setStudents([]);
        return;
      }

      // 3. Fetch Students of my batches (+ students of my proctor sections)
      let stuQuery = supabase
        .from("students")
        .select("*")
        .eq("institute_id", instId)
        .eq("is_active", true);

      if (!scope.isAdmin) {
        const stuOr: string[] = [];
        if (batchRows.length) stuOr.push(`batch_id.in.(${batchRows.map((b) => b.id).join(",")})`);
        if (scope.proctorSectionIds.length) stuOr.push(`section_id.in.(${scope.proctorSectionIds.join(",")})`);
        stuQuery = stuQuery.or(stuOr.join(","));
      }

      const { data: rawStudents, error: stuError } = await stuQuery.order("name", {
        ascending: true,
      });

      if (stuError) {
        console.error("Error loading students:", stuError);
        toast.error("Failed to load students roster");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const stuList = rawStudents || [];
      const studentIds = stuList.map((s) => s.id);

      // 4. Safely fetch access codes if available
      const accessCodeMap: Record<string, string> = {};
      try {
        if (studentIds.length > 0) {
          const { data: codeRows } = await supabase
            .from("student_access_codes")
            .select("student_id, access_code")
            .in("student_id", studentIds);

          if (codeRows) {
            codeRows.forEach((c: any) => {
              if (c.student_id && c.access_code) {
                accessCodeMap[c.student_id] = c.access_code;
              }
            });
          }
        }
      } catch (err) {
        // Soft fail
      }

      // 5. Safely calculate attendance percentage if attendance records exist
      const attendanceMap: Record<
        string,
        { total: number; present: number; pct: number | null }
      > = {};

      try {
        const relevantBatches = Array.from(
          new Set(stuList.map((s) => s.batch_id).filter(Boolean))
        );

        if (relevantBatches.length > 0) {
          const { data: attRows } = await supabase
            .from("attendance")
            .select("batch_id, date, records")
            .in("batch_id", relevantBatches);

          if (attRows && attRows.length > 0) {
            attRows.forEach((row: any) => {
              const records: Record<string, string> =
                typeof row.records === "object" && row.records ? row.records : {};

              Object.entries(records).forEach(([sId, status]) => {
                if (!attendanceMap[sId]) {
                  attendanceMap[sId] = { total: 0, present: 0, pct: null };
                }
                attendanceMap[sId].total += 1;
                if (status === "present") {
                  attendanceMap[sId].present += 1;
                }
              });
            });

            // Calculate pct
            Object.keys(attendanceMap).forEach((sId) => {
              const item = attendanceMap[sId];
              if (item.total > 0) {
                item.pct = Math.round((item.present / item.total) * 100);
              }
            });
          }
        }
      } catch (err) {
        // Soft fail
      }

      // 6. Enrich students
      const enriched: StudentRecord[] = stuList.map((s: any) => {
        const b = allBatchesMap[s.batch_id];
        const att = attendanceMap[s.id];
        return {
          ...s,
          batch_name: b?.name || "Unassigned",
          class_level: s.class_level || b?.class_level || "—",
          access_code: accessCodeMap[s.id] || null,
          total_sessions: att?.total || 0,
          present_sessions: att?.present || 0,
          attendance_pct: att && att.pct !== null ? att.pct : null,
        };
      });

      setStudents(enriched);
    } catch (e) {
      console.error("TeacherStudentsTab load error:", e);
      toast.error("Error loading student directory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* ─── Add Student Handler ───────────────────────────────────────────────── */
  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast.error("Please enter the student's name");
      return;
    }
    if (!instituteId) {
      toast.error("Institute ID missing");
      return;
    }
    // Only admin / HOD may add students (RLS stu_insert), and only into batches they manage.
    const targetBatch = scope.manageableBatches.find((b) => b.id === addForm.batch_id);
    if (!scope.canManageStudents || !targetBatch) {
      toast.error("Only the admin or HOD can add students to this batch.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const payload: any = {
        institute_id: instituteId,
        department_id: targetBatch.department_id,
        section_id: targetBatch.section_id,
        name: addForm.name.trim(),
        roll_no: addForm.roll_no.trim() || null,
        batch_id: addForm.batch_id || null,
        class_level: addForm.class_level.trim() || null,
        parent_name: addForm.parent_name.trim() || null,
        parent_phone: addForm.parent_phone.trim() || null,
        phone: addForm.phone.trim() || null,
        email: addForm.email.trim() || null,
        gender: addForm.gender || "male",
        is_active: true,
      };

      const { data: newStudent, error: insertError } = await supabase
        .from("students")
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        toast.error(insertError.message || "Failed to add student");
        setSubmittingAdd(false);
        return;
      }

      // Generate access code — the student is saved either way, so a failure here is a warning, not an error
      if (newStudent?.id) {
        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
        const { error: codeErr } = await supabase.from("student_access_codes").insert({
          student_id: newStudent.id,
          institute_id: instituteId,
          batch_id: addForm.batch_id || null,
          access_code: generatedCode,
        });
        if (codeErr) {
          console.error("Access code insert error:", codeErr);
          toast.warning(`Student added, but the access code could not be created: ${codeErr.message}`);
        }
      }

      toast.success(`${addForm.name} enrolled successfully!`);
      setShowAddModal(false);
      setAddForm({
        name: "",
        roll_no: "",
        batch_id: scope.manageableBatches[0]?.id || "",
        class_level: scope.manageableBatches[0]?.class_level || "",
        parent_name: "",
        parent_phone: "",
        phone: "",
        email: "",
        gender: "male",
      });

      // Reload roster
      loadData(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add student");
    } finally {
      setSubmittingAdd(false);
    }
  }

  /* ─── Export CSV Handler ────────────────────────────────────────────────── */
  function exportCSV() {
    if (filteredStudents.length === 0) {
      toast.error("No students to export");
      return;
    }

    const headers = [
      "Student Name",
      "Roll No",
      "Batch",
      "Class Level",
      "Student Phone",
      "Student Email",
      "Parent Name",
      "Parent Phone",
      "Access Code",
      "Attendance %",
    ];

    const rows = filteredStudents.map((s) => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.roll_no || "").replace(/"/g, '""')}"`,
      `"${(s.batch_name || "").replace(/"/g, '""')}"`,
      `"${(s.class_level || "").replace(/"/g, '""')}"`,
      `"${(s.phone || "").replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.parent_name || "").replace(/"/g, '""')}"`,
      `"${(s.parent_phone || "").replace(/"/g, '""')}"`,
      `"${(s.access_code || "").replace(/"/g, '""')}"`,
      s.attendance_pct !== null && s.attendance_pct !== undefined
        ? `"${s.attendance_pct}%"`
        : `"N/A"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const batchSlug =
      selectedBatchId === "all"
        ? "all_batches"
        : (batches.find((b) => b.id === selectedBatchId)?.name || "batch").toLowerCase().replace(/\s+/g, "_");
    link.setAttribute(
      "download",
      `student_roster_${batchSlug}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Roster exported to CSV");
  }

  /* ─── Copy to Clipboard ─────────────────────────────────────────────────── */
  function copyText(text: string, id: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  /* ─── WhatsApp Parent ───────────────────────────────────────────────────── */
  function openWhatsApp(student: StudentRecord) {
    const rawNumber = student.parent_phone || student.phone;
    if (!rawNumber) {
      toast.error("No phone number recorded for this student");
      return;
    }
    const cleanNumber = rawNumber.replace(/\D/g, "");
    const formatted = cleanNumber.startsWith("91")
      ? cleanNumber
      : cleanNumber.length === 10
      ? `91${cleanNumber}`
      : cleanNumber;

    const message = encodeURIComponent(
      `Hello, this is regarding ${student.name} (${student.batch_name || "Class"}) from ${instituteName}.`
    );
    window.open(`https://wa.me/${formatted}?text=${message}`, "_blank");
  }

  /* ─── Filtered and Sorted Students ──────────────────────────────────────── */
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Batch Filter
    if (selectedBatchId !== "all") {
      result = result.filter((s) => s.batch_id === selectedBatchId);
    }

    // Attendance Filter
    if (attendanceFilter === "good") {
      result = result.filter((s) => s.attendance_pct !== null && s.attendance_pct >= 75);
    } else if (attendanceFilter === "warning") {
      result = result.filter((s) => s.attendance_pct !== null && s.attendance_pct < 75);
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          (s.parent_phone && s.parent_phone.includes(q)) ||
          (s.parent_name && s.parent_name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.batch_name && s.batch_name.toLowerCase().includes(q)) ||
          (s.access_code && s.access_code.includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "roll-asc":
          return (a.roll_no || "").localeCompare(b.roll_no || "", undefined, {
            numeric: true,
          });
        case "roll-desc":
          return (b.roll_no || "").localeCompare(a.roll_no || "", undefined, {
            numeric: true,
          });
        case "att-desc":
          return (b.attendance_pct ?? -1) - (a.attendance_pct ?? -1);
        case "att-asc":
          return (a.attendance_pct ?? 101) - (b.attendance_pct ?? 101);
        default:
          return 0;
      }
    });

    return result;
  }, [students, selectedBatchId, attendanceFilter, searchQuery, sortBy]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = filteredStudents.length;
    const withParentPhone = filteredStudents.filter((s) => s.parent_phone).length;
    const withRollNo = filteredStudents.filter((s) => s.roll_no).length;
    const withAttendance = filteredStudents.filter(
      (s) => s.attendance_pct !== null && s.attendance_pct !== undefined
    );
    const avgAttendance =
      withAttendance.length > 0
        ? Math.round(
            withAttendance.reduce((acc, s) => acc + (s.attendance_pct || 0), 0) /
              withAttendance.length
          )
        : null;

    return { total, withParentPhone, withRollNo, avgAttendance };
  }, [filteredStudents]);

  /* ─── Avatar Initials Generator ─────────────────────────────────────────── */
  function getInitials(name: string) {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ─── Render Nothing if not in institute ────────────────────────────────── */
  if (!loading && !instituteId) {
    return null; // Handled by InstituteTeacherPanel above
  }

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ─── Header & Top Actions ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 rounded-[24px] p-5 sm:p-6 border border-slate-100 dark:border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-[#FF7043] flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  Student Directory
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500 text-white shadow-sm">
                  {students.length} Total
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Manage, contact, and monitor students enrolled in your assigned batches
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center disabled:opacity-50"
            title="Refresh student list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#FF7043]" : ""}`} />
          </button>

          {/* Export CSV Button */}
          <button
            onClick={exportCSV}
            disabled={filteredStudents.length === 0}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Quick Take Attendance */}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("attendance")}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
            >
              <CalendarCheck className="w-4 h-4 text-[#FF7043]" />
              <span>Mark Attendance</span>
            </button>
          )}

          {/* Add Student Button — admin / HOD only */}
          {scope.canManageStudents && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7043] to-[#F4511E] hover:from-[#F4511E] hover:to-[#E64A19] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-orange-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Student</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Metric Stats Bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900/90 rounded-[20px] p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Filtered Students
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            {metrics.total}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            {selectedBatchId === "all" ? "Across all batches" : "In current batch"}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900/90 rounded-[20px] p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Active Batches
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-[#FF7043] flex items-center justify-center text-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            {batches.length}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            Assigned to your profile
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900/90 rounded-[20px] p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Parent Contacted
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
              <Phone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            {metrics.withParentPhone}
            <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">
              ({metrics.total > 0 ? Math.round((metrics.withParentPhone / metrics.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            With parent mobile number
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900/90 rounded-[20px] p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Avg Attendance
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            {metrics.avgAttendance !== null ? `${metrics.avgAttendance}%` : "—"}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            {metrics.avgAttendance !== null ? "Across recorded sessions" : "No sessions marked yet"}
          </p>
        </div>
      </div>

      {/* ─── Search, Batch Filters & Controls ────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900/90 rounded-[24px] p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-4">
        {/* Row 1: Search & View Options */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, roll no, parent phone, or access code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#FF7043] focus:ring-2 focus:ring-[#FF7043]/20 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Controls: Sort & View Mode */}
          <div className="flex items-center gap-2">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="name-asc" className="dark:bg-slate-800">Name (A → Z)</option>
                <option value="name-desc" className="dark:bg-slate-800">Name (Z → A)</option>
                <option value="roll-asc" className="dark:bg-slate-800">Roll No (Low → High)</option>
                <option value="roll-desc" className="dark:bg-slate-800">Roll No (High → Low)</option>
                <option value="att-desc" className="dark:bg-slate-800">Attendance (Highest)</option>
                <option value="att-asc" className="dark:bg-slate-800">Attendance (Lowest)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-700 text-[#FF7043] shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-slate-700 text-[#FF7043] shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Card grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Batch Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3" /> Batch:
          </span>

          {/* All Batches Pill */}
          <button
            onClick={() => setSelectedBatchId("all")}
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedBatchId === "all"
                ? "bg-[#FF7043] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <span>All Batches</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedBatchId === "all"
                  ? "bg-white/30 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {students.length}
            </span>
          </button>

          {/* Individual Batch Pills */}
          {batches.map((b) => {
            const count = students.filter((s) => s.batch_id === b.id).length;
            const isSelected = selectedBatchId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBatchId(b.id)}
                className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#FF7043] text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{b.name}</span>
                {b.class_level && (
                  <span className="opacity-75 text-[10px]">({b.class_level})</span>
                )}
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected
                      ? "bg-white/30 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 shrink-0 mx-1" />

          {/* Attendance Quick Filters */}
          <button
            onClick={() =>
              setAttendanceFilter((prev) => (prev === "good" ? "all" : "good"))
            }
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 text-[11px] ${
              attendanceFilter === "good"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Good (≥75%)</span>
          </button>

          <button
            onClick={() =>
              setAttendanceFilter((prev) => (prev === "warning" ? "all" : "warning"))
            }
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 text-[11px] ${
              attendanceFilter === "warning"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100"
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Defaulters (&lt;75%)</span>
          </button>
        </div>
      </div>

      {/* ─── Students List Render ────────────────────────────────────────── */}
      {loading ? (
        /* Loading Skeletons */
        <div className="bg-white dark:bg-slate-900/90 rounded-[24px] p-6 border border-slate-100 dark:border-white/10 shadow-sm space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center px-4 gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900/90 rounded-[24px] p-12 border border-slate-100 dark:border-white/10 shadow-sm text-center">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-500/10 text-[#FF7043] flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            {noScope
              ? "No batch is assigned to you yet — contact your HOD"
              : students.length === 0
              ? "No students enrolled yet"
              : "No students match your filter"}
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {noScope
              ? "When your HOD assigns you as a subject or class teacher for a section, its students will appear here."
              : students.length === 0
              ? "Your assigned batches currently have no enrolled students. Ask your HOD or institute administrator to add them."
              : "Try adjusting your search query, batch filter, or attendance status to find who you're looking for."}
          </p>
          {students.length === 0 ? (
            scope.canManageStudents && !noScope && <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm shadow-md hover:bg-[#F4511E] transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll First Student</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedBatchId("all");
                setAttendanceFilter("all");
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        /* ─── List / Table View ─────────────────────────────────────────── */
        <div className="bg-white dark:bg-slate-900/90 rounded-[24px] border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Table Header (Hidden on small mobile) */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-6 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <div className="col-span-4">Student Details</div>
            <div className="col-span-2">Roll No & Batch</div>
            <div className="col-span-2">Parent Contact</div>
            <div className="col-span-2">Attendance</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Student Rows */}
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredStudents.map((s) => {
              const attColor =
                s.attendance_pct === null
                  ? "text-slate-400 bg-slate-100 dark:bg-slate-800"
                  : s.attendance_pct >= 75
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                  : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10";

              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/institute/students/${s.id}`)}
                  className="px-4 sm:px-6 py-4 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-3 items-start md:items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  {/* Column 1: Student Avatar + Name + Email */}
                  <div className="md:col-span-4 flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20 text-[#FF7043] flex items-center justify-center font-black text-sm shrink-0 shadow-xs border border-orange-200/50 dark:border-orange-500/20">
                      {getInitials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-[#FF7043] transition-colors">
                          {s.name}
                        </p>
                        {s.gender === "female" && (
                          <span className="text-[10px] text-pink-500 font-bold">👧</span>
                        )}
                        {s.access_code && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(s.access_code!, s.id, "Access Code");
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20 hover:bg-amber-100 transition-colors"
                            title="Click to copy student portal access code"
                          >
                            🔑 {s.access_code}
                            {copiedId === s.id ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-60" />
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {s.email || (s.phone ? `Ph: ${s.phone}` : "No direct email/phone")}
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Roll Number & Batch */}
                  <div className="md:col-span-2 flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold border border-slate-200/60 dark:border-white/10">
                      {s.roll_no ? `#${s.roll_no}` : "No Roll"}
                    </span>
                    <span className="text-xs font-bold text-[#FF7043] bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                      {s.batch_name}
                    </span>
                    {s.class_level && (
                      <span className="text-[10px] font-medium text-slate-400">
                        {s.class_level}
                      </span>
                    )}
                  </div>

                  {/* Column 3: Parent Contact */}
                  <div className="md:col-span-2 text-xs w-full md:w-auto">
                    {s.parent_phone ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {s.parent_phone}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsApp(s);
                          }}
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-colors"
                          title="Message parent on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`tel:${s.parent_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-md text-slate-400 hover:text-[#FF7043] hover:bg-orange-50 transition-colors"
                          title="Call parent"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No parent phone</span>
                    )}
                    {s.parent_name && (
                      <p className="text-[11px] text-slate-400 truncate">
                        P: {s.parent_name}
                      </p>
                    )}
                  </div>

                  {/* Column 4: Attendance */}
                  <div className="md:col-span-2 w-full md:w-auto">
                    {s.attendance_pct !== null && s.attendance_pct !== undefined ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-black ${attColor}`}
                          >
                            {s.attendance_pct}%
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {s.present_sessions}/{s.total_sessions} days
                          </span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.attendance_pct >= 75 ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(s.attendance_pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No logs yet</span>
                    )}
                  </div>

                  {/* Column 5: Action Buttons */}
                  <div className="md:col-span-2 flex items-center justify-end gap-1.5 w-full md:w-auto mt-2 md:mt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(s);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1"
                      title="Quick details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Quick View</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/institute/students/${s.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-[#FF7043] dark:bg-orange-500/10 dark:hover:bg-[#FF7043] text-[#FF7043] hover:text-white text-xs font-bold transition-all flex items-center gap-1 group/btn"
                    >
                      <span>Report</span>
                      <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── Card Grid View ────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((s) => {
            const attColor =
              s.attendance_pct === null
                ? "text-slate-400 bg-slate-100 dark:bg-slate-800"
                : s.attendance_pct >= 75
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10";

            return (
              <div
                key={s.id}
                onClick={() => navigate(`/institute/students/${s.id}`)}
                className="bg-white dark:bg-slate-900/90 rounded-[24px] p-5 border border-slate-100 dark:border-white/10 shadow-sm hover:border-[#FF7043]/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top card bar: Avatar + Name + Roll */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20 text-[#FF7043] flex items-center justify-center font-black text-base shrink-0 shadow-xs border border-orange-200/50 dark:border-orange-500/20">
                        {getInitials(s.name)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-[#FF7043] transition-colors leading-tight">
                          {s.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {s.batch_name} {s.class_level ? `· ${s.class_level}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-bold shrink-0">
                      {s.roll_no ? `#${s.roll_no}` : "No Roll"}
                    </span>
                  </div>

                  {/* Badges row: Access code & Attendance */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {s.access_code && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          copyText(s.access_code!, s.id, "Access Code");
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20 hover:bg-amber-100 transition-colors"
                      >
                        🔑 {s.access_code}
                      </span>
                    )}

                    {s.attendance_pct !== null && s.attendance_pct !== undefined ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${attColor}`}>
                        {s.attendance_pct}% Attendance ({s.present_sessions}/{s.total_sessions})
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No attendance yet</span>
                    )}
                  </div>

                  {/* Contact Info Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Parent Contact:</span>
                      <span className="font-bold truncate max-w-[150px]">
                        {s.parent_phone || "Not recorded"}
                      </span>
                    </div>
                    {s.parent_name && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Parent Name:</span>
                        <span className="font-medium truncate max-w-[150px]">{s.parent_name}</span>
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Email:</span>
                        <span className="truncate max-w-[150px]">{s.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1">
                    {s.parent_phone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(s);
                        }}
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        title="WhatsApp parent"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    {s.parent_phone && (
                      <a
                        href={`tel:${s.parent_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#FF7043] transition-colors"
                        title="Call parent"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(s);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
                    >
                      Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/institute/students/${s.id}`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FF7043] hover:bg-[#F4511E] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      <span>Report</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Quick Details Modal ─────────────────────────────────────────── */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-white/10 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-black text-lg">
                  {getInitials(selectedStudent.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedStudent.batch_name} · {selectedStudent.class_level || "Class"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Roll Number</span>
                <p className="font-bold text-slate-800 dark:text-white text-sm mt-0.5">
                  {selectedStudent.roll_no || "Not assigned"}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Student Portal Key</span>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {selectedStudent.access_code ? `🔑 ${selectedStudent.access_code}` : "None"}
                  </p>
                  {selectedStudent.access_code && (
                    <button
                      onClick={() =>
                        copyText(selectedStudent.access_code!, "modal", "Access Code")
                      }
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Parent Contact</span>
                <p className="font-bold text-slate-800 dark:text-white text-sm mt-0.5">
                  {selectedStudent.parent_phone || "Not recorded"}
                </p>
                {selectedStudent.parent_name && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ({selectedStudent.parent_name})
                  </p>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Attendance Standing</span>
                <p className="font-bold text-slate-800 dark:text-white text-sm mt-0.5">
                  {selectedStudent.attendance_pct !== null && selectedStudent.attendance_pct !== undefined
                    ? `${selectedStudent.attendance_pct}% (${selectedStudent.present_sessions}/${selectedStudent.total_sessions})`
                    : "No records yet"}
                </p>
              </div>

              <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Direct Contact</span>
                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  Phone: {selectedStudent.phone || "—"} · Email: {selectedStudent.email || "—"}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {selectedStudent.parent_phone ? (
                <button
                  onClick={() => openWhatsApp(selectedStudent)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Parent</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => navigate(`/institute/students/${selectedStudent.id}`)}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7043] hover:bg-[#F4511E] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>Open Full Report Card</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Student Modal ───────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-white/10 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#FF7043] flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Enroll New Student
                  </h3>
                  <p className="text-xs text-slate-400">
                    Add a student to your assigned batches
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddStudent} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                />
              </div>

              {/* Batch & Roll No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Batch <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={addForm.batch_id}
                    onChange={(e) => {
                      const sel = scope.manageableBatches.find((b) => b.id === e.target.value);
                      setAddForm({
                        ...addForm,
                        batch_id: e.target.value,
                        class_level: sel?.class_level || addForm.class_level,
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  >
                    {scope.manageableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.class_level ? `(${b.class_level})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 23ECE01"
                    value={addForm.roll_no}
                    onChange={(e) => setAddForm({ ...addForm, roll_no: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Class Level & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class / Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Year, Class 10"
                    value={addForm.class_level}
                    onChange={(e) => setAddForm({ ...addForm, class_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={addForm.gender}
                    onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Parent Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma"
                    value={addForm.parent_name}
                    onChange={(e) => setAddForm({ ...addForm, parent_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={addForm.parent_phone}
                    onChange={(e) => setAddForm({ ...addForm, parent_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-medium outline-none focus:border-[#FF7043] text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingAdd}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7043] hover:bg-[#F4511E] text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingAdd ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enrolling...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Enroll</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

