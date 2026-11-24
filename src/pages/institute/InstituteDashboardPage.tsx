// InstituteDashboardPage.tsx - Updated with HODAttendanceDashboard
// src/pages/institute/InstituteDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Institute admin dashboard  ·  ORANGE THEME  ·  3-column layout
// Full hierarchy: Institute → Departments → Sections → Batches → Students
// Roles: admin (full), hod (dept-lead), teacher
// Backward compatible: dept/section nullable, works without them
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy } from "react";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { teacherDisplayName } from "@/lib/teacherName";
import { toast } from "@/pages/institute/instituteToast";
import { type InstituteTab, type InstituteView, readInstituteView, patchInstituteView, rememberScroll, recallScroll } from "@/pages/institute/instituteUrlState";
import { useBackToClose, modalsOf } from "@/hooks/useBackToClose";
import { batchSubjectColor, subjectVars } from "@/lib/subjectColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customStyles, Icons } from "@/pages/institute/dashboardTheme";
import { LazySection, SectionSkeleton } from "@/components/LazySection";
import {
  instKey, resolveKey, invalidateInstitute, type InstituteMutation, resolveInstitute, fetchMeta, fetchTeachers,
  fetchBatches, fetchStudents, fetchStudentCounts, fetchDepartments, fetchSections, fetchSubjects, fetchTeaching,
  fetchProctors, fetchBranding, fetchStudentBatches,
} from "@/pages/institute/instituteQueries";
import { membershipMap, studentMatchesFilter } from "@/lib/studentUpload/batchAssign";
import { HOD_ENABLED, PROCTOR_UI_ENABLED, CLASS_SUBJECT_BATCH_ENABLED, sectionsVisible } from "@/config/features";
import { useSetVoiceAgentObstructed } from "@/lib/voice/surface";
import { buildClassTree } from "@/pages/institute/classes/classTree";
import { newSubjectCode } from "@/lib/teachingAssign";

// Not needed for the first screen: loaded when their tab / modal opens (xlsx only comes with these)
const loadAttendance = () => import("@/components/attendance/HODAttendanceDashboard");
const loadBatchSettings = () => import("@/components/admin/BatchManagementPanel");
const loadBulkUpload = () => import("@/components/institute/BulkStudentUpload");
const HODAttendanceDashboard = lazy(loadAttendance);
const BatchManagementPanel = lazy(loadBatchSettings);
const BulkStudentUpload = lazy(loadBulkUpload);
// Class → Subject → Batch screens (CLASS_SUBJECT_BATCH_ENABLED only; never loaded while the flag is off)
const ClassesTab = lazy(() => import("@/pages/institute/classes/ClassesTab"));
const TeachersSimple = lazy(() => import("@/pages/institute/classes/TeachersSimple"));
const loadBatchAssign = () => import("@/components/institute/StudentBatchAssignModal");
const StudentBatchAssignModal = lazy(loadBatchAssign);
const loadStudentEdit = () => import("@/components/institute/StudentEditModal");
const StudentEditModal = lazy(loadStudentEdit);
const loadBatchStudents = () => import("@/components/institute/BatchStudentsModal");
const BatchStudentsModal = lazy(loadBatchStudents);
// keyed by nav tab id; Batch settings sits in the Analytics tab
const PRELOAD: Record<string, () => Promise<unknown>> = { attendance: loadAttendance, analytics: loadBatchSettings };



