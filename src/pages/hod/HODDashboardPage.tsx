// src/pages/hod/HODDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Head of Department (HOD) Dashboard
// Matches InstituteDashboardPage layout, styling & design system:
// • Orange (#FF7043) / Peach (#FFF5F2) palette
// • Plus Jakarta Sans typography
// • card-shadow, card-hover, btn-orange, btn-ghost, field
// • Department-scoped hierarchy: Department → Sections → Batches → Teachers
// • Attendance tab powered by HODAttendanceDashboard (Daily & Monthly)
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import HODAttendanceDashboard from "@/components/attendance/HODAttendanceDashboard";
import {
  Building2,
  Users,
  GraduationCap,
  Layers,
  ChevronRight,
  Plus,
  Shield,
  BookOpen,
  AlertCircle,
  X,
  Loader2,
  LogOut,
  Trash2,
  CalendarCheck,
  Clock,
  BarChart3,
  Search,
  Copy,
  Check,
  Sun,
  Moon,
  Menu,
  RefreshCw,
  DoorOpen,
  CalendarDays,
  UserPlus,
  Key,
  Home,
  CheckCircle2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   STYLES (100% matched to InstituteDashboardPage)
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
`;

/* ───── TYPES ───── */
interface Department {
  id: string;
  institute_id: string;
  name: string;
  student_code: string;
  teacher_code: string;
}

interface Section {
  id: string;
  department_id: string;
  name: string;
  year: number | null;
}

interface Teacher {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  user_email?: string;
  user_name?: string;
  department_id?: string | null;
}

interface Batch {
  id: string;
  name: string;
  class_level?: string;
  subject?: string;
  description?: string;
  is_active?: boolean;
  department_id?: string | null;
  section_id?: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  department_id?: string | null;
}

export default function HODDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "HOD";

  // Navigation State
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "sections" | "teachers" | "batches">("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data State
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [instituteName, setInstituteName] = useState("");
  const [department, setDepartment] = useState<Department | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Section Modal State
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionYear, setNewSectionYear] = useState<number | "">("");
  const [savingSection, setSavingSection] = useState(false);

  // Join Code Copy State
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Profile menu
  const profileRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ───── FETCH DATA ───── */
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Find HOD membership
      const { data: mData, error: mErr } = await supabase
        .from("institute_members")
        .select("institute_id, role, department_id")
        .eq("user_id", user.id)
        .in("role", ["hod", "admin"])
        .eq("status", "active")
        .limit(1);

      if (mErr || !mData || mData.length === 0) {
        toast.error("HOD or Admin access not found. Contact your institute administrator.");
        setLoading(false);
        return;
      }

      const instId = mData[0].institute_id;
      let deptId = mData[0].department_id;
      setInstituteId(instId);

      // If user is institute admin without specific department, find first department
      if (!deptId) {
        const { data: dList } = await supabase
          .from("departments")
          .select("id")
          .eq("institute_id", instId)
          .limit(1);
        if (dList && dList.length > 0) {
          deptId = dList[0].id;
        }
      }

      // 2. Fetch Institute, Department, Sections, Teachers, Batches, Subjects
      const [instRes, deptRes, secRes, tchRes, batchRes, subjRes] = await Promise.all([
        supabase.from("institutes").select("name").eq("id", instId).single(),
        deptId ? supabase.from("departments").select("*").eq("id", deptId).single() : Promise.resolve({ data: null }),
        deptId
          ? supabase.from("sections").select("*").eq("department_id", deptId).order("name")
          : Promise.resolve({ data: [] }),
        supabase
          .from("institute_members")
          .select("*")
          .eq("institute_id", instId)
          .eq("status", "active")
          .in("role", ["teacher", "hod"]),
        supabase.from("batches").select("*").eq("institute_id", instId).eq("is_active", true),
        supabase.from("subjects").select("id, name, code, department_id").eq("institute_id", instId).order("code"),
      ]);

      if (instRes.data) setInstituteName(instRes.data.name);
      if (deptRes.data) setDepartment(deptRes.data as Department);
      if (secRes.data) setSections(secRes.data as Section[]);

      // Filter teachers to this department
      const allTeachers = (tchRes.data || []) as Teacher[];
      const deptTeachers = deptId ? allTeachers.filter((t) => t.department_id === deptId) : allTeachers;
      setTeachers(deptTeachers);

      // Filter batches to this department
      const allBatches = (batchRes.data || []) as Batch[];
      const deptBatches = deptId ? allBatches.filter((b) => b.department_id === deptId) : allBatches;
      setBatches(deptBatches);

      setSubjects((subjRes.data || []) as Subject[]);
    } catch (err: any) {
      console.error("HOD fetchData error:", err);
      toast.error("Failed to load HOD dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Dashboard refreshed");
  };

  /* ───── COPY JOIN CODE ───── */
  const copyCode = (code: string, label: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  /* ───── CREATE SECTION ───── */
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      toast.error("Section name is required");
      return;
    }
    if (!department || !instituteId) return;

    setSavingSection(true);
    try {
      const { data, error } = await supabase
        .from("sections")
        .insert({
          department_id: department.id,
          name: newSectionName.trim(),
          year: newSectionYear ? Number(newSectionYear) : null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Automatically create the default batch for this section
      await supabase.from("batches").insert({
        institute_id: instituteId,
        name: newSectionName.trim(),
        department_id: department.id,
        section_id: data.id,
      });

      toast.success(`Section ${newSectionName.trim()} created!`);
      setNewSectionName("");
      setNewSectionYear("");
      setShowAddSection(false);
      await fetchData();
    } catch (err: any) {
      console.error("Error creating section:", err);
      toast.error(err.message || "Failed to create section");
    } finally {
      setSavingSection(false);
    }
  };

  /* ───── DELETE SECTION ───── */
  const handleDeleteSection = async (secId: string, secName: string) => {
    if (!confirm(`Are you sure you want to delete section "${secName}"?`)) return;

    try {
      const { error } = await supabase.from("sections").delete().eq("id", secId);
      if (error) throw error;
      toast.success(`Section "${secName}" deleted`);
      setSections((prev) => prev.filter((s) => s.id !== secId));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete section");
    }
  };

  /* ───── NAVIGATION ITEMS ───── */
  const navItems = [
    { id: "overview" as const, icon: Home, label: "Overview" },
    { id: "attendance" as const, icon: CalendarCheck, label: "Attendance" },
    { id: "sections" as const, icon: Layers, label: "Sections" },
    { id: "teachers" as const, icon: Users, label: "Teachers" },
    { id: "batches" as const, icon: BookOpen, label: "Batches" },
  ];

  const rootClass = `dashboard-root min-h-screen ${isDarkMode ? "dark-mode" : ""}`;

  /* ───── LOADING STATE ───── */
  if (loading) {
    return (
      <div className={`${rootClass} flex items-center justify-center`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="text-center anim-in">
          <div
            className="w-12 h-12 rounded-full anim-spin mx-auto mb-4"
            style={{ border: "3px solid #FFF5F2", borderTopColor: "#FF7043" }}
          />
          <p className="text-slate-600 font-bold text-sm">Loading HOD Dashboard...</p>
        </div>
      </div>
    );
  }

  /* ───── NO DEPARTMENT STATE ───── */
  if (!department) {
    return (
      <div className={`${rootClass} flex items-center justify-center px-4`}>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="glass-overlay rounded-3xl p-10 max-w-md w-full text-center anim-pop">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">HOD Access Required</h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">
            You don't have an active department assigned yet. Contact your institute admin to link you to your department.
          </p>
          <button onClick={() => navigate("/")} className="btn-orange px-6 py-3 rounded-xl text-sm font-bold">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      <div className="flex h-screen overflow-hidden">
        {/* ═══════════ SIDEBAR (DESKTOP) ═══════════ */}
        <aside className="w-[260px] bg-white border-r border-slate-100 flex-shrink-0 hidden lg:flex flex-col z-30">
          {/* Logo & Institute Branding */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7043] to-[#F4511E] flex items-center justify-center text-white font-black text-base shadow-sm">
                a4
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black text-slate-800 truncate">HOD Panel</h1>
                <p className="text-[11px] font-bold text-slate-400 truncate">{instituteName || "Institute"}</p>
              </div>
            </div>
          </div>

          {/* HOD Profile Pill */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3 bg-[#FFF5F2] p-3 rounded-2xl border border-[#FF7043]/15">
              <div className="w-10 h-10 rounded-xl bg-[#FF7043] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">{displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-extrabold text-[#FF7043] uppercase tracking-wider">HOD</span>
                  <span className="text-[10px] text-slate-400">•</span>
                  <span className="text-[10px] font-bold text-slate-500 truncate">{department.name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 mb-2">Main Menu</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all ${
                    active ? "active-nav-item" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-[#FF7043]" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Quick Actions */}
            <div className="pt-6">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 mb-2">Quick Actions</p>
              <div className="space-y-1">
                <button
                  onClick={() => setShowAddSection(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF7043]" />
                  <span>New Section</span>
                </button>
                <button
                  onClick={() => copyCode(department.student_code, "Student code")}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"
                >
                  <Key className="w-3.5 h-3.5 text-[#FF7043]" />
                  <span>Copy Student Code</span>
                </button>
                <button
                  onClick={() => copyCode(department.teacher_code, "Teacher code")}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[#FF7043]" />
                  <span>Copy Teacher Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Theme Switcher & Sign Out */}
          <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between bg-slate-50 p-1 rounded-full border border-slate-100">
              <button
                onClick={() => setIsDarkMode(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  !isDarkMode ? "bg-white shadow-xs text-slate-800" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button
                onClick={() => setIsDarkMode(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isDarkMode ? "bg-white shadow-xs text-slate-800" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
            </div>
          </div>
        </aside>

        {/* ═══════════ MAIN CONTENT AREA ═══════════ */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-50"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-800">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </h2>
                <p className="text-[11px] font-bold text-slate-400 hidden sm:block">
                  {department.name} Department • {instituteName}
                </p>
              </div>
            </div>

            {/* Right Header: Refresh + Profile */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-ghost px-3 py-1.5 rounded-xl text-xs"
                title="Refresh dashboard data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#FF7043]" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 pl-2 sm:pl-3 pr-1.5 py-1 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black text-slate-800 leading-tight">{displayName}</p>
                    <p className="text-[10px] font-bold text-[#FF7043] leading-tight">HOD • {department.name}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7043] to-[#F4511E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 w-56 anim-pop z-50">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-black text-slate-800 truncate">{displayName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FFF5F2] text-[#FF7043]">
                        Head of Department
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        await signOut();
                        navigate("/login");
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-[270px] bg-white shadow-2xl anim-in flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FF7043] text-white font-black text-xs flex items-center justify-center">
                      a4
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">HOD Panel</p>
                      <p className="text-[10px] font-bold text-slate-400">{department.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          active ? "active-nav-item" : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? "text-[#FF7043]" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Page Body */}
          <div className={`p-4 sm:p-6 lg:p-8 mx-auto w-full ${activeTab === "attendance" ? "max-w-7xl" : "max-w-6xl"}`}>
            {/* ══════════════ TAB 1: OVERVIEW ══════════════ */}
            {activeTab === "overview" && (
              <div className="anim-entrance space-y-6">
                {/* Department Header Banner */}
                <div className="bg-white rounded-3xl card-shadow border border-slate-50 overflow-hidden">
                  <div className="h-28 sm:h-36 bg-gradient-to-r from-[#FF7043] via-[#FF8A65] to-[#FFA726] relative p-6 flex flex-col justify-end">
                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30 inline-block mb-1">
                          Head of Department Panel
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-white">{department.name}</h2>
                        <p className="text-xs text-white/80 font-medium">{instituteName}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setActiveTab("attendance")}
                          className="px-4 py-2 rounded-xl bg-white text-[#FF7043] hover:bg-slate-50 font-black text-xs shadow-sm transition-all"
                        >
                          Check Live Attendance
                        </button>
                        <button
                          onClick={() => setShowAddSection(true)}
                          className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-sm border border-white/30 transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Section
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Join Codes Strip */}
                  <div className="p-4 sm:p-6 bg-slate-50/60 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 card-shadow flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Student Join Code
                        </p>
                        <p className="text-sm font-black text-slate-800 font-mono tracking-wider mt-0.5">
                          {department.student_code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCode(department.student_code, "Student Join Code")}
                        className="p-2 rounded-xl bg-[#FFF5F2] text-[#FF7043] hover:bg-[#FFECDF] transition-colors"
                        title="Copy Student Code"
                      >
                        {copiedCode === department.student_code ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 card-shadow flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Teacher Join Code
                        </p>
                        <p className="text-sm font-black text-slate-800 font-mono tracking-wider mt-0.5">
                          {department.teacher_code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCode(department.teacher_code, "Teacher Join Code")}
                        className="p-2 rounded-xl bg-[#FFF5F2] text-[#FF7043] hover:bg-[#FFECDF] transition-colors"
                        title="Copy Teacher Code"
                      >
                        {copiedCode === department.teacher_code ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sections</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 stat-number mt-1">{sections.length}</p>
                      <p className="text-[11px] text-[#FF7043] font-semibold mt-1">in {department.name}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Teachers</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 stat-number mt-1">{teachers.length}</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">department faculty</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Batches</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 stat-number mt-1">{batches.length}</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">active batches</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Subjects</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 stat-number mt-1">{subjects.length}</p>
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">curriculum mapped</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Quick Shortcuts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Attendance Hub Teaser */}
                  <div
                    onClick={() => setActiveTab("attendance")}
                    className="bg-white rounded-3xl p-5 sm:p-6 card-shadow card-hover border border-slate-50 cursor-pointer relative overflow-hidden group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center">
                        <CalendarCheck className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#FF7043] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-base font-black text-slate-800">Department Attendance Hub</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Track which teachers marked attendance today, check classroom numbers, timings, and download monthly sheets.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#FF7043] bg-[#FFF5F2] px-2.5 py-1 rounded-lg">
                        Daily & Monthly Tracking →
                      </span>
                    </div>
                  </div>

                  {/* Sections Hub Teaser */}
                  <div
                    onClick={() => setActiveTab("sections")}
                    className="bg-white rounded-3xl p-5 sm:p-6 card-shadow card-hover border border-slate-50 cursor-pointer relative overflow-hidden group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#FF7043] group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-base font-black text-slate-800">Manage Sections & Years</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Configure your department sections (e.g. CS-A, CS-B), set graduation year, and link student batches.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#FF7043] bg-[#FFF5F2] px-2.5 py-1 rounded-lg">
                        {sections.length} Sections Configured →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sections Preview List */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 card-shadow border border-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-800">Sections in {department.name}</h3>
                      <p className="text-xs text-slate-400 font-medium">{sections.length} active sections</p>
                    </div>
                    <button onClick={() => setShowAddSection(true)} className="btn-orange px-3.5 py-2 rounded-xl text-xs">
                      <Plus className="w-3.5 h-3.5" /> New Section
                    </button>
                  </div>

                  {sections.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm font-medium">
                      No sections created for this department yet. Click "New Section" to add one.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sections.map((sec) => (
                        <div key={sec.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 text-[#FF7043] font-black text-sm flex items-center justify-center shadow-xs">
                              {sec.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{sec.name}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{sec.year ? `Year ${sec.year}` : "Standard Section"}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF5F2] text-[#FF7043]">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ TAB 2: ATTENDANCE (HODAttendanceDashboard) ══════════════ */}
            {activeTab === "attendance" && (
              <div className="anim-entrance space-y-4">
                <div className="mb-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800">Department Attendance Hub</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live daily tracking of marked lectures by teachers, classrooms, time slots, and monthly reports.
                  </p>
                </div>

                <HODAttendanceDashboard
                  instituteId={instituteId || ""}
                  isHod={true}
                  hodDeptId={department.id}
                  teachers={teachers}
                  batches={batches}
                  departments={department ? [department] : []}
                  subjects={subjects}
                />
              </div>
            )}

            {/* ══════════════ TAB 3: SECTIONS ══════════════ */}
            {activeTab === "sections" && (
              <div className="anim-entrance space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800">Department Sections</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {sections.length} active section{sections.length !== 1 ? "s" : ""} in {department.name}
                    </p>
                  </div>
                  <button onClick={() => setShowAddSection(true)} className="btn-orange px-4 py-2.5 rounded-xl text-xs sm:text-sm">
                    <Plus className="w-4 h-4" /> New Section
                  </button>
                </div>

                {sections.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center card-shadow border border-slate-50">
                    <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3">
                      <Layers className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-slate-700">No sections found</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      Create your first section to organize student batches and timetables.
                    </p>
                    <button onClick={() => setShowAddSection(true)} className="btn-orange px-5 py-2.5 rounded-xl text-xs">
                      Create Section
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sections.map((sec, idx) => {
                      const secBatches = batches.filter((b) => b.section_id === sec.id);
                      return (
                        <div
                          key={sec.id}
                          className="bg-white rounded-2xl p-5 card-shadow card-hover border border-slate-50 relative group anim-row"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-black text-sm">
                              {sec.name.slice(0, 2).toUpperCase()}
                            </div>
                            <button
                              onClick={() => handleDeleteSection(sec.id, sec.name)}
                              title="Delete section"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <h4 className="text-sm font-black text-slate-800">{sec.name}</h4>
                          <p className="text-xs text-slate-400 font-medium mb-3">
                            {sec.year ? `Year ${sec.year}` : "General Section"}
                          </p>

                          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {secBatches.length} Batches
                            </span>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF5F2] text-[#FF7043]">
                              {department.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ TAB 4: TEACHERS ══════════════ */}
            {activeTab === "teachers" && (
              <div className="anim-entrance space-y-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800">Faculty Members</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {teachers.length} teacher{teachers.length !== 1 ? "s" : ""} assigned to {department.name}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(department.teacher_code, "Teacher Join Code")}
                    className="btn-ghost px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#FF7043]" />
                    <span>Copy Join Code</span>
                  </button>
                </div>

                {teachers.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center card-shadow border border-slate-50">
                    <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-slate-700">No teachers found in this department</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Share the teacher join code <code className="font-mono text-[#FF7043] font-bold">{department.teacher_code}</code> with your faculty.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl card-shadow border border-slate-50 overflow-hidden divide-y divide-slate-100">
                    {teachers.map((t, idx) => (
                      <div
                        key={t.id}
                        className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors anim-row"
                        style={{ animationDelay: `${idx * 0.04}s` }}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#FFF5F2] text-[#FF7043] font-black text-sm flex items-center justify-center shrink-0">
                            {(t.user_name || t.user_email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-slate-800 truncate">{t.user_name || "Faculty Member"}</p>
                              {t.role === "hod" && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FFF5F2] text-[#FF7043] border border-[#FF7043]/20">
                                  HOD
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{t.user_email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ TAB 5: BATCHES ══════════════ */}
            {activeTab === "batches" && (
              <div className="anim-entrance space-y-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800">Department Batches</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {batches.length} batch{batches.length !== 1 ? "es" : ""} in {department.name}
                    </p>
                  </div>
                </div>

                {batches.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center card-shadow border border-slate-50">
                    <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-slate-700">No batches in this department</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Batches are automatically created when sections are added.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {batches.map((b, idx) => (
                      <div
                        key={b.id}
                        className="bg-white rounded-2xl p-5 card-shadow card-hover border border-slate-50 anim-row"
                        style={{ animationDelay: `${idx * 0.04}s` }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mb-3">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-black text-slate-800">{b.name}</h4>
                        <p className="text-xs text-slate-400 font-medium mb-3">
                          {b.class_level ? `Class ${b.class_level}` : "General"} {b.subject ? `• ${b.subject}` : ""}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Active Batch
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF5F2] text-[#FF7043]">
                            {department.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══════════ ADD SECTION MODAL ═══════════ */}
      {showAddSection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setShowAddSection(false)}
        >
          <div
            className="glass-overlay rounded-3xl p-6 sm:p-8 max-w-md w-full anim-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Add New Section</h3>
                <p className="text-xs text-slate-400">{department.name} Department</p>
              </div>
              <button
                onClick={() => setShowAddSection(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Section Name *</label>
                <input
                  type="text"
                  placeholder="e.g. CS-A, Mechanical 1, Sec 2"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="field"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Year / Semester (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 1, 2, 3, 4"
                  value={newSectionYear}
                  onChange={(e) => setNewSectionYear(e.target.value ? Number(e.target.value) : "")}
                  className="field"
                  min={1}
                  max={6}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-6">
              <button
                onClick={() => setShowAddSection(false)}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSection}
                disabled={savingSection || !newSectionName.trim()}
                className="btn-orange flex-1 py-2.5 rounded-xl text-xs font-bold"
              >
                {savingSection ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Section"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}