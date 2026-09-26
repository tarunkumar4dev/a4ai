// src/components/attendance/HODAttendanceDashboard.tsx
// ──────────────────────────────────────────────────────────────────────
// HOD / Institute Admin Attendance Dashboard
//
// 1. Tab "Daily Teacher Status":
//    - Tracks daily marking status of all teachers (which teacher filled which class today)
//    - Real-time sessions from `class_sessions` and `attendance_records`
//    - Clear breakdown: Marked (✓ with time & present count) vs Pending (⏳ awaiting marking)
//    - Department filter (essential for HODs), date navigator, search & Excel export
//    - Drilldown modal: view students present/absent for any marked lecture
//
// 2. Tab "Student Monthly Report":
//    - Batch-wise student × subject monthly attendance table
//    - Full Excel (.xlsx) export & Below 75% attendance alerts
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  BookOpen,
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Building2,
  UserCheck,
  UserX,
  FileSpreadsheet,
  GraduationCap
} from "lucide-react";

/* ───── TYPES ───── */
export interface TeacherAttendanceItem {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  departmentId?: string;
  departmentName: string;
  batchId: string;
  batchName: string;
  classLevel?: string;
  subjectId?: string;
  subjectName: string;
  subjectCode: string;
  isMarked: boolean;
  markedAt?: string;
  sessionId?: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  totalStudents: number;
  attendancePct: number;
  source?: "class_sessions" | "attendance_legacy";
  legacyRecords?: Record<string, string>;
}

interface BatchOption {
  id: string;
  name: string;
  departmentName?: string;
  departmentId?: string;
  studentCount: number;
}

interface MonthlyRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  subjectName: string;
  subjectCode: string;
  totalHeld: number;
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
}

interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  rollNo: string;
  status: "present" | "absent" | "leave";
}

