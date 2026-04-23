// src/pages/institute/InstituteDashboardPage.tsx
// Institute Admin Dashboard — Professional, Linear-inspired design
// v3 — Clean, mature aesthetic with SF Pro font

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
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  .anim-in { animation: fadeIn 0.4s ease-out forwards; opacity: 0; }
  .anim-pop { animation: scaleIn 0.25s ease-out forwards; }
  .sidebar-item { transition: all 0.15s ease; }
  .sidebar-item:hover { background: rgba(0,0,0,0.04); }
  .sidebar-item.active { background: rgba(0,0,0,0.06); font-weight: 600; }
  .dark .sidebar-item:hover { background: rgba(255,255,255,0.06); }
  .dark .sidebar-item.active { background: rgba(255,255,255,0.08); }
  .card { background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; transition: box-shadow 0.2s; }
  .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .dark .card { background: rgb(24,24,27); border-color: rgba(255,255,255,0.08); }
  .dark .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .input-field { background: white; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 14px; padding: 10px 14px; width: 100%; outline: none; transition: border-color 0.15s, box-shadow 0.15s; font-weight: 500; color: #111; }
  .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .input-field::placeholder { color: #9ca3af; font-weight: 400; }
  .dark .input-field { background: rgb(30,30,35); border-color: rgba(255,255,255,0.1); color: #f0f0f0; }
  .dark .input-field:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96,165,250,0.15); }
  .btn-primary { background: #111; color: white; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary:hover { background: #333; }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .dark .btn-primary { background: #f0f0f0; color: #111; }
  .dark .btn-primary:hover { background: #ddd; }
  .btn-secondary { background: transparent; color: #555; font-weight: 500; font-size: 13px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
  .btn-secondary:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.2); }
  .dark .btn-secondary { color: #aaa; border-color: rgba(255,255,255,0.12); }
  .dark .btn-secondary:hover { background: rgba(255,255,255,0.05); }
  .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
  .badge-blue { background: #eff6ff; color: #2563eb; }
  .badge-green { background: #f0fdf4; color: #16a34a; }
  .badge-amber { background: #fffbeb; color: #d97706; }
  .dark .badge-blue { background: rgba(37,99,235,0.15); color: #60a5fa; }
  .dark .badge-green { background: rgba(22,163,106,0.15); color: #4ade80; }
  .dark .badge-amber { background: rgba(217,119,6,0.15); color: #fbbf24; }
  .row-item { padding: 12px 16px; border-radius: 10px; display: flex; align-items: center; gap: 12px; transition: background 0.12s; }
  .row-item:hover { background: rgba(0,0,0,0.02); }
  .dark .row-item:hover { background: rgba(255,255,255,0.03); }
  .overlay-bg { background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); }
  .modal-card { background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); max-width: 480px; width: 100%; }
  .dark .modal-card { background: rgb(24,24,27); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
  ::-webkit-scrollbar { width: 6px; }
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
interface Teacher { id: string; user_id: string; role: string; status: string; joined_at: string; user_email?: string; user_name?: string; }
interface Batch { id: string; name: string; class_level: string; subject: string; description: string; is_active: boolean; }
interface Student { id: string; name: string; roll_no: string; class_level: string; parent_name: string; parent_phone: string; batch_id: string; batch_name?: string; is_active: boolean; }

export default function InstituteDashboardPage() {
  const navigate = useNavigate();
  const [assignBatch, setAssignBatch] = useState<{id: string, name: string} | null>(null);
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Admin";
  const [activeTab, setActiveTab] = useState("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [newBatch, setNewBatch] = useState({ name: "", class_level: "", subject: "", description: "" });
  const [newStudent, setNewStudent] = useState({ name: "", roll_no: "", class_level: "", parent_name: "", parent_phone: "", batch_id: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [newInstituteName, setNewInstituteName] = useState("");
  const [creatingInstitute, setCreatingInstitute] = useState(false);

  useEffect(() => { isDarkMode ? document.documentElement.classList.add("dark") : document.documentElement.classList.remove("dark"); }, [isDarkMode]);
  useEffect(() => { const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return; setLoading(true);
    try {
      const { data: m } = await supabase.from("institute_members").select("institute_id,role").eq("user_id", user.id).eq("role", "admin").eq("status", "active").single();
      if (!m) { setLoading(false); return; }
      const id = m.institute_id;
      const [a, b, c, d] = await Promise.all([
        supabase.from("institutes").select("*").eq("id", id).single(),
        supabase.from("institute_members").select("*").eq("institute_id", id).eq("role", "teacher").order("joined_at", { ascending: false }),
        supabase.from("batches").select("*").eq("institute_id", id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("students").select("*, batches(name)").eq("institute_id", id).eq("is_active", true).order("name", { ascending: true }),
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
    </div>
  );

  if (loading) return (<div className="inst-root min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"><style>{styles}</style><div className="text-center"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4" /><p className="text-sm text-zinc-500 font-medium">Loading...</p></div></div>);

  return (
    <div className={`inst-root ${isDarkMode ? "dark" : ""}`}><style>{styles}</style>
      <div className="flex h-[100dvh] w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
        {mobileMenuOpen && <div className="fixed inset-0 overlay-bg z-[90] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

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
          {institute && (<div className="mt-auto p-5 pt-3 border-t border-zinc-100 dark:border-zinc-800"><div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">Join Code</div><div className="flex items-center gap-2"><code className="join-code text-[15px] font-bold text-zinc-900 dark:text-white flex-1">{institute.join_code}</code><button onClick={copyCode} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">{joinCodeCopied ? <I.Check /> : <I.Copy />}</button></div><p className="text-[11px] text-zinc-400 mt-1.5">Share with teachers to invite</p></div>)}
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

        {showAddStudent && (<div className="fixed inset-0 z-[200] flex items-center justify-center px-4 anim-pop"><div className="absolute inset-0 overlay-bg" onClick={() => setShowAddStudent(false)} /><div className="modal-card p-6 sm:p-8 relative z-10"><div className="flex items-center justify-between mb-5"><h3 className="text-[16px] font-semibold">Add Student</h3><button onClick={() => setShowAddStudent(false)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><I.X /></button></div><div className="space-y-3"><input className="input-field" placeholder="Student name *" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} /><div className="grid grid-cols-2 gap-3"><input className="input-field" placeholder="Roll no." value={newStudent.roll_no} onChange={e => setNewStudent({ ...newStudent, roll_no: e.target.value })} /><input className="input-field" placeholder="Class (e.g., 10)" value={newStudent.class_level} onChange={e => setNewStudent({ ...newStudent, class_level: e.target.value })} /></div><input className="input-field" placeholder="Parent name" value={newStudent.parent_name} onChange={e => setNewStudent({ ...newStudent, parent_name: e.target.value })} /><input className="input-field" placeholder="Parent phone" value={newStudent.parent_phone} onChange={e => setNewStudent({ ...newStudent, parent_phone: e.target.value })} /><select className="input-field text-[13px] appearance-none cursor-pointer" value={newStudent.batch_id} onChange={e => setNewStudent({ ...newStudent, batch_id: e.target.value })}><option value="">Select batch (optional)</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><div className="flex justify-end gap-2 pt-2"><button className="btn-secondary text-[12px]" onClick={() => setShowAddStudent(false)}>Cancel</button><button className="btn-primary text-[12px]" onClick={handleAddStudent} disabled={!newStudent.name.trim()}>Add Student</button></div></div></div></div>)}

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