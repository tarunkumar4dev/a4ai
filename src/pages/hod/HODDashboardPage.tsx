// HODDashboardPage.tsx
// src/pages/hod/HODDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Dedicated HOD Dashboard · ORANGE THEME · Department-scoped
// Shows: Daily attendance, Monthly compilation, Timing, Room numbers
// Hierarchy: Institute Admin → HOD → Proctor → Teacher → Student
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

  .dashboard-root {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #F7F9FC;
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

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 100px; }

  @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
  @keyframes fadeInUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.96);}       to { opacity:1; transform:scale(1);} }
  @keyframes dropIn   { from { opacity:0; transform:translateY(-10px) scale(0.97);} to { opacity:1; transform:translateY(0) scale(1);} }
  @keyframes spin { to { transform: rotate(360deg); } }

  .anim-in { animation: fadeIn .35s ease-out forwards; }
  .anim-entrance { animation: fadeInUp .5s cubic-bezier(0.16,1,0.3,1) forwards; opacity:0; }
  .anim-pop { animation: scaleIn .28s cubic-bezier(0.16,1,0.3,1) forwards; }
  .anim-row { animation: dropIn .28s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
  .anim-spin { animation: spin 1s linear infinite; }

  .anim-row:nth-child(1) { animation-delay: 0.03s; }
  .anim-row:nth-child(2) { animation-delay: 0.06s; }
  .anim-row:nth-child(3) { animation-delay: 0.09s; }
  .anim-row:nth-child(4) { animation-delay: 0.12s; }
  .anim-row:nth-child(5) { animation-delay: 0.15s; }
  .anim-row:nth-child(6) { animation-delay: 0.18s; }
  .anim-row:nth-child(7) { animation-delay: 0.21s; }
  .anim-row:nth-child(8) { animation-delay: 0.24s; }

  .dashboard-root.dark-mode { background-color: #0F1420; color: #E8EDF5; }
  .dark-mode .bg-white { background-color: #171D2B !important; }
  .dark-mode .bg-slate-50 { background-color: #1B2231 !important; }
  .dark-mode .bg-slate-100 { background-color: #2A3446 !important; }
  .dark-mode .border-slate-50,
  .dark-mode .border-slate-100,
  .dark-mode .border-slate-200 { border-color: #2A3446 !important; }
  .dark-mode .text-slate-900, .dark-mode .text-slate-800, .dark-mode .text-slate-700 { color: #E8EDF5 !important; }
  .dark-mode .text-slate-600, .dark-mode .text-slate-500 { color: #94A3B8 !important; }
  .dark-mode .text-slate-400, .dark-mode .text-slate-300 { color: #64748B !important; }
  .dark-mode .field { background: #1B2231; border-color: #2A3446; color: #E8EDF5; }
  .dark-mode .field:focus { background: #212A3B; }
  .dark-mode .btn-ghost { background: #2A3446; color: #94A3B8; }
  .dark-mode .btn-ghost:hover { background: #374151; color: #E8EDF5; }
  .dark-mode .progress-bar-bg { background-color: #2A3446; }
  .dark-mode .chart-track { stroke: #2A3446; }
  .dark-mode .card-shadow { box-shadow: 0 4px 20px rgba(0,0,0,.25); }

  @media (max-width: 640px) {
    .touch-target { min-height: 48px; min-width: 48px; }
    .field { font-size: 16px; padding: 14px 16px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .anim-in, .anim-entrance, .anim-pop, .anim-row { animation: none; opacity: 1; }
    .card-hover:hover { transform: none; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════ */
const Icons = {
  Home: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  Grid: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2" /><rect width="7" height="7" x="14" y="3" rx="2" /><rect width="7" height="7" x="14" y="14" rx="2" /><rect width="7" height="7" x="3" y="14" rx="2" /></svg>,
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Chart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>,
  Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Building: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>,
  Sun: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  Moon: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Loader: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="anim-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
  MapPin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  FileText: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
};

/* ═══════════════════════════════════════════════════════════════════
   INTERFACES
   ═══════════════════════════════════════════════════════════════════ */
interface Department { id: string; institute_id: string; name: string; student_code: string; teacher_code: string; }
interface Section { id: string; department_id: string; name: string; year: number | null; }
interface Teacher { id: string; user_id: string; role: string; status: string; joined_at: string; user_email?: string; user_name?: string; department_id?: string | null; }
interface Batch { id: string; name: string; class_level: string; subject: string; description: string; is_active: boolean; department_id?: string | null; section_id?: string | null; }
interface Subject { id: string; name: string; code: string; department_id?: string | null; }
interface AttendanceSession {
  id: string;
  batch_id: string;
  teacher_id: string;
  subject_id?: string | null;
  department_id?: string | null;
  section_id?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  room_number?: string | null;
  status: string;
  total_present: number;
  total_absent: number;
  total_students: number;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
const formatTime = (t?: string | null) => {
  if (!t) return "—";
  try {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return t;
  }
};

const getMonthDays = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ═══════════════════════════════════════════════════════════════════
   DONUT STAT
   ═══════════════════════════════════════════════════════════════════ */
const DonutStat: React.FC<{ pct: number; label: string; size?: number }> = ({ pct, label, size = 100 }) => {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle className="chart-track" cx="50" cy="50" r={r} fill="none" stroke="#F0F2F5" strokeWidth="12" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#FF7043" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${c * Math.min(pct, 1)} ${c}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-slate-800 stat-number">{Math.round(pct * 100)}%</span>
        <span className="text-[8px] font-bold text-slate-400 uppercase">{label}</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function HODDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "HOD";

  // UI State
  const [activeTab, setActiveTab] = useState<"overview" | "daily" | "monthly" | "teachers">("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data State
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [instituteName, setInstituteName] = useState("");
  const [hodDeptId, setHodDeptId] = useState<string | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);

  // Filter State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");

  const profileRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════
     FETCH ALL DATA
     ═══════════════════════════════════════════════════════════════════ */
  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    try {
      // 1. Find HOD membership
      const { data: mData, error: mErr } = await supabase
        .from("institute_members")
        .select("institute_id, role, department_id")
        .eq("user_id", user.id)
        .eq("role", "hod")
        .eq("status", "active")
        .limit(1);

      if (mErr || !mData || mData.length === 0) {
        toast.error("HOD access not found. Contact your institute admin.");
        setLoading(false);
        return;
      }

      const instId = mData[0].institute_id;
      const deptId = mData[0].department_id;
      setInstituteId(instId);
      setHodDeptId(deptId);

      // 2. Parallel fetch: institute, department, sections, teachers, batches, subjects
      const [instRes, deptRes, secRes, tchRes, batchRes, subjRes] = await Promise.all([
        supabase.from("institutes").select("name").eq("id", instId).single(),
        deptId ? supabase.from("departments").select("*").eq("id", deptId).single() : Promise.resolve({ data: null }),
        deptId ? supabase.from("sections").select("*").eq("department_id", deptId).order("name") : Promise.resolve({ data: [] }),
        supabase.from("institute_members").select("*").eq("institute_id", instId).eq("status", "active").in("role", ["teacher", "hod"]),
        supabase.from("batches").select("*").eq("institute_id", instId).eq("is_active", true),
        supabase.from("subjects").select("id, name, code, department_id").eq("institute_id", instId).order("code"),
      ]);

      if (instRes.data) setInstituteName(instRes.data.name);
      if (deptRes.data) setDepartment(deptRes.data as Department);
      if (secRes.data) setSections(secRes.data as Section[]);

      // Filter teachers to only this department
      const allTeachers = (tchRes.data || []) as Teacher[];
      const deptTeachers = deptId ? allTeachers.filter(t => t.department_id === deptId) : allTeachers;
      setTeachers(deptTeachers);

      // Filter batches to this department
      const allBatches = (batchRes.data || []) as Batch[];
      const deptBatches = deptId ? allBatches.filter(b => b.department_id === deptId) : allBatches;
      setBatches(deptBatches);

      setSubjects((subjRes.data || []) as Subject[]);

      // 3. Fetch attendance sessions for this department (current month range)
      await fetchSessions(instId, deptId);

    } catch (err) {
      console.error("HOD fetchData error:", err);
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSessions = async (instId: string, deptId: string | null) => {
    if (!instId) return;

    // Fetch last 60 days of sessions for flexibility
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    const start = startDate.toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);

    let query = supabase
      .from("attendance_sessions")
      .select("*")
      .eq("institute_id", instId)
      .gte("date", start)
      .lte("date", end)
      .eq("status", "completed")
      .order("date", { ascending: false });

    if (deptId) {
      query = query.eq("department_id", deptId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch sessions error:", error);
    }
    setSessions((data || []) as AttendanceSession[]);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Dashboard refreshed");
  };

  /* ═══════════════════════════════════════════════════════════════════
     COMPUTED DATA
     ═══════════════════════════════════════════════════════════════════ */

  // Teacher name lookup
  const teacherNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    teachers.forEach(t => { m[t.user_id] = t.user_name || t.user_email || "Unknown"; });
    return m;
  }, [teachers]);

  // Batch name lookup
  const batchNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    batches.forEach(b => { m[b.id] = b.name; });
    return m;
  }, [batches]);

  // Subject name lookup
  const subjectNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    subjects.forEach(s => { m[s.id] = `${s.code} - ${s.name}`; });
    return m;
  }, [subjects]);

  // Section name lookup
  const sectionNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    sections.forEach(s => { m[s.id] = s.name + (s.year ? ` (Year ${s.year})` : ""); });
    return m;
  }, [sections]);

  // Today's sessions
  const todaySessions = useMemo(() => {
    return sessions.filter(s => s.date === selectedDate);
  }, [sessions, selectedDate]);

  // Filtered today sessions
  const filteredTodaySessions = useMemo(() => {
    let filtered = todaySessions;
    if (teacherFilter) filtered = filtered.filter(s => s.teacher_id === teacherFilter);
    if (sectionFilter) filtered = filtered.filter(s => s.section_id === sectionFilter);
    return filtered;
  }, [todaySessions, teacherFilter, sectionFilter]);

  // Monthly sessions
  const monthlySessions = useMemo(() => {
    return sessions.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [sessions, selectedMonth, selectedYear]);

  // Monthly compilation per teacher
  const monthlyCompilation = useMemo(() => {
    const map: Record<string, { teacherId: string; name: string; totalSessions: number; totalPresent: number; totalAbsent: number; totalStudents: number; dates: Set<string> }> = {};

    monthlySessions.forEach(s => {
      if (!map[s.teacher_id]) {
        map[s.teacher_id] = {
          teacherId: s.teacher_id,
          name: teacherNameMap[s.teacher_id] || "Unknown",
          totalSessions: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalStudents: 0,
          dates: new Set(),
        };
      }
      map[s.teacher_id].totalSessions += 1;
      map[s.teacher_id].totalPresent += s.total_present;
      map[s.teacher_id].totalAbsent += s.total_absent;
      map[s.teacher_id].totalStudents += s.total_students;
      map[s.teacher_id].dates.add(s.date);
    });

    return Object.values(map).sort((a, b) => b.totalSessions - a.totalSessions);
  }, [monthlySessions, teacherNameMap]);

  // Overview stats
  const overviewStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayS = sessions.filter(s => s.date === today);
    const totalPresent = todayS.reduce((sum, s) => sum + s.total_present, 0);
    const totalStudents = todayS.reduce((sum, s) => sum + s.total_students, 0);
    const attendanceRate = totalStudents > 0 ? totalPresent / totalStudents : 0;

    // Unique teachers who marked today
    const teachersMarkedToday = new Set(todayS.map(s => s.teacher_id)).size;

    // Monthly sessions count
    const now = new Date();
    const thisMonth = sessions.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      todaySessions: todayS.length,
      teachersMarkedToday,
      totalTeachers: teachers.length,
      totalBatches: batches.length,
      totalSections: sections.length,
      todayAttendanceRate: attendanceRate,
      monthlySessionsCount: thisMonth.length,
      todayPresent: totalPresent,
      todayAbsent: todayS.reduce((sum, s) => sum + s.total_absent, 0),
      todayTotal: totalStudents,
    };
  }, [sessions, teachers, batches, sections]);

  /* ═══════════════════════════════════════════════════════════════════
     NAV ITEMS
     ═══════════════════════════════════════════════════════════════════ */
  const navItems = [
    { id: "overview" as const, icon: Icons.Grid, label: "Overview" },
    { id: "daily" as const, icon: Icons.Calendar, label: "Daily View" },
    { id: "monthly" as const, icon: Icons.Chart, label: "Monthly Report" },
    { id: "teachers" as const, icon: Icons.Users, label: "Teachers" },
  ];

  /* ═══════════════════════════════════════════════════════════════════
     EXPORT CSV
     ═══════════════════════════════════════════════════════════════════ */
  const exportMonthlyCSV = () => {
    if (monthlyCompilation.length === 0) {
      toast.error("No data to export");
      return;
    }

    const header = "Teacher,Total Sessions,Days Active,Total Present,Total Absent,Total Students,Attendance %\n";
    const rows = monthlyCompilation.map(t => {
      const rate = t.totalStudents > 0 ? Math.round((t.totalPresent / t.totalStudents) * 100) : 0;
      return `"${t.name}",${t.totalSessions},${t.dates.size},${t.totalPresent},${t.totalAbsent},${t.totalStudents},${rate}%`;
    }).join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HOD_Monthly_Report_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded!");
  };

  const exportDailyCSV = () => {
    if (filteredTodaySessions.length === 0) {
      toast.error("No data to export");
      return;
    }

    const header = "Teacher,Batch,Subject,Date,Start Time,End Time,Room,Present,Absent,Total\n";
    const rows = filteredTodaySessions.map(s => {
      return `"${teacherNameMap[s.teacher_id] || "Unknown"}","${batchNameMap[s.batch_id] || "—"}","${s.subject_id ? subjectNameMap[s.subject_id] || "—" : "—"}",${s.date},${formatTime(s.start_time)},${formatTime(s.end_time)},"${s.room_number || "—"}",${s.total_present},${s.total_absent},${s.total_students}`;
    }).join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HOD_Daily_Report_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded!");
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  const rootClass = `dashboard-root ${isDarkMode ? "dark-mode" : ""}`;

  if (loading) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="text-center anim-in">
          <div className="w-10 h-10 rounded-full anim-spin mx-auto mb-4" style={{ border: "3px solid #F0F2F5", borderTopColor: "#FF7043" }} />
          <p className="text-slate-500 font-bold text-sm">Loading HOD Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hodDeptId || !department) {
    return (
      <div className={`${rootClass} min-h-screen flex items-center justify-center px-4`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="glass-overlay rounded-3xl p-10 max-w-md w-full text-center anim-pop">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-6">
            <Icons.Building />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">HOD Access Required</h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">
            You don't have HOD access yet. Contact your institute admin to assign you as Head of Department.
          </p>
          <button onClick={() => navigate("/")} className="btn-orange px-6 py-3 rounded-xl">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass + " min-h-screen"}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {/* ── SIDEBAR (Desktop) ── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[260px] bg-white border-r border-slate-100 z-30">
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7043] to-[#F4511E] flex items-center justify-center text-white font-black text-sm shadow-lg">
              a4
            </div>
            <div>
              <h1 className="text-[15px] font-black text-slate-800 leading-tight">HOD Panel</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{department.name}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id
                  ? "active-nav-item"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 pb-4 space-y-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="btn-ghost w-full py-2.5 rounded-xl text-xs">
            {isDarkMode ? <><Icons.Sun /> Light Mode</> : <><Icons.Moon /> Dark Mode</>}
          </button>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold">{instituteName}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-xl border-b border-slate-100 z-40 flex items-center justify-between px-4">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2"><Icons.Menu /></button>
        <div className="text-center">
          <h1 className="text-sm font-black text-slate-800">HOD Dashboard</h1>
          <p className="text-[10px] font-bold text-[#FF7043]">{department.name}</p>
        </div>
        <div ref={profileRef} className="relative">
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-8 h-8 rounded-full bg-[#FF7043] text-white font-bold text-xs flex items-center justify-center">
            {displayName.charAt(0).toUpperCase()}
          </button>
          {isProfileOpen && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-slate-100 py-2 w-48 anim-pop z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                <p className="text-[10px] text-[#FF7043] font-bold mt-1">Head of Department</p>
              </div>
              <button onClick={async () => { await signOut(); navigate("/login"); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 font-medium">
                <Icons.LogOut /> Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MOBILE MENU OVERLAY ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-white shadow-xl anim-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF7043] to-[#F4511E] text-white font-black text-xs flex items-center justify-center">a4</div>
                <span className="text-sm font-black text-slate-800">HOD Panel</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}><Icons.X /></button>
            </div>
            <nav className="p-3 space-y-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === item.id ? "active-nav-item" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="lg:ml-[260px] pt-14 lg:pt-0 min-h-screen">
        {/* Top Bar (Desktop) */}
        <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-xl font-black text-slate-800">{navItems.find(n => n.id === activeTab)?.label}</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{department.name} Department · {instituteName}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="btn-ghost px-3 py-2 rounded-lg text-xs" disabled={refreshing}>
              {refreshing ? <Icons.Loader /> : <Icons.Refresh />} Refresh
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="btn-ghost p-2 rounded-lg">
              {isDarkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>
            <div ref={profileRef} className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-800 text-right">{displayName}</p>
                  <p className="text-[10px] text-[#FF7043] font-bold text-right">HOD</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#FF7043] text-white font-bold text-xs flex items-center justify-center">{displayName.charAt(0).toUpperCase()}</div>
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-slate-100 py-2 w-52 anim-pop z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800">{displayName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={async () => { await signOut(); navigate("/login"); }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 font-medium">
                    <Icons.LogOut /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mx-auto max-w-6xl">

          {/* ══════════════ OVERVIEW TAB ══════════════ */}
          {activeTab === "overview" && (
            <div className="anim-entrance space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                  { label: "Sessions Today", value: overviewStats.todaySessions, color: "text-[#FF7043]", bg: "bg-[#FFF5F2]" },
                  { label: "Teachers Active", value: `${overviewStats.teachersMarkedToday}/${overviewStats.totalTeachers}`, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "Sections", value: overviewStats.totalSections, color: "text-purple-500", bg: "bg-purple-50" },
                  { label: "Batches", value: overviewStats.totalBatches, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { label: "This Month", value: overviewStats.monthlySessionsCount, color: "text-amber-500", bg: "bg-amber-50" },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow card-hover border border-slate-50 cursor-default">
                    <div className={`w-8 h-8 rounded-lg ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
                      {i === 0 ? <Icons.Calendar /> : i === 1 ? <Icons.Users /> : i === 2 ? <Icons.Building /> : i === 3 ? <Icons.Grid /> : <Icons.Chart />}
                    </div>
                    <p className="text-2xl font-black text-slate-800 stat-number">{s.value}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Today's Attendance Rate + Quick Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow border border-slate-50">
                  <h3 className="text-[15px] font-bold text-slate-800 mb-4">Today's Attendance</h3>
                  <div className="flex items-center gap-6">
                    <DonutStat pct={overviewStats.todayAttendanceRate} label="Present" />
                    <div className="space-y-3 flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">Present</span>
                        <span className="text-sm font-black text-emerald-500 stat-number">{overviewStats.todayPresent}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">Absent</span>
                        <span className="text-sm font-black text-red-500 stat-number">{overviewStats.todayAbsent}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                        <span className="text-xs font-medium text-slate-500">Total Students</span>
                        <span className="text-sm font-black text-slate-800 stat-number">{overviewStats.todayTotal}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Sessions */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow border border-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-bold text-slate-800">Recent Sessions</h3>
                    <button onClick={() => setActiveTab("daily")} className="text-[11px] font-bold text-[#FF7043] hover:underline flex items-center gap-1">
                      View All <Icons.ChevronRight />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {sessions.slice(0, 5).map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors anim-row" style={{ animationDelay: `${i * 0.03}s` }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">{teacherNameMap[s.teacher_id] || "Unknown"}</p>
                          <p className="text-[10px] text-slate-400">{batchNameMap[s.batch_id] || "—"} · {s.date}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.room_number && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Icons.MapPin /> {s.room_number}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-emerald-500">{s.total_present}/{s.total_students}</span>
                        </div>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-8 font-medium">No attendance sessions yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Teachers who haven't marked today */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[15px] font-bold text-slate-800 mb-4">Teachers Not Marked Today</h3>
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const markedIds = new Set(sessions.filter(s => s.date === today).map(s => s.teacher_id));
                  const notMarked = teachers.filter(t => !markedIds.has(t.user_id));

                  if (notMarked.length === 0) {
                    return <p className="text-sm text-emerald-500 font-bold text-center py-4">✓ All teachers have marked attendance today!</p>;
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {notMarked.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-50/50 border border-red-100 anim-row" style={{ animationDelay: `${i * 0.03}s` }}>
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold shrink-0">
                            {(t.user_name || t.user_email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{t.user_name || t.user_email || "Unknown"}</p>
                            <p className="text-[10px] text-red-400 font-medium">Not marked</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ══════════════ DAILY VIEW TAB ══════════════ */}
          {activeTab === "daily" && (
            <div className="anim-entrance space-y-6">
              {/* Date Picker + Filters */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                    <input
                      type="date"
                      className="field max-w-[200px]"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Teacher</label>
                    <select className="field max-w-[200px]" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}>
                      <option value="">All Teachers</option>
                      {teachers.map(t => (
                        <option key={t.user_id} value={t.user_id}>{t.user_name || t.user_email || "Unknown"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Section</label>
                    <select className="field max-w-[200px]" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
                      <option value="">All Sections</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.year ? ` (Year ${s.year})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:ml-auto sm:pt-4">
                    <button onClick={exportDailyCSV} className="btn-ghost px-4 py-2.5 rounded-xl text-xs">
                      <Icons.Download /> Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="bg-white rounded-2xl card-shadow border border-slate-50 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-[15px] font-bold text-slate-800">
                    Attendance Sessions — {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{filteredTodaySessions.length} session(s) found</p>
                </div>

                {filteredTodaySessions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Icons.Calendar />
                    </div>
                    <p className="text-sm text-slate-500 font-bold">No sessions found</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">No attendance was marked for this date/filter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Teacher</th>
                          <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Batch</th>
                          <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Subject</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">
                            <span className="flex items-center justify-center gap-1"><Icons.Clock /> Timing</span>
                          </th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">
                            <span className="flex items-center justify-center gap-1"><Icons.MapPin /> Room</span>
                          </th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Present</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Absent</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Total</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTodaySessions.map((s, i) => {
                          const rate = s.total_students > 0 ? Math.round((s.total_present / s.total_students) * 100) : 0;
                          return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors anim-row" style={{ animationDelay: `${i * 0.03}s` }}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {(teacherNameMap[s.teacher_id] || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-700 text-xs truncate max-w-[120px]">{teacherNameMap[s.teacher_id] || "Unknown"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 font-medium">{batchNameMap[s.batch_id] || "—"}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{s.subject_id ? subjectNameMap[s.subject_id] || "—" : "—"}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-[11px] font-bold text-slate-600">
                                  {formatTime(s.start_time)} — {formatTime(s.end_time)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {s.room_number ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                    <Icons.MapPin /> {s.room_number}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-black text-emerald-500 stat-number">{s.total_present}</td>
                              <td className="px-4 py-3 text-center text-xs font-black text-red-500 stat-number">{s.total_absent}</td>
                              <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 stat-number">{s.total_students}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <div className="progress-bar-bg w-12 hidden sm:block">
                                    <div className="progress-fill" style={{ width: `${rate}%`, background: rate >= 75 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444" }} />
                                  </div>
                                  <span className={`text-xs font-black stat-number ${rate >= 75 ? "text-emerald-500" : rate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                                    {rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ MONTHLY REPORT TAB ══════════════ */}
          {activeTab === "monthly" && (
            <div className="anim-entrance space-y-6">
              {/* Month Picker */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Month</label>
                    <select className="field max-w-[180px]" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Year</label>
                    <select className="field max-w-[120px]" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="sm:ml-auto sm:pt-4">
                    <button onClick={exportMonthlyCSV} className="btn-orange px-5 py-2.5 rounded-xl text-xs">
                      <Icons.Download /> Export Monthly CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Monthly Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Sessions", value: monthlySessions.length, color: "text-[#FF7043]" },
                  { label: "Active Teachers", value: new Set(monthlySessions.map(s => s.teacher_id)).size, color: "text-blue-500" },
                  { label: "Total Present", value: monthlySessions.reduce((s, x) => s + x.total_present, 0), color: "text-emerald-500" },
                  { label: "Total Absent", value: monthlySessions.reduce((s, x) => s + x.total_absent, 0), color: "text-red-500" },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 card-shadow border border-slate-50 text-center">
                    <p className={`text-2xl font-black stat-number ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Compilation Table */}
              <div className="bg-white rounded-2xl card-shadow border border-slate-50 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-[15px] font-bold text-slate-800">Monthly Compilation — {MONTH_NAMES[selectedMonth]} {selectedYear}</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Per-teacher attendance summary</p>
                </div>

                {monthlyCompilation.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-500 font-bold">No data for this month</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Teacher</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Sessions</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Days Active</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Present</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Absent</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Total</th>
                          <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyCompilation.map((t, i) => {
                          const rate = t.totalStudents > 0 ? Math.round((t.totalPresent / t.totalStudents) * 100) : 0;
                          const daysInMonth = getMonthDays(selectedYear, selectedMonth);
                          return (
                            <tr key={t.teacherId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors anim-row" style={{ animationDelay: `${i * 0.03}s` }}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center text-xs font-bold shrink-0">
                                    {t.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-700 text-xs">{t.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 stat-number">{t.totalSessions}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-bold text-slate-600 stat-number">{t.dates.size}</span>
                                <span className="text-[10px] text-slate-400">/{daysInMonth}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-black text-emerald-500 stat-number">{t.totalPresent}</td>
                              <td className="px-4 py-3 text-center text-xs font-black text-red-500 stat-number">{t.totalAbsent}</td>
                              <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 stat-number">{t.totalStudents}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="progress-bar-bg w-16 hidden sm:block">
                                    <div className="progress-fill" style={{ width: `${rate}%`, background: rate >= 75 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444" }} />
                                  </div>
                                  <span className={`text-xs font-black stat-number ${rate >= 75 ? "text-emerald-500" : rate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                                    {rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ TEACHERS TAB ══════════════ */}
          {activeTab === "teachers" && (
            <div className="anim-entrance space-y-6">
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[15px] font-bold text-slate-800 mb-4">Department Teachers</h3>
                <p className="text-[11px] text-slate-400 font-medium mb-4">{teachers.length} teacher(s) in {department.name}</p>

                {teachers.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8 font-medium">No teachers assigned to your department yet</p>
                ) : (
                  <div className="space-y-2">
                    {teachers.map((t, i) => {
                      // Count this teacher's sessions this month
                      const now = new Date();
                      const tSessions = sessions.filter(s => {
                        const d = new Date(s.date);
                        return s.teacher_id === t.user_id && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                      });
                      const totalPresent = tSessions.reduce((sum, s) => sum + s.total_present, 0);
                      const totalStudents = tSessions.reduce((sum, s) => sum + s.total_students, 0);
                      const rate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

                      // Check if marked today
                      const today = now.toISOString().slice(0, 10);
                      const markedToday = sessions.some(s => s.teacher_id === t.user_id && s.date === today);

                      return (
                        <div key={t.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all anim-row" style={{ animationDelay: `${i * 0.04}s` }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-black text-sm shrink-0">
                              {(t.user_name || t.user_email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-700 truncate">{t.user_name || t.user_email || "Unknown"}</p>
                              <p className="text-[11px] text-slate-400">{t.user_email} · {t.role.toUpperCase()}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {/* Today's status */}
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${markedToday ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                              {markedToday ? "✓ Marked Today" : "✗ Not Marked"}
                            </div>

                            {/* Monthly stats */}
                            <div className="text-right hidden sm:block">
                              <p className="text-xs font-bold text-slate-600">{tSessions.length} sessions</p>
                              <p className="text-[10px] text-slate-400">this month · {rate}% avg</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Department Info */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow border border-slate-50">
                <h3 className="text-[15px] font-bold text-slate-800 mb-4">Department Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Department Name</p>
                    <p className="text-sm font-bold text-slate-800">{department.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Student Join Code</p>
                    <p className="text-sm font-bold text-slate-800 font-mono tracking-wider">{department.student_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Teacher Join Code</p>
                    <p className="text-sm font-bold text-slate-800 font-mono tracking-wider">{department.teacher_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sections</p>
                    <p className="text-sm font-bold text-slate-800">
                      {sections.length > 0 ? sections.map(s => s.name + (s.year ? ` (Y${s.year})` : "")).join(", ") : "None"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}