interface HODAttendanceDashboardProps {
  instituteId: string;
  isHod?: boolean;
  hodDeptId?: string | null;
  teachers?: any[];
  batches?: any[];
  departments?: any[];
  subjects?: any[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function HODAttendanceDashboard({
  instituteId,
  isHod = false,
  hodDeptId = null,
  teachers: initialTeachers,
  batches: initialBatches,
  departments: initialDepartments,
  subjects: initialSubjects,
}: HODAttendanceDashboardProps) {
  // Navigation Mode
  const [activeTab, setActiveTab] = useState<"teachers" | "monthly">("teachers");

  // Date Filter (defaults to today YYYY-MM-DD)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);

  // Department & Search Filters
  const [selectedDeptId, setSelectedDeptId] = useState<string>(isHod && hodDeptId ? hodDeptId : "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "marked" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Daily Teacher Data State
  const [teacherItems, setTeacherItems] = useState<TeacherAttendanceItem[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  // Batches for monthly report
  const [batchesList, setBatchesList] = useState<BatchOption[]>([]);
  const [departmentList, setDepartmentList] = useState<{ id: string; name: string }[]>([]);

  // Monthly Report State
  const [reportBatchId, setReportBatchId] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Student Breakdown Modal State
  const [modalSession, setModalSession] = useState<TeacherAttendanceItem | null>(null);
  const [modalStudents, setModalStudents] = useState<StudentAttendanceRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalStatusFilter, setModalStatusFilter] = useState<"all" | "present" | "absent" | "leave">("all");
  const [modalSearch, setModalSearch] = useState("");

  // Toast Notification State
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  /* ─────────────────────────────────────────────────────────────
     1. LOAD DAILY TEACHER ATTENDANCE STATUS
  ───────────────────────────────────────────────────────────── */
  const loadDailyTeacherStatus = useCallback(async (date: string) => {
    if (!instituteId) return;
    setLoadingDaily(true);

    try {
      // 1. Fetch Teachers (institute_members + profiles)
      let teachersData = initialTeachers;
      if (!teachersData || teachersData.length === 0) {
        const { data: mems } = await supabase
          .from("institute_members")
          .select("*")
          .eq("institute_id", instituteId)
          .eq("status", "active")
          .in("role", ["teacher", "hod"]);
        teachersData = mems || [];
      }

      // 2. Fetch Departments
      let deptsData = initialDepartments;
      if (!deptsData || deptsData.length === 0) {
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name")
          .eq("institute_id", instituteId)
          .order("name");
        deptsData = depts || [];
      }
      setDepartmentList(deptsData.map((d: any) => ({ id: d.id, name: d.name })));
      const deptMap = new Map((deptsData || []).map((d: any) => [d.id, d.name]));

      // 3. Fetch Batches
      let batchesData = initialBatches;
      if (!batchesData || batchesData.length === 0) {
        const { data: bts } = await supabase
          .from("batches")
          .select("id, name, department_id, class_level, subject")
          .eq("institute_id", instituteId)
          .neq("is_active", false)
          .order("name");
        batchesData = bts || [];
      }
      const bMap = new Map((batchesData || []).map((b: any) => [b.id, b]));

      // 4. Fetch Batch Student Counts
      const batchIds = (batchesData || []).map((b: any) => b.id);
      let batchCountMap: Record<string, number> = {};
      if (batchIds.length > 0) {
        const { data: stuCounts } = await supabase
          .from("students")
          .select("batch_id")
          .in("batch_id", batchIds)
          .eq("is_active", true);
        (stuCounts || []).forEach((s: any) => {
          batchCountMap[s.batch_id] = (batchCountMap[s.batch_id] || 0) + 1;
        });
      }

      // Also set batches list for monthly report
      setBatchesList(
        (batchesData || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          departmentId: b.department_id,
          departmentName: deptMap.get(b.department_id) || "General",
          studentCount: batchCountMap[b.id] || 0,
        }))
      );

      // 5. Fetch Subjects
      let subjectsData = initialSubjects;
      if (!subjectsData || subjectsData.length === 0) {
        const { data: subs } = await supabase
          .from("subjects")
          .select("id, name, code, department_id")
          .eq("institute_id", instituteId);
        subjectsData = subs || [];
      }
      const subMap = new Map((subjectsData || []).map((s: any) => [s.id, s]));

      // 6. Fetch Teaching Assignments & Teacher Batches
      const [taRes, tbRes] = await Promise.all([
        supabase
          .from("teaching_assignments")
          .select("teacher_id, batch_id, subject_id")
          .eq("institute_id", instituteId),
        supabase
          .from("teacher_batches")
          .select("teacher_id, batch_id")
          .eq("institute_id", instituteId),
      ]);

      const teachingAssignments = taRes.data || [];
      const teacherBatches = tbRes.data || [];

      // 7. Query class_sessions for this institute and date
      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id, batch_id, subject_id, teacher_id, session_date, created_at, status")
        .eq("institute_id", instituteId)
        .eq("session_date", date);

      // 8. Query attendance_records for the sessions
      const sessionIds = (sessions || []).map((s: any) => s.id);
      let sessionRecordsMap: Record<string, { present: number; absent: number; leave: number; total: number }> = {};
      if (sessionIds.length > 0) {
        const { data: recs } = await supabase
          .from("attendance_records")
          .select("session_id, status")
          .in("session_id", sessionIds);
        (recs || []).forEach((r: any) => {
          if (!sessionRecordsMap[r.session_id]) {
            sessionRecordsMap[r.session_id] = { present: 0, absent: 0, leave: 0, total: 0 };
          }
          sessionRecordsMap[r.session_id].total += 1;
          if (r.status === "present") sessionRecordsMap[r.session_id].present += 1;
          else if (r.status === "absent") sessionRecordsMap[r.session_id].absent += 1;
          else if (r.status === "leave") sessionRecordsMap[r.session_id].leave += 1;
        });
      }

      // 9. Query legacy/direct attendance table for fallback
      const { data: directAtt } = await supabase
        .from("attendance")
        .select("id, batch_id, marked_by, date, records, created_at")
        .eq("institute_id", instituteId)
        .eq("date", date);

      // Build Teacher Map
      const teacherMap = new Map<string, any>();
      (teachersData || []).forEach((t: any) => {
        const tId = t.user_id || t.id;
        teacherMap.set(tId, {
          id: tId,
          name: t.user_name || t.full_name || t.email?.split("@")[0] || "Teacher",
          email: t.user_email || t.email || "",
          departmentId: t.department_id,
          departmentName: deptMap.get(t.department_id) || "General",
        });
      });

      // 10. Assemble Teacher Attendance Items
      const items: TeacherAttendanceItem[] = [];
      const handledKeys = new Set<string>();

      // A) Process sessions from class_sessions (Marked classes)
      (sessions || []).forEach((sess: any) => {
        const tInfo = teacherMap.get(sess.teacher_id) || {
          name: "Teacher",
          email: "",
          departmentId: "",
          departmentName: "General",
        };
        const batch = bMap.get(sess.batch_id);
        const subject = subMap.get(sess.subject_id);

        const counts = sessionRecordsMap[sess.id] || { present: 0, absent: 0, leave: 0, total: 0 };
        const total = counts.total > 0 ? counts.total : batchCountMap[sess.batch_id] || 0;
        const pct = total > 0 ? Math.round((counts.present / total) * 100) : 0;

        const timeStr = sess.created_at
          ? new Date(sess.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "Conducted";

        const key = `${sess.teacher_id}_${sess.batch_id}_${sess.subject_id || ""}`;
        handledKeys.add(key);
        handledKeys.add(`${sess.teacher_id}_${sess.batch_id}`);

        items.push({
          id: `sess_${sess.id}`,
          teacherId: sess.teacher_id,
          teacherName: tInfo.name,
          teacherEmail: tInfo.email,
          departmentId: tInfo.departmentId || batch?.department_id,
          departmentName: deptMap.get(tInfo.departmentId || batch?.department_id) || tInfo.departmentName,
          batchId: sess.batch_id,
          batchName: batch?.name || "Batch",
          classLevel: batch?.class_level,
          subjectId: sess.subject_id,
          subjectName: subject?.name || batch?.subject || "Subject",
          subjectCode: subject?.code || "",
          isMarked: true,
          markedAt: timeStr,
          sessionId: sess.id,
          presentCount: counts.present,
          absentCount: counts.absent,
          leaveCount: counts.leave,
          totalStudents: total,
          attendancePct: pct,
          source: "class_sessions",
        });
      });

      // B) Process direct attendance table records (Marked classes fallback)
      (directAtt || []).forEach((att: any) => {
        const key = `${att.marked_by}_${att.batch_id}`;
        if (handledKeys.has(key)) return;
        handledKeys.add(key);

        const tInfo = teacherMap.get(att.marked_by) || {
          name: "Teacher",
          email: "",
          departmentId: "",
          departmentName: "General",
        };
        const batch = bMap.get(att.batch_id);
        const recObj: Record<string, string> = att.records || {};
        const recEntries = Object.values(recObj);
        const presentCount = recEntries.filter((v) => v === "present").length;
        const absentCount = recEntries.filter((v) => v === "absent").length;
        const total = recEntries.length > 0 ? recEntries.length : batchCountMap[att.batch_id] || 0;
        const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        const timeStr = att.created_at
          ? new Date(att.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "Conducted";

        items.push({
          id: `att_${att.id}`,
          teacherId: att.marked_by,
          teacherName: tInfo.name,
          teacherEmail: tInfo.email,
          departmentId: tInfo.departmentId || batch?.department_id,
          departmentName: deptMap.get(tInfo.departmentId || batch?.department_id) || tInfo.departmentName,
          batchId: att.batch_id,
          batchName: batch?.name || "Batch",
          classLevel: batch?.class_level,
          subjectName: batch?.subject || "Subject",
          subjectCode: "",
          isMarked: true,
          markedAt: timeStr,
          presentCount,
          absentCount,
          leaveCount: 0,
          totalStudents: total,
          attendancePct: pct,
          source: "attendance_legacy",
          legacyRecords: recObj,
        });
      });

      // C) Process Assigned Classes that are Pending (Not marked yet today)
      // Check teaching_assignments
      teachingAssignments.forEach((ta: any) => {
        const key = `${ta.teacher_id}_${ta.batch_id}_${ta.subject_id || ""}`;
        const keyShort = `${ta.teacher_id}_${ta.batch_id}`;
        if (handledKeys.has(key) || handledKeys.has(keyShort)) return;
        handledKeys.add(key);
        handledKeys.add(keyShort);

        const tInfo = teacherMap.get(ta.teacher_id) || {
          name: "Teacher",
          email: "",
          departmentId: "",
          departmentName: "General",
        };
        const batch = bMap.get(ta.batch_id);
        const subject = subMap.get(ta.subject_id);
        const studentCount = batchCountMap[ta.batch_id] || 0;

        items.push({
          id: `pending_ta_${ta.teacher_id}_${ta.batch_id}_${ta.subject_id}`,
          teacherId: ta.teacher_id,
          teacherName: tInfo.name,
          teacherEmail: tInfo.email,
          departmentId: tInfo.departmentId || batch?.department_id,
          departmentName: deptMap.get(tInfo.departmentId || batch?.department_id) || tInfo.departmentName,
          batchId: ta.batch_id,
          batchName: batch?.name || "Batch",
          classLevel: batch?.class_level,
          subjectId: ta.subject_id,
          subjectName: subject?.name || batch?.subject || "Assigned Subject",
          subjectCode: subject?.code || "",
          isMarked: false,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          totalStudents: studentCount,
          attendancePct: 0,
        });
      });

      // Check teacher_batches for any remaining pending assignments
      teacherBatches.forEach((tb: any) => {
        const key = `${tb.teacher_id}_${tb.batch_id}`;
        if (handledKeys.has(key)) return;
        handledKeys.add(key);

        const tInfo = teacherMap.get(tb.teacher_id) || {
          name: "Teacher",
          email: "",
          departmentId: "",
          departmentName: "General",
        };
        const batch = bMap.get(tb.batch_id);
        const studentCount = batchCountMap[tb.batch_id] || 0;

        items.push({
          id: `pending_tb_${tb.teacher_id}_${tb.batch_id}`,
          teacherId: tb.teacher_id,
          teacherName: tInfo.name,
          teacherEmail: tInfo.email,
          departmentId: tInfo.departmentId || batch?.department_id,
          departmentName: deptMap.get(tInfo.departmentId || batch?.department_id) || tInfo.departmentName,
          batchId: tb.batch_id,
          batchName: batch?.name || "Batch",
          classLevel: batch?.class_level,
          subjectName: batch?.subject || "Subject",
          subjectCode: "",
          isMarked: false,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          totalStudents: studentCount,
          attendancePct: 0,
        });
      });

      // D) Fallback: if institute has batches & teachers without explicit assignments,
      // map teachers to batches matching their department
      if (items.length === 0 && (teachersData || []).length > 0 && (batchesData || []).length > 0) {
        (teachersData || []).forEach((t: any) => {
          const tId = t.user_id || t.id;
          const tInfo = teacherMap.get(tId);
          const deptBatches = (batchesData || []).filter((b: any) =>
            t.department_id ? b.department_id === t.department_id : true
          );
          deptBatches.slice(0, 3).forEach((b: any) => {
            const key = `${tId}_${b.id}`;
            if (handledKeys.has(key)) return;
            handledKeys.add(key);
            items.push({
              id: `fallback_${tId}_${b.id}`,
              teacherId: tId,
              teacherName: tInfo?.name || "Teacher",
              teacherEmail: tInfo?.email || "",
              departmentId: t.department_id,
              departmentName: deptMap.get(t.department_id) || "General",
              batchId: b.id,
              batchName: b.name,
              classLevel: b.class_level,
              subjectName: b.subject || "Subject",
              subjectCode: "",
              isMarked: false,
              presentCount: 0,
              absentCount: 0,
              leaveCount: 0,
              totalStudents: batchCountMap[b.id] || 0,
              attendancePct: 0,
            });
          });
        });
      }

      // Sort: Marked first, then by teacher name
      items.sort((a, b) => {
        if (a.isMarked !== b.isMarked) return a.isMarked ? -1 : 1;
        return a.teacherName.localeCompare(b.teacherName);
      });

      setTeacherItems(items);
    } catch (err: any) {
      console.error("Error loading daily teacher status:", err);
      showToast("Failed to load daily attendance: " + err.message, false);
    } finally {
      setLoadingDaily(false);
    }
  }, [instituteId, initialTeachers, initialBatches, initialDepartments, initialSubjects]);

  // Reload daily items whenever date changes
  useEffect(() => {
    loadDailyTeacherStatus(selectedDate);
  }, [selectedDate, loadDailyTeacherStatus]);

  /* ─────────────────────────────────────────────────────────────
     2. COMPUTED STATS & FILTERING FOR DAILY TEACHER ATTENDANCE
  ───────────────────────────────────────────────────────────── */
  const filteredTeacherItems = useMemo(() => {
    return teacherItems.filter((item) => {
      // Department filter
      if (selectedDeptId !== "all" && item.departmentId !== selectedDeptId) {
        return false;
      }
      // Status filter
      if (statusFilter === "marked" && !item.isMarked) return false;
      if (statusFilter === "pending" && item.isMarked) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.teacherName.toLowerCase().includes(q) ||
          item.teacherEmail.toLowerCase().includes(q) ||
          item.batchName.toLowerCase().includes(q) ||
          item.subjectName.toLowerCase().includes(q) ||
          item.subjectCode.toLowerCase().includes(q) ||
          item.departmentName.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [teacherItems, selectedDeptId, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalClasses = teacherItems.length;
    const marked = teacherItems.filter((i) => i.isMarked).length;
    const pending = totalClasses - marked;

    const uniqueTeachers = new Set(teacherItems.map((i) => i.teacherId)).size;
    const activeTeachers = new Set(teacherItems.filter((i) => i.isMarked).map((i) => i.teacherId)).size;

    const markedWithStudents = teacherItems.filter((i) => i.isMarked && i.totalStudents > 0);
    const avgAttendance =
      markedWithStudents.length > 0
        ? Math.round(markedWithStudents.reduce((acc, i) => acc + i.attendancePct, 0) / markedWithStudents.length)
        : 0;

    return {
      totalClasses,
      marked,
      pending,
      uniqueTeachers,
      activeTeachers,
      avgAttendance,
    };
  }, [teacherItems]);

  /* ── Date Navigator Helpers ── */
  const changeDateByDays = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().slice(0, 10));
  };

  /* ── Student Details Modal Loader ── */
  const openStudentDetailsModal = async (item: TeacherAttendanceItem) => {
    setModalSession(item);
    setModalLoading(true);
    setModalStudents([]);
    setModalStatusFilter("all");
    setModalSearch("");

    try {
      if (item.source === "class_sessions" && item.sessionId) {
        // Fetch from attendance_records + students
        const { data: recs } = await supabase
          .from("attendance_records")
          .select("student_id, status, students(id, name, roll_no)")
          .eq("session_id", item.sessionId);

        const list: StudentAttendanceRecord[] = (recs || []).map((r: any) => ({
          studentId: r.student_id,
          studentName: r.students?.name || "Student",
          rollNo: r.students?.roll_no || "—",
          status: r.status as any,
        }));
        list.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));
        setModalStudents(list);
      } else if (item.source === "attendance_legacy" && item.legacyRecords) {
        // Fetch students in this batch and match
        const { data: stus } = await supabase
          .from("students")
          .select("id, name, roll_no")
          .eq("batch_id", item.batchId)
          .eq("is_active", true);

        const list: StudentAttendanceRecord[] = (stus || []).map((s: any) => ({
          studentId: s.id,
          studentName: s.name,
          rollNo: s.roll_no || "—",
          status: (item.legacyRecords?.[s.id] as any) || "absent",
        }));
        list.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));
        setModalStudents(list);
      }
    } catch (e: any) {
      console.error("Modal fetch error:", e);
      showToast("Failed to load student breakdown", false);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredModalStudents = useMemo(() => {
    return modalStudents.filter((s) => {
      if (modalStatusFilter !== "all" && s.status !== modalStatusFilter) return false;
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        return s.studentName.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q);
      }
      return true;
    });
  }, [modalStudents, modalStatusFilter, modalSearch]);

