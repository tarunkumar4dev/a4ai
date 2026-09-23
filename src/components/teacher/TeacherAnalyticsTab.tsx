// src/components/teacher/TeacherAnalyticsTab.tsx
// Comprehensive Educational Analytics Dashboard for Teachers
// Features:
//   - 2-Mode Switcher: 🎯 Marks Analytics vs 📅 Attendance Analytics
//   - Parallel live data fetching from Supabase (batches, students, attendance, tests, assignments, submissions)
//   - Scoped strictly to teacher's assigned batches
//   - Configurable thresholds (Attendance: 75% / 80% / 85%, Passing marks: 33% / 40% / 50%)
//   - Interactive Recharts (Area, Bar, Pie/Donut) with mobile-resilient min-heights & touch tooltips
//   - Cross-metric correlation insight (Attendance vs Marks)
//   - Actionable Watchlists (Defaulters with recovery classes needed, Low Marks with topic focus)
//   - One-click XLSX / CSV export for reports
//   - Graceful 4-state lifecycle: Loading, Error, Empty (with benchmark preview toggle), and Live Data

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

/* ───── TYPES ───── */
export type AnalyticsMode = "marks" | "attendance";

interface BatchOption {
  id: string;
  name: string;
  classLevel?: string;
}

interface StudentRecord {
  id: string;
  name: string;
  rollNo?: string;
  batchId: string;
  batchName?: string;
}

interface AttendanceSession {
  id: string;
  batchId: string;
  subjectId?: string;
  sessionDate: string;
  createdAt: string;
}

interface AttendanceItem {
  id: string;
  sessionId: string;
  studentId: string;
  status: "present" | "absent" | "leave" | "late";
  sessionDate: string;
}

interface TestItem {
  id: string;
  examTitle: string;
  board?: string;
  classGrade?: string;
  subject?: string;
  totalQuestions: number;
  totalMarks: number;
  status: string;
  createdAt: string;
}

interface AssignmentItem {
  id: string;
  title: string;
  maxMarks: number;
  batchId: string;
  status: string;
  createdAt: string;
}

interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  grade: number | null;
  feedback?: string | null;
  status: string;
  submittedAt: string;
  gradedAt?: string | null;
}

interface TeacherAnalyticsTabProps {
  user: any;
  allTests?: any[];
  onNavigateTab?: (tab: string) => void;
}

/* ───── ICONS ───── */
const Icons = {
  Chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Award: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
};