/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  } catch { /* fallthrough */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch { /* noop */ }
  document.body.removeChild(ta);
  return Promise.resolve();
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randCode = (n = 6) =>
  Array.from({ length: n }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join("");
const deptShort = (n: string) => (n.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "DEP");
const makeDeptCode = (name: string, kind: "STU" | "TCH") => `A4I-${deptShort(name)}-${kind}-${randCode(4)}`;

/* ═══════════════════════════════════════════════════════════════════
   INTERFACES
   ═══════════════════════════════════════════════════════════════════ */
interface Institute { id: string; name: string; join_code: string; max_teachers: number; max_students: number; monthly_test_limit: number; hierarchy_mode?: string | null; }
interface Department { id: string; institute_id: string; name: string; student_code: string; teacher_code: string; }
interface Section { id: string; department_id: string; name: string; year: number | null; }
interface Teacher { id: string; user_id: string; role: string; status: string; joined_at: string; user_email?: string; user_name?: string; department_id?: string | null; }
interface Batch { id: string; name: string; class_level: string; subject: string; description: string; is_active: boolean; department_id?: string | null; section_id?: string | null; is_lab?: boolean | null; }
interface Student { id: string; name: string; roll_no: string; class_level: string; parent_name: string; parent_phone: string; batch_id: string; batch_name?: string; is_active: boolean; department_id?: string | null; section_id?: string | null; lab_batch_id?: string | null; phone?: string | null; email?: string | null; }

const NO_TEACHERS: Teacher[] = [];
const NO_BATCHES: Batch[] = [];
const NO_STUDENTS: Student[] = [];
const NO_DEPTS: Department[] = [];
const NO_SECTIONS: Section[] = [];
const NO_SUBJECTS: { id: string; name: string; code: string; department_id?: string | null }[] = [];

/* ═══════════════════════════════════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════════════════════════════════ */
const BatchBars: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="relative h-40 w-full flex items-end justify-between gap-2 px-2 pb-6 border-b border-slate-100">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] font-bold text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity stat-number">{d.value}</span>
          <div
            className="w-full max-w-[26px] bg-slate-200 group-hover:bg-[#FF7043] rounded-t-md transition-colors duration-200"
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
          />
          <span className="text-[10px] font-bold text-slate-400 mt-2 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const DonutStat: React.FC<{ pct: number; label: string }> = ({ pct, label }) => {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle className="chart-track" cx="50" cy="50" r={r} fill="none" stroke="#F0F2F5" strokeWidth="13" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#FF7043" strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${c * Math.min(pct, 1)} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-800 stat-number">{Math.round(pct * 100)}%</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase">{label}</span>
      </div>
    </div>
  );
};

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const v = Math.max(0, Math.min(1, value));
  const c = Math.PI * 60;
  return (
    <div className="relative w-40 h-20 mx-auto">
      <svg viewBox="0 0 156 82" className="w-full h-full">
        <path className="chart-track" d="M 18 76 A 60 60 0 0 1 138 76" fill="none" stroke="#F0F2F5" strokeWidth="16" strokeLinecap="round" />
        <path d="M 18 76 A 60 60 0 0 1 138 76" fill="none" stroke="#FF7043" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} />
        <g transform={`rotate(${-180 + v * 180} 78 76)`}>
          <path d="M 78 76 L 78 36 L 83 76 Z" fill="#FF7043" />
        </g>
        <circle cx="78" cy="76" r="5" fill="#FF7043" />
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function InstituteDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Admin";

  // Tab, filters and search live in the URL (instituteUrlState.ts): Back from a profile / reload keeps the view.
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navType = useNavigationType();
  const view = readInstituteView(searchParams);
  // Flag on: Departments + Batches are replaced by the Classes screen; flag off: "classes" does not exist (old links fall back).
  const activeTab: InstituteTab = CLASS_SUBJECT_BATCH_ENABLED
    ? (view.tab === "departments" || view.tab === "batches" ? "classes" : view.tab)
    : (view.tab === "classes" ? "overview" : view.tab);
  const deptFilter = view.dept;
  const sectionFilter = view.section;
  /** Changes the URL view. Tab changes add a history entry (Back = previous tab), the rest replace the current one.
   *  Reads window.location (not the render's params) so two calls in one handler don't overwrite each other. */
  const updateView = useCallback((patch: Partial<InstituteView>, opts?: { replace?: boolean }) => {
    const next = patchInstituteView(new URLSearchParams(window.location.search), patch).toString();
    if (next === window.location.search.replace(/^\?/, "")) return;
    navigate({ pathname: window.location.pathname, search: next ? `?${next}` : "" }, { replace: opts?.replace ?? !("tab" in patch) });
  }, [navigate]);
  const setActiveTab = (tab: string, opts?: { replace?: boolean }) => updateView({ tab: tab as InstituteTab }, opts);
  const setDeptFilter = (dept: string) => updateView({ dept, section: "" });
  const setSectionFilter = (section: string) => updateView({ section });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useSetVoiceAgentObstructed(mobileMenuOpen);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [utilView, setUtilView] = useState<"ring" | "bars">("ring");

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();
  // Keyed by the user id, not the user object: that changes on every token refresh / tab focus
  const userId = user?.id ?? null;
  const resolveQ = useQuery({ queryKey: resolveKey(userId ?? ""), queryFn: () => resolveInstitute(userId!), enabled: !!userId });
  const instId = resolveQ.data?.id ?? null;
  const isHod = resolveQ.data?.isHod ?? false;
  const hodDeptId = resolveQ.data?.hodDeptId ?? null;
  // refetchOnWindowFocus refetches only data older than staleTime (5 min, App.tsx) — no request storm
  const live = { enabled: !!instId, refetchOnWindowFocus: true } as const;
  const k = (r: Parameters<typeof instKey>[1]) => instKey(instId ?? "", r);
  const metaQ = useQuery({ queryKey: k("meta"), queryFn: () => fetchMeta(instId!), ...live });
  const teachersQ = useQuery({ queryKey: k("teachers"), queryFn: () => fetchTeachers(instId!), ...live });
  const batchesQ = useQuery({ queryKey: k("batches"), queryFn: () => fetchBatches(instId!), ...live });
  const studentsQ = useQuery({ queryKey: k("students"), queryFn: () => fetchStudents(instId!), ...live });
  const countsQ = useQuery({ queryKey: k("studentCounts"), queryFn: () => fetchStudentCounts(instId!), ...live });
  const deptsQ = useQuery({ queryKey: k("departments"), queryFn: () => fetchDepartments(instId!), ...live });
  const sectionsQ = useQuery({ queryKey: k("sections"), queryFn: () => fetchSections(instId!), ...live });
  const subjectsQ = useQuery({ queryKey: k("subjects"), queryFn: () => fetchSubjects(instId!), ...live });
  const teachingQ = useQuery({ queryKey: k("teaching"), queryFn: () => fetchTeaching(instId!), ...live });
  const proctorsQ = useQuery({ queryKey: k("proctors"), queryFn: () => fetchProctors(instId!), ...live });
  const studentBatchesQ = useQuery({ queryKey: k("studentBatches"), queryFn: () => fetchStudentBatches(instId!), ...live });
  const brandingQ = useQuery({ queryKey: k("branding"), queryFn: () => fetchBranding(instId!), enabled: !!instId, staleTime: Infinity });

  const institute = (metaQ.data as Institute | undefined) ?? null;
  const teachers = (teachersQ.data as Teacher[] | undefined) ?? NO_TEACHERS;
  const batches = (batchesQ.data as Batch[] | undefined) ?? NO_BATCHES;
  const students = (studentsQ.data as Student[] | undefined) ?? NO_STUDENTS;
  // student → batch ids (student_batches, migration 33; falls back to batch_id + lab_batch_id until it is run)
  const memberships = useMemo(() => membershipMap(studentBatchesQ.data, students), [studentBatchesQ.data, students]);
  const multiBatchReady = studentBatchesQ.data != null;
  const batchById = useMemo(() => new Map(batches.map(b => [b.id, b])), [batches]);
  const departments = (deptsQ.data as Department[] | undefined) ?? NO_DEPTS;
  const sections = (sectionsQ.data as Section[] | undefined) ?? NO_SECTIONS;
  const subjects = subjectsQ.data ?? NO_SUBJECTS;
  const logoUrl = brandingQ.data?.logoUrl ?? null;
  const bannerUrl = brandingQ.data?.bannerUrl ?? null;

  // Class teachers. proctor_assignments.teacher_id is an institute_members.id (NOT a user_id),
  // so both maps are keyed/valued by member id — same as `teacher.id` in this page.
  const { proctorOfSection, sectionsOfProctor } = useMemo(() => {
    const bySection: Record<string, string> = {};
    const byMember: Record<string, string[]> = {};
    (proctorsQ.data ?? []).forEach((p: any) => {
      bySection[p.section_id] = p.teacher_id;
      (byMember[p.teacher_id] ||= []).push(p.section_id);
    });
    return { proctorOfSection: bySection, sectionsOfProctor: byMember };
  }, [proctorsQ.data]);

  const coreQs = [metaQ, teachersQ, batchesQ, studentsQ, deptsQ, sectionsQ, subjectsQ, teachingQ, proctorsQ];
  // Full-page spinner only for the first load; a refetch after a mutation keeps the current data on screen
  const loading = !!userId && (resolveQ.isPending || (!!instId && coreQs.some(q => q.isPending)));
  const instLoadError = resolveQ.error || metaQ.error;
  const [creatingInstitute, setCreatingInstitute] = useState(false);
  const [newInstituteName, setNewInstituteName] = useState("");

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set());
  const [assignStudentIds, setAssignStudentIds] = useState<string[] | null>(null);
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [batchMembersId, setBatchMembersId] = useState<string | null>(null);
  // Class-teacher (proctor) modal: memberId = institute_members.id, which is what assign_proctor wants.
  const [assignProctorFor, setAssignProctorFor] = useState<{ memberId: string; userId: string; teacherName: string; deptId: string | null } | null>(null);
  const [proctorBusy, setProctorBusy] = useState(false);
  const [assignHodDept, setAssignHodDept] = useState<Department | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [copiedDeptCode, setCopiedDeptCode] = useState<string>("");

  const [newBatch, setNewBatch] = useState({ name: "", class_level: "", subject: "", description: "", department_id: "", section_id: "" });
  const [newStudent, setNewStudent] = useState({ name: "", roll_no: "", class_level: "", parent_name: "", parent_phone: "", batch_id: "", department_id: "", section_id: "" });
  const [newDept, setNewDept] = useState({ name: "" });
  const [newSection, setNewSection] = useState({ department_id: "", name: "", year: "" });

  // Search box: typed text here, the URL's ?q= is what filters (written 300 ms after the last key, replace).
  const urlQ = view.q;
  const debouncedSearch = urlQ;
  const [search, setSearch] = useState(urlQ);
  const ownQ = useRef(urlQ); // last q this page wrote — anything else came from Back / Forward
  useEffect(() => {
    if (urlQ !== ownQ.current) { ownQ.current = urlQ; setSearch(urlQ); }
  }, [urlQ]);
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q === readInstituteView(new URLSearchParams(window.location.search)).q) return;
      ownQ.current = q;
      updateView({ q }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [search, updateView]);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Phone / browser Back closes whatever is open instead of leaving the page
  useBackToClose(mobileMenuOpen, () => setMobileMenuOpen(false), "menu");
  useBackToClose(showAddBatch, () => setShowAddBatch(false), "addBatch");
  useBackToClose(showAddStudent, () => setShowAddStudent(false), "addStudent");
  useBackToClose(showAddDept, () => setShowAddDept(false), "addDept");
  useBackToClose(showAddSection, () => setShowAddSection(false), "addSection");
  useBackToClose(showBulkUpload, () => setShowBulkUpload(false), "bulkUpload");
  useBackToClose(!!assignStudentIds, () => setAssignStudentIds(null), "assignBatches");
  useBackToClose(!!editStudentId, () => setEditStudentId(null), "editStudent");
  useBackToClose(!!batchMembersId, () => setBatchMembersId(null), "batchStudents");
  useBackToClose(!!assignProctorFor, () => setAssignProctorFor(null), "proctor");
  useBackToClose(!!assignHodDept, () => setAssignHodDept(null), "hod");

  // Scroll position of <main> per URL: Back (POP) restores it, a new tab (PUSH) starts at the top,
  // filters / search (REPLACE) and opening a modal leave it alone.
  const mainRef = useRef<HTMLElement>(null);
  const scrollKey = location.pathname + location.search;
  const onMainScroll = (e: React.UIEvent<HTMLElement>) => {
    // Opening a lazy page (a profile) hides this one with display:none first (Suspense) — that resets the
    // scroll to 0 and must not overwrite the position Back should restore.
    if (e.currentTarget.clientHeight === 0) return;
    rememberScroll(scrollKey, e.currentTarget.scrollTop);
  };
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el || modalsOf(location.state).length > 0) return;
    if (navType === "POP") {
      const top = recallScroll(scrollKey);
      if (top != null) el.scrollTop = top;
    } else if (navType === "PUSH") el.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per history entry (and once the page is on screen)
  }, [location.key, loading]);
  // Also save on unmount (opening a profile), in case the last scroll event hasn't fired yet. Skipped when Suspense
  // already hid the page (clientHeight 0): then the scroll events' value stands.
  const scrollKeyRef = useRef(scrollKey);
  scrollKeyRef.current = scrollKey;
  useLayoutEffect(() => {
    const el = mainRef.current;
    return () => { if (el && el.clientHeight > 0) rememberScroll(scrollKeyRef.current, el.scrollTop); };
  }, [loading]);

  useEffect(() => {
    if (studentsQ.error) {
      console.error("students fetch:", studentsQ.error);
      toast.error(`Couldn't load students: ${studentsQ.error.message}`);
    }
  }, [studentsQ.error]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);


  /** After a mutation: fetch again only what it changed (instituteQueries.INVALIDATES). */
  const invalidate = (m: InstituteMutation) => (instId ? invalidateInstitute(qc, instId, m) : Promise.resolve([]));

  /* ─────────────────────────────────────────────────────────────
     FIXED: handleCreateInstitute
     - Uses the RPC's return value (UUID) directly
     - Full page reload on success (access is loaded once per login)
     - Turns a duplicate-slug error into a friendly message
     ───────────────────────────────────────────────────────────── */
  const handleCreateInstitute = async () => {
    if (!newInstituteName.trim() || !user || creatingInstitute) return;
    setCreatingInstitute(true);
    try {
      const { data: newId, error } = await supabase.rpc("create_institute", {
        p_name: newInstituteName.trim(),
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("slug") || msg.includes("unique")) {
          toast.error("This name is already taken. Please try a different name.");
        } else {
          toast.error(error.message || "Failed to create institute");
        }
        setCreatingInstitute(false);
        return;
      }

      toast.success("Institute created!");
      // Full reload: access (get_my_access) is loaded once per login — the new admin role only shows up after it
      // reloads, otherwise /hod, routing and every scoped screen still see "no institute".
      setTimeout(() => window.location.assign("/institute"), 600);
      return;
    } catch (e: any) {
      toast.error(e.message || "Failed to create institute");
    }
    setCreatingInstitute(false);
  };

  const handleAddBatch = async () => {
    if (!newBatch.name.trim() || !institute) return;
    let subjectProblem = "";
    try {
      const { error } = await supabase.from("batches").insert({
        institute_id: institute.id,
        name: newBatch.name.trim(),
        class_level: newBatch.class_level || null,
        subject: newBatch.subject || null,
        description: newBatch.description || null,
        department_id: newBatch.department_id || null,
        section_id: newBatch.section_id || null,
      });
      if (error) throw error;

      if (newBatch.subject?.trim()) {
        const subName = newBatch.subject.trim();
        const code = subName.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() + "101";
        const exists = subjects.some(s =>
          s.name.toLowerCase() === subName.toLowerCase() &&
          (!newBatch.department_id || s.department_id === newBatch.department_id)
        );
        if (!exists) {
          // The batch row is already saved; the subject must not fail silently (UNIQUE(institute_id, code) used to swallow it)
          const subject = (c: string) => supabase.from("subjects").insert({
            institute_id: institute.id,
            name: subName,
            code: c,
            department_id: newBatch.department_id || null,
            is_active: true,
          });
          let { error: subErr } = await subject(code);
          if (subErr?.code === "23505") ({ error: subErr } = await subject(newSubjectCode(subName, subjects.map(s => s.code))));
          if (subErr) subjectProblem = subErr.message;
        }
      }

      if (subjectProblem) toast.warning(`Batch created, but its subject "${newBatch.subject.trim()}" was NOT created: ${subjectProblem}`);
      else toast.success("Batch created!");
      setShowAddBatch(false);
      setNewBatch({ name: "", class_level: "", subject: "", description: "", department_id: "", section_id: "" });
      invalidate("addBatch");
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this batch? Students stay, but lose their batch.")) return;
    const { error } = await supabase.from("batches").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Batch deleted");
    invalidate("deleteBatch");
  };

  const handleAddStudent = async () => {
    if (!newStudent.name.trim() || !institute) return;
    try {
      const { error } = await supabase.from("students").insert({
        institute_id: institute.id,
        name: newStudent.name.trim(),
        roll_no: newStudent.roll_no || null,
        class_level: newStudent.class_level || null,
        parent_name: newStudent.parent_name || null,
        parent_phone: newStudent.parent_phone || null,
        batch_id: newStudent.batch_id || null,
        department_id: newStudent.department_id || null,
        section_id: newStudent.section_id || null,
      });
      if (error) throw error;
      toast.success("Student added!");
      setShowAddStudent(false);
      setNewStudent({ name: "", roll_no: "", class_level: "", parent_name: "", parent_phone: "", batch_id: "", department_id: "", section_id: "" });
      invalidate("addStudent");
    } catch (e: any) { toast.error(e.message); }
  };

  const removeStudent = async (id: string) => {
    if (!confirm("Remove this student? Their attendance and submissions will also be deleted.")) return;
    await supabase.from("student_access_codes").delete().eq("student_id", id);
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student removed");
    invalidate("removeStudent");
  };

  const removeTeacher = async (id: string, userId?: string) => {
    if (!confirm("Remove this teacher from the institute? This cannot be undone.")) return;
    // Legacy cleanup only — teacher_batches is never written anymore
    if (userId) await supabase.from("teacher_batches").delete().eq("teacher_id", userId);
    if (CLASS_SUBJECT_BATCH_ENABLED && userId && instId) {
      const { error: taErr } = await supabase.from("teaching_assignments").delete().eq("teacher_id", userId).eq("institute_id", instId);
      if (taErr) return toast.error(`Could not remove the teacher's batches: ${taErr.message}`);
    }
    const { error } = await supabase.from("institute_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Teacher removed");
    invalidate("removeTeacher");
    if (CLASS_SUBJECT_BATCH_ENABLED) invalidate("teaching");
  };

  const promoteToHod = async (teacherId: string, departmentId: string) => {
    const existingHod = teachers.find(t => t.role === "hod" && t.department_id === departmentId);
    try {
      if (existingHod && existingHod.id !== teacherId) {
        const { error: dErr } = await supabase.from("institute_members")
          .update({ role: "teacher" }).eq("id", existingHod.id);
        if (dErr) throw dErr;
      }
      const { error } = await supabase.from("institute_members")
        .update({ role: "hod", department_id: departmentId })
        .eq("id", teacherId);
      if (error) throw error;
      toast.success("HOD assigned");
      setAssignHodDept(null);
      invalidate("teacherRole");
    } catch (e: any) {
      toast.error(e.message || "Failed to assign HOD");
    }
  };

  const demoteHod = async (id: string) => {
    if (!confirm("Demote this HOD back to teacher?")) return;
    const { error } = await supabase.from("institute_members")
      .update({ role: "teacher" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("HOD demoted to teacher");
    invalidate("teacherRole");
  };

  /**
   * Make this member the class teacher (proctor) of a section.
   * assign_proctor takes institute_members.id and replaces whoever held the section (UNIQUE(section_id)).
   * batches.proctor_id is mirrored with the auth user_id — attendance_records RLS reads it so the
   * proctor can correct marks for the whole section (main batch + labs).
   */
  const assignProctor = async (memberId: string, userId: string, section: Section) => {
    if (!institute || !section.department_id) return toast.error("This section has no department.");
    setProctorBusy(true);
    const { error } = await supabase.rpc("assign_proctor", {
      p_institute_id: institute.id,
      p_department_id: section.department_id,
      p_section_id: section.id,
      p_teacher_id: memberId,
    });
    if (error) { setProctorBusy(false); return toast.error(error.message); }
    const { error: mirrorErr } = await supabase.from("batches").update({ proctor_id: userId }).eq("section_id", section.id);
    setProctorBusy(false);
    if (mirrorErr) toast.warning(`Class teacher set, but attendance rights may be limited: ${mirrorErr.message}`);
    else toast.success(`Class teacher of ${section.name}`);
    invalidate("proctor");
  };

  const removeProctor = async (section: Section) => {
    if (!institute) return;
    if (!confirm(`Remove the class teacher of ${section.name}?`)) return;
    setProctorBusy(true);
    const { error, count } = await supabase.from("proctor_assignments")
      .delete({ count: "exact" }).eq("section_id", section.id).eq("institute_id", institute.id);
    if (error) { setProctorBusy(false); return toast.error(error.message); }
    if (!count) { setProctorBusy(false); return toast.error("Not removed — you may not have permission for this section."); }
    await supabase.from("batches").update({ proctor_id: null }).eq("section_id", section.id);
    setProctorBusy(false);
    toast.success("Class teacher removed");
    invalidate("proctor");
  };

  const downloadAccessCodesCSV = async () => {
    if (!institute) return;
    try {
      const { data } = await supabase
        .from("student_access_codes")
        .select("access_code, students(name, roll_no, phone, parent_phone, email), batches(name)")
        .eq("institute_id", institute.id)
        .eq("is_active", true);

      if (!data || data.length === 0) {
        toast.error("No access codes found. Generate them first.");
        return;
      }

      const rows = data.map((d: any) => ({
        name: d.students?.name || "",
        roll_no: d.students?.roll_no || "",
        phone: d.students?.phone || "",
        parent_phone: d.students?.parent_phone || "",
        email: d.students?.email || "",
        batch: (d.batches as any)?.name || "",
        access_code: d.access_code,
        portal_link: window.location.origin + "/student",
      }));

      const headers = "Name,Roll No,Phone,Parent Phone,Email,Batch,Access Code,Portal Link";
      const csv = headers + "\n" + rows.map((r: any) =>
        [r.name, r.roll_no, r.phone, r.parent_phone, r.email, r.batch, r.access_code, r.portal_link]
          .map(v => `"${(v || "").replace(/"/g, '""')}"`)
          .join(",")
      ).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student_access_codes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded!");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    }
  };

  const handleAddDept = async () => {
    if (!newDept.name.trim() || !institute) return;
    try {
      const { error } = await supabase.from("departments").insert({
        institute_id: institute.id,
        name: newDept.name.trim(),
        student_code: makeDeptCode(newDept.name, "STU"),
        teacher_code: makeDeptCode(newDept.name, "TCH"),
      });
      if (error) throw error;
      toast.success(`${newDept.name} created`);
      setShowAddDept(false);
      setNewDept({ name: "" });
      invalidate("addDept");
    } catch (e: any) { toast.error(e.message || "Failed — check RLS policy"); }
  };

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? Sections in it will also be deleted. Teachers/batches/students will lose their dept but stay.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${name} deleted`);
    if (expandedDept === id) setExpandedDept(null);
    invalidate("deleteDept");
  };

  const regenDeptCode = async (deptId: string, deptName: string, kind: "student_code" | "teacher_code") => {
    if (!confirm("Regenerate this code? Old code will stop working.")) return;
    try {
      const code = makeDeptCode(deptName, kind === "student_code" ? "STU" : "TCH");
      const { error } = await supabase.from("departments").update({ [kind]: code }).eq("id", deptId);
      if (error) throw error;
      toast.success("New code generated");
      invalidate("regenDeptCode");
    } catch (e: any) { toast.error(e.message || "Failed to regenerate"); }
  };

  const copyDeptCode = async (deptId: string, code: string, kind: "s" | "t") => {
    await copyText(code);
    setCopiedDeptCode(`${deptId}-${kind}`);
    toast.success("Code copied!");
    setTimeout(() => setCopiedDeptCode(""), 2000);
  };

  const handleAddSection = async () => {
    if (!newSection.name.trim() || !newSection.department_id) return;
    try {
      const { error } = await supabase.from("sections").insert({
        department_id: newSection.department_id,
        name: newSection.name.trim(),
        year: newSection.year ? parseInt(newSection.year) : null,
      });
      if (error) throw error;
      toast.success("Section created");
      setShowAddSection(false);
      setNewSection({ department_id: "", name: "", year: "" });
      invalidate("addSection");
    } catch (e: any) { toast.error(e.message || "Failed to create section"); }
  };

  const deleteSection = async (id: string, name: string) => {
    if (!confirm(`Delete section ${name}? Members in it will lose the section but stay.`)) return;
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${name} deleted`);
    invalidate("deleteSection");
  };

  const copyCode = useCallback(async () => {
    if (!institute) return;
    await copyText(institute.join_code);
    setJoinCodeCopied(true);
    toast.success("Join code copied!");
    setTimeout(() => setJoinCodeCopied(false), 2000);
  }, [institute]);

  const copyJoinLink = useCallback(async () => {
    if (!institute) return;
    const link = `${window.location.origin}/join?code=${institute.join_code}`;
    await copyText(link);
    toast.success("Join link copied!");
  }, [institute]);

  const regenerateJoinCode = async () => {
    if (!institute) return;
    if (!confirm("Regenerate the join code? Old code will stop working.")) return;
    setRegeneratingCode(true);
    try {
      const newCode = randCode(6);
      const { error } = await supabase.from("institutes").update({ join_code: newCode }).eq("id", institute.id);
      if (error) throw error;
      toast.success("New join code generated");
      await invalidate("joinCode");
    } catch (e: any) {
      toast.error(e.message || "Failed to regenerate — check RLS policy");
    }
    setRegeneratingCode(false);
  };

  const contactParent = (s: Student) => {
    if (!s.parent_phone) return toast.error(`No parent phone saved for ${s.name}`);
    const digits = s.parent_phone.replace(/\D/g, "");
    const num = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${num}`, "_blank", "noopener,noreferrer");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const saveInstituteName = async () => {
    if (!editNameValue.trim() || !institute) return;
    try {
      const { error } = await supabase.from("institutes").update({ name: editNameValue.trim() }).eq("id", institute.id);
      if (error) throw error;
      qc.setQueryData(instKey(institute.id, "meta"), { ...institute, name: editNameValue.trim() });
      toast.success("Institute name updated!");
      setEditingName(false);
    } catch (e: any) { toast.error(e.message || "Failed to update name"); }
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !institute) return;
    if (!file.type.startsWith("image/")) return toast.error("Select an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");
    setUploadingLogo(true);
    try {
      const { error } = await supabase.storage.from("institute-assets").upload(`${institute.id}/logo`, file, { upsert: true, contentType: file.type, cacheControl: "86400" }); // 1 day: same URL is reused, so a longer cache would show an old logo after a change
      if (error) throw error;
      const { data } = supabase.storage.from("institute-assets").getPublicUrl(`${institute.id}/logo`);
      qc.setQueryData(instKey(institute.id, "branding"), (b: any) => ({ ...b, logoUrl: data.publicUrl + `?t=${Date.now()}` }));
      toast.success("Logo updated!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const uploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !institute) return;
    if (!file.type.startsWith("image/")) return toast.error("Select an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Banner must be under 5MB");
    setUploadingBanner(true);
    try {
      const { error } = await supabase.storage.from("institute-assets").upload(`${institute.id}/banner`, file, { upsert: true, contentType: file.type, cacheControl: "86400" });
      if (error) throw error;
      const { data } = supabase.storage.from("institute-assets").getPublicUrl(`${institute.id}/banner`);
      qc.setQueryData(instKey(institute.id, "branding"), (b: any) => ({ ...b, bannerUrl: data.publicUrl + `?t=${Date.now()}` }));
      toast.success("Banner updated!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploadingBanner(false);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const goHome = () => navigate("/");
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
  const deptName = (id?: string | null) => id ? (departments.find(d => d.id === id)?.name || "—") : "";
  const sectionName = (id?: string | null) => id ? (sections.find(s => s.id === id)?.name || "") : "";

  const totalTeachersAll = teachers.length;
  const hods = useMemo(() => teachers.filter(t => t.role === "hod"), [teachers]);
  // Server counts: correct even when the list is still loading or larger than one request
  const totalStudents = countsQ.data?.total ?? students.length;
  const totalBatches = batches.length;
  const totalDepartments = departments.length;
  const totalSections = sections.length;
  const activeTeachers = teachers.filter(t => t.status === "active").length;
  const maxStudents = institute?.max_students || 0;
  const maxTeachers = institute?.max_teachers || 0;
  const studentPct = maxStudents ? Math.min(totalStudents / maxStudents, 1) : 0;
  const teacherPct = maxTeachers ? Math.min(totalTeachersAll / maxTeachers, 1) : 0;
  const batchPct = totalBatches ? Math.min(totalBatches / 10, 1) : 0;
  const unassigned = countsQ.data?.unassigned ?? students.filter(s => !s.batch_id).length;
  const avgPerBatch = totalBatches ? Math.round(totalStudents / totalBatches) : 0;

  const matchesDept = (deptId?: string | null) => {
    if (!deptFilter) return true;
    if (deptFilter === "none") return !deptId;
    return deptId === deptFilter;
  };
  const matchesSection = (secId?: string | null) => {
    if (!sectionFilter) return true;
    if (sectionFilter === "none") return !secId;
    return secId === sectionFilter;
  };

  const filteredTeachers = useMemo(() =>
    teachers.filter(t => {
      if (isHod && hodDeptId) return t.department_id === hodDeptId;
      return matchesDept(t.department_id);
    })
    , [teachers, deptFilter, isHod, hodDeptId]);

  const filteredBatches = useMemo(() =>
    batches.filter(b => matchesDept(b.department_id) && matchesSection(b.section_id))
    , [batches, deptFilter, sectionFilter]);

  const filteredStudents = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    // dept / section also through the student's batches (student_batches): students.section_id is often empty
    const list = students.filter(s => studentMatchesFilter(s, memberships.get(s.id), batchById, deptFilter, sectionFilter));
    if (!q) return list;
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.roll_no || "").toLowerCase().includes(q) ||
      (s.batch_name || "").toLowerCase().includes(q) ||
      [...(memberships.get(s.id) ?? [])].some(id => (batchById.get(id)?.name || "").toLowerCase().includes(q))
    );
  }, [students, debouncedSearch, deptFilter, sectionFilter, memberships, batchById]);

  const allShownSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.id));
  const someShownSelected = filteredStudents.some(s => selectedStudentIds.has(s.id));
  const toggleStudent = (id: string) => setSelectedStudentIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // A removed student must leave the selection (set_student_batches rejects the whole call for an unknown id)
  useEffect(() => {
    setSelectedStudentIds(prev => {
      if (prev.size === 0) return prev;
      const ids = new Set(students.map(s => s.id));
      const next = new Set([...prev].filter(id => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [students]);

  // students per batch (all memberships: main, lab and extra batches)
  const batchCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) for (const bid of memberships.get(s.id) ?? []) m.set(bid, (m.get(bid) ?? 0) + 1);
    return m;
  }, [students, memberships]);

  // members via student_batches (main + lab + extra batches) — students.batch_id alone misses extra-batch members
  const batchChart = useMemo(() =>
    batches.slice(0, 12).map((b) => ({
      label: b.name,
      value: batchCounts.get(b.id) ?? 0,
    })), [batches, batchCounts]);

  const sectionsOfDept = (deptId: string) => sections.filter(s => s.department_id === deptId);
  const teachersOfDept = (deptId: string) => teachers.filter(t => t.department_id === deptId);
  const batchesOfDept = (deptId: string) => batches.filter(b => b.department_id === deptId);
  const studentsOfDept = (deptId: string) => students.filter(s => studentMatchesFilter(s, memberships.get(s.id), batchById, deptId, ""));
  const hodOfDept = (deptId: string) => hods.find(h => h.department_id === deptId);

  const setupTasks = [
    { label: "Institute created", done: !!institute },
    { label: "First department created", done: totalDepartments > 0 },
    { label: "First teacher joined", done: totalTeachersAll > 0 },
    { label: "First batch created", done: totalBatches > 0 },
    { label: "First student added", done: totalStudents > 0 },
    { label: "All students in a batch", done: totalStudents > 0 && unassigned === 0 },
  ];
  const setupDone = setupTasks.filter(t => t.done).length;

  // ── Class → Subject → Batch → Teacher (flag only) ──
  const showSections = sectionsVisible(institute?.hierarchy_mode);
  const csbBatchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    memberships.forEach(set => set.forEach(b => counts.set(b, (counts.get(b) ?? 0) + 1)));
    return counts;
  }, [memberships]);
  const studentCountOf = useCallback((id: string) => csbBatchCounts.get(id) ?? 0, [csbBatchCounts]);
  const classTree = useMemo(() => {
    return buildClassTree({
      classes: departments, subjects, batches, teaching: teachingQ.data ?? [],
      studentCount: studentCountOf,
      activeTeacherIds: new Set(teachers.map(t => t.user_id)),
    });
  }, [departments, subjects, batches, teachingQ.data, studentCountOf, teachers]);
  const studentsInClass = (classId: string) => students.filter(s => s.department_id === classId).length;

  const navItems = CLASS_SUBJECT_BATCH_ENABLED ? [
    { id: "overview", icon: Icons.Grid, label: "Dashboard" },
    { id: "classes", icon: Icons.Layers, label: "Classes", badge: totalDepartments || undefined },
    { id: "teachers", icon: Icons.Users, label: "Teachers", badge: totalTeachersAll || undefined },
    { id: "students", icon: Icons.User, label: "Students", badge: totalStudents || undefined },
    { id: "attendance", icon: Icons.Calendar, label: "Attendance" },
    { id: "analytics", icon: Icons.Chart, label: "Analytics" },
  ] : [
    { id: "overview", icon: Icons.Grid, label: "Dashboard" },
    { id: "departments", icon: Icons.Building, label: "Departments", badge: totalDepartments || undefined },
    { id: "teachers", icon: Icons.Users, label: "Teachers", badge: totalTeachersAll || undefined },
    { id: "students", icon: Icons.User, label: "Students", badge: totalStudents || undefined },
    { id: "batches", icon: Icons.Layers, label: "Batches", badge: totalBatches || undefined },
    { id: "attendance", icon: Icons.Calendar, label: "Attendance" },
    { id: "analytics", icon: Icons.Chart, label: "Analytics" },
  ];

  const rootClass = `dashboard-root ${isDarkMode ? "dark-mode" : ""}`;

  if (loading) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="text-center anim-in">
          <div className="w-10 h-10 rounded-full anim-spin mx-auto mb-4" style={{ border: "3px solid #F0F2F5", borderTopColor: "#FF7043" }} />
          <p className="text-slate-500 font-bold text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!institute && instLoadError) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center px-4`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div role="alert" className="glass-overlay rounded-3xl p-10 max-w-md w-full text-center">
          <h2 className="text-xl font-black text-slate-900 mb-2">Couldn't load your institute</h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">Check your internet connection and try again.</p>
          <button className="btn-orange w-full py-3.5 rounded-xl" onClick={() => { resolveQ.refetch(); metaQ.refetch(); }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!institute) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center px-4`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="glass-overlay rounded-3xl p-10 max-w-md w-full text-center anim-pop">
          <button onClick={goHome} className="flex items-center gap-1.5 mx-auto mb-6 text-[12px] font-bold text-slate-400 hover:text-[#FF7043] transition-colors">
            <Icons.Home /> Back to home
          </button>
          <div className="w-14 h-14 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-6">
            <Icons.Building />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Create your institute</h2>
          <p className="text-sm text-slate-500 mb-8 font-medium">Set up your school or coaching center on a4ai.</p>
          <input
            className="field mb-4 text-center"
            placeholder="Institute name"
            value={newInstituteName}
            onChange={e => setNewInstituteName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreateInstitute()}
          />
          <button
            className="btn-orange w-full py-3.5 rounded-xl"
            onClick={handleCreateInstitute}
            disabled={creatingInstitute || !newInstituteName.trim()}
          >
            {creatingInstitute ? <><Icons.Loader /> Creating...</> : <>Create Institute</>}
          </button>
          <p className="text-[11px] text-slate-400 font-medium mt-4">
            Tip: if you already have an institute, don't create another with the same name — use a different name.
          </p>
        </div>
      </div>
    );
  }

  const availSectionsForBatch = newBatch.department_id ? sectionsOfDept(newBatch.department_id) : [];
  const availSectionsForStudent = newStudent.department_id ? sectionsOfDept(newStudent.department_id) : [];
  const availSectionsForFilter = deptFilter && deptFilter !== "none" ? sectionsOfDept(deptFilter) : [];

  return (
    <div className={`${rootClass} h-[100dvh] min-h-[100dvh] w-full flex overflow-hidden text-slate-800`}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <aside className={`fixed lg:relative top-0 left-0 w-[260px] h-full bg-white border-r border-slate-200 flex flex-col shrink-0 z-[100] lg:z-20 transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <button onClick={goHome} title="Back to home" aria-label="Back to home" className="w-9 h-9 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center hover:bg-[#FF7043] hover:text-white transition-all shrink-0">
            <Icons.Home />
          </button>
          <button onClick={goHome} className="flex items-center gap-2 group">
            <img src="/ICON.ico" alt="" className="w-6 h-6 object-contain" onError={(e: any) => { e.currentTarget.style.display = "none"; }} />
            <span className="font-black text-[16px] tracking-tight text-slate-900 group-hover:text-[#FF7043] transition-colors">a4ai</span>
          </button>
          <button className="lg:hidden ml-auto p-1 text-slate-400 hover:text-slate-600" onClick={() => setMobileMenuOpen(false)}>
            <Icons.X />
          </button>
        </div>

        <div className="px-5 py-3 relative" ref={profileRef}>
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-full flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-[14px] bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-black text-base">
                {getInitials(displayName)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight truncate">{displayName}</h2>
              <p className="text-[11px] text-slate-500 font-medium">Administrator</p>
            </div>
            <span className="ml-auto text-slate-400"><Icons.ChevronDown /></span>
          </button>

          {isProfileOpen && (
            <div className="absolute left-5 right-5 top-full mt-1 bg-white rounded-2xl border border-slate-100 shadow-xl p-1.5 z-50 anim-in">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <p className="text-[13px] font-bold text-slate-800 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={goHome} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <Icons.Home /> Home page
              </button>
              <button onClick={() => { setActiveTab("analytics"); setIsProfileOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <Icons.Settings /> Institute settings
              </button>
              <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Icons.LogOut /> Sign out
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3">
          <p className="text-[11px] font-bold text-slate-400 mb-2">Institute</p>
          <button onClick={() => setActiveTab("analytics")} className="w-full flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <span className="text-[13px] font-bold text-slate-700 truncate">{institute.name}</span>
            <span className="text-slate-400 shrink-0"><Icons.ChevronRight /></span>
          </button>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 px-2 mb-2 mt-2">Menu</p>
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id, { replace: mobileMenuOpen }); setMobileMenuOpen(false); }}
                onPointerEnter={PRELOAD[item.id]}
                onFocus={PRELOAD[item.id]}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] transition-colors ${activeTab === item.id ? "active-nav-item" : "text-slate-500 hover:bg-slate-50 font-medium"}`}
              >
                <item.icon />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md ${activeTab === item.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <p className="text-[11px] font-bold text-slate-400 px-2 mb-2 mt-6">Quick Actions</p>
          <div className="px-2 flex flex-wrap items-center gap-2 mb-6">
            <button onClick={() => setShowAddStudent(true)} title="Add student" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.UserPlus /></button>
            <button onClick={() => (CLASS_SUBJECT_BATCH_ENABLED ? setActiveTab("classes") : setShowAddBatch(true))} title="New batch" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Layers /></button>
            <button onClick={() => (CLASS_SUBJECT_BATCH_ENABLED ? setActiveTab("classes") : setShowAddDept(true))} title="New department" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Building /></button>
            <button onClick={copyCode} title="Copy join code" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Key /></button>
            <button onClick={() => setShowBulkUpload(true)} title="Bulk upload students" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Upload /></button>
            <button onClick={() => navigate("/dashboard/test-generator")} title="Generate test" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Zap /></button>
          </div>

          <div className="mx-2 p-5 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center">
            <button onClick={() => setShowAddStudent(true)} className="w-10 h-10 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-lg shadow-orange-500/30 mb-3 hover:scale-105 transition-transform">
              <Icons.Plus />
            </button>
            <p className="text-[13px] font-bold text-slate-800">Add New Student</p>
            <p className="text-[11px] text-slate-500 mt-1">
              or share the <button onClick={copyCode} className="text-[#FF7043] font-bold hover:underline">join code</button>
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-full">
            <button onClick={() => setIsDarkMode(true)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-[12px] font-bold transition-all ${isDarkMode ? "bg-white shadow-sm text-slate-800" : "text-slate-400"}`}><Icons.Moon /> Dark</button>
            <button onClick={() => setIsDarkMode(false)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-[12px] font-bold transition-all ${!isDarkMode ? "bg-white shadow-sm text-slate-800" : "text-slate-400"}`}><Icons.Sun /> Light</button>
          </div>
        </div>
      </aside>

      {/* ═══════════ MAIN ═══════════ */}
      <main ref={mainRef} onScroll={onMainScroll} className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* ── Sticky Mobile Top Header ── */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-white/95 dark:bg-[#171D2B]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 lg:hidden shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 touch-target transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Icons.Menu />
            </button>
            <button onClick={goHome} title="Back to home" className="w-8 h-8 rounded-lg bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0">
              <Icons.Home />
            </button>
            <div className="min-w-0">
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white truncate">{institute.name}</span>
              <span className="block text-[10px] font-semibold text-slate-400 capitalize">{activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle dark mode"
              className="p-2 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDarkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className="w-8 h-8 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-bold text-xs"
            >
              {getInitials(displayName)}
            </button>
          </div>
        </header>

        <div className={`px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 lg:pb-8 mx-auto w-full ${activeTab === "attendance" ? "max-w-7xl" : "max-w-5xl"}`}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="bg-white rounded-3xl card-shadow border border-slate-50 overflow-hidden mb-6">
                <div
                  className="relative h-40 sm:h-48 bg-gradient-to-br from-[#FF7043] via-[#FF8A65] to-[#FFAB91] group cursor-pointer"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {bannerUrl && <img src={bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold text-slate-700 shadow-lg">
                      {uploadingBanner ? <><Icons.Loader /> Uploading...</> : <><Icons.Image /> {bannerUrl ? "Change Banner" : "Upload Banner"}</>}
                    </div>
                  </div>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={uploadBanner} />
                </div>

                <div className="px-4 sm:px-6 lg:px-8 pb-6 relative">
                  <div className="-mt-14 sm:-mt-16 mb-4">
                    <button onClick={() => logoInputRef.current?.click()} className="relative group shrink-0" disabled={uploadingLogo}>
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                        {logoUrl
                          ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gradient-to-br from-[#FFF5F2] to-[#FFECDF] flex items-center justify-center">
                            <span className="text-3xl font-black text-[#FF7043]">{institute.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                        }
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center border-4 border-transparent">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          {uploadingLogo ? <Icons.Loader /> : <Icons.Image />}
                        </div>
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {editingName ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input className="field text-xl font-black py-2 flex-1 min-w-[180px]" value={editNameValue} onChange={e => setEditNameValue(e.target.value)} autoFocus
                            onKeyDown={e => { if (e.key === "Enter") saveInstituteName(); if (e.key === "Escape") setEditingName(false); }} />
                          <button onClick={saveInstituteName} className="btn-orange px-4 py-2 rounded-xl text-sm touch-target">Save</button>
                          <button onClick={() => setEditingName(false)} className="btn-ghost px-3 py-2 rounded-xl text-sm touch-target">Cancel</button>
                        </div>
                      ) : (
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight cursor-pointer hover:text-[#FF7043] transition-colors group"
                          onClick={() => { setEditNameValue(institute.name); setEditingName(true); }}>
                          {institute.name}
                          <span className="opacity-0 group-hover:opacity-100 text-[12px] font-bold text-slate-400 ml-2">✎ edit</span>
                        </h2>
                      )}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.Building /> {totalDepartments} dept{totalDepartments !== 1 ? "s" : ""}</span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.Users /> {totalTeachersAll} teacher{totalTeachersAll !== 1 ? "s" : ""}</span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.User /> {totalStudents} student{totalStudents !== 1 ? "s" : ""}</span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.Layers /> {totalBatches} batch{totalBatches !== 1 ? "es" : ""}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher Join Code</span>
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <Icons.Key />
                        <code className="join-code text-[14px] font-black text-slate-800">{institute.join_code}</code>
                        <button onClick={copyCode} className="p-1 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors">
                          {joinCodeCopied ? <Icons.Check /> : <Icons.Copy />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center bg-white px-4 py-3 rounded-xl card-shadow border border-slate-100 mb-6">
                <span className="text-slate-400 mr-2"><Icons.Search /></span>
                <input
                  type="text"
                  placeholder="Search students by name, roll no, batch..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveTab("students"); }}
                  className="bg-transparent border-none outline-none text-[14px] font-medium w-full text-slate-700 placeholder-slate-400"
                />
                {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 p-1"><Icons.X /></button>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {[
                  { label: "Departments", value: totalDepartments, cap: 0, pct: totalDepartments ? Math.min(totalDepartments / 10, 1) : 0, tint: "bg-teal-100 text-teal-600", bar: "#14B8A6", Icon: Icons.Building, tab: "departments" },
                  { label: "Teachers", value: totalTeachersAll, cap: maxTeachers, pct: teacherPct, tint: "bg-blue-100 text-blue-600", bar: "#5C67F2", Icon: Icons.Users, tab: "teachers" },
                  { label: "Students", value: totalStudents, cap: maxStudents, pct: studentPct, tint: "bg-red-100 text-red-500", bar: "#FF5252", Icon: Icons.User, tab: "students" },
                  { label: "Batches", value: totalBatches, cap: 0, pct: batchPct, tint: "bg-green-100 text-green-600", bar: "#00C853", Icon: Icons.Layers, tab: "batches" },
                ].map((card, i) => (
                  <button key={i} onClick={() => setActiveTab(card.tab)} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow card-hover border border-slate-50 flex flex-col justify-between h-32 sm:h-36 text-left">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full ${card.tint} flex items-center justify-center shrink-0`}><card.Icon /></div>
                      <div>
                        <p className="text-[11px] sm:text-[12px] font-bold text-slate-400">{card.label}</p>
                        <p className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 sm:mt-1 stat-number">{card.value}</p>
                      </div>
                    </div>
                    <div>
                      <div className="progress-bar-bg mb-1 sm:mb-2">
                        <div className="progress-fill" style={{ width: `${card.pct * 100}%`, background: card.bar }} />
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                        {card.cap ? `${Math.round(card.pct * 100)}% of ${card.cap} limit` : "no limit set"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="w-full bg-white rounded-2xl card-shadow border border-slate-50 p-4 sm:p-6 mb-6 sm:mb-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Seats Used</p>
                    <p className="text-[16px] font-bold text-slate-800 stat-number">{totalStudents}<span className="text-slate-400"> / {maxStudents || "—"}</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Avg per Batch</p>
                    <p className="text-[16px] font-bold text-slate-800 stat-number">{avgPerBatch}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Unassigned</p>
                    <p className={`text-[16px] font-bold stat-number ${unassigned > 0 ? "text-[#FF7043]" : "text-green-500"}`}>{unassigned}</p>
                  </div>
                  <button onClick={() => setActiveTab("analytics")} className="btn-ghost px-4 py-2 rounded-lg text-[13px]"><Icons.Chart /> Analytics</button>
                </div>
                {batchChart.length > 0 ? <BatchBars data={batchChart} /> : (
                  <div className="h-40 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-slate-500 font-medium mb-3">No batches yet — create one to see enrollment</p>
                    <button onClick={() => (CLASS_SUBJECT_BATCH_ENABLED ? setActiveTab("classes") : setShowAddBatch(true))} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]">Create Batch</button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-bold text-slate-800">Latest Students</h3>
                  {totalStudents > 6 && <button onClick={() => setActiveTab("students")} className="text-[11px] font-bold text-[#FF7043] hover:underline">View All →</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {students.length > 0 ? students.slice(0, 6).map(student => (
                    <div key={student.id} onClick={() => navigate(`/institute/students/${student.id}`)} className="bg-white rounded-2xl p-3 sm:p-3.5 flex items-center justify-between card-shadow border border-slate-50 anim-row cursor-pointer hover:border-[#FF7043]/30 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-bold text-sm shrink-0">{getInitials(student.name)}</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">{student.name}</p>
                          <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                            {student.batch_name}{student.roll_no ? ` · Roll ${student.roll_no}` : ""}
                            {student.department_id ? ` · ${deptName(student.department_id)}` : ""}
                          </p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); contactParent(student); }} title={student.parent_phone ? `WhatsApp ${student.parent_phone}` : "No phone"} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:border-[#FF7043] hover:text-[#FF7043] transition-colors shrink-0"><Icons.Phone /></button>
                    </div>
                  )) : (
                    <div className="sm:col-span-2 bg-white rounded-2xl p-8 text-center card-shadow border border-slate-50">
                      <p className="text-sm text-slate-500 font-medium mb-4">No students enrolled yet.</p>
                      <button onClick={() => setShowAddStudent(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px] mx-auto"><Icons.Plus /> Add Student</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── CLASSES TAB (Class → Subject → Batch → Teacher; flag only) ── */}
          {CLASS_SUBJECT_BATCH_ENABLED && activeTab === "classes" && institute && (
            <LazySection label="Classes" fallback={<SectionSkeleton label="classes" rows={6} />}>
              <ClassesTab
                instituteId={institute.id}
                classes={departments}
                subjects={subjects}
                batches={batches}
                teaching={teachingQ.data ?? []}
                teachers={teachers}
                studentCount={studentCountOf}
                studentsInClass={studentsInClass}
                onChanged={() => invalidate("classTree")}
              />
            </LazySection>
          )}

          {/* ── DEPARTMENTS TAB ── */}
          {activeTab === "departments" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <p className="text-[13px] text-slate-500 font-bold">{totalDepartments} department{totalDepartments !== 1 ? "s" : ""} · {totalSections} section{totalSections !== 1 ? "s" : ""}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setNewSection({ department_id: departments[0]?.id || "", name: "", year: "" }); setShowAddSection(true); }} disabled={departments.length === 0} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"><Icons.Layers /> New Section</button>
                  <button onClick={() => setShowAddDept(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> New Department</button>
                </div>
              </div>

              {departments.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-500 flex items-center justify-center mx-auto mb-4"><Icons.Building /></div>
                  <p className="text-[15px] font-bold text-slate-800 mb-2">No departments yet</p>
                  <p className="text-sm text-slate-500 font-medium mb-5">Create departments like &ldquo;JEE&rdquo;, &ldquo;NEET&rdquo;, or &ldquo;Class 10&rdquo; to organize your institute.</p>
                  <button onClick={() => setShowAddDept(true)} className="btn-orange px-6 py-2.5 rounded-xl text-[13px] mx-auto"><Icons.Plus /> Create First Department</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {departments.map(d => {
                    const dSecs = sectionsOfDept(d.id);
                    const dTeachers = teachersOfDept(d.id);
                    const dBatches = batchesOfDept(d.id);
                    const dStudents = studentsOfDept(d.id);
                    const dHod = hodOfDept(d.id);
                    const isExpanded = expandedDept === d.id;
                    return (
                      <div key={d.id} className="bg-white rounded-2xl card-shadow border border-slate-50 anim-row overflow-hidden relative">
                        <div className="dept-accent" />
                        <div className="p-6">
                          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center shrink-0"><Icons.Building /></div>
                              <div className="min-w-0">
                                <h3 className="text-[17px] font-black text-slate-900 truncate">{d.name}</h3>
                                <p className="text-[12px] text-slate-500 font-medium mt-0.5">{dSecs.length} sections · {dTeachers.length} teachers · {dBatches.length} batches · {dStudents.length} students</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setExpandedDept(isExpanded ? null : d.id)} className="btn-ghost px-3 py-2 rounded-lg text-[12px]">
                                {isExpanded ? "Hide" : "Manage"}
                                <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}><Icons.ChevronDown /></span>
                              </button>
                              <button onClick={() => deleteDept(d.id, d.name)} title="Delete department" className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                            </div>
                          </div>

                          {HOD_ENABLED && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Icons.Crown /></div>
                            <div className="flex-1 min-w-0">
                              {dHod ? (
                                <>
                                  <p className="text-[13px] font-bold text-slate-800 truncate">{teacherDisplayName(dHod)}</p>
                                  <p className="text-[11px] font-medium text-slate-500">HOD · joined {fmtDate(dHod.joined_at)}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-[13px] font-bold text-slate-800">No HOD assigned</p>
                                  <p className="text-[11px] font-medium text-slate-500">Assign a teacher to lead this department</p>
                                </>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              {dHod && <button onClick={() => demoteHod(dHod.id)} title="Demote to teacher" className="btn-ghost px-3 py-1.5 rounded-lg text-[11px]">Demote</button>}
                              <button onClick={() => setAssignHodDept(d)} className="btn-orange px-3 py-1.5 rounded-lg text-[11px]"><Icons.UserPlus /> {dHod ? "Replace" : "Assign"}</button>
                            </div>
                          </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                            {[
                              { kind: "student_code" as const, code: d.student_code, label: "Student Code", tint: "bg-blue-50 text-blue-600" },
                              { kind: "teacher_code" as const, code: d.teacher_code, label: "Teacher Code", tint: "bg-orange-50 text-[#FF7043]" },
                            ].map(c => {
                              const cKey = c.kind === "student_code" ? "s" : "t";
                              const isCopied = copiedDeptCode === `${d.id}-${cKey}`;
                              return (
                                <div key={c.kind} className="p-3 rounded-xl border border-slate-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${c.tint}`}>{c.label}</div>
                                    <button onClick={() => regenDeptCode(d.id, d.name, c.kind)} title="New code" className="text-slate-400 hover:text-[#FF7043] transition-colors"><Icons.Refresh /></button>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <code className="font-mono text-[13px] font-black text-slate-800 truncate">{c.code || "—"}</code>
                                    <button onClick={() => copyDeptCode(d.id, c.code || "", cKey as "s" | "t")} disabled={!c.code} className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors disabled:opacity-30">
                                      {isCopied ? <Icons.Check /> : <Icons.Copy />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-100 p-6 bg-slate-50/40 anim-in">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[13px] font-bold text-slate-700">Sections in {d.name}</p>
                              <button onClick={() => { setNewSection({ department_id: d.id, name: "", year: "" }); setShowAddSection(true); }} className="btn-ghost px-3 py-1.5 rounded-lg text-[11px]"><Icons.Plus /> Add Section</button>
                            </div>
                            {dSecs.length === 0 ? (
                              <p className="text-[12px] text-slate-500 font-medium py-4 text-center">No sections. Sections help subdivide a department (e.g., Section A, Section B).</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {dSecs.map(s => {
                                  const secStudents = students.filter(st => st.section_id === s.id).length;
                                  return (
                                    <div key={s.id} className="bg-white rounded-xl p-3 flex items-center gap-2 border border-slate-100">
                                      <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><Icons.Layers /></div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold text-slate-800 truncate">{s.name}{s.year ? ` · Y${s.year}` : ""}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{secStudents} student{secStudents !== 1 ? "s" : ""}</p>
                                      </div>
                                      <button onClick={() => deleteSection(s.id, s.name)} title="Delete" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TEACHERS TAB ── */}
          {activeTab === "teachers" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="bg-white rounded-2xl p-5 mb-4 card-shadow border border-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <p className="text-[13px] text-slate-500 font-medium">Teachers join by entering this code:</p>
                  <div className="flex items-center gap-2">
                    <button onClick={regenerateJoinCode} disabled={regeneratingCode} className="btn-ghost px-3 py-2 rounded-lg text-[12px] disabled:opacity-50">
                      {regeneratingCode ? <Icons.Loader /> : <Icons.Refresh />} New Code
                    </button>
                    <button onClick={copyCode} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]">
                      {joinCodeCopied ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy Code</>}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="join-code text-2xl font-black text-slate-900 bg-slate-50 px-4 py-2 rounded-xl">{institute.join_code}</code>
                  <button onClick={copyJoinLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-[#FF7043] transition-colors truncate max-w-full">
                    <Icons.Share />
                    <span className="truncate">{typeof window !== "undefined" ? window.location.origin : "app.a4ai.in"}/join?code={institute.join_code}</span>
                  </button>
                </div>
                {!CLASS_SUBJECT_BATCH_ENABLED && departments.length > 0 && <p className="text-[11px] text-slate-400 font-medium mt-3">Tip: use department-specific codes from the Departments tab to auto-assign teachers to a department.</p>}
              </div>

              {classTree && (
                <LazySection label="Teachers" fallback={<SectionSkeleton label="teachers" rows={4} />}>
                  <TeachersSimple
                    instituteId={institute.id}
                    teachers={teachers}
                    tree={classTree}
                    onChanged={() => invalidate("classTree")}
                    onRemoveTeacher={removeTeacher}
                    onOpenClasses={() => setActiveTab("classes")}
                  />
                </LazySection>
              )}
            </div>
          )}

          {/* ── STUDENTS TAB ── */}
          {activeTab === "students" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-[13px] text-slate-500 font-bold">{search || deptFilter || sectionFilter ? `${filteredStudents.length} match${filteredStudents.length !== 1 ? "es" : ""}` : `${totalStudents} total`}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadAccessCodesCSV} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]" title="Download access codes CSV for parents">📥 Access Codes CSV</button>
                  <button onClick={() => setShowBulkUpload(true)} onPointerEnter={loadBulkUpload} onFocus={loadBulkUpload} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]"><Icons.Upload /> Bulk Upload</button>
                  <button onClick={() => setShowAddStudent(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> Add Student</button>
                </div>
              </div>

              {/* Stays on screen while the list scrolls: search, filters, selection + Assign batches */}
              <div className="sticky-bar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-3 pb-3 mb-3 space-y-2" data-testid="students-toolbar">
                <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 mr-2"><Icons.Search /></span>
                  <input
                    type="text"
                    enterKeyHint="search"
                    aria-label="Search students"
                    placeholder="Search by name, roll no, batch..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-[14px] font-medium w-full text-slate-700 placeholder-slate-400"
                  />
                  {search && <button onClick={() => setSearch("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600 p-1"><Icons.X /></button>}
                </div>

                {departments.length > 0 && (
                  <div className="chip-row">
                    <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Filter /> {CLASS_SUBJECT_BATCH_ENABLED ? "Class" : "Dept"}:</span>
                    <button onClick={() => setDeptFilter("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                    <button onClick={() => setDeptFilter("none")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "none" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Unassigned</button>
                    {departments.map(d => (
                      <button key={d.id} onClick={() => setDeptFilter(d.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === d.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
                    ))}
                  </div>
                )}
                {showSections && availSectionsForFilter.length > 0 && (
                  <div className="chip-row">
                    <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Layers /> Section:</span>
                    <button onClick={() => setSectionFilter("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${sectionFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                    {availSectionsForFilter.map(s => (
                      <button key={s.id} onClick={() => setSectionFilter(s.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${sectionFilter === s.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.name}{s.year ? ` · Y${s.year}` : ""}</button>
                    ))}
                  </div>
                )}

                {filteredStudents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-h-[38px]">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#FF7043]"
                        checked={allShownSelected}
                        ref={el => { if (el) el.indeterminate = someShownSelected && !allShownSelected; }}
                        onChange={e => {
                          const on = e.target.checked;
                          setSelectedStudentIds(prev => {
                            const next = new Set(prev);
                            for (const s of filteredStudents) { if (on) next.add(s.id); else next.delete(s.id); }
                            return next;
                          });
                        }}
                      />
                      Select all shown ({filteredStudents.length})
                    </label>
                    {selectedStudentIds.size > 0 && (
                      <>
                        <span className="text-[12px] font-bold text-[#E64A19]">{selectedStudentIds.size} selected</span>
                        <button onClick={() => setAssignStudentIds([...selectedStudentIds])} onPointerEnter={loadBatchAssign} onFocus={loadBatchAssign}
                          className="btn-orange px-4 py-2 rounded-xl text-[13px]" title="Add or remove batches for the selected students">
                          <Icons.Layers /> Assign batches ({selectedStudentIds.size})
                        </button>
                        <button onClick={() => setSelectedStudentIds(new Set())} className="text-[12px] font-bold text-slate-400 hover:text-slate-600">Clear selection</button>
                      </>
                    )}
                    {selectedStudentIds.size === 0 && (
                      <span className="text-[11px] text-slate-400">Tap a student to select · Edit to change details or batches</span>
                    )}
                    {!multiBatchReady && studentBatchesQ.isSuccess && (
                      <span className="text-[11px] text-amber-700">Several batches per student need the server update (migration 33).</span>
                    )}
                  </div>
                )}
              </div>

              {filteredStudents.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
                  <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3"><Icons.User /></div>
                  <p className="text-sm text-slate-500 font-medium">{students.length === 0 ? "No students enrolled yet." : "No students match those filters."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudents.map(s => {
                    const selected = selectedStudentIds.has(s.id);
                    const named = [...(memberships.get(s.id) ?? [])]
                      .map(id => batchById.get(id)).filter((b): b is Batch => !!b)
                      .sort((a, b) => Number(b.id === s.batch_id) - Number(a.id === s.batch_id) || a.name.localeCompare(b.name));
                    const code = (s as any).student_access_codes?.[0]?.access_code;
                    return (
                      <div
                        key={s.id}
                        data-testid="student-row"
                        aria-selected={selected}
                        onClick={e => {
                          // the whole card selects; buttons / links inside do their own thing; dragging to copy text doesn't select
                          if ((e.target as HTMLElement).closest("button, a, input, select, label")) return;
                          if (window.getSelection()?.toString()) return;
                          toggleStudent(s.id);
                        }}
                        className={`bg-white rounded-2xl p-4 flex flex-wrap items-center gap-3 card-shadow border-2 anim-row cursor-pointer transition-colors ${selected ? "border-[#FF7043]/60" : "border-transparent hover:border-slate-200"}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.name}`}
                          className="w-5 h-5 accent-[#FF7043] shrink-0 cursor-pointer"
                          checked={selected}
                          onChange={() => toggleStudent(s.id)}
                        />
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${selected ? "bg-[#FF7043] text-white" : "bg-[#FFF5F2] text-[#FF7043]"}`}>
                          {selected ? <Icons.Check /> : getInitials(s.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{s.name}</p>
                            {s.department_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">{deptName(s.department_id)}</span>}
                            {s.section_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600">{sectionName(s.section_id)}</span>}
                          </div>
                          {named.length > 0 ? (
                            <div className="flex flex-wrap gap-1 my-1">
                              {named.map(b => (
                                <span key={b.id} className="subj-chip inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={subjectVars(batchSubjectColor(b))}
                                  title={b.id === s.batch_id ? `${b.name} — main batch (attendance)` : b.name}>
                                  {b.id === s.batch_id && <span aria-hidden className="subj-dot w-1.5 h-1.5 rounded-full" />}
                                  {b.name}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-[10px] font-bold text-slate-400">No batch</span>}
                          <p className="text-[11px] font-medium text-slate-400 truncate">Roll {s.roll_no || "N/A"}{s.parent_phone ? ` · ${s.parent_phone}` : ""}{code ? ` · 🔑 ${code}` : ""}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">Class {s.class_level || "—"}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditStudentId(s.id)} onPointerEnter={loadStudentEdit} onFocus={loadStudentEdit}
                            title="Edit details and batches" aria-label={`Edit ${s.name}`}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-bold text-slate-500 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors">
                            <Icons.Edit /> <span className="hidden sm:inline">Edit</span>
                          </button>
                          <Link to={`/institute/students/${s.id}`} title="Open profile" aria-label={`Open profile of ${s.name}`}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-bold text-slate-500 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors">
                            <Icons.Profile /> <span className="hidden sm:inline">Profile</span>
                          </Link>
                          <button onClick={() => contactParent(s)} title="Message parent" aria-label={`Message parent of ${s.name}`} className="p-2 rounded-lg text-slate-300 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors"><Icons.Phone /></button>
                          <button onClick={() => removeStudent(s.id)} title="Remove student" aria-label={`Remove ${s.name}`} className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BATCHES TAB ── */}
          {activeTab === "batches" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-[13px] text-slate-500 font-bold">{deptFilter || sectionFilter ? `${filteredBatches.length} match${filteredBatches.length !== 1 ? "es" : ""}` : `${totalBatches} active`}</p>
                <button onClick={() => setShowAddBatch(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> New Batch</button>
              </div>

              {departments.length > 0 && (
                <div className="chip-row mb-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Filter /> Dept:</span>
                  <button onClick={() => setDeptFilter("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                  <button onClick={() => setDeptFilter("none")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "none" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Unassigned</button>
                  {departments.map(d => (
                    <button key={d.id} onClick={() => setDeptFilter(d.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === d.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
                  ))}
                </div>
              )}

              {filteredBatches.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
                  <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3"><Icons.Layers /></div>
                  <p className="text-sm text-slate-500 font-medium mb-4">{batches.length === 0 ? "No batches yet." : "No batches match this filter."}</p>
                  {batches.length === 0 && <button onClick={() => setShowAddBatch(true)} className="btn-orange px-6 py-2.5 rounded-xl text-[13px] mx-auto">Create Batch</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBatches.map(b => {
                    const count = batchCounts.get(b.id) ?? 0;
                    const c = batchSubjectColor(b);
                    return (
                      <div key={b.id} data-testid="batch-card" onClick={() => setBatchMembersId(b.id)} onPointerEnter={loadBatchStudents}
                        style={subjectVars(c)}
                        className="bg-white rounded-2xl p-5 pt-6 card-shadow card-hover border border-slate-50 relative group anim-row overflow-hidden cursor-pointer flex flex-col">
                        <div aria-hidden className="subj-accent absolute top-0 left-0 right-0 h-1.5" />
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); deleteBatch(b.id); }} title="Delete batch" aria-label={`Delete batch ${b.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                        </div>
                        <div className="subj-tile w-11 h-11 rounded-xl flex items-center justify-center mb-3 font-black text-[12px] tracking-wide" aria-hidden>
                          {c.short || <Icons.Layers />}
                        </div>
                        <h4 className="text-[14px] font-bold text-slate-800 pr-8">{b.name}</h4>
                        <p className="text-[12px] font-medium text-slate-400 mb-3">
                          {b.class_level ? `Class ${b.class_level}` : "No class set"}
                          {c.label ? ` · ${c.label}` : b.subject ? ` · ${b.subject}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="subj-chip text-[10px] font-bold px-2.5 py-1 rounded-full">{count} student{count !== 1 ? "s" : ""}</span>
                          {b.department_id && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-600">{deptName(b.department_id)}</span>}
                          {b.section_id && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600">{sectionName(b.section_id)}</span>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); setBatchMembersId(b.id); }} onFocus={loadBatchStudents}
                          className="mt-auto self-start text-[12px] font-bold text-[#FF7043] hover:underline">
                          View / edit students →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE TAB ── */}
          {activeTab === "attendance" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="mb-4 sm:mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800">Attendance</h2>
                <p className="text-sm text-slate-400 mt-1">Monitor teacher marking status and export monthly reports</p>
              </div>
              <LazySection label="Attendance">
                <HODAttendanceDashboard
                  instituteId={institute.id}
                  isHod={isHod}
                  hodDeptId={hodDeptId}
                  teachers={teachers}
                  batches={batches}
                  departments={departments}
                  subjects={subjects}
                />
              </LazySection>
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === "analytics" && (
            <div className="anim-entrance space-y-6" style={{ animationDelay: "0.05s" }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                  { l: "Departments", v: totalDepartments },
                  { l: "Sections", v: totalSections },
                  { l: "Teachers", v: totalTeachersAll },
                  { l: "Batches", v: totalBatches },
                  { l: "Students", v: totalStudents },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase mb-1">{s.l}</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-800 stat-number">{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[16px] font-bold text-slate-800 mb-6">Enrollment by Batch</h3>
                {batchChart.length > 0 ? <BatchBars data={batchChart} /> : <div className="h-40 flex items-center justify-center text-sm text-slate-500 font-medium">No batches yet</div>}
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[16px] font-bold text-slate-800 mb-4">Batch Settings</h3>
                <LazySection label="Batch settings"><BatchManagementPanel instituteId={institute.id} /></LazySection>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[16px] font-bold text-slate-800 mb-5">Institute Details</h3>
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Name</p>
                    <p className="text-[15px] font-bold text-slate-800 mt-1">{institute.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Join Code</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <code className="join-code text-[18px] font-black text-slate-800">{institute.join_code}</code>
                      <button onClick={copyCode} className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors">{joinCodeCopied ? <Icons.Check /> : <Icons.Copy />}</button>
                      <button onClick={copyJoinLink} title="Copy join link" className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors"><Icons.Share /></button>
                      <button onClick={regenerateJoinCode} disabled={regeneratingCode} title="Regenerate code" className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors disabled:opacity-50">{regeneratingCode ? <Icons.Loader /> : <Icons.Refresh />}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    {[{ l: "Max Teachers", v: institute.max_teachers }, { l: "Max Students", v: institute.max_students }, { l: "Monthly Tests", v: institute.monthly_test_limit }].map((s, i) => (
                      <div key={i}>
                        <p className="text-[11px] font-bold text-slate-400 uppercase">{s.l}</p>
                        <p className="text-xl font-black text-slate-800 mt-1 stat-number">{s.v ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[16px] font-bold text-slate-800 mb-4">Account</h3>
                <div className="space-y-2">
                  <button onClick={goHome} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-[#FF7043]/40 hover:bg-[#FFF5F2] transition-all group">
                    <span className="flex items-center gap-3 text-slate-600 group-hover:text-[#FF7043] text-[13px] font-bold"><Icons.Home /> Back to home page</span>
                    <span className="text-slate-400 group-hover:text-[#FF7043]"><Icons.ChevronRight /></span>
                  </button>
                  <button onClick={() => navigate("/pricing")} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-[#FF7043]/40 hover:bg-[#FFF5F2] transition-all group">
                    <span className="flex items-center gap-3 text-slate-600 group-hover:text-[#FF7043] text-[13px] font-bold"><Icons.Rocket /> View plans</span>
                    <span className="text-slate-400 group-hover:text-[#FF7043]"><Icons.ChevronRight /></span>
                  </button>
                  <button onClick={handleSignOut} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all">
                    <span className="flex items-center gap-3 text-red-500 text-[13px] font-bold"><Icons.LogOut /> Sign out</span>
                    <span className="text-red-300"><Icons.ChevronRight /></span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── 5-Slot Mobile Bottom Navigation Dock (Zomato-integrated) ── */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#171D2B]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-bottom"
      >
        {/* Slot 1: Overview */}
        <button
          type="button"
          onClick={() => setActiveTab("overview", { replace: true })}
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-w-0 ${
            activeTab === "overview" ? "text-[#FF7043] font-bold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Icons.Grid />
          <span className="text-[10px] mt-1 font-medium truncate">Home</span>
        </button>

        {/* Slot 2: Classes / Batches */}
        <button
          type="button"
          onClick={() => setActiveTab(CLASS_SUBJECT_BATCH_ENABLED ? "classes" : "batches", { replace: true })}
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-w-0 ${
            activeTab === (CLASS_SUBJECT_BATCH_ENABLED ? "classes" : "batches")
              ? "text-[#FF7043] font-bold"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Icons.Layers />
          <span className="text-[10px] mt-1 font-medium truncate">
            {CLASS_SUBJECT_BATCH_ENABLED ? "Classes" : "Batches"}
          </span>
        </button>

        {/* Slot 3: Center dock pedestal. The Zomato-style FloatingMic docks above this slot and
            handles the tap; this spacer only reserves the layout column (no overlapping label). */}
        <div
          className="flex flex-1 flex-col items-center justify-end h-12 pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-[10px] font-bold tracking-tight text-[#8B35E8] mt-auto pb-0.5">
            Ask a4ai
          </span>
        </div>

        {/* Slot 4: Students */}
        <button
          type="button"
          onClick={() => setActiveTab("students", { replace: true })}
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-w-0 ${
            activeTab === "students" ? "text-[#FF7043] font-bold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Icons.User />
          <span className="text-[10px] mt-1 font-medium truncate">Students</span>
        </button>

        {/* Slot 5: More / Drawer */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-1 text-slate-400 hover:text-slate-600 transition-colors min-w-0"
        >
          <Icons.Menu />
          <span className="text-[10px] mt-1 font-medium truncate">More</span>
        </button>
      </nav>

      {/* ═══════════ MODALS ═══════════ */}

      {showAddBatch && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={() => setShowAddBatch(false)}>
          <div className="glass-overlay rounded-[32px] p-8 max-w-sm w-full relative anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Create Batch</h3>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">Group students by class or subject</p>
              </div>
              <button onClick={() => setShowAddBatch(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
            </div>
            <div className="space-y-3">
              <input className="field-soft" placeholder="Batch name *" value={newBatch.name} onChange={e => setNewBatch({ ...newBatch, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field-soft" placeholder="Class level" value={newBatch.class_level} onChange={e => setNewBatch({ ...newBatch, class_level: e.target.value })} />
                <input className="field-soft" placeholder="Subject" value={newBatch.subject} onChange={e => setNewBatch({ ...newBatch, subject: e.target.value })} />
              </div>
              {departments.length > 0 && (
                <>
                  <select className="field-soft cursor-pointer" value={newBatch.department_id} onChange={e => setNewBatch({ ...newBatch, department_id: e.target.value, section_id: "" })}>
                    <option value="">Department (optional)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {availSectionsForBatch.length > 0 && (
                    <select className="field-soft cursor-pointer" value={newBatch.section_id} onChange={e => setNewBatch({ ...newBatch, section_id: e.target.value })}>
                      <option value="">Section (optional)</option>
                      {availSectionsForBatch.map(s => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Y${s.year}` : ""}</option>)}
                    </select>
                  )}
                </>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setShowAddBatch(false)}>Cancel</button>
                <button className="btn-orange px-6 py-2.5 rounded-xl text-sm" onClick={handleAddBatch} disabled={!newBatch.name.trim()}>Create Batch</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddStudent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={() => setShowAddStudent(false)}>
          <div className="glass-overlay rounded-[32px] p-8 max-w-sm w-full relative anim-pop max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Add Student</h3>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">Enroll a new student to your institute</p>
              </div>
              <button onClick={() => setShowAddStudent(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
            </div>
            <div className="space-y-3">
              <input className="field-soft" placeholder="Student name *" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field-soft" placeholder="Roll no." value={newStudent.roll_no} onChange={e => setNewStudent({ ...newStudent, roll_no: e.target.value })} />
                <input className="field-soft" placeholder="Class" value={newStudent.class_level} onChange={e => setNewStudent({ ...newStudent, class_level: e.target.value })} />
              </div>
              <input className="field-soft" placeholder="Parent name" value={newStudent.parent_name} onChange={e => setNewStudent({ ...newStudent, parent_name: e.target.value })} />
              <input className="field-soft" placeholder="Parent phone" value={newStudent.parent_phone} onChange={e => setNewStudent({ ...newStudent, parent_phone: e.target.value })} />
              {departments.length > 0 && (
                <>
                  <select className="field-soft cursor-pointer" value={newStudent.department_id} onChange={e => setNewStudent({ ...newStudent, department_id: e.target.value, section_id: "" })}>
                    <option value="">Department (optional)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {availSectionsForStudent.length > 0 && (
                    <select className="field-soft cursor-pointer" value={newStudent.section_id} onChange={e => setNewStudent({ ...newStudent, section_id: e.target.value })}>
                      <option value="">Section (optional)</option>
                      {availSectionsForStudent.map(s => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Y${s.year}` : ""}</option>)}
                    </select>
                  )}
                </>
              )}
              <select className="field-soft cursor-pointer" value={newStudent.batch_id} onChange={e => setNewStudent({ ...newStudent, batch_id: e.target.value })}>
                <option value="">Select batch (optional)</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div className="flex justify-end gap-3 pt-4">
                <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setShowAddStudent(false)}>Cancel</button>
                <button className="btn-orange px-6 py-2.5 rounded-xl text-sm" onClick={handleAddStudent} disabled={!newStudent.name.trim()}>Add Student</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddDept && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={() => setShowAddDept(false)}>
          <div className="glass-overlay rounded-[32px] p-8 max-w-sm w-full relative anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">New Department</h3>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">e.g. JEE, NEET, Class 10, Physics</p>
              </div>
              <button onClick={() => setShowAddDept(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
            </div>
            <div className="space-y-3">
              <input className="field-soft" placeholder="Department name *" value={newDept.name} onChange={e => setNewDept({ name: e.target.value })} autoFocus onKeyDown={e => e.key === "Enter" && handleAddDept()} />
              <p className="text-[11px] text-slate-400 font-medium px-1">Two join codes will be auto-generated (one for students, one for teachers) so members can join this department directly.</p>
              <div className="flex justify-end gap-3 pt-4">
                <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setShowAddDept(false)}>Cancel</button>
                <button className="btn-orange px-6 py-2.5 rounded-xl text-sm" onClick={handleAddDept} disabled={!newDept.name.trim()}>Create Department</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddSection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={() => setShowAddSection(false)}>
          <div className="glass-overlay rounded-[32px] p-8 max-w-sm w-full relative anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">New Section</h3>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">e.g. Section A, Batch-1, Year 2</p>
              </div>
              <button onClick={() => setShowAddSection(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
            </div>
            <div className="space-y-3">
              <select className="field-soft cursor-pointer" value={newSection.department_id} onChange={e => setNewSection({ ...newSection, department_id: e.target.value })}>
                <option value="">Select department *</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input className="field-soft" placeholder="Section name *" value={newSection.name} onChange={e => setNewSection({ ...newSection, name: e.target.value })} />
              <input className="field-soft" placeholder="Year (optional, e.g. 2)" type="number" min={1} max={6} value={newSection.year} onChange={e => setNewSection({ ...newSection, year: e.target.value })} />
              <div className="flex justify-end gap-3 pt-4">
                <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setShowAddSection(false)}>Cancel</button>
                <button className="btn-orange px-6 py-2.5 rounded-xl text-sm" onClick={handleAddSection} disabled={!newSection.name.trim() || !newSection.department_id}>Create Section</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {HOD_ENABLED && assignHodDept && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={() => setAssignHodDept(null)}>
          <div className="glass-overlay rounded-[32px] p-8 max-w-md w-full relative anim-pop max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Assign HOD</h3>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">For {assignHodDept.name} · pick a teacher to promote</p>
              </div>
              <button onClick={() => setAssignHodDept(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
            </div>
            <div className="space-y-2">
              {teachers.filter(t => t.role === "teacher").length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3"><Icons.Users /></div>
                  <p className="text-[13px] font-bold text-slate-700 mb-1">No teachers available</p>
                  <p className="text-[12px] text-slate-500 font-medium">Teachers first need to join with the institute code. Then you can promote one to HOD.</p>
                </div>
              ) : (
                teachers.filter(t => t.role === "teacher").map(t => (
                  <button key={t.id} onClick={() => promoteToHod(t.id, assignHodDept.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-[#FF7043]/40 hover:bg-[#FFF5F2] transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0"><Icons.User /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{teacherDisplayName(t)}</p>
                      <p className="text-[11px] font-medium text-slate-400">{t.department_id ? `Currently in ${deptName(t.department_id)}` : "No department"}</p>
                    </div>
                    <span className="text-[11px] font-bold text-[#FF7043] flex items-center gap-1"><Icons.Crown /> Promote</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {PROCTOR_UI_ENABLED && assignProctorFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignProctorFor(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Class teacher (proctor)</h3>
              <button onClick={() => setAssignProctorFor(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
            </div>
            <p className="text-sm text-slate-500 mb-1">Teacher: <strong>{assignProctorFor.teacherName}</strong></p>
            <p className="text-xs text-slate-400 mb-4">
              The class teacher of a section sees every subject teacher of that class, their daily attendance and the
              monthly record — and may correct marks up to 7 days back. One class teacher per section.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...sections]
                .sort((a, b) => {
                  // The teacher's own department first — that's almost always the one being assigned.
                  const d = assignProctorFor.deptId;
                  const rank = (s: Section) => (d && s.department_id === d ? 0 : 1);
                  return rank(a) - rank(b) || a.name.localeCompare(b.name);
                })
                .map(s => {
                  const holder = proctorOfSection[s.id];
                  const isMine = holder === assignProctorFor.memberId;
                  const holderMember = holder ? teachers.find(x => x.id === holder) : null;
                  // A proctor owns a section, so the section is what identifies the class — show the
                  // batches inside it, otherwise "ECE-2" vs "ECE 1" is guesswork.
                  const secBatches = batches.filter(b => b.section_id === s.id);
                  return (
                    <div key={s.id}
                      className={"flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors " + (isMine ? "bg-teal-50 border-teal-200" : "bg-white border-slate-100 hover:border-slate-200")}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {s.department_id ? deptName(s.department_id) : "No department"}
                          {secBatches.length > 0 ? ` · ${secBatches.map(b => b.name).join(", ")}` : " · no batches linked"}
                          {holder && !isMine && ` · now: ${holderMember ? teacherDisplayName(holderMember) : "another teacher"}`}
                        </p>
                      </div>
                      {isMine ? (
                        <button
                          disabled={proctorBusy}
                          onClick={() => removeProctor(s)}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 shrink-0"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          disabled={proctorBusy || !s.department_id}
                          onClick={() => assignProctor(assignProctorFor.memberId, assignProctorFor.userId, s)}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 shrink-0"
                          title={!s.department_id ? "This section has no department" : undefined}
                        >
                          {holder ? "Replace" : "Make class teacher"}
                        </button>
                      )}
                    </div>
                  );
                })}
              {sections.length === 0 && <p className="text-center text-slate-400 py-4">No sections yet — create one in the Departments tab.</p>}
            </div>
          </div>
        </div>
      )}

      {assignStudentIds && (
        <LazySection label="Assign batches" fallback={
          <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-lg"><SectionSkeleton label="batches" rows={5} /></div>
          </div>
        }>
          <StudentBatchAssignModal
            students={students.filter(s => assignStudentIds.includes(s.id))}
            batches={batches}
            departments={departments}
            memberships={memberships}
            onSaved={() => { setSelectedStudentIds(new Set()); invalidate("assignBatches"); }}
            onClose={() => setAssignStudentIds(null)}
          />
        </LazySection>
      )}

      {editStudentId && (() => {
        const st = students.find(x => x.id === editStudentId);
        if (!st) return null;
        return (
          <LazySection label="Edit student" fallback={
            <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4">
              <div className="w-full max-w-lg"><SectionSkeleton label="student" rows={5} /></div>
            </div>
          }>
            <StudentEditModal
              student={st}
              batches={batches}
              departments={departments}
              sections={sections}
              memberships={memberships}
              onSaved={() => invalidate("editStudent")}
              onClose={() => setEditStudentId(null)}
            />
          </LazySection>
        );
      })()}

      {batchMembersId && (() => {
        const b = batchById.get(batchMembersId);
        if (!b) return null;
        return (
          <LazySection label="Batch students" fallback={
            <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4">
              <div className="w-full max-w-lg"><SectionSkeleton label="students" rows={5} /></div>
            </div>
          }>
            <BatchStudentsModal
              batch={b}
              students={students}
              memberships={memberships}
              batchById={batchById}
              departments={departments}
              sections={sections}
              onSaved={() => invalidate("batchMembers")}
              onClose={() => setBatchMembersId(null)}
            />
          </LazySection>
        );
      })()}

      {showBulkUpload && (
        <LazySection label="Bulk upload" fallback={
          <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-lg"><SectionSkeleton label="bulk upload" rows={5} /></div>
          </div>
        }>
        <BulkStudentUpload
          instituteId={institute.id}
          batches={batches}
          departments={departments}
          sections={sections}
          onUploadComplete={() => invalidate("bulkUpload")}
          onClose={() => setShowBulkUpload(false)}
        />
        </LazySection>
      )}
    </div>
  );
}