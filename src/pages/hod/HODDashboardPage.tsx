// src/pages/hod/HODDashboardPage.tsx
// a4ai — Head of Department dashboard (/hod). Same shell + classes as InstituteDashboardPage (dashboardTheme.tsx).
//
// Scope: ONE department at a time, taken from get_my_access() (useAccess):
//   HOD   → access.hod_department_ids (picker only if they head more than one)
//   admin → any department of their institute (preview; picker in the sidebar)
// There is no "All departments" view here. RLS (02_rls_policies.sql) already scopes rows; every query
// below still filters by the department explicitly.
//
// ID conventions (CLAUDE.md):
//   teaching_assignments.teacher_id / timetable_slots.teacher_id / batches.proctor_id = auth user_id
//   proctor_assignments.teacher_id = institute_members.id, UNIQUE(section_id)
//   teacher_batches is LEGACY — never written here.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { customStyles, Icons } from "@/pages/institute/dashboardTheme";
import HODAttendanceDashboard from "@/components/attendance/HODAttendanceDashboard";
import ProctorSectionView from "@/components/attendance/ProctorSectionView";

// ============================================================
// TYPES
// ============================================================
interface Dept { id: string; name: string; student_code: string | null; teacher_code: string | null; }
interface Section { id: string; department_id: string; name: string; year: number | null; }
interface Batch { id: string; name: string; section_id: string | null; department_id: string | null; }
interface Subject { id: string; name: string; code: string | null; department_id: string | null; }
interface Member {
  id: string; user_id: string; role?: string; department_id?: string | null;
  user_name: string | null; user_email: string | null;
}
interface TA { teacher_id: string; batch_id: string; subject_id: string; }
interface Proctor { teacher_id: string; section_id: string; }
interface Stu { id: string; name: string; roll_no: string | null; section_id: string | null; batch_id: string | null; department_id: string | null; }
interface TSlot {
  id: string; batch_id: string; subject_id: string; teacher_id: string;
  day_of_week: number; start_time: string; end_time: string; room: string | null;
}
interface DaySummary { total: number; marked: number; present: number; absent: number; leave: number; }
interface MonthSummary { students: number; avg: number; low: number; subjects: number; }

type Tab = "overview" | "sections" | "teachers" | "students" | "attendance" | "timetable";

// ============================================================
// HELPERS
// ============================================================
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NONE = ["00000000-0000-0000-0000-000000000000"];
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pctColor = (p: number) => (p >= 75 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-red-600");
const nameOf = (m?: Member | null) => m?.user_name || m?.user_email?.split("@")[0] || "Unnamed";
const getInitials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Main batch of a section = the batch named exactly like the section ("ECE-2"); labs are "ECE-2 A/B/C". */
const isMainBatch = (b: Batch, s: Section) => sameName(b.name, s.name);
/** Strip characters that would break a PostgREST or() filter. */
const cleanQuery = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();

function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  } catch { /* fallthrough */ }
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
  return Promise.resolve();
}

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md anim-in" onClick={onClose}>
    <div className="glass-overlay rounded-[32px] p-8 max-w-md w-full relative anim-pop max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          {subtitle && <p className="text-[12px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><Icons.X /></button>
      </div>
      {children}
    </div>
  </div>
);

const EmptyCard: React.FC<{ icon: React.ReactNode; text: string; tint?: string }> = ({ icon, text, tint = "bg-blue-50 text-blue-500" }) => (
  <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
    <div className={`w-12 h-12 rounded-full ${tint} flex items-center justify-center mx-auto mb-3`}>{icon}</div>
    <p className="text-sm text-slate-500 font-medium">{text}</p>
  </div>
);

const Avatar: React.FC<{ name: string; hod?: boolean }> = ({ name, hod }) => (
  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] ${hod ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-500"}`}>
    {getInitials(name)}
  </div>
);

/**
 * Teacher picker. Lists this department's teachers first; typing ≥ 3 letters also searches the rest of the
 * institute (a maths teacher from Applied Sciences can teach ECE-2).
 */