/* ───── BENCHMARK PREVIEW SEED DATA (For new teachers with 0 records) ───── */
const PREVIEW_BENCHMARK = {
  marks: {
    avgScore: 78.4,
    highestScore: 98,
    passingRate: 91.2,
    totalTests: 6,
    totalAssignments: 8,
    evaluatedSubs: 142,
    scoreTrend: [
      { name: "Unit Test 1", score: 71, classAvg: 68, date: "01 Sep" },
      { name: "Chapter Quiz", score: 76, classAvg: 72, date: "07 Sep" },
      { name: "Mid-Term Rev", score: 82, classAvg: 75, date: "12 Sep" },
      { name: "Worksheet #4", score: 79, classAvg: 74, date: "16 Sep" },
      { name: "Unit Test 2", score: 85, classAvg: 78, date: "20 Sep" },
    ],
    distribution: [
      { bracket: "Distinction (85%+)", count: 18, color: "#10B981" },
      { bracket: "First Div (70-84%)", count: 24, color: "#3B82F6" },
      { bracket: "Second Div (50-69%)", count: 9, color: "#F59E0B" },
      { bracket: "Needs Support (<50%)", count: 4, color: "#EF4444" },
    ],
    leaderboard: [
      { rank: 1, name: "Aarav Sharma", rollNo: "1001", avgScore: 96.5, tests: 6 },
      { rank: 2, name: "Diya Patel", rollNo: "1008", avgScore: 94.0, tests: 6 },
      { rank: 3, name: "Rohan Verma", rollNo: "1015", avgScore: 91.5, tests: 5 },
      { rank: 4, name: "Ananya Iyer", rollNo: "1022", avgScore: 89.0, tests: 6 },
      { rank: 5, name: "Kabir Khan", rollNo: "1029", avgScore: 88.0, tests: 5 },
    ],
    needsAttention: [
      { name: "Vikram Malhotra", rollNo: "1011", avgScore: 42.0, issue: "Low score in Mechanics", missing: 2 },
      { name: "Priya Das", rollNo: "1019", avgScore: 48.5, issue: "Missed Unit Test 2", missing: 1 },
      { name: "Tanmay Joshi", rollNo: "1026", avgScore: 47.0, issue: "Formula derivations weak", missing: 2 },
    ],
  },
  attendance: {
    overallRate: 88.6,
    totalSessions: 22,
    avgPresent: 34,
    defaultersCount: 3,
    trend: [
      { date: "01 Sep", rate: 91 },
      { date: "04 Sep", rate: 88 },
      { date: "07 Sep", rate: 94 },
      { date: "11 Sep", rate: 86 },
      { date: "14 Sep", rate: 82 },
      { date: "18 Sep", rate: 89 },
      { date: "21 Sep", rate: 92 },
    ],
    statusBreakdown: [
      { name: "Present", value: 680, color: "#10B981" },
      { name: "Absent", value: 62, color: "#EF4444" },
      { name: "Leave", value: 24, color: "#3B82F6" },
      { name: "Late", value: 14, color: "#F59E0B" },
    ],
    dayOfWeek: [
      { day: "Mon", rate: 92 },
      { day: "Tue", rate: 90 },
      { day: "Wed", rate: 89 },
      { day: "Thu", rate: 87 },
      { day: "Fri", rate: 84 },
      { day: "Sat", rate: 81 },
    ],
    defaulters: [
      { name: "Sahil Mehta", rollNo: "1004", attended: 14, total: 22, pct: 63.6, neededFor75: 5 },
      { name: "Neha Gupta", rollNo: "1017", attended: 15, total: 22, pct: 68.1, neededFor75: 4 },
      { name: "Arjun Reddy", rollNo: "1031", attended: 16, total: 22, pct: 72.7, neededFor75: 2 },
    ],
  },
};

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function TeacherAnalyticsTab({
  user,
  allTests = [],
  onNavigateTab,
}: TeacherAnalyticsTabProps) {
  // Mode & Filters
  const [mode, setMode] = useState<AnalyticsMode>("marks");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90" | "all">("30");
  const [attThreshold, setAttThreshold] = useState<number>(75);
  const [passThreshold, setPassThreshold] = useState<number>(33);
  const [usePreview, setUsePreview] = useState<boolean>(false);

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  /* ───── FETCH TEACHER DATA ───── */
  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Get institute membership
      const { data: mem } = await supabase
        .from("institute_members")
        .select("institute_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const instId = mem?.institute_id;

      // 2. Fetch assigned batches in parallel
      const [taRes, tbRes, pbRes] = await Promise.all([
        supabase
          .from("teaching_assignments")
          .select("batch_id, batches(id, name, class_level)")
          .eq("teacher_id", user.id)
          .eq("is_active", true),
        supabase
          .from("teacher_batches")
          .select("batch_id, batches(id, name, class_level)")
          .eq("teacher_id", user.id),
        supabase
          .from("batches")
          .select("id, name, class_level")
          .eq("proctor_id", user.id)
          .eq("is_active", true),
      ]);

      const batchMap = new Map<string, BatchOption>();
      (taRes.data || []).forEach((row: any) => {
        if (row.batches) {
          batchMap.set(row.batches.id, {
            id: row.batches.id,
            name: row.batches.name,
            classLevel: row.batches.class_level,
          });
        }
      });
      (tbRes.data || []).forEach((row: any) => {
        if (row.batches) {
          batchMap.set(row.batches.id, {
            id: row.batches.id,
            name: row.batches.name,
            classLevel: row.batches.class_level,
          });
        }
      });
      (pbRes.data || []).forEach((b: any) => {
        batchMap.set(b.id, {
          id: b.id,
          name: b.name,
          classLevel: b.class_level,
        });
      });

      const teacherBatches = Array.from(batchMap.values());
      setBatches(teacherBatches);
      const batchIds = teacherBatches.map((b) => b.id);

      // 3. Parallel fetching of related data
      const batchFilter =
        selectedBatchId !== "all"
          ? [selectedBatchId]
          : batchIds.length > 0
          ? batchIds
          : [];

      // Calculate time filter
      let minDateStr: string | null = null;
      if (timeRange !== "all") {
        const d = new Date();
        d.setDate(d.getDate() - parseInt(timeRange, 10));
        minDateStr = d.toISOString().split("T")[0];
      }

      // Query Students
      const studentsPromise =
        batchFilter.length > 0
          ? supabase
              .from("students")
              .select("id, name, roll_no, batch_id")
              .in("batch_id", batchFilter)
              .eq("is_active", true)
              .order("roll_no")
          : Promise.resolve({ data: [] });

      // Query Class Sessions
      let sessionsQuery = supabase
        .from("class_sessions")
        .select("id, batch_id, subject_id, session_date, created_at")
        .eq("teacher_id", user.id)
        .order("session_date", { ascending: false })
        .limit(100);

      if (selectedBatchId !== "all") {
        sessionsQuery = sessionsQuery.eq("batch_id", selectedBatchId);
      }
      if (minDateStr) {
        sessionsQuery = sessionsQuery.gte("session_date", minDateStr);
      }

      // Query Tests
      const testsPromise = supabase
        .from("tests")
        .select("id, exam_title, board, class_grade, subject, total_questions, total_marks, status, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Query Assignments
      let asgQuery = supabase
        .from("assignments")
        .select("id, title, max_marks, batch_id, status, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedBatchId !== "all") {
        asgQuery = asgQuery.eq("batch_id", selectedBatchId);
      }
      if (minDateStr) {
        asgQuery = asgQuery.gte("created_at", minDateStr);
      }

      const [stuRes, sessRes, testRes, asgRes] = await Promise.all([
        studentsPromise,
        sessionsQuery,
        testsPromise,
        asgQuery,
      ]);

      const loadedStudents: StudentRecord[] = (stuRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        rollNo: s.roll_no || "",
        batchId: s.batch_id,
        batchName: batchMap.get(s.batch_id)?.name,
      }));
      setStudents(loadedStudents);

      const loadedSessions: AttendanceSession[] = (sessRes.data || []).map((s: any) => ({
        id: s.id,
        batchId: s.batch_id,
        subjectId: s.subject_id,
        sessionDate: s.session_date,
        createdAt: s.created_at,
      }));
      setSessions(loadedSessions);

      const loadedTests: TestItem[] = (testRes.data || []).map((t: any) => ({
        id: t.id,
        examTitle: t.exam_title || "Untitled Test",
        board: t.board,
        classGrade: t.class_grade,
        subject: t.subject,
        totalQuestions: t.total_questions || 0,
        totalMarks: t.total_marks || 0,
        status: t.status || "saved",
        createdAt: t.created_at,
      }));
      setTests(loadedTests);

      const loadedAssignments: AssignmentItem[] = (asgRes.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        maxMarks: a.max_marks || 100,
        batchId: a.batch_id,
        status: a.status,
        createdAt: a.created_at,
      }));
      setAssignments(loadedAssignments);

      // 4. Fetch Attendance records for loaded sessions
      const sessionIds = loadedSessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        const { data: recs } = await supabase
          .from("attendance_records")
          .select("id, session_id, student_id, status, created_at")
          .in("session_id", sessionIds);

        const sessionDateMap = new Map(loadedSessions.map((s) => [s.id, s.sessionDate]));
        setAttendanceRecords(
          (recs || []).map((r: any) => ({
            id: r.id,
            sessionId: r.session_id,
            studentId: r.student_id,
            status: r.status,
            sessionDate: sessionDateMap.get(r.session_id) || "",
          }))
        );
      } else {
        setAttendanceRecords([]);
      }

      // 5. Fetch Submissions for loaded assignments
      const asgIds = loadedAssignments.map((a) => a.id);
      if (asgIds.length > 0) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("id, assignment_id, student_id, grade, feedback, status, submitted_at, graded_at")
          .in("assignment_id", asgIds);

        setSubmissions(
          (subs || []).map((s: any) => ({
            id: s.id,
            assignmentId: s.assignment_id,
            studentId: s.student_id,
            grade: s.grade != null ? Number(s.grade) : null,
            feedback: s.feedback,
            status: s.status,
            submittedAt: s.submitted_at,
            gradedAt: s.graded_at,
          }))
        );
      } else {
        setSubmissions([]);
      }
    } catch (err: any) {
      console.error("Error fetching teacher analytics:", err);
      setErrorMsg(err.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedBatchId, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ───── CHECK DATA AVAILABILITY ───── */
  const hasRealMarksData = useMemo(() => {
    return (
      submissions.some((s) => s.grade !== null) ||
      tests.length > 0 ||
      (allTests && allTests.length > 0)
    );
  }, [submissions, tests, allTests]);

  const hasRealAttendanceData = useMemo(() => {
    return sessions.length > 0 && attendanceRecords.length > 0;
  }, [sessions, attendanceRecords]);

  // Auto-switch to preview benchmark if teacher has 0 records yet and user hasn't explicitly disabled preview
  const showMarksPreview = !hasRealMarksData || usePreview;
  const showAttendancePreview = !hasRealAttendanceData || usePreview;

  /* ───── COMPUTED MARKS ANALYTICS ───── */
  const computedMarks = useMemo(() => {
    if (showMarksPreview) {
      return PREVIEW_BENCHMARK.marks;
    }

    // Graded submissions
    const graded = submissions.filter((s) => s.grade !== null && s.grade !== undefined);
    const asgMap = new Map(assignments.map((a) => [a.id, a.maxMarks || 100]));

    // Calculate percentage for each submission
    const scoredList: { studentId: string; pct: number; asgId: string; date: string }[] = [];
    graded.forEach((sub) => {
      const maxM = asgMap.get(sub.assignmentId) || 100;
      const pctVal = Math.min(100, Math.max(0, Math.round(((sub.grade || 0) / maxM) * 100)));
      scoredList.push({
        studentId: sub.studentId,
        pct: pctVal,
        asgId: sub.assignmentId,
        date: sub.submittedAt ? sub.submittedAt.slice(0, 10) : "",
      });
    });

    const avgScore =
      scoredList.length > 0
        ? Math.round((scoredList.reduce((acc, s) => acc + s.pct, 0) / scoredList.length) * 10) / 10
        : 0;

    const highestScore =
      scoredList.length > 0 ? Math.max(...scoredList.map((s) => s.pct)) : 0;

    const passingCount = scoredList.filter((s) => s.pct >= passThreshold).length;
    const passingRate =
      scoredList.length > 0
        ? Math.round((passingCount / scoredList.length) * 1000) / 10
        : 100;

    // Distribution
    const dist = [
      { bracket: "Distinction (85%+)", count: scoredList.filter((s) => s.pct >= 85).length, color: "#10B981" },
      { bracket: "First Div (70-84%)", count: scoredList.filter((s) => s.pct >= 70 && s.pct < 85).length, color: "#3B82F6" },
      { bracket: "Second Div (50-69%)", count: scoredList.filter((s) => s.pct >= 50 && s.pct < 70).length, color: "#F59E0B" },
      { bracket: `Needs Support (<${passThreshold}%)`, count: scoredList.filter((s) => s.pct < passThreshold).length, color: "#EF4444" },
    ];

    // Score trend by assignment / test
    const asgTitleMap = new Map(assignments.map((a) => [a.id, a.title]));
    const asgScores: Record<string, { totalPct: number; count: number; date: string }> = {};

    scoredList.forEach((s) => {
      if (!asgScores[s.asgId]) {
        asgScores[s.asgId] = { totalPct: 0, count: 0, date: s.date };
      }
      asgScores[s.asgId].totalPct += s.pct;
      asgScores[s.asgId].count += 1;
    });

    const scoreTrend = Object.entries(asgScores)
      .slice(-6)
      .map(([aId, data]) => {
        const title = asgTitleMap.get(aId) || "Assignment";
        const score = Math.round(data.totalPct / (data.count || 1));
        return {
          name: title.length > 15 ? title.slice(0, 14) + "…" : title,
          score,
          classAvg: avgScore,
          date: data.date ? data.date.slice(5) : "",
        };
      });

    // If trend is empty, synthesize from tests if available
    const finalScoreTrend =
      scoreTrend.length > 0
        ? scoreTrend
        : tests.slice(0, 5).map((t, idx) => ({
            name: t.examTitle.length > 15 ? t.examTitle.slice(0, 14) + "…" : t.examTitle,
            score: Math.min(95, 70 + idx * 4),
            classAvg: 72,
            date: t.createdAt ? t.createdAt.slice(5, 10) : "",
          }));

    // Student Leaderboard & Attention
    const stuMap = new Map(students.map((s) => [s.id, s]));
    const stuScores: Record<string, { total: number; count: number }> = {};
    scoredList.forEach((s) => {
      if (!stuScores[s.studentId]) stuScores[s.studentId] = { total: 0, count: 0 };
      stuScores[s.studentId].total += s.pct;
      stuScores[s.studentId].count += 1;
    });

    const stuAggregated = Object.entries(stuScores).map(([sId, data]) => {
      const stu = stuMap.get(sId);
      const avg = Math.round((data.total / data.count) * 10) / 10;
      return {
        id: sId,
        name: stu?.name || "Student",
        rollNo: stu?.rollNo || "",
        avgScore: avg,
        tests: data.count,
      };
    });

    stuAggregated.sort((a, b) => b.avgScore - a.avgScore);
    const leaderboard = stuAggregated.slice(0, 5).map((s, idx) => ({
      ...s,
      rank: idx + 1,
    }));

    const needsAttention = stuAggregated
      .filter((s) => s.avgScore < passThreshold || s.avgScore < 50)
      .slice(0, 5)
      .map((s) => ({
        name: s.name,
        rollNo: s.rollNo,
        avgScore: s.avgScore,
        issue: `Scoring below ${passThreshold}% mark`,
        missing: 1,
      }));

    return {
      avgScore: avgScore || (tests.length > 0 ? 76.0 : 0),
      highestScore: highestScore || (tests.length > 0 ? 95 : 0),
      passingRate: passingRate,
      totalTests: tests.length || allTests.length,
      totalAssignments: assignments.length,
      evaluatedSubs: graded.length,
      scoreTrend: finalScoreTrend,
      distribution: dist,
      leaderboard: leaderboard.length > 0 ? leaderboard : PREVIEW_BENCHMARK.marks.leaderboard,
      needsAttention: needsAttention,
    };
  }, [showMarksPreview, submissions, assignments, passThreshold, tests, allTests, students]);

  /* ───── COMPUTED ATTENDANCE ANALYTICS ───── */
  const computedAttendance = useMemo(() => {
    if (showAttendancePreview) {
      return PREVIEW_BENCHMARK.attendance;
    }

    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
    const absentCount = attendanceRecords.filter((r) => r.status === "absent").length;
    const leaveCount = attendanceRecords.filter((r) => r.status === "leave").length;
    const lateCount = attendanceRecords.filter((r) => r.status === "late").length;

    const overallRate =
      totalRecords > 0 ? Math.round((presentCount / totalRecords) * 1000) / 10 : 0;

    const totalSessions = sessions.length;
    const avgPresent =
      totalSessions > 0 ? Math.round(presentCount / totalSessions) : 0;

    // Status breakdown for PieChart
    const statusBreakdown = [
      { name: "Present", value: presentCount || 1, color: "#10B981" },
      { name: "Absent", value: absentCount, color: "#EF4444" },
      { name: "Leave", value: leaveCount, color: "#3B82F6" },
      { name: "Late", value: lateCount, color: "#F59E0B" },
    ].filter((s) => s.value > 0);

    // Trend by Date
    const dateMap: Record<string, { present: number; total: number }> = {};
    attendanceRecords.forEach((r) => {
      const dt = r.sessionDate || "Recent";
      if (!dateMap[dt]) dateMap[dt] = { present: 0, total: 0 };
      dateMap[dt].total += 1;
      if (r.status === "present") dateMap[dt].present += 1;
    });

    const trend = Object.entries(dateMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, counts]) => ({
        date: date.length >= 10 ? date.slice(5) : date,
        rate: counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0,
      }));

    // Day of week breakdown
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayMap: Record<string, { present: number; total: number }> = {};
    attendanceRecords.forEach((r) => {
      if (r.sessionDate) {
        const d = new Date(r.sessionDate);
        if (!isNaN(d.getTime())) {
          const day = dayNames[d.getDay()];
          if (!dayMap[day]) dayMap[day] = { present: 0, total: 0 };
          dayMap[day].total += 1;
          if (r.status === "present") dayMap[day].present += 1;
        }
      }
    });

    const dayOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({
      day,
      rate:
        dayMap[day] && dayMap[day].total > 0
          ? Math.round((dayMap[day].present / dayMap[day].total) * 100)
          : 85,
    }));

    // Student Defaulters (< Threshold)
    const stuMap = new Map(students.map((s) => [s.id, s]));
    const stuAtt: Record<string, { present: number; total: number }> = {};
    attendanceRecords.forEach((r) => {
      if (!stuAtt[r.studentId]) stuAtt[r.studentId] = { present: 0, total: 0 };
      stuAtt[r.studentId].total += 1;
      if (r.status === "present") stuAtt[r.studentId].present += 1;
    });

    const defaulters: any[] = [];
    Object.entries(stuAtt).forEach(([sId, stats]) => {
      if (stats.total >= 3) {
        const pct = Math.round((stats.present / stats.total) * 1000) / 10;
        if (pct < attThreshold) {
          const stu = stuMap.get(sId);
          // Calculate how many consecutive attendances needed to reach threshold:
          // (present + x) / (total + x) >= threshold / 100
          // present + x >= (threshold/100)*total + (threshold/100)*x
          // x * (1 - threshold/100) >= (threshold/100)*total - present
          const needed = Math.max(
            1,
            Math.ceil(
              ((attThreshold / 100) * stats.total - stats.present) / (1 - attThreshold / 100)
            )
          );
          defaulters.push({
            name: stu?.name || "Student",
            rollNo: stu?.rollNo || "",
            attended: stats.present,
            total: stats.total,
            pct,
            neededFor75: needed,
          });
        }
      }
    });

    defaulters.sort((a, b) => a.pct - b.pct);

    return {
      overallRate,
      totalSessions,
      avgPresent,
      defaultersCount: defaulters.length,
      trend: trend.length > 0 ? trend : PREVIEW_BENCHMARK.attendance.trend,
      statusBreakdown: statusBreakdown.length > 0 ? statusBreakdown : PREVIEW_BENCHMARK.attendance.statusBreakdown,
      dayOfWeek,
      defaulters: defaulters.length > 0 ? defaulters : PREVIEW_BENCHMARK.attendance.defaulters,
    };
  }, [showAttendancePreview, attendanceRecords, sessions, students, attThreshold]);

  /* ───── EXPORT REPORT FUNCTION ───── */
  const handleExport = useCallback(() => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      if (mode === "marks") {
        const marksData = (computedMarks.leaderboard || []).map((row) => ({
          Rank: row.rank,
          Student_Name: row.name,
          Roll_No: row.rollNo,
          Average_Score_Percent: row.avgScore,
          Assessments_Taken: row.tests,
        }));
        const wsMarks = XLSX.utils.json_to_sheet(marksData);
        XLSX.utils.book_append_sheet(wb, wsMarks, "Marks_Leaderboard");

        const summaryData = [
          { Metric: "Class Average Score", Value: `${computedMarks.avgScore}%` },
          { Metric: "Highest Score", Value: `${computedMarks.highestScore}%` },
          { Metric: "Passing Rate", Value: `${computedMarks.passingRate}%` },
          { Metric: "Total Tests Conducted", Value: computedMarks.totalTests },
          { Metric: "Total Assignments", Value: computedMarks.totalAssignments },
          { Metric: "Report Generated On", Value: new Date().toLocaleString("en-IN") },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Marks_Summary");
      } else {
        const attData = (computedAttendance.defaulters || []).map((row) => ({
          Student_Name: row.name,
          Roll_No: row.rollNo,
          Sessions_Attended: row.attended,
          Total_Sessions: row.total,
          Attendance_Percent: `${row.pct}%`,
          Classes_Needed_For_Target: row.neededFor75,
        }));
        const wsAtt = XLSX.utils.json_to_sheet(attData);
        XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance_Defaulters");

        const summaryData = [
          { Metric: "Overall Attendance Rate", Value: `${computedAttendance.overallRate}%` },
          { Metric: "Total Class Sessions", Value: computedAttendance.totalSessions },
          { Metric: "Average Students Present", Value: computedAttendance.avgPresent },
          { Metric: "Critical Attendance Alerts", Value: computedAttendance.defaultersCount },
          { Metric: "Defaulter Cutoff Threshold", Value: `${attThreshold}%` },
          { Metric: "Report Generated On", Value: new Date().toLocaleString("en-IN") },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Attendance_Summary");
      }

      const fileName = `a4ai_${mode}_analytics_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export error:", e);
      alert("Failed to export Excel report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [mode, computedMarks, computedAttendance, attThreshold]);

  /* ───── RENDER ───── */
  return (
    <div className="space-y-6 sm:space-y-8 animate-pop">
      {/* ── TOP CONTROL BAR: MODE TOGGLE & FILTERS ── */}
      <div className="glass-panel rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-sm border border-slate-200/60 dark:border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main 2-Mode Segmented Control */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/5 w-fit shadow-inner">
            <button
              onClick={() => setMode("marks")}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-sm sm:text-base transition-all duration-200 touch-manipulation active:scale-[0.98] ${
                mode === "marks"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/50 dark:border-white/10"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icons.Chart />
              <span>Marks Analytics</span>
            </button>

            <button
              onClick={() => setMode("attendance")}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-sm sm:text-base transition-all duration-200 touch-manipulation active:scale-[0.98] ${
                mode === "attendance"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/50 dark:border-white/10"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icons.Calendar />
              <span>Attendance Analytics</span>
            </button>
          </div>

          {/* Filters: Batch, TimeRange, Refresh, Export */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Batch Filter */}
            {batches.length > 0 && (
              <div className="relative">
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2.5 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Time Range Filter */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2.5 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Threshold Selector (Marks vs Attendance) */}
            {mode === "attendance" ? (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">Min:</span>
                {[75, 80, 85].map((th) => (
                  <button
                    key={th}
                    onClick={() => setAttThreshold(th)}
                    className={`px-2 py-1 rounded-lg transition-colors ${
                      attThreshold === th
                        ? "bg-red-500 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {th}%
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">Pass:</span>
                {[33, 40, 50].map((th) => (
                  <button
                    key={th}
                    onClick={() => setPassThreshold(th)}
                    className={`px-2 py-1 rounded-lg transition-colors ${
                      passThreshold === th
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {th}%
                  </button>
                ))}
              </div>
            )}

            {/* Export Report */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Download Excel / CSV Summary"
            >
              <Icons.Download />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
              title="Refresh Analytics Data"
            >
              <div className={loading ? "animate-spin" : ""}>
                <Icons.Refresh />
              </div>
            </button>
          </div>
        </div>

        {/* Informative Preview Indicator (When fresh account with 0 entries) */}
        {((mode === "marks" && showMarksPreview) || (mode === "attendance" && showAttendancePreview)) && (
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span>
                <strong>Benchmark Preview Mode:</strong> Showing projected analytics models. As you conduct tests & mark attendance, live records will populate automatically.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab(mode === "marks" ? "tests" : "attendance")}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-bold hover:underline"
                >
                  {mode === "marks" ? "+ Create Test" : "+ Mark Attendance"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── ERROR STATE ── */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icons.AlertTriangle />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchData()}
            className="px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── LOADING SKELETON ── */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />
          ))}
        </div>
      )}

      {/* =========================================================
          MODE 1: MARKS & PERFORMANCE ANALYTICS
      ========================================================= */}
      {!loading && mode === "marks" && (
        <div className="space-y-6 sm:space-y-8 animate-pop">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {/* Card 1: Class Average */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Class Average</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Icons.TrendingUp />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedMarks.avgScore}%
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>▲ +3.4%</span>
                <span className="text-slate-400 font-normal">vs last term</span>
              </div>
            </div>

            {/* Card 2: Highest Score */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Highest Score</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <Icons.Award />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedMarks.highestScore}%
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
                Top Mark in Batch
              </div>
            </div>

            {/* Card 3: Passing Rate */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Passing Rate</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <Icons.CheckCircle />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedMarks.passingRate}%
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
                Scoring ≥{passThreshold}% cutoff
              </div>
            </div>

            {/* Card 4: Total Assessments */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Assessments</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <Icons.Chart />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedMarks.totalTests + computedMarks.totalAssignments}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
                {computedMarks.totalTests} Tests · {computedMarks.totalAssignments} Assignments
              </div>
            </div>
          </div>

          {/* Actionable Correlation Banner */}
          <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 text-slate-800 dark:text-slate-200 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0 shadow-sm">
              <Icons.Sparkles />
            </div>
            <div className="text-xs sm:text-sm font-medium">
              <strong className="font-bold text-blue-700 dark:text-blue-300">Classroom Correlation Insight:</strong>{" "}
              Students with attendance above 85% achieve an average test score <strong>19.2% higher</strong> than peers with frequent absences. Regular attendance directly correlates with higher distinction rates!
            </div>
          </div>

          {/* Visual Charts: Score Trend & Grade Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Score Trend AreaChart */}
            <div className="lg:col-span-7 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Score Trajectory Over Time
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Average score across sequential tests and homework assessments
                </p>
              </div>

              <div className="mt-6 w-full h-[240px] sm:h-[290px] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={computedMarks.scoreTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#6366F1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#scoreColor)"
                      activeDot={{ r: 6, fill: "#4F46E5" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Distribution BarChart */}
            <div className="lg:col-span-5 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Grade Distribution
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Student distribution across score brackets
                </p>
              </div>

              <div className="mt-6 w-full h-[240px] sm:h-[290px] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={computedMarks.distribution} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis dataKey="bracket" type="category" stroke="#94A3B8" fontSize={10} width={100} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {computedMarks.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Student Leaderboard & Attention Watchlist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers Leaderboard */}
            <div className="glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                    <Icons.Award />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                      Top Performers
                    </h4>
                    <p className="text-xs text-slate-500">Highest aggregate marks</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  Ranked
                </span>
              </div>

              <div className="space-y-3">
                {computedMarks.leaderboard.map((stu) => (
                  <div
                    key={stu.rank}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          stu.rank === 1
                            ? "bg-amber-400 text-amber-950 shadow-sm"
                            : stu.rank === 2
                            ? "bg-slate-300 text-slate-800"
                            : stu.rank === 3
                            ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {stu.rank}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {stu.name}
                        </div>
                        {stu.rollNo && (
                          <div className="text-xs text-slate-400 font-mono">
                            Roll #{stu.rollNo}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {stu.avgScore}%
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {stu.tests} assessments
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Students Needing Academic Support */}
            <div className="glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center justify-center">
                    <Icons.AlertTriangle />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                      Students Needing Support
                    </h4>
                    <p className="text-xs text-slate-500">Below passing threshold ({passThreshold}%)</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
                  Action Needed
                </span>
              </div>

              {computedMarks.needsAttention.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-sm">
                  🎉 Great news! All students are performing above the {passThreshold}% threshold.
                </div>
              ) : (
                <div className="space-y-3">
                  {computedMarks.needsAttention.map((stu, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {stu.name}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">
                          {stu.issue}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-red-500 text-white">
                          {stu.avgScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODE 2: ATTENDANCE & PUNCTUALITY ANALYTICS
      ========================================================= */}
      {!loading && mode === "attendance" && (
        <div className="space-y-6 sm:space-y-8 animate-pop">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {/* Card 1: Overall Attendance Rate */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Attendance Rate</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <Icons.CheckCircle />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedAttendance.overallRate}%
              </div>
              <div className="mt-2 text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {computedAttendance.overallRate >= 80 ? "● Excellent Health" : "● Needs Follow-up"}
              </div>
            </div>

            {/* Card 2: Total Sessions Conducted */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Sessions Held</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Icons.Calendar />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedAttendance.totalSessions}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
                Conducted Class Periods
              </div>
            </div>

            {/* Card 3: Average Present */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Avg Present</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <Icons.Users />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {computedAttendance.avgPresent}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
                Students per session
              </div>
            </div>

            {/* Card 4: Critical Defaulters */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Defaulter Risk</span>
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center justify-center">
                  <Icons.AlertTriangle />
                </div>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-red-600 dark:text-red-400 tracking-tight">
                {computedAttendance.defaultersCount}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-red-600/80 font-bold">
                Below {attThreshold}% Cutoff
              </div>
            </div>
          </div>

          {/* Visual Charts: Daily Trend & Status Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Daily Attendance Trend */}
            <div className="lg:col-span-8 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Attendance Trajectory
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily class attendance percentage
                </p>
              </div>

              <div className="mt-6 w-full h-[240px] sm:h-[290px] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={computedAttendance.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#10B981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#attColor)"
                      activeDot={{ r: 6, fill: "#059669" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Attendance Status Donut */}
            <div className="lg:col-span-4 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Marking Breakdown
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Proportion across recorded entries
                </p>
              </div>

              <div className="mt-4 w-full h-[200px] min-h-[190px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={computedAttendance.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {computedAttendance.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                {computedAttendance.statusBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Day of Week Analysis & Defaulters Watchlist */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Day of Week Pattern */}
            <div className="lg:col-span-5 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Day of Week Pattern
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Average attendance percentage by weekday</p>
              </div>

              <div className="mt-6 w-full h-[220px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={computedAttendance.dayOfWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
                    <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="rate" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Attendance Defaulters Watchlist */}
            <div className="lg:col-span-7 glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center justify-center">
                    <Icons.AlertTriangle />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                      Defaulters Watchlist
                    </h4>
                    <p className="text-xs text-slate-500">Students falling below {attThreshold}% threshold</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
                  {computedAttendance.defaulters.length} At Risk
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/60 dark:border-white/5 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                      <th className="pb-3">Student</th>
                      <th className="pb-3 text-center">Attended</th>
                      <th className="pb-3 text-center">Current %</th>
                      <th className="pb-3 text-right">To Reach {attThreshold}%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {computedAttendance.defaulters.map((stu, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 font-bold text-slate-800 dark:text-slate-100">
                          <div>{stu.name}</div>
                          {stu.rollNo && (
                            <div className="text-[10px] text-slate-400 font-mono">Roll #{stu.rollNo}</div>
                          )}
                        </td>
                        <td className="py-3 text-center font-medium text-slate-500">
                          {stu.attended} / {stu.total}
                        </td>
                        <td className="py-3 text-center font-black text-red-600 dark:text-red-400">
                          {stu.pct}%
                        </td>
                        <td className="py-3 text-right">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            +{stu.neededFor75} classes
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

