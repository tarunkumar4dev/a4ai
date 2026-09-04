// src/pages/institute/InstituteDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Institute admin dashboard  ·  ORANGE THEME  ·  3-column layout
// Full hierarchy: Institute → Departments → Sections → Batches → Students
// Roles: admin (full), hod (dept-lead), teacher
// Backward compatible: dept/section nullable, works without them
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import AssignTeacherModal from "@/components/institute/AssignTeacherModal";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .inst-root {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .card-shadow { box-shadow: 0px 4px 20px rgba(0,0,0,0.03); }
  .card-hover { transition: box-shadow .2s ease, transform .2s ease; }
  .card-hover:hover { box-shadow: 0px 8px 28px rgba(0,0,0,0.07); transform: translateY(-2px); }

  .active-nav-item {
    color: #FF7043 !important;
    font-weight: 700 !important;
    border-left: 3px solid #FF7043;
    background: linear-gradient(90deg, rgba(255,112,67,0.07) 0%, transparent 100%);
  }

  .progress-bar-bg { background-color: #F0F2F5; border-radius: 4px; overflow: hidden; height: 6px; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width .6s ease; }

  .stat-number { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .join-code { font-family: 'SF Mono','Fira Code',monospace; letter-spacing: .2em; }

  .btn-orange {
    background: #FF7043; color: #fff; font-weight: 700; border: none; cursor: pointer;
    transition: all .2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  }
  .btn-orange:hover { background: #F4511E; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(255,112,67,.3); }
  .btn-orange:active { transform: scale(.98); }
  .btn-orange:disabled { opacity: .45; cursor: not-allowed; transform: none !important; box-shadow: none; }

  .btn-ghost {
    background: #F1F5F9; color: #475569; font-weight: 700; border: none; cursor: pointer;
    transition: all .15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .btn-ghost:hover { background: #E2E8F0; color: #1E293B; }

  .field {
    width: 100%; padding: 12px 16px; background: #F8FAFC; border: 1px solid #E2E8F0;
    border-radius: 12px; font-size: 14px; font-weight: 500; color: #1E293B; outline: none;
    transition: border-color .15s, box-shadow .15s; font-family: inherit;
  }
  .field:focus { border-color: #FF7043; background: #fff; box-shadow: 0 0 0 3px rgba(255,112,67,.12); }
  .field::placeholder { color: #94A3B8; font-weight: 400; }

  .field-soft {
    width: 100%; padding: 14px 18px;
    background: rgba(255,255,255,0.5);
    box-shadow: inset 4px 4px 10px rgba(0,0,0,0.02), inset -4px -4px 10px rgba(255,255,255,0.9);
    border: 1px solid rgba(0,0,0,0.05);
    border-radius: 18px; font-size: 14px; font-weight: 600; color: #1E293B; outline: none;
    transition: box-shadow .15s; font-family: inherit;
  }
  .field-soft:focus { box-shadow: 0 0 0 3px rgba(255,112,67,.2); }
  .field-soft::placeholder { color: #94A3B8; font-weight: 500; }

  .glass-overlay {
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(48px); -webkit-backdrop-filter: blur(48px);
    border: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 30px 60px -10px rgba(0,0,0,0.15), inset 0 1px 0 0 rgba(255,255,255,0.9);
  }
  .dark-mode .glass-overlay {
    background: rgba(23,29,43,0.95);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 30px 60px -10px rgba(0,0,0,0.6);
  }
  .dark-mode .field-soft {
    background: rgba(30,37,54,0.6);
    box-shadow: inset 4px 4px 10px rgba(0,0,0,0.3), inset -4px -4px 10px rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    color: #E8EDF5;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
  .dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
  .stat-number { font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .join-code { font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 0.25em; }
`;

const I = {
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  UserPlus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>,
  User: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Layers: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Moon: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  Sun: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  LogOut: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  Building: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>,
  Zap: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  ChevronDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  ArrowRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Key: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
};

interface Institute { id: string; name: string; join_code: string; max_teachers: number; max_students: number; monthly_test_limit: number; }
interface Department { id: string; institute_id: string; name: string; student_code: string; teacher_code: string; }
interface Section { id: string; department_id: string; name: string; year: number | null; }
interface Teacher { id: string; user_id: string; role: string; status: string; joined_at: string; user_email?: string; user_name?: string; department_id?: string | null; }
interface Batch { id: string; name: string; class_level: string; subject: string; description: string; is_active: boolean; department_id?: string | null; section_id?: string | null; }
interface Student { id: string; name: string; roll_no: string; class_level: string; parent_name: string; parent_phone: string; batch_id: string; batch_name?: string; is_active: boolean; department_id?: string | null; section_id?: string | null; }

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

  const [activeTab, setActiveTab] = useState("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [utilView, setUtilView] = useState<"ring" | "bars">("ring");

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [institute, setInstitute] = useState<Institute | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [copiedDeptCode, setCopiedDeptCode] = useState<string>("");

  const [newBatch, setNewBatch] = useState({ name: "", class_level: "", subject: "", description: "", department_id: "", section_id: "" });
  const [newStudent, setNewStudent] = useState({ name: "", roll_no: "", class_level: "", parent_name: "", parent_phone: "", batch_id: "", department_id: "", section_id: "" });
  const [newDept, setNewDept] = useState({ name: "" });
  const [newSection, setNewSection] = useState({ department_id: "", name: "", year: "" });

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");

  const [newInstituteName, setNewInstituteName] = useState("");
  const [creatingInstitute, setCreatingInstitute] = useState(false);

  useEffect(() => { isDarkMode ? document.documentElement.classList.add("dark") : document.documentElement.classList.remove("dark"); }, [isDarkMode]);
  useEffect(() => { const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: m } = await supabase
        .from("institute_members")
        .select("institute_id, role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .eq("status", "active")
        .single();

      if (!m) { setLoading(false); return; }
      const id = m.institute_id;

      const [a, b, c, d, e, f] = await Promise.all([
        supabase.from("institutes").select("*").eq("id", id).single(),
        supabase.from("institute_members").select("*").eq("institute_id", id).in("role", ["teacher", "hod"]).order("joined_at", { ascending: false }),
        supabase.from("batches").select("*").eq("institute_id", id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("students").select("*, batches(name)").eq("institute_id", id).eq("is_active", true).order("name", { ascending: true }),
        supabase.from("departments").select("*").eq("institute_id", id).order("name", { ascending: true }),
        supabase.from("sections").select("*, departments!inner(institute_id)").eq("departments.institute_id", id).order("name", { ascending: true }),
      ]);
      if (a.data) setInstitute(a.data as Institute);
      if (b.data) setTeachers(b.data as Teacher[]);
      if (c.data) setBatches(c.data as Batch[]);
      if (d.data) setStudents(d.data.map((s: any) => ({ ...s, batch_name: s.batches?.name || "Unassigned" })));
    } catch { toast.error("Failed to load data"); }
    setLoading(false);
  };

  const handleCreateInstitute = async () => { if (!newInstituteName.trim() || !user) return; setCreatingInstitute(true); try { const { error } = await supabase.rpc("create_institute", { p_name: newInstituteName.trim() }); if (error) throw error; toast.success("Institute created!"); fetchData(); } catch (e: any) { toast.error(e.message || "Failed"); } setCreatingInstitute(false); };
  const handleAddBatch = async () => { if (!newBatch.name.trim() || !institute) return; try { const { error } = await supabase.from("batches").insert({ institute_id: institute.id, name: newBatch.name.trim(), class_level: newBatch.class_level || null, subject: newBatch.subject || null, description: newBatch.description || null }); if (error) throw error; toast.success("Batch created!"); setShowAddBatch(false); setNewBatch({ name: "", class_level: "", subject: "", description: "" }); fetchData(); } catch (e: any) { toast.error(e.message); } };
  const handleAddStudent = async () => { if (!newStudent.name.trim() || !institute) return; try { const { error } = await supabase.from("students").insert({ institute_id: institute.id, name: newStudent.name.trim(), roll_no: newStudent.roll_no || null, class_level: newStudent.class_level || null, parent_name: newStudent.parent_name || null, parent_phone: newStudent.parent_phone || null, batch_id: newStudent.batch_id || null }); if (error) throw error; toast.success("Student added!"); setShowAddStudent(false); setNewStudent({ name: "", roll_no: "", class_level: "", parent_name: "", parent_phone: "", batch_id: "" }); fetchData(); } catch (e: any) { toast.error(e.message); } };
  const removeTeacher = async (id: string) => { if (!confirm("Remove teacher?")) return; await supabase.from("institute_members").update({ status: "inactive" }).eq("id", id); fetchData(); };
  const removeStudent = async (id: string) => { if (!confirm("Remove student?")) return; await supabase.from("students").update({ is_active: false }).eq("id", id); fetchData(); };
  const deleteBatch = async (id: string) => { if (!confirm("Delete batch?")) return; await supabase.from("batches").update({ is_active: false }).eq("id", id); fetchData(); };
  const copyCode = () => { if (!institute) return; navigator.clipboard.writeText(institute.join_code); setJoinCodeCopied(true); toast.success("Copied!"); setTimeout(() => setJoinCodeCopied(false), 2000); };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.roll_no && s.roll_no.toLowerCase().includes(studentSearch.toLowerCase())));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const navItems = [
    { id: "overview", icon: I.Grid, label: "Overview" },
    { id: "teachers", icon: I.Users, label: "Teachers", count: teachers.length },
    { id: "batches", icon: I.Layers, label: "Batches", count: batches.length },
    { id: "students", icon: I.UserPlus, label: "Students", count: students.length },
    { id: "analytics", icon: I.Chart, label: "Analytics" },
    { id: "settings", icon: I.Settings, label: "Settings" },
  ];

  if (!loading && !institute) return (
    <div className="inst-root"><style>{styles}</style>
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDarkMode ? "dark bg-zinc-950" : "bg-zinc-50"}`}>
        <div className="card p-10 sm:p-14 max-w-md w-full text-center anim-pop">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-5"><I.Building /></div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">Create your institute</h2>
          <p className="text-sm text-zinc-500 mb-8">Set up your school or coaching center on a4ai.</p>
          <input className="input-field mb-4 text-center" placeholder="Institute name" value={newInstituteName} onChange={e => setNewInstituteName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateInstitute()} />
          <button className="btn-primary w-full justify-center" onClick={handleCreateInstitute} disabled={creatingInstitute || !newInstituteName.trim()}>{creatingInstitute ? "Creating..." : "Create Institute"}</button>
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
          <button className="btn-orange w-full py-3.5 rounded-xl" onClick={handleCreateInstitute} disabled={creatingInstitute || !newInstituteName.trim()}>
            {creatingInstitute ? <><Icons.Loader /> Creating...</> : <>Create Institute</>}
          </button>
        </div>
      </div>
    );
  }

  const availSectionsForBatch = newBatch.department_id ? sectionsOfDept(newBatch.department_id) : [];
  const availSectionsForStudent = newStudent.department_id ? sectionsOfDept(newStudent.department_id) : [];
  const availSectionsForFilter = deptFilter && deptFilter !== "none" ? sectionsOfDept(deptFilter) : [];

  return (
    <div className={`${rootClass} h-screen w-full flex overflow-hidden text-slate-800`}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

        <aside className={`fixed lg:relative top-0 left-0 w-[240px] h-full flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-[100] lg:z-10 shrink-0 transition-transform duration-200 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="p-5 pb-3">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5"><img src="/ICON.ico" alt="" className="w-6 h-6 object-contain" onError={(e: any) => { e.currentTarget.style.display = "none"; }} /><span className="font-bold text-[15px] tracking-tight">a4ai</span></div>
              <button className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-600 rounded-md" onClick={() => setMobileMenuOpen(false)}><I.X /></button>
            </div>
            {institute && (<div className="mb-5 px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{institute.name.charAt(0).toUpperCase()}</div><span className="text-[13px] font-semibold truncate">{institute.name}</span></div></div>)}
            <nav className="space-y-0.5">
              {navItems.map(item => (<button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] ${activeTab === item.id ? "active text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400 font-normal"}`}><item.icon /><span className="flex-1 text-left">{item.label}</span>{item.count !== undefined && item.count > 0 && <span className="text-[11px] font-medium text-zinc-400 tabular-nums">{item.count}</span>}</button>))}
            </nav>
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

        <main className="flex-1 h-full overflow-y-auto">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <header className="flex items-center justify-between mb-8 anim-in">
              <div className="flex items-center gap-3">
                <button className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500" onClick={() => setMobileMenuOpen(true)}><I.Menu /></button>
                <div><h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight">{activeTab === "overview" ? `Welcome back, ${displayName?.split(" ")[0]}` : navItems.find(n => n.id === activeTab)?.label}</h1><p className="text-[13px] text-zinc-500 mt-0.5">{activeTab === "overview" && "Here's your institute at a glance."}{activeTab === "teachers" && `${teachers.length} teacher${teachers.length !== 1 ? "s" : ""}`}{activeTab === "batches" && `${batches.length} active batch${batches.length !== 1 ? "es" : ""}`}{activeTab === "students" && `${students.length} student${students.length !== 1 ? "s" : ""} enrolled`}{activeTab === "analytics" && "Performance insights"}{activeTab === "settings" && "Configuration"}</p></div>
              </div>
              <div className="flex items-center gap-2" ref={profileRef}>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">{isDarkMode ? <I.Sun /> : <I.Moon />}</button>
                <div className="relative">
                  <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">{displayName.charAt(0).toUpperCase()}</div><span className="text-[13px] font-medium hidden sm:block">{displayName.split(" ")[0]}</span><I.ChevronDown /></button>
                  {isProfileOpen && (<div className="absolute right-0 top-full mt-1.5 w-56 card p-1.5 anim-pop z-50"><div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 mb-1"><p className="text-[13px] font-semibold truncate">{displayName}</p><p className="text-[11px] text-zinc-400 truncate">{user?.email}</p></div><button onClick={() => { signOut(); navigate("/login"); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg font-medium"><I.LogOut /> Sign out</button></div>)}
                </div>
              </div>
            </header>

            {activeTab === "overview" && (<div className="space-y-6 anim-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{[{ l: "Teachers", v: teachers.length, s: "Active" }, { l: "Students", v: students.length, s: "Enrolled" }, { l: "Batches", v: batches.length, s: "Running" }, { l: "Tests", v: "—", s: "This month" }].map((s, i) => (<div key={i} className="card p-4 sm:p-5"><p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">{s.l}</p><p className="stat-number text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">{s.v}</p><p className="text-[11px] text-zinc-400 mt-1">{s.s}</p></div>))}</div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 card p-5 sm:p-6"><div className="flex items-center gap-2 mb-3"><I.Key /><h3 className="text-[15px] font-semibold">Invite Teachers</h3></div><p className="text-[13px] text-zinc-500 mb-4">Share this code with teachers. They sign up and enter it to join.</p><div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"><code className="join-code text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex-1 text-center">{institute?.join_code}</code><button onClick={copyCode} className="btn-primary text-[12px] px-3 py-2">{joinCodeCopied ? <><I.Check /> Copied</> : <><I.Copy /> Copy</>}</button></div></div>
                <div className="lg:col-span-2 card p-5 sm:p-6"><h3 className="text-[15px] font-semibold mb-4">Quick Actions</h3><div className="space-y-2">{[{ label: "New Batch", icon: I.Layers, fn: () => setShowAddBatch(true) }, { label: "Add Student", icon: I.UserPlus, fn: () => setShowAddStudent(true) }, { label: "Generate Test", icon: I.Zap, fn: () => navigate("/dashboard/test-generator") }].map((a, i) => (<button key={i} onClick={a.fn} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-[13px] font-medium text-zinc-700 dark:text-zinc-300"><a.icon /> {a.label} <span className="ml-auto text-zinc-300 dark:text-zinc-600"><I.ArrowRight /></span></button>))}</div></div>
              </div>
              <div className="card p-5 sm:p-6"><div className="flex items-center justify-between mb-4"><h3 className="text-[15px] font-semibold">Recent Students</h3>{students.length > 5 && <button onClick={() => setActiveTab("students")} className="text-[12px] font-medium text-blue-600">View all</button>}</div>{students.length === 0 ? <div className="text-center py-10"><p className="text-[13px] text-zinc-400 mb-3">No students yet</p><button className="btn-primary text-[12px]" onClick={() => setShowAddStudent(true)}><I.Plus /> Add Student</button></div> : <div className="space-y-0.5">{students.slice(0, 5).map(s => (<div key={s.id} className="row-item"><div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">{s.name.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{s.name}</p><p className="text-[11px] text-zinc-400 truncate">{s.batch_name} · Roll {s.roll_no || "—"}</p></div><span className="badge badge-blue">{s.class_level || "—"}</span></div>))}</div>}</div>
            </div>)}

            {activeTab === "teachers" && (<div className="anim-in"><div className="card p-5 sm:p-6"><div className="flex items-center justify-between mb-4"><h3 className="text-[15px] font-semibold">All Teachers</h3><button onClick={copyCode} className="btn-secondary text-[12px]">{joinCodeCopied ? <><I.Check /> Copied</> : <><I.Copy /> Copy Join Code</>}</button></div><div className="mb-4 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20"><p className="text-[12px] text-blue-700 dark:text-blue-300">Share code <code className="font-bold join-code bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded text-blue-600">{institute?.join_code}</code> with teachers to invite them.</p></div>{teachers.length === 0 ? <div className="text-center py-12"><p className="text-[13px] text-zinc-400">No teachers yet. Share the join code.</p></div> : <div className="space-y-0.5">{teachers.map(t => (<div key={t.id} className="row-item group"><div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"><I.User /></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{t.user_name || t.user_email || `Teacher ${t.user_id.slice(0, 8)}`}</p><p className="text-[11px] text-zinc-400">{t.joined_at ? `Joined ${fmtDate(t.joined_at)}` : "Pending"}</p></div><span className={`badge ${t.status === "active" ? "badge-green" : "badge-amber"}`}>{t.status}</span><button onClick={() => removeTeacher(t.id)} className="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all"><I.Trash /></button></div>))}</div>}</div></div>)}

            {activeTab === "batches" && (<div className="anim-in"><div className="flex items-center justify-between mb-4"><div /><button className="btn-primary text-[12px]" onClick={() => setShowAddBatch(true)}><I.Plus /> New Batch</button></div>{batches.length === 0 ? <div className="card p-5 text-center py-16"><p className="text-[13px] text-zinc-400 mb-3">No batches yet</p><button className="btn-primary text-[12px]" onClick={() => setShowAddBatch(true)}><I.Plus /> Create Batch</button></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{batches.map(b => { const c = students.filter(s => s.batch_id === b.id).length; return (<div key={b.id} className="card p-5 group relative"><button onClick={() => deleteBatch(b.id)} className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all"><I.Trash /></button><button onClick={(e) => { e.stopPropagation(); setAssignBatch({ id: b.id, name: b.name }); }} className="absolute top-3 right-12 p-1.5 rounded-md text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-all"><I.UserPlus /></button><div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-500"><I.Layers /></div><h4 className="text-[14px] font-semibold mb-0.5">{b.name}</h4><p className="text-[12px] text-zinc-400 mb-3">{b.class_level ? `Class ${b.class_level}` : ""} {b.subject ? `· ${b.subject}` : ""}</p><span className="badge badge-blue">{c} student{c !== 1 ? "s" : ""}</span></div>); })}</div>}</div>)}

            {activeTab === "students" && (<div className="anim-in"><div className="card p-5 sm:p-6"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4"><div className="relative flex-1 w-full sm:max-w-xs"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><I.Search /></div><input className="input-field pl-9 text-[13px]" placeholder="Search name or roll..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} /></div><button className="btn-primary text-[12px]" onClick={() => setShowAddStudent(true)}><I.Plus /> Add Student</button></div>{filteredStudents.length === 0 ? <div className="text-center py-12"><p className="text-[13px] text-zinc-400">{students.length === 0 ? "No students yet" : "No matches"}</p></div> : <div className="space-y-0.5">{filteredStudents.map(s => (<div key={s.id} className="row-item group"><div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">{s.name.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{s.name}</p><p className="text-[11px] text-zinc-400 truncate">{s.batch_name} · Roll {s.roll_no || "—"}{s.parent_phone ? ` · ${s.parent_phone}` : ""}</p></div><span className="badge badge-blue">{s.class_level || "—"}</span><button onClick={() => removeStudent(s.id)} className="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all"><I.Trash /></button></div>))}</div>}</div></div>)}

            {activeTab === "analytics" && (<div className="space-y-4 anim-in"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[{ l: "Teachers", v: teachers.length }, { l: "Students", v: students.length }, { l: "Batches", v: batches.length }, { l: "Avg Batch", v: batches.length > 0 ? Math.round(students.length / batches.length) : 0 }].map((s, i) => (<div key={i} className="card p-4"><p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{s.l}</p><p className="stat-number text-2xl font-bold">{s.v}</p></div>))}</div><div className="card p-8 sm:p-12 text-center"><div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400"><I.Chart /></div><h3 className="text-[15px] font-semibold mb-1">Detailed Analytics</h3><p className="text-[13px] text-zinc-400">Charts appear once tests are generated.</p></div></div>)}

            {activeTab === "settings" && institute && (<div className="anim-in space-y-4"><div className="card p-5 sm:p-6"><h3 className="text-[15px] font-semibold mb-5">Institute Details</h3><div className="space-y-4"><div><label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Name</label><p className="text-[15px] font-semibold mt-0.5">{institute.name}</p></div><div><label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Join Code</label><div className="flex items-center gap-2 mt-0.5"><code className="join-code text-[18px] font-bold">{institute.join_code}</code><button onClick={copyCode} className="p-1 rounded text-zinc-400 hover:text-zinc-600"><I.Copy /></button></div></div><div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">{[{ l: "Max Teachers", v: institute.max_teachers }, { l: "Max Students", v: institute.max_students }, { l: "Monthly Tests", v: institute.monthly_test_limit }].map((s, i) => (<div key={i}><label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{s.l}</label><p className="stat-number text-xl font-bold mt-0.5">{s.v}</p></div>))}</div></div></div></div>)}
          </div>
        </main>

        {showAddBatch && (<div className="fixed inset-0 z-[200] flex items-center justify-center px-4 anim-pop"><div className="absolute inset-0 overlay-bg" onClick={() => setShowAddBatch(false)} /><div className="modal-card p-6 sm:p-8 relative z-10"><div className="flex items-center justify-between mb-5"><h3 className="text-[16px] font-semibold">Create Batch</h3><button onClick={() => setShowAddBatch(false)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><I.X /></button></div><div className="space-y-3"><input className="input-field" placeholder="Batch name (e.g., Class 10 - Batch A)" value={newBatch.name} onChange={e => setNewBatch({ ...newBatch, name: e.target.value })} /><div className="grid grid-cols-2 gap-3"><input className="input-field" placeholder="Class (e.g., 10)" value={newBatch.class_level} onChange={e => setNewBatch({ ...newBatch, class_level: e.target.value })} /><input className="input-field" placeholder="Subject (optional)" value={newBatch.subject} onChange={e => setNewBatch({ ...newBatch, subject: e.target.value })} /></div><div className="flex justify-end gap-2 pt-2"><button className="btn-secondary text-[12px]" onClick={() => setShowAddBatch(false)}>Cancel</button><button className="btn-primary text-[12px]" onClick={handleAddBatch} disabled={!newBatch.name.trim()}>Create Batch</button></div></div></div></div>)}

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

      {assignHodDept && (
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
                      <p className="text-[13px] font-bold text-slate-800 truncate">{t.user_name || t.user_email || `Teacher ${t.user_id.slice(0, 8)}`}</p>
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

        {assignBatch && (
          <AssignTeacherModal
            batchId={assignBatch.id}
            batchName={assignBatch.name}
            teachers={teachers}
            onClose={() => setAssignBatch(null)}
            onAssigned={fetchData}
          />
        )}
      </div>
    </div>
  );
}