  /* ── Export Daily Teacher Report (.xlsx) ── */
  const exportDailyTeacherExcel = () => {
    if (teacherItems.length === 0) {
      showToast("No records to export for this date", false);
      return;
    }

    const rows = filteredTeacherItems.map((item, idx) => ({
      "S. No": idx + 1,
      "Date": selectedDate,
      "Teacher Name": item.teacherName,
      "Email": item.teacherEmail,
      "Department": item.departmentName,
      "Batch / Class": item.batchName,
      "Subject": `${item.subjectName} ${item.subjectCode ? `(${item.subjectCode})` : ""}`,
      "Status": item.isMarked ? "Marked" : "Pending",
      "Present Students": item.isMarked ? item.presentCount : "—",
      "Absent Students": item.isMarked ? item.absentCount : "—",
      "Total Students": item.totalStudents,
      "Attendance %": item.isMarked ? `${item.attendancePct}%` : "—",
      "Marked Time": item.isMarked ? item.markedAt : "Not Marked",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teacher_Attendance");
    XLSX.writeFile(wb, `Teacher_Attendance_${selectedDate}.xlsx`);
    showToast("Teacher attendance report exported successfully!");
  };

  /* ─────────────────────────────────────────────────────────────
     3. LOAD MONTHLY STUDENT REPORT (PRESERVED AS REQUESTED)
  ───────────────────────────────────────────────────────────── */
  const loadMonthly = useCallback(async () => {
    if (!reportBatchId) return;
    setLoadingMonthly(true);
    try {
      const { data, error } = await supabase.rpc("get_monthly_attendance", {
        p_batch_id: reportBatchId,
        p_month: reportMonth,
        p_year: reportYear,
      });
      if (error) throw error;
      setMonthlyData(
        (data || []).map((r: any): MonthlyRow => ({
          studentId: r.student_id,
          studentName: r.student_name,
          rollNo: r.roll_no || "",
          subjectName: r.subject_name,
          subjectCode: r.subject_code,
          totalHeld: Number(r.total_held),
          totalPresent: Number(r.total_present),
          totalAbsent: Number(r.total_absent),
          percentage: Number(r.percentage),
        }))
      );
    } catch (e: any) {
      showToast("Failed to load monthly report: " + e.message, false);
    }
    setLoadingMonthly(false);
  }, [reportBatchId, reportMonth, reportYear]);

  useEffect(() => {
    if (activeTab === "monthly") loadMonthly();
  }, [activeTab, loadMonthly]);

  const pivotData = useMemo(() => {
    const subjects = [
      ...new Map(monthlyData.map((r) => [r.subjectCode, { name: r.subjectName, code: r.subjectCode }])).values(),
    ];
    const students = [
      ...new Map(monthlyData.map((r) => [r.studentId, { id: r.studentId, name: r.studentName, rollNo: r.rollNo }])).values(),
    ];
    students.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));
    const map = new Map<string, MonthlyRow>();
    monthlyData.forEach((r) => map.set(`${r.studentId}_${r.subjectCode}`, r));
    return { subjects, students, map };
  }, [monthlyData]);

  const exportMonthlyExcel = useCallback(() => {
    if (!reportBatchId || pivotData.students.length === 0) {
      showToast("No data to export", false);
      return;
    }
    const batch = batchesList.find((b) => b.id === reportBatchId);
    const { subjects, students, map } = pivotData;

    const sectionInfo = [`${batch?.name || "Batch"}   ${MONTHS[reportMonth - 1]} ${reportYear}`];
    const headerRow1 = ["S. No", "Roll no", "Name of the student"];
    const headerRow2 = ["", "", ""];
    const headerRow3 = ["", "", ""];
    subjects.forEach((sub) => {
      headerRow1.push(sub.code, "");
      headerRow2.push(sub.name.slice(0, 20), "");
      headerRow3.push("H", "A");
    });
    headerRow1.push("Grand Total", "", "%", "Sign");
    headerRow2.push("", "", "", "");
    headerRow3.push("Total H", "Total A", "", "");

    const rows = students.map((stu, idx) => {
      const row: (string | number)[] = [idx + 1, stu.rollNo, stu.name];
      let grandH = 0, grandA = 0;
      subjects.forEach((sub) => {
        const d = map.get(`${stu.id}_${sub.code}`);
        const held = d?.totalHeld ?? 0;
        const absent = d?.totalAbsent ?? 0;
        row.push(held, absent);
        grandH += held;
        grandA += absent;
      });
      const pct = grandH > 0 ? parseFloat((((grandH - grandA) / grandH) * 100).toFixed(2)) : 0;
      row.push(grandH, grandA, pct, "");
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([sectionInfo, headerRow1, headerRow2, headerRow3, ...rows]);
    const totalCols = 3 + subjects.length * 2 + 4;
    ws["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 26 },
      ...subjects.flatMap(() => [{ wch: 6 }, { wch: 6 }]),
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 14 },
    ];
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${batch?.name || "Batch"} ${MONTHS_SHORT[reportMonth - 1]} ${reportYear}`.slice(0, 31));
    XLSX.writeFile(wb, `Attendance_${batch?.name || "Batch"}_${MONTHS_SHORT[reportMonth - 1]}_${reportYear}.xlsx`);
    showToast("Monthly Excel exported");
  }, [reportBatchId, pivotData, batchesList, reportMonth, reportYear]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[9999] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl flex items-center gap-2 animate-bounce"
          style={{ background: toast.ok ? "#1E293B" : "#991B1B" }}
        >
          {toast.ok ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* ── TOP SECTION TOGGLE TABS (DAILY TEACHERS vs STUDENT MONTHLY) ── */}
      <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab("teachers")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-black transition-all ${
              activeTab === "teachers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4 text-orange-500" />
            <span>Daily Teacher Attendance</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-700">
              Daily Tracking
            </span>
          </button>

          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-black transition-all ${
              activeTab === "monthly"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-indigo-500" />
            <span>Student Monthly Report</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
              Batch Wise
            </span>
          </button>
        </div>

        {activeTab === "teachers" && (
          <button
            onClick={exportDailyTeacherExcel}
            disabled={teacherItems.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
            style={{ background: "linear-gradient(135deg, #FF7043, #E64A19)" }}
          >
            <Download className="w-4 h-4" />
            <span>Export Day Sheet</span>
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: DAILY TEACHER ATTENDANCE TRACKER
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === "teachers" && (
        <div className="space-y-6">
          {/* ── KPI EXECUTIVE SUMMARY BAR ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Marked Classes</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.marked}</span>
                  <span className="text-xs text-slate-400 font-bold">/ {stats.totalClasses} total</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${stats.totalClasses > 0 ? (stats.marked / stats.totalClasses) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Classes</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-600">{stats.pending}</span>
                  <span className="text-xs text-slate-400 font-bold">awaiting marking</span>
                </div>
                <p className="text-[11px] text-amber-600 font-bold mt-2">
                  {stats.pending === 0 ? "✓ All classes marked" : "Action required"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Teachers</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-indigo-600">{stats.activeTeachers}</span>
                  <span className="text-xs text-slate-400 font-bold">/ {stats.uniqueTeachers} teachers</span>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">filled attendance today</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Attendance</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-2xl sm:text-3xl font-black ${stats.avgAttendance >= 75 ? "text-emerald-600" : "text-amber-600"}`}>
                    {stats.avgAttendance}%
                  </span>
                  <span className="text-xs text-slate-400 font-bold">student presence</span>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">across marked lectures</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ── CONTROLS, DATE & FILTERS BAR ── */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Date Navigator */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => changeDateByDays(-1)}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(today)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      selectedDate === today ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => changeDateByDays(1)}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => loadDailyTeacherStatus(selectedDate)}
                  disabled={loadingDaily}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  title="Reload today's data"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDaily ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Department & Status Filters */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Department dropdown */}
                <div className="relative">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {departmentList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Toggle Pills */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500"
                    }`}
                  >
                    All ({teacherItems.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("marked")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      statusFilter === "marked" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-500"
                    }`}
                  >
                    Marked ({stats.marked})
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      statusFilter === "pending" ? "bg-white text-amber-700 shadow-xs font-black" : "text-slate-500"
                    }`}
                  >
                    Pending ({stats.pending})
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by teacher name, subject, or class batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── TEACHER ATTENDANCE LIST / CARDS ── */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Faculty Marking Log • {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredTeacherItems.length} class sessions matching your filters
                </p>
              </div>
            </div>

            {loadingDaily ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-bold">Loading teacher attendance records...</p>
              </div>
            ) : filteredTeacherItems.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7" />
                </div>
                <p className="text-slate-700 font-extrabold text-sm sm:text-base">No teacher classes found</p>
                <p className="text-slate-400 text-xs mt-1">Try switching the date, department, or clearing your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTeacherItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      item.isMarked
                        ? "border-emerald-200/70 bg-emerald-50/20 hover:border-emerald-300"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                    }`}
                  >
                    {/* Left: Teacher & Class details */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      {/* Avatar */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-xs ${
                          item.isMarked ? "bg-emerald-600" : "bg-slate-400"
                        }`}
                      >
                        {item.teacherName.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">
                            {item.teacherName}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                            {item.departmentName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-orange-500" />
                            {item.batchName}
                          </span>

                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-indigo-500" />
                            {item.subjectName} {item.subjectCode && `(${item.subjectCode})`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Marking status & counts */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60">
                      {item.isMarked ? (
                        <>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span
                                className={`text-base font-black ${
                                  item.attendancePct >= 75
                                    ? "text-emerald-600"
                                    : item.attendancePct >= 50
                                    ? "text-amber-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {item.attendancePct}%
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Marked
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                              {item.presentCount} Present / {item.totalStudents} Total • {item.markedAt}
                            </p>
                          </div>

                          <button
                            onClick={() => openStudentDetailsModal(item)}
                            className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs transition-colors cursor-pointer"
                          >
                            View Students
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending
                            </span>
                            <p className="text-[11px] text-slate-400 font-semibold mt-1">
                              {item.totalStudents > 0 ? `${item.totalStudents} students enrolled` : "No session recorded"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: STUDENT MONTHLY REPORT (PRESERVED)
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === "monthly" && (
        <div className="bg-white rounded-2xl p-5 sm:p-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="text-[16px] font-bold text-slate-800">Monthly attendance report</h3>
              <p className="text-xs text-slate-400 mt-0.5">View and export any batch's attendance for any month</p>
            </div>
            <button
              onClick={exportMonthlyExcel}
              disabled={!reportBatchId || pivotData.students.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              style={{ background: "linear-gradient(135deg, #FF7043, #E64A19)" }}
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <select
              value={reportBatchId}
              onChange={(e) => setReportBatchId(e.target.value)}
              className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
            >
              <option value="">Select batch…</option>
              {batchesList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (reportMonth === 1) {
                    setReportMonth(12);
                    setReportYear((y) => y - 1);
                  } else setReportMonth((m) => m - 1);
                }}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl py-2.5">
                {MONTHS[reportMonth - 1]} {reportYear}
              </div>
              <button
                onClick={() => {
                  if (reportMonth === 12) {
                    setReportMonth(1);
                    setReportYear((y) => y + 1);
                  } else setReportMonth((m) => m + 1);
                }}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              {reportBatchId && !loadingMonthly && (
                <span>
                  {pivotData.students.length} students • {pivotData.subjects.length} subjects
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          {!reportBatchId ? (
            <div className="text-center py-10 text-slate-400 text-sm">Select a batch to view the monthly report.</div>
          ) : loadingMonthly ? (
            <p className="text-center py-8 text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading report…
            </p>
          ) : pivotData.students.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">
              No attendance data for {MONTHS[reportMonth - 1]} {reportYear}.
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                      <th style={{ textAlign: "left", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>#</th>
                      <th style={{ textAlign: "left", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Student</th>
                      {pivotData.subjects.map((sub) => (
                        <th key={sub.code} style={{ textAlign: "center", padding: "8px 4px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 60 }}>
                          <span style={{ display: "block" }}>{sub.code}</span>
                          <span style={{ display: "block", fontWeight: 400, fontSize: 9, color: "#cbd5e1", textTransform: "none", letterSpacing: 0 }}>{sub.name.slice(0, 10)}</span>
                        </th>
                      ))}
                      <th style={{ textAlign: "center", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 64 }}>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.students.map((stu, idx) => {
                      let totalH = 0, totalA = 0;
                      return (
                        <tr key={stu.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "8px 8px", color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                          <td style={{ padding: "8px 8px" }}>
                            <p style={{ fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>{stu.name}</p>
                            {stu.rollNo && <p style={{ fontSize: 10, color: "#94a3b8" }}>{stu.rollNo}</p>}
                          </td>
                          {pivotData.subjects.map((sub) => {
                            const d = pivotData.map.get(`${stu.id}_${sub.code}`);
                            const pct = d?.percentage ?? 0;
                            totalH += d?.totalHeld ?? 0;
                            totalA += d?.totalAbsent ?? 0;
                            return (
                              <td key={sub.code} style={{ textAlign: "center", padding: "8px 4px" }}>
                                {d && d.totalHeld > 0 ? (
                                  <>
                                    <span style={{ fontWeight: 800, color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626", display: "block" }}>{pct}%</span>
                                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{d.totalPresent}/{d.totalHeld}</span>
                                  </>
                                ) : (
                                  <span style={{ color: "#e2e8f0" }}>—</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center", padding: "8px 8px" }}>
                            {(() => {
                              const op = totalH > 0 ? Math.round(((totalH - totalA) / totalH) * 100) : 0;
                              return totalH > 0 ? (
                                <>
                                  <span style={{ fontWeight: 800, color: op >= 75 ? "#16a34a" : op >= 50 ? "#d97706" : "#dc2626", display: "block" }}>{op}%</span>
                                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{totalH - totalA}/{totalH}</span>
                                </>
                              ) : (
                                <span style={{ color: "#e2e8f0" }}>—</span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Below-75% warning */}
              {(() => {
                const low = pivotData.students.filter((stu) => {
                  let h = 0, a = 0;
                  pivotData.subjects.forEach((sub) => {
                    const d = pivotData.map.get(`${stu.id}_${sub.code}`);
                    h += d?.totalHeld ?? 0;
                    a += d?.totalAbsent ?? 0;
                  });
                  return h > 0 && ((h - a) / h) * 100 < 75;
                });
                if (low.length === 0) return null;
                return (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", borderLeft: "3px solid #fca5a5", borderRadius: "0 8px 8px 0" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                      ⚠ Below 75% overall attendance ({low.length} students)
                    </p>
                    <p style={{ fontSize: 11, color: "#ef4444" }}>{low.map((s) => s.name).join(", ")}</p>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          STUDENT ATTENDANCE BREAKDOWN MODAL
      ═══════════════════════════════════════════════════════════ */}
      {modalSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                    Conducted Lecture
                  </span>
                  <span className="text-xs text-slate-400 font-bold">{modalSession.markedAt}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {modalSession.subjectName} • {modalSession.batchName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Teacher: <strong>{modalSession.teacherName}</strong> ({modalSession.departmentName})
                </p>
              </div>
              <button
                onClick={() => setModalSession(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Quick Filter Bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-white">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setModalStatusFilter("all")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalStatusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500"
                  }`}
                >
                  All ({modalStudents.length})
                </button>
                <button
                  onClick={() => setModalStatusFilter("present")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalStatusFilter === "present" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-500"
                  }`}
                >
                  Present ({modalStudents.filter((s) => s.status === "present").length})
                </button>
                <button
                  onClick={() => setModalStatusFilter("absent")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalStatusFilter === "absent" ? "bg-white text-rose-700 shadow-xs font-black" : "text-slate-500"
                  }`}
                >
                  Absent ({modalStudents.filter((s) => s.status === "absent").length})
                </button>
              </div>

              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter student..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none"
                />
              </div>
            </div>

            {/* Modal Body: Student List */}
            <div className="overflow-y-auto p-5 space-y-2 flex-1">
              {modalLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                  <span>Loading student attendance...</span>
                </div>
              ) : filteredModalStudents.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">No students found matching filter.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredModalStudents.map((s, idx) => (
                    <div key={s.studentId || idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-bold text-slate-400">{idx + 1}</span>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-slate-800">{s.studentName}</p>
                          <p className="text-[11px] text-slate-400 font-medium">Roll No: {s.rollNo}</p>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                          s.status === "present"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "absent"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {s.status === "present" ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" /> Present
                          </>
                        ) : s.status === "absent" ? (
                          <>
                            <UserX className="w-3.5 h-3.5" /> Absent
                          </>
                        ) : (
                          "Leave"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Total in lecture: {modalStudents.length} students</span>
              <button
                onClick={() => setModalSession(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-extrabold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}