const TeacherPicker: React.FC<{
  members: Member[]; deptId: string; instId: string; onPick: (m: Member) => void; busy?: boolean;
}> = ({ members, deptId, instId, onPick, busy }) => {
  const [q, setQ] = useState("");
  const [others, setOthers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);

  const local = members
    .filter(m => !m.role || ["teacher", "hod"].includes(m.role))
    .filter(m => (nameOf(m) + " " + (m.user_email || "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.department_id === deptId) - Number(a.department_id === deptId) || nameOf(a).localeCompare(nameOf(b)));

  useEffect(() => {
    const term = cleanQuery(q);
    if (term.length < 3) { setOthers([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      // TODO 02b: replace with scoped RPC once institute_members RLS lands.
      const { data, error } = await supabase
        .from("institute_members")
        .select("id, user_id, user_name, user_email") // ids are needed to assign; nothing else is read
        .eq("institute_id", instId)
        .eq("status", "active")
        .in("role", ["teacher", "hod"])
        .or(`user_name.ilike.%${term}%,user_email.ilike.%${term}%`)
        .limit(10);
      if (cancelled) return;
      if (error) console.warn("teacher search:", error.message);
      const known = new Set(members.map(m => m.user_id));
      setOthers(((data || []) as Member[]).filter(m => m.user_id && !known.has(m.user_id)));
      setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, instId, members]);

  const row = (m: Member, badge?: string) => (
    <button key={m.id} disabled={busy} onClick={() => onPick(m)}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#FFF5F2] text-left disabled:opacity-50 transition-colors">
      <Avatar name={nameOf(m)} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-slate-800 truncate">{nameOf(m)}</div>
        <div className="text-[11px] text-slate-400 truncate">{m.user_email}</div>
      </div>
      {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{badge}</span>}
    </button>
  );

  return (
    <>
      <input className="field mb-3" placeholder="Search teacher by name or email…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="max-h-72 overflow-y-auto space-y-1">
        {local.map(m => row(m, m.department_id === deptId ? "This dept" : undefined))}
        {others.length > 0 && <p className="text-[11px] font-bold text-slate-400 uppercase px-2 pt-3">Other departments</p>}
        {others.map(m => row(m, "Other dept"))}
        {searching && <p className="text-[12px] text-slate-400 text-center py-2">Searching…</p>}
        {local.length === 0 && others.length === 0 && !searching && (
          <p className="text-sm text-slate-500 text-center py-6">
            {cleanQuery(q).length < 3 ? "No teachers in this department yet. Type 3+ letters to search the institute." : "No teacher found."}
          </p>
        )}
      </div>
    </>
  );
};

// ============================================================
// MAIN
// ============================================================
export default function HODDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { access, loading: accessLoading } = useAccess();

  const instId = access?.institute_id || null;
  const isAdmin = access?.primary_role === "admin";
  const hodDeptIds = useMemo(() => access?.hod_department_ids || [], [access]);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "HOD";

  // shell
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // which departments this user may open, and the current one
  const [instName, setInstName] = useState("");
  const [deptChoices, setDeptChoices] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // department data
  const [loading, setLoading] = useState(false);
  const [dept, setDept] = useState<Dept | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tas, setTas] = useState<TA[]>([]);
  const [proctors, setProctors] = useState<Proctor[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<Stu[]>([]);
  const [tSlots, setTSlots] = useState<TSlot[]>([]);

  // attendance summaries (get_proctor_section_day / _monthly). null = RPC unavailable for this user → hidden.
  const [today, setToday] = useState<Record<string, DaySummary> | null>(null);
  const [attView, setAttView] = useState<"today" | "month">("today");
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());
  const [monthly, setMonthly] = useState<Record<string, MonthSummary> | null>({});
  const [monLoading, setMonLoading] = useState(false);

  // sections tab / modals
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "section" | "proctor" | "subject" | "batch" | "timetable">(null);
  const [busy, setBusy] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", year: "", labs: true });
  const [newBatchName, setNewBatchName] = useState("");
  const [subjForm, setSubjForm] = useState<{ subjectId: string; newName: string; teacher: Member | null; batchIds: string[] }>({ subjectId: "", newName: "", teacher: null, batchIds: [] });
  const [ttSectionId, setTtSectionId] = useState<string | null>(null);
  const [ttForm, setTtForm] = useState({ batchId: "", subjectId: "", teacherId: "", day: 1, startTime: "09:00", endTime: "10:00", room: "" });

  // students tab
  const [stuSearch, setStuSearch] = useState("");
  const [stuSection, setStuSection] = useState("");
  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // ---------------- BOOT: departments this user may open ----------------
  useEffect(() => {
    if (accessLoading) return;
    (async () => {
      setBootLoading(true);
      setBootError(null);
      try {
        if (!instId || (!isAdmin && hodDeptIds.length === 0)) {
          setBootError("You are not assigned as HOD of any department yet. Ask your administrator to assign you.");
          return;
        }
        let q = supabase.from("departments").select("id, name, student_code, teacher_code").eq("institute_id", instId).order("name");
        if (!isAdmin) q = q.in("id", hodDeptIds);
        const [{ data: depts, error }, { data: inst }] = await Promise.all([
          q,
          supabase.from("institutes").select("name").eq("id", instId).maybeSingle(),
        ]);
        if (error) throw error;
        setInstName(inst?.name || access?.institute_name || "Institute");
        setDeptChoices(depts || []);
        if (!depts?.length) {
          setBootError(isAdmin ? "No departments exist yet. Create one from the Institute dashboard." : "Your department could not be loaded.");
          return;
        }
        setDeptId(prev => (prev && depts.some(d => d.id === prev) ? prev : depts[0].id));
      } catch (e: any) {
        console.error(e);
        setBootError(e.message || "Failed to load");
      } finally {
        setBootLoading(false);
      }
    })();
  }, [accessLoading, instId, isAdmin, hodDeptIds, access?.institute_name]);

  // ---------------- LOAD DEPARTMENT ----------------
  const loadDept = useCallback(async () => {
    if (!instId || !deptId) return;
    setLoading(true);
    try {
      const [d, secs, subj] = await Promise.all([
        supabase.from("departments").select("id, name, student_code, teacher_code").eq("id", deptId).single(),
        supabase.from("sections").select("id, department_id, name, year").eq("department_id", deptId).order("name"),
        supabase.from("subjects").select("id, name, code, department_id").eq("institute_id", instId)
          .or(`department_id.eq.${deptId},department_id.is.null`).order("name"),
      ]);
      const secList: Section[] = secs.data || [];
      const secIds = secList.map(s => s.id);

      const { data: bat } = await supabase.from("batches").select("id, name, section_id, department_id")
        .eq("institute_id", instId)
        .or(`department_id.eq.${deptId}` + (secIds.length ? `,section_id.in.(${secIds.join(",")})` : ""))
        .eq("is_active", true).order("name");
      const batList: Batch[] = bat || [];
      const batIds = batList.map(b => b.id);

      const stuOr = [`department_id.eq.${deptId}`];
      if (secIds.length) stuOr.push(`section_id.in.(${secIds.join(",")})`);
      if (batIds.length) stuOr.push(`batch_id.in.(${batIds.join(",")})`);

      const [ta, pa, ts, stus] = await Promise.all([
        supabase.from("teaching_assignments").select("teacher_id, batch_id, subject_id")
          .in("batch_id", batIds.length ? batIds : NONE).eq("is_active", true),
        supabase.from("proctor_assignments").select("teacher_id, section_id")
          .eq("department_id", deptId).eq("is_active", true),
        supabase.from("timetable_slots").select("id, batch_id, subject_id, teacher_id, day_of_week, start_time, end_time, room")
          .in("batch_id", batIds.length ? batIds : NONE).eq("is_active", true).order("day_of_week").order("start_time"),
        supabase.from("students").select("id, name, roll_no, section_id, batch_id, department_id")
          .eq("institute_id", instId).eq("is_active", true).or(stuOr.join(",")).order("roll_no"),
      ]);

      // Teachers = this dept's members + anyone who teaches / is proctor here. Not the whole institute.
      const taList: TA[] = ta.data || [];
      const slotList: TSlot[] = ts.data || [];
      const paList: Proctor[] = pa.data || [];
      const userIds = [...new Set([...taList.map(t => t.teacher_id), ...slotList.map(s => s.teacher_id)])];
      const memberIds = [...new Set(paList.map(p => p.teacher_id))];
      const memOr = [`department_id.eq.${deptId}`];
      if (userIds.length) memOr.push(`user_id.in.(${userIds.join(",")})`);
      if (memberIds.length) memOr.push(`id.in.(${memberIds.join(",")})`);
      const { data: mems } = await supabase.from("institute_members")
        .select("id, user_id, role, department_id, user_name, user_email")
        .eq("institute_id", instId).eq("status", "active").or(memOr.join(","));
      let memList: Member[] = mems || [];
      if (memList.some(m => !m.user_name || !m.user_email)) {
        // Fill missing names/emails from auth.users (existing RPC) — fixes "Unnamed"
        const { data: dir, error: dirErr } = await supabase.rpc("get_member_directory", { p_institute_id: instId });
        if (dirErr) console.warn("get_member_directory:", dirErr.message);
        const byId = Object.fromEntries((dir || []).map((r: any) => [r.user_id, r]));
        memList = memList.map(m => byId[m.user_id]
          ? { ...m, user_name: m.user_name || byId[m.user_id].full_name, user_email: m.user_email || byId[m.user_id].email }
          : m);
      }

      setDept(d.data || null);
      setSections(secList);
      setBatches(batList);
      setSubjects(subj.data || []);
      setTas(taList);
      setProctors(paList);
      setTSlots(slotList);
      setStudents(stus.data || []);
      setMembers(memList);
      if (stus.error) console.warn("students:", stus.error.message);
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn't load department");
    } finally {
      setLoading(false);
    }
  }, [instId, deptId]);

  useEffect(() => { loadDept(); setOpenSectionId(null); setTtSectionId(null); }, [loadDept]);

  // ---------------- DERIVED ----------------
  const memberByAnyId = useCallback((tid: string) => members.find(m => m.user_id === tid || m.id === tid) || null, [members]);
  const batchById = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b])), [batches]);
  const sectionById = useMemo(() => Object.fromEntries(sections.map(s => [s.id, s])), [sections]);
  const subjectById = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const sectionOfStudent = useCallback(
    (s: Stu) => s.section_id || (s.batch_id ? batchById[s.batch_id]?.section_id : null) || null,
    [batchById]);

  const perSection = useMemo(() => {
    const out: Record<string, { students: number; batches: Batch[]; main: Batch | null; proctor: Member | null; subjects: number; teachers: number }> = {};
    sections.forEach(s => {
      const secBatches = batches.filter(b => b.section_id === s.id)
        .sort((a, b) => Number(isMainBatch(b, s)) - Number(isMainBatch(a, s)) || a.name.localeCompare(b.name));
      const bIds = new Set(secBatches.map(b => b.id));
      const secTas = tas.filter(t => bIds.has(t.batch_id));
      const p = proctors.find(p => p.section_id === s.id);
      out[s.id] = {
        students: students.filter(st => sectionOfStudent(st) === s.id).length,
        batches: secBatches,
        main: secBatches.find(b => isMainBatch(b, s)) || secBatches[0] || null,
        proctor: p ? memberByAnyId(p.teacher_id) : null,
        subjects: new Set(secTas.map(t => t.subject_id)).size,
        teachers: new Set(secTas.map(t => t.teacher_id)).size,
      };
    });
    return out;
  }, [sections, batches, tas, proctors, students, memberByAnyId, sectionOfStudent]);

  /** Teachers tab rows: role badges derived from proctor_assignments + teaching_assignments. */
  const teacherRows = useMemo(() => {
    return members
      .filter(m => !m.role || ["teacher", "hod"].includes(m.role))
      .map(m => {
        const proctorOf = proctors.filter(p => p.teacher_id === m.id).map(p => sectionById[p.section_id]?.name).filter(Boolean) as string[];
        const teaches = new Map<string, Set<string>>();
        tas.filter(t => t.teacher_id === m.user_id).forEach(t => {
          const subj = subjectById[t.subject_id]?.name || "Subject";
          const b = batchById[t.batch_id];
          const sec = b?.section_id ? sectionById[b.section_id]?.name : b?.name;
          if (!teaches.has(subj)) teaches.set(subj, new Set());
          if (sec) teaches.get(subj)!.add(sec);
        });
        const slotCount = tSlots.filter(s => s.teacher_id === m.user_id).length;
        return { m, isHod: m.role === "hod" && m.department_id === deptId, otherDept: m.department_id !== deptId, proctorOf, teaches, slotCount };
      })
      .sort((a, b) => Number(b.isHod) - Number(a.isHod) || nameOf(a.m).localeCompare(nameOf(b.m)));
  }, [members, proctors, tas, tSlots, sectionById, subjectById, batchById, deptId]);

  const proctorCount = sections.filter(s => perSection[s.id]?.proctor).length;
  const openSection = openSectionId ? sectionById[openSectionId] || null : null;
  const ttSection = sectionById[ttSectionId || ""] || sections[0] || null;

  /** Subject-teacher rows for the open section, grouped by subject+teacher */
  const sectionTeaching = useMemo(() => {
    if (!openSection) return [];
    const bIds = new Set((perSection[openSection.id]?.batches || []).map(b => b.id));
    const map = new Map<string, { subject?: Subject; teacher: Member | null; teacherId: string; subjectId: string; batchIds: string[] }>();
    tas.filter(t => bIds.has(t.batch_id)).forEach(t => {
      const key = t.subject_id + "|" + t.teacher_id;
      if (!map.has(key)) map.set(key, { subject: subjectById[t.subject_id], teacher: memberByAnyId(t.teacher_id), teacherId: t.teacher_id, subjectId: t.subject_id, batchIds: [] });
      map.get(key)!.batchIds.push(t.batch_id);
    });
    return [...map.values()].sort((a, b) => (a.subject?.name || "").localeCompare(b.subject?.name || ""));
  }, [openSection, perSection, tas, subjectById, memberByAnyId]);

  const ttSlots = useMemo(() => {
    if (!ttSection) return [];
    const bIds = new Set((perSection[ttSection.id]?.batches || []).map(b => b.id));
    return tSlots.filter(s => bIds.has(s.batch_id)).sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  }, [ttSection, perSection, tSlots]);

  const filteredStudents = useMemo(() => {
    const q = stuSearch.trim().toLowerCase();
    return students.filter(s => {
      if (stuSection && sectionOfStudent(s) !== stuSection) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.roll_no || "").toLowerCase().includes(q);
    });
  }, [students, stuSearch, stuSection, sectionOfStudent]);

  // Stable props for HODAttendanceDashboard (its loaders depend on these arrays)
  const attTeachers = useMemo(() => members.map(m => ({ ...m, status: "active" })), [members]);
  const attDepartments = useMemo(() => (dept ? [dept] : []), [dept]);

  // ---------------- ATTENDANCE SUMMARIES ----------------
  // These RPCs' definitions are not in the repo; for an HOD who is not a proctor they may reject.
  // On any error: hide the widgets (state = null) and console.warn — see CLAUDE.md "Known".
  const loadToday = useCallback(async () => {
    if (sections.length === 0) { setToday({}); return; }
    const date = localDate();
    const results = await Promise.all(sections.map(async sec => {
      const { data, error } = await supabase.rpc("get_proctor_section_day", { p_section_id: sec.id, p_date: date });
      if (error) { console.warn(`get_proctor_section_day(${sec.name}) unavailable:`, error.message); return null; }
      const rows = (data || []).filter((r: any) => r.status !== "no_class");
      const sum: DaySummary = { total: rows.length, marked: 0, present: 0, absent: 0, leave: 0 };
      rows.forEach((r: any) => {
        if (r.status === "marked") sum.marked++;
        sum.present += Number(r.present_count) || 0;
        sum.absent += Number(r.absent_count) || 0;
        sum.leave += Number(r.leave_count) || 0;
      });
      return [sec.id, sum] as const;
    }));
    setToday(results.some(r => r === null) ? null : Object.fromEntries(results as (readonly [string, DaySummary])[]));
  }, [sections]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const loadMonthly = useCallback(async () => {
    if (sections.length === 0) { setMonthly({}); return; }
    setMonLoading(true);
    const results = await Promise.all(sections.map(async sec => {
      const { data, error } = await supabase.rpc("get_proctor_section_monthly", { p_section_id: sec.id, p_month: attMonth, p_year: attYear });
      if (error) { console.warn(`get_proctor_section_monthly(${sec.name}) unavailable:`, error.message); return null; }
      const byStudent = new Map<string, { held: number; present: number }>();
      const codes = new Set<string>();
      (data || []).forEach((r: any) => {
        codes.add(r.subject_code);
        const cur = byStudent.get(r.student_id) || { held: 0, present: 0 };
        cur.held += Number(r.total_held) || 0; cur.present += Number(r.total_present) || 0;
        byStudent.set(r.student_id, cur);
      });
      const rows = [...byStudent.values()].filter(r => r.held > 0);
      const held = rows.reduce((n, r) => n + r.held, 0);
      const present = rows.reduce((n, r) => n + r.present, 0);
      const sum: MonthSummary = {
        students: rows.length,
        avg: held ? Math.round((present / held) * 100) : 0,
        low: rows.filter(r => r.present / r.held < 0.75).length,
        subjects: codes.size,
      };
      return [sec.id, sum] as const;
    }));
    if (results.some(r => r === null)) { setMonthly(null); setAttView("today"); }
    else setMonthly(Object.fromEntries(results as (readonly [string, MonthSummary])[]));
    setMonLoading(false);
  }, [sections, attMonth, attYear]);

  useEffect(() => { if (activeTab === "attendance" && attView === "month") loadMonthly(); }, [activeTab, attView, loadMonthly]);

  // ---------------- ACTIONS ----------------
  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/login"); };
  const goHome = () => navigate("/");

  const copyCode = async (code: string | null | undefined, key: string) => {
    if (!code) return;
    await copyText(code);
    setCodeCopied(key); toast.success("Code copied");
    setTimeout(() => setCodeCopied(null), 1500);
  };

  const createSection = async () => {
    const name = newSection.name.trim();
    if (!name || !deptId || !instId) return;
    setBusy(true);
    try {
      const { data: sec, error } = await supabase.from("sections")
        .insert({ department_id: deptId, name, year: newSection.year ? parseInt(newSection.year) : null })
        .select("id").single();
      if (error) throw error;
      // Main batch (normal attendance) + optional lab batches A/B/C. institute_id, department_id, section_id always set.
      const names = [name, ...(newSection.labs ? ["A", "B", "C"].map(l => `${name} ${l}`) : [])];
      const { error: bErr } = await supabase.from("batches").insert(
        names.map(n => ({ institute_id: instId, department_id: deptId, section_id: sec.id, name: n, is_active: true })));
      if (bErr) toast.error(`Section created, but batches failed: ${bErr.message}`);
      else toast.success(`Section ${name} created${newSection.labs ? " with lab batches A/B/C" : ""}`);
      setNewSection({ name: "", year: "", labs: true }); setModal(null);
      loadDept();
    } catch (e: any) {
      toast.error(e.message || "Failed to create section");
    } finally { setBusy(false); }
  };

  /** Only an EMPTY section can be deleted: deleting its batches cascades to class_sessions / assignments. */
  const deleteSection = async (s: Section) => {
    const secBatchIds = (perSection[s.id]?.batches || []).map(b => b.id);
    const orStu = [`section_id.eq.${s.id}`];
    if (secBatchIds.length) orStu.push(`batch_id.in.(${secBatchIds.join(",")})`);
    const [{ count: stuCount, error: e1 }, { count: sessCount, error: e2 }] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).or(orStu.join(",")),
      supabase.from("class_sessions").select("id", { count: "exact", head: true }).in("batch_id", secBatchIds.length ? secBatchIds : NONE),
    ]);
    if (e1 || e2) return toast.error((e1 || e2)!.message);
    if ((stuCount || 0) > 0) return toast.error(`${s.name} still has ${stuCount} student(s). Move or remove them first.`);
    if ((sessCount || 0) > 0) return toast.error(`${s.name} has attendance history (${sessCount} classes) — it can't be deleted.`);
    if (!confirm(`Delete section ${s.name} and its ${secBatchIds.length} batch(es)?`)) return;

    if (secBatchIds.length) {
      const { error } = await supabase.from("batches").delete().in("id", secBatchIds);
      if (error) return toast.error(error.message);
    }
    const { error } = await supabase.from("sections").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Section deleted");
    if (openSectionId === s.id) setOpenSectionId(null);
    loadDept();
  };

  const assignProctor = async (m: Member) => {
    if (!openSectionId || !instId || !deptId) return;
    setBusy(true);
    const { error } = await supabase.rpc("assign_proctor", {
      p_institute_id: instId, p_department_id: deptId, p_section_id: openSectionId, p_teacher_id: m.id,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Mirror to batches.proctor_id so the proctor can correct attendance (attendance_records RLS uses it)
    await supabase.from("batches").update({ proctor_id: m.user_id }).eq("section_id", openSectionId);
    setBusy(false);
    toast.success(`${nameOf(m)} is now class teacher`);
    setModal(null); loadDept();
  };

  const openSubjectModal = () => {
    const main = openSection ? perSection[openSection.id]?.main : null;
    setSubjForm({ subjectId: "", newName: "", teacher: null, batchIds: main ? [main.id] : [] });
    setModal("subject");
  };

  const assignSubjectTeacher = async () => {
    const { subjectId, newName, teacher, batchIds } = subjForm;
    if (!openSection || !instId || !deptId || !teacher || (!subjectId && !newName.trim())) return;
    if (batchIds.length === 0) return toast.error("Pick at least one batch.");
    setBusy(true);
    try {
      let sid = subjectId;
      if (!sid) {
        const name = newName.trim();
        const existing = subjects.find(s => sameName(s.name, name));
        if (existing) sid = existing.id;
        else {
          const code = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() + "101";
          const { data, error } = await supabase.from("subjects")
            .insert({ institute_id: instId, name, code, department_id: deptId, is_active: true })
            .select("id").single();
          if (error) throw error;
          sid = data.id;
        }
      }
      for (const bId of batchIds) {
        const { error } = await supabase.from("teaching_assignments").insert({
          institute_id: instId, teacher_id: teacher.user_id, batch_id: bId, subject_id: sid,
        });
        if (error && error.code !== "23505") throw error;
      }
      toast.success(`${nameOf(teacher)} assigned`);
      setModal(null);
      loadDept();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign");
    } finally { setBusy(false); }
  };

  const removeSubjectTeacher = async (teacherId: string, subjectId: string, batchIds: string[]) => {
    if (!confirm("Remove this teacher from this subject in this section?")) return;
    const { error } = await supabase.from("teaching_assignments").delete()
      .eq("teacher_id", teacherId).eq("subject_id", subjectId).in("batch_id", batchIds);
    if (error) return toast.error(error.message);
    toast.success("Removed"); loadDept();
  };

  const createBatch = async () => {
    if (!openSection || !newBatchName.trim() || !instId || !deptId) return;
    setBusy(true);
    const { error } = await supabase.from("batches").insert({
      institute_id: instId, department_id: deptId, section_id: openSection.id, name: newBatchName.trim(), is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Batch added"); setNewBatchName(""); setModal(null); loadDept();
  };

  const openTimetableModal = () => {
    if (!ttSection) return;
    const main = perSection[ttSection.id]?.main;
    setTtForm({ batchId: main?.id || "", subjectId: "", teacherId: "", day: 1, startTime: "09:00", endTime: "10:00", room: "" });
    setModal("timetable");
  };

  const createTimetableSlot = async () => {
    if (!instId || !ttForm.batchId || !ttForm.subjectId || !ttForm.teacherId) return;
    if (ttForm.endTime <= ttForm.startTime) return toast.error("End time must be after start time");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_timetable_slot", {
        p_institute_id: instId,
        p_batch_id: ttForm.batchId,
        p_subject_id: ttForm.subjectId,
        p_teacher_id: ttForm.teacherId,
        p_day_of_week: ttForm.day,
        p_start_time: ttForm.startTime,
        p_end_time: ttForm.endTime,
        p_room: ttForm.room.trim() || null,
      });
      if (error) throw error;
      toast.success("Slot added");
      setModal(null);
      loadDept();
    } catch (e: any) {
      toast.error(e.message || "Failed to add slot");
    } finally { setBusy(false); }
  };

  const deleteTimetableSlot = async (slotId: string) => {
    if (!confirm("Remove this timetable slot?")) return;
    const { error } = await supabase.rpc("delete_timetable_slot", { p_slot_id: slotId });
    if (error) return toast.error(error.message);
    toast.success("Slot removed");
    loadDept();
  };

  // ============================================================
  // RENDER
  // ============================================================
  const rootClass = `dashboard-root ${isDarkMode ? "dark-mode" : ""}`;

  if (accessLoading || bootLoading) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <span className="text-[#FF7043]"><Icons.Loader /></span>
      </div>
    );
  }

  if (bootError || !deptId || !instId) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center px-4`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="glass-overlay rounded-3xl p-10 max-w-md w-full text-center anim-pop">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-6"><Icons.Building /></div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">HOD access not available</h2>
          <p className="text-sm text-slate-500 mb-8 font-medium">{bootError || "No department selected."}</p>
          <button className="btn-orange w-full py-3.5 rounded-xl" onClick={() => navigate(access?.home_route || "/dashboard")}>Go to my dashboard</button>
        </div>
      </div>
    );
  }

  const deptName = dept?.name || deptChoices.find(d => d.id === deptId)?.name || "Department";
  const todayTotals = today ? Object.values(today).reduce((a, s) => ({ total: a.total + s.total, marked: a.marked + s.marked }), { total: 0, marked: 0 }) : null;

  const navItems: { id: Tab; label: string; icon: React.ComponentType; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: Icons.Grid },
    { id: "sections", label: "Sections", icon: Icons.Layers, badge: sections.length },
    { id: "teachers", label: "Teachers", icon: Icons.Users, badge: teacherRows.length },
    { id: "students", label: "Students", icon: Icons.User, badge: students.length },
    { id: "attendance", label: "Attendance", icon: Icons.Chart },
    { id: "timetable", label: "Timetable", icon: Icons.Calendar },
  ];

  const statCards = [
    { label: "Sections", value: sections.length, pct: sections.length ? 1 : 0, note: `${batches.length} batches incl. labs`, tint: "bg-teal-100 text-teal-600", bar: "#14B8A6", Icon: Icons.Layers, tab: "sections" as Tab },
    { label: "Class teachers", value: `${proctorCount}/${sections.length}`, pct: sections.length ? proctorCount / sections.length : 0, note: proctorCount < sections.length ? `${sections.length - proctorCount} section(s) unassigned` : "all sections covered", tint: "bg-purple-100 text-purple-600", bar: "#8B5CF6", Icon: Icons.Crown, tab: "sections" as Tab },
    { label: "Teachers", value: teacherRows.length, pct: teacherRows.length ? 1 : 0, note: `${teacherRows.filter(r => r.otherDept).length} from other depts`, tint: "bg-blue-100 text-blue-600", bar: "#5C67F2", Icon: Icons.Users, tab: "teachers" as Tab },
    { label: "Students", value: students.length, pct: students.length ? 1 : 0, note: `across ${sections.length} section(s)`, tint: "bg-red-100 text-red-500", bar: "#FF5252", Icon: Icons.User, tab: "students" as Tab },
  ];

  const sectionTitle = (title: string, sub: string, action?: React.ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4 sm:mb-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{sub}</p>
      </div>
      {action}
    </div>
  );

  return (
    <div className={`${rootClass} h-screen w-full flex overflow-hidden text-slate-800`}>
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
              <p className="text-[11px] text-slate-500 font-medium">{isAdmin ? "Administrator · HOD preview" : "Head of Department"}</p>
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
              {isAdmin && (
                <button onClick={() => navigate("/institute")} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                  <Icons.Building /> Institute dashboard
                </button>
              )}
              <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Icons.LogOut /> Sign out
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3">
          <p className="text-[11px] font-bold text-slate-400 mb-2">{instName}</p>
          {deptChoices.length > 1 ? (
            // Admin (any dept) or an HOD of several depts. Never an "All" option.
            <select className="field !py-2.5 text-[13px] font-bold" value={deptId} onChange={e => { setDeptId(e.target.value); setActiveTab("overview"); }}>
              {deptChoices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <div className="w-full flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-xl">
              <span className="text-[13px] font-bold text-slate-700 truncate">{deptName}</span>
              <span className="text-slate-400 shrink-0"><Icons.Building /></span>
            </div>
          )}
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 px-2 mb-2 mt-2">Menu</p>
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
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
            <button onClick={() => setModal("section")} title="New section" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Layers /></button>
            <button onClick={() => { setActiveTab("timetable"); setMobileMenuOpen(false); }} title="Timetable" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Calendar /></button>
            <button onClick={() => copyCode(dept?.teacher_code, "tch")} title="Copy teacher join code" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Key /></button>
            <button onClick={() => loadDept()} title="Refresh" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Refresh /></button>
          </div>

          <div className="mx-2 p-5 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center">
            <button onClick={() => setModal("section")} className="w-10 h-10 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-lg shadow-orange-500/30 mb-3 hover:scale-105 transition-transform">
              <Icons.Plus />
            </button>
            <p className="text-[13px] font-bold text-slate-800">New Section</p>
            <p className="text-[11px] text-slate-500 mt-1">main batch + lab batches A/B/C</p>
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className={`px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mx-auto w-full ${activeTab === "attendance" ? "max-w-7xl" : "max-w-5xl"}`}>

          <div className="flex items-center gap-2 mb-4 lg:hidden">
            <button className="p-2 -ml-2 text-slate-500 touch-target" onClick={() => setMobileMenuOpen(true)}><Icons.Menu /></button>
            <button onClick={goHome} title="Back to home" className="p-2 rounded-lg bg-[#FFF5F2] text-[#FF7043]"><Icons.Home /></button>
            <span className="text-lg font-black text-slate-900 truncate">{deptName}</span>
          </div>

          {isAdmin && (
            <div className="mb-4 text-[12px] font-bold px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              Admin preview — you're seeing what the HOD of {deptName} sees. Switch department in the sidebar.
            </div>
          )}

          {loading && !dept && (
            <div className="py-20 flex justify-center text-[#FF7043]"><Icons.Loader /></div>
          )}

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && dept && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="bg-white rounded-3xl card-shadow border border-slate-50 overflow-hidden mb-6">
                <div className="relative h-32 sm:h-40 bg-gradient-to-br from-[#FF7043] via-[#FF8A65] to-[#FFAB91]" />
                <div className="px-4 sm:px-6 lg:px-8 pb-6 relative">
                  <div className="-mt-12 sm:-mt-14 mb-4">
                    <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-[#FFF5F2] to-[#FFECDF] flex items-center justify-center">
                        <span className="text-3xl font-black text-[#FF7043]">{deptName.slice(0, 3).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{deptName}</h2>
                      <p className="text-[13px] font-bold text-slate-400">{instName} · Department dashboard</p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.Layers /> {sections.length} section{sections.length !== 1 ? "s" : ""}</span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.Users /> {teacherRows.length} teacher{teacherRows.length !== 1 ? "s" : ""}</span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Icons.User /> {students.length} student{students.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {[["Teacher code", dept.teacher_code, "tch"], ["Student code", dept.student_code, "stu"]].map(([label, code, key]) => code ? (
                        <div key={key as string} className="flex flex-col items-start sm:items-end gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <Icons.Key />
                            <code className="join-code text-[13px] font-black text-slate-800">{code}</code>
                            <button onClick={() => copyCode(code as string, key as string)} className="p-1 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors">
                              {codeCopied === key ? <Icons.Check /> : <Icons.Copy />}
                            </button>
                          </div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {statCards.map((card, i) => (
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
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate">{card.note}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Today strip — hidden if get_proctor_section_day is not available to this user */}
              {today && todayTotals && sections.length > 0 && (
                <div className="w-full bg-white rounded-2xl card-shadow border border-slate-50 p-4 sm:p-6 mb-6 sm:mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Today's attendance</p>
                      <p className="text-[16px] font-bold text-slate-800 stat-number">
                        {todayTotals.marked}<span className="text-slate-400"> / {todayTotals.total} classes marked</span>
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("attendance")} className="btn-ghost px-4 py-2 rounded-lg text-[13px]"><Icons.Chart /> Details</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sections.map(s => {
                      const t = today[s.id];
                      const done = t && t.total > 0 && t.marked === t.total;
                      return (
                        <span key={s.id} className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${!t || t.total === 0 ? "bg-slate-100 text-slate-400" : done ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                          {s.name}: {!t || t.total === 0 ? "no classes" : `${t.marked}/${t.total}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {sections.some(s => !perSection[s.id]?.proctor) && (
                <div className="bg-white rounded-2xl card-shadow border border-slate-50 p-4 sm:p-6">
                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-3">Needs attention</p>
                  <div className="space-y-2">
                    {sections.filter(s => !perSection[s.id]?.proctor).map(s => (
                      <button key={s.id} onClick={() => { setActiveTab("sections"); setOpenSectionId(s.id); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 text-left hover:bg-amber-50 transition-colors">
                        <span className="text-[13px] font-bold text-amber-700">{s.name}</span>
                        <span className="text-[12px] text-amber-600">has no class teacher</span>
                        <span className="ml-auto text-amber-500"><Icons.ChevronRight /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SECTIONS ── */}
          {activeTab === "sections" && !openSection && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              {sectionTitle("Sections", `${deptName} · class teacher, subjects and lab batches per section`,
                <button onClick={() => setModal("section")} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> New section</button>)}
              {sections.length === 0 ? (
                <EmptyCard icon={<Icons.Layers />} tint="bg-teal-50 text-teal-600" text={`No sections yet. Create ${deptName}-1, ${deptName}-2 …`} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.map(s => {
                    const info = perSection[s.id];
                    return (
                      <div key={s.id} onClick={() => setOpenSectionId(s.id)} className="relative bg-white rounded-2xl p-5 card-shadow card-hover border border-slate-50 cursor-pointer overflow-hidden anim-row">
                        <div className="dept-accent" />
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-[16px] font-black text-slate-800">{s.name}</h3>
                            <p className="text-[11px] font-bold text-slate-400">{s.year ? `Year ${s.year} · ` : ""}{info?.batches.length || 0} batch{(info?.batches.length || 0) !== 1 ? "es" : ""}</p>
                          </div>
                          <button title={info?.students ? "Only empty sections can be deleted" : "Delete section"} disabled={!!info?.students}
                            onClick={e => { e.stopPropagation(); deleteSection(s); }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300 disabled:cursor-not-allowed">
                            <Icons.Trash />
                          </button>
                        </div>
                        <div className={`flex items-center gap-2 p-2.5 rounded-xl text-[13px] ${info?.proctor ? "bg-slate-50" : "border-2 border-dashed border-amber-200 bg-amber-50/60 text-amber-700"}`}>
                          {info?.proctor
                            ? (<><span className="text-purple-500"><Icons.Crown /></span><span className="truncate font-bold text-slate-700">{nameOf(info.proctor)}</span><span className="ml-auto text-[10px] font-bold text-slate-400">Class teacher</span></>)
                            : (<span className="font-bold">No class teacher</span>)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                          {([["Subjects", info?.subjects], ["Teachers", info?.teachers], ["Students", info?.students]] as const).map(([l, v]) => (
                            <div key={l}><div className="text-lg font-black text-slate-800 stat-number">{v || 0}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l}</div></div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "sections" && openSection && (
            <div className="anim-entrance space-y-6" style={{ animationDelay: "0.05s" }}>
              <nav className="flex items-center gap-1 text-[13px] font-bold">
                <button onClick={() => setOpenSectionId(null)} className="text-[#FF7043] hover:underline">Sections</button>
                <span className="text-slate-300"><Icons.ChevronRight /></span>
                <span className="text-slate-800">{openSection.name}</span>
              </nav>

              <div className="bg-white rounded-2xl p-5 card-shadow border border-slate-50">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">{openSection.name}</h2>
                    <p className="text-[12px] font-bold text-slate-400">{deptName}{openSection.year ? ` · Year ${openSection.year}` : ""} · {perSection[openSection.id]?.students || 0} students</p>
                  </div>
                  <button onClick={() => setModal("proctor")} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]">
                    <Icons.Crown /> {perSection[openSection.id]?.proctor ? "Change class teacher" : "Assign class teacher"}
                  </button>
                </div>
                {perSection[openSection.id]?.proctor && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                    <Avatar name={nameOf(perSection[openSection.id].proctor)} hod />
                    <div><div className="text-[13px] font-bold text-slate-800">{nameOf(perSection[openSection.id].proctor)}</div><div className="text-[11px] text-slate-400">Class teacher (proctor)</div></div>
                  </div>
                )}
              </div>

              {/* Subject teachers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black text-slate-800">Subjects & teachers</h3>
                  <button onClick={openSubjectModal} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> Assign</button>
                </div>
                {sectionTeaching.length === 0 ? (
                  <EmptyCard icon={<Icons.Users />} text="No subjects assigned in this section yet." />
                ) : (
                  <div className="space-y-3">
                    {sectionTeaching.map(r => (
                      <div key={r.subjectId + r.teacherId} className="bg-white rounded-2xl p-4 flex items-center gap-3 card-shadow border border-slate-50 anim-row">
                        <Avatar name={r.teacher ? nameOf(r.teacher) : "?"} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-bold text-slate-800 truncate">{r.subject?.name || "Unknown subject"}</div>
                          <div className="text-[12px] text-slate-400 truncate">
                            {r.teacher ? nameOf(r.teacher) : "Teacher left the institute"} · {r.batchIds.map(id => batchById[id]?.name).filter(Boolean).join(", ")}
                          </div>
                        </div>
                        <button onClick={() => removeSubjectTeacher(r.teacherId, r.subjectId, r.batchIds)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Batches */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black text-slate-800">Batches</h3>
                  <button onClick={() => {
                    const n = perSection[openSection.id]?.batches.filter(b => !isMainBatch(b, openSection)).length || 0;
                    setNewBatchName(`${openSection.name} ${String.fromCharCode(65 + n)}`); setModal("batch");
                  }} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> Add lab batch</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(perSection[openSection.id]?.batches || []).map(b => (
                    <div key={b.id} className="bg-white rounded-2xl p-4 card-shadow border border-slate-50">
                      <div className="text-[13px] font-black text-slate-800 truncate">{b.name}</div>
                      <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {isMainBatch(b, openSection) ? `Main · ${students.filter(s => s.batch_id === b.id).length} students` : "Lab batch"}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-2">Main batch = normal attendance. Lab batches A/B/C = lab attendance only. Assigning students to lab batches comes in Step 5.</p>
              </div>

              {/* Attendance (proctor dashboard, read-only for HOD) */}
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-3">Attendance</h3>
                <div style={{ ["--theme-start" as any]: "#FF7043", ["--theme-end" as any]: "#F4511E" }}>
                  <ProctorSectionView key={openSection.id} sectionId={openSection.id} readOnly embedded />
                </div>
              </div>
            </div>
          )}

          {/* ── TEACHERS ── */}
          {activeTab === "teachers" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              {sectionTitle("Teachers", `Teachers of ${deptName}, and teachers from other departments who teach here`,
                dept?.teacher_code ? (
                  <button onClick={() => copyCode(dept.teacher_code, "tch")} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]">
                    {codeCopied === "tch" ? <><Icons.Check /> Copied</> : <><Icons.Copy /> Copy teacher code</>}
                  </button>
                ) : undefined)}
              {teacherRows.length === 0 ? (
                <EmptyCard icon={<Icons.Users />} text="No teachers yet. Share the department teacher code, then assign them in Sections." />
              ) : (
                <div className="space-y-3">
                  {teacherRows.map(({ m, isHod, otherDept, proctorOf, teaches, slotCount }) => (
                    <div key={m.id} className="bg-white rounded-2xl p-4 flex flex-wrap items-center gap-3 card-shadow border border-slate-50 anim-row">
                      <Avatar name={nameOf(m)} hod={isHod} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[14px] font-bold text-slate-800 truncate">{nameOf(m)}</span>
                          {isHod && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">HOD</span>}
                          {proctorOf.map(s => <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-600">Class teacher · {s}</span>)}
                          {otherDept && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">Other dept</span>}
                        </div>
                        <div className="text-[12px] text-slate-400 truncate">{m.user_email}</div>
                        {teaches.size > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {[...teaches.entries()].map(([subj, secs]) => (
                              <span key={subj} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-600">{subj}{secs.size ? ` · ${[...secs].join(", ")}` : ""}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-slate-800 stat-number">{slotCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">slots / week</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STUDENTS ── */}
          {activeTab === "students" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              {sectionTitle("Students", `${filteredStudents.length} of ${students.length} students in ${deptName} · read-only (uploads are done by the admin)`)}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex items-center bg-white px-4 py-3 rounded-xl card-shadow border border-slate-100 flex-1">
                  <span className="text-slate-400 mr-2"><Icons.Search /></span>
                  <input type="text" placeholder="Search by name or roll no…" value={stuSearch} onChange={e => setStuSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-[14px] font-medium w-full text-slate-700 placeholder-slate-400" />
                  {stuSearch && <button onClick={() => setStuSearch("")} className="text-slate-400 hover:text-slate-600 p-1"><Icons.X /></button>}
                </div>
                <select className="field sm:!w-56" value={stuSection} onChange={e => setStuSection(e.target.value)}>
                  <option value="">All sections of {deptName}</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {filteredStudents.length === 0 ? (
                <EmptyCard icon={<Icons.User />} tint="bg-red-50 text-red-500" text={students.length === 0 ? "No students in this department yet." : "No students match."} />
              ) : (
                <div className="bg-white rounded-2xl card-shadow border border-slate-50 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase">
                        <th className="px-4 py-3">Roll no</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Section</th><th className="px-4 py-3">Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.slice(0, 300).map(s => {
                        const sec = sectionOfStudent(s);
                        return (
                          <tr key={s.id} className="border-b border-slate-50 text-[13px]">
                            <td className="px-4 py-2.5 font-bold text-slate-500 stat-number">{s.roll_no || "—"}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-800">{s.name}</td>
                            <td className="px-4 py-2.5 text-slate-500">{sec ? sectionById[sec]?.name || "—" : "—"}</td>
                            <td className="px-4 py-2.5 text-slate-500">{s.batch_id ? batchById[s.batch_id]?.name || "—" : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredStudents.length > 300 && <p className="text-[12px] text-slate-400 text-center py-3">Showing first 300 — use search to narrow down.</p>}
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE (read-only) ── */}
          {activeTab === "attendance" && (
            <div className="anim-entrance space-y-6" style={{ animationDelay: "0.05s" }}>
              {sectionTitle("Attendance", `${deptName} only · read-only`)}

              {/* Section cards — hidden if the proctor RPCs are not available to this user */}
              {((attView === "today" && today) || (attView === "month" && monthly !== null)) && sections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
                      {(monthly !== null ? (["today", "month"] as const) : (["today"] as const)).map(v => (
                        <button key={v} onClick={() => setAttView(v)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${attView === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                          {v === "today" ? "Today" : "Monthly"}
                        </button>
                      ))}
                    </div>
                    {attView === "month" && (
                      <>
                        <select className="field !py-1.5 !w-auto text-[12px]" value={attMonth} onChange={e => setAttMonth(Number(e.target.value))}>
                          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <select className="field !py-1.5 !w-auto text-[12px]" value={attYear} onChange={e => setAttYear(Number(e.target.value))}>
                          {[attYear - 1, attYear, attYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  {attView === "month" && monLoading ? (
                    <div className="py-10 flex justify-center text-[#FF7043]"><Icons.Loader /></div>
                  ) : (
                    <div className="attendance-grid">
                      {sections.map(s => {
                        if (attView === "today") {
                          const t = today?.[s.id];
                          const counted = t ? t.present + t.absent + t.leave : 0;
                          const pct = counted ? Math.round((t!.present / counted) * 100) : 0;
                          return (
                            <div key={s.id} className={`bg-white rounded-2xl p-4 card-shadow border border-slate-50 ${!t || t.total === 0 ? "opacity-60" : ""}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[14px] font-black text-slate-800">{s.name}</span>
                                {t && t.total > 0 && (
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${t.marked === t.total ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{t.marked}/{t.total} done</span>
                                )}
                              </div>
                              {!t || t.total === 0 ? <p className="text-[12px] text-slate-400">No classes today</p> : (
                                <>
                                  {t.marked > 0 && (
                                    <div className="flex items-center gap-3 text-[12px] font-bold mb-2">
                                      <span className="text-emerald-600">{t.present}P</span><span className="text-red-500">{t.absent}A</span>
                                      {t.leave > 0 && <span className="text-blue-500">{t.leave}L</span>}
                                      <span className="ml-auto text-slate-700">{pct}%</span>
                                    </div>
                                  )}
                                  <div className="progress-bar-bg"><div className="progress-fill" style={{ width: `${(t.marked / t.total) * 100}%`, background: "#00C853" }} /></div>
                                </>
                              )}
                            </div>
                          );
                        }
                        const m = monthly?.[s.id];
                        return (
                          <div key={s.id} className={`bg-white rounded-2xl p-4 card-shadow border border-slate-50 ${!m?.students ? "opacity-60" : ""}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[14px] font-black text-slate-800">{s.name}</span>
                              {m?.students ? <span className={`text-lg font-black ${pctColor(m.avg)}`}>{m.avg}%</span> : null}
                            </div>
                            {!m?.students ? <p className="text-[12px] text-slate-400">No attendance this month</p> : (
                              <div className="flex items-center gap-3 text-[12px] text-slate-400 font-bold">
                                <span>{m.students} students</span><span>{m.subjects} subjects</span>
                                <span className={`ml-auto ${m.low ? "text-red-600" : "text-emerald-600"}`}>{m.low ? `${m.low} below 75%` : "All ≥ 75%"}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Teacher marking status — locked to this department (no "All Departments") */}
              {!loading && (
                <HODAttendanceDashboard
                  key={deptId}
                  instituteId={instId}
                  isHod
                  hodDeptId={deptId}
                  lockDeptId={deptId}
                  teachers={attTeachers}
                  batches={batches}
                  departments={attDepartments}
                  subjects={subjects}
                />
              )}
            </div>
          )}

          {/* ── TIMETABLE ── */}
          {activeTab === "timetable" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              {sectionTitle("Timetable", "Weekly slots per section — teachers mark attendance against these",
                ttSection ? <button onClick={openTimetableModal} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> Add slot</button> : undefined)}
              {sections.length === 0 ? (
                <EmptyCard icon={<Icons.Calendar />} tint="bg-green-50 text-green-600" text="Create a section first." />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {sections.map(s => (
                      <button key={s.id} onClick={() => setTtSectionId(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${ttSection?.id === s.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                  {ttSlots.length === 0 ? (
                    <EmptyCard icon={<Icons.Calendar />} tint="bg-green-50 text-green-600" text={`No slots for ${ttSection?.name} yet. Add slots so teachers can mark attendance.`} />
                  ) : (
                    <div className="space-y-5">
                      {DAY_LABELS.map((dayLabel, dayIdx) => {
                        const daySlots = ttSlots.filter(s => s.day_of_week === dayIdx);
                        if (daySlots.length === 0) return null;
                        return (
                          <div key={dayIdx}>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{dayLabel}</p>
                            <div className="space-y-2">
                              {daySlots.map(slot => {
                                const teacher = memberByAnyId(slot.teacher_id);
                                return (
                                  <div key={slot.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 card-shadow border border-slate-50 anim-row">
                                    <div className="w-14 text-center shrink-0">
                                      <div className="text-[13px] font-black text-slate-800 stat-number">{slot.start_time.slice(0, 5)}</div>
                                      <div className="text-[11px] font-bold text-slate-400 stat-number">{slot.end_time.slice(0, 5)}</div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[14px] font-bold text-slate-800 truncate">{subjectById[slot.subject_id]?.name || "Subject"}</div>
                                      <div className="text-[12px] text-slate-400 truncate">
                                        {batchById[slot.batch_id]?.name}{teacher ? ` · ${nameOf(teacher)}` : ""}{slot.room ? ` · Room ${slot.room}` : ""}
                                      </div>
                                    </div>
                                    <button onClick={() => deleteTimetableSlot(slot.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════ MODALS ═══════════ */}
      {modal === "section" && (
        <Modal title="New section" subtitle={`${deptName} · e.g. ${deptName}-2`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <input className="field-soft" placeholder="Section name *" value={newSection.name} autoFocus
              onChange={e => setNewSection({ ...newSection, name: e.target.value })} onKeyDown={e => e.key === "Enter" && createSection()} />
            <input className="field-soft" type="number" placeholder="Year / batch year (optional), e.g. 2025" value={newSection.year}
              onChange={e => setNewSection({ ...newSection, year: e.target.value })} />
            <label className="flex items-center gap-2.5 px-1 text-[13px] font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={newSection.labs} onChange={e => setNewSection({ ...newSection, labs: e.target.checked })} className="w-4 h-4 accent-[#FF7043]" />
              Also create lab batches {newSection.name.trim() || "…"} A, B, C
            </label>
            <p className="text-[11px] text-slate-400 font-medium px-1">A main batch named exactly like the section is always created (normal attendance).</p>
            <div className="flex justify-end gap-3 pt-4">
              <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-orange px-6 py-2.5 rounded-xl text-sm" disabled={busy || !newSection.name.trim()} onClick={createSection}>{busy ? "Creating…" : "Create section"}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "proctor" && openSection && (
        <Modal title="Class teacher" subtitle={openSection.name} onClose={() => setModal(null)}>
          <TeacherPicker members={members} deptId={deptId} instId={instId} busy={busy} onPick={assignProctor} />
        </Modal>
      )}

      {modal === "subject" && openSection && (
        <Modal title="Assign subject" subtitle={openSection.name} onClose={() => setModal(null)}>
          {!subjForm.teacher ? (
            <div className="space-y-3">
              <select className="field" value={subjForm.subjectId} onChange={e => setSubjForm({ ...subjForm, subjectId: e.target.value, newName: "" })}>
                <option value="">— New subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
              </select>
              {!subjForm.subjectId && (
                <input className="field" placeholder="New subject name, e.g. Data Structures" value={subjForm.newName}
                  onChange={e => setSubjForm({ ...subjForm, newName: e.target.value })} />
              )}
              <p className="text-[11px] font-bold text-slate-400 uppercase pt-2">Teacher</p>
              {(subjForm.subjectId || subjForm.newName.trim())
                ? <TeacherPicker members={members} deptId={deptId} instId={instId} onPick={m => setSubjForm({ ...subjForm, teacher: m })} />
                : <p className="text-[12px] text-slate-400">Pick or type a subject first.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 text-[13px] space-y-1">
                <div><span className="text-slate-400">Subject:</span> <b>{subjects.find(s => s.id === subjForm.subjectId)?.name || subjForm.newName}</b></div>
                <div><span className="text-slate-400">Teacher:</span> <b>{nameOf(subjForm.teacher)}</b></div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Teaches which batches?</p>
                <div className="space-y-1.5">
                  {(perSection[openSection.id]?.batches || []).map(b => (
                    <label key={b.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer text-[13px] font-bold text-slate-700">
                      <input type="checkbox" className="w-4 h-4 accent-[#FF7043]" checked={subjForm.batchIds.includes(b.id)}
                        onChange={e => setSubjForm({ ...subjForm, batchIds: e.target.checked ? [...subjForm.batchIds, b.id] : subjForm.batchIds.filter(x => x !== b.id) })} />
                      {b.name}
                      <span className="ml-auto text-[10px] text-slate-400">{isMainBatch(b, openSection) ? "Theory (main)" : "Lab"}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setSubjForm({ ...subjForm, teacher: null })} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Back</button>
                <button disabled={busy || subjForm.batchIds.length === 0} onClick={assignSubjectTeacher} className="btn-orange px-6 py-2.5 rounded-xl text-sm">{busy ? "Saving…" : "Assign"}</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === "batch" && openSection && (
        <Modal title="Add lab batch" subtitle={openSection.name} onClose={() => setModal(null)}>
          <input className="field-soft" value={newBatchName} autoFocus onChange={e => setNewBatchName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createBatch()} />
          <div className="flex justify-end gap-3 pt-6">
            <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setModal(null)}>Cancel</button>
            <button disabled={busy || !newBatchName.trim()} onClick={createBatch} className="btn-orange px-6 py-2.5 rounded-xl text-sm">{busy ? "Adding…" : "Add batch"}</button>
          </div>
        </Modal>
      )}

      {modal === "timetable" && ttSection && (
        <Modal title="Add timetable slot" subtitle={ttSection.name} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select className="field" value={ttForm.batchId} onChange={e => setTtForm({ ...ttForm, batchId: e.target.value })}>
                {(perSection[ttSection.id]?.batches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="field" value={ttForm.day} onChange={e => setTtForm({ ...ttForm, day: Number(e.target.value) })}>
                {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="time" className="field" value={ttForm.startTime} onChange={e => setTtForm({ ...ttForm, startTime: e.target.value })} />
              <input type="time" className="field" value={ttForm.endTime} onChange={e => setTtForm({ ...ttForm, endTime: e.target.value })} />
            </div>
            <select className="field" value={ttForm.subjectId} onChange={e => setTtForm({ ...ttForm, subjectId: e.target.value })}>
              <option value="">— Pick subject —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
            </select>
            <select className="field" value={ttForm.teacherId} onChange={e => setTtForm({ ...ttForm, teacherId: e.target.value })}>
              <option value="">— Pick teacher —</option>
              {teacherRows.map(({ m, otherDept }) => (
                <option key={m.user_id} value={m.user_id}>{nameOf(m)}{otherDept ? " (other dept)" : ""}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium px-1">Teacher from another department? Assign them to a subject in Sections first — then they appear here.</p>
            <input className="field" placeholder="Room (optional), e.g. 301" value={ttForm.room} onChange={e => setTtForm({ ...ttForm, room: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <button className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setModal(null)}>Cancel</button>
              <button disabled={busy || !ttForm.batchId || !ttForm.subjectId || !ttForm.teacherId} onClick={createTimetableSlot} className="btn-orange px-6 py-2.5 rounded-xl text-sm">{busy ? "Adding…" : "Add slot